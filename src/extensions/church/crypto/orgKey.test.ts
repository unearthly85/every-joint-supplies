import { describe, expect, it } from "vitest"
import { keyId } from "./envelope"
import { MIN_KDF, type KeySlot, WrongSecretError } from "./keyslot"
import { getSodium } from "./sodium"
import { changePassphrase, churchKeyFileToString, createChurchKey, isChurchKeyFile, newRecoverySlot, parseChurchKeyFile, unlockWithPassphrase, unlockWithRecoveryCode, type ChurchKeyFile } from "./orgKey"

const CHURCH = "Lantern Hill Chapel"
const OTHER_CHURCH = "Another Chapel"
const PASSPHRASE = "lantern hill pass phrase"
const OTHER_PASSPHRASE = "another chapel phrase"
const NOW = new Date("2026-11-25T12:00:00.000Z")

/** Await a failing call and assert it threw a WrongSecretError with the fixed message. */
async function expectWrongSecret(p: Promise<unknown>, secrets: string[]): Promise<void> {
    let caught: unknown
    try {
        await p
    } catch (e) {
        caught = e
    }
    expect(caught).toBeInstanceOf(WrongSecretError)
    const message = (caught as WrongSecretError).message
    expect(message).toBe("That passphrase or recovery code did not work.")
    for (const secret of secrets) expect(message).not.toContain(secret)
}

