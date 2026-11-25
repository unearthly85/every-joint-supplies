import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { safeStorage, type IpcMainEvent } from "electron"
import { diskFolder } from "../../extensions/church/crypto/disk"
import { ChurchKeys, ChurchKeyError, type ChurchRecord, type KeyProtector } from "../../extensions/church/keys/churchKeys"
import { appDataPath, getStore } from "../data/store"
import { getDataFolderRoot, getDataFolderPath, parseShow } from "../utils/files"

/** The one IPC channel of the church key service. */
export const CHURCH_KEY_CHANNEL = "EJS_CHURCH_KEY"

/** Plain error text for an unexpected failure of the church key service. Never contains a secret. */
const GENERIC_ERROR = "Something went wrong with the church files."

/**
 * The protector for the remembered key: Electron safeStorage. On Linux the
 * "basic_text" backend is not protection (no keyring), so the passphrase is
 * asked at each start.
 */
const protector: KeyProtector = {
    available(): boolean {
        return safeStorage.isEncryptionAvailable() && !(process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")
    },
    protect(text: string): Uint8Array {
        return safeStorage.encryptString(text)
    },
    unprotect(data: Uint8Array): string {
        return safeStorage.decryptString(Buffer.from(data))
    }
}

/** The records to copy: every ".show" file in the Shows folder, then every project. */
async function readChurchData(): Promise<ChurchRecord[]> {
    const records: ChurchRecord[] = []
    const showsPath = getDataFolderPath("shows")
    for (const name of await readdir(showsPath)) {
        if (!name.endsWith(".show")) continue
        const parsed = parseShow(await readFile(join(showsPath, name), "utf8"))
        if (parsed === null) continue
        const [id, show] = parsed
        if (typeof id !== "string") continue
        records.push({ kind: "show", id, data: show })
    }
    for (const [id, data] of Object.entries(getStore("PROJECTS").projects)) {
        records.push({ kind: "project", id, data })
    }
    return records
}

/** The one ChurchKeys instance of the main process, created on first use. */
let keys: ChurchKeys | null = null

function getKeys(): ChurchKeys {
    if (keys === null) {
        keys = new ChurchKeys({
            dir: join(appDataPath, "church"),
            copyFolder: diskFolder(join(getDataFolderRoot(), "Church copy")),
            protector,
            readChurchData
        })
    }
    return keys
}

/**
 * The IPC handler of the church key service. Replies carry only status, the
 * recovery code during setup (shown once), counts and plain error text; the
 * key never goes to the renderer. Nothing about the message, a secret, or a
 * result is logged.
 */
export async function receiveChurchKey(e: IpcMainEvent, msg: any): Promise<void> {
    if (typeof msg !== "object" || msg === null || typeof msg.id !== "string" || typeof msg.action !== "string") {
        e.reply(CHURCH_KEY_CHANNEL, { id: null, ok: false, error: GENERIC_ERROR })
        return
    }
    const id: string = msg.id
    const action: string = msg.action
    try {
        const service = getKeys()
        let result: unknown
        switch (action) {
            case "status":
                result = await service.status()
                break
            case "startSetup":
                if (typeof msg.churchName !== "string" || typeof msg.passphrase !== "string") throw new ChurchKeyError("Unknown church key request.")
                result = await service.startSetup(msg.churchName, msg.passphrase)
                break
            case "finishSetup":
                if (typeof msg.group !== "string") throw new ChurchKeyError("Unknown church key request.")
                result = await service.finishSetup(msg.group)
                break
            case "cancelSetup":
                result = await service.cancelSetup()
                break
            case "unlock":
                if (typeof msg.secret !== "string") throw new ChurchKeyError("Unknown church key request.")
                result = await service.unlock(msg.secret)
                break
            case "forget":
                result = await service.forget()
                break
            case "saveChurchCopy":
                result = await service.saveChurchCopy()
                break
            default:
                e.reply(CHURCH_KEY_CHANNEL, { id, ok: false, error: "Unknown church key action." })
                return
        }
        e.reply(CHURCH_KEY_CHANNEL, { id, ok: true, result })
    } catch (err) {
        const error = err instanceof ChurchKeyError ? err.message : GENERIC_ERROR
        console.warn("[church-key]", action, err instanceof Error ? err.name : "Error")
        e.reply(CHURCH_KEY_CHANNEL, { id, ok: false, error })
    }
}
