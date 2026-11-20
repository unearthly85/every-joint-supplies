import { describe, expect, it } from "vitest"
import { parseChordPro, parseFile, parseOpenLyricsXml, parseSongSelect } from "./formats"

const OPENLYRICS_TWO_SONGS = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<OPML version="2.0">',
    "<body>",
    "  <SONG>",
    "    <TITLE>First Made Up Song</TITLE>",
    '    <AUTHOR type="words">Jane Maker</AUTHOR>',
    "    <CCLI>1112223</CCLI>",
    "    <COPYRIGHT>Public Domain</COPYRIGHT>",
    '    <SECTION type="verse">',
    "      <LINE>First line of the first verse</LINE>",
    "      <LINE>Second line of the first verse</LINE>",
    "    </SECTION>",
    '    <SECTION type="chorus">',
    "      <LINE>First line of the chorus</LINE>",
    "      <LINE>Second line of the chorus</LINE>",
    "    </SECTION>",
    "  </SONG>",
    "  <SONG>",
    "    <TITLE>Second Made Up Song</TITLE>",
    '    <AUTHOR type="words">John Writer</AUTHOR>',
    "    <CCLI>4445556</CCLI>",
    "    <COPYRIGHT>(c) 2019 Made Up Music</COPYRIGHT>",
    '    <SECTION type="verse">',
    "      <LINE>Verse line one</LINE>",
    "    </SECTION>",
    "  </SONG>",
    "</body>",
    "</OPML>"
].join("\n")

const OPENLYRICS_SECTION_KINDS = [
    "<OPML>",
    "<body>",
    "<SONG>",
    "<TITLE>Section Kinds</TITLE>",
    '  <SECTION type="intro"><LINE>Intro line</LINE></SECTION>',
    '  <SECTION type="prechorus"><LINE>Pre line</LINE></SECTION>',
    '  <SECTION type="climax"><LINE>Climax line</LINE></SECTION>',
    '  <SECTION type="postchorus"><LINE>Post line</LINE></SECTION>',
    '  <SECTION type="instrumental"><LINE>Instrumental line</LINE></SECTION>',
    '  <SECTION type="tag"><LINE>Tag line</LINE></SECTION>',
    '  <SECTION type="ending"><LINE>Ending line</LINE></SECTION>',
    '  <SECTION type="mystery" label="My Part"><LINE>Custom line</LINE></SECTION>',
    '  <SECTION type="other"><LINE>Has &quot;quotes&quot; &amp; &lt;tags&gt; &#39;here&#39;</LINE></SECTION>',
    '  <SECTION type="verse">Plain text line one<br>Plain text line two&nbsp;with nbsp</SECTION>',
    "</SONG>",
    "</body>",
    "</OPML>"
].join("\n")

describe("parseOpenLyricsXml", () => {
    it("reads a two-SONG file into two drafts with parts and credits", () => {
        const drafts = parseOpenLyricsXml(OPENLYRICS_TWO_SONGS)
        expect(drafts).toHaveLength(2)
        expect(drafts[0].title).toBe("First Made Up Song")
        expect(drafts[0].author).toBe("Jane Maker")
        expect(drafts[0].ccli).toBe("1112223")
        expect(drafts[0].copyright).toBe("Public Domain")
        expect(drafts[0].publicDomain).toBe(true)
        expect(drafts[0].parts.map((part) => part.label)).toEqual(["verse", "chorus"])
        expect(drafts[0].parts[0].text).toBe("First line of the first verse\nSecond line of the first verse")
        expect(drafts[0].parts[1].text).toBe("First line of the chorus\nSecond line of the chorus")
        expect(drafts[1].title).toBe("Second Made Up Song")
        expect(drafts[1].author).toBe("John Writer")
        expect(drafts[1].ccli).toBe("4445556")
        expect(drafts[1].copyright).toBe("(c) 2019 Made Up Music")
        expect(drafts[1].publicDomain).toBeUndefined()
        expect(drafts[1].parts).toHaveLength(1)
    })

    it("maps section types to the canonical part labels", () => {
        const drafts = parseOpenLyricsXml(OPENLYRICS_SECTION_KINDS)
        expect(drafts).toHaveLength(1)
        expect(drafts[0].parts.map((part) => part.label)).toEqual(["intro", "pre_chorus", "Climax", "Post-Chorus", "break", "tag", "outro", "My Part", "verse", "verse"])
        expect(drafts[0].parts[7].text).toBe("Custom line")
        expect(drafts[0].parts[8].text).toBe("Has \"quotes\" & <tags> 'here'")
        expect(drafts[0].parts[9].text).toBe("Plain text line one\nPlain text line two with nbsp")
    })

    it("returns an empty list for a file with no SONG blocks", () => {
        expect(parseOpenLyricsXml("<OPML><body></body></OPML>")).toEqual([])
        expect(parseOpenLyricsXml("")).toEqual([])
        expect(parseOpenLyricsXml("not xml at all")).toEqual([])
    })
})

