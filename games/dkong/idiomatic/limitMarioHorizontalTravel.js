// SPDX-License-Identifier: GPL-3.0-only
/**
 * limitMarioHorizontalTravel — classify Mario's X into a two-flag verdict the movement code
 * uses to clamp X and gate walk direction. Read-only leaf; all compares unsigned.
 *
 * LIVE-OUT: the verdict pair, both returned and mirrored into regs.d/regs.e.
 */
import { MARIO_X, MARIO_Y, BOARD } from "./names.js";

export function limitMarioHorizontalTravel(m) {
  const { regs, mem8 } = m;
  const x = mem8[MARIO_X];

  let d, e;
  if (x < 0x16) {
    d = 1; e = 0;
  } else if (x >= 0xea) {
    d = 0; e = 1;
  } else if ((mem8[BOARD] & 0x01) === 0) {
    d = 0; e = 0;
  } else if (mem8[MARIO_Y] >= 0x58) {
    d = 0; e = 0;
  } else if (x >= 0x6c) {
    d = 0; e = 0;
  } else {
    d = 1; e = 0;
  }

  regs.d = d;
  regs.e = e;
  return { d, e };
}
