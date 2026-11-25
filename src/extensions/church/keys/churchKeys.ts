/* eslint-disable max-classes-per-file -- the task puts ChurchKeyError and ChurchKeys in this one file */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createChurchKey, getSodium, keyId, loadChurchKeyFile, normalizeRecoveryCode, putRecord, saveChurchKeyFile, unlockWithPassphrase, unlockWithRecoveryCode, WrongSecretError } from "../crypto"
import { type ChurchKeyFile, type HostFolder, type KdfParams, type RecordKind } from "../crypto"

/**
 * The protector for the remembered key: the OS protected storage. e6x backs
 * it with Electron safeStorage; tests use a fake.
 */
export interface KeyProtector {
    available(): boolean
    protect(text: string): Uint8Array
    unprotect(data: Uint8Array): string
}

/** A church service record read from the running app: a show, a project, or the Sunday order. */
export interface ChurchRecord {
    kind: RecordKind
    id: string
    data: unknown
}

/**
 * The dependencies of the church key service. `dir` holds `church-key.json`
 * (via disk.ts) and `remembered.bin` (the protector's output); `copyFolder`
 * is where `saveChurchCopy` writes; `readChurchData` reads the records to
 * copy; `kdf` is the Argon2id cost for new keys.
 */
export interface ChurchKeyDeps {
    dir: string
    copyFolder: HostFolder
    protector: KeyProtector
    readChurchData(): Promise<ChurchRecord[]>
    kdf?: KdfParams
}

/** What the church key service is doing right now. */
export type ChurchKeyStatus = { state: "none" } | { state: "setup"; churchName: string; checkGroup: number } | { state: "locked"; churchName: string } | { state: "unlocked"; churchName: string; remembered: boolean; canRemember: boolean }

/** A plain volunteer-word error from the church key service. Never contains a passphrase, a recovery code, or a key. */
export class ChurchKeyError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ChurchKeyError"
    }
}

/** The file name of the remembered key inside the key dir. */
const REMEMBERED_FILE = "remembered.bin"

/** True when a node:fs error means the path does not exist. */
function isMissing(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ENOENT"
}

/** Zero a buffer in place. Not crypto; the same as the keyslot's. */
function memzero(buf: Uint8Array): void {
    for (let i = 0; i < buf.length; i++) buf[i] = 0
}

/** A typed group: trim, uppercase, O to 0, I/L to 1. */
function normalizeGroup(input: string): string {
    let out = ""
    for (const ch of input.trim().toUpperCase()) {
        if (ch === "O") out += "0"
        else if (ch === "I" || ch === "L") out += "1"
        else out += ch
    }
    return out
}

/** Write remembered.bin atomically: "remembered.bin.part" then rename, mode 0o600. */
async function writeRemembered(dir: string, data: Uint8Array): Promise<void> {
    await mkdir(dir, { recursive: true })
    const part = join(dir, REMEMBERED_FILE + ".part")
    await writeFile(part, data, { mode: 0o600 })
    await rename(part, join(dir, REMEMBERED_FILE))
}

/** The pending setup: the new key, its file, the recovery code, and the check group. */
interface PendingSetup {
    churchName: string
    key: Uint8Array
    file: ChurchKeyFile
    recoveryCode: string
    checkGroup: number
}

/** The unlocked key and whether this computer remembers it. */
interface HeldKey {
    key: Uint8Array
    remembered: boolean
}

/**
 * The church key service: the one place that holds the unlocked church key
 * in memory. It does the first-time setup (with a group check against the
 * written-down recovery code), unlock by passphrase or recovery code,
 * "forget on this computer", and copying the church's records to a host
 * folder. Each computer remembers the unlocked key in `remembered.bin`
 * through the protector (the OS protected storage); when the OS has no safe
 * store, the key is not remembered and the passphrase is asked at each
 * start. The key never leaves the service: no method returns it. Pure
 * TypeScript — no Electron, no UI.
 */
export class ChurchKeys {
    private readonly deps: ChurchKeyDeps
    /** undefined until the first load; null when no key file exists. */
    private file: ChurchKeyFile | null | undefined
    private held: HeldKey | null
    private pending: PendingSetup | null

    constructor(deps: ChurchKeyDeps) {
        this.deps = deps
        this.file = undefined
        this.held = null
        this.pending = null
    }

    /**
     * The current state. The first call loads `church-key.json`; when
     * `remembered.bin` exists and the protector is available, the remembered
     * key is un-protected and kept only when it is the key the file names —
     * a bad or foreign remembered key is deleted and the state stays locked.
     * Never throws on a bad remembered.bin.
     */
    async status(): Promise<ChurchKeyStatus> {
        if (this.file === undefined) {
            this.file = await loadChurchKeyFile(this.deps.dir)
            if (this.file === null) {
                await this.removeRemembered()
                return { state: "none" }
            }
        }
        if (this.held === null) await this.tryRemembered()
        return this.statusOf()
    }

    /**
     * Start the first-time setup: create the church key under the passphrase
     * (at least 8 characters) and a fresh recovery code, and pick a random
     * group of the code to check at finish. Nothing is written to disk yet;
     * the state becomes "setup". Refuses when a key file already exists or
     * the name is blank.
     */
    async startSetup(churchName: string, passphrase: string): Promise<{ recoveryCode: string; checkGroup: number }> {
        if (this.file === undefined) this.file = await loadChurchKeyFile(this.deps.dir)
        if (this.file !== null) throw new ChurchKeyError("This church is already set up on this computer.")
        if (churchName.trim().length === 0) throw new ChurchKeyError("Type the church name.")
        if (this.pending !== null) memzero(this.pending.key)
        const created = await createChurchKey(churchName, passphrase, new Date(), this.deps.kdf)
        const s = await getSodium()
        this.pending = { churchName, key: created.key, file: created.file, recoveryCode: created.recoveryCode, checkGroup: s.randombytes_uniform(6) + 1 }
        return { recoveryCode: created.recoveryCode, checkGroup: this.pending.checkGroup }
    }

