import { app } from "electron"
import { readProductConfig } from "./productConfig"

// Imported first from the Electron entry so the name is set before electron-store
// reads userData. The packaged app also gets this name from electron-builder extraMetadata.
export const forkProduct = readProductConfig()
app.setName(forkProduct.productName)
