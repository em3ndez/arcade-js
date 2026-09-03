// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_2073, TASK_FLAGS, loc_2069, loc_2070, loc_2071, loc_2074, loc_2075, loc_2076,
  loc_201b, loc_20cf, loc_207b, loc_207c, loc_207e, loc_207f, ALIEN_SHOT_SPRITE_PTR,
  COLLISION_FLAG, loc_2015,
} from "./names.js";
import { loc_062f } from "./loc_062f.js";
import { alienIndexToScreenCoords } from "./alienIndexToScreenCoords.js";
import { objectMatchesDrawPhase } from "./objectMatchesDrawPhase.js";
import { stepAlienShotBlowup } from "./stepAlienShotBlowup.js";
import { eraseAlienShot } from "./eraseAlienShot.js";
import { drawAlienShotWithCollision } from "./drawAlienShotWithCollision.js";
import { scaleYToBlock } from "./scaleYToBlock.js";

// The alien-shot object handler. When the shot is live (bit 7 of its status byte) it advances one
// step; otherwise it decides whether to launch a fresh shot this frame. The status byte carries the
// live flag in bit 7 and the blowup-in-progress flag in bit 0.
export function loc_0563(m) {
  if (m.mem8[loc_2073] & 0x80) return stepActiveShot(m);
  return maybeLaunchShot(m);
}

// Flip the shot live (bit 7) and bump its launch counter.
function activateShot(m) {
  m.mem8[loc_2073] |= 0x80;
  m.mem8[loc_2074] = m.mem8[loc_2074] + 1;
}

// Idle path: gate on task state and the two per-column rate timers, pick a firing column, and on a
// live target seat the shot's start descriptor before going live.
function maybeLaunchShot(m) {
  if (m.mem8[TASK_FLAGS] === 4) return activateShot(m);
  if (m.mem8[loc_2069] === 0) return;
  m.mem8[loc_2074] = 0;

  const rate = m.mem8[loc_20cf];
  const gate0 = m.mem8[loc_2070];
  if (gate0 !== 0 && rate >= gate0) return;
  const gate1 = m.mem8[loc_2071];
  if (gate1 !== 0 && rate >= gate1) return;

  let column;
  if (m.mem8[loc_2075] === 0) {
    const [, , steps] = scaleYToBlock(m, u8(m.mem8[loc_201b] + 8));
    column = steps < 12 ? steps : 11;
  } else {
    const cursor = m.mem16[loc_2076];
    column = m.mem8[cursor];
    m.mem16[loc_2076] = cursor + 1;
  }

  const [found, , slot] = loc_062f(m, column);
  if (!found) return;
  const [cellL, cellC] = alienIndexToScreenCoords(m, slot);
  m.mem16[loc_207b] = (u8(cellC + 7) << 8) | u8(cellL - 10);
  return activateShot(m);
}

// Live path: skip if this object does not belong to the current draw half; run the blowup step while
// its bit is set; else move the shot down one step, redraw with collision, and either keep it flying
// or retire it across the shield and ground bands.
function stepActiveShot(m) {
  if (!objectMatchesDrawPhase(m, loc_207c)) return;
  if (m.mem8[loc_2073] & 0x01) return stepAlienShotBlowup(m);
  m.mem8[loc_2074] = m.mem8[loc_2074] + 1;
  eraseAlienShot(m);

  let sprite = u8(m.mem8[ALIEN_SHOT_SPRITE_PTR] + 3);
  if (sprite >= m.mem8[loc_207f]) sprite = u8(sprite - 12);
  m.mem8[ALIEN_SHOT_SPRITE_PTR] = sprite;

  m.mem8[loc_207b] = m.mem8[loc_207b] + m.mem8[loc_207e];
  drawAlienShotWithCollision(m);

  const y = m.mem8[loc_207b];
  if (y >= 21) {
    if (m.mem8[COLLISION_FLAG] === 0) return;
    if (y >= 30 && y < 39) m.mem8[loc_2015] = 0;
  }
  m.mem8[loc_2073] |= 0x01;
}
