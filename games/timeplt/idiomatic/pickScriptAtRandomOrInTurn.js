// SPDX-License-Identifier: GPL-3.0-only
/** pickScriptAtRandomOrInTurn — draw a byte and let it decide, by one comparison against a threshold cell, which of
 * two entirely different answers the caller gets. A draw at or above the threshold is folded down
 * to one of four values in a small band and handed straight back, writing nothing. A draw below
 * it ignores the drawn byte completely: a five-long cycle counter is stepped on, wrapping back to
 * zero once it would leave the cycle, stored, and IT is handed back instead. So the threshold
 * decides whether the answer is random or a round-robin, and it is the only thing that does.
 * LIVE-OUT: the answer, in the accumulator and returned, plus the counter on the second path. */

import { u8 } from "../../../core/int.js";
import { drawRandomByte } from "./drawRandomByte.js";

const THRESHOLD = 0xacc4;
const CYCLE_COUNTER = 0xa9cf;

const BAND_SIZE = 4;
const FIRST_IN_BAND = 5;
const CYCLE_LENGTH = 5;

export function pickScriptAtRandomOrInTurn(m) {
  const { regs, mem8 } = m;
  const drawn = drawRandomByte(m);

  if (drawn >= mem8[THRESHOLD]) {
    regs.a = (drawn % BAND_SIZE) + FIRST_IN_BAND;
    return regs.a;
  }

  const stepped = u8(mem8[CYCLE_COUNTER] + 1);
  regs.a = stepped < CYCLE_LENGTH ? stepped : 0;
  mem8[CYCLE_COUNTER] = regs.a;
  return regs.a;
}
