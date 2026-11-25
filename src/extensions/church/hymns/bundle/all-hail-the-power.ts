import type { HymnRecord } from "../types"

/** Edward Perronet, 1779, with John Rippon's 1787 stanzas commonly sung with it. All eighteenth-century. */
export const allHailThePower: HymnRecord = {
    id: "all-hail-the-power",
    title: "All Hail the Power of Jesus' Name",
    aliases: ["All Hail the Power", "Crown Him Lord of All"],
    firstLine: "All hail the power of Jesus' name!",
    authors: ["Edward Perronet", "John Rippon"],
    yearPublished: 1779,
    license: "PD",
    source: {
        hymnal: "The Gospel Magazine (Perronet, 1779) and Rippon's Selection of Hymns (1787)",
        year: 1779,
        location: "Perronet 1779; Rippon stanzas 'Let every kindred' and 'O that with yonder sacred throng,' 1787"
    },
    pdRationale: "Opening stanzas by Edward Perronet, published in The Gospel Magazine in 1779, with the two closing stanzas commonly sung from John Rippon's Selection of Hymns (1787). All of this English text was published well before 1930 and is in the U.S. public domain as of January 1, 2026.",
    parts: [
        { id: "verse-1", label: "verse", text: "All hail the power of Jesus' name!\nLet angels prostrate fall;\nBring forth the royal diadem,\nAnd crown Him Lord of all." },
        { id: "verse-2", label: "verse", text: "Ye chosen seed of Israel's race,\nYe ransomed from the fall,\nHail Him who saves you by His grace,\nAnd crown Him Lord of all." },
        { id: "verse-3", label: "verse", text: "Let every kindred, every tribe\nOn this terrestrial ball,\nTo Him all majesty ascribe,\nAnd crown Him Lord of all." },
        { id: "verse-4", label: "verse", text: "O that with yonder sacred throng\nWe at His feet may fall!\nWe'll join the everlasting song,\nAnd crown Him Lord of all." }
    ]
}
