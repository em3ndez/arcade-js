// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveRisingPitchRamp (ROM 0x1876) -- the arm/reload tick for the rising pitch-glide voice.
 *
 * WHAT IT IS
 *   Produces a rising pitch glide. It uses an arm cell as a one-frame test: while the arm counter (minus
 *   one) is still non-zero it advances the ramp one step through advanceSoundPitchRamp; when the arm
 *   reaches its reset point it clears the arm and reloads the ramp's two-byte {countdown, pitch} pair to a
 *   countdown of 32 and a pitch of 0, ready for the next glide.
 *
 * ROLE IN THE MACHINE
 *   One of the seven voice updaters driveSoundFrame runs each frame (mechanisms.md "The rising pitch
 *   ramp"). The arm cell loc_41c9 (0x41c9) is raised by the input service driveSoundFrameAndScanInput when
 *   the relevant IN0 bits are pressed (and also by incrementCreditCount as a credit-ready cue), which is
 *   how a player action kicks off the glide. advanceSoundPitchRamp (0x1886) consumes one count from the
 *   countdown, adds a fixed step to the pitch, publishes it to SOUND_PITCH, and clears the composite flag.
 *   The {countdown, pitch} pair lives at loc_41ca (0x41ca) as a 16-bit reload (countdown 32, pitch 0).
 *
 * Grounding: [seen] (names.js cert for 0x1876).
 *
 * LIVE-OUT: none returned; the effect is either the advanced ramp (via advanceSoundPitchRamp) or, at the
 *   reset point, arm cell loc_41c9 cleared to 0 and the ramp pair loc_41ca reloaded to 32.
 */
import { advanceSoundPitchRamp } from "./advanceSoundPitchRamp.js";
import { loc_41c9, loc_41ca } from "./names.js";

// Reloaded into the {countdown, pitch} pair: countdown 32, pitch 0.
const RAMP_RELOAD = 32;

export function driveRisingPitchRamp(m) {
  const { mem8, mem16 } = m;

  // The predecrement is only a branch test -- the decremented value is NOT written back while it stays
  // non-zero. As long as the arm remains set, advance the glide one step and return.
  // The arm byte is not stored while it stays nonzero -- the predecrement only picks the branch.
  if (((mem8[loc_41c9] - 1) & 0xff) !== 0) return advanceSoundPitchRamp(m, loc_41c9);

  // Reset point reached: clear the arm and reload the ramp pair.
  mem8[loc_41c9] = 0;
  mem16[loc_41ca] = RAMP_RELOAD;
}
