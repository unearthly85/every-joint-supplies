import type { HymnRecord } from "../types"

/** Isaac Watts, Hymns and Spiritual Songs, 1707. Four commonly sung original stanzas. */
export const whenISurvey: HymnRecord = {
    id: "when-i-survey",
    title: "When I Survey the Wondrous Cross",
    aliases: ["When I Survey"],
    firstLine: "When I survey the wondrous cross",
    authors: ["Isaac Watts"],
    yearPublished: 1707,
    license: "PD",
    source: {
        hymnal: "Hymns and Spiritual Songs",
        year: 1707,
        location: "Book III, Hymn 7 (London)"
    },
    pdRationale: "Lyrics by Isaac Watts, published in Hymns and Spiritual Songs (London, 1707). Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. Watts's less-often-sung 'His dying crimson' stanza is omitted from this starter set; no later copyrighted arrangement is included.",
    parts: [
        { id: "verse-1", label: "verse", text: "When I survey the wondrous cross\nOn which the Prince of glory died,\nMy richest gain I count but loss,\nAnd pour contempt on all my pride." },
        { id: "verse-2", label: "verse", text: "Forbid it, Lord, that I should boast,\nSave in the death of Christ my God!\nAll the vain things that charm me most,\nI sacrifice them to His blood." },
        { id: "verse-3", label: "verse", text: "See, from His head, His hands, His feet,\nSorrow and love flow mingled down!\nDid e'er such love and sorrow meet,\nOr thorns compose so rich a crown?" },
        { id: "verse-4", label: "verse", text: "Were the whole realm of nature mine,\nThat were a present far too small;\nLove so amazing, so divine,\nDemands my soul, my life, my all." }
    ]
}
