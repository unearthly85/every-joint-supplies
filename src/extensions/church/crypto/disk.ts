import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { type ChurchKeyFile, churchKeyFileToString, parseChurchKeyFile } from "./orgKey"
import { type HostFolder } from "./vault"

/** True when a node:fs error means the path does not exist. */
function isMissing(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ENOENT"
}

/**
 * A host folder backed by a real directory (node:fs/promises): the e4 vault
 * records live here as ".ejs" files. `list` returns only ".ejs" names (a
 * missing dir is an empty folder), `read` is null for a missing file, and
 * `remove` ignores a missing file. `write` creates the dir recursively and
 * writes atomically: a "<name>.part" file is written, then renamed over the
 * target, so a crash never leaves a half-written record. Names containing
 * "/", "\" or ".." are rejected with a plain Error.
 */
export function diskFolder(dir: string): HostFolder {
    /** A record name is a plain file name: no path separators, no "..". */
    function checkName(name: string): void {
        if (name.includes("/") || name.includes("\\") || name.includes("..")) throw new Error("Invalid file name")
    }
    return {
        async list() {
            let entries: string[]
            try {
                entries = await readdir(dir)
            } catch (err) {
                if (isMissing(err)) return []
                throw err
            }
            return entries.filter((n) => n.endsWith(".ejs"))
        },
        async read(name) {
            checkName(name)
            try {
                return await readFile(join(dir, name), "utf8")
            } catch (err) {
                if (isMissing(err)) return null
                throw err
            }
        },
        async write(name, data) {
            checkName(name)
            await mkdir(dir, { recursive: true })
            const part = join(dir, name + ".part")
            await writeFile(part, data, "utf8")
            await rename(part, join(dir, name))
        },
        async remove(name) {
            checkName(name)
            try {
                await rm(join(dir, name))
            } catch (err) {
                if (isMissing(err)) return
                throw err
            }
        }
    }
}

/** The file name of the church key file inside a host folder. */
export const CHURCH_KEY_FILE = "church-key.json"

/**
 * Save a church key file into a directory, atomically (write
 * "church-key.json.part", then rename) with file mode 0o600. The file holds
 * only the encrypted key slots — never the key, passphrase, or recovery code.
 */
export async function saveChurchKeyFile(dir: string, file: ChurchKeyFile): Promise<void> {
    await mkdir(dir, { recursive: true })
    const part = join(dir, CHURCH_KEY_FILE + ".part")
    await writeFile(part, churchKeyFileToString(file), { encoding: "utf8", mode: 0o600 })
    await rename(part, join(dir, CHURCH_KEY_FILE))
}

/**
 * Load the church key file from a directory: null when the dir or file is
 * missing, `parseChurchKeyFile` (shape check, a plain Error otherwise) when
 * it is present.
 */
export async function loadChurchKeyFile(dir: string): Promise<ChurchKeyFile | null> {
    try {
        return parseChurchKeyFile(await readFile(join(dir, CHURCH_KEY_FILE), "utf8"))
    } catch (err) {
        if (isMissing(err)) return null
        throw err
    }
}
