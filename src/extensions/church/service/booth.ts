import { writable } from "svelte/store"

export interface BoothView {
    now: string
    advertised: string
    remaining: string
    line: string
}

export const booth = writable<BoothView | null>(null)
