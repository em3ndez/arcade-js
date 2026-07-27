// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0278 — round/state-boundary dispatcher: dock the active player's man count,
 * persist their record, then hand off to next-round setup or end-of-round teardown.
 * ROM 0x0278.
 *
 * Reached at a round boundary — by round-init fall-through (loc_022d) and when a
 * per-frame timer or counter expires (loc_13c9, loc_3458). It first guards on the
 * mode/player byte: any value of 3 or more means there is no live 1-or-2-player
 * round to wind down, so it hands straight to the reset epilogue and touches nothing.
 *
 * Otherwise it docks one from the active player's working man count and saves the
 * whole player record (level, round counters, score, and this new man count) into
 * that player's backup, so their progress survives the turn switch. Then it splits
 * on the mode/player byte:
 *   - value 1  — clear the other player's backup man count, arm the phase byte, and
 *     pick the destination by whether this player still has men in reserve: some
 *     left routes to the next-round setup, none left to the end-of-round teardown.
 *   - anything else (2, i.e. the second leg) — defer to a separate phase sequencer
 *     that steps the phase byte and reaches the same two destinations.
 *
 * It has no return of its own: every exit is a tail hand-off, and the successor's
 * own return carries loc_0278's caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0278.test.js.
 * GATE:     crafted-entry — the one real attract dispatch (frame 0, mode >= 3) drives
 *           the bail arm; the other three arms run from that same captured state with
 *           the mode/condition bytes poked identically on both sides. The tail successors
 *           are now idiomatic (loc_03ac / loc_02a1 / loc_02ca / submitHighScoresAndReset),
 *           called directly, so both sides run the real successor chain and converge at
 *           the true oracle leaves (0x031a setup / 0x01f9 reset), which are stubbed
 *           identically on both sides; the whole chain's RAM is diffed. TEETH: a twin
 *           that skips the dock and a twin that picks the wrong destination.
 * LIVE-OUT: memory-only — the docked man count MEN_LEFT, the player record persisted by
 *           saveActivePlayerRecord, and 0x802d / 0x8002 on the mode == 1 arm. No
 *           register or flag is read by any successor, and the routine has no ret.
 * NAMES:    GAME_MODE 0x8001, GAME_STATE2 0x8002, MEN_LEFT 0x802b (ram.js). Kept hex:
 *           0x802c / 0x802d = the two players' backup copies of the working man count
 *           (field 1 of the player record based at 0x8028) — no ram.js names yet.
 */

import { GAME_MODE, GAME_STATE2, MEN_LEFT } from "./ram.js";
import { saveActivePlayerRecord } from "./saveActivePlayerRecord.js";
import { loc_03ac } from "./loc_03ac.js";
import { loc_02a1 } from "./loc_02a1.js";
import { loc_02ca } from "./loc_02ca.js";
import { submitHighScoresAndReset } from "./submitHighScoresAndReset.js";

export function loc_0278(m) {
  const { mem8 } = m;

  // No live 1-or-2-player round to wind down: hand straight to the reset epilogue.
  if (mem8[GAME_MODE] >= 3) return loc_03ac(m);

  // Dock one man from the active player's working count, then persist their whole
  // record (including this new count) into their backup so it survives the turn switch.
  mem8[MEN_LEFT] = mem8[MEN_LEFT] - 1; // working man count (field 1 of the player record)
  saveActivePlayerRecord(m);

  // The second leg (mode 2) runs its own phase sequencer to reach the destinations.
  if (mem8[GAME_MODE] !== 1) return loc_02a1(m);

  // First leg: clear the other player's backup man count and arm the phase byte, then
  // route by whether this player still has men in reserve.
  mem8[0x802d] = 0; // the other player's backup man count
  mem8[GAME_STATE2] = 1;
  if (mem8[0x802c] !== 0) return loc_02ca(m); // men left -> set up the next round
  return submitHighScoresAndReset(m); // none left -> end-of-round teardown
}
