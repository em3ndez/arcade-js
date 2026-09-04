// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_SHOT_SPRITE_PTR } from "./names.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { eraseShiftedSprite } from "./eraseShiftedSprite.js";

/**
 * eraseAlienShot — remove the current alien shot's sprite from the screen.
 *
 * WHAT IT IS
 *   Decodes the alien-shot sprite descriptor and then ANDs that sprite's bits back out of video RAM,
 *   erasing it. The exact inverse of drawAlienShotWithCollision (0x066c), which decodes the same
 *   descriptor and OR-blits the sprite in.
 *
 * ROLE IN THE MACHINE
 *   The alien-shot subsystem's erase primitive. It is called during a shot's blowup and retirement — for
 *   example stepAlienShotBlowup (0x0644) erases the shot at blowup timer 3 (before re-seating the blowup
 *   sprite) and again at 0. loadSpriteDescriptor reads the 5-byte descriptor at ALIEN_SHOT_SPRITE_PTR
 *   (0x2079) into DE/A/C/B and points HL at the shot's screen address; eraseShiftedSprite then walks the
 *   descriptor's rows, using the hardware bit-shifter (ports 4/3) to clear the sprite's shifted bits from
 *   two adjacent screen columns per row.
 *
 * ROM 0x0675.  Grounding: [seen].
 *
 * LIVE-OUT: whatever eraseShiftedSprite returns (HL/DE/A), since this tail-calls it.
 */
export function eraseAlienShot(m) {
  // Decode the alien-shot descriptor at its fixed record cell: this seats HL at the shot's screen
  // address and loads the sprite geometry (row count, gfx pointer) the eraser needs.
  loadSpriteDescriptor(m, ALIEN_SHOT_SPRITE_PTR);
  // Clear the sprite's rows off the screen by AND-ing its complemented, hardware-shifted bits out.
  return eraseShiftedSprite(m);
}
