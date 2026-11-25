import type { HymnRecord } from "../types"

/** Robert Robinson, 1758. Three traditional stanzas of the original text. */
export const comeThouFount: HymnRecord = {
    id: "come-thou-fount",
    title: "Come, Thou Fount of Every Blessing",
    aliases: ["Come Thou Fount", "Come, Thou Fount"],
    firstLine: "Come, Thou Fount of every blessing",
    authors: ["Robert Robinson"],
    yearPublished: 1758,
    license: "PD",
    source: {
        hymnal: "A Collection of Hymns Used by the Church of Christ in Angel Alley, Bishopsgate",
        year: 1759,
        location: "commonly dated 1758; London printing 1759"
    },
    pdRationale: "Lyrics by Robert Robinson, written in 1758 and published by 1759. This English text was in circulation in the United States well before 1930 and is in the U.S. public domain as of January 1, 2026. Later rewritten stanzas found in some modern hymnals are omitted.",
    parts: [
        { id: "verse-1", label: "verse", text: "Come, Thou Fount of every blessing,\nTune my heart to sing Thy grace;\nStreams of mercy, never ceasing,\nCall for songs of loudest praise.\nTeach me some melodious sonnet,\nSung by flaming tongues above.\nPraise the mount, I'm fixed upon it,\nMount of Thy redeeming love." },
        { id: "verse-2", label: "verse", text: "Here I raise my Ebenezer;\nHither by Thy help I'm come;\nAnd I hope, by Thy good pleasure,\nSafely to arrive at home.\nJesus sought me when a stranger,\nWandering from the fold of God;\nHe, to rescue me from danger,\nInterposed His precious blood." },
        { id: "verse-3", label: "verse", text: "O to grace how great a debtor\nDaily I'm constrained to be!\nLet Thy goodness, like a fetter,\nBind my wandering heart to Thee.\nProne to wander, Lord, I feel it,\nProne to leave the God I love;\nHere's my heart, O take and seal it,\nSeal it for Thy courts above." }
    ]
}
