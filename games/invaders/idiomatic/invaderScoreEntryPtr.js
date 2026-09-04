// SPDX-License-Identifier: GPL-3.0-only
import { INVADER_SCORE_TABLE } from "./names.js";

/**
 * invaderScoreEntryPtr — point HL at the killed invader's score-table entry.
 *
 * WHAT IT IS
 *   Turns an invader-tier key in A into a pointer into the three-entry score table at INVADER_SCORE_TABLE. The
 *   accumulator is clamp-indexed into one of three consecutive slots: A<2 selects slot 0, 2<=A<4 selects
 *   slot 1, and A>=4 selects slot 2. Space Invaders has three invader point tiers, so the five grid rows
 *   collapse onto three score values through this clamp.
 *
 * ROLE IN THE MACHINE
 *   Its consumer is queueInvaderKillScore (0x1554-area kill-score cue): when a player shot kills an
 *   alien, that routine calls this with the alien-tier key in B, then reads the byte at the returned
 *   pointer into SCORE_ADD_VALUE (0x20f2) — the point value queued into the pending score-add packet.
 *   The table itself (INVADER_SCORE_TABLE) holds the three per-tier point values.
 *
 * ROM 0x097c.  Grounding: [seen].
 *
 * LIVE-OUT: HL = INVADER_SCORE_TABLE + {0,1,2}, the selected score-table entry (also the routine's return value).
 */
export function invaderScoreEntryPtr(m, a = m.regs.a) {
  // Clamp A onto the three-tier score table: >=4 -> +2, 2..3 -> +1, else +0, and return that pointer.
  return (m.regs.hl = INVADER_SCORE_TABLE + (a >= 0x04 ? 2 : a >= 0x02 ? 1 : 0));
}
