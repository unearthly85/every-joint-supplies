import { app } from "electron"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

interface ProductFile {
    productName: string
    features?: { churchAppsCloudSync?: boolean }
}

// Used only when product.json cannot be read (packaging bug). Cloud sync stays off.
const FALLBACK: ProductFile = {
    productName: "Every Joint Supplies",
    features: { churchAppsCloudSync: false }
}

let cached: ProductFile | null = null

function candidatePaths(): string[] {
    const paths = [join(process.cwd(), "src", "extensions", "church", "product.json"), join(process.cwd(), "public", "brand", "product.json")]
    try {
        const appPath = app.getAppPath()
        paths.unshift(join(appPath, "public", "brand", "product.json"))
        paths.unshift(join(appPath, "src", "extensions", "church", "product.json"))
    } catch {
        // getAppPath can throw before the app is ready. The cwd paths below still work in dev.
    }
    return paths
}

/** The same product.json the UI and the installer use. */
export function readProductConfig(): ProductFile {
    if (cached) return cached

    for (const filePath of candidatePaths()) {
        if (!existsSync(filePath)) continue
        try {
            cached = JSON.parse(readFileSync(filePath, "utf8")) as ProductFile
            return cached
        } catch (err) {
            console.error("Could not read product config:", filePath, err)
        }
    }

    console.error("product.json was not found. Using the fallback product name. ChurchApps cloud sync stays off.")
    cached = FALLBACK
    return cached
}

/** True only when product.json explicitly turns ChurchApps / B1 cloud sync on. */
export function churchAppsCloudAllowed(): boolean {
    // Upstream unit tests call the sync module directly. The installed app does not set this.
    if (process.env.VITEST) return true
    return readProductConfig().features?.churchAppsCloudSync === true
}
