// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_2078, ALIEN_SHOT_SPRITE_PTR, loc_1cdc, loc_207b, loc_207c, loc_207d } from "./names.js";
import { eraseAlienShot } from "./eraseAlienShot.js";
import { drawAlienShotWithCollision } from "./drawAlienShotWithCollision.js";

// Advance the alien-shot cadence counter: at its reload point erase the current shot, re-seat the shot
// descriptor pointer and its two step timers, and redraw; when it drains to zero just erase; otherwise idle.
export function loc_0644(m) {
  const next = u8(m.mem8[loc_2078] - 1);
  m.mem8[loc_2078] = next;
  if (next !== 0x03) {
    if (next !== 0) return;
    return eraseAlienShot(m);
  }
  eraseAlienShot(m);
  m.mem16[ALIEN_SHOT_SPRITE_PTR] = loc_1cdc;
  m.mem8[loc_207c] = m.mem8[loc_207c] - 2;
  m.mem8[loc_207b] = m.mem8[loc_207b] - 2;
  m.mem8[loc_207d] = 0x06;
  return drawAlienShotWithCollision(m);
}
