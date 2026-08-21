// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_COMMAND_LATCH, AUDIO_IRQ_LATCH } from "./names.js";
/**
 * sendSoundCommand — hand a sound command to the audio CPU.
 *
 * Latches the command byte at the sound port, then strobes the audio-IRQ latch bit high and back
 * low, which interrupts the sound CPU into reading the byte. The strobe's pulse width is a bare
 * timing delay with no state, so it drops out of the idiomatic form.
 *
 * LIVE-OUT: memory only (the sound latch + the audio-IRQ pulse). A ends 0, but no caller reads it.
 */
export function sendSoundCommand(m, command = m.regs.a) {
  const { mem8 } = m;

  mem8[SOUND_COMMAND_LATCH] = command;
  mem8[AUDIO_IRQ_LATCH] = 1; // raise audio-IRQ (LS259 bit 1)
  mem8[AUDIO_IRQ_LATCH] = 0; // lower it
}
