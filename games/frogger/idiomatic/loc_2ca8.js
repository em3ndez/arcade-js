// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2ca8 — IX sprite-object proximity arm (leaf): when the object is active and on the frog's row,
 * flag a hit if its direction-adjusted position lands within a half-tile window ahead of the frog X,
 * marking the object hit-consumed. LIVE-OUT: memory-only.
 */
import { loc_8047, loc_8044, loc_8004 } from "./names.js";

const AHEAD_BIAS = 20; // added to the sprite position when the direction bit is clear
const BEHIND_BIAS = 4; // subtracted when the direction bit is set
const HIT_WINDOW = 16;
const HIT_STATE = 2;

export function loc_2ca8(m) {
  const { regs, mem8 } = m;
  const obj = regs.ix;
  const spr = regs.iy;

  if (mem8[(obj + 0x06) & 0xffff] === 0) return;
  if (mem8[(obj + 0x04) & 0xffff] !== mem8[loc_8047]) return;

  let pos = mem8[(spr + 0x00) & 0xffff];
  pos = mem8[(obj + 0x05) & 0xffff] !== 0 ? (pos - BEHIND_BIAS) & 0xff : (pos + AHEAD_BIAS) & 0xff;

  const anchor = mem8[loc_8044];
  if (pos < anchor) return;
  if (((pos - anchor) & 0xff) >= HIT_WINDOW) return;

  mem8[loc_8004] = 1;
  mem8[(obj + 0x06) & 0xffff] = HIT_STATE;
}
