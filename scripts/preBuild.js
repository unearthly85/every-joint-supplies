const { readdirSync, existsSync, lstatSync, unlinkSync, rmdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } = require("fs")
const { join } = require("path")

// app build file paths
const buildSveltePath = join(__dirname, "..", "public", "build")
const buildElectronPath = join(__dirname, "..", "build") // this includes server files

// delete folders and all of it's content
deleteFolderRecursive(buildSveltePath)
deleteFolderRecursive(buildElectronPath)

function deleteFolderRecursive(folderPath) {
    if (!existsSync(folderPath)) return

    readdirSync(folderPath).forEach((file) => {
        const path = join(folderPath, file)
        const isFolder = lstatSync(path).isDirectory()
        if (isFolder) return deleteFolderRecursive(path)

        // delete file
        unlinkSync(path)
    })

    rmdirSync(folderPath)
}

// create production configs with no source map
function generateProdConfigs() {
    const configs = ["svelte", "electron", "server"]
    configs.forEach(createProdConfig)

    function createProdConfig(id) {
        const baseConfigPath = join(__dirname, "..", "config", "typescript", `tsconfig.${id}.json`)
        const rawConfig = readFileSync(baseConfigPath, "utf8")
        const parsedConfig = JSON.parse(rawConfig || "{}")

        if (!parsedConfig.compilerOptions) parsedConfig.compilerOptions = {}
        parsedConfig.compilerOptions.sourceMap = false

        const newConfigPath = baseConfigPath.replace(`tsconfig.${id}.json`, `tsconfig.${id}.prod.json`)
        writeFileSync(newConfigPath, JSON.stringify(parsedConfig))
    }
}

// copy the latest version of pdf worker file to ensure it's up to date with the package version
function getPdfWorkerFile() {
    const workerName = "pdf.worker.min.mjs"
    const originPath = join(__dirname, "..", "node_modules", "pdfjs-dist", "build", workerName)
    const outputPath = join(__dirname, "..", "public", "assets", workerName)

    try {
        copyFileSync(originPath, outputPath)
    } catch (err) {
        console.error("Could not copy PDF worker file:", err)
    }
}

if (process.env.NODE_ENV === "production") generateProdConfigs()
getPdfWorkerFile()

// write release build repository info (currently for error reporting checks)
const releaseRepo = process.env.GITHUB_REPOSITORY || "local"
console.log("Built from repo:", releaseRepo)
writeFileSync(join(__dirname, "..", "public", "release.json"), JSON.stringify({ repo: releaseRepo }))

// Product name lives in src/extensions/church/product.json. Copy it where the
// packaged app can read it, and refresh document titles marked data-ejs-product.
const productSource = join(__dirname, "..", "src", "extensions", "church", "product.json")
const product = JSON.parse(readFileSync(productSource, "utf8"))
const brandDir = join(__dirname, "..", "public", "brand")
mkdirSync(brandDir, { recursive: true })
copyFileSync(productSource, join(brandDir, "product.json"))

const titledPages = [
    [join(__dirname, "..", "public", "index.html"), ""],
    [join(__dirname, "..", "public", "loading.html"), ""],
    [join(__dirname, "..", "src", "server", "stage", "index.html"), " Stage"],
    [join(__dirname, "..", "src", "server", "remote", "index.html"), " Remote"]
]
for (const [file, suffix] of titledPages) {
    const html = readFileSync(file, "utf8")
    const name = `${product.productName}${suffix}`
    const next = html.replace(/(<title\b[^>]*\bdata-ejs-product\b[^>]*>)[^<]*(<\/title>)/, `$1${name}$2`)
    if (next !== html) writeFileSync(file, next)
}
