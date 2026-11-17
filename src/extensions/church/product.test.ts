import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { applyBrandText, brandDictionary, churchAppsCloudSync, credit, description, filePrefix, productName, releasesApi, releasesPage, repositoryUrl, upstreamAnalytics, upstreamDonatePrompt, upstreamName, upstreamUrl, verse } from "./features"

describe("product config", () => {
    it("uses the working product name from the one config file", () => {
        expect(productName).toBe("Every Joint Supplies")
        expect(credit).toBe("Based on FreeShow")
        expect(upstreamName).toBe("FreeShow")
    })

    it("keeps ChurchApps cloud sync, donate prompts, and upstream analytics off", () => {
        expect(churchAppsCloudSync).toBe(false)
        expect(upstreamDonatePrompt).toBe(false)
        expect(upstreamAnalytics).toBe(false)
        expect(filePrefix).toBe("EveryJointSupplies")
        expect(description).toContain("Built on FreeShow")
        expect(verse).toContain("Eph 4:16")
        expect(repositoryUrl).toBe("https://github.com/unearthly85/every-joint-supplies")
        expect(upstreamUrl).toBe("https://github.com/ChurchApps/FreeShow")
        expect(releasesPage).toBe("https://github.com/unearthly85/every-joint-supplies/releases")
    })

    it("rewrites dictionary strings the language loader shows", () => {
        const messages: { popup?: { initialize: string; extra: string }; missing?: undefined } = {
            missing: undefined,
            popup: { initialize: "Welcome to FreeShow", extra: 1 as unknown as string }
        }
        brandDictionary(messages)
        expect(messages.popup?.initialize).toBe("Welcome to Every Joint Supplies")
        expect(messages.popup?.extra).toBe(1 as unknown as string)
        expect(applyBrandText("")).toBe("")
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
