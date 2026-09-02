// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ALIEN_SHOT_BLOWUP_TIMER, ALIEN_SHOT_SPRITE_PTR, ALIEN_SHOT_BLOWUP_SPRITE, loc_207b, loc_207c, ALIEN_SHOT_ROW_COUNT } from "./names.js";
import { eraseAlienShot } from "./eraseAlienShot.js";
import { drawAlienShotWithCollision } from "./drawAlienShotWithCollision.js";

// Advance the alien-shot cadence counter: at its reload point erase the current shot, re-seat the shot
// descriptor pointer and its two step timers, and redraw; when it drains to zero just erase; otherwise idle.
export function stepAlienShotBlowup(m) {
  const next = u8(m.mem8[ALIEN_SHOT_BLOWUP_TIMER] - 1);
  m.mem8[ALIEN_SHOT_BLOWUP_TIMER] = next;
  if (next !== 0x03) {
    if (next !== 0) return;
    return eraseAlienShot(m);
  }
  eraseAlienShot(m);
  m.mem16[ALIEN_SHOT_SPRITE_PTR] = ALIEN_SHOT_BLOWUP_SPRITE;
  m.mem8[loc_207c] = m.mem8[loc_207c] - 2;
  m.mem8[loc_207b] = m.mem8[loc_207b] - 2;
  m.mem8[ALIEN_SHOT_ROW_COUNT] = 0x06;
  return drawAlienShotWithCollision(m);
}
