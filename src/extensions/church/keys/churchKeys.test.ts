import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { CHURCH_KEY_FILE, createChurchKey, getSodium, MIN_KDF, memoryFolder } from "../crypto"
import { ChurchKeyError, ChurchKeys, type ChurchKeyDeps, type ChurchRecord } from "./churchKeys"

const DIR = join(process.cwd(), "node_modules", ".ejs-test", "keys-" + process.pid)
const CHURCH = "Lantern Hill Chapel"
const OTHER_CHURCH = "Another Chapel"
const PASSPHRASE = "lantern hill pass phrase"
const OTHER_PASSPHRASE = "another chapel phrase"
const REMEMBERED = "remembered.bin"

/** A test double for KeyProtector: not encryption, test double. */
function fakeProtector(initiallyAvailable = true): { setAvailable(available: boolean): void; available(): boolean; protect(text: string): Uint8Array; unprotect(data: Uint8Array): string } {
    let available = initiallyAvailable
    return {
        setAvailable(v) {
            available = v
        },
        available() {
            return available
        },
        protect(text: string): Uint8Array {
            return new TextEncoder().encode("FAKE" + [...text].reverse().join(""))
        },
        unprotect(data: Uint8Array): string {
            const text = new TextDecoder().decode(data)
            if (!text.startsWith("FAKE")) throw new Error("not a remembered key")
            return [...text.slice(4)].reverse().join("")
        }
    }
}

let protector: ReturnType<typeof fakeProtector>
let copyFolder: ReturnType<typeof memoryFolder>

beforeEach(async () => {
    await mkdir(DIR, { recursive: true })
    protector = fakeProtector()
    copyFolder = memoryFolder()
})

afterEach(async () => {
    await rm(DIR, { recursive: true, force: true })
})

function deps(over: Partial<ChurchKeyDeps> = {}): ChurchKeyDeps {
    return { dir: DIR, copyFolder, protector, readChurchData: async () => [], kdf: MIN_KDF, ...over }
}

/** Await a failing call and assert it threw a ChurchKeyError with the exact message. */
async function expectChurchError(p: Promise<unknown>, message: string): Promise<void> {
    let caught: unknown
    try {
        await p
    } catch (e) {
        caught = e
    }
    expect(caught).toBeInstanceOf(ChurchKeyError)
    expect((caught as Error).message).toBe(message)
}

/** Run startSetup and finishSetup with the right group typed lowercase. Returns the recovery code. */
async function setupChurch(keys: ChurchKeys): Promise<string> {
    const started = await keys.startSetup(CHURCH, PASSPHRASE)
    const group = started.recoveryCode.split("-")[started.checkGroup - 1]
    await keys.finishSetup(group.toLowerCase())
    return started.recoveryCode
}

