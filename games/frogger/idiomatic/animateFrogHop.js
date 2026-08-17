// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFrogHop — the four directional frog-hop begin/advance handlers (one multi-entry unit).
 * The joystick input scan dispatches a BEGIN handler on a directional press (DOWN/UP/RIGHT/LEFT). A
 * BEGIN starts a hop: guards on frog position, on a fresh hop emits the hop sound + stamps the
 * direction's rest sprite, primes the hop-animation counter from its reload length, then falls into
 * the matching ADVANCE (a frog already showing the rest sprite re-primes without bumping; a bump that
 * wraps bails). An ADVANCE steps the hop one frame: returns once arrived, else raises the hop-active
 * flag and ticks the counter down — on drain marks arrival + stamps the rest sprite, else steps the
 * frog by the hop delta + stamps the moving sprite (one 16px cell over the reload count of frames).
 * DOWN/UP move FROG_Y (down forward, up back), RIGHT/LEFT move FROG_X (right forward, left back). UP
 * also steps the slot cursor and scores row progress; the per-vblank continuation pass re-enters the
 * active direction's ADVANCE with the frog X/Y cursors armed. LIVE-OUT: memory-only.
 */
import {
  FROG_X, FROG_Y, FROG_SPRITE_CODE,
  FROG_HOP_DOWN_ACTIVE, FROG_HOP_UP_ACTIVE, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_LEFT_ACTIVE,
  FROG_HOP_DOWN_ARRIVAL, FROG_HOP_UP_ARRIVAL, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_LEFT_ARRIVAL,
  FROG_HOP_DOWN_ANIM_COUNTER, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_RIGHT_ANIM_COUNTER, FROG_HOP_LEFT_ANIM_COUNTER,
  FROG_HOP_VERTICAL_DELTA, FROG_HOP_HORIZONTAL_DELTA,
  FROG_HOP_DOWN_ANIM_RELOAD, FROG_HOP_UP_ANIM_RELOAD, FROG_HOP_RIGHT_ANIM_RELOAD, FROG_HOP_LEFT_ANIM_RELOAD,
} from "./names.js";
import { loc_23eb } from "./loc_23eb.js";
import { scoreFrogRowProgress } from "./scoreFrogRowProgress.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

const HOP_SOUND = 0x04;         // sound command emitted when a hop begins

// Per-direction frog sprite codes: the rest code (hop-begin and arrived) and the moving code (mid-hop).
const HOP_DOWN_REST_CODE = 0xde, HOP_DOWN_MOVE_CODE = 0xdc;
const HOP_UP_REST_CODE = 0x1e, HOP_UP_MOVE_CODE = 0x1c;
const HOP_RIGHT_REST_CODE = 0xa1, HOP_RIGHT_MOVE_CODE = 0x9f;
const HOP_LEFT_REST_CODE = 0x21, HOP_LEFT_MOVE_CODE = 0x1f;

// Emit the hop-start sound.
function enqueueHopSound(m) {
  enqueueSoundCommand(m, HOP_SOUND);
}

// Shared begin body: fresh hop primes the sprite + counter, else the counter just re-primes, then advance.
function beginHop(m, counter, reload, restCode, advance) {
  const mem = m.mem8;
  if (mem[counter] === 0) {
    enqueueHopSound(m);
    if (mem[FROG_SPRITE_CODE] === restCode) {
      mem[counter] = mem[reload]; // frog already showing the rest sprite: re-prime and advance, no bump
      return advance(m);
    }
    mem[FROG_SPRITE_CODE] = restCode;
  }
  const bumped = (mem[counter] + 1) & 0xff;
  mem[counter] = bumped;
  if (bumped === 0) return; // the bump wrapped: bail with the counter left at zero
  mem[counter] = mem[reload];
  return advance(m);
}

// Shared advance body for the plain directions: arrive-once guard, tick down, then arrive or step the frog.
function advanceHop(m, arrival, active, counter, restCode, moveCode, step) {
  const mem = m.mem8;
  if (mem[arrival] !== 0) return; // this hop has already arrived
  mem[active] = 1;
  const left = (mem[counter] - 1) & 0xff;
  mem[counter] = left;
  if (left === 0) {
    mem[active] = 0;
    mem[arrival] = 1;
    mem[FROG_SPRITE_CODE] = restCode;
    return;
  }
  step(m);
  mem[FROG_SPRITE_CODE] = moveCode;
}

