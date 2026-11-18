import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../stores", () => ({
    os: {},
    version: {},
    deviceId: {},
    isDev: {},
    activePage: { subscribe: () => () => undefined },
    activeDrawerTab: { subscribe: () => () => undefined }
}))

describe("analytics", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn())
    })

    it("does not send scripture usage or other events while upstream analytics are off", async () => {
        const { trackEvent, trackScriptureUsage } = await import("./analytics")

        trackEvent("session_start", { platform: "win32" })
        trackScriptureUsage("KJV", "kjv", "John 3:16")
        trackScriptureUsage("KJV", "kjv", "John 3:17")

        expect(fetch).not.toHaveBeenCalled()
    })
})
