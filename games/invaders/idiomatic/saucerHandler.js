// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { objectMatchesDrawPhase } from "./objectMatchesDrawPhase.js";
import { drawSaucerSprite } from "./drawSaucerSprite.js";
import { alienShotSlot4Handler } from "./alienShotSlot4Handler.js";
import { playSaucerHitSoundAndDrawSprite } from "./playSaucerHitSoundAndDrawSprite.js";
import { awardSaucerScore } from "./awardSaucerScore.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { clearScreenStrip } from "./clearScreenStrip.js";
import { copyTemplateToRecord } from "./copyTemplateToRecord.js";
import { stopSaucerSound } from "./stopSaucerSound.js";
import { loc_2080, loc_2083, loc_2056, SAUCER_ACTIVE, ALIEN_COUNT, loc_208a, loc_208c, SAUCER_HIT, loc_2086, SOUND_PORT5_SHADOW } from "./names.js";

/**
 * saucerHandler — the mystery-ship (flying saucer / UFO) object-table handler.
 *
 * WHAT IT IS
 *   The per-frame handler for the mystery ship. When conditions allow it, it launches a saucer, flies it
 *   across the top of the play area, and — when the player shoots it — runs its explosion-and-score
 *   sequence, then wipes it off screen and resets its record for the next appearance. Whenever the saucer
 *   path does not apply it delegates to the plain alien-shot step leaf, alienShotSlot4Handler, so the
 *   record is still serviced.
 *
 * ROLE IN THE MACHINE
 *   One of the five in-game object records the dispatcher walkObjectTable walks (SAUCER_HANDLER_ADDR
 *   0x0682), reached via the fixed handler map (mechanisms.md, object-table handlers). Cells it touches:
 *     - SAUCER_ACTIVE (0x2084): the on-field flag — 0 means no saucer is up.
 *     - SAUCER_HIT (0x2085): set when a player shot struck the saucer; switches it into its death sequence.
 *     - ALIEN_COUNT (0x2082): the live-alien tally; the saucer only appears while >= 8 aliens remain
 *       (like the real machine, the UFO stops appearing near the end of a wave).
 *     - loc_208a / loc_208c: the saucer's horizontal position accumulator and its per-step move amount
 *       (a "movement pair" — mechanisms.md); bit 7 of loc_208a is also the object's raster draw-phase bit.
 *     - loc_2086: the hit-sequence phase counter, counted down while SAUCER_HIT is set.
 *     - loc_2083: the saucer object-record base (its first byte gates the whole path); reseeded from ROM
 *       template on retire.
 *     - SOUND_PORT5_SHADOW (0x2098) and sound ports 3/5 for the whine and the hit tone.
 *   loc_2080 / loc_2056 / loc_2083 / loc_2086 / loc_208a / loc_208c keep placeholder names — their exact
 *   naming/role is not all confidently grounded (loc_2080 is observed seeded to 2 by runHandshakedAttractAnim).
 *
 * ROM 0x0682-....  Grounding: [seen].
 *
 * LIVE-OUT: memory + IO; the various early returns forward their delegate's result.
 */
export function saucerHandler(m) {
  // Mode gate: only run the saucer path when loc_2080 reads 2; otherwise do nothing this pass. (loc_2080's
  // precise role is not grounded; runHandshakedAttractAnim is seen to seed it to 2.)
  if (m.mem8[loc_2080] !== 2) return;
  // No saucer record armed yet (loc_2083 == 0): nothing saucer-specific to do -> service the record through
  // the plain alien-shot step leaf.
  if (m.mem8[loc_2083] === 0) return alienShotSlot4Handler(m);
  // A separate gate cell (loc_2056, role not grounded): when nonzero, suppress the saucer path and delegate.
  if (m.mem8[loc_2056] !== 0) return alienShotSlot4Handler(m);
  // No saucer currently on the field: decide whether to launch one.
  if (m.mem8[SAUCER_ACTIVE] === 0) {
    // Too few aliens left (< 8): the mystery ship does not appear this late in the wave -> delegate.
    if (m.mem8[ALIEN_COUNT] < 8) return alienShotSlot4Handler(m);
    // Otherwise launch it: raise the on-field flag and draw its first frame.
    m.mem8[SAUCER_ACTIVE] = 1;
    drawSaucerSprite(m);
  }
  // Half-frame gate: service the saucer only in the raster half whose phase matches bit 7 of loc_208a, so
  // its sprite is never torn across the beam. Skip this pass if it belongs to the other half.
  if (!objectMatchesDrawPhase(m, loc_208a)) return;
  if (m.mem8[SAUCER_HIT] === 0) {
    // Alive and flying: advance the horizontal position by the step amount and redraw at the new spot.
    m.mem8[loc_208a] = u8(m.mem8[loc_208a] + m.mem8[loc_208c]);
    drawSaucerSprite(m);
    // While it is still within the visible band [40,225) keep it on screen and stop here; only once it
    // crosses an edge does it fall through to the erase/reset tail below.
    const x = m.mem8[loc_208a];
    if (x >= 40 && x < 225) return;
  } else {
    // Hit and exploding: silence the continuous whine (mask bit 0 off port 3) and tick the phase counter.
    clearSoundPort3Bit(m, 0xfe);
    m.mem8[loc_2086] = u8(m.mem8[loc_2086] - 1);
    const phase = m.mem8[loc_2086];
    // Phase 31: fire the UFO-explosion tone and draw the burst sprite.
    if (phase === 31) return playSaucerHitSoundAndDrawSprite(m);
    // Phase 24: award the mystery score and show its point-value glyphs.
    if (phase === 24) return awardSaucerScore(m);
    // Any other nonzero phase: hold the score display and keep counting down.
    if (phase !== 0) return;
    // Phase 0: silence the UFO-hit tone (mask bit 4 off the port-5 shadow, emit only the retained bit 5),
    // then fall through to the erase/reset tail.
    m.mem8[SOUND_PORT5_SHADOW] &= 0xef;
    m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW] & 0x20);
  }
  // Retire the saucer (reached when a flying saucer crossed an edge, or its explosion finished): resolve
  // its screen address, blank its strip off the display, reseed its 10-byte object record from ROM for the
  // next appearance, and cut the whine for good.
  resolveSpriteScreenAddr(m);
  clearScreenStrip(m);
  copyTemplateToRecord(m, loc_2083, 10);
  return stopSaucerSound(m);
}
