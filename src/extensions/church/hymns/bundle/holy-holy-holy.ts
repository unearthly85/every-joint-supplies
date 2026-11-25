import type { HymnRecord } from "../types"

/** Reginald Heber, written 1826, published 1827. Four original stanzas. */
export const holyHolyHoly: HymnRecord = {
    id: "holy-holy-holy",
    title: "Holy, Holy, Holy! Lord God Almighty",
    aliases: ["Holy, Holy, Holy", "Holy Holy Holy"],
    firstLine: "Holy, holy, holy! Lord God Almighty!",
    authors: ["Reginald Heber"],
    yearPublished: 1827,
    license: "PD",
    source: {
        hymnal: "Hymns Written and Adapted to the Weekly Church Service of the Year",
        year: 1827,
        location: "Trinity Sunday (London: J. Murray)"
    },
    pdRationale: "Lyrics by Reginald Heber, written in 1826 and published in Hymns Written and Adapted to the Weekly Church Service of the Year (London, 1827). Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. No later translation or added verse is included.",
    parts: [
        { id: "verse-1", label: "verse", text: "Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!" },
        { id: "verse-2", label: "verse", text: "Holy, holy, holy! All the saints adore Thee,\nCasting down their golden crowns around the glassy sea;\nCherubim and seraphim falling down before Thee,\nWho was, and is, and evermore shall be." },
        { id: "verse-3", label: "verse", text: "Holy, holy, holy! Though the darkness hide Thee,\nThough the eye of sinful man Thy glory may not see;\nOnly Thou art holy; there is none beside Thee,\nPerfect in power, in love, and purity." },
        { id: "verse-4", label: "verse", text: "Holy, holy, holy! Lord God Almighty!\nAll Thy works shall praise Thy Name, in earth, and sky, and sea;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!" }
    ]
}
