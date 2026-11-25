import type { HymnRecord } from "../types"

/** Horatio G. Spafford, written 1873, published 1876. Four widely printed original stanzas plus refrain. */
export const itIsWell: HymnRecord = {
    id: "it-is-well",
    title: "It Is Well with My Soul",
    aliases: ["It Is Well", "When Peace, Like a River"],
    firstLine: "When peace, like a river, attendeth my way",
    authors: ["Horatio G. Spafford"],
    yearPublished: 1876,
    license: "PD",
    source: {
        hymnal: "Gospel Hymns No. 2",
        year: 1876,
        location: "words written 1873; published 1876 with Philip P. Bliss's tune"
    },
    pdRationale: "Lyrics by Horatio G. Spafford, written in 1873 and published in Gospel Hymns No. 2 in 1876. Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. Only these widely printed nineteenth-century stanzas are included.",
    parts: [
        { id: "verse-1", label: "verse", text: "When peace, like a river, attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul." },
        { id: "chorus", label: "chorus", text: "It is well with my soul,\nIt is well, it is well with my soul." },
        { id: "verse-2", label: "verse", text: "Though Satan should buffet, though trials should come,\nLet this blest assurance control,\nThat Christ hath regarded my helpless estate,\nAnd hath shed His own blood for my soul." },
        { id: "verse-3", label: "verse", text: "My sin — oh, the bliss of this glorious thought! —\nMy sin, not in part but the whole,\nIs nailed to the cross, and I bear it no more,\nPraise the Lord, praise the Lord, O my soul!" },
        { id: "verse-4", label: "verse", text: "And Lord, haste the day when the faith shall be sight,\nThe clouds be rolled back as a scroll;\nThe trump shall resound, and the Lord shall descend,\nEven so, it is well with my soul." }
    ]
}
