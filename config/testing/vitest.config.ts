import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests live alongside source as *.test.ts under src/.
// The Playwright e2e (config/testing/start.test.ts) is excluded — it uses @playwright/test.
// This config sits in config/testing/, so point the root back at the project root.
const svelteStub = fileURLToPath(new URL("./svelte-stub.ts", import.meta.url))

export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    plugins: [
        {
            name: "stub-svelte",
            enforce: "pre",
            resolveId(id) {
                if (id.endsWith(".svelte")) return svelteStub
            }
        }
    ],
    test: {
        include: ["src/**/*.test.ts"],
        environment: "node",
        // Collected only when vitest is run with --coverage. Thresholds apply to our
        // extension, not to upstream FreeShow tests.
        coverage: {
            provider: "v8",
            reporter: ["text", "text-summary"],
            include: ["src/extensions/church/**/*.ts"],
            exclude: ["**/*.test.ts"],
            thresholds: {
                lines: 90,
                functions: 90,
                statements: 90,
                branches: 80
            }
        }
    }
})
