// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  EAGLE_STEP_COUNTER,
  EAGLE_STAGE_TIMERS,
  ROUND_COUNTER,
  SPEED_INDEX,
  EAGLE_TARGET_COLUMN_BIAS,
  EAGLE_REARM_TABLE_5922,
  EAGLE_REARM_TABLE_5985,
} from "./names.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { decrementPhaseCounterAndDispatchSpawnOrStep } from "./decrementPhaseCounterAndDispatchSpawnOrStep.js";
/**
 * advanceEagleStageTimersAndLatchMoveElseRearm — eagle sub-state stepper / re-arm.
 *
 * WHAT IT IS
 * The per-servicing motion stepper for the eagle (the bonus-stage bird). The eagle flies its
 * approach as a short, scripted sequence of three "stages"; each stage owns a small countdown
 * timer, and while a stage's timer is running the eagle is pushed in one fixed direction at one
 * fixed speed. This routine is invoked once each time the eagle's sub-state is serviced. It does
 * one of two things:
 *   - ADVANCE: bump the step counter, drain one tick from the first still-running stage timer, and
 *     stamp that stage's canned move direction + speed onto the eagle's actor record; or
 *   - RE-ARM: when the script window is spent, reload a fresh three-stage timer script from a
 *     per-round table and immediately re-run the stepper so this servicing still produces motion.
 *
 * ROLE IN THE MACHINE
 * The eagle's flight is not steered continuously; it is played back from a canned three-timer
 * script that the machine reloads each time it runs out. The step counter (0x8d46) tracks how far
 * into the current script window we are: values 1..6 are the live window and advance; 0 or >=7 mean
 * the window is finished and a new script must be loaded. Which script is loaded depends on the
 * round: on some rounds the eagle's difficulty is keyed off the round number, on others off the
 * current speed setting biased by a per-eagle column target — giving faster/steeper flights as play
 * progresses.
 *
 * ROM 0x57c6. Grounding: [seen].
 *
 * MEMORY TOUCHED
 *   EAGLE_STEP_COUNTER (0x8d46)     — window position; 1..6 advances, 0/>=7 re-arms.
 *   EAGLE_STAGE_TIMERS (0x8d47..49) — the three per-stage countdown timers (stage 1/2/3).
 *   ROUND_COUNTER (0x8907)          — current round; its bit0 selects the reload table.
 *   SPEED_INDEX (0x8900) + EAGLE_TARGET_COLUMN_BIAS (0x8d4c) — combined into the reload index.
 *   EAGLE_REARM_TABLE_5985 / _5922  — the two ROM tables of three-byte timer records.
 *   record +0x13 / +0x16            — the eagle actor's move-direction and move-speed fields.
 *
 * LIVE-OUT: none — the caller discards the return; every effect is a write into memory.
 */
const COUNTER_LIMIT = 0x07; // counter 0 or >= this re-arms
const STAGE_MAX = 0x1f; // position clamps to this
const POSITION_CAP = 0x20; // position at or above this clamps

