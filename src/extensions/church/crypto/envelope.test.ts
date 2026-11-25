import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { EnvelopeError, type Envelope, envelopeToString, keyId, newKey, open, openText, parseEnvelope, seal, sealText } from "./envelope"
import { getSodium } from "./sodium"

interface Vectors {
    keyHex: string
    kid: string
    envelope: {
        aad: string
        plaintext: string
        value: Envelope
    }
}

const vectors = JSON.parse(readFileSync(new URL("./test-vectors.json", import.meta.url), "utf8")) as Vectors
const PLAINTEXT = "Little lantern on the hill"

async function vectorKey(): Promise<Uint8Array> {
    const s = await getSodium()
    return s.from_hex(vectors.keyHex)
}

/** Await a failing open and return the error message, asserting it is an EnvelopeError that leaks nothing. */
async function expectUnlockError(p: Promise<unknown>): Promise<string> {
    let caught: unknown
    try {
        await p
    } catch (e) {
        caught = e
    }
    expect(caught).toBeInstanceOf(EnvelopeError)
    const message = (caught as Error).message
    expect(message).not.toContain(vectors.envelope.plaintext)
    expect(message).not.toContain(PLAINTEXT)
    expect(message).not.toContain(vectors.keyHex)
    return message
}

describe("keyId", () => {
    it("matches the fixed vector", async () => {
        expect(await keyId(await vectorKey())).toBe(vectors.kid)
    })
})

describe("open (known answer)", () => {
    it("opens the fixed vector envelope to the exact plaintext", async () => {
        const key = await vectorKey()
        expect(await openText(key, vectors.envelope.value, "ejs:test:vector")).toBe(vectors.envelope.plaintext)
    })
})

describe("seal / open round trip", () => {
    it("round trips text", async () => {
        const key = await newKey()
        const env = await sealText(key, PLAINTEXT, "ejs:test:roundtrip")
        expect(env.kid).toBe(await keyId(key))
        expect(env.ctx).toBe("ejs:test:roundtrip")
        expect(await openText(key, env, "ejs:test:roundtrip")).toBe(PLAINTEXT)
    })

    it("round trips bytes", async () => {
        const key = await newKey()
        const bytes = new Uint8Array([0, 1, 2, 127, 128, 250, 251, 252, 255])
        const env = await seal(key, bytes, "ejs:test:bytes")
        expect(await open(key, env, "ejs:test:bytes")).toEqual(bytes)
    })

    it("uses a fresh nonce per seal", async () => {
        const key = await newKey()
        const a = await sealText(key, PLAINTEXT, "ejs:test:nonce")
        const b = await sealText(key, PLAINTEXT, "ejs:test:nonce")
        expect(a.n).not.toBe(b.n)
        expect(a.ct).not.toBe(b.ct)
    })

    it("does not put the plaintext in the sealed string", async () => {
        const key = await newKey()
        const env = await sealText(key, PLAINTEXT, "ejs:test:leak")
        expect(envelopeToString(env)).not.toContain(PLAINTEXT)
    })
})

describe("open failures", () => {
    const ctx = "ejs:test:vector"

    it("rejects a different key", async () => {
        const other = await newKey()
        const message = await expectUnlockError(open(other, vectors.envelope.value, ctx))
        expect(message).toBe("Could not unlock this data. The key may be wrong or the data was changed.")
    })

    it("rejects a flipped character in ct", async () => {
        const ct = vectors.envelope.value.ct
        const i = Math.floor(ct.length / 2)
        const flipped = { ...vectors.envelope.value, ct: ct.slice(0, i) + (ct[i] === "A" ? "B" : "A") + ct.slice(i + 1) }
        await expectUnlockError(open(await vectorKey(), flipped, ctx))
    })

    it("rejects a changed ctx in the envelope", async () => {
        const tampered = { ...vectors.envelope.value, ctx: "ejs:test:other" }
        await expectUnlockError(open(await vectorKey(), tampered, ctx))
    })

    it("rejects a wrong expectedCtx", async () => {
        await expectUnlockError(open(await vectorKey(), vectors.envelope.value, "ejs:test:other"))
    })

    it("rejects a changed kid", async () => {
        const tampered = { ...vectors.envelope.value, kid: "0000000000000000" }
        await expectUnlockError(open(await vectorKey(), tampered, ctx))
    })

    it("rejects an unknown version", async () => {
        const tampered = { ...vectors.envelope.value, ejs: 2 } as Envelope
        await expectUnlockError(open(await vectorKey(), tampered, ctx))
    })

    it("rejects an unknown algorithm", async () => {
        const tampered = { ...vectors.envelope.value, alg: "aes" } as Envelope
        await expectUnlockError(open(await vectorKey(), tampered, ctx))
    })

    it("rejects garbage base64", async () => {
        const tampered = { ...vectors.envelope.value, ct: "!!not base64!!" }
        await expectUnlockError(open(await vectorKey(), tampered, ctx))
    })
})

describe("seal validation", () => {
    it("throws for a 31-byte key", async () => {
        await expect(seal(new Uint8Array(31), new Uint8Array(0), "ejs:test:bad")).rejects.toBeInstanceOf(EnvelopeError)
    })

    it("throws for an empty ctx", async () => {
        const key = await newKey()
        await expect(seal(key, new Uint8Array(0), "")).rejects.toBeInstanceOf(EnvelopeError)
    })
})

describe("envelope serialization", () => {
    it("round trips through parseEnvelope", async () => {
        const key = await newKey()
        const env = await sealText(key, PLAINTEXT, "ejs:test:parse")
        expect(parseEnvelope(envelopeToString(env))).toEqual(env)
    })

    it("throws EnvelopeError for an empty object", () => {
        expect(() => parseEnvelope("{}")).toThrow(EnvelopeError)
    })

    it("throws EnvelopeError for non-JSON input", () => {
        expect(() => parseEnvelope("not json")).toThrow(EnvelopeError)
    })
})
