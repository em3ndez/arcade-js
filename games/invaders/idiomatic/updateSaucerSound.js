// SPDX-License-Identifier: GPL-3.0-only
import { SAUCER_ACTIVE, SAUCER_HIT } from "./names.js";
import { stopSaucerSound } from "./stopSaucerSound.js";
import { startSound } from "./startSound.js";

/**
 * updateSaucerSound -- per-frame gate for the flying-saucer's continuous whine (port-3 bit 0).
 *
 * WHAT IT IS
 *   Once per frame the machine asks "should the saucer's UFO tone be sounding right now?" This routine
 *   answers from two flags and drives the single port-3 sound bit accordingly: off when no saucer is on
 *   screen, held on while a saucer flies, and left untouched (so its death tone can ring) while a saucer
 *   that has been shot plays out its explosion.
 *
 * ROLE IN THE MACHINE
 *   Called from the in-game main loop (ROM 0x084e). It reads SAUCER_ACTIVE (0x2084) and SAUCER_HIT
 *   (0x2085) but never writes the sound port directly -- it delegates: stopSaucerSound clears bit 0 of
 *   SOUND_PORT3_SHADOW (mask 0xfe) and mirrors port 3, while startSound(0x01) ORs bit 0 into the shadow
 *   and mirrors it. Because the tone is a shadow-bit edit, the rest of the port-3 mixer (player-shot cue,
 *   scoring cue) is left alone. When the saucer actually appears is scheduled elsewhere (SAUCER_TIMER);
 *   the audio simply follows the resulting active/hit flags.
 *
 * ROM 0x1804-0x1814.  Grounding: [seen].
 *
 * LIVE-OUT: A holds the mirrored port-3 shadow byte on the two sound paths (from stopSaucerSound /
 * startSound); the SAUCER_HIT early return leaves the registers untouched. The main-loop caller ignores it.
 */
export function updateSaucerSound(m) {
  // No saucer on screen -> silence the whine: stopSaucerSound clears port-3 bit 0 and mirrors the shadow out.
  if (m.mem8[SAUCER_ACTIVE] === 0) return stopSaucerSound(m);
  // Saucer active but already hit: it is in its explosion/score sequence (the UFO-hit tone is on port 5).
  // Leave the port-3 latch exactly as it stands so nothing steps on the death sequence.
  if (m.mem8[SAUCER_HIT] !== 0) return;
  // Saucer active and not yet hit: hold bit 0 on so the continuous UFO whine keeps sounding.
  return startSound(m, 0x01);
}