const stepHopDown = (m) => {
  m.mem8[FROG_Y] = (m.mem8[FROG_Y] + m.mem8[FROG_HOP_VERTICAL_DELTA]) & 0xff;
};
const stepHopRight = (m) => {
  m.mem8[FROG_X] = (m.mem8[FROG_X] + m.mem8[FROG_HOP_HORIZONTAL_DELTA]) & 0xff;
};
const stepHopLeft = (m) => {
  m.mem8[FROG_X] = (m.mem8[FROG_X] - m.mem8[FROG_HOP_HORIZONTAL_DELTA]) & 0xff;
};

export function beginFrogHopDown(m) {
  if (m.mem8[FROG_Y] >= 0xf0) return; // frog at the bottom edge: no down-hop
  return beginHop(m, FROG_HOP_DOWN_ANIM_COUNTER, FROG_HOP_DOWN_ANIM_RELOAD, HOP_DOWN_REST_CODE, advanceFrogHopDown);
}
export function advanceFrogHopDown(m) {
  advanceHop(m, FROG_HOP_DOWN_ARRIVAL, FROG_HOP_DOWN_ACTIVE, FROG_HOP_DOWN_ANIM_COUNTER, HOP_DOWN_REST_CODE, HOP_DOWN_MOVE_CODE, stepHopDown);
}

export function beginFrogHopUp(m) {
  return beginHop(m, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_UP_ANIM_RELOAD, HOP_UP_REST_CODE, advanceFrogHopUp);
}
export function advanceFrogHopUp(m) {
  const mem = m.mem8;
  loc_23eb(m); // advance the home-bay slot cursor; its A output is discarded below
  if (mem[FROG_HOP_UP_ARRIVAL] !== 0) return;
  mem[FROG_HOP_UP_ACTIVE] = 1;
  const left = (mem[FROG_HOP_UP_ANIM_COUNTER] - 1) & 0xff;
  mem[FROG_HOP_UP_ANIM_COUNTER] = left;
  if (left === 0) {
    mem[FROG_HOP_UP_ACTIVE] = 0;
    mem[FROG_HOP_UP_ARRIVAL] = 1;
    mem[FROG_SPRITE_CODE] = HOP_UP_REST_CODE;
    scoreFrogRowProgress(m); // DE is scratch here, not live-out
    return;
  }
  mem[FROG_Y] = (mem[FROG_Y] - mem[FROG_HOP_VERTICAL_DELTA]) & 0xff;
  mem[FROG_SPRITE_CODE] = HOP_UP_MOVE_CODE;
}

export function beginFrogHopRight(m) {
  const mem = m.mem8;
  if (mem[FROG_Y] < 0x30) return; // frog above the field top: no hop
  if (mem[FROG_X] >= 0xe0) return; // frog at the right edge: no right-hop
  return beginHop(m, FROG_HOP_RIGHT_ANIM_COUNTER, FROG_HOP_RIGHT_ANIM_RELOAD, HOP_RIGHT_REST_CODE, advanceFrogHopRight);
}
export function advanceFrogHopRight(m) {
  advanceHop(m, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_RIGHT_ANIM_COUNTER, HOP_RIGHT_REST_CODE, HOP_RIGHT_MOVE_CODE, stepHopRight);
}

export function beginFrogHopLeft(m) {
  const mem = m.mem8;
  if (mem[FROG_Y] < 0x30) return; // frog above the field top: no hop
  if (mem[FROG_X] < 0x20) return; // frog at the left edge: no left-hop
  return beginHop(m, FROG_HOP_LEFT_ANIM_COUNTER, FROG_HOP_LEFT_ANIM_RELOAD, HOP_LEFT_REST_CODE, advanceFrogHopLeft);
}
export function advanceFrogHopLeft(m) {
  advanceHop(m, FROG_HOP_LEFT_ARRIVAL, FROG_HOP_LEFT_ACTIVE, FROG_HOP_LEFT_ANIM_COUNTER, HOP_LEFT_REST_CODE, HOP_LEFT_MOVE_CODE, stepHopLeft);
}
