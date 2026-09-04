// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT3_SHADOW } from "./names.js";

/**
 * startSound — turn a sound cue ON by raising its bit in the port-3 sound latch.
 *
 * WHAT IT IS
 *   The mw8080bw sound board is driven by two write-only output ports whose current value the CPU
 *   cannot read back, so the game keeps a RAM shadow of each. SOUND_PORT3_SHADOW (0x2094) mirrors
 *   output port 3. This routine ORs the caller's bit mask B into that shadow, stores the new value
 *   back, and writes it to hardware port 3 — turning a cue on while leaving every other already-lit
 *   cue untouched. Its mirror image is clearSoundPort3Bit (0x19dc), which ANDs a mask to turn a cue
 *   off. The port-3 bits are individual sound effects; callers choose which one:
 *     - bit 1 (0x02): player-shot-in-flight tone (updatePlayerShotSound)
 *     - bit 3 (0x08): invader-die tone (queueInvaderKillScore, gated on a game in progress)
 *     - bit 4 (0x10): extra-ship award chime (awardExtraShip)
 *     - bit 5 (0x20): the sound-board amplifier/enable line (not a discrete effect), raised at round start (enterRoundWithFieldReload)
 *   (bit 0 is the saucer sound, driven by the saucer logic.)
 *
 * ROLE IN THE MACHINE
 *   One of the two tiny port-3 bit primitives; every "start this sound" path funnels through it.
 *   Reads/writes SOUND_PORT3_SHADOW (0x2094) and writes hardware output port 0x03.
 *
 * ROM 0x18fa.  Grounding: [seen].
 *
 * LIVE-OUT: A = the resulting latch value (also the returned value), so a caller can inspect it.
 */
export function startSound(m, b = m.regs.b) {
  // OR the requested cue bit(s) into the shadow of port 3 — leaves any other lit cue bits set.
  const v = m.mem8[SOUND_PORT3_SHADOW] | b;
  // Persist the new latch value into the RAM shadow (the CPU cannot read the write-only port back).
  m.mem8[SOUND_PORT3_SHADOW] = v;
  // Mirror the shadow out to hardware sound port 3, actually sounding the cue.
  m.io.portOut(0x03, v);
  // Leave the resulting byte in A as the value-out.
  return (m.regs.a = v);
}
