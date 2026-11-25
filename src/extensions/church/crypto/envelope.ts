import { getSodium, type Sodium } from "./sodium"

/** Current envelope format version. */
export const ENVELOPE_VERSION = 1 as const
/** AEAD algorithm used by the envelope. */
export const ENVELOPE_ALG = "xchacha20poly1305-ietf" as const

const KEY_BYTES = 32
const NONCE_BYTES = 24

/**
 * A versioned, authenticated ciphertext envelope.
 * kid = key id (16 hex chars), ctx = purpose label, n = nonce base64,
 * ct = ciphertext+tag base64. Base64 is sodium.base64_variants.ORIGINAL everywhere.
 */
export interface Envelope {
    ejs: 1
    alg: "xchacha20poly1305-ietf"
    kid: string
    ctx: string
    n: string
    ct: string
}

/**
 * Raised for any failed unlock or malformed envelope. The message is plain
 * and never contains key, plaintext, or ciphertext bytes.
 */
export class EnvelopeError extends Error {
    constructor() {
        super("Could not unlock this data. The key may be wrong or the data was changed.")
        this.name = "EnvelopeError"
    }
}

/**
 * Derive the 16-hex-char key id for a key (BLAKE2b of a fixed domain string).
 */
export async function keyId(key: Uint8Array): Promise<string> {
    const s = await getSodium()
    return s.to_hex(s.crypto_generichash(8, s.from_string("ejs-kid-v1"), key))
}

/** Generate a fresh 32-byte random key. */
export async function newKey(): Promise<Uint8Array> {
    const s = await getSodium()
    return s.crypto_aead_xchacha20poly1305_ietf_keygen()
}

/** Build the AAD that binds the envelope header (version, alg, kid, ctx). */
function aad(s: Sodium, kid: string, ctx: string): Uint8Array {
    return s.from_string(`ejs:${ENVELOPE_VERSION}|${ENVELOPE_ALG}|${kid}|${ctx}`)
}

/**
 * Seal plaintext under a key for a purpose label. Uses a fresh random nonce
 * on every call. The key must be 32 bytes and ctx must be non-empty.
 */
export async function seal(key: Uint8Array, plaintext: Uint8Array, ctx: string): Promise<Envelope> {
    const s = await getSodium()
    if (key.length !== KEY_BYTES) throw new EnvelopeError()
    if (ctx.length === 0) throw new EnvelopeError()
    const kid = await keyId(key)
    const nonce = s.randombytes_buf(NONCE_BYTES)
    const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad(s, kid, ctx), null, nonce, key)
    return {
        ejs: ENVELOPE_VERSION,
        alg: ENVELOPE_ALG,
        kid,
        ctx,
        n: s.to_base64(nonce, s.base64_variants.ORIGINAL),
        ct: s.to_base64(ct, s.base64_variants.ORIGINAL)
    }
}

/**
 * Open an envelope sealed for expectedCtx with this key. Throws EnvelopeError
 * if the version or algorithm is unknown, the context or key id does not match,
 * or the AEAD check fails.
 */
export async function open(key: Uint8Array, env: Envelope, expectedCtx: string): Promise<Uint8Array> {
    const s = await getSodium()
    try {
        if (env.ejs !== ENVELOPE_VERSION) throw new EnvelopeError()
        if (env.alg !== ENVELOPE_ALG) throw new EnvelopeError()
        if (env.ctx !== expectedCtx) throw new EnvelopeError()
        if (env.kid !== (await keyId(key))) throw new EnvelopeError()
        const nonce = s.from_base64(env.n, s.base64_variants.ORIGINAL)
        const ct = s.from_base64(env.ct, s.base64_variants.ORIGINAL)
        return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, aad(s, env.kid, env.ctx), nonce, key)
    } catch (err) {
        if (err instanceof EnvelopeError) throw err
        throw new EnvelopeError()
    }
}

/** Seal a UTF-8 text under a key for a purpose label. */
export async function sealText(key: Uint8Array, text: string, ctx: string): Promise<Envelope> {
    const s = await getSodium()
    return seal(key, s.from_string(text), ctx)
}

/** Open an envelope and return the sealed UTF-8 text. */
export async function openText(key: Uint8Array, env: Envelope, expectedCtx: string): Promise<string> {
    const s = await getSodium()
    return s.to_string(await open(key, env, expectedCtx))
}

/** Shape check only: does this value look like an Envelope? */
export function isEnvelope(x: unknown): x is Envelope {
    if (typeof x !== "object" || x === null) return false
    const e = x as Record<string, unknown>
    return e.ejs === 1 && e.alg === ENVELOPE_ALG && typeof e.kid === "string" && typeof e.ctx === "string" && typeof e.n === "string" && typeof e.ct === "string"
}

/** Serialize an envelope to a JSON string. */
export function envelopeToString(env: Envelope): string {
    return JSON.stringify(env)
}

/** Parse and shape-check a JSON envelope string; throws EnvelopeError otherwise. */
export function parseEnvelope(s: string): Envelope {
    let parsed: unknown
    try {
        parsed = JSON.parse(s)
    } catch {
        throw new EnvelopeError()
    }
    if (!isEnvelope(parsed)) throw new EnvelopeError()
    return parsed
}