describe("churchKeys", () => {
    it("a fresh dir is none, and a stale remembered.bin is deleted", async () => {
        const keys = new ChurchKeys(deps())
        expect(await keys.status()).toEqual({ state: "none" })
        await writeFile(join(DIR, REMEMBERED), new Uint8Array([1, 2, 3]))
        expect(await keys.status()).toEqual({ state: "none" })
        expect(await keys.forget()).toEqual({ state: "none" })
        expect(await readdir(DIR)).toEqual([])
    })

    it("setup: nothing on disk until finish, the group check, then unlocked", async () => {
        const keys = new ChurchKeys(deps())
        const started = await keys.startSetup(CHURCH, PASSPHRASE)
        expect(started.checkGroup).toBeGreaterThanOrEqual(1)
        expect(started.checkGroup).toBeLessThanOrEqual(6)
        expect(started.recoveryCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/)
        expect(await readdir(DIR)).toEqual([])
        expect(await keys.status()).toEqual({ state: "setup", churchName: CHURCH, checkGroup: started.checkGroup })
        const good = started.recoveryCode.split("-")[started.checkGroup - 1]
        const bad = (good.charAt(0) === "A" ? "B" : "A") + good.slice(1)
        await expectChurchError(keys.finishSetup(bad), `That does not match group ${started.checkGroup} of the code. Check the paper and try again.`)
        expect(await keys.status()).toEqual({ state: "setup", churchName: CHURCH, checkGroup: started.checkGroup })
        expect(await keys.finishSetup(good.toLowerCase())).toEqual({ state: "unlocked", churchName: CHURCH, remembered: true, canRemember: true })
        const entries = await readdir(DIR)
        expect(entries).toContain(CHURCH_KEY_FILE)
        expect(entries).toContain(REMEMBERED)
    })

    it("a remembered key unlocks a fresh instance without a secret", async () => {
        const first = new ChurchKeys(deps())
        await setupChurch(first)
        const second = new ChurchKeys(deps())
        expect(await second.status()).toEqual({ state: "unlocked", churchName: CHURCH, remembered: true, canRemember: true })
    })

    it("no safe store: locked on start, and unlock does not remember", async () => {
        const first = new ChurchKeys(deps())
        await setupChurch(first)
        const noStore = fakeProtector(false)
        const second = new ChurchKeys(deps({ protector: noStore }))
        expect(await second.status()).toEqual({ state: "locked", churchName: CHURCH })
        expect(await second.unlock(PASSPHRASE)).toEqual({ state: "unlocked", churchName: CHURCH, remembered: false, canRemember: false })
    })

    it("forget: locked, remembered.bin gone, a fresh instance stays locked, the recovery code still works", async () => {
        const keys = new ChurchKeys(deps())
        const code = await setupChurch(keys)
        expect(await keys.forget()).toEqual({ state: "locked", churchName: CHURCH })
        const entries = await readdir(DIR)
        expect(entries).toContain(CHURCH_KEY_FILE)
        expect(entries).not.toContain(REMEMBERED)
        const second = new ChurchKeys(deps())
        expect(await second.status()).toEqual({ state: "locked", churchName: CHURCH })
        const typed = code.toLowerCase().replaceAll("-", " ")
        expect(await second.unlock(typed)).toEqual({ state: "unlocked", churchName: CHURCH, remembered: true, canRemember: true })
    })

    it("a wrong secret gives the plain error without the secret in the message", async () => {
        const keys = new ChurchKeys(deps())
        await setupChurch(keys)
        const wrong = "totally wrong phrase"
        let caught: unknown
        try {
            await keys.unlock(wrong)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ChurchKeyError)
        expect((caught as Error).message).toBe("That passphrase or recovery code did not work.")
        expect((caught as Error).message).not.toContain(wrong)
    })

    it("a well-formed but wrong recovery code gives the plain error", async () => {
        const keys = new ChurchKeys(deps())
        await setupChurch(keys)
        const other = await createChurchKey(OTHER_CHURCH, OTHER_PASSPHRASE, new Date(), MIN_KDF)
        const typed = other.recoveryCode.toLowerCase().replaceAll("-", " ")
        let caught: unknown
        try {
            await keys.unlock(typed)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ChurchKeyError)
        expect((caught as Error).message).toBe("That passphrase or recovery code did not work.")
        expect((caught as Error).message).not.toContain(typed)
    })

    it("a corrupt remembered.bin is deleted and the state stays locked", async () => {
        const keys = new ChurchKeys(deps())
        await setupChurch(keys)
        const s = await getSodium()
        await writeFile(join(DIR, REMEMBERED), s.randombytes_buf(32))
        const second = new ChurchKeys(deps())
        expect(await second.status()).toEqual({ state: "locked", churchName: CHURCH })
        expect(await readdir(DIR)).not.toContain(REMEMBERED)
    })

    it("a remembered key from another church is deleted and the state stays locked", async () => {
        const keys = new ChurchKeys(deps())
        await setupChurch(keys)
        const s = await getSodium()
        const other = await createChurchKey(OTHER_CHURCH, OTHER_PASSPHRASE, new Date(), MIN_KDF)
        await writeFile(join(DIR, REMEMBERED), protector.protect(s.to_base64(other.key, s.base64_variants.ORIGINAL)))
        const second = new ChurchKeys(deps())
        expect(await second.status()).toEqual({ state: "locked", churchName: CHURCH })
        expect(await readdir(DIR)).not.toContain(REMEMBERED)
    })

    it("startSetup refuses a blank name, and refuses when a key file exists", async () => {
        const fresh = new ChurchKeys(deps())
        await expectChurchError(fresh.startSetup("   ", PASSPHRASE), "Type the church name.")
        const keys = new ChurchKeys(deps())
        await setupChurch(keys)
        await expectChurchError(keys.startSetup(CHURCH, PASSPHRASE), "This church is already set up on this computer.")
    })

    it("a second startSetup replaces the pending setup", async () => {
        const keys = new ChurchKeys(deps())
        await keys.startSetup(CHURCH, PASSPHRASE)
        const second = await keys.startSetup(CHURCH, PASSPHRASE)
        const group = second.recoveryCode.split("-")[second.checkGroup - 1]
        expect(await keys.finishSetup(group)).toEqual({ state: "unlocked", churchName: CHURCH, remembered: true, canRemember: true })
        expect(await readdir(DIR)).toContain(CHURCH_KEY_FILE)
    })

    it("cancelSetup goes back to none and writes nothing", async () => {
        const keys = new ChurchKeys(deps())
        await keys.startSetup(CHURCH, PASSPHRASE)
        expect(await keys.cancelSetup()).toEqual({ state: "none" })
        expect(await keys.cancelSetup()).toEqual({ state: "none" })
        expect(await readdir(DIR)).toEqual([])
    })

    it("unlock with no key file gives the plain error", async () => {
        const keys = new ChurchKeys(deps())
        await expectChurchError(keys.unlock(PASSPHRASE), "There is no church key on this computer yet.")
    })

    it("finishSetup with no pending setup gives the plain error", async () => {
        const keys = new ChurchKeys(deps())
        await expectChurchError(keys.finishSetup("AAAA"), "There is no church setup to finish.")
    })

    it("an fs error that is not 'missing' propagates", async () => {
        const keys = new ChurchKeys(deps())
        await setupChurch(keys)
        await rm(join(DIR, REMEMBERED))
        await mkdir(join(DIR, REMEMBERED))
        const second = new ChurchKeys(deps())
        await expect(second.status()).rejects.toThrow()
        await expect(second.forget()).rejects.toThrow()
    })

    it("saveChurchCopy needs the unlock, and seals every record", async () => {
        const records: ChurchRecord[] = [
            { kind: "show", id: "show-1", data: { title: "Lantern Hymn", text: "Little lantern on the hill" } },
            { kind: "project", id: "project-1", data: { title: "Sunday 10:30" } }
        ]
        const keys = new ChurchKeys(deps({ readChurchData: async () => records }))
        await expectChurchError(keys.saveChurchCopy(), "Unlock the church files first.")
        await setupChurch(keys)
        await keys.forget()
        await expectChurchError(keys.saveChurchCopy(), "Unlock the church files first.")
        await keys.unlock(PASSPHRASE)
        expect(await keys.saveChurchCopy()).toEqual({ count: 2 })
        expect(copyFolder.files.size).toBe(2)
        for (const text of copyFolder.files.values()) {
            expect(text).not.toContain("Lantern Hymn")
            expect(text).not.toContain("Little lantern on the hill")
            expect(text).not.toContain("Sunday 10:30")
        }
    })

    it("no status object, church-key.json, or remembered.bin holds the passphrase or the recovery code", async () => {
        const keys = new ChurchKeys(deps())
        const started = await keys.startSetup(CHURCH, PASSPHRASE)
        const code = started.recoveryCode
        await keys.finishSetup(started.recoveryCode.split("-")[started.checkGroup - 1])
        const seen = [await keys.status(), await keys.forget(), await keys.unlock(PASSPHRASE), await keys.status()]
        for (const status of seen) {
            const text = JSON.stringify(status)
            expect(text).not.toContain(PASSPHRASE)
            expect(text).not.toContain(code)
        }
        const keyFile = await readFile(join(DIR, CHURCH_KEY_FILE), "utf8")
        expect(keyFile).not.toContain(PASSPHRASE)
        expect(keyFile).not.toContain(code)
        const remembered = new TextDecoder().decode(await readFile(join(DIR, REMEMBERED)))
        expect(remembered).not.toContain(PASSPHRASE)
        expect(remembered).not.toContain(code)
    })
})
