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
 * acquireTargetLockAndSetAimIndicator — the aim-indicator / target-acquisition updater.
 * ROM 0x6cab-0x6da5.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The per-frame worker that maintains the arrow's aim indicator while the game is NOT in
 *   active play (the attract / idle screen). Pooyan's player arrow can point "on target",
 *   "above", or "below" the enemy it is tracking; the small marker the arrow draws is read
 *   straight out of PLAYER_AIM_FLAGS (0x8a87). This routine decides which enemy the arrow is
 *   tracking (the "target lock") and which of those indicator bits to light.
 *
 * ROLE IN THE MACHINE
 *   It sits in the aim subsystem alongside driveAimIndicatorHitTimerElseRescan. It reads the
 *   six enemy actor records at ENEMY_ACTOR_TABLE (0x8ae0) and their y-coordinates in the
 *   stride-4 scan slots at SPRITE_SCAN_YSLOTS (0x8852), compares each to the player arrow's
 *   own y (SPRITE_DISPLAY_LIST+2, the first sprite record's y), records the enemy it settles on
 *   in the 5-byte lock at TARGET_LOCK (0x8f40), and writes the above/below indicator into
 *   PLAYER_AIM_FLAGS. Once a lock exists it re-tracks that same enemy frame to frame instead of
 *   rescanning, dropping the lock only when the enemy goes away or drifts out of range.
 *
 * LIVE-OUT (what it leaves in memory)
 *   It returns nothing to its caller; its whole product is in RAM —
 *     - PLAYER_AIM_FLAGS (0x8a87) bit2 = on-target/above, bit3 = below, bit4 = in-range: the
 *       bits the on-screen arrow indicator reads;
 *     - TARGET_LOCK (0x8f40), the 5-byte lock structure naming the enemy currently tracked;
 *     - INPUT_ROTATE_LATCH (0x8f03), the free-running counter that paces the 8-frame recompute.
 */

// PLAYER_AIM_FLAGS bit layout: the low bits carry joystick input; bits 2/3 are the aim marker.
const AIM_ABOVE = 0x04; //     PLAYER_AIM_FLAGS bit2 (on-target / above)
const AIM_BELOW = 0x08; //     PLAYER_AIM_FLAGS bit3 (below)
const BAND_LO = 0x40; //       y-band lower bound (inclusive): enemies above this are ignored
const BAND_HI = 0xc0; //       y-band upper bound (exclusive): enemies below this are ignored
const SCAN_COUNT = 6; //       enemy blocks scanned
const BLOCK_STRIDE = 0x18; //  enemy block stride (one 24-byte enemy actor record)
const YSLOT_STRIDE = 0x04; //  y-slot stride (the scan slots are packed stride-4)
const LOCK_SIZE = 0x05; //     the 5-byte lock structure at TARGET_LOCK
const PLAYER_REF = SPRITE_DISPLAY_LIST + 0x02; // the fixed record's y reference cell (0x8842)

// Light the "on target / above" marker: raise bit2, drop bit3 (they are mutually exclusive).
function setAimAbove(mem8) {
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ABOVE) & ~AIM_BELOW;
}
// Light the "below" marker: raise bit3, drop bit2.
function setAimBelow(mem8) {
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_BELOW) & ~AIM_ABOVE;
}

export function acquireTargetLockAndSetAimIndicator(m) {
  const { mem8 } = m;

  // Gate: this indicator is maintained only when the game is NOT in active play. GAME_ACTIVE_FLAG
  // (0x8806) is set for the duration of a life, so a nonzero value means real play is running and
  // the aim updater stands down.
  if (mem8[GAME_ACTIVE_FLAG] !== 0) return;
  // Gate: a rope-grab in progress (GRAB_ACTIVE_FLAG, 0x8d32) suspends aim updates until it clears.
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return;

  // While the enemy formation is being torn down (WAVE_TEARDOWN_STATE, 0x8f24, nonzero) there is
  // nothing sensible to aim at, so blank the whole indicator byte and leave.
  if (mem8[WAVE_TEARDOWN_STATE] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0x00; // teardown: drop the indicator entirely
    return;
  }

  // Step the companion hit-timer / rescan helper. It drains the aim-indicator timer and, on a
  // proximity hit, raises PROXIMITY_HIT_FLAG (0x8d54) — in which case that pass has already claimed
  // the frame and we must not run our own scan.
  driveAimIndicatorHitTimerElseRescan(m);
  if (mem8[PROXIMITY_HIT_FLAG] !== 0) return;

  // Launch state 1 (LAUNCH_STATE, 0x8f30) forces the "above" marker regardless of any target.
  if (mem8[LAUNCH_STATE] === 0x01) {
    setAimAbove(mem8);
    return;
  }

  // A lock already exists when the stored y-slot pointer's low byte (TARGET_LOCK+1) is nonzero.
  // Re-track that same enemy rather than rescanning the formation.
  if (mem8[TARGET_LOCK + 1] !== 0) {
    reevaluateLock(m);
    return;
  }

  // No lock yet: scan the six enemy records to acquire one.
  scanForTarget(m);
}

