// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFlyPatrol — drive the fly's horizontal patrol: run its tongue timer, pick its sprite code, and
 * walk its X-offset path table into the sprite X position.
 *
 * While the timer counts down it re-renders X each frame and flips the sprite at the midpoint; at
 * zero it advances one path step, reversing at an endpoint (table 0) or holding (table 1).
 * LIVE-OUT: memory-only.
 */
import { loc_833d, loc_833e, loc_8040, loc_8041, loc_811c, loc_279f } from "./names.js";

const TIMER_RELOAD = 60;
const MID_TIME = TIMER_RELOAD / 2;
const TURN_SPRITE = 30;
const FLY_SPRITE = 33;
const FLIP = 0x80; // sprite-code high bit = horizontal flip, and the direction bit shares it
const STEP_MASK = 0x7f;

export function driveFlyPatrol(m) {
  const { mem8 } = m;
  const timer = mem8[loc_833e];
  if (timer === 0) return advance(m);

  const t = (timer - 1) & 0xff;
  mem8[loc_833e] = t;
  if (t === MID_TIME) {
    mem8[loc_8041] = FLY_SPRITE | (mem8[loc_833d] & FLIP);
    return;
  }
  const index = (mem8[loc_833d] & STEP_MASK) + 1;
  writeX(m, mem8[(loc_279f + index) & 0xffff]);
}

function advance(m) {
  const { mem8 } = m;
  if (mem8[loc_833d] & FLIP) { // backward: two steps back before the shared step forward
    mem8[loc_833d] = (mem8[loc_833d] - 1) & 0xff;
    mem8[loc_833d] = (mem8[loc_833d] - 1) & 0xff;
  }
  mem8[loc_833d] = (mem8[loc_833d] + 1) & 0xff;

  const value = mem8[(loc_279f + (mem8[loc_833d] & STEP_MASK)) & 0xffff];
  if (value === 0) { // endpoint: reverse direction, reload the timer, show the turn sprite
    mem8[loc_833d] = mem8[loc_833d] ^ FLIP;
    mem8[loc_833e] = TIMER_RELOAD;
    mem8[loc_8041] = TURN_SPRITE;
    return;
  }
  if (value === 1) { mem8[loc_833e] = TIMER_RELOAD; return; } // hold in place
  writeX(m, value);
}

function writeX(m, offset) {
  const { mem8 } = m;
  mem8[loc_8040] = (offset + mem8[loc_811c]) & 0xff;
}
