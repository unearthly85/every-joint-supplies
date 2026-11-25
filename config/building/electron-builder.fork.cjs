/**
 * Installer identity for this fork.
 *
 * Upstream electron-builder.yaml is loaded and then overridden from
 * src/extensions/church/product.json. Do not put the product name in this file.
 *
 * Windows signing is off unless a certificate is actually present. See SIGNING.md.
 * Publishing is configured for this repository and stays off unless the CLI is
 * invoked with --publish always (npm run release:publish). CI must pass --publish never.
 */

const fs = require("fs")
const path = require("path")

const product = require("../../src/extensions/church/product.json")

function loadYaml(file) {
    const yaml = requireYaml()
    return yaml.load(fs.readFileSync(file, "utf8"))
}

function requireYaml() {
    try {
        return require("js-yaml")
    } catch {
        // electron-builder depends on js-yaml; it is not a direct dependency of this repo.
    }
    const nested = path.join(__dirname, "..", "..", "node_modules", "app-builder-lib", "node_modules", "js-yaml")
    try {
        return require(nested)
    } catch {
        return require(path.join(__dirname, "..", "..", "node_modules", "js-yaml"))
    }
}

function envPresent(name) {
    return typeof process.env[name] === "string" && process.env[name].trim().length > 0
}

// GitHub Actions injects missing secrets as "". electron-builder treats that as a certificate path and fails the build.
for (const key of ["CSC_LINK", "WIN_CSC_LINK", "CSC_KEY_PASSWORD", "WIN_CSC_KEY_PASSWORD", "CSC_NAME"]) {
    if (!envPresent(key)) delete process.env[key]
}

const hasAuthenticode = envPresent("WIN_CSC_LINK") || envPresent("CSC_LINK")
const azureKeys = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_CODE_SIGNING_ACCOUNT", "AZURE_CERTIFICATE_PROFILE"]
const hasAzure = azureKeys.every(envPresent)

const base = loadYaml(path.join(__dirname, "electron-builder.yaml"))

const win = { ...base.win, forceCodeSigning: false }
// Never inherit FreeShow's Live Church Solutions Azure Trusted Signing profile.
delete win.azureSignOptions
if (hasAzure && !hasAuthenticode) {
    win.azureSignOptions = {
        publisherName: product.productName,
        endpoint: process.env.AZURE_CODE_SIGNING_ENDPOINT || "https://eus.codesigning.azure.net/",
        certificateProfileName: process.env.AZURE_CERTIFICATE_PROFILE,
        codeSigningAccountName: process.env.AZURE_CODE_SIGNING_ACCOUNT
    }
}

const mac = { ...base.mac }
if (!hasAuthenticode && !envPresent("CSC_NAME")) mac.identity = null

console.log(`[every-joint] Windows signing: ${hasAuthenticode ? "Authenticode certificate" : hasAzure ? "Azure Trusted Signing" : "unsigned (no signing secrets)"}`)

module.exports = {
    ...base,
    files: [...base.files, "build/extensions/**"],
    appId: product.appId,
    productName: product.productName,
    executableName: product.executableName,
    artifactName: product.artifactName,
    extraMetadata: {
        // Install folder and updater cache. productName still sets userData to %APPDATA%\Every Joint Supplies.
        name: product.npmName,
        productName: product.productName,
        description: product.description,
        author: product.author,
        repository: product.repository
    },
    // Wired to this repo's GitHub Releases. Uploads happen only with --publish always.
    publish: [
        {
            provider: "github",
            owner: product.githubOwner,
            repo: product.githubRepo,
            releaseType: "release"
        }
    ],
    win,
    mac
}
