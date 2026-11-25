import type { HymnRecord } from "../types"

/** Joseph M. Scriven, written 1855, in print by the mid-1860s. Three original stanzas. */
export const whatAFriend: HymnRecord = {
    id: "what-a-friend",
    title: "What a Friend We Have in Jesus",
    aliases: ["What a Friend"],
    firstLine: "What a friend we have in Jesus",
    authors: ["Joseph M. Scriven"],
    yearPublished: 1865,
    license: "PD",
    source: {
        hymnal: "circa mid-1860s gospel hymn printings of Scriven's 1855 poem",
        year: 1865,
        location: "words written 1855; widely published with Charles C. Converse's tune by 1868"
    },
    pdRationale: "Lyrics by Joseph M. Scriven, written in 1855 and published in the United States by the mid-1860s (well before 1930). This text is in the U.S. public domain as of January 1, 2026. No later copyrighted verse is included.",
    parts: [
        { id: "verse-1", label: "verse", text: "What a friend we have in Jesus,\nAll our sins and griefs to bear!\nWhat a privilege to carry\nEverything to God in prayer!\nO what peace we often forfeit,\nO what needless pain we bear,\nAll because we do not carry\nEverything to God in prayer." },
        { id: "verse-2", label: "verse", text: "Have we trials and temptations?\nIs there trouble anywhere?\nWe should never be discouraged;\nTake it to the Lord in prayer.\nCan we find a friend so faithful\nWho will all our sorrows share?\nJesus knows our every weakness;\nTake it to the Lord in prayer." },
        { id: "verse-3", label: "verse", text: "Are we weak and heavy laden,\nCumbered with a load of care?\nPrecious Savior, still our refuge;\nTake it to the Lord in prayer.\nDo thy friends despise, forsake thee?\nTake it to the Lord in prayer!\nIn His arms He'll take and shield thee;\nThou wilt find a solace there." }
    ]
}
