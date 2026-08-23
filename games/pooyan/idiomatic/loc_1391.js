// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_12d0 } from "./loc_12d0.js";

/**
 * loc_1391 — spawned-flag guard in front of the field-compare dispatch.
 *
 * If the block's flag field has bit 0 set the block is already handled: return doing nothing,
 * leaving the accumulator as it entered. Otherwise hand off (tail) to the field-compare dispatch,
 * whose result becomes this routine's result.
 *
 * LIVE-OUT: A — forwarded from the tail on the dispatch path; unchanged on the guard path.
 */

const FLAG_FIELD = 0x08; // block offset of the spawned-flag byte

export function loc_1391(m, block = m.regs.ix) {
  const { mem8 } = m;
  if (mem8[u16(block + FLAG_FIELD)] & 1) return; // bit0 set -> already handled
  return loc_12d0(m); // tail: its result is ours
}