export function advanceEagleStageTimersAndLatchMoveElseRearm(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Read where we are in the current three-stage script window. The counter (EAGLE_STEP_COUNTER,
  // 0x8d46) walks 1..6 while a script is playing back; a value of 0 (never armed) or 7-and-up
  // (window exhausted) means there is no live script, so fall through to the re-arm path below.
  const counter = mem8[EAGLE_STEP_COUNTER];
  if (counter !== 0 && counter < COUNTER_LIMIT) {
    mem8[EAGLE_STEP_COUNTER] = counter + 1; // bump the step counter

    // Stage 1: the first of the three stage timers (0x8d47). While it is non-zero the eagle is in
    // its opening stage — spend one tick of it and stamp this stage's move direction (record +0x13)
    // and speed (record +0x16) onto the actor, then this servicing is done.
    if (mem8[EAGLE_STAGE_TIMERS] !== 0) {
      // stage 1 active
      mem8[EAGLE_STAGE_TIMERS] = mem8[EAGLE_STAGE_TIMERS] - 1;
      mem8[ix + 0x13] = 0x02;
      mem8[ix + 0x16] = 0x01;
      return;
    }
    // Stage 2: once stage 1's timer has drained, the second timer (0x8d48) governs. Spend one tick
    // and stamp the stage-2 direction/speed pair — a different heading (0x01) and speed byte (0xc1)
    // than stage 1, so the eagle changes its motion as the flight progresses.
    if (mem8[EAGLE_STAGE_TIMERS + 1] !== 0) {
      // stage 2 active
      mem8[EAGLE_STAGE_TIMERS + 1] = mem8[EAGLE_STAGE_TIMERS + 1] - 1;
      mem8[ix + 0x13] = 0x01;
      mem8[ix + 0x16] = 0xc1;
      return;
    }
    // Stage 3: the last timer (0x8d49). If it too is already zero the whole script window has run
    // dry within a live counter — nothing left to advance this servicing, so leave quietly. This is
    // the only advance-path exit that leaves the actor record untouched.
    if (mem8[EAGLE_STAGE_TIMERS + 2] === 0) return; // stage 3 idle
    // stage 3 active
    // Stage 3 spends a tick and stamps only the speed byte (record +0x16 = 0x41), leaving the
    // move-direction field (record +0x13) carrying whatever the previous stage set — the final
    // stage adjusts speed without re-steering.
    mem8[EAGLE_STAGE_TIMERS + 2] = mem8[EAGLE_STAGE_TIMERS + 2] - 1;
    mem8[ix + 0x16] = 0x41;
    return;
  }

  // re-arm
  // The script window is spent (counter 0 or >=7). Restart the window at 1 and load a fresh
  // three-stage timer script from ROM. Seat the counter first so the re-run below sees a live window.
  mem8[EAGLE_STEP_COUNTER] = 0x01;
  let table;
  let position;
  // Pick which reload table and index to use, keyed off the round. On even rounds (ROUND_COUNTER
  // bit0 clear) the difficulty tracks the round itself: use table 0x5985 indexed straight by the
  // round number. On odd rounds use table 0x5922, indexed by the current speed setting (SPEED_INDEX,
  // 0x8900) offset by this eagle's target-column bias (0x8d4c) — a harder, position-dependent flight.
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) {
    table = EAGLE_REARM_TABLE_5985;
    position = mem8[ROUND_COUNTER];
  } else {
    table = EAGLE_REARM_TABLE_5922;
    position = u8(mem8[SPEED_INDEX] + mem8[EAGLE_TARGET_COLUMN_BIAS]);
  }
  // Clamp the index so a large round number or speed+bias sum cannot run off the end of the table:
  // anything at or past 0x20 records is pinned to the last usable record (0x1f).
  if (position >= POSITION_CAP) position = STAGE_MAX; // clamp

  // fetch the record: base + 3*position, then the three record bytes into the stage timers
  // Each table entry is a three-byte record (one initial value per stage timer), so the byte offset
  // into the table is 3*position. Read the first byte at that entry and copy the record's three
  // bytes into EAGLE_STAGE_TIMERS (0x8d47/48/49) — the freshly loaded countdowns for the new window.
  const [byte0, ptr] = fetchByteFromTableIndex(m, table, 3 * position);
  mem8[EAGLE_STAGE_TIMERS] = byte0;
  mem8[EAGLE_STAGE_TIMERS + 1] = mem8[ptr + 1];
  mem8[EAGLE_STAGE_TIMERS + 2] = mem8[ptr + 2];

  // With a fresh script loaded and the counter back at 1, re-enter the eagle sub-state head so this
  // same servicing actually produces motion instead of spending a whole frame on the reload. The
  // 0xff marker steers the head to the stepper branch (a non-spawn re-run) rather than the spawn path.
  return decrementPhaseCounterAndDispatchSpawnOrStep(m, 0xff, ix); // re-run the state head with a non-spawn marker
}
