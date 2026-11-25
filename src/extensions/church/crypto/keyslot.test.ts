import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { newKey } from "./envelope"
import { DEFAULT_KDF, isKeySlot, type KeySlot, MIN_KDF, unwrapKey, WrongSecretError, wrapKey } from "./keyslot"
import { getSodium } from "./sodium"

interface Vectors {
    keyslot: {
        passphrase: string
        unwrapsToKeyHex: string
        value: KeySlot
    }
}

const vectors = JSON.parse(readFileSync(new URL("./test-vectors.json", import.meta.url), "utf8")) as Vectors
const PASSPHRASE = "made-up pass phrase"

/** Await a failing call and assert it threw a plain Error that is not a WrongSecretError. */
async function expectValidationError(p: Promise<unknown>): Promise<void> {
    let caught: unknown
    try {
        await p
    } catch (e) {
        caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(WrongSecretError)
}

/** Await a failing unwrap and assert it threw a WrongSecretError with the fixed message. */
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

describe("keyslot", () => {
    it("unwrapKey (known answer) opens the fixed vector slot to the exact key", async () => {
        const s = await getSodium()
        const key = await unwrapKey(vectors.keyslot.value, vectors.keyslot.passphrase)
        expect(s.to_hex(key)).toBe(vectors.keyslot.unwrapsToKeyHex)
    })

    it("a wrong passphrase gives WrongSecretError and the message contains no secret", async () => {
        const wrong = "totally different words"
        await expectWrongSecret(unwrapKey(vectors.keyslot.value, wrong), [wrong, vectors.keyslot.passphrase])
    })

    it("wrap / unwrap round trip with MIN_KDF", async () => {
        const s = await getSodium()
        const key = await newKey()
        const slot = await wrapKey(key, PASSPHRASE, "passphrase", MIN_KDF)
        const back = await unwrapKey(slot, PASSPHRASE)
        expect(s.to_hex(back)).toBe(s.to_hex(key))
    })

    it("wrap / unwrap round trip with DEFAULT_KDF", async () => {
        const s = await getSodium()
        const key = await newKey()
        const slot = await wrapKey(key, PASSPHRASE, "passphrase")
        expect(slot.ops).toBe(DEFAULT_KDF.ops)
        expect(slot.mem).toBe(DEFAULT_KDF.mem)
        const back = await unwrapKey(slot, PASSPHRASE)
        expect(s.to_hex(back)).toBe(s.to_hex(key))
    })

    it("two wraps of the same key have different salt and ct", async () => {
        const s = await getSodium()
        const key = await newKey()
        const a = await wrapKey(key, PASSPHRASE, "passphrase", MIN_KDF)
        const b = await wrapKey(key, PASSPHRASE, "passphrase", MIN_KDF)
        expect(a.salt).not.toBe(b.salt)
        expect(a.env.ct).not.toBe(b.env.ct)
        expect(s.to_hex(await unwrapKey(a, PASSPHRASE))).toBe(s.to_hex(key))
        expect(s.to_hex(await unwrapKey(b, PASSPHRASE))).toBe(s.to_hex(key))
    })

    it("wrap rejects params below MIN_KDF", async () => {
        const key = await newKey()
        await expectValidationError(wrapKey(key, PASSPHRASE, "passphrase", { ops: 1, mem: MIN_KDF.mem }))
        await expectValidationError(wrapKey(key, PASSPHRASE, "passphrase", { ops: MIN_KDF.ops, mem: MIN_KDF.mem - 1 }))
    })

    it("unwrap rejects a slot with params below MIN_KDF (vector slot edited to ops 1)", async () => {
        await expectValidationError(unwrapKey({ ...vectors.keyslot.value, ops: 1 }, vectors.keyslot.passphrase))
        await expectValidationError(unwrapKey({ ...vectors.keyslot.value, mem: MIN_KDF.mem - 1 }, vectors.keyslot.passphrase))
    })

    it("rejects an empty secret on wrap and on unwrap", async () => {
        const key = await newKey()
        await expectValidationError(wrapKey(key, "   ", "passphrase", MIN_KDF))
        await expectValidationError(unwrapKey(vectors.keyslot.value, "   "))
    })

    it("unwrap rejects a slot whose kdf is not argon2id13", async () => {
        const slot = { ...vectors.keyslot.value, kdf: "scrypt" } as unknown as KeySlot
        await expectValidationError(unwrapKey(slot, vectors.keyslot.passphrase))
    })

    it("a tampered salt gives WrongSecretError", async () => {
        const salt = vectors.keyslot.value.salt
        const tampered = (salt[0] === "E" ? "F" : "E") + salt.slice(1)
        await expectWrongSecret(unwrapKey({ ...vectors.keyslot.value, salt: tampered }, vectors.keyslot.passphrase), [vectors.keyslot.passphrase])
    })

    it("a composed passphrase unlocks a slot made with the decomposed form (NFKC)", async () => {
        const s = await getSodium()
        const key = await newKey()
        const slot = await wrapKey(key, "cafe\u0301", "passphrase", MIN_KDF)
        const back = await unwrapKey(slot, "caf\u00e9")
        expect(s.to_hex(back)).toBe(s.to_hex(key))
    })

    it("JSON.stringify(slot) does not contain the key hex or the passphrase", async () => {
        const s = await getSodium()
        const key = await newKey()
        const slot = await wrapKey(key, PASSPHRASE, "passphrase", MIN_KDF)
        const json = JSON.stringify(slot)
        expect(json).not.toContain(s.to_hex(key))
        expect(json).not.toContain(PASSPHRASE)
    })

    it("isKeySlot recognizes the vector slot and rejects other shapes", () => {
        expect(isKeySlot(vectors.keyslot.value)).toBe(true)
        expect(isKeySlot(null)).toBe(false)
        expect(isKeySlot("nope")).toBe(false)
        expect(isKeySlot({})).toBe(false)
        expect(isKeySlot({ ...vectors.keyslot.value, kind: "pin" })).toBe(false)
    })
})
