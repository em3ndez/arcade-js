// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceHomingObjectFlightAndFire (ROM 0x0faf) -- object-AI state handler for a diving alien that
 * homes its column toward the player while flying, and fires an aimed shot on cue.
 *
 * WHAT IT IS
 *   This is dispatch slot 9 of the object state machine (reached through the RST-28 dispatch table at
 *   0x0ce6). It runs for one enemy object record per call. It is the homing cousin of
 *   advanceObjectFlightAndFire: it does everything that routine does -- advance the per-object counter,
 *   integrate the flight curve, compute the screen Y, and either transition state or fire -- but adds a
 *   column-homing pre-step that pulls the diver's column toward the player's column so the dive tracks
 *   the ship.
 *
 * ROLE IN THE MACHINE
 *   Called from driveObjectSlot with `obj` = the record base (defaulting to IX, the ROM's object
 *   pointer). It reads the target/player column reference loc_4202 (0x4202), the frame parity of
 *   FRAME_COUNTER (0x425f), the object-subsystem gate OBJ_ACTIVE_FLAG (0x4200), the delayed-event bit
 *   loc_422b (0x422b), and the firing row table loc_4213 (0x4213; low byte = row count, high byte =
 *   the match value, seeded by selectAttackerRowScan). Fields within the record are the state index,
 *   step counter, screen Y, column, move throttle, mode selector, and flight-curve heading (offsets
 *   below). It tail-calls advanceObjectFlightCurve, aimObjectAtTarget, and (on a firing match)
 *   spawnAimedProjectileAtPlayer. names.js notes this handler is unreached in attract + 1P captures.
 *
 * Grounding: [seen] (names.js cert for 0x0faf).
 *
 * LIVE-OUT: the object record's OBJ_POS (counter), OBJ_COLUMN (homed), OBJ_Y (screen Y), OBJ_STATE
 *   (may become 5, 4, or dec), MOVE_THROTTLE; plus an aimed enemy shot on a firing-row match.
 */
import { advanceObjectFlightCurve } from "./advanceObjectFlightCurve.js";
import { aimObjectAtTarget } from "./aimObjectAtTarget.js";
import { spawnAimedProjectileAtPlayer } from "./spawnAimedProjectileAtPlayer.js";
import { OBJ_ACTIVE_FLAG, loc_4202, loc_422b, loc_4213, FRAME_COUNTER } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const OBJ_STATE = 0x02;     // dispatch state index
const OBJ_POS = 0x03;       // per-object frame/step counter
const OBJ_Y = 0x04;         // computed screen Y
const OBJ_COLUMN = 0x09;    // current column (homed toward the target) + screen-Y base
const MOVE_THROTTLE = 0x10; // move-throttle countdown
const OBJ_MODE = 0x17;      // mode selector
const OBJ_HEADING = 0x19;   // flight-curve heading hi-byte

export function advanceHomingObjectFlightAndFire(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Advance the per-object counter, then run the flight-curve integrator (updates the heading bytes).
  mem8[obj + OBJ_POS] = mem8[obj + OBJ_POS] + 1;
  advanceObjectFlightCurve(m, obj);

  // Mode selector decides whether to run the column-homing pre-step before the shared body:
  //   mode == 4 -> home only on odd frame parity; mode > 4 -> always home; mode < 4 -> skip.
  // The odd-parity case halves the homing rate so mode-4 divers chase the ship more gently.
  const mode = mem8[obj + OBJ_MODE];
  let chase;
  if (mode === 0x04) chase = (mem8[FRAME_COUNTER] & 0x01) !== 0;
  else if (mode > 0x04) chase = true;
  else chase = false;

  if (chase) {
    // Home the current column toward the target column loc_4202: step down when the record's column is
    // already past the target, up otherwise -- a one-per-tick pursuit of the player's column.
    if (mem8[loc_4202] < mem8[obj + OBJ_COLUMN]) {
      mem8[obj + OBJ_COLUMN] = mem8[obj + OBJ_COLUMN] - 1;
    } else {
      mem8[obj + OBJ_COLUMN] = mem8[obj + OBJ_COLUMN] + 1;
    }
  }

  // Shared body: screen Y = column + flight-curve heading; store it.
  // (OBJ_COLUMN doubles as the screen-Y base, so homing the column also steers the vertical position.)
  const y = (mem8[obj + OBJ_COLUMN] + mem8[obj + OBJ_HEADING]) & 0xff;
  mem8[obj + OBJ_Y] = y;

  // Too high on screen ((Y+7) wraps below 0x0e): the diver has flown off the top -> enter state 5.
  if (((y + 0x07) & 0xff) < 0x0e) {
    mem8[obj + OBJ_STATE] = 0x05;
    return;
  }

  // Counter ran out ((counter + 0x40) carries, i.e. counter >= 0xc0): the dive has lasted its span ->
  // enter state 4.
  if (mem8[obj + OBJ_POS] + 0x40 > 0xff) {
    mem8[obj + OBJ_STATE] = 0x04;
    return;
  }

  // Move-throttle countdown; on expiry advance the dispatch state (dec) and stop for this frame.
  const throttle = (mem8[obj + MOVE_THROTTLE] - 1) & 0xff;
  mem8[obj + MOVE_THROTTLE] = throttle;
  if (throttle === 0) {
    mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] - 1;
    return;
  }

  // Gated by the object-active flag bit0: clear -> the object subsystem is off, stop this frame.
  if ((mem8[OBJ_ACTIVE_FLAG] & 0x01) === 0) return;

  // Compute the direction octant toward the target and store it in the object record (for the shot aim).
  aimObjectAtTarget(m, obj);

  // Gated by the delayed-event bit0 loc_422b: set -> a delayed event is pending, so hold fire this frame.
  if ((mem8[loc_422b] & 0x01) !== 0) return;

  // Firing test: scan the row table. Low byte = number of rows to try, high byte = the match value.
  // Starting from this object's counter, step by the fixed row stride 0x19 up to `count` times; if the
  // running value equals matchValue this object is on a firing row and it hands off to spawn a shot.
  let count = mem8[loc_4213];
  const matchValue = mem8[loc_4213 + 1];
  let a = mem8[obj + OBJ_POS];
  for (;;) {
    if (a === matchValue) return spawnAimedProjectileAtPlayer(m, obj); // row matched -> hand off
    a = (a + 0x19) & 0xff;                         // next row stride
    count = (count - 1) & 0xff;
    if (count === 0) break;
  }
}
