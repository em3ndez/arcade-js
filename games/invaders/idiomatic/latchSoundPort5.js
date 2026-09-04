// SPDX-License-Identifier: GPL-3.0-only

/**
 * latchSoundPort5 — emit the two high (latched) sound-select bits to port 5.
 *
 * WHAT IT IS
 *   A bare helper that masks the accumulator down to its two high sound-select bits (mask 0x30) and
 *   writes the result to output port 5. Port 5 carries the fleet-march "footsteps" (its low nibble)
 *   and the saucer-hit tone (bit 4). This routine touches only the two high bits, used when code wants
 *   to emit those latched high bits directly without disturbing the march tones.
 *
 * ROLE IN THE MACHINE
 *   A secondary entry into the loc_176d body: `call 0x1770` (from 0x0753) lands here, skipping the
 *   leading `lda` that the full routine would run. silenceFleetMarchNote is the same tail but reads its
 *   byte from the port-5 shadow (SOUND_PORT5_SHADOW, 0x2098) first. Keeping the saucer-hit tone in the
 *   0x30 band that the fleet-march routines preserve is what lets the march rotate its low nibble
 *   without ever clobbering a saucer-hit that is still ringing.
 *
 * ROM 0x1770-0x1774.  Grounding: [seen].
 * LIVE-OUT: output port 5 (the latch). The idiomatic body writes only the port; it does not update A.
 */
// Mask the accumulator to its two sound-select bits and latch it to the sound port. Live-out: the port.
export function latchSoundPort5(m, a = m.regs.a) {
  // Keep only the two high sound-select bits (0x30) and drive them onto port 5's latch.
  m.io.portOut(0x05, a & 0x30);
}
