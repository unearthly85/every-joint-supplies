import { afterEach, describe, expect, it, vi } from "vitest"
import { CHURCH_KEY_CHANNEL, createChurchKeyClient, type ChurchApi } from "./client"

/** A fake ChurchApi: records what is sent, keeps the listeners, and lets the test push replies. */
function fakeApi() {
    const sent: { channel: string; data: any }[] = []
    const listeners = new Map<string, (msg: any) => void>()
    const removed: string[] = []
    const api: ChurchApi = {
        send(channel: string, data: any) {
            sent.push({ channel, data })
        },
        receive(channel: string, fn: (msg: any) => void, id?: string) {
            listeners.set(id ?? channel, fn)
        },
        removeListener(channel: string, id: string) {
            listeners.delete(id)
            removed.push(id)
        }
    }
    function reply(msg: any) {
        for (const fn of [...listeners.values()]) fn(msg)
    }
    return { api, sent, listeners, removed, reply }
}

describe("createChurchKeyClient", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("sends the action with a unique id on the church channel and resolves the ok reply", async () => {
        const { api, sent, listeners, removed, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        const p = request("status")
        expect(sent).toEqual([{ channel: CHURCH_KEY_CHANNEL, data: { id: "ck-1", action: "status" } }])
        expect(listeners.size).toBe(1)
        reply({ id: "ck-1", ok: true, result: { state: "none" } })
        await expect(p).resolves.toEqual({ state: "none" })
        expect(listeners.size).toBe(0)
        expect(removed).toEqual(["ck-1"])
    })

    it("sends the payload fields beside the id and the action", async () => {
        const { api, sent, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        const p = request("startSetup", { churchName: "Lantern Hill Chapel", passphrase: "little lantern on the hill" })
        expect(sent[0].data).toEqual({ id: "ck-1", action: "startSetup", churchName: "Lantern Hill Chapel", passphrase: "little lantern on the hill" })
        reply({ id: "ck-1", ok: true, result: { recoveryCode: "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF", checkGroup: 3 } })
        await expect(p).resolves.toEqual({ recoveryCode: "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF", checkGroup: 3 })
    })

    it("gives the next id to the next request, and each reply goes to its own request", async () => {
        const { api, sent, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        const first = request("status")
        const second = request("forget")
        expect(sent.map((s) => s.data.id)).toEqual(["ck-1", "ck-2"])
        reply({ id: "ck-2", ok: true, result: { state: "locked", churchName: "Lantern Hill Chapel" } })
        reply({ id: "ck-1", ok: true, result: { state: "none" } })
        await expect(first).resolves.toEqual({ state: "none" })
        await expect(second).resolves.toEqual({ state: "locked", churchName: "Lantern Hill Chapel" })
    })

    it("rejects with the plain error text of a not-ok reply and removes the listener", async () => {
        const { api, listeners, removed, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        const p = request("unlock", { secret: "little lantern on the hill" })
        reply({ id: "ck-1", ok: false, error: "That passphrase or recovery code did not work." })
        const caught = await p.catch((err: unknown) => err)
        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).message).toBe("That passphrase or recovery code did not work.")
        expect(listeners.size).toBe(0)
        expect(removed).toEqual(["ck-1"])
    })

    it("gives the plain fallback when a not-ok reply carries no text", async () => {
        const { api, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        const p = request("status")
        reply({ id: "ck-1", ok: false })
        await expect(p).rejects.toMatchObject({ message: "Something went wrong with the church files." })
    })

    it("ignores replies for other ids, non-object messages, and late replies after the settle", async () => {
        const { api, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        let settled = false
        const p = request("status").then(
            (value) => {
                settled = true
                return value
            },
            (err: unknown) => {
                settled = true
                throw err
            }
        )
        reply({ id: "ck-99", ok: true, result: { state: "unlocked" } })
        reply(null)
        expect(settled).toBe(false)
        reply({ id: "ck-1", ok: true, result: { state: "none" } })
        await expect(p).resolves.toEqual({ state: "none" })
        // The listener is gone, so a late reply for the same id changes nothing.
        reply({ id: "ck-1", ok: false, error: "too late" })
        expect(settled).toBe(true)
    })

    it("times out with the plain no-answer error and removes the listener", async () => {
        vi.useFakeTimers()
        const { api, listeners, removed, reply } = fakeApi()
        const request = createChurchKeyClient(api)
        const p = request("status")
        vi.advanceTimersByTime(29999)
        // Still waiting: a reply in the last moment still resolves.
        reply({ id: "ck-1", ok: true, result: { state: "none" } })
        await expect(p).resolves.toEqual({ state: "none" })
        expect(listeners.size).toBe(0)

        const late = request("status")
        vi.advanceTimersByTime(30000)
        await expect(late).rejects.toMatchObject({ message: "The church files did not answer. Try again." })
        expect(listeners.size).toBe(0)
        expect(removed).toEqual(["ck-1", "ck-2"])
        // The listener is gone, so a reply after the timeout is ignored.
        reply({ id: "ck-2", ok: true, result: { state: "unlocked" } })
    })

    it("honours a shorter timeout", async () => {
        vi.useFakeTimers()
        const { api } = fakeApi()
        const request = createChurchKeyClient(api, 5000)
        const p = request("status")
        vi.advanceTimersByTime(4999)
        vi.advanceTimersByTime(1)
        await expect(p).rejects.toMatchObject({ message: "The church files did not answer. Try again." })
    })
})
