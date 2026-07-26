// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_384a — per-frame animate + march step for an active object.  ROM 0x384a.
 *
 * Runs once a frame for an object that is already alive (its caller loc_37cf tail-jumps
 * here when the object's spawn flag is set). It does three things, in order:
 *
 *   1. Cadence tick. Count the object's frame timer down. Each time it underflows,
 *      reload it to 8 frames and flip the walk-cycle tile between its two frames,
 *      storing the paired code to the shadow sprite.
 *   2. Move gate. Only every 4th tick actually moves the object; on the other three the
 *      routine just rebuilds the object's sprite records (loc_3a4c) and exits.
 *   3. March, then descend. On a move tick, while the object is on its travel row it
 *      steps right one column (mirroring to the shadow shifted 16 across). Once it has
 *      marched to the far column it latches its arrival — clearing the arrival flag and
 *      the probe X, building the object's probe record (loc_1b5b) — and then, on this and
 *      every later move tick, descends one row toward the floor. At the floor (Y 0) it
 *      idles: if the hold timer is still running it just waits, otherwise it re-arms the
 *      120-frame hold and resets the tile to its idle frame.
 *
 * A sibling of loc_3748 / loc_3968 in the object-movement family; the exact object this
 * drives (which enemy / the UFO) is not yet pinned, so the name stays neutral rather than
 * assert a role above the evidence.
 *
 * Every non-idle exit rebuilds the two sprite records via loc_3a4c (a tail call whose ret
 * carries straight back to our caller's caller). The one idle exit — floor reached while
 * the hold timer is still running — returns directly.
 *
 * Memory-equivalent to the frozen oracle — equivalence-384a.test.js.
 * GATE:     crafted-entry + realism — dispatched in attract's gameplay demo (~584 times
 *           after frame 4000). Every real dispatch is replayed oracle-vs-idiomatic on a
 *           fresh clone and compared on full work RAM; crafted entries force the arms the
 *           demo underexercises (the floor re-arm, both tile-toggle directions). Teeth: a
 *           wrong shadow-X offset twin.
 * LIVE-OUT: memory-only. Non-idle exits route through loc_3a4c, which reloads the whole
 *           register file, so nothing the object leaves in a register survives; the idle
 *           direct-return's residual accumulator is dead ABI (the caller chain is all
 *           tail-jumps that read no returned register), backstopped by the whole-machine
 *           gate.
 * NAMES:    ACTOR_TIMER, ACTOR_TILE, ACTOR_X, ACTOR_Y, TWIN_X, TWIN_TILE, TWIN_CLEAR,
 *           OBJ_X from ram.js. Hex-kept (unnamed in ram.js): 0x8079 arrival flag,
 *           0x807c floor hold-timer, 0x807d arrival latch.
 */

import {
  ACTOR_TIMER, ACTOR_TILE, ACTOR_X, ACTOR_Y,
  TWIN_X, TWIN_TILE, TWIN_CLEAR, OBJ_X,
} from "./ram.js";

const ARRIVAL_FLAG = 0x8079; // cleared on arrival at the far column (unnamed in ram.js)
const FLOOR_HOLD = 0x807c; // countdown that idles the object at the floor (unnamed in ram.js)
const ARRIVAL_LATCH = 0x807d; // set to 1 the frame the object reaches the far column (unnamed in ram.js)

const WALK_TILE_A = 46; // the two frames of the walk-cycle animation
const WALK_TILE_B = 175;
const IDLE_TILE = 9; // tile shown once the object settles at the floor
const CADENCE = 8; // frames between walk-tile flips
const FLOOR_HOLD_FRAMES = 120; // how long the object idles at the floor
const TRAVEL_ROW = 23; // Y at or above which the object is still marching, not descending
const FAR_COLUMN = 36; // X the march stops at, where the descent begins
const SHADOW_X_OFFSET = 16; // the shadow sprite trails the object by this many columns

export function loc_384a(m) {
  const { mem } = m;

  // 1. Cadence tick — count the frame timer down (wrapping at 0), and on underflow
  //    reload it and flip to the other walk tile.
  mem.write8(ACTOR_TIMER, mem.read8(ACTOR_TIMER) - 1);
  let timer = mem.read8(ACTOR_TIMER);
  if (timer === 0) {
    timer = CADENCE;
    mem.write8(ACTOR_TIMER, CADENCE);
    const next = mem.read8(ACTOR_TILE) === WALK_TILE_A ? WALK_TILE_B : WALK_TILE_A;
    mem.write8(ACTOR_TILE, next);
    mem.write8(TWIN_TILE, next ^ 1); // shadow shows the paired tile (bit 0 flipped)
  }

  // 2. Move gate — only every 4th tick moves; otherwise just rebuild the sprite records.
  if (timer % 4 !== 0) return m.call(0x3a4c);

  // 3a. March across the travel row.
  const y = mem.read8(ACTOR_Y);
  if (y >= TRAVEL_ROW) {
    const x = mem.read8(ACTOR_X);
    if (x < FAR_COLUMN) {
      // Step right one column; the shadow trails 16 columns behind.
      mem.write8(ACTOR_X, x + 1);
      mem.write8(TWIN_X, mem.read8(ACTOR_X) + SHADOW_X_OFFSET);
      return m.call(0x3a4c);
    }
    if (y === TRAVEL_ROW) {
      // Reached the far column on the travel row: latch the arrival and build the probe
      // record before the descent begins.
      mem.write8(ARRIVAL_FLAG, 0);
      mem.write8(OBJ_X, 0);
      mem.write8(ARRIVAL_LATCH, 1);
      // loc_1b5b is still the frozen oracle and returns through the stack, so seed the
      // return address it pops.
      m.push16(0x3897);
      m.call(0x1b5b);
    }
    // y above the travel row (or just latched): fall into the descent.
  }

  // 3b. Descend toward the floor, or idle once there.
  const row = mem.read8(ACTOR_Y);
  if (row !== 0) {
    // Step down one row; mirror to the shadow.
    const nextRow = row - 1;
    mem.write8(ACTOR_Y, nextRow);
    mem.write8(TWIN_CLEAR, nextRow);
    return m.call(0x3a4c);
  }

  // At the floor. While the hold timer is still running, just wait.
  if (mem.read8(FLOOR_HOLD) !== 0) return;

  // Hold elapsed: re-arm it and drop the object to its idle tile.
  mem.write8(FLOOR_HOLD, FLOOR_HOLD_FRAMES);
  mem.write8(ACTOR_TILE, IDLE_TILE);
  mem.write8(TWIN_TILE, IDLE_TILE);
  return m.call(0x3a4c);
}
