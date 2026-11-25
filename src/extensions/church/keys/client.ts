/**
 * The one IPC channel of the church key service. Hard-coded here on purpose:
 * the renderer must not import from src/electron, so the channel string lives
 * in this file instead of being shared with the main process.
 */
export const CHURCH_KEY_CHANNEL = "EJS_CHURCH_KEY"

/** The small slice of window.api the church key client needs. */
export interface ChurchApi {
    send(channel: string, data: any): void
    receive(channel: string, fn: (msg: any) => void, id?: string): void
    removeListener(channel: string, id: string): void
}

/** The plain error when the church files do not answer in time. */
const NO_ANSWER = "The church files did not answer. Try again."

/** The plain error for a not-ok reply that carries no text. */
const NO_TEXT = "Something went wrong with the church files."

/**
 * A promise client for the church key service over the one IPC channel. Each
 * request gets a unique id ("ck-1", "ck-2", ...), sends { id, action, ...payload }
 * on the channel, and listens for the one reply that carries that id: an ok
 * reply resolves the result, a not-ok reply rejects Error(error), and no reply
 * in time rejects "The church files did not answer. Try again." The listener
 * is always removed, and a late or foreign reply is ignored. Nothing about a
 * secret is logged.
 */
export function createChurchKeyClient(api: ChurchApi, timeoutMs = 30000) {
    let counter = 0

    return function request(action: string, payload?: object): Promise<any> {
        counter += 1
        const id = "ck-" + counter

        return new Promise((resolve, reject) => {
            let settled = false

            const cleanup = () => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                api.removeListener(CHURCH_KEY_CHANNEL, id)
            }

            const timer = setTimeout(() => {
                cleanup()
                reject(new Error(NO_ANSWER))
            }, timeoutMs)

            api.receive(
                CHURCH_KEY_CHANNEL,
                (msg: any) => {
                    if (settled || msg === null || typeof msg !== "object" || msg.id !== id) return
                    cleanup()
                    if (msg.ok) {
                        resolve(msg.result)
                    } else {
                        reject(new Error(typeof msg.error === "string" && msg.error !== "" ? msg.error : NO_TEXT))
                    }
                },
                id
            )

            api.send(CHURCH_KEY_CHANNEL, { id, action, ...payload })
        })
    }
}
