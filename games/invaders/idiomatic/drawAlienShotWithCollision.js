// SPDX-License-Identifier: GPL-3.0-only
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { drawSpriteWithCollision } from "./drawSpriteWithCollision.js";
import { ALIEN_SHOT_SPRITE_PTR } from "./names.js";

/**
 * drawAlienShotWithCollision — paint the active alien shot and test for a hit.
 *
 * WHAT IT IS
 *   Seats the alien-shot's five-byte sprite descriptor, then OR-blits its column into video RAM through
 *   the collision-testing blitter — so drawing the shot and detecting whether it overlapped something
 *   are one operation.
 *
 * ROLE IN THE MACHINE
 *   An alien shot is drawn and erased through the descriptor at ALIEN_SHOT_SPRITE_PTR (0x2079)
 *   (mechanisms.md, alien-shot draw/erase). This routine is the "draw" half: loadSpriteDescriptor
 *   decodes that descriptor (screen address + gfx pointer + height), and drawSpriteWithCollision
 *   OR-blits it while AND-testing each shifted half against the screen, latching COLLISION_FLAG (0x2061)
 *   on any overlap. The shot stepper (stepAlienShot) redraws through here every frame; eraseAlienShot
 *   (0x0675) is the mirror that ANDs the same descriptor's bits back out.
 *
 * ROM 0x066c.  Grounding: [seen].
 *
 * LIVE-OUT: HL/DE/A (from drawSpriteWithCollision) plus COLLISION_FLAG set on overlap.
 */
export function drawAlienShotWithCollision(m) {
  // Seat HL at the alien-shot descriptor and decode its five bytes into DE (gfx)/A/C/B and HL (screen).
  loadSpriteDescriptor(m, ALIEN_SHOT_SPRITE_PTR);
  // OR-blit the shifted sprite column while testing overlap; any hit latches COLLISION_FLAG for the
  // player-shot collision resolver to read.
  return drawSpriteWithCollision(m);
}
