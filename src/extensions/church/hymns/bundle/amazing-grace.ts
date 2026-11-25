import type { HymnRecord } from "../types"

/** Olney Hymns (1779), Book I, Hymn 41. Six original Newton stanzas only. */
export const amazingGrace: HymnRecord = {
    id: "amazing-grace",
    title: "Amazing Grace",
    aliases: ["Amazing Grace (How Sweet the Sound)", "Faith's Review and Expectation"],
    firstLine: "Amazing grace! how sweet the sound",
    authors: ["John Newton"],
    yearPublished: 1779,
    license: "PD",
    source: {
        hymnal: "Olney Hymns",
        year: 1779,
        location: "Book I, Hymn 41, Faith's Review and Expectation (London: W. Oliver)"
    },
    pdRationale: "Lyrics by John Newton, first published in Olney Hymns (London, 1779). This text was published in the United States well before 1930. Works published in 1930 or earlier entered the U.S. public domain by January 1, 2026. The later stanza beginning \"When we've been there ten thousand years\" is omitted because it is not Newton's 1779 text and would need its own source line.",
    parts: [
        { id: "verse-1", label: "verse", text: "Amazing grace! how sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see." },
        { id: "verse-2", label: "verse", text: "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!" },
        { id: "verse-3", label: "verse", text: "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home." },
        { id: "verse-4", label: "verse", text: "The Lord has promised good to me,\nHis word my hope secures;\nHe will my shield and portion be,\nAs long as life endures." },
        { id: "verse-5", label: "verse", text: "Yes, when this flesh and heart shall fail,\nAnd mortal life shall cease,\nI shall possess, within the veil,\nA life of joy and peace." },
        { id: "verse-6", label: "verse", text: "The earth shall soon dissolve like snow,\nThe sun forbear to shine;\nBut God, who called me here below,\nWill be forever mine." }
    ]
}
