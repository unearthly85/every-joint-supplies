import type { HymnRecord } from "../types"

/** Anonymous 'K' in John Rippon's Selection of Hymns, 1787. Five widely printed original stanzas. */
export const howFirmAFoundation: HymnRecord = {
    id: "how-firm-a-foundation",
    title: "How Firm a Foundation",
    aliases: ["How Firm a Foundation, Ye Saints of the Lord"],
    firstLine: "How firm a foundation, ye saints of the Lord",
    authors: ["John Rippon's Selection (attrib. 'K')"],
    yearPublished: 1787,
    license: "PD",
    source: {
        hymnal: "A Selection of Hymns from the Best Authors (John Rippon)",
        year: 1787,
        location: "Hymn signed 'K' in Rippon's Selection, 1787"
    },
    pdRationale: "Published in John Rippon's Selection of Hymns (London, 1787), signed 'K'. Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. No later copyrighted revision is included.",
    parts: [
        { id: "verse-1", label: "verse", text: "How firm a foundation, ye saints of the Lord,\nIs laid for your faith in His excellent Word!\nWhat more can He say than to you He hath said,\nTo you who for refuge to Jesus have fled?" },
        { id: "verse-2", label: "verse", text: "Fear not, I am with thee, O be not dismayed,\nFor I am thy God, and will still give thee aid;\nI'll strengthen thee, help thee, and cause thee to stand,\nUpheld by My righteous, omnipotent hand." },
        { id: "verse-3", label: "verse", text: "When through the deep waters I call thee to go,\nThe rivers of sorrow shall not overflow;\nFor I will be with thee, thy troubles to bless,\nAnd sanctify to thee thy deepest distress." },
        { id: "verse-4", label: "verse", text: "When through fiery trials thy pathway shall lie,\nMy grace, all sufficient, shall be thy supply;\nThe flame shall not hurt thee; I only design\nThy dross to consume, and thy gold to refine." },
        { id: "verse-5", label: "verse", text: "The soul that on Jesus hath leaned for repose\nI will not, I will not desert to his foes;\nThat soul, though all hell should endeavor to shake,\nI'll never, no, never, no, never forsake!" }
    ]
}
