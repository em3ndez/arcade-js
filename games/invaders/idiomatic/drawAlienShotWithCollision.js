// SPDX-License-Identifier: GPL-3.0-only
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { drawSpriteWithCollision } from "./drawSpriteWithCollision.js";
import { ALIEN_SHOT_SPRITE_PTR } from "./names.js";

// Decode the shot object's sprite descriptor, then blit its column into video RAM with collision detect.
export function drawAlienShotWithCollision(m) {
  loadSpriteDescriptor(m, ALIEN_SHOT_SPRITE_PTR);
  return drawSpriteWithCollision(m);
}
