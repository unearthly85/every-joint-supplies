import type { HymnRecord } from "../types"

/** Augustus M. Toplady, 1776 (The Gospel Magazine). Four commonly sung stanzas of the original. */
export const rockOfAges: HymnRecord = {
    id: "rock-of-ages",
    title: "Rock of Ages",
    aliases: ["Rock of Ages, Cleft for Me"],
    firstLine: "Rock of Ages, cleft for me",
    authors: ["Augustus M. Toplady"],
    yearPublished: 1776,
    license: "PD",
    source: {
        hymnal: "The Gospel Magazine",
        year: 1776,
        location: "October 1776; later hymnal printings of the same text"
    },
    pdRationale: "Lyrics by Augustus M. Toplady, published in The Gospel Magazine in 1776. Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. No later copyrighted revision is included.",
    parts: [
        { id: "verse-1", label: "verse", text: "Rock of Ages, cleft for me,\nLet me hide myself in Thee;\nLet the water and the blood,\nFrom Thy wounded side which flowed,\nBe of sin the double cure,\nSave from wrath and make me pure." },
        { id: "verse-2", label: "verse", text: "Not the labors of my hands\nCan fulfill Thy law's demands;\nCould my zeal no respite know,\nCould my tears forever flow,\nAll for sin could not atone;\nThou must save, and Thou alone." },
        { id: "verse-3", label: "verse", text: "Nothing in my hand I bring,\nSimply to Thy cross I cling;\nNaked, come to Thee for dress;\nHelpless, look to Thee for grace;\nFoul, I to the fountain fly;\nWash me, Savior, or I die." },
        { id: "verse-4", label: "verse", text: "While I draw this fleeting breath,\nWhen mine eyes shall close in death,\nWhen I soar to worlds unknown,\nSee Thee on Thy judgment throne,\nRock of Ages, cleft for me,\nLet me hide myself in Thee." }
    ]
}