const CHORDPRO_MAIN = ["%title: Made Up Chord Song", "%author: Sam Singer", "%ccli: 7778889", "%copyright: (c) 2021 Made Up Tunes", "{c:Verse 1}", "[C]First line of the verse", "[G]Second line of the verse", "{c:Chorus (2x)}", "[C]First line of the chorus", "[D]Second line of the chorus", "start_of_bridge:", "[C]Bridge line one", "[G]Bridge line two", "end_of_bridge:"].join("\n")

describe("parseChordPro", () => {
    it("reads markers, start_of/end_of pairs, metadata, and strips chords", () => {
        const draft = parseChordPro(CHORDPRO_MAIN)
        expect(draft).not.toBeNull()
        expect(draft!.title).toBe("Made Up Chord Song")
        expect(draft!.author).toBe("Sam Singer")
        expect(draft!.ccli).toBe("7778889")
        expect(draft!.copyright).toBe("(c) 2021 Made Up Tunes")
        expect(draft!.parts.map((part) => part.label)).toEqual(["verse", "chorus", "bridge"])
        expect(draft!.parts[0].text).toBe("First line of the verse\nSecond line of the verse")
        expect(draft!.parts[0].repeat).toBe(1)
        expect(draft!.parts[1].text).toBe("First line of the chorus\nSecond line of the chorus")
        expect(draft!.parts[1].repeat).toBe(2)
        expect(draft!.parts[2].text).toBe("Bridge line one\nBridge line two")
        for (const part of draft!.parts) expect(part.text).not.toContain("[")
    })

    it("reads a trailing x2, a space marker, and a public domain copyright", () => {
        const draft = parseChordPro("%copyright: Public Domain\n{c:Chorus x2}\nWord one[/]word two", "My Song File.cho")
        expect(draft!.title).toBe("My Song File")
        expect(draft!.publicDomain).toBe(true)
        expect(draft!.parts).toHaveLength(1)
        expect(draft!.parts[0].label).toBe("chorus")
        expect(draft!.parts[0].repeat).toBe(2)
        expect(draft!.parts[0].text).toBe("Word one word two")
    })

    it("falls back to Untitled when there is no title and no file name", () => {
        const draft = parseChordPro("{c:Verse}\nLine one")
        expect(draft!.title).toBe("Untitled")
        expect(draft!.parts[0].label).toBe("verse")
    })

    it("detects bare heading lines as section starts", () => {
        const draft = parseChordPro("VERSE 1\nLine one\nCHORUS\nLine two")
        expect(draft!.parts.map((part) => part.label)).toEqual(["verse", "chorus"])
        expect(draft!.parts[0].text).toBe("Line one")
        expect(draft!.parts[1].text).toBe("Line two")
    })

    it("returns null for a plain lyric with no markers", () => {
        expect(parseChordPro("Just a line of words\nAnother line of words")).toBeNull()
        expect(parseChordPro("")).toBeNull()
    })
})

const SONGSELECT_TXT = ["Made Up Select Song", "", "Verse 1", "First line of the verse", "Second line of the verse", "", "Chorus", "First line of the chorus", "Second line of the chorus", "", "CCLI: 1234567", "Copyright © 1999 Made Up Music", "Author Jane Maker"].join("\n")

const USR_MAIN = [
    "[File]",
    "Type=SongSelect Import File",
    "Version=3.0",
    "[S A1234567]",
    "Title=Made Up Usr Song",
    "Author=Maker, Jane | Smith, John",
    "Copyright=1999 Made Up Music",
    "Fields=Verse 1/tChorus 1/tBridge 1/tOther 1/tOther 2/tOther 3",
    "Words=First line of the verse/nSecond line of the verse/tFirst line of the chorus/nSecond line of the chorus/tBridge line one/nBridge line two/t(PRE-CHORUS)/nPre line one/nPre line two/t(BRIDGE)/nBridge line one/nBridge line two/t(Outro)/nOutro line one/nOutro line two"
].join("\n")

