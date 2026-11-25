import { keyId, newKey } from "./envelope"
import { DEFAULT_KDF, isKeySlot, type KdfParams, type KeySlot, type SlotKind, unwrapKey, wrapKey, WrongSecretError } from "./keyslot"
import { newRecoveryCode, normalizeRecoveryCode } from "./recovery"

/**
 * The church (org) key file: the header of a church's key plus its key
 * slots. One per church; protects church-owned data (service plans, decks,
 * the song library, and later the directory, rosters, and church-wide
 * channels).
 */
export interface ChurchKeyFile {
    ejs: 1
    type: "church-key"
    kid: string
    churchName: string
    /** ISO date the key was created. */
    created: string
    slots: KeySlot[]
}

/** The result of creating a church key: the key, the recovery code to write down, and the file to keep. */
export interface NewChurchKey {
    key: Uint8Array
    recoveryCode: string
    file: ChurchKeyFile
}

/** Plain-word passphrase rule, checked before any crypto. */
function checkPassphrase(passphrase: string): void {
    if (passphrase.trim().length < 8) throw new Error("Choose a passphrase with at least 8 characters.")
}

/** The slot of a kind in the file; a plain Error if the file has none. */
function findSlot(file: ChurchKeyFile, kind: SlotKind): KeySlot {
    const slot = file.slots.find((s) => s.kind === kind)
    if (!slot) throw new Error(`This church key file has no ${kind} slot.`)
    return slot
}

/** The key must be the one the file names, or WrongSecretError. */
async function assertKeyMatches(file: ChurchKeyFile, key: Uint8Array): Promise<void> {
    if ((await keyId(key)) !== file.kid) throw new WrongSecretError()
}

/**
 * Create the church key: a fresh 32-byte key wrapped in two slots, under the
 * volunteer's passphrase (at least 8 characters after trim) and under a
 * fresh recovery code.
 */
export async function createChurchKey(churchName: string, passphrase: string, now: Date = new Date(), kdf: KdfParams = DEFAULT_KDF): Promise<NewChurchKey> {
    checkPassphrase(passphrase)
    const key = await newKey()
    const kid = await keyId(key)
    const recoveryCode = await newRecoveryCode()
    const slots = [await wrapKey(key, passphrase, "passphrase", kdf), await wrapKey(key, recoveryCode, "recovery", kdf)]
    const file: ChurchKeyFile = { ejs: 1, type: "church-key", kid, churchName, created: now.toISOString(), slots }
    return { key, recoveryCode, file }
}

/**
 * Unlock the church key with the volunteer's passphrase. WrongSecretError if
 * the passphrase slot does not open or the key is not the one the file names.
 */
export async function unlockWithPassphrase(file: ChurchKeyFile, passphrase: string): Promise<Uint8Array> {
    const key = await unwrapKey(findSlot(file, "passphrase"), passphrase)
    await assertKeyMatches(file, key)
    return key
}

/**
 * Unlock the church key with the written-down recovery code. The code is
 * normalized first (a malformed code is a WrongSecretError), then the
 * recovery slot opens and the key-id check runs as for the passphrase.
 */
export async function unlockWithRecoveryCode(file: ChurchKeyFile, code: string): Promise<Uint8Array> {
    const normalized = normalizeRecoveryCode(code)
    if (normalized === null) throw new WrongSecretError()
    const key = await unwrapKey(findSlot(file, "recovery"), normalized)
    await assertKeyMatches(file, key)
    return key
}

/**
 * Replace the passphrase slot with one under a new passphrase (at least 8
 * characters after trim); the key must be the one the file names and the
 * recovery slot is untouched. Returns a new file; the old one still works.
 */
export async function changePassphrase(file: ChurchKeyFile, key: Uint8Array, newPassphrase: string, kdf: KdfParams = DEFAULT_KDF): Promise<ChurchKeyFile> {
    checkPassphrase(newPassphrase)
    await assertKeyMatches(file, key)
    const slot = await wrapKey(key, newPassphrase, "passphrase", kdf)
    return { ...file, slots: file.slots.map((s) => (s.kind === "passphrase" ? slot : s)) }
}

/**
 * Replace the recovery slot with one under a fresh recovery code (for the
 * volunteer who lost the paper); the key must be the one the file names.
 * Returns the new file and the new code to write down.
 */
export async function newRecoverySlot(file: ChurchKeyFile, key: Uint8Array, kdf: KdfParams = DEFAULT_KDF): Promise<{ file: ChurchKeyFile; recoveryCode: string }> {
    await assertKeyMatches(file, key)
    const recoveryCode = await newRecoveryCode()
    const slot = await wrapKey(key, recoveryCode, "recovery", kdf)
    return { file: { ...file, slots: file.slots.map((s) => (s.kind === "recovery" ? slot : s)) }, recoveryCode }
}

/** Shape check only: does this value look like a church key file? */
export function isChurchKeyFile(x: unknown): x is ChurchKeyFile {
    if (typeof x !== "object" || x === null) return false
    const f = x as Record<string, unknown>
    return f.ejs === 1 && f.type === "church-key" && typeof f.kid === "string" && typeof f.churchName === "string" && typeof f.created === "string" && Array.isArray(f.slots) && f.slots.every(isKeySlot)
}

/** Serialize a church key file to a JSON string. */
export function churchKeyFileToString(f: ChurchKeyFile): string {
    return JSON.stringify(f)
}

/** Parse and shape-check a church key file JSON string; a plain Error otherwise. */
export function parseChurchKeyFile(s: string): ChurchKeyFile {
    let parsed: unknown
    try {
        parsed = JSON.parse(s)
    } catch {
        throw new Error("This is not a church key file.")
    }
    if (!isChurchKeyFile(parsed)) throw new Error("This is not a church key file.")
    return parsed
}
