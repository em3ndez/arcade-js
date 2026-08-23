// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { loc_60bc } from "./loc_60bc.js";
import { FLIP_SCREEN_FLAG } from "./names.js";
/**
 * loc_6080 — proximity gate ahead of the hit handler.
 *
 * Measures the axis gaps between the actor (x biased by the flip flag) and the target; too wide
 * on either axis skips the record to the epilogue. Within range, advances the record pointer to
 * its tag and enters the hit handler with that tag as the key.
 *
 * LIVE-OUT: a boolean — true = normal completion, false = a caller-skip must unwind the frame.
 */
const TAG_OFFSET = 0x14;
const X_GAP_LIMIT = 0x09;
const Y_GAP_LIMIT = 0x08;

export function loc_6080(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy) {
  const { mem8 } = m;
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  if (Math.abs(mem8[iy] - ax) >= X_GAP_LIMIT) return loc_60f2(m, hl, ix, count);
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= Y_GAP_LIMIT) return loc_60f2(m, hl, ix, count);
  const rec = u16(hl + TAG_OFFSET);
  return loc_60bc(m, rec, mem8[rec]); // hit: key is the record tag
}
