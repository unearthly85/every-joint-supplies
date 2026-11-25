import { getSodium } from "./sodium"
import { type Envelope, EnvelopeError, isEnvelope, open, seal } from "./envelope"

/** Argon2id cost parameters for a key slot. */
export interface KdfParams {
    ops: number
    mem: number
}

/** Default Argon2id cost: libsodium OPSLIMIT_MODERATE / MEMLIMIT_MODERATE, about 1 s. */
export const DEFAULT_KDF: KdfParams = { ops: 3, mem: 268435456 }

/** Weakest Argon2id cost ever accepted: libsodium OPSLIMIT_INTERACTIVE / MEMLIMIT_INTERACTIVE. */
export const MIN_KDF: KdfParams = { ops: 2, mem: 67108864 }

/** What the secret in a slot is. */
export type SlotKind = "passphrase" | "recovery"

/**
 * A key slot: a 32-byte key encrypted under a key derived from a secret
 * (a passphrase or a recovery code). salt is base64 ORIGINAL, 16 bytes.
 * The same format is reused for the per-person PIN backup in Phase 1, so
 * nothing here is "org key" specific.
 */
export interface KeySlot {
    ejs: 1
    kind: SlotKind
    kdf: "argon2id13"
    ops: number
    mem: number
    salt: string
    env: Envelope
}

/**
 * Raised when a secret does not unlock a slot. The message is fixed and
 * never contains the secret.
 */
export class WrongSecretError extends Error {
    constructor() {
        super("That passphrase or recovery code did not work.")
        this.name = "WrongSecretError"
    }
}

const SALT_BYTES = 16

/** Zero a buffer in place. Used for derived keys; not crypto. */
function memzero(buf: Uint8Array): void {
    for (let i = 0; i < buf.length; i++) buf[i] = 0
}

/**
 * Derive a 32-byte key from a secret with Argon2id; the secret is NFKC
 * normalized first. Throws a plain Error if the params are below MIN_KDF or
 * the secret is empty after trim.
 */
export async function deriveKek(secret: string, salt: Uint8Array, p: KdfParams): Promise<Uint8Array> {
    if (p.ops < MIN_KDF.ops || p.mem < MIN_KDF.mem) throw new Error("KDF params are below the minimum")
    if (secret.trim().length === 0) throw new Error("The secret is empty")
    const s = await getSodium()
    return s.crypto_pwhash(32, secret.normalize("NFKC"), salt, p.ops, p.mem, s.crypto_pwhash_ALG_ARGON2ID13)
}

/**
 * Wrap a 32-byte key under a secret into a key slot: a fresh random 16-byte
 * salt, the key sealed under the derived key with the purpose label
 * "ejs:keyslot:<kind>".
 */
export async function wrapKey(key: Uint8Array, secret: string, kind: SlotKind, p: KdfParams = DEFAULT_KDF): Promise<KeySlot> {
    const s = await getSodium()
    const salt = s.randombytes_buf(SALT_BYTES)
    const kek = await deriveKek(secret, salt, p)
    try {
        const env = await seal(kek, key, "ejs:keyslot:" + kind)
        return { ejs: 1, kind, kdf: "argon2id13", ops: p.ops, mem: p.mem, salt: s.to_base64(salt, s.base64_variants.ORIGINAL), env }
    } finally {
        memzero(kek)
    }
}

/**
 * Unwrap the key from a slot with the secret. The slot shape is validated
 * (ejs 1, kdf "argon2id13", kind, params at least MIN_KDF, else a plain
 * Error); a failed open becomes WrongSecretError.
 */
export async function unwrapKey(slot: KeySlot, secret: string): Promise<Uint8Array> {
    if (!isKeySlot(slot)) throw new Error("Not a key slot")
    if (slot.ops < MIN_KDF.ops || slot.mem < MIN_KDF.mem) throw new Error("KDF params are below the minimum")
    const s = await getSodium()
    const salt = s.from_base64(slot.salt, s.base64_variants.ORIGINAL)
    const kek = await deriveKek(secret, salt, { ops: slot.ops, mem: slot.mem })
    try {
        try {
            return await open(kek, slot.env, "ejs:keyslot:" + slot.kind)
        } catch (err) {
            if (err instanceof EnvelopeError) throw new WrongSecretError()
            throw err
        }
    } finally {
        memzero(kek)
    }
}

/** Shape check only: does this value look like a KeySlot? */
export function isKeySlot(x: unknown): x is KeySlot {
    if (typeof x !== "object" || x === null) return false
    const k = x as Record<string, unknown>
    return k.ejs === 1 && (k.kind === "passphrase" || k.kind === "recovery") && k.kdf === "argon2id13" && typeof k.ops === "number" && typeof k.mem === "number" && typeof k.salt === "string" && isEnvelope(k.env)
}
