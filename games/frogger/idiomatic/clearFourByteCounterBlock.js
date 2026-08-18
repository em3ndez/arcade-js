// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearFourByteCounterBlock  —  ROM 0x269a  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The teardown for the home-bay goal-award popup. When the frog reaches one of the five home bays,
 *   the game flashes a floating "200" score popup over that bay to celebrate the goal. The popup is
 *   driven by a 4-byte record, GOAL_AWARD_RECORD (0x805c-0x805f). This routine erases that record —
 *   zeroing all four bytes — so the popup stops rendering once the celebration is over.
 *
 * WHERE IT SITS
 *   The popup's lifetime is timed by a countdown, HOME_GOAL_SPRITE_ARM_CELL (0x8340), which the goal
 *   handler arms to 0xa0 the moment the bay is won (see awardBonusPoints / sub_2673 at ROM 0x2673).
 *   Every in-play frame the collision/input orchestrator ticks that countdown down; on the frame it
 *   drains, orchestrateCollisionsAndFrogInput's interiorTimingArm calls this routine (and its sibling
 *   clearFlySpriteBlock) to retire the popup. So this runs exactly once per home-bay goal, at the end
 *   of the celebration.
 *
 * THE RECORD IT CLEARS
 *   GOAL_AWARD_RECORD (0x805c-0x805f) is written by awardBonusPoints (ROM 0x2673) on a home arrival:
 *   0x805c = the frog's X / bay column (the popup's on-screen position), then the fixed tail bytes
 *   0x19, 0x03, 0x20 at +1/+2/+3. Zeroing byte 0x805c is what actually deactivates the popup; the
 *   other three are cleared to leave the whole record in a clean idle state for the next goal.
 *
 *   NAMING NOTE for a later rename pass: the exported name clearFourByteCounterBlock is a LEGACY,
 *   pre-grounding name from when 0x805c-0x805f was read as a generic "4-byte counter block". MAME
 *   grounding (wave-2 poked home-bay landing + negative control) OVERTURNED that: it is the home-bay
 *   goal-award popup record, not a generic counter. A truer name would be clearGoalAwardRecord. Left
 *   unchanged here because the export is imported by orchestrateCollisionsAndFrogInput and pinned by
 *   the equivalence-269a test; rename it in a dedicated pass, not this comment sweep.
 *
 * LIVE-OUT
 *   Memory only: four zero-writes to 0x805c-0x805f. Takes no register live-in, returns nothing, and
 *   leaves no register the caller reads.
 */
import { GOAL_AWARD_RECORD } from "./names.js";

// The goal-award record is exactly four bytes wide (GOAL_AWARD_RECORD 0x805c through 0x805f).
const RECORD_LEN = 4;

export function clearFourByteCounterBlock(m) {
  const { mem8 } = m;

  // ── Zero the whole goal-award record ─────────────────────────────────────────────────
  // Walk all four bytes of GOAL_AWARD_RECORD (0x805c-0x805f) and clear them. In the ROM this is the
  // classic "XOR A; LD (HL),A / INC HL" run at 0x269d-0x26a5 — accumulator forced to 0, then stored
  // into each successive cell. Byte 0x805c is the popup's live/position flag, so clearing it stops the
  // "200" popup drawing; clearing +1/+2/+3 as well retires the fixed tail and leaves the record idle
  // and ready to be re-seeded on the next home-bay goal.
  for (let i = 0; i < RECORD_LEN; i++) mem8[GOAL_AWARD_RECORD + i] = 0;
}
