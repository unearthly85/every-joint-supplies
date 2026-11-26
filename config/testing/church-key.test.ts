import { expect, test } from "@playwright/test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { launchChurchApp } from "./electronHarness"

const CHURCH = "Lantern Hill Chapel"
const PASSPHRASE = "made-up pass phrase"

test("church files: set up, reopen, forget, recover", async () => {
    // Three Electron launches on a machine without a keyring (the CI path).
    test.setTimeout(300_000)
    let launched = await launchChurchApp()
    let window = launched.window
    let recoveryCode = ""
    try {
        // 1. Set up the church files with a passphrase.
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await window.getByTestId("church-name").fill(CHURCH)
        await window.getByTestId("church-passphrase").fill(PASSPHRASE)
        await window.getByTestId("church-passphrase-again").fill(PASSPHRASE)
        await window.getByTestId("church-setup").click()

        // 2. The recovery code is shown once; type back the checked group.
        const code = window.getByTestId("recovery-code")
        await expect(code).toBeVisible()
        recoveryCode = (await code.innerText()).trim()
        expect(recoveryCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/)
        await window.getByTestId("recovery-written").click()
        const groupNumber = Number((await window.getByTestId("recovery-group-label").innerText()).match(/group\s+(\d+)/i)?.[1])
        expect(groupNumber).toBeGreaterThanOrEqual(1)
        expect(groupNumber).toBeLessThanOrEqual(6)
        await window.getByTestId("recovery-group").fill(recoveryCode.split("-")[groupNumber - 1].toLowerCase())
        await window.getByTestId("church-finish").click()
        await expect(window.getByTestId("church-unlocked")).toBeVisible({ timeout: 30_000 })

        // 3. Plain volunteer words, no crypto jargon.
        await expect(window.getByTestId("church-files")).not.toHaveText(/encrypt|cipher|crypto|argon|\bkey\b/i)

        // 4. The key file never holds the passphrase or the recovery code.
        const keyFile = readFileSync(join(launched.dirs.store, "church", "church-key.json"), "utf8")
        expect(keyFile).not.toContain(PASSPHRASE)
        expect(keyFile).not.toContain(recoveryCode)
        expect(keyFile).not.toContain(recoveryCode.replace(/-/g, ""))

        // 5. Save a church copy: one .ejs envelope per record.
        await window.getByTestId("church-save-copy").click()
        await expect(window.getByTestId("church-copy-result")).toHaveText(/Saved \d+ items/)
        const copyDir = join(launched.dirs.data, "Church copy")
        if (existsSync(copyDir)) {
            for (const file of readdirSync(copyDir)) {
                expect(file.endsWith(".ejs")).toBe(true)
                const item = JSON.parse(readFileSync(join(copyDir, file), "utf8"))
                expect(Object.keys(item).sort()).toEqual(["ejs", "alg", "kid", "ctx", "n", "ct"].sort())
            }
        }

        // 6. Reopen against the same folders: remembered, or asked for the passphrase.
        await launched.close({ keep: true })
        launched = await launchChurchApp(launched.dirs)
        window = launched.window
        await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
        await window.getByTestId("open-new-sunday").click()
        await expect
            .poll(async () => (await window.getByTestId("church-unlocked").isVisible()) || (await window.getByTestId("church-unlock-secret").isVisible()), {
                timeout: 30_000
            })
            .toBe(true)
        if (await window.getByTestId("church-unlock-secret").isVisible()) {
            await window.getByTestId("church-unlock-secret").fill(PASSPHRASE)
            await window.getByTestId("church-unlock").click()
            await expect(window.getByTestId("church-unlocked")).toBeVisible()
        }

        // 7. Forget on this computer (when it can remember), then recover with the code.
        const forget = window.getByTestId("church-forget")
        if (await forget.isVisible()) {
            await forget.click()
            await expect(window.getByTestId("church-unlock-secret")).toBeVisible()
        } else {
            // No keyring here: a fresh start is locked.
            await launched.close({ keep: true })
            launched = await launchChurchApp(launched.dirs)
            window = launched.window
            await window.getByTestId("open-new-sunday").waitFor({ timeout: 60_000 })
            await window.getByTestId("open-new-sunday").click()
            await expect(window.getByTestId("church-unlock-secret")).toBeVisible()
        }
        await window.getByTestId("church-unlock-secret").fill(recoveryCode.replace(/-/g, " ").toLowerCase())
        await window.getByTestId("church-unlock").click()
        await expect(window.getByTestId("church-unlocked")).toBeVisible()

        // 8. ChurchApps stays hidden.
        await expect(window.getByText(/ChurchApps/i)).toHaveCount(0)
    } finally {
        await launched.close()
    }
})
