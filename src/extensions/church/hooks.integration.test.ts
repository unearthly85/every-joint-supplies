import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
    app: {
        getAppPath: () => process.cwd(),
        setName: () => undefined
    }
}))

describe("core hooks read the product config", () => {
    const vitestFlag = process.env.VITEST

    afterEach(() => {
        if (vitestFlag === undefined) delete process.env.VITEST
        else process.env.VITEST = vitestFlag
    })

    it("keeps ChurchApps cloud sync off when the app is not inside vitest", async () => {
        delete process.env.VITEST
        const { churchAppsCloudAllowed, readProductConfig } = await import("../../electron/utils/productConfig")
        expect(readProductConfig().productName).toBe("Every Joint Supplies")
        expect(churchAppsCloudAllowed()).toBe(false)
    })

    it("still lets upstream sync tests run while VITEST is set", async () => {
        process.env.VITEST = "true"
        const { churchAppsCloudAllowed } = await import("../../electron/utils/productConfig")
        expect(churchAppsCloudAllowed()).toBe(true)
    })
})
