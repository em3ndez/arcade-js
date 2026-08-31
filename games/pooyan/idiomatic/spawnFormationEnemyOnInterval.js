// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { seedFirstFreeActorBlockFromSpawnTypeTable } from "./seedFirstFreeActorBlockFromSpawnTypeTable.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  SPAWN_COUNTDOWN_A,
  SPAWN_RELOAD_TABLE,
  SPAWN_TYPE_CURSOR,
  FORMATION_TABLE,
} from "./names.js";
/**
 * spawnFormationEnemyOnInterval — spawn scheduler A.
 *
 * ROM 0x54c5-0x54f8. Grounding: [seen].
 *
 * WHAT IT IS. This is one of Pooyan's enemy-spawn schedulers, run once per frame. Its job is to
 * decide, on this frame, whether it is time to bring a new formation enemy into the world, and if so
 * to bring exactly one. It does this with a countdown timer: every frame the timer ticks down by one,
 * and only on the frame it reaches zero does a spawn fire. The gap between spawns is not fixed — each
 * time the timer expires it is reloaded from a table, so the schedule can breathe (short waits at some
 * points, long waits at others). Ahead of the timer sits a gate that can suppress spawning entirely on
 * the easiest settings during the opening rounds.
 *
 * ITS ROLE IN THE MACHINE. It feeds the formation-object pool: when it decides to spawn, it hands off
 * to the shared formation spawn loop, which finds a free record in the formation table (RAM 0x8c30) and
 * fills it in with a fresh enemy. A single schedule cursor threads through the whole thing — its low
 * nibble picks BOTH the next wait interval here AND the kind of enemy the spawn loop will create — so
 * advancing that cursor moves the entire attack schedule forward one step.
 *
 * LIVE-OUT: none — the routine leaves its results in memory (the drained/reloaded countdown, the
 * advanced schedule cursor, and the newly-seeded formation record); the caller reloads its own
 * registers and does not read anything back from here.
 */
const SLOT_STRIDE = 0x18; // stride between records in the formation table: 0x18 bytes per actor record
const SPAWN_COUNT = 0x01; // how many records the spawn loop is told to examine (B=1) — it seeds at most one formation slot per tick

export function spawnFormationEnemyOnInterval(m) {
  const { mem8 } = m;

  // STEP 1 — round + difficulty gate. Read the current round from ROUND_COUNTER (RAM 0x8907). From
  // round 4 onward this scheduler always runs; below round 4 it is gated on the operator difficulty
  // switch DIFFICULTY_DSW (RAM 0x8820, a 3-bit value where higher = harder). The intent is to hold
  // formation spawns back early in the game on gentler settings and let them start sooner on harder
  // ones: in the opening rounds (0 and 1) the difficulty must be at least 3 to proceed, and in rounds
  // 2 and 3 at least 2. If the setting is below that threshold the tick is vetoed and nothing spawns.
  const round = mem8[ROUND_COUNTER];
  if (round < 0x04) {
    const difficulty = mem8[DIFFICULTY_DSW];
    if (round < 0x02 ? difficulty < 0x03 : difficulty < 0x02) return; // difficulty gate vetoes the tick
  }

  // STEP 2 — drain the per-type spawn countdown. SPAWN_COUNTDOWN_A (RAM 0x8d04) paces spawns from this
  // scheduler: tick it down by one every frame, and spawn only on the frame it reaches zero. The store
  // truncates to 8 bits (so 0x00 would wrap to 0xff), matching the hardware decrement; while the timer
  // is still above zero there is no spawn due, so return and wait for a later frame.
  mem8[SPAWN_COUNTDOWN_A] = mem8[SPAWN_COUNTDOWN_A] - 1; // drain the per-type countdown (mem8 truncates)
  if (mem8[SPAWN_COUNTDOWN_A] !== 0) return; // still counting -> no spawn this tick

  // STEP 3 — reload the countdown and step the schedule. The timer has expired, so reload it for the
  // next interval and advance the schedule. The reload value comes from SPAWN_RELOAD_TABLE (ROM 0x55ef),
  // a per-position table of wait lengths, indexed by the low nibble of the schedule cursor
  // SPAWN_TYPE_CURSOR (RAM 0x8d12) — so successive points in the schedule can wait different amounts.
  const idx = mem8[SPAWN_TYPE_CURSOR] & 0x0f;
  mem8[SPAWN_COUNTDOWN_A] = fetchByteFromTableIndex(m, SPAWN_RELOAD_TABLE, idx)[0]; // reload from the table byte
  // Advance the schedule cursor by one (the store truncates to 8 bits, matching the hardware increment).
  // The same cursor's low nibble also selects WHICH kind of enemy the spawn loop below creates, so this
  // single increment carries the whole attack schedule forward one step: next wait interval + next kind.
  mem8[SPAWN_TYPE_CURSOR] = mem8[SPAWN_TYPE_CURSOR] + 1; // advance the schedule cursor (mem8 truncates)

  // STEP 4 — spawn one formation enemy. Hand off to the shared formation spawn loop over the formation
  // object table FORMATION_TABLE (RAM 0x8c30), stepping SLOT_STRIDE (0x18) bytes between records and
  // examining SPAWN_COUNT (1) record: it finds a free formation slot and brings one new enemy to life
  // there, keyed to the schedule position we just stepped to. Its result is this routine's result.
  return seedFirstFreeActorBlockFromSpawnTypeTable(m, FORMATION_TABLE, SLOT_STRIDE, SPAWN_COUNT); // fall through into the spawn loop
}