describe("parseSongSelect", () => {
    it("reads a SongSelect .txt with a credits header", () => {
        const draft = parseSongSelect(SONGSELECT_TXT, "song.txt")
        expect(draft).not.toBeNull()
        expect(draft!.title).toBe("Made Up Select Song")
        expect(draft!.ccli).toBe("1234567")
        expect(draft!.copyright).toBe("Copyright © 1999 Made Up Music")
        expect(draft!.author).toBe("Jane Maker")
        expect(draft!.parts.map((part) => part.label)).toEqual(["verse", "chorus"])
        expect(draft!.parts[0].text).toBe("First line of the verse\nSecond line of the verse")
        expect(draft!.parts[1].text).toBe("First line of the chorus\nSecond line of the chorus")
    })

    it("still parses a plain .txt without the credits header", () => {
        const draft = parseSongSelect("Plain Pasted Song\nFirst line of the verse\nSecond line of the verse", "plain.txt")
        expect(draft!.title).toBe("Plain Pasted Song")
        expect(draft!.ccli).toBeUndefined()
        expect(draft!.parts).toHaveLength(1)
        expect(draft!.parts[0].label).toBe("verse")
        expect(draft!.parts[0].text).toBe("First line of the verse\nSecond line of the verse")
    })

    it("reads a SongSelect .usr file in the OpenLP-documented layout", () => {
        const draft = parseSongSelect(USR_MAIN, "song.usr")
        expect(draft).not.toBeNull()
        expect(draft!.title).toBe("Made Up Usr Song")
        expect(draft!.ccli).toBe("1234567")
        expect(draft!.author).toBe("Jane Maker, John Smith")
        expect(draft!.copyright).toBe("1999 Made Up Music")
        expect(draft!.parts.map((part) => part.label)).toEqual(["verse", "chorus", "bridge", "pre_chorus", "bridge", "Outro"])
        expect(draft!.parts[0].text).toBe("First line of the verse\nSecond line of the verse")
        expect(draft!.parts[3].text).toBe("Pre line one\nPre line two")
        expect(draft!.parts[5].text).toBe("Outro line one\nOutro line two")
    })

    it("reads a .usr without the A prefix and with / separated authors, skipping empty fields", () => {
        const usr = ["[File]", "[S 7654321]", "Author=Maker, Jane/Smith, John", "Fields=Chorus 1/tVerse 1", "Words=Chorus line one/nChorus line two/t"].join("\n")
        const draft = parseSongSelect(usr, "song.usr")
        expect(draft!.ccli).toBe("7654321")
        expect(draft!.author).toBe("Jane Maker, John Smith")
        expect(draft!.title).toBe("Untitled")
        expect(draft!.parts).toHaveLength(1)
        expect(draft!.parts[0].label).toBe("chorus")
        expect(draft!.parts[0].text).toBe("Chorus line one\nChorus line two")
    })

    it("falls back to plain text for a .usr without the SongSelect header", () => {
        const draft = parseSongSelect("Usr Plain Song\nLine one\nLine two", "plain.usr")
        expect(draft!.title).toBe("Usr Plain Song")
        expect(draft!.parts[0].text).toBe("Line one\nLine two")
    })
})

describe("parseFile", () => {
    it("dispatches .xml files to the OpenLyrics parser", () => {
        const result = parseFile("songs.xml", OPENLYRICS_TWO_SONGS)
        expect(result.error).toBeUndefined()
        expect(result.drafts).toHaveLength(2)
        expect(result.drafts![0].title).toBe("First Made Up Song")
    })

    it("dispatches .cho, .crd, and .chopro files to the ChordPro parser", () => {
        for (const name of ["song.cho", "song.crd", "song.chopro"]) {
            const result = parseFile(name, CHORDPRO_MAIN)
            expect(result.error).toBeUndefined()
            expect(result.draft!.title).toBe("Made Up Chord Song")
            expect(result.draft!.parts).toHaveLength(3)
        }
    })

    it("dispatches .usr, .txt, and .md files to the SongSelect parser", () => {
        expect(parseFile("song.usr", USR_MAIN).draft!.title).toBe("Made Up Usr Song")
        expect(parseFile("song.txt", SONGSELECT_TXT).draft!.title).toBe("Made Up Select Song")
        expect(parseFile("song.md", "Markdown Song\nLine one").draft!.title).toBe("Markdown Song")
    })

    it("reports an error for unsupported types and empty files", () => {
        expect(parseFile("song.mid", "anything")).toEqual({ error: "Unsupported file type" })
        expect(parseFile("empty.xml", "<OPML><body></body></OPML>")).toEqual({ error: "No song found in empty.xml" })
        expect(parseFile("plain.cho", "Just words\nNo markers")).toEqual({ error: "No song found in plain.cho" })
    })
})
