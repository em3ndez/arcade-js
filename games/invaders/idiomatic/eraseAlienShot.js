// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_SHOT_SPRITE_PTR } from "./names.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { eraseShiftedSprite } from "./eraseShiftedSprite.js";

// Load the sprite descriptor from its record cell, then erase that sprite's rows off the screen.
export function eraseAlienShot(m) {
  loadSpriteDescriptor(m, ALIEN_SHOT_SPRITE_PTR);
  return eraseShiftedSprite(m);
}
