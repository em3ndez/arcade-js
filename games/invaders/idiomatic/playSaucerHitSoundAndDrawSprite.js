// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT5_SHADOW, loc_2087, SAUCER_HIT_SPRITE } from "./names.js";
import { latchSoundPort5 } from "./latchSoundPort5.js";
import { drawSaucerSprite } from "./drawSaucerSprite.js";

// Raise a sound-select bit in the port shadow and latch it, point the sprite record at its table, then blit the column.
export function playSaucerHitSoundAndDrawSprite(m) {
  const a = (m.mem8[SOUND_PORT5_SHADOW] |= 0x10);
  latchSoundPort5(m, a);
  m.mem16[loc_2087] = SAUCER_HIT_SPRITE;
  return drawSaucerSprite(m);
}
