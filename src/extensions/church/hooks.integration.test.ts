import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
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

describe("the P0-10 electron hooks survive an upstream merge", () => {
    const requireFromRepoRoot = createRequire(join(process.cwd(), "package.json"))

    it("registers the church key IPC channel in the electron main process", () => {
        const main = readFileSync(join(process.cwd(), "src", "electron", "index.ts"), "utf8")
        expect(main).toContain("ipcMain.on(CHURCH_KEY_CHANNEL, receiveChurchKey)")
    })

    it("ships the built church crypto in the installer files", () => {
        const builder = requireFromRepoRoot("./config/building/electron-builder.fork.cjs")
        expect(builder.files).toContain("build/extensions/**")
        expect(builder.files).toContain("build/electron/**")
    })
})