/** Re-evaluate the currently-locked target: reset the lock if it went stale, else recompute. */
function reevaluateLock(m) {
  const { mem8 } = m;

  // The lock remembers the locked enemy's record pointer in TARGET_LOCK+3/+4 (little-endian).
  // Follow it: if the pointed record byte is nonzero the enemy slot has come alive again, so this
  // lock is stale — clear the whole 5-byte structure and bail.
  const blockPtr = mem8[TARGET_LOCK + 3] | (mem8[TARGET_LOCK + 4] << 8);
  if (mem8[blockPtr] !== 0) {
    fillByteRun(m, TARGET_LOCK, 0x00, LOCK_SIZE); // block reactivated: drop the lock
    return;
  }

  // TARGET_LOCK+1/+2 hold the locked enemy's y-slot pointer. Read its current y; if it has drifted
  // out of the valid 0x40..0xc0 vertical band the enemy is no longer a reachable target — drop it.
  const yslotPtr = mem8[TARGET_LOCK + 1] | (mem8[TARGET_LOCK + 2] << 8);
  const target = mem8[yslotPtr];
  if (target < BAND_LO || target >= BAND_HI) {
    fillByteRun(m, TARGET_LOCK, 0x00, LOCK_SIZE); // left the y-band: drop the lock
    return;
  }

  // recompute the aim delta on an 8-frame cadence.
  // Start from the player arrow's y and bias it by round parity: ROUND_COUNTER (0x8907) bit0 selects
  // the stage-type/facing variant, so odd rounds nudge the reference +0x14 and even rounds -0x02.
  let ref = mem8[PLAYER_REF];
  ref = (mem8[ROUND_COUNTER] & 0x01) !== 0 ? (ref + 0x14) & 0xff : (ref - 0x02) & 0xff;

  // INPUT_ROTATE_LATCH (0x8f03) is a free-running per-frame counter; bump it and act only when its
  // low three bits are zero, i.e. once every eighth frame.
  const cadence = (mem8[INPUT_ROTATE_LATCH] + 1) & 0xff;
  mem8[INPUT_ROTATE_LATCH] = cadence;

  // On the cadence frame, set the "in-range" bit4 (0x10) when the target's y sits within roughly one
  // step (~8px) of the biased reference: near = ref+8 must be >= target while ref-8 stays < target.
  // Writing delta as the whole byte also clears the joystick/marker low bits for this frame.
  let delta = 0x00;
  if ((cadence & 0x07) === 0) {
    const near = (ref + 0x08) & 0xff;
    if (near >= target && ((near - 0x10) & 0xff) < target) delta = 0x10;
  }
  mem8[PLAYER_AIM_FLAGS] = delta;

  // Set the above/below marker from the biased reference versus the target's y (y grows downward):
  // equal -> neither bit (dead on target); reference above the target (ref < target) -> "below";
  // reference below the target (ref > target) -> "above".
  if (ref === target) mem8[PLAYER_AIM_FLAGS] = delta & ~AIM_ABOVE & ~AIM_BELOW;
  else if (ref < target) setAimBelow(mem8);
  else setAimAbove(mem8);
}

/** Scan six enemy blocks for the closest in-band target, record the lock, set the indicator. */
function scanForTarget(m) {
  const { mem8 } = m;
  // Compare everything against the player arrow's own y.
  const playerY = mem8[PLAYER_REF];
  // Walk the enemy records at ENEMY_ACTOR_TABLE (0x8ae0, stride 0x18) in lockstep with their
  // y-coordinates in the scan slots at SPRITE_SCAN_YSLOTS (0x8852, stride 4).
  let block = ENEMY_ACTOR_TABLE;
  let yslot = SPRITE_SCAN_YSLOTS;

  for (let n = 0; n < SCAN_COUNT; n++) {
    evaluate: {
      // Record byte0 is the active flag; a dead slot is not a candidate.
      if (mem8[block] === 0) break evaluate; //                  block inactive
      // Reject any enemy outside the 0x40..0xc0 vertical band the arrow can reach.
      const y = mem8[yslot];
      if (y < BAND_LO || y >= BAND_HI) break evaluate; //        outside the y-band
      // Absolute vertical distance to the player: subtracting wraps in a byte, so when the enemy is
      // above the player (y < playerY) the difference is complemented back to a magnitude.
      const diff = (y - playerY) & 0xff;
      const dist = y < playerY ? ~diff & 0xff : diff; //         distance to the player

      // TARGET_LOCK+0 is the recorded distance / lock-active byte. With no lock yet it reads 0, and
      // this first capture stores 0 back (the ROM's sentinel), so the distance byte is not the real
      // distance; a later candidate replaces the lock only when it is strictly closer than what is
      // recorded.
      const lockDist = mem8[TARGET_LOCK];
      let store;
      if (lockDist === 0) store = 0x00; //                       no lock yet: byte stays 0
      else if (lockDist >= dist) break evaluate; //              candidate not farther -> keep existing lock
      else store = dist;

      // Record this enemy as the lock: distance byte, its y-slot pointer (TARGET_LOCK+1/+2), and its
      // record pointer at block+1 (TARGET_LOCK+3/+4), both little-endian.
      mem8[TARGET_LOCK + 0] = store;
      mem8[TARGET_LOCK + 1] = yslot;
      mem8[TARGET_LOCK + 2] = yslot >> 8;
      const blockPtr = u16(block + 1);
      mem8[TARGET_LOCK + 3] = blockPtr;
      mem8[TARGET_LOCK + 4] = blockPtr >> 8;
    }
    // Advance to the next enemy record and its matching y-slot.
    block = u16(block + BLOCK_STRIDE);
    yslot = u16(yslot + YSLOT_STRIDE);
  }

  // If the scan recorded no y-slot pointer, nothing in-band was active this frame — leave the
  // indicator untouched.
  if (mem8[TARGET_LOCK + 1] === 0) return; //                    nothing locked
  // Otherwise light above/below from the locked enemy's current y versus the player: at or below the
  // player's y draws "below", above it draws "above".
  const lockPtr = mem8[TARGET_LOCK + 1] | (mem8[TARGET_LOCK + 2] << 8);
  if (mem8[lockPtr] >= playerY) setAimBelow(mem8);
  else setAimAbove(mem8);
}
