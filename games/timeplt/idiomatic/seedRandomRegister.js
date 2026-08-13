// SPDX-License-Identifier: GPL-3.0-only
/** seedRandomRegister — seed the random register from a fixed seventeen-byte run of program space, then
 * check the image the run came out of. The check adds three bytes taken from two fixed words of
 * program space to one constant; the constant is chosen so a sound image brings the total round to
 * zero exactly, and any other total means the program space this is reading is not the one the
 * constant was picked for. On that outcome nothing further is done here and the run is abandoned.
 * LIVE-OUT: memory — the seventeen seed bytes — plus the zero the total comes to. */

import { u8 } from "../../../core/int.js";
import { RANDOM_REGISTER, RANDOM_REGISTER_SEED_SOURCE, RANDOM_SEED_GUARD_WORD0, RANDOM_SEED_GUARD_WORD1 } from "./names.js";

const SEED_BYTES = 17;
const GUARD_BIAS = 0x44;

export function seedRandomRegister(m) {
  const { mem8, mem16, regs } = m;
  for (let i = 0; i < SEED_BYTES; i++) mem8[RANDOM_REGISTER + i] = mem8[RANDOM_REGISTER_SEED_SOURCE + i];

  const a = mem16[RANDOM_SEED_GUARD_WORD0];
  const b = mem16[RANDOM_SEED_GUARD_WORD1];
  regs.a = u8((a & 0xff) + (a >> 8) + (b & 0xff) + GUARD_BIAS);
  if (regs.a !== 0) {
    throw new Error(
      `guard total ${regs.a} rather than zero: the program space this run is reading is not the ` +
        "one the guard constant was picked for, and control goes nowhere that exists",
    );
  }
}
