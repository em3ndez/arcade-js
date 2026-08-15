// SPDX-License-Identifier: GPL-3.0-only
/**
 * rideRiverLaneAndCommitArrival — the four river ride lanes' begin/commit handlers (one multi-entry unit).
 * A BEGIN handler starts a ride: guards on frog position, on a fresh ride emits the ride sound and stamps
 * the lane's ride sprite, primes the ride counter from its reload length, then falls into the lane's commit
 * (a frog already showing the ride sprite re-primes without bumping; a bump that wraps bails). A COMMIT
 * handler advances the ride one frame: returns once the lane has arrived, else raises the lane direction
 * flag and ticks the counter down — on drain marks arrival + stamps the home sprite, otherwise carries the
 * riding frog by the lane delta + stamps the moving sprite. Vertical lanes 0/1 move FROG_Y, horizontal lanes
 * 2/3 move FROG_X (even lane forward, odd back). Lane 1 also steps the slot cursor and scores row progress.
 * All eight entries are reached with the frog X/Y cursors armed. LIVE-OUT: memory-only.
 */
import {
  FROG_X, FROG_Y, FROG_SPRITE_CODE,
  RIVER_LANE0_DIR, RIVER_LANE1_DIR, RIVER_LANE2_DIR, RIVER_LANE3_DIR,
  RIVER_LANE0_ARRIVAL, RIVER_LANE1_ARRIVAL, RIVER_LANE2_ARRIVAL, RIVER_LANE3_ARRIVAL,
  RIVER_LANE0_RIDE_COUNTER, RIVER_LANE1_RIDE_COUNTER, RIVER_LANE2_RIDE_COUNTER, RIVER_LANE3_RIDE_COUNTER,
  RIVER_VERTICAL_RIDE_DELTA, RIVER_HORIZONTAL_RIDE_DELTA,
  RIVER_LANE0_RIDE_RELOAD, RIVER_LANE1_RIDE_RELOAD, RIVER_LANE2_RIDE_RELOAD, RIVER_LANE3_RIDE_RELOAD,
} from "./names.js";
import { loc_23eb } from "./loc_23eb.js";
import { scoreFrogRowProgress } from "./scoreFrogRowProgress.js";

const RIDE_SOUND = 0x04;       // sound command emitted when a ride begins
const SOUND_ENQUEUE = 0x0018;  // enqueues the byte in A into the sound-command ring

// Per-lane sprite codes: the ride/home code (idle, riding-begin and arrived) and the moving code (carrying).
const LANE0_RIDE_CODE = 0xde, LANE0_MOVE_CODE = 0xdc;
const LANE1_RIDE_CODE = 0x1e, LANE1_MOVE_CODE = 0x1c;
const LANE2_RIDE_CODE = 0xa1, LANE2_MOVE_CODE = 0x9f;
const LANE3_RIDE_CODE = 0x21, LANE3_MOVE_CODE = 0x1f;

// Emit the ride-start sound: A holds the command, then the ring enqueue runs; `ret` is where it returns.
function enqueueRideSound(m, ret) {
  m.regs.a = RIDE_SOUND;
  m.push16(ret);
  m.call(SOUND_ENQUEUE);
}

// Shared begin body: fresh ride primes the sprite + counter, else the counter just re-primes, then commit.
function beginRide(m, counter, reload, rideCode, soundRet, commit) {
  const mem = m.mem8;
  if (mem[counter] === 0) {
    enqueueRideSound(m, soundRet);
    if (mem[FROG_SPRITE_CODE] === rideCode) {
      mem[counter] = mem[reload]; // frog already showing the ride sprite: re-prime and commit, no bump
      return commit(m);
    }
    mem[FROG_SPRITE_CODE] = rideCode;
  }
  const bumped = (mem[counter] + 1) & 0xff;
  mem[counter] = bumped;
  if (bumped === 0) return; // the bump wrapped: bail with the counter left at zero
  mem[counter] = mem[reload];
  return commit(m);
}

// Shared commit body for the plain lanes: arrive-once guard, tick down, then arrive or carry the frog.
function commitRide(m, arrival, dir, counter, rideCode, moveCode, carry) {
  const mem = m.mem8;
  if (mem[arrival] !== 0) return; // this ride has already arrived
  mem[dir] = 1;
  const left = (mem[counter] - 1) & 0xff;
  mem[counter] = left;
  if (left === 0) {
    mem[dir] = 0;
    mem[arrival] = 1;
    mem[FROG_SPRITE_CODE] = rideCode;
    return;
  }
  carry(m);
  mem[FROG_SPRITE_CODE] = moveCode;
}

