import { describe, expect, it } from "vitest"
import { EnvelopeError, newKey } from "./envelope"
import { getRecord, memoryFolder, openRecord, putRecord, recordFileName } from "./vault"

interface ShowRecord {
    name: string
    slides: Record<string, { group: string; text: string }>
}

interface ProjectRecord {
    name: string
    shows: string[]
}

interface OrderRecord {
    items: { kind: string; showId: string }[]
}

const show: ShowRecord = { name: "Lantern Hymn", slides: { v1: { group: "Verse", text: "Little lantern on the hill, shine on" } } }
const project: ProjectRecord = { name: "Sunday 10:30", shows: ["lantern-hymn"] }
const order: OrderRecord = { items: [{ kind: "song", showId: "lantern-hymn" }] }

/** Every title and id a host folder must never show in plain text. */
const secrets = ["Lantern", "lantern on the hill", "Sunday 10:30", "lantern-hymn", "sunday-1", "order-1"]

async function putAll(folder: ReturnType<typeof memoryFolder>, key: Uint8Array): Promise<void> {
    await putRecord(folder, key, "show", "lantern-hymn", show)
    await putRecord(folder, key, "project", "sunday-1", project)
    await putRecord(folder, key, "order", "order-1", order)
}

describe("vault records", () => {
    it("round trips all three record kinds", async () => {
        const key = await newKey()
        const folder = memoryFolder()
        await putAll(folder, key)
        expect(await getRecord<ShowRecord>(folder, key, "show", "lantern-hymn")).toEqual(show)
        expect(await getRecord<ProjectRecord>(folder, key, "project", "sunday-1")).toEqual(project)
        expect(await getRecord<OrderRecord>(folder, key, "order", "order-1")).toEqual(order)
    })

    it("returns null for an unknown id", async () => {
        const key = await newKey()
        const folder = memoryFolder()
        expect(await getRecord(folder, key, "show", "never-saved")).toBeNull()
    })

    it("host folder holds only ciphertext", async () => {
        const key = await newKey()
        const folder = memoryFolder()
        await putAll(folder, key)
        const names = await folder.list()
        expect(names).toHaveLength(3)
        for (const name of names) {
            for (const secret of secrets) {
                expect(name).not.toContain(secret)
            }
            const content = folder.files.get(name)
            expect(content).not.toBeNull()
            for (const secret of secrets) {
                expect(content).not.toContain(secret)
            }
            const parsed = JSON.parse(content as string) as Record<string, unknown>
            expect(Object.keys(parsed).sort()).toEqual(["alg", "ct", "ctx", "ejs", "kid", "n"])
        }
    })

    it("fails to open with a different key", async () => {
        const key = await newKey()
        const other = await newKey()
        const folder = memoryFolder()
        const name = await putRecord(folder, key, "show", "lantern-hymn", show)
        await expect(openRecord(other, "show", "lantern-hymn", folder.files.get(name) as string)).rejects.toBeInstanceOf(EnvelopeError)
    })

    it("removes a record from the folder", async () => {
        const key = await newKey()
        const folder = memoryFolder()
        const name = await putRecord(folder, key, "show", "lantern-hymn", show)
        await folder.remove(name)
        expect(await folder.list()).toEqual([])
        expect(await getRecord(folder, key, "show", "lantern-hymn")).toBeNull()
    })

    it("fails when one record's content is copied under another record's name", async () => {
        const key = await newKey()
        const folder = memoryFolder()
        const showName = await putRecord(folder, key, "show", "lantern-hymn", show)
        const projectName = await recordFileName(key, "project", "sunday-1")
        await folder.write(projectName, folder.files.get(showName) as string)
        await expect(getRecord(folder, key, "project", "sunday-1")).rejects.toBeInstanceOf(EnvelopeError)
    })
})

describe("recordFileName", () => {
    it("is stable for the same key, kind, and id", async () => {
        const key = await newKey()
        expect(await recordFileName(key, "show", "lantern-hymn")).toBe(await recordFileName(key, "show", "lantern-hymn"))
    })

    it("differs for a different key", async () => {
        const a = await newKey()
        const b = await newKey()
        expect(await recordFileName(a, "show", "lantern-hymn")).not.toBe(await recordFileName(b, "show", "lantern-hymn"))
    })

    it("differs for a different kind with the same id", async () => {
        const key = await newKey()
        expect(await recordFileName(key, "show", "lantern-hymn")).not.toBe(await recordFileName(key, "project", "lantern-hymn"))
    })
})
