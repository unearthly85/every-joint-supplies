import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { applyBrandText, churchAppsCloudSync, credit, productName, releasesApi, upstreamName } from "./features"

describe("product config", () => {
    it("uses the working product name from the one config file", () => {
        expect(productName).toBe("Every Joint Supplies")
        expect(credit).toBe("Based on FreeShow")
        expect(upstreamName).toBe("FreeShow")
    })

    it("keeps ChurchApps cloud sync off", () => {
        expect(churchAppsCloudSync).toBe(false)
    })

    it("rebrands visible FreeShow wording without rewriting freeshow.app urls", () => {
        expect(applyBrandText("Welcome to FreeShow")).toBe("Welcome to Every Joint Supplies")
        expect(applyBrandText("https://freeshow.app/docs")).toBe("https://freeshow.app/docs")
    })

    it("points update checks at this repository, not ChurchApps/FreeShow", () => {
        expect(releasesApi).toBe("https://api.github.com/repos/unearthly85/every-joint-supplies/releases")
        expect(releasesApi.includes("ChurchApps")).toBe(false)
    })

    it("keeps the GPL-3.0 license text in the repo", () => {
        const license = readFileSync("LICENSE", "utf8")
        expect(license).toContain("GNU GENERAL PUBLIC LICENSE")
        expect(license).toContain("Version 3")
    })
})