/** Await a failing call and assert it threw a plain Error with the exact message. */
async function expectPlainError(p: Promise<unknown>, message: string): Promise<void> {
    let caught: unknown
    try {
        await p
    } catch (e) {
        caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(WrongSecretError)
    expect((caught as Error).message).toBe(message)
}

/** The slot of a kind in a test file; throws if the test data is broken. */
function slotOf(file: ChurchKeyFile, kind: "passphrase" | "recovery"): KeySlot {
    const slot = file.slots.find((s) => s.kind === kind)
    if (!slot) throw new Error("test: missing slot")
    return slot
}

describe("orgKey", () => {
    it("createChurchKey makes a file both secrets unlock to the same key", async () => {
        const s = await getSodium()
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        expect(created.file.ejs).toBe(1)
        expect(created.file.type).toBe("church-key")
        expect(created.file.churchName).toBe(CHURCH)
        expect(created.file.created).toBe(NOW.toISOString())
        expect(created.file.kid).toBe(await keyId(created.key))
        expect(created.file.slots.map((sl) => sl.kind)).toEqual(["passphrase", "recovery"])
        const byPassphrase = await unlockWithPassphrase(created.file, PASSPHRASE)
        const byRecoveryCode = await unlockWithRecoveryCode(created.file, created.recoveryCode)
        expect(s.to_hex(byPassphrase)).toBe(s.to_hex(created.key))
        expect(s.to_hex(byRecoveryCode)).toBe(s.to_hex(created.key))
    })

    it("a wrong passphrase gives WrongSecretError with no secret in the message", async () => {
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const wrong = "a different phrase"
        await expectWrongSecret(unlockWithPassphrase(created.file, wrong), [wrong, PASSPHRASE])
    })

    it("a wrong or malformed recovery code gives WrongSecretError", async () => {
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const other = await createChurchKey(OTHER_CHURCH, OTHER_PASSPHRASE, NOW, MIN_KDF)
        await expectWrongSecret(unlockWithRecoveryCode(created.file, other.recoveryCode), [other.recoveryCode, created.recoveryCode])
        await expectWrongSecret(unlockWithRecoveryCode(created.file, "way too short"), [])
        await expectWrongSecret(unlockWithRecoveryCode(created.file, created.recoveryCode + "00"), [])
    })

    it("a recovery code typed lowercase with spaces still unlocks", async () => {
        const s = await getSodium()
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const typed = created.recoveryCode.toLowerCase().replaceAll("-", " ")
        expect(s.to_hex(await unlockWithRecoveryCode(created.file, typed))).toBe(s.to_hex(created.key))
    })

    it("rejects a passphrase under 8 characters with the plain message", async () => {
        await expectPlainError(createChurchKey(CHURCH, "short", NOW, MIN_KDF), "Choose a passphrase with at least 8 characters.")
        await expectPlainError(createChurchKey(CHURCH, "1234567", NOW, MIN_KDF), "Choose a passphrase with at least 8 characters.")
        await expectPlainError(createChurchKey(CHURCH, "   ", NOW, MIN_KDF), "Choose a passphrase with at least 8 characters.")
        const eight = await createChurchKey(CHURCH, "12345678", NOW, MIN_KDF)
        expect(eight.file.kid).toBe(await keyId(eight.key))
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        await expectPlainError(changePassphrase(created.file, created.key, "short", MIN_KDF), "Choose a passphrase with at least 8 characters.")
    })

    it("changePassphrase: the old passphrase stops working, the new one and the recovery code work", async () => {
        const s = await getSodium()
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const next = "a brand new phrase"
        const file = await changePassphrase(created.file, created.key, next, MIN_KDF)
        await expectWrongSecret(unlockWithPassphrase(file, PASSPHRASE), [PASSPHRASE, next])
        expect(s.to_hex(await unlockWithPassphrase(file, next))).toBe(s.to_hex(created.key))
        expect(s.to_hex(await unlockWithRecoveryCode(file, created.recoveryCode))).toBe(s.to_hex(created.key))
        expect(s.to_hex(await unlockWithPassphrase(created.file, PASSPHRASE))).toBe(s.to_hex(created.key))
    })

    it("changePassphrase rejects a key that is not the one the file names", async () => {
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const stranger = await createChurchKey(OTHER_CHURCH, OTHER_PASSPHRASE, NOW, MIN_KDF)
        await expectWrongSecret(changePassphrase(created.file, stranger.key, "a brand new phrase", MIN_KDF), [PASSPHRASE, OTHER_PASSPHRASE])
    })

    it("newRecoverySlot: the old code stops working, the new code and the passphrase work", async () => {
        const s = await getSodium()
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const { file, recoveryCode } = await newRecoverySlot(created.file, created.key, MIN_KDF)
        expect(recoveryCode).not.toBe(created.recoveryCode)
        await expectWrongSecret(unlockWithRecoveryCode(file, created.recoveryCode), [created.recoveryCode, recoveryCode])
        expect(s.to_hex(await unlockWithRecoveryCode(file, recoveryCode))).toBe(s.to_hex(created.key))
        expect(s.to_hex(await unlockWithPassphrase(file, PASSPHRASE))).toBe(s.to_hex(created.key))
        expect(s.to_hex(await unlockWithRecoveryCode(created.file, created.recoveryCode))).toBe(s.to_hex(created.key))
    })

    it("newRecoverySlot rejects a key that is not the one the file names", async () => {
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const stranger = await createChurchKey(OTHER_CHURCH, OTHER_PASSPHRASE, NOW, MIN_KDF)
        await expectWrongSecret(newRecoverySlot(created.file, stranger.key, MIN_KDF), [PASSPHRASE, OTHER_PASSPHRASE])
    })

    it("a slot swapped in from another church's file fails the key-id check", async () => {
        const a = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const b = await createChurchKey(OTHER_CHURCH, OTHER_PASSPHRASE, NOW, MIN_KDF)
        const swappedPassphrase = { ...a.file, slots: a.file.slots.map((sl) => (sl.kind === "passphrase" ? slotOf(b.file, "passphrase") : sl)) }
        await expectWrongSecret(unlockWithPassphrase(swappedPassphrase, OTHER_PASSPHRASE), [OTHER_PASSPHRASE, PASSPHRASE])
        const swappedRecovery = { ...a.file, slots: a.file.slots.map((sl) => (sl.kind === "recovery" ? slotOf(b.file, "recovery") : sl)) }
        await expectWrongSecret(unlockWithRecoveryCode(swappedRecovery, b.recoveryCode), [b.recoveryCode, a.recoveryCode])
    })

    it("a file without the slot kind gives a plain error", async () => {
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const noPassphrase = { ...created.file, slots: created.file.slots.filter((sl) => sl.kind !== "passphrase") }
        await expectPlainError(unlockWithPassphrase(noPassphrase, PASSPHRASE), "This church key file has no passphrase slot.")
        const noRecovery = { ...created.file, slots: created.file.slots.filter((sl) => sl.kind !== "recovery") }
        await expectPlainError(unlockWithRecoveryCode(noRecovery, created.recoveryCode), "This church key file has no recovery slot.")
    })

    it("the file string hides the key hex, the passphrase, and the recovery code; parse round-trips", async () => {
        const s = await getSodium()
        const created = await createChurchKey(CHURCH, PASSPHRASE, NOW, MIN_KDF)
        const json = churchKeyFileToString(created.file)
        expect(json).not.toContain(s.to_hex(created.key))
        expect(json).not.toContain(PASSPHRASE)
        expect(json).not.toContain(created.recoveryCode)
        const parsed = parseChurchKeyFile(json)
        expect(isChurchKeyFile(parsed)).toBe(true)
        expect(parsed).toEqual(created.file)
        expect(s.to_hex(await unlockWithPassphrase(parsed, PASSPHRASE))).toBe(s.to_hex(created.key))
    })

    it("parseChurchKeyFile rejects bad input with the plain message", () => {
        expect(() => parseChurchKeyFile("{}")).toThrow("This is not a church key file.")
        expect(() => parseChurchKeyFile("not json")).toThrow("This is not a church key file.")
        const almost = { ejs: 1, type: "church-key", kid: "k", churchName: "c", created: "d", slots: [{}] }
        expect(() => parseChurchKeyFile(JSON.stringify(almost))).toThrow("This is not a church key file.")
    })

    it("isChurchKeyFile recognizes the shape and rejects each malformed one", () => {
        const good = { ejs: 1, type: "church-key", kid: "k", churchName: "c", created: "d", slots: [] }
        expect(isChurchKeyFile(good)).toBe(true)
        expect(isChurchKeyFile(null)).toBe(false)
        expect(isChurchKeyFile("nope")).toBe(false)
        expect(isChurchKeyFile({ ...good, ejs: 2 })).toBe(false)
        expect(isChurchKeyFile({ ...good, type: "personal-key" })).toBe(false)
        expect(isChurchKeyFile({ ...good, kid: 42 })).toBe(false)
        expect(isChurchKeyFile({ ...good, churchName: 42 })).toBe(false)
        expect(isChurchKeyFile({ ...good, created: 42 })).toBe(false)
        expect(isChurchKeyFile({ ...good, slots: {} })).toBe(false)
        expect(isChurchKeyFile({ ...good, slots: [{}] })).toBe(false)
    })
})
