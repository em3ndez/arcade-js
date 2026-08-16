// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFlyEatCollision — the fly-eat collision/animation step, run each vblank. While an eat is in
 * progress it only tracks the fly sprite onto the frog. Otherwise it arms the tongue once (when the fly
 * path is idle), bails to the retract reset when the retract bit is set, and, while the tongue is out,
 * runs the fly patrol mover and box-tests the fly against the frog (fly X within +/-4 of the frog, frog
 * Y in the [0x5a,0x68) row band). A hit latches the eat, fires the eat sound, and tracks the fly onto
 * the frog. LIVE-OUT: memory-only.
 */
import {
  FROG_X, FROG_Y, FROG_SPRITE_CODE, FLY_SPRITE_X, FLY_SPRITE_CODE, FLY_PATH_X_BASE,
  FLY_TRAVEL_DIR_STEP, FLY_ATTACK_TIMER, COLLISION_SUBFLAG, COLLISION_LATCH,
} from "./names.js";
import { clearLatchedCollision } from "./clearLatchedCollision.js";
import { driveFlyPatrol } from "./driveFlyPatrol.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

const FLY_EAT_PHASE = 0x813d;   // tongue-out/eat phase; bit0 set means retract this frame
const FLY_SPRITE_ATTR = 0x8042;
const FLY_SPRITE_Y = 0x8043;
const EAT_SOUND = 0x18;

export function animateFlyEatCollision(m) {
  const { mem8 } = m;

  if (mem8[COLLISION_SUBFLAG] !== 0) return trackFlyOntoFrog(m);
  if (mem8[FLY_PATH_X_BASE] === 0) armFlyTongue(m);
  if (mem8[FLY_EAT_PHASE] & 0x01) return clearLatchedCollision(m);
  if (mem8[COLLISION_LATCH] !== 0) return boxTestFlyVsFrog(m);
  return;
}

// Move the fly, then latch an eat when it lands in the frog's row/column window.
function boxTestFlyVsFrog(m) {
  const { regs, mem8 } = m;

  if (mem8[COLLISION_SUBFLAG] !== 0) return trackFlyOntoFrog(m);
  driveFlyPatrol(m);

  const fy = mem8[FROG_Y];
  if (fy < 0x5a || fy >= 0x68) return;

  const flyX = mem8[FLY_SPRITE_X];
  if (((mem8[FROG_X] + 0x04) & 0xff) < flyX) return;
  if (((mem8[FROG_X] - 0x04) & 0xff) >= flyX) return;

  mem8[COLLISION_SUBFLAG] = 0x01;
  regs.a = EAT_SOUND;
  enqueueSoundCommand(m);
  return trackFlyOntoFrog(m);
}

// Copy the frog's live position/sprite onto the fly sprite; the fly Y trails the frog by two.
function trackFlyOntoFrog(m) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = mem8[FROG_X];
  mem8[FLY_SPRITE_CODE] = mem8[FROG_SPRITE_CODE];
  mem8[FLY_SPRITE_Y] = (mem8[FROG_Y] + 0x02) & 0xff;
}

// Arm the tongue once: bump the eat phase, stamp the fly descriptor, set the tongue timers.
function armFlyTongue(m) {
  const { mem8 } = m;
  if (mem8[COLLISION_LATCH] !== 0) return;
  mem8[FLY_EAT_PHASE] = (mem8[FLY_EAT_PHASE] + 1) & 0xff;
  mem8[FLY_SPRITE_CODE] = 0x1e;
  mem8[FLY_SPRITE_ATTR] = 0x04;
  mem8[FLY_SPRITE_Y] = 0x60;
  mem8[COLLISION_LATCH] = 0x01;
  mem8[FLY_TRAVEL_DIR_STEP] = 0x01;
  mem8[FLY_ATTACK_TIMER] = 0x3c;
}
