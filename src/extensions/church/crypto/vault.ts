import { envelopeToString, openText, parseEnvelope, sealText } from "./envelope"
import { getSodium } from "./sodium"

/** The kind of service record stored in a host folder: a show (song/deck), a project (service plan), or our Sunday order. */
export type RecordKind = "show" | "project" | "order"

/**
 * A host folder: where the church's service records live. The node or any
 * host folder holds only ciphertext; P0-11 sync moves these files around.
 */
export interface HostFolder {
    list(): Promise<string[]>
    read(name: string): Promise<string | null>
    write(name: string, data: string): Promise<void>
    remove(name: string): Promise<void>
}

/**
 * An in-memory host folder, for tests and for the P0-11 loopback tests.
 * `files` is the backing map, exposed so tests can inspect the raw contents.
 */
export function memoryFolder(): HostFolder & { files: Map<string, string> } {
    const files = new Map<string, string>()
    /* eslint-disable @typescript-eslint/require-await -- the HostFolder contract is async; there is nothing to await in memory */
    return {
        files,
        async list() {
            return [...files.keys()]
        },
        async read(name) {
            return files.has(name) ? (files.get(name) as string) : null
        },
        async write(name, data) {
            files.set(name, data)
        },
        async remove(name) {
            files.delete(name)
        }
    }
    /* eslint-enable @typescript-eslint/require-await */
}

/**
 * A keyed BLAKE2b-128 tag for a record (32 hex chars). Because the hash is
 * keyed, neither titles nor ids ever appear in plain text.
 */
export async function recordTag(key: Uint8Array, kind: RecordKind, id: string): Promise<string> {
    const s = await getSodium()
    return s.to_hex(s.crypto_generichash(16, s.from_string(kind + ":" + id), key))
}

/**
 * The file name for a record: kind, a dash, the record tag, and ".ejs".
 * Stable for the same key/kind/id; different for a different key or kind.
 */
export async function recordFileName(key: Uint8Array, kind: RecordKind, id: string): Promise<string> {
    return kind + "-" + (await recordTag(key, kind, id)) + ".ejs"
}

/** The envelope context that binds a record to its kind and tag. */
function recordCtx(kind: RecordKind, tag: string): string {
    return "ejs:svc:" + kind + ":" + tag
}

/**
 * Seal a record's JSON under a key. The context binds the record to its kind
 * and id tag, so a file copied over another record fails to open. The raw id
 * never goes into the context (the context is stored in plain in the envelope
 * header); only its keyed tag does.
 */
export async function sealRecord(key: Uint8Array, kind: RecordKind, id: string, data: unknown): Promise<string> {
    const tag = await recordTag(key, kind, id)
    const env = await sealText(key, JSON.stringify(data), recordCtx(kind, tag))
    return envelopeToString(env)
}

/**
 * Open a sealed record with the key, kind, and id it was sealed with.
 * Throws EnvelopeError if any of them do not match or the data was changed.
 */
export async function openRecord<T>(key: Uint8Array, kind: RecordKind, id: string, text: string): Promise<T> {
    const tag = await recordTag(key, kind, id)
    const env = parseEnvelope(text)
    const plain = await openText(key, env, recordCtx(kind, tag))
    return JSON.parse(plain) as T
}

/** Seal a record and write it to the folder. Returns the file name. */
export async function putRecord(folder: HostFolder, key: Uint8Array, kind: RecordKind, id: string, data: unknown): Promise<string> {
    const name = await recordFileName(key, kind, id)
    await folder.write(name, await sealRecord(key, kind, id, data))
    return name
}

/** Read a record back from the folder. Null when the file is missing; EnvelopeError when it is present but cannot be opened. */
export async function getRecord<T>(folder: HostFolder, key: Uint8Array, kind: RecordKind, id: string): Promise<T | null> {
    const name = await recordFileName(key, kind, id)
    const text = await folder.read(name)
    if (text === null) return null
    return openRecord<T>(key, kind, id, text)
}
