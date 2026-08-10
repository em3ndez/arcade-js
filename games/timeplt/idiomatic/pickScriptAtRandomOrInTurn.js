// SPDX-License-Identifier: GPL-3.0-only
/** pickScriptAtRandomOrInTurn — draw a byte and let one comparison against SCRIPT_PICK_THRESHOLD decide
 * between two answers: at or above the threshold, fold the draw down to one of four values in a band and
 * return it; below it, ignore the draw and return the next entry of a five-long round-robin counter
 * (stepped and wrapped). LIVE-OUT: the answer in A (returned), plus the counter on the second path. */

import { u8 } from "../../../core/int.js";
import { drawRandomByte } from "./drawRandomByte.js";
import { SCRIPT_PICK_THRESHOLD } from "./names.js";

const CYCLE_COUNTER = 0xa9cf;

const BAND_SIZE = 4;
const FIRST_IN_BAND = 5;
const CYCLE_LENGTH = 5;

export function pickScriptAtRandomOrInTurn(m) {
  const { regs, mem8 } = m;
  const drawn = drawRandomByte(m);

  if (drawn >= mem8[SCRIPT_PICK_THRESHOLD]) {
    regs.a = (drawn % BAND_SIZE) + FIRST_IN_BAND;
    return regs.a;
  }

  const stepped = u8(mem8[CYCLE_COUNTER] + 1);
  regs.a = stepped < CYCLE_LENGTH ? stepped : 0;
  mem8[CYCLE_COUNTER] = regs.a;
  return regs.a;
}
