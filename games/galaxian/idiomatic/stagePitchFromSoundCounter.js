// SPDX-License-Identifier: GPL-3.0-only
//
// stagePitchFromSoundCounter -- ROM 0x180c. Grounding: [seen].
//
// WHAT IT IS
//   Recomputes a staged sound pitch from the sweep voice's counter cell and stages it. This is the nonzero
//   branch of the pitch selector (stageSoundPitchBySelector, 0x1801), reached when the sweep cell's low two
//   bits are set; the selector's parity picks between a plain pass-through and a "warble".
//
// ROLE IN THE MACHINE
//   The sweep voice keeps a running counter in loc_41c4 (0x41c4). On an ODD selector this routine biases
//   that counter by 96 and rotates the biased sum right -- with the addition's carry-out folding back into
//   the top bit -- producing the characteristic Galaxian pitch warble. On an EVEN selector the counter
//   passes straight through unchanged. Either way the result is handed to stageSoundPitch (0x1815), which
//   parks it in SOUND_PITCH (0x41c1) for the per-frame driver to latch out to the pitch port (0x7800).
//
// LIVE-OUT
//   SOUND_PITCH (0x41c1) written via stageSoundPitch; no cells written directly here.
import { loc_41c4 } from "./names.js";
import { stageSoundPitch } from "./stageSoundPitch.js";

export function stagePitchFromSoundCounter(m, selector = m.regs.a) {
  const { mem8 } = m;

  // Start from the live sound counter value.
  let value = mem8[loc_41c4];
  // Odd selector: apply the warble. Bias by 96, then rotate-right the 9-bit biased sum: the carry (bit 8)
  // becomes bit 7 of the result and the low byte shifts down one, matching the Z80 `add` + `rra` pair.
  if (selector & 0x01) {
    const sum = value + 96;
    const carryIn = sum > 255 ? 128 : 0; // the add's carry rotates back into bit 7
    value = carryIn | ((sum & 0xff) >> 1);
  }
  // Stage the final pitch (warbled on odd, pass-through on even) into SOUND_PITCH.
  return stageSoundPitch(m, value);
}
