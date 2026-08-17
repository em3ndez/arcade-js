// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetFrogObject — reset the frog object block and its state flags.
 *
 * Writes the four object bytes, clears four state cells, sets the ready flag.
 * LIVE-OUT: memory + A (the ready-flag value, consumed by the render caller).
 */
import { FROG_X, FROG_STATE_DEMO_FLAG, loc_842d, loc_842c, FROG_FURTHEST_ROW, FROG_READY_FLAG } from "./names.js";

const OBJECT_INIT = [128, 30, 3, 224];

export function resetFrogObject(m) {
  const { mem8 } = m;
  for (let i = 0; i < OBJECT_INIT.length; i++) mem8[(FROG_X + i)] = OBJECT_INIT[i];
  mem8[FROG_STATE_DEMO_FLAG] = 0;
  mem8[loc_842d] = 0;
  mem8[loc_842c] = 0;
  mem8[FROG_FURTHEST_ROW] = 0;
  mem8[FROG_READY_FLAG] = 1;
  m.regs.a = 1;
}
