// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceGatedSquareTone (ROM 0x1723) -- per-frame tick of the gated square-wave tone voice.
 *
 * WHAT IT IS
 *   One of Galaxian's discrete-sound voices is a plain square wave that is switched on for a fixed
 *   burst and then falls silent. This routine is that voice's phase counter: while the burst is
 *   running it keeps the wave oscillating by driving the toggler every frame; when the burst reaches
 *   its final step it stops the counter and reloads the duration for the next burst.
 *
 * ROLE IN THE MACHINE
 *   Runs once per frame as the last of the seven voice updaters in driveSoundFrame (mechanisms.md,
 *   "The gated square-wave tone"). loc_41cc (0x41cc) is the phase counter for this voice; the actual
 *   square-up work is done by driveGatedSquareTone, which -- while SOUND_TONE_DURATION (0x41ce) is
 *   nonzero -- writes the frame flag loc_4007 XOR 1 to sound register SOUND_W_REG5 (a bit that flips
 *   frame to frame, so the output squares into a tone) and silences the register once the duration
 *   is spent. Note this routine does NOT store the counter back on the common path: it only tests
 *   (loc_41cc - 1) and lets the toggler run; the counter is written only on the expiry frame.
 *
 * Grounding: [seen] (names.js cert for 0x1723).
 *
 * LIVE-OUT: loc_41cc (parked at 0 on expiry), SOUND_TONE_DURATION (re-armed to 8 on expiry), plus
 *   whatever driveGatedSquareTone latches to SOUND_W_REG5 on the driving path.
 */
import { driveGatedSquareTone } from "./driveGatedSquareTone.js";
import { loc_41cc, SOUND_TONE_DURATION } from "./names.js";

// Burst length the expiry step re-arms into SOUND_TONE_DURATION for the next gated tone.
const REARM_DURATION = 8;

export function advanceGatedSquareTone(m) {
  const { mem8 } = m;

  // More than one step from expiry: (counter - 1) is still nonzero, so keep the wave oscillating by
  // driving the toggler this frame and leave. (No store back to loc_41cc here -- the counter is only
  // consulted, matching the ROM, which decrements A for the test but never writes it on this branch.)
  if (((mem8[loc_41cc] - 1) & 0xff) !== 0) {
    driveGatedSquareTone(m);
    return;
  }

  // Expiry step (counter reads 1, so counter-1 == 0): park the phase counter at 0 to stop this burst
  // and re-arm the tone duration to 8 so the next time the voice is gated on it plays a fresh burst.
  mem8[loc_41cc] = 0;
  mem8[SOUND_TONE_DURATION] = REARM_DURATION;
}
