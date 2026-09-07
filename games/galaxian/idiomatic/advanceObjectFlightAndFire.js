// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectFlightAndFire -- object-AI state 3: the swooping attacker that also shoots at the player.
 *
 * WHAT IT IS
 *   Slot 3 of the sixteen-entry object-AI state table (the RST-28 driveObjectSlot dispatch table at ROM
 *   0x0ce6, entered at ROM 0x0e2b). It runs an attacker in its diving/flight leg: each frame it steps a
 *   per-object counter, integrates the flight curve, and recomputes the object's screen Y. It is the
 *   non-homing member of the pair; its homing sibling is advanceHomingObjectFlightAndFire (state 9).
 *
 * ROLE IN THE MACHINE
 *   Screen Y (ix+4) is the per-object Y increment (ix+9) plus the flight-curve heading high byte (ix+0x19)
 *   from advanceObjectFlightCurve (ROM 0x116b). Two exit tests end the leg: a Y that sits too high on
 *   screen ((Y+7) wraps below 0x0e) advances the state by 2, and a counter that has run out
 *   ((counter+0x48) carries, i.e. counter >= 0xb8) advances it by 1. Otherwise, and only while the object
 *   subsystem is enabled (OBJ_ACTIVE_FLAG 0x4200 bit0 set), it aims the heading octant toward the player
 *   (aimObjectAtTarget) and -- unless the delayed-event/inhibit bit 0x422b bit0 is set -- scans the row
 *   table at 0x4213 (seeded by selectAttackerRowScan: low byte = row count, high byte = the firing-row
 *   match value) for the object's counter, striding +0x19 per row. On a match it tail-calls
 *   spawnAimedProjectileAtPlayer (ROM 0x11e0) to launch an aimed shot; the counter's phase decides which
 *   rows fire, spreading the volley across attackers.
 *
 * ROM 0x0e2b.  Grounding: [seen] (write-tap confirmed; firing behaviour matched vs MAME).
 *
 * LIVE-OUT: object record cells -- counter ix+3, screen Y ix+4, state index ix+2, aimed heading (via
 * aimObjectAtTarget) -- the flight-curve accumulators, and (on a firing match) the projectile table.
 */
import { advanceObjectFlightCurve } from "./advanceObjectFlightCurve.js";
import { aimObjectAtTarget } from "./aimObjectAtTarget.js";
import { spawnAimedProjectileAtPlayer } from "./spawnAimedProjectileAtPlayer.js";
import { OBJ_ACTIVE_FLAG, loc_422b, loc_4213 } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const OBJ_STATE = 0x02;   // dispatch state index
const OBJ_POS = 0x03;     // per-object frame/step counter
const OBJ_Y = 0x04;       // computed screen Y
const OBJ_INC = 0x09;     // per-object Y increment
const OBJ_HEADING = 0x19; // flight-curve heading hi-byte

export function advanceObjectFlightAndFire(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Advance the per-object counter (ix+3), then run the flight-curve integrator (updates the heading bytes).
  mem8[obj + OBJ_POS] = mem8[obj + OBJ_POS] + 1;
  advanceObjectFlightCurve(m, obj);

  // Screen Y (ix+4) = per-object increment (ix+9) + flight-curve heading hi-byte (ix+0x19); store it.
  const y = (mem8[obj + OBJ_INC] + mem8[obj + OBJ_HEADING]) & 0xff;
  mem8[obj + OBJ_Y] = y;

  // Too high on screen ((Y+7) wraps below 0x0e): the swoop topped out -> advance the dispatch state by 2.
  if (((y + 0x07) & 0xff) < 0x0e) {
    mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 2;
    return;
  }

  // Counter ran out ((counter + 0x48) carries, i.e. counter >= 0xb8): advance the state by 1.
  if (mem8[obj + OBJ_POS] + 0x48 > 0xff) {
    mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 1;
    return;
  }

  // Gated by the object-active flag (0x4200) bit0: clear means the subsystem is off -> stop this frame.
  if ((mem8[OBJ_ACTIVE_FLAG] & 0x01) === 0) return;

  // Compute the direction octant toward the player target and store it back into the object record.
  aimObjectAtTarget(m, obj);

  // Gated by the delayed-event/inhibit bit 0x422b bit0: set means firing is inhibited -> stop.
  if ((mem8[loc_422b] & 0x01) !== 0) return;

  // Scan the row table (0x4213, seeded by selectAttackerRowScan): low byte = row count, high byte = match.
  let count = mem8[loc_4213];
  const matchValue = mem8[loc_4213 + 1];
  let a = mem8[obj + OBJ_POS];
  for (;;) {
    // This object's counter landed on a firing row -> hand off and launch an aimed shot at the player.
    if (a === matchValue) return spawnAimedProjectileAtPlayer(m, obj); // row matched -> hand off
    a = (a + 0x19) & 0xff;                         // next row stride
    count = (count - 1) & 0xff;
    // Ran through all `count` rows with no match -> no shot this frame.
    if (count === 0) break;
  }
}
