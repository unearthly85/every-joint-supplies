import type { HymnRecord } from "../types"

/** Martin Luther, 1529; English translation by Frederick H. Hedge, 1853. Four stanzas of the Hedge text. */
export const aMightyFortress: HymnRecord = {
    id: "a-mighty-fortress",
    title: "A Mighty Fortress Is Our God",
    aliases: ["A Mighty Fortress", "Ein feste Burg"],
    firstLine: "A mighty fortress is our God",
    authors: ["Martin Luther", "Frederick H. Hedge"],
    yearPublished: 1853,
    license: "PD",
    source: {
        hymnal: "Hedge's English translation in mid-nineteenth-century American hymnals",
        year: 1853,
        location: "German 'Ein feste Burg ist unser Gott,' 1529; Hedge translation 1853"
    },
    pdRationale: "German lyrics by Martin Luther (1529). This bundle uses Frederick H. Hedge's English translation, published in 1853. Both the original and this translation were published well before 1930 and are in the U.S. public domain as of January 1, 2026. Later copyrighted English translations are excluded.",
    parts: [
        { id: "verse-1", label: "verse", text: "A mighty fortress is our God,\nA bulwark never failing;\nOur helper He, amid the flood\nOf mortal ills prevailing.\nFor still our ancient foe\nDoth seek to work us woe;\nHis craft and power are great,\nAnd, armed with cruel hate,\nOn earth is not his equal." },
        { id: "verse-2", label: "verse", text: "Did we in our own strength confide,\nOur striving would be losing,\nWere not the right Man on our side,\nThe Man of God's own choosing.\nDost ask who that may be?\nChrist Jesus, it is He;\nLord Sabaoth His Name,\nFrom age to age the same,\nAnd He must win the battle." },
        { id: "verse-3", label: "verse", text: "And though this world, with devils filled,\nShould threaten to undo us,\nWe will not fear, for God hath willed\nHis truth to triumph through us.\nThe prince of darkness grim,\nWe tremble not for him;\nHis rage we can endure,\nFor lo, his doom is sure,\nOne little word shall fell him." },
        { id: "verse-4", label: "verse", text: "That word above all earthly powers,\nNo thanks to them, abideth;\nThe Spirit and the gifts are ours\nThrough Him who with us sideth.\nLet goods and kindred go,\nThis mortal life also;\nThe body they may kill:\nGod's truth abideth still,\nHis kingdom is forever." }
    ]
}
