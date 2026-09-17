// SPDX-License-Identifier: GPL-3.0-only
/** drawRandomByte — draw the next pseudo-random byte. A block of seventeen bytes is a shift
 * register: each byte moves one place along and the vacated head takes the exclusive-or of two taps
 * read AFTER the shift, so the feedback is over the bytes that were seventh and sixteenth. What is
 * handed back is that feedback PLUS the free-running frame counter, so two draws at different
 * moments differ even where the register has not moved. The register IS the state and every draw
 * advances it. LIVE-OUT: the drawn byte, in the accumulator and returned, plus the flags of the
 * add that produced it, plus the shifted block in memory. */

import { u8 } from "../../../core/int.js";
import { F_S, F_Z, F_H, F_F3, F_F5, F_C, F_PV } from "../../../core/cpu/z80.js";
import { FRAME_TICK, RANDOM_REGISTER } from "./names.js";

const REGISTER_BYTES = 17;
const FIRST_TAP = 7;
const SECOND_TAP = 16;

export function drawRandomByte(m) {
  const { regs, mem8 } = m;
  for (let i = REGISTER_BYTES - 1; i > 0; i--) mem8[RANDOM_REGISTER + i] = mem8[RANDOM_REGISTER + i - 1];

  const feedback = mem8[RANDOM_REGISTER + FIRST_TAP] ^ mem8[RANDOM_REGISTER + SECOND_TAP];
  mem8[RANDOM_REGISTER] = feedback;

  // The draw adds the free-running counter to the feedback. The byte is handed back, and its carry,
  // half-carry, sign, zero, even parity and the two high copies are exactly the flags of that add.
  const tick = mem8[FRAME_TICK];
  const sum = feedback + tick;
  const drawn = u8(sum);
  const flags =
    (drawn & 0x80 ? F_S : 0) |
    (drawn === 0 ? F_Z : 0) |
    (drawn & (F_F3 | F_F5)) |
    (sum > 0xff ? F_C : 0) |
    (((feedback ^ tick ^ drawn) & 0x10) ? F_H : 0) |
    ((~(feedback ^ tick) & (feedback ^ drawn) & 0x80) ? F_PV : 0);

  return (regs.a = drawn, regs.f = flags, drawn);
}
