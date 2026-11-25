import type { HymnRecord } from "../types"
import { aMightyFortress } from "./a-mighty-fortress"
import { allHailThePower } from "./all-hail-the-power"
import { amazingGrace } from "./amazing-grace"
import { blessedAssurance } from "./blessed-assurance"
import { comeThouFount } from "./come-thou-fount"
import { holyHolyHoly } from "./holy-holy-holy"
import { howFirmAFoundation } from "./how-firm-a-foundation"
import { itIsWell } from "./it-is-well"
import { justAsIAm } from "./just-as-i-am"
import { rockOfAges } from "./rock-of-ages"
import { whatAFriend } from "./what-a-friend"
import { whenISurvey } from "./when-i-survey"

/**
 * The hymns bundled with this build. One hymn per file, each verified as
 * public domain with a source line and a plain reason (see HYMNS.md).
 */
export const HYMN_RECORDS: HymnRecord[] = [amazingGrace, holyHolyHoly, comeThouFount, whenISurvey, whatAFriend, blessedAssurance, itIsWell, justAsIAm, rockOfAges, aMightyFortress, allHailThePower, howFirmAFoundation]
