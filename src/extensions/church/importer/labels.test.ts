import { describe, expect, it } from "vitest"
import { detectPartLabel, extractCredits, proposeTitle } from "./labels"

describe("part label detection", () => {
    it("reads ALL CAPS headings into the FreeShow group", () => {
        expect(detectPartLabel("VERSE 1")).toBe("verse")
        expect(detectPartLabel("CHORUS")).toBe("chorus")
        expect(detectPartLabel("CHORUS 1")).toBe("chorus")
        expect(detectPartLabel("PRE-CHORUS")).toBe("pre_chorus")
        expect(detectPartLabel("BRIDGE")).toBe("bridge")
        expect(detectPartLabel("TAG")).toBe("tag")
        expect(detectPartLabel("INTRO")).toBe("intro")
        expect(detectPartLabel("ENDING")).toBe("outro")
        expect(detectPartLabel("INSTRUMENTAL")).toBe("break")
        expect(detectPartLabel("VERSE 2: x2")).toBe("verse")
        expect(detectPartLabel("GLORY")).toBeNull()
    })

    it("reads title case headings", () => {
        expect(detectPartLabel("Verse 1")).toBe("verse")
        expect(detectPartLabel("Chorus")).toBe("chorus")
        expect(detectPartLabel("Bridge")).toBe("bridge")
        expect(detectPartLabel("Tag")).toBe("tag")
        expect(detectPartLabel("Pre-Chorus")).toBe("pre_chorus")
    })

    it("reads single-letter shorthand and ignores unknown letters", () => {
        expect(detectPartLabel("V")).toBe("verse")
        expect(detectPartLabel("V1")).toBe("verse")
        expect(detectPartLabel("C")).toBe("chorus")
        expect(detectPartLabel("C1")).toBe("chorus")
        expect(detectPartLabel("B")).toBe("bridge")
        expect(detectPartLabel("T")).toBe("tag")
        expect(detectPartLabel("P")).toBe("pre_chorus")
        expect(detectPartLabel("I")).toBe("intro")
        expect(detectPartLabel("X")).toBeNull()
    })

    it("reads Proclaim curly-bracket labels and keeps custom ones", () => {
        expect(detectPartLabel("{Verse 2}")).toBe("verse")
        expect(detectPartLabel("{My Label}")).toBe("My Label")
        expect(detectPartLabel("{}")).toBeNull()
    })

    it("reads square-bracket labels and keeps chords out", () => {
        expect(detectPartLabel("[Verse]")).toBe("verse")
        expect(detectPartLabel("[Chorus]")).toBe("chorus")
        expect(detectPartLabel("[My Label]")).toBe("My Label")
        expect(detectPartLabel("[C]")).toBeNull()
        expect(detectPartLabel("[G7]")).toBeNull()
        expect(detectPartLabel("[Am/C]")).toBeNull()
    })

    it("reads colon headings for known words only", () => {
        expect(detectPartLabel("Intro:")).toBe("intro")
        expect(detectPartLabel("Verse 1:")).toBe("verse")
        expect(detectPartLabel("Glory:")).toBeNull()
    })

    it("leaves lyric lines alone", () => {
        expect(detectPartLabel("And I said hey")).toBeNull()
        expect(detectPartLabel("")).toBeNull()
        expect(detectPartLabel("   ")).toBeNull()
        expect(detectPartLabel("This line is way too long to be a heading, it goes on and on")).toBeNull()
    })
})

describe("credit lines", () => {
    it("pulls the CCLI number from a short line", () => {
        expect(extractCredits(["CCLI: 1234567"]).credits.ccli).toBe("1234567")
        expect(extractCredits(["CCLI #1234567"]).credits.ccli).toBe("1234567")
    })

    it("notes public domain, copyright, and author lines", () => {
        expect(extractCredits(["Public Domain"]).credits.publicDomain).toBe(true)
        expect(extractCredits(["© 1999 Made Up Music"]).credits.copyright).toBe("© 1999 Made Up Music")
        expect(extractCredits(["(c) 1999 Made Up Music"]).credits.copyright).toBe("(c) 1999 Made Up Music")
        expect(extractCredits(["Copyright 1999 Made Up Music"]).credits.copyright).toBe("Copyright 1999 Made Up Music")
        expect(extractCredits(["Author: Jane Doe"]).credits.author).toBe("Jane Doe")
        expect(extractCredits(["Written by Jane Doe"]).credits.author).toBe("Jane Doe")
        expect(extractCredits(["Composer: Jane Doe"]).credits.author).toBe("Jane Doe")
    })

    it("reports which lines are credits", () => {
        const { credits, creditIndexes } = extractCredits(["Amazing", "CCLI: 1234567", "Author: Jane Doe", "VERSE 1"])
        expect(creditIndexes).toEqual([1, 2])
        expect(credits.ccli).toBe("1234567")
        expect(credits.author).toBe("Jane Doe")
        expect(credits.publicDomain).toBeUndefined()
    })

    it("does not treat a long lyric line that mentions ccli as a credit", () => {
        const long = `The choir sang about ccli ${"x".repeat(55)} 123`
        expect(long.length).toBeGreaterThan(60)
        const { credits, creditIndexes } = extractCredits([long])
        expect(creditIndexes).toEqual([])
        expect(credits.ccli).toBeUndefined()
    })
})

describe("title proposal", () => {
    it("takes the first line that is not a label or a credit", () => {
        expect(proposeTitle("Amazing Grace\nVERSE 1\nBy the rivers")).toBe("Amazing Grace")
        expect(proposeTitle("CCLI: 1234567\nAmazing Grace\nVERSE 1")).toBe("Amazing Grace")
        expect(proposeTitle("VERSE 1\nAmazing Grace\nBy the rivers")).toBe("Amazing Grace")
    })

    it("falls back to the file name, then Untitled", () => {
        expect(proposeTitle("VERSE 1\nCHORUS", "my song.txt")).toBe("my song")
        expect(proposeTitle("VERSE 1\nCHORUS")).toBe("Untitled")
        expect(proposeTitle("")).toBe("Untitled")
    })

    it("cuts a long title at a word boundary", () => {
        expect(proposeTitle("This Is A Really Long Worship Song Title")).toBe("This Is A Really Long Worship")
        expect(proposeTitle("Amazing Grace.")).toBe("Amazing Grace")
    })
})
