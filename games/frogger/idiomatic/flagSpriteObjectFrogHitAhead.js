// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagSpriteObjectFrogHitAhead — IX sprite-object proximity arm (leaf): when the object is active and on the frog's row,
 * flag a hit if its direction-adjusted position lands within a half-tile window ahead of the frog X,
 * marking the object hit-consumed. LIVE-OUT: memory-only.
 */
import { FROG_Y, FROG_X, HOLD_FLAG } from "./names.js";

const AHEAD_BIAS = 20; // added to the sprite position when the direction bit is clear
const BEHIND_BIAS = 4; // subtracted when the direction bit is set
const HIT_WINDOW = 16;
const HIT_STATE = 2;

export function flagSpriteObjectFrogHitAhead(m) {
  const { regs, mem8 } = m;
  const obj = regs.ix;
  const spr = regs.iy;

  if (mem8[(obj + 0x06)] === 0) return;
  if (mem8[(obj + 0x04)] !== mem8[FROG_Y]) return;

  let pos = mem8[(spr + 0x00)];
  pos = mem8[(obj + 0x05)] !== 0 ? (pos - BEHIND_BIAS) & 0xff : (pos + AHEAD_BIAS) & 0xff;

  const anchor = mem8[FROG_X];
  if (pos < anchor) return;
  if (((pos - anchor) & 0xff) >= HIT_WINDOW) return;

  mem8[HOLD_FLAG] = 1;
  mem8[(obj + 0x06)] = HIT_STATE;
}
