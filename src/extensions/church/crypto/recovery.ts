import { getSodium } from "./sodium"

/** Crockford base32 alphabet (no I, L, O, U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

const CODE_BYTES = 15
const CODE_CHARS = 24
const GROUP_CHARS = 4

/**
 * A fresh recovery code: 15 random bytes (120 bits) as 24 Crockford base32
 * characters in 6 groups of 4 joined by "-", e.g. "7K3M-QX9D-...".
 */
export async function newRecoveryCode(): Promise<string> {
    const s = await getSodium()
    return regroup(encode32(s.randombytes_buf(CODE_BYTES)))
}

/** Encode bytes as Crockford base32 by plain bit shifting (formatting, not crypto). */
function encode32(bytes: Uint8Array): string {
    let out = ""
    let buffer = 0
    let bits = 0
    for (const byte of bytes) {
        buffer = (buffer << 8) | byte
        bits += 8
        while (bits >= 5) {
            bits -= 5
            out += ALPHABET[(buffer >>> bits) & 31]
        }
    }
    if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31]
    return out
}

/** Group the 24 characters as "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX". */
function regroup(code: string): string {
    const parts: string[] = []
    for (let i = 0; i < CODE_CHARS; i += GROUP_CHARS) parts.push(code.slice(i, i + GROUP_CHARS))
    return parts.join("-")
}

/**
 * Normalize a typed recovery code: uppercase, drop spaces and dashes, map O
 * to 0 and I/L to 1. Returns the 24 characters regrouped as
 * "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX", or null if the length or characters are
 * wrong. wrapKey/unwrapKey for kind "recovery" are always called with the
 * normalized code (callers do that).
 */
export function normalizeRecoveryCode(input: string): string | null {
    let out = ""
    for (let ch of input.toUpperCase()) {
        if (ch === " " || ch === "-") continue
        if (ch === "O") ch = "0"
        else if (ch === "I" || ch === "L") ch = "1"
        if (ALPHABET.indexOf(ch) === -1) return null
        out += ch
    }
    if (out.length !== CODE_CHARS) return null
    return regroup(out)
}
