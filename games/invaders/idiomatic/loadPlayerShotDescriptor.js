// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_DESC } from "./names.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";

// Read the sprite descriptor at the object move-record base into DE/A/C/B and repoint HL at C:A.
export function loadPlayerShotDescriptor(m) {
  return loadSpriteDescriptor(m, PLAYER_SHOT_DESC);
}
