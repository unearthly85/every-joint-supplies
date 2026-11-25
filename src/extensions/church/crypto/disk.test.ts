import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CHURCH_KEY_FILE, diskFolder, loadChurchKeyFile, saveChurchKeyFile } from "./disk"
import { newKey } from "./envelope"
import { MIN_KDF } from "./keyslot"
import { changePassphrase, createChurchKey, unlockWithPassphrase } from "./orgKey"
import { getRecord, putRecord } from "./vault"

// A real folder inside the repo (node_modules is gitignored); never os.tmpdir().
const root = join(process.cwd(), "node_modules", ".ejs-test", "disk-" + process.pid)

beforeEach(() => {
    mkdirSync(root, { recursive: true })
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
})

describe("diskFolder", () => {
    it("round trips write, read, list, remove", async () => {
        const folder = diskFolder(join(root, "records"))
        await folder.write("show-deadbeef.ejs", "sealed text")
        expect(await folder.read("show-deadbeef.ejs")).toBe("sealed text")
        expect(await folder.list()).toEqual(["show-deadbeef.ejs"])
        await folder.remove("show-deadbeef.ejs")
        expect(await folder.list()).toEqual([])
        expect(await folder.read("show-deadbeef.ejs")).toBeNull()
    })

    it("lists only .ejs names, ignoring other files", async () => {
        const dir = join(root, "mixed")
        const folder = diskFolder(dir)
        await folder.write("a-1.ejs", "one")
        await folder.write("b-2.ejs", "two")
        writeFileSync(join(dir, "notes.txt"), "not a record")
        writeFileSync(join(dir, CHURCH_KEY_FILE), "{}")
        expect((await folder.list()).sort()).toEqual(["a-1.ejs", "b-2.ejs"])
    })

    it("reads null for a missing file and lists [] for a missing dir", async () => {
        const folder = diskFolder(join(root, "no-such-dir"))
        expect(await folder.list()).toEqual([])
        expect(await folder.read("show-1.ejs")).toBeNull()
    })

    it("removes a missing file without error", async () => {
        const folder = diskFolder(join(root, "records"))
        await expect(folder.remove("never-was.ejs")).resolves.toBeUndefined()
    })

    it("rejects names containing /, \\, or ..", async () => {
        const folder = diskFolder(join(root, "records"))
        for (const bad of ["../x.ejs", "a/b.ejs", "a\\b.ejs", "a..b.ejs"]) {
            await expect(folder.write(bad, "x")).rejects.toThrow()
            await expect(folder.read(bad)).rejects.toThrow()
            await expect(folder.remove(bad)).rejects.toThrow()
        }
    })

    it("propagates fs errors that are not 'missing'", async () => {
        const dir = join(root, "errors")
        const folder = diskFolder(dir)
        await folder.write("a-1.ejs", "one")
        // a plain file where a directory is expected: list fails, it is not an empty folder
        const plain = join(root, "plain-file")
        writeFileSync(plain, "x")
        await expect(diskFolder(plain).list()).rejects.toThrow()
        // a directory where a record file is expected: read and remove fail, not null/ignored
        mkdirSync(join(dir, "adir.ejs"))
        await expect(folder.read("adir.ejs")).rejects.toThrow()
        await expect(folder.remove("adir.ejs")).rejects.toThrow()
    })

    it("leaves no .part file behind", async () => {
        const dir = join(root, "records")
        const folder = diskFolder(dir)
        await folder.write("show-1.ejs", "one")
        await folder.write("show-1.ejs", "two")
        expect(readdirSync(dir)).toEqual(["show-1.ejs"])
        for (const name of readdirSync(dir)) {
            expect(name.endsWith(".part")).toBe(false)
        }
    })
})

describe("vault records on a disk folder", () => {
    it("putRecord and getRecord round trip, and the files hold only ciphertext", async () => {
        const key = await newKey()
        const dir = join(root, "vault")
        const folder = diskFolder(dir)
        const record = { name: "Lantern Hymn", slides: { v1: { group: "Verse", text: "Little lantern on the hill, shine on" } } }
        const name = await putRecord(folder, key, "show", "lantern-hymn", record)
        expect(name.endsWith(".ejs")).toBe(true)
        expect(await getRecord(folder, key, "show", "lantern-hymn")).toEqual(record)
        expect(await getRecord(folder, key, "show", "never-saved")).toBeNull()
        for (const file of readdirSync(dir)) {
            const text = readFileSync(join(dir, file), "utf8")
            expect(text).not.toContain("Lantern Hymn")
            expect(text).not.toContain("Little lantern on the hill")
        }
    })
})

describe("church key file on disk", () => {
    it("saves and loads the key file; the text holds no key, passphrase, or recovery code", async () => {
        const dir = join(root, "org")
        const { key, recoveryCode, file } = await createChurchKey("Lantern Hill Chapel", "made-up pass phrase", new Date(0), MIN_KDF)
        await saveChurchKeyFile(dir, file)
        const text = readFileSync(join(dir, CHURCH_KEY_FILE), "utf8")
        expect(text).not.toContain("made-up pass phrase")
        expect(text).not.toContain(recoveryCode)
        expect(text).not.toContain(Buffer.from(key).toString("hex"))
        const loaded = await loadChurchKeyFile(dir)
        expect(loaded).toEqual(file)
        if (loaded === null) throw new Error("test: the key file did not load")
        expect(await unlockWithPassphrase(loaded, "made-up pass phrase")).toEqual(key)
    })

    it("re-saves a changed file over the old one and the new passphrase works", async () => {
        const dir = join(root, "org2")
        const { key, file } = await createChurchKey("Lantern Hill Chapel", "made-up pass phrase", new Date(0), MIN_KDF)
        await saveChurchKeyFile(dir, file)
        const changed = await changePassphrase(file, key, "another made-up pass", MIN_KDF)
        await saveChurchKeyFile(dir, changed)
        const loaded = await loadChurchKeyFile(dir)
        expect(loaded).toEqual(changed)
        if (loaded === null) throw new Error("test: the key file did not load")
        expect(await unlockWithPassphrase(loaded, "another made-up pass")).toEqual(key)
        await expect(unlockWithPassphrase(loaded, "made-up pass phrase")).rejects.toThrow()
    })

    it("is null for an empty dir and throws for a malformed file", async () => {
        expect(await loadChurchKeyFile(join(root, "empty"))).toBeNull()
        const dir = join(root, "bad")
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, CHURCH_KEY_FILE), "not json at all")
        await expect(loadChurchKeyFile(dir)).rejects.toThrow("This is not a church key file.")
    })

    it("has mode 0o600 on POSIX", async () => {
        const dir = join(root, "mode")
        const { file } = await createChurchKey("Lantern Hill Chapel", "made-up pass phrase", new Date(0), MIN_KDF)
        await saveChurchKeyFile(dir, file)
        if (process.platform !== "win32") {
            expect(statSync(join(dir, CHURCH_KEY_FILE)).mode & 0o777).toBe(0o600)
        }
    })
})
