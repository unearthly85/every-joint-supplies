import type { HymnRecord } from "../types"

/** Fanny J. Crosby, 1873. Three stanzas and the original refrain. */
export const blessedAssurance: HymnRecord = {
    id: "blessed-assurance",
    title: "Blessed Assurance",
    aliases: ["Blessed Assurance, Jesus Is Mine"],
    firstLine: "Blessed assurance, Jesus is mine!",
    authors: ["Fanny J. Crosby"],
    yearPublished: 1873,
    license: "PD",
    source: {
        hymnal: "1873 gospel-hymn printings (words Fanny J. Crosby; tune Phoebe Palmer Knapp)",
        year: 1873,
        location: "first published 1873"
    },
    pdRationale: "Lyrics by Fanny J. Crosby, published in 1873. Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. The accompanying 1873 tune is also from that date; this bundle ships lyrics only.",
    parts: [
        { id: "verse-1", label: "verse", text: "Blessed assurance, Jesus is mine!\nO what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood." },
        { id: "chorus", label: "chorus", text: "This is my story, this is my song,\nPraising my Savior all the day long;\nThis is my story, this is my song,\nPraising my Savior all the day long." },
        { id: "verse-2", label: "verse", text: "Perfect submission, perfect delight,\nVisions of rapture now burst on my sight;\nAngels, descending, bring from above\nEchoes of mercy, whispers of love." },
        { id: "verse-3", label: "verse", text: "Perfect submission, all is at rest,\nI in my Savior am happy and blest,\nWatching and waiting, looking above,\nFilled with His goodness, lost in His love." }
    ]
}
