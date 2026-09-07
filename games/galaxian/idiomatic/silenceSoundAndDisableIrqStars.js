// SPDX-License-Identifier: GPL-3.0-only
/**
 * silenceSoundAndDisableIrqStars — quiesce the audio and video hardware.
 *
 * WHAT IT IS
 *   A board-level "everything off" write burst. It silences the discrete-sound hardware, stops the
 *   per-frame vblank interrupt, stops the hardware starfield, and drives the pitch latch fully high.
 *   All five effects are plain latch writes to the memory-mapped Galaxian I/O ports.
 *
 * ROLE IN THE MACHINE
 *   Called when the machine tears a play session down and drops back toward attract — for example the
 *   state-6 reset tail advanceDwellOrResetToState1 (0x0722) invokes it while resetting GAME_STATE and
 *   the sequence state (see mechanisms.md, the round-loop teardown). Killing the interrupt here is
 *   what freezes the frame service until a later handler re-arms it.
 *
 *   The ports it touches: SOUND_LFO_FREQ (0x6004) is the base of the four discrete-sound LFO-frequency
 *   latches (0x6004-0x6007); SOUND_W_REG0 (0x6800) is the base of the eight sound write registers
 *   (0x6800-0x6807); IRQ_ENABLE (0x7001) gates the vblank interrupt; STARS_ENABLE (0x7004) gates the
 *   scrolling starfield; SOUND_PITCH_W (0x7800) is the sound pitch write latch (its read side is the
 *   watchdog kick).
 *
 * ROM 0x1cb5.  Grounding: [seen] (all five port cells are [seen]).
 *
 * LIVE-OUT: the five hardware latches above. No register contract.
 */
import {
  SOUND_LFO_FREQ, SOUND_W_REG0, SOUND_PITCH_W, IRQ_ENABLE, STARS_ENABLE,
} from "./names.js";

const LFO_LATCHES = 4;
const SOUND_REGS = 8;

export function silenceSoundAndDisableIrqStars(m) {
  const { mem8 } = m;

  // Park the four LFO-frequency latches at 1 (not 0): a nonzero-but-minimal divisor holds the discrete
  // oscillators at rest without the special-case behaviour a zero latch would select.
  for (let i = 0; i < LFO_LATCHES; i++) mem8[SOUND_LFO_FREQ + i] = 1;
  // Zero all eight sound write registers, muting every voice the driver would otherwise be latching.
  for (let i = 0; i < SOUND_REGS; i++) mem8[SOUND_W_REG0 + i] = 0;

  mem8[IRQ_ENABLE] = 0; // stop the vblank interrupt
  mem8[STARS_ENABLE] = 0; // stop the starfield

  mem8[SOUND_PITCH_W] = 255; // pitch latch all bits high
}
