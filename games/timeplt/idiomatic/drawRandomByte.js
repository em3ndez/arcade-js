// SPDX-License-Identifier: GPL-3.0-only
/** drawRandomByte — draw the next pseudo-random byte. A block of seventeen bytes is a shift
 * register: each byte moves one place along and the vacated head takes the exclusive-or of two taps
 * read AFTER the shift, so the feedback is over the bytes that were seventh and sixteenth. What is
 * handed back is that feedback PLUS the free-running frame counter, so two draws at different
 * moments differ even where the register has not moved. The register IS the state and every draw
 * advances it. LIVE-OUT: the drawn byte, in the accumulator and returned, plus the shifted block. */

import { u8 } from "../../../core/int.js";
import { FRAME_TICK, RANDOM_REGISTER } from "./names.js";

const REGISTER_BYTES = 17;
const FIRST_TAP = 7;
const SECOND_TAP = 16;

export function drawRandomByte(m) {
  const { regs, mem8 } = m;
  for (let i = REGISTER_BYTES - 1; i > 0; i--) mem8[RANDOM_REGISTER + i] = mem8[RANDOM_REGISTER + i - 1];

  const feedback = mem8[RANDOM_REGISTER + FIRST_TAP] ^ mem8[RANDOM_REGISTER + SECOND_TAP];
  mem8[RANDOM_REGISTER] = feedback;

  regs.a = u8(feedback + mem8[FRAME_TICK]);
  return regs.a;
}
