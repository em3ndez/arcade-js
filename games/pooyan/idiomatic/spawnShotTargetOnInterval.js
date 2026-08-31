// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { seedFirstFreeSlotForScheduledSpawn } from "./seedFirstFreeSlotForScheduledSpawn.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  SPAWN_INTERVAL_COUNTDOWN,
  SPAWN_INTERVAL_TABLE_55FF,
  SPAWN_SEQUENCE_INDEX_8D13,
  SPAWN_OBJECT_TABLE,
} from "./names.js";
/**
 * spawnShotTargetOnInterval — one of the periodic spawners: it is offered a chance each time it runs
 * to drop a fresh shootable target into the arena, but only fires on a throttle.
 *
 * WHAT IT IS
 *   Spawn scheduler B (ROM 0x5519-0x5543). Grounding: [seen]. Pooyan keeps a small pool of
 *   "shot-target" records — the objects the player's arrows are hit-tested against — in the
 *   spawned-object table SPAWN_OBJECT_TABLE (0x8c48). Something has to decide, frame by frame, WHEN to
 *   introduce a fresh one so the screen fills at the right pace. This routine is that decision: it
 *   applies a difficulty gate and a cadence throttle, and only when both allow does it hand the work
 *   to the spawn loop that actually claims a free record and brings the new target to life.
 *
 * ROLE IN THE MACHINE
 *   This is a paced spawner, not a one-shot. Each time it runs it first checks whether spawning is
 *   allowed at all (a round/difficulty gate), then ticks a per-type countdown; the countdown is what
 *   spreads spawns out over time, so most runs simply decrement it and return. Only when the
 *   countdown reaches zero does a spawn actually happen. On that firing run it reloads the countdown
 *   from a ROM interval table and advances a rotating cursor, so the delay until the NEXT target
 *   varies from one spawn to the next (the cadence walks through a scheduled sequence of intervals
 *   rather than being fixed). It is the sibling of spawn scheduler A, which fills the formation pool
 *   the same way; the two run off separate countdowns and separate pools. The routine ends by running
 *   straight into the shared spawn loop seedFirstFreeSlotForScheduledSpawn, which does the actual
 *   record allocation and initialisation.
 *
 * LIVE-OUT
 *   Memory only. It leaves the ticked/reloaded countdown in SPAWN_INTERVAL_COUNTDOWN (0x8d05) and the
 *   advanced cursor in SPAWN_SEQUENCE_INDEX_8D13 (0x8d13); on a firing run the spawn loop also stamps
 *   a new record into SPAWN_OBJECT_TABLE (0x8c48). No register carries a result — every caller reads
 *   the outcome back out of memory.
 */

// Inputs handed to the spawn loop once a spawn fires, plus the gate thresholds. An actor record is a
// flat run of bytes; the stride is the step from one record to the next, and the count bounds how
// many records the loop will examine.
const SPAWN_STRIDE = 0x18; //  block stride handed to the spawn loop
const SPAWN_COUNT = 0x01; //   one block per call
const MIN_ROUND = 0x02; //     round >= 2 skips the difficulty gate
const MIN_DIFFICULTY = 0x02; // round < 2 needs difficulty >= 2
const INDEX_MASK = 0x0f;

export function spawnShotTargetOnInterval(m) {
  // mem8 is the byte-addressed view of work RAM: the gate cells, the countdown, and the rotating
  // cursor all live here.
  const { mem8 } = m;

  // The round/difficulty gate (ROM 0x5519-0x5525). From round 2 onward this spawner always runs, so
  // the difficulty check is skipped. Before round 2 it runs only when the cabinet is set to at least
  // the middle difficulty (DIFFICULTY_DSW 0x8820 >= 2) — on the easiest setting the earliest rounds
  // suppress this whole spawner. ROUND_COUNTER is 0x8907. A vetoed run spawns nothing and returns.
  if (mem8[ROUND_COUNTER] < MIN_ROUND && mem8[DIFFICULTY_DSW] < MIN_DIFFICULTY) return;

  // Tick the per-type spawn countdown SPAWN_INTERVAL_COUNTDOWN (0x8d05) down by one (ROM 0x5526-0x552a,
  // an 8-bit dec that wraps 0x00 -> 0xff). This countdown is what paces the spawner: it is decremented
  // on every run and only a zero result lets a spawn through, so the pool is refreshed on an interval
  // rather than every frame.
  const countdown = (mem8[SPAWN_INTERVAL_COUNTDOWN] - 1) & 0xff;
  mem8[SPAWN_INTERVAL_COUNTDOWN] = countdown;
  if (countdown !== 0) return; // per-type countdown still running -> no spawn this run

  // Countdown hit zero: it is time to spawn, so first reload it for the next interval and advance the
  // cadence cursor (ROM 0x552b-0x553e). The rotating cursor SPAWN_SEQUENCE_INDEX_8D13 (0x8d13) picks
  // the interval: its low nibble indexes the ROM reload-value table SPAWN_INTERVAL_TABLE_55FF (0x55ff),
  // and that byte becomes the new countdown. Because the cursor is bumped on every firing run, the
  // reloaded interval walks through the table's scheduled sequence, giving the spawner a varying
  // cadence instead of a fixed one.
  const idx = mem8[SPAWN_SEQUENCE_INDEX_8D13] & INDEX_MASK;
  const [reload] = fetchByteFromTableIndex(m, SPAWN_INTERVAL_TABLE_55FF, idx); // look up interval-table byte
  mem8[SPAWN_INTERVAL_COUNTDOWN] = reload; // reload the countdown for the next interval
  mem8[SPAWN_SEQUENCE_INDEX_8D13] = mem8[SPAWN_SEQUENCE_INDEX_8D13] + 1; // advance cadence cursor (write truncates to 8 bits)

  // Fire the spawn (ROM 0x553f-0x5544 into the loop at 0x5544). Point the spawn loop at the
  // spawned-object pool SPAWN_OBJECT_TABLE (0x8c48), tell it the record stride (0x18) and how many
  // records to scan (one block). The loop walks the pool, claims the first free record, and
  // initialises one new shot-target there — exactly one target is born per firing run.
  return seedFirstFreeSlotForScheduledSpawn(m, SPAWN_OBJECT_TABLE, SPAWN_STRIDE, SPAWN_COUNT); // fall through into the spawn loop
}
