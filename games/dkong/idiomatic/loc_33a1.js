// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33a1 — head guard of the fire's ladder-climb path: a per-board applicability gate, then a
 * height test that abandons the path once the object rises above the 89-pixel line. A closed gate
 * returns true (the caller sees a normal early return); below the threshold returns false (caller-skip).
 *
 * LIVE-OUT: the caller-skip boolean, and nothing else.
 */

import { boardBitGate } from "./boardBitGate.js";

const BOARDS_25M_50M_75M = 0x07;
const RECORD_Y_BASE = 0x0f;
const ABANDON_ABOVE_Y = 89;

export function loc_33a1(m, ix = m.regs.ix) {
  const { regs, mem8 } = m;

  regs.a = BOARDS_25M_50M_75M;
  if (!boardBitGate(m)) return true;

  return mem8[ix + RECORD_Y_BASE] >= ABANDON_ABOVE_Y;
}
