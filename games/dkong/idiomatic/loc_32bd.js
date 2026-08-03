// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_32bd — a three-way object-walker dispatch keyed on the current board.  ROM 0x32BD.
 *
 * Reads BOARD once and routes to one of three object-position handlers with no range check:
 *
 *   • BOARD == 1 -> loc_342c (the flat-table walker: start/resume one object's scripted walk).
 *   • BOARD == 2 -> loc_3478 (its direction-selected twin).
 *   • anything else (0, 3, or any value >= 3) -> loc_34b9 (the two-table record seeder, which
 *     itself does nothing on board 3).
 *
 * The board byte is loaded a SINGLE time and both equality tests read that same value — the
 * ROM never reloads it between the two compares, so an intervening write could not change the
 * decision. The board value is used only to choose the arm; it is not otherwise interpreted,
 * and each callee re-reads whatever board/record state it needs for itself.
 *
 * The object-record pointer the callees walk is a live-in the caller supplies; this routine
 * neither reads nor changes it, so there is no register marshalling to do before the direct
 * calls — each callee reads its own inputs (the record pointer, BOARD, MARIO_X, SPIN_COUNT)
 * straight from where they already are.
 *
 * DISPATCHED IN ATTRACT: it is reached during boot/attract (the object-walker subtree runs
 * there), but only ever on the 25m board, so real captures exercise the BOARD == 1 -> loc_342c
 * arm alone; the BOARD == 2 and default arms are reached only by crafted entries.
 *
 * NAME: kept the neutral loc_ — the mechanism (a board-keyed three-way walker dispatch) is
 * pinned to the oracle, but which object/cutscene this drives is not corroborated to the
 * routine-name bar. Promote once grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-32bd.test.js.
 * GATE:     strict memory-equivalence — the board selector is swept crafted-exhaustive over all
 *           256 values against the frozen oracle, on bases where the three arms leave distinct
 *           record footprints, plus fresh/resume walk state and both MARIO_X halves so each
 *           callee's own sub-arms are exercised through the dispatch; and every real captured
 *           0x32BD attract dispatch (all board 1) is confirmed identical. The RAM diff excludes
 *           the dead STACK_SCRATCH the oracle's per-arm push16/ret churn writes. Teeth: swapped
 *           1<->2 arms, a dropped default arm, and an off-by-one selector.
 * LIVE-OUT: memory-only — the dispatch's whole effect is what the chosen callee writes to the
 *           object record; the oracle's residual registers/flags and its per-arm terminal ret
 *           are dead ABI (the three direct calls replace the push16/ret call brackets).
 * NAMES:    BOARD (0x6227) from ram.js — the only cell this routine reads. loc_342c (ROM
 *           0x342C), loc_3478 (ROM 0x3478), loc_34b9 (ROM 0x34B9) — all already idiomatic and
 *           direct-called.
 */

import { BOARD } from "./ram.js";
import { loc_342c } from "./loc_342c.js"; // ROM 0x342C — flat-table object walker
import { loc_3478 } from "./loc_3478.js"; // ROM 0x3478 — direction-selected twin walker
import { loc_34b9 } from "./loc_34b9.js"; // ROM 0x34B9 — two-table record seeder

/**
 * @param {object} m  the machine (uses m.mem and, via the callees, m.regs).
 * @returns {void}
 */
export function loc_32bd(m) {
  const board = m.mem.read8(BOARD);

  if (board === 0x01) {
    loc_342c(m);
    return;
  }
  if (board === 0x02) {
    loc_3478(m);
    return;
  }
  // Default arm: every other board value (including 0 and >= 3).
  loc_34b9(m);
}
