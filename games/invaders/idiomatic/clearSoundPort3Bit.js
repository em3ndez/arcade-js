// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT3_SHADOW } from "./names.js";

/**
 * clearSoundPort3Bit — turn one port-3 sound cue OFF.
 *
 * WHAT IT IS
 *   The "clear this bit" half of the port-3 sound mixer. Port 3 carries the discrete one-shot cues —
 *   the player shot (bit 1), the scoring cue (bit 3), and the flying saucer's continuous whine (bit 0).
 *   Because several independent effects share the one port, the game never composes the byte from
 *   scratch: it keeps a RAM shadow of the latch, edits individual bits in the shadow, and mirrors the
 *   whole byte back out. This routine ANDs the shadow with a caller-supplied mask (bits to KEEP set,
 *   the target cue's bit cleared), writes the result back to the shadow, and re-emits it to the port.
 *
 * ROLE IN THE MACHINE
 *   The mirror image of startSound (0x18fa, the "raise this bit" primitive); together they do all the
 *   port-3 bit work. The shadow is SOUND_PORT3_SHADOW (0x2094) [seen]. Callers pick the bit via the
 *   mask B: stopSaucerSound clears bit 0 (mask 0xfe), clearShotHitAndSilence clears bit 3 / the
 *   invader-die tone (mask 0xf7), the player-shot sound step clears bit 1 (mask 0xfd), and the
 *   fleet-march SFX auto-silence clears bit 4 (mask 0xef).
 *
 * ROM 0x19dc-0x19e5.  Grounding: [seen].
 * LIVE-OUT: A = the resulting shadow byte (also written to SOUND_PORT3_SHADOW and out to port 3).
 */
// AND the sound shadow with B (mask bits off), write it back and mirror to the sound port. Value-out: A.
export function clearSoundPort3Bit(m, b = m.regs.b) {
  // AND the shadow with the keep-mask (the target cue's bit is the 0 in B), and stash it back so the
  // shadow always reflects what the whole mixer is currently doing.
  const v = m.mem8[SOUND_PORT3_SHADOW] & b;
  m.mem8[SOUND_PORT3_SHADOW] = v;
  // Mirror the edited byte out to hardware port 3 (the discrete-cue latch) so the change is audible.
  m.io.portOut(0x03, v);
  // Leave the result in A — startSound does the same, so callers can chain on the latched value.
  return (m.regs.a = v);
}