    /**
     * Finish the setup: compare the typed group (trim, uppercase, O to 0,
     * I/L to 1) with group `checkGroup` of the recovery code. On a match the
     * key file is saved, the key is remembered, and the state becomes
     * "unlocked"; on a mismatch the ChurchKeyError names the group.
     */
    async finishSetup(typedGroup: string): Promise<ChurchKeyStatus> {
        if (this.pending === null) throw new ChurchKeyError("There is no church setup to finish.")
        const wanted = this.pending.recoveryCode.split("-")[this.pending.checkGroup - 1]
        if (normalizeGroup(typedGroup) !== wanted) throw new ChurchKeyError(`That does not match group ${this.pending.checkGroup} of the code. Check the paper and try again.`)
        const pending = this.pending
        this.pending = null
        await saveChurchKeyFile(this.deps.dir, pending.file)
        this.file = pending.file
        const held: HeldKey = { key: pending.key, remembered: false }
        this.held = held
        await this.remember(held)
        return this.statusOf()
    }

    /** Give up the setup: back to "none" (when no key file), the pending key zeroed. */
    // eslint-disable-next-line @typescript-eslint/require-await -- the service contract is async; there is nothing to await
    async cancelSetup(): Promise<ChurchKeyStatus> {
        if (this.pending !== null) {
            memzero(this.pending.key)
            this.pending = null
        }
        return this.statusOf()
    }

    /**
     * Unlock with the passphrase; when that does not work and the input is a
     * well-formed recovery code, try the recovery code. On success the key is
     * remembered and the state becomes "unlocked".
     */
    async unlock(secret: string): Promise<ChurchKeyStatus> {
        if (this.file === undefined) this.file = await loadChurchKeyFile(this.deps.dir)
        if (this.file === null) throw new ChurchKeyError("There is no church key on this computer yet.")
        let key: Uint8Array
        try {
            key = await unlockWithPassphrase(this.file, secret)
        } catch (err) {
            if (!(err instanceof WrongSecretError)) throw err
            if (normalizeRecoveryCode(secret) === null) throw new ChurchKeyError("That passphrase or recovery code did not work.")
            try {
                key = await unlockWithRecoveryCode(this.file, secret)
            } catch (err2) {
                if (err2 instanceof WrongSecretError) throw new ChurchKeyError("That passphrase or recovery code did not work.")
                throw err2
            }
        }
        const held: HeldKey = { key, remembered: false }
        this.held = held
        await this.remember(held)
        return this.statusOf()
    }

    /**
     * "Forget on this computer": delete `remembered.bin`, zero the key, and
     * go back to "locked". The key file stays; the passphrase or the
     * recovery code still unlock it.
     */
    async forget(): Promise<ChurchKeyStatus> {
        await this.removeRemembered()
        if (this.held !== null) {
            memzero(this.held.key)
            this.held = null
        }
        return this.statusOf()
    }

    /**
     * Copy the church's records to the copy folder, sealed under the church
     * key: one ciphertext file per record. Requires the unlock.
     */
    async saveChurchCopy(): Promise<{ count: number }> {
        if (this.held === null) throw new ChurchKeyError("Unlock the church files first.")
        const key = this.held.key
        const records = await this.deps.readChurchData()
        let count = 0
        for (const record of records) {
            await putRecord(this.deps.copyFolder, key, record.kind, record.id, record.data)
            count += 1
        }
        return { count }
    }

    /** Remember the key on this computer when the protector is available; otherwise remember nothing. */
    private async remember(held: HeldKey): Promise<void> {
        const protector = this.deps.protector
        if (!protector.available()) {
            held.remembered = false
            return
        }
        const s = await getSodium()
        await writeRemembered(this.deps.dir, protector.protect(s.to_base64(held.key, s.base64_variants.ORIGINAL)))
        held.remembered = true
    }

    /** Try to unlock from remembered.bin; a bad or foreign remembered key is deleted and the state stays locked. */
    private async tryRemembered(): Promise<void> {
        const protector = this.deps.protector
        if (!protector.available()) return
        let data: Uint8Array
        try {
            data = await readFile(join(this.deps.dir, REMEMBERED_FILE))
        } catch (err) {
            if (isMissing(err)) return
            throw err
        }
        let key: Uint8Array
        try {
            const s = await getSodium()
            key = s.from_base64(protector.unprotect(data), s.base64_variants.ORIGINAL)
        } catch {
            await this.removeRemembered()
            return
        }
        if ((await keyId(key)) !== this.file?.kid) {
            memzero(key)
            await this.removeRemembered()
            return
        }
        this.held = { key, remembered: true }
    }

    /** Delete remembered.bin, ignoring a missing file. */
    private async removeRemembered(): Promise<void> {
        try {
            await rm(join(this.deps.dir, REMEMBERED_FILE))
        } catch (err) {
            if (isMissing(err)) return
            throw err
        }
    }

    /** The status object for the current state. */
    private statusOf(): ChurchKeyStatus {
        if (this.pending !== null) return { state: "setup", churchName: this.pending.churchName, checkGroup: this.pending.checkGroup }
        if (this.held !== null && this.file !== undefined && this.file !== null) {
            return { state: "unlocked", churchName: this.file.churchName, remembered: this.held.remembered, canRemember: this.deps.protector.available() }
        }
        if (this.file !== undefined && this.file !== null) return { state: "locked", churchName: this.file.churchName }
        return { state: "none" }
    }
}
