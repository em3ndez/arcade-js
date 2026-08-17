// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFlyPatrol — drive the fly's horizontal patrol: run its tongue timer, pick its sprite code, and
 * walk its X-offset path table into the sprite X position.
 *
 * While the timer counts down it re-renders X each frame and flips the sprite at the midpoint; at
 * zero it advances one path step, reversing at an endpoint (table 0) or holding (table 1).
 * LIVE-OUT: memory-only.
 */
import { FLY_TRAVEL_DIR_STEP, FLY_ATTACK_TIMER, FLY_SPRITE_X, FLY_SPRITE_CODE, FLY_DRIFT_COUNTER, FLY_PATH_OFFSET_TABLE } from "./names.js";

const TIMER_RELOAD = 60;
const MID_TIME = TIMER_RELOAD / 2;
const TURN_SPRITE = 30;
const FLY_SPRITE = 33;
const FLIP = 0x80; // sprite-code high bit = horizontal flip, and the direction bit shares it
const STEP_MASK = 0x7f;

export function driveFlyPatrol(m) {
  const { mem8 } = m;
  const timer = mem8[FLY_ATTACK_TIMER];
  if (timer === 0) return advance(m);

  const t = (timer - 1) & 0xff;
  mem8[FLY_ATTACK_TIMER] = t;
  if (t === MID_TIME) {
    mem8[FLY_SPRITE_CODE] = FLY_SPRITE | (mem8[FLY_TRAVEL_DIR_STEP] & FLIP);
    return;
  }
  const index = (mem8[FLY_TRAVEL_DIR_STEP] & STEP_MASK) + 1;
  writeX(m, mem8[(FLY_PATH_OFFSET_TABLE + index)]);
}

function advance(m) {
  const { mem8 } = m;
  if (mem8[FLY_TRAVEL_DIR_STEP] & FLIP) { // backward: two steps back before the shared step forward
    mem8[FLY_TRAVEL_DIR_STEP] = (mem8[FLY_TRAVEL_DIR_STEP] - 1) & 0xff;
    mem8[FLY_TRAVEL_DIR_STEP] = (mem8[FLY_TRAVEL_DIR_STEP] - 1) & 0xff;
  }
  mem8[FLY_TRAVEL_DIR_STEP] = (mem8[FLY_TRAVEL_DIR_STEP] + 1) & 0xff;

  const value = mem8[(FLY_PATH_OFFSET_TABLE + (mem8[FLY_TRAVEL_DIR_STEP] & STEP_MASK))];
  if (value === 0) { // endpoint: reverse direction, reload the timer, show the turn sprite
    mem8[FLY_TRAVEL_DIR_STEP] = mem8[FLY_TRAVEL_DIR_STEP] ^ FLIP;
    mem8[FLY_ATTACK_TIMER] = TIMER_RELOAD;
    mem8[FLY_SPRITE_CODE] = TURN_SPRITE;
    return;
  }
  if (value === 1) { mem8[FLY_ATTACK_TIMER] = TIMER_RELOAD; return; } // hold in place
  writeX(m, value);
}

function writeX(m, offset) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = (offset + mem8[FLY_DRIFT_COUNTER]) & 0xff;
}