const carryVerticalForward = (m) => {
  m.mem8[FROG_Y] = (m.mem8[FROG_Y] + m.mem8[RIVER_VERTICAL_RIDE_DELTA]) & 0xff;
};
const carryHorizontalForward = (m) => {
  m.mem8[FROG_X] = (m.mem8[FROG_X] + m.mem8[RIVER_HORIZONTAL_RIDE_DELTA]) & 0xff;
};
const carryHorizontalBackward = (m) => {
  m.mem8[FROG_X] = (m.mem8[FROG_X] - m.mem8[RIVER_HORIZONTAL_RIDE_DELTA]) & 0xff;
};

export function beginRiverLane0Ride(m) {
  if (m.mem8[FROG_Y] >= 0xf0) return; // frog past the bottom edge: no ride
  return beginRide(m, RIVER_LANE0_RIDE_COUNTER, RIVER_LANE0_RIDE_RELOAD, LANE0_RIDE_CODE, 0x1b9a, commitRiverLane0Arrival);
}
export function commitRiverLane0Arrival(m) {
  commitRide(m, RIVER_LANE0_ARRIVAL, RIVER_LANE0_DIR, RIVER_LANE0_RIDE_COUNTER, LANE0_RIDE_CODE, LANE0_MOVE_CODE, carryVerticalForward);
}

export function beginRiverLane1Ride(m) {
  return beginRide(m, RIVER_LANE1_RIDE_COUNTER, RIVER_LANE1_RIDE_RELOAD, LANE1_RIDE_CODE, 0x1bed, commitRiverLane1Arrival);
}
export function commitRiverLane1Arrival(m) {
  const mem = m.mem8;
  loc_23eb(m); // advance the home-bay slot cursor; its A output is discarded below
  if (mem[RIVER_LANE1_ARRIVAL] !== 0) return;
  mem[RIVER_LANE1_DIR] = 1;
  const left = (mem[RIVER_LANE1_RIDE_COUNTER] - 1) & 0xff;
  mem[RIVER_LANE1_RIDE_COUNTER] = left;
  if (left === 0) {
    mem[RIVER_LANE1_DIR] = 0;
    mem[RIVER_LANE1_ARRIVAL] = 1;
    mem[FROG_SPRITE_CODE] = LANE1_RIDE_CODE;
    scoreFrogRowProgress(m); // DE is scratch here, not live-out
    return;
  }
  mem[FROG_Y] = (mem[FROG_Y] - mem[RIVER_VERTICAL_RIDE_DELTA]) & 0xff;
  mem[FROG_SPRITE_CODE] = LANE1_MOVE_CODE;
}

export function beginRiverLane2Ride(m) {
  const mem = m.mem8;
  if (mem[FROG_Y] < 0x30) return; // frog above the river band: no ride
  if (mem[FROG_X] >= 0xe0) return; // frog past the right edge: no ride
  return beginRide(m, RIVER_LANE2_RIDE_COUNTER, RIVER_LANE2_RIDE_RELOAD, LANE2_RIDE_CODE, 0x1c56, commitRiverLane2Arrival);
}
export function commitRiverLane2Arrival(m) {
  commitRide(m, RIVER_LANE2_ARRIVAL, RIVER_LANE2_DIR, RIVER_LANE2_RIDE_COUNTER, LANE2_RIDE_CODE, LANE2_MOVE_CODE, carryHorizontalForward);
}

export function beginRiverLane3Ride(m) {
  const mem = m.mem8;
  if (mem[FROG_Y] < 0x30) return; // frog above the river band: no ride
  if (mem[FROG_X] < 0x20) return; // frog past the left edge: no ride
  return beginRide(m, RIVER_LANE3_RIDE_COUNTER, RIVER_LANE3_RIDE_RELOAD, LANE3_RIDE_CODE, 0x1cb5, commitRiverLane3Arrival);
}
export function commitRiverLane3Arrival(m) {
  commitRide(m, RIVER_LANE3_ARRIVAL, RIVER_LANE3_DIR, RIVER_LANE3_RIDE_COUNTER, LANE3_RIDE_CODE, LANE3_MOVE_CODE, carryHorizontalBackward);
}
