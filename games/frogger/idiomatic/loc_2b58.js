// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b58 — IX sprite-object hit-test arm (leaf): raises the hit flag + the global gate when
 * (IX+4)+2 matches the frog row and |(IY+0)[+16 if (IX+5)!=0] - the frog X| < 16. LIVE-OUT: memory-only.
 */
import { loc_8047, loc_8044, loc_8004, loc_842c } from "./names.js";

const ROW_BIAS = 2; // (IX+4) sits two rows above the frog row it must match
const DIR_OFFSET = 0x10; // half-tile bias when the direction bit is set
const HIT_WINDOW = 16;

export function loc_2b58(m) {
  const { regs, mem8 } = m;
  const obj = regs.ix;
  const spr = regs.iy;

  if (mem8[(obj + 0x06) & 0xffff] === 0) return; // inactive
  if (((mem8[(obj + 0x04) & 0xffff] + ROW_BIAS) & 0xff) !== mem8[loc_8047]) return; // wrong row

  let pos = mem8[(spr + 0x00) & 0xffff];
  if (mem8[(obj + 0x05) & 0xffff] !== 0) pos = (pos + DIR_OFFSET) & 0xff;

  const anchor = mem8[loc_8044];
  if (pos < anchor) return;
  if (((pos - anchor) & 0xff) >= HIT_WINDOW) return;

  mem8[loc_8004] = 1;
  mem8[loc_842c] = 1;
}
