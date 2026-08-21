// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3278 } from "./loc_3278.js";
import { HUNTER_COUNTER_PAGE, BOARD_CLEAR_FLAG } from "./names.js";
/**
 * loc_324d — per-slot hunter-return tick.
 *
 * A slot whose field-0 is below the threshold is skipped. Otherwise a paced counter on the
 * hunter page (indexed by field-0 + 5) is dropped by one step (0x40); on no borrow it returns.
 * On a borrow the paired byte one cell up is decremented, and if the board-clear flag is set it
 * tail-calls the board tile-sum check (whose result it returns unchanged).
 *
 * LIVE-OUT: none on the ordinary paths (the scan caller's loop counter is preserved); the
 * board-clear tail-call forwards the check's own register result.
 */

const RETURN_THRESHOLD = 0x40; // field-0 gate; also the per-tick counter step
const COUNTER_INDEX_BIAS = 0x05;

export function loc_324d(m, rec = m.regs.ix) {
  const { mem8 } = m;
  const slot = mem8[rec];
  if (slot < RETURN_THRESHOLD) return;

  const counter = HUNTER_COUNTER_PAGE | ((slot + COUNTER_INDEX_BIAS) & 0xff);
  const before = mem8[counter];
  mem8[counter] = (before - RETURN_THRESHOLD);
  if (before >= RETURN_THRESHOLD) return; // no borrow: counter still has time

  const paired = u16(counter + 1);
  mem8[paired] = (mem8[paired] - 1);
  if (mem8[BOARD_CLEAR_FLAG] !== 0) return loc_3278(m); // board clearing: run the tile-sum check
}
