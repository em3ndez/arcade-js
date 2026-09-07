// SPDX-License-Identifier: GPL-3.0-only
//
// broadcastSoundLfoLevel (ROM 0x18b2) -- [seen]
//
// WHAT IT IS
//   Save a sound LFO level to its RAM shadow SOUND_LFO_LEVEL (0x421f), then fan that byte across the
//   four discrete-sound LFO frequency latches at SOUND_LFO_FREQ (hardware 0x6004-0x6007), rotating
//   the byte right by one bit between each write so the four latches receive successive rotations of
//   the same value.
//
// ROLE IN THE MACHINE
//   A low-frequency modulation level is layered over the discrete-sound voices and decays over time.
//   Both the decay path (decaySoundLfoLevel, once per 0xff frame tick) and the reset path
//   (driveSoundLfoLevel slamming the full level 15 on a reset request) funnel through here to push a
//   new level to the hardware. The right-rotate spreads one level value into four staggered latch
//   phases, giving the four LFO channels their beat. The default arg mirrors the register convention
//   (A holds the level).
//
// LIVE-OUT: mem8[0x421f] = level; the four latches 0x6004..0x6007 set to successive rrca rotations.
import { SOUND_LFO_LEVEL, SOUND_LFO_FREQ } from "./names.js";

// Four hardware frequency latches, one per LFO channel.
const LATCH_COUNT = 4;

export function broadcastSoundLfoLevel(m, level = m.regs.a) {
  const { mem8 } = m;

  // Keep the RAM shadow of the current level so the per-frame decay can read it back next tick.
  mem8[SOUND_LFO_LEVEL] = level;

  // Walk the four latches, writing the running value and rotating it right one bit each time so each
  // latch gets a different phase of the same level (Z80 rrca: bit 0 wraps up into bit 7).
  let value = level & 0xff;
  for (let i = 0; i < LATCH_COUNT; i++) {
    mem8[SOUND_LFO_FREQ + i] = value;
    value = (value >> 1) | ((value & 1) << 7); // rrca: bit 0 wraps into bit 7
  }
}
