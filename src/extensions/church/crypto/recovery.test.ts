import { describe, expect, it } from "vitest"
import { newKey } from "./envelope"
import { MIN_KDF, unwrapKey, wrapKey } from "./keyslot"
import { newRecoveryCode, normalizeRecoveryCode } from "./recovery"
import { getSodium } from "./sodium"

const CODE_SHAPE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/

describe("recovery", () => {
    it("newRecoveryCode gives 6 groups of 4 Crockford characters, and two codes differ", async () => {
        const a = await newRecoveryCode()
        const b = await newRecoveryCode()
        expect(a).toMatch(CODE_SHAPE)
        expect(b).toMatch(CODE_SHAPE)
        expect(a).not.toBe(b)
    })

    it("normalizeRecoveryCode accepts lowercase, spaces, O for 0, and l for 1", () => {
        expect(normalizeRecoveryCode("7k3m oqx9 dlvw xyz2 345a bchj")).toBe("7K3M-0QX9-D1VW-XYZ2-345A-BCHJ")
        expect(normalizeRecoveryCode("7K3M-0QX9-D1VW-XYZ2-345A-BCHJ")).toBe("7K3M-0QX9-D1VW-XYZ2-345A-BCHJ")
    })

    it("normalizeRecoveryCode returns null for 23 chars, 25 chars, and a U", () => {
        expect(normalizeRecoveryCode("7K3M0QX9D1VWXYZ2345ABCH")).toBeNull()
        expect(normalizeRecoveryCode("7K3M0QX9D1VWXYZ2345ABCHJK")).toBeNull()
        expect(normalizeRecoveryCode("7K3M0QX9D1VWXYZ2345ABCHU")).toBeNull()
    })

    it("a key wrapped with a recovery code unlocks with the code typed lowercase with spaces", async () => {
        const s = await getSodium()
        const code = await newRecoveryCode()
        const key = await newKey()
        const slot = await wrapKey(key, code, "recovery", MIN_KDF)
        const typed = code.toLowerCase().split("-").join(" ")
        expect(normalizeRecoveryCode(typed)).toBe(code)
        const back = await unwrapKey(slot, normalizeRecoveryCode(typed) as string)
        expect(s.to_hex(back)).toBe(s.to_hex(key))
    })
})
