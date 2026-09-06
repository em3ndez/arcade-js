// SPDX-License-Identifier: GPL-3.0-only
// Recompute a staged pitch from the sound counter cell: on an odd selector, bias it by 96 and rotate the
// biased sum right (the add's carry rotates into the top bit); on an even selector, pass it through. Stage it.
import { loc_41c4 } from "./names.js";
import { stageSoundPitch } from "./stageSoundPitch.js";

export function stagePitchFromSoundCounter(m, selector = m.regs.a) {
  const { mem8 } = m;

  let value = mem8[loc_41c4];
  if (selector & 0x01) {
    const sum = value + 96;
    const carryIn = sum > 255 ? 128 : 0; // the add's carry rotates back into bit 7
    value = carryIn | ((sum & 0xff) >> 1);
  }
  return stageSoundPitch(m, value);
}
