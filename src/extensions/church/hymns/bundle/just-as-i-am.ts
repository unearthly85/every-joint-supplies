import type { HymnRecord } from "../types"

/** Charlotte Elliott, 1835; The Invalid's Hymn Book, 1836. Six original stanzas. */
export const justAsIAm: HymnRecord = {
    id: "just-as-i-am",
    title: "Just As I Am",
    aliases: ["Just As I Am, Without One Plea"],
    firstLine: "Just as I am, without one plea",
    authors: ["Charlotte Elliott"],
    yearPublished: 1836,
    license: "PD",
    source: {
        hymnal: "The Invalid's Hymn Book",
        year: 1836,
        location: "words dated 1835; published 1836"
    },
    pdRationale: "Lyrics by Charlotte Elliott, written in 1835 and published in The Invalid's Hymn Book (1836). Published in the United States well before 1930, so this text is in the U.S. public domain as of January 1, 2026. No later copyrighted verse is included.",
    parts: [
        { id: "verse-1", label: "verse", text: "Just as I am, without one plea,\nBut that Thy blood was shed for me,\nAnd that Thou bidst me come to Thee,\nO Lamb of God, I come, I come." },
        { id: "verse-2", label: "verse", text: "Just as I am, and waiting not\nTo rid my soul of one dark blot,\nTo Thee, whose blood can cleanse each spot,\nO Lamb of God, I come, I come." },
        { id: "verse-3", label: "verse", text: "Just as I am, though tossed about\nWith many a conflict, many a doubt,\nFightings and fears within, without,\nO Lamb of God, I come, I come." },
        { id: "verse-4", label: "verse", text: "Just as I am, poor, wretched, blind;\nSight, riches, healing of the mind,\nYea, all I need, in Thee to find,\nO Lamb of God, I come, I come." },
        { id: "verse-5", label: "verse", text: "Just as I am, Thou wilt receive,\nWilt welcome, pardon, cleanse, relieve;\nBecause Thy promise I believe,\nO Lamb of God, I come, I come." },
        { id: "verse-6", label: "verse", text: "Just as I am, Thy love unknown\nHas broken every barrier down;\nNow to be Thine, yea, Thine alone,\nO Lamb of God, I come, I come." }
    ]
}
