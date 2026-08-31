// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { driveAimIndicatorHitTimerElseRescan } from "./driveAimIndicatorHitTimerElseRescan.js";
import { fillByteRun } from "./fillByteRun.js";
import {
  GAME_ACTIVE_FLAG,
  GRAB_ACTIVE_FLAG,
  WAVE_TEARDOWN_STATE,
  PLAYER_AIM_FLAGS,
  PROXIMITY_HIT_FLAG,
  LAUNCH_STATE,
  ROUND_COUNTER,
  INPUT_ROTATE_LATCH,
  ENEMY_ACTOR_TABLE,
  SPRITE_DISPLAY_LIST,
  SPRITE_SCAN_YSLOTS,
  TARGET_LOCK,
} from "./names.js";

/**
 * acquireTargetLockAndSetAimIndicator — aim-indicator / target-acquisition updater (runs when not in active play).
 *
 * Bails unless GAME_ACTIVE_FLAG and GRAB_ACTIVE_FLAG are both zero. During a wave teardown it
 * clears PLAYER_AIM_FLAGS and returns. Otherwise it steps the aim indicator, bails on a proximity hit,
 * then resolves the indicator: LAUNCH_STATE 1 forces "above"; an existing lock (TARGET_LOCK+1
 * nonzero) is re-evaluated; else it scans six enemy blocks for the closest in-band target,
 * records the lock, and sets the above/below bit from the target-vs-reference comparison.
 *
 * LIVE-OUT: none — the caller runs the next per-frame handler with its own registers.
 */

const AIM_ABOVE = 0x04; //     PLAYER_AIM_FLAGS bit2 (on-target / above)
const AIM_BELOW = 0x08; //     PLAYER_AIM_FLAGS bit3 (below)
const BAND_LO = 0x40; //       y-band lower bound (inclusive)
const BAND_HI = 0xc0; //       y-band upper bound (exclusive)
const SCAN_COUNT = 6; //       enemy blocks scanned
const BLOCK_STRIDE = 0x18; //  enemy block stride
const YSLOT_STRIDE = 0x04; //  y-slot stride
const LOCK_SIZE = 0x05; //     the 5-byte lock structure
const PLAYER_REF = SPRITE_DISPLAY_LIST + 0x02; // the fixed record's y reference cell

function setAimAbove(mem8) {
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ABOVE) & ~AIM_BELOW;
}
function setAimBelow(mem8) {
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_BELOW) & ~AIM_ABOVE;
}

export function acquireTargetLockAndSetAimIndicator(m) {
  const { mem8 } = m;

  if (mem8[GAME_ACTIVE_FLAG] !== 0) return;
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return;

  if (mem8[WAVE_TEARDOWN_STATE] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0x00; // teardown: drop the indicator
    return;
  }

  driveAimIndicatorHitTimerElseRescan(m);
  if (mem8[PROXIMITY_HIT_FLAG] !== 0) return;

  if (mem8[LAUNCH_STATE] === 0x01) {
    setAimAbove(mem8);
    return;
  }

  if (mem8[TARGET_LOCK + 1] !== 0) {
    reevaluateLock(m);
    return;
  }

  scanForTarget(m);
}

/** Re-evaluate the currently-locked target: reset the lock if it went stale, else recompute. */
function reevaluateLock(m) {
  const { mem8 } = m;

  const blockPtr = mem8[TARGET_LOCK + 3] | (mem8[TARGET_LOCK + 4] << 8);
  if (mem8[blockPtr] !== 0) {
    fillByteRun(m, TARGET_LOCK, 0x00, LOCK_SIZE); // block reactivated: drop the lock
    return;
  }

  const yslotPtr = mem8[TARGET_LOCK + 1] | (mem8[TARGET_LOCK + 2] << 8);
  const target = mem8[yslotPtr];
  if (target < BAND_LO || target >= BAND_HI) {
    fillByteRun(m, TARGET_LOCK, 0x00, LOCK_SIZE); // left the y-band: drop the lock
    return;
  }

  // recompute the aim delta on an 8-frame cadence
  let ref = mem8[PLAYER_REF];
  ref = (mem8[ROUND_COUNTER] & 0x01) !== 0 ? (ref + 0x14) & 0xff : (ref - 0x02) & 0xff;

  const cadence = (mem8[INPUT_ROTATE_LATCH] + 1) & 0xff;
  mem8[INPUT_ROTATE_LATCH] = cadence;

  let delta = 0x00;
  if ((cadence & 0x07) === 0) {
    const near = (ref + 0x08) & 0xff;
    if (near >= target && ((near - 0x10) & 0xff) < target) delta = 0x10;
  }
  mem8[PLAYER_AIM_FLAGS] = delta;

  if (ref === target) mem8[PLAYER_AIM_FLAGS] = delta & ~AIM_ABOVE & ~AIM_BELOW;
  else if (ref < target) setAimBelow(mem8);
  else setAimAbove(mem8);
}

/** Scan six enemy blocks for the closest in-band target, record the lock, set the indicator. */
function scanForTarget(m) {
  const { mem8 } = m;
  const playerY = mem8[PLAYER_REF];
  let block = ENEMY_ACTOR_TABLE;
  let yslot = SPRITE_SCAN_YSLOTS;

  for (let n = 0; n < SCAN_COUNT; n++) {
    evaluate: {
      if (mem8[block] === 0) break evaluate; //                  block inactive
      const y = mem8[yslot];
      if (y < BAND_LO || y >= BAND_HI) break evaluate; //        outside the y-band
      const diff = (y - playerY) & 0xff;
      const dist = y < playerY ? ~diff & 0xff : diff; //         distance to the player

      const lockDist = mem8[TARGET_LOCK];
      let store;
      if (lockDist === 0) store = 0x00; //                       no lock yet: byte stays 0
      else if (lockDist >= dist) break evaluate; //              candidate not farther -> keep existing lock
      else store = dist;

      mem8[TARGET_LOCK + 0] = store;
      mem8[TARGET_LOCK + 1] = yslot;
      mem8[TARGET_LOCK + 2] = yslot >> 8;
      const blockPtr = u16(block + 1);
      mem8[TARGET_LOCK + 3] = blockPtr;
      mem8[TARGET_LOCK + 4] = blockPtr >> 8;
    }
    block = u16(block + BLOCK_STRIDE);
    yslot = u16(yslot + YSLOT_STRIDE);
  }

  if (mem8[TARGET_LOCK + 1] === 0) return; //                    nothing locked
  const lockPtr = mem8[TARGET_LOCK + 1] | (mem8[TARGET_LOCK + 2] << 8);
  if (mem8[lockPtr] >= playerY) setAimBelow(mem8);
  else setAimAbove(mem8);
}
