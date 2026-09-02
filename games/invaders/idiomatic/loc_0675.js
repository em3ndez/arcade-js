// SPDX-License-Identifier: GPL-3.0-only
import { loc_2079 } from "./names.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { eraseShiftedSprite } from "./eraseShiftedSprite.js";

// Load the sprite descriptor from its record cell, then erase that sprite's rows off the screen.
export function loc_0675(m) {
  loadSpriteDescriptor(m, loc_2079);
  return eraseShiftedSprite(m);
}
