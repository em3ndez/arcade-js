// SPDX-License-Identifier: GPL-3.0-only
//
// advancePulseToneEnvelope (ROM 0x184f, [seen]) -- one frame of the pulse-tone sound envelope.
//
// WHAT IT IS
//   A per-frame tick of a two-byte decrementing "envelope word" that shapes one of Galaxian's sound
//   voices. It is one of the fixed-order updaters the sound driver driveSoundFrame (ROM 0x170c slot)
//   runs each frame; every voice may leave its mark on the staged pitch shadow before the driver latches
//   the composed bytes to the sound hardware. (mechanisms.md, "The pulse-tone envelope".)
//
// ROLE IN THE MACHINE
//   The envelope word is loc_41c7 (low byte) / loc_41c8 (high byte). Bit0 of the low byte is the
//   done/restart flag. Clear -> the envelope is still running, so hand the high byte to the countdown
//   pulse processor pulseSoundToneFromCountdown (ROM 0x185e), which decrements it and stages the pulsed
//   tone into SOUND_PITCH. Set -> re-arm the word to its 0x8000 sentinel (low = 0, high = 128) so the
//   envelope starts over.
//
// LIVE-OUT: loc_41c7/loc_41c8 word; on the running path, SOUND_PITCH via the delegate.
import { pulseSoundToneFromCountdown } from "./pulseSoundToneFromCountdown.js";
import { loc_41c7, loc_41c8 } from "./names.js";

export function advancePulseToneEnvelope(m) {
  const { mem8 } = m;

  // Low-byte bit0 clear: the envelope is still active. Hand the high byte to the countdown pulse
  // processor, which ticks it down and stages the pulsed tone for this frame.
  if ((mem8[loc_41c7] & 0x01) === 0) {
    // bit0 clear: process the high byte
    return pulseSoundToneFromCountdown(m, mem8[loc_41c8]);
  }

  // Low-byte bit0 set: the envelope is done. Re-arm the word to its top-bit sentinel (0x8000) so the
  // next trigger runs a fresh envelope.
  // bit0 set: reset the word (low 0, high 128)
  mem8[loc_41c7] = 0;
  mem8[loc_41c8] = 128;
}
