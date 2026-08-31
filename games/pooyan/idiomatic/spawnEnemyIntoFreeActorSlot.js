// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { adjustSpawnColumn } from "./adjustSpawnColumn.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { decrementPhaseCounterAndDispatchSpawnOrStep } from "./decrementPhaseCounterAndDispatchSpawnOrStep.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  GAUGE_PHASE_COUNTER,
  SPAWN_COLUMN_BIAS,
  ENEMY_SPAWN_TIMER,
  ACTIVE_ENEMY_COUNT,
  ANIM_TABLE_3829,
  SPAWN_FIELD_TABLE,
  SPAWN_FIELD_TABLE_ODD,
  SPAWN_TIMER_TABLE_EVEN,
  SPAWN_TIMER_TABLE_ODD,
} from "./names.js";
/**
 * spawnEnemyIntoFreeActorSlot — try to bring one enemy actor to life in a single slot of the enemy-actor table.
 *
 * ROM 0x572b-0x57b3. Grounding: [seen].
 *
 * WHAT IT IS
 *   The spawn body of the enemy-attack subsystem. Enemies (wolves) live in the six-slot
 *   ENEMY_ACTOR_TABLE (0x8ae0), each a 0x18-byte record. When the spawn cadence elapses, a
 *   caller sweeps those six records in order and hands each one to this routine; the routine
 *   fills the first free slot it is given and reports back so the caller knows to stop. It is
 *   also reused by the sprite-block initialiser, which walks its own run of records through the
 *   same door with a different kind byte.
 *
 * ROLE IN THE MACHINE
 *   This is where a fresh enemy is stamped into being. It seeds the slot's fixed-layout record
 *   (active flag, state, kind), then derives a single "spawn column" index from the current
 *   difficulty, how far the phase gauge has drained, the parity of the round, and the round
 *   number itself. That column index is used two ways: it looks up the new enemy's travel
 *   velocity, and it looks up the reload value for the spawn-cadence countdown — so a harder or
 *   later round both speeds the enemy up and shortens the gap to the next spawn. Finally it arms
 *   the enemy's animation, bumps the live-enemy census, and runs the actor's own sub-state head
 *   for its first frame.
 *
 * ONE-PER-SCAN CONTRACT
 *   A slot whose low bit is already set is live; this routine leaves it alone and reports false
 *   so the caller keeps scanning. When it does fill an empty slot it reports true, and the
 *   caller aborts the rest of its sweep — exactly one enemy is born per cadence tick.
 *
 * LIVE-OUT
 *   A boolean: true = a fresh enemy was seated, the caller must skip the rest of its sweep;
 *   false = the slot was already live, keep scanning. Everything else it produces lives in
 *   memory — the seeded slot record, the reloaded ENEMY_SPAWN_TIMER (0x8d07), and the bumped
 *   ACTIVE_ENEMY_COUNT (0x8d40).
 */
export function spawnEnemyIntoFreeActorSlot(m, rec = m.regs.ix, col = m.regs.c, eField = m.regs.e) {
  const { mem8 } = m;

  // Occupancy test (ROM 0x572e-0x5733). The record's first two bytes carry the slot-active flag
  // in bit 0; OR them together and, if that bit is set, the slot already holds a live enemy —
  // report false so the caller advances to the next record and keeps scanning.
  if ((mem8[rec + 0x00] | mem8[rec + 0x01]) & 0x01) return false;

  // Seed the fresh record (ROM 0x5734-0x5753). Stamp the fixed identity fields — the active/lead
  // flag (+0x00), the actor state index (+0x02 = state 3), and the kind byte the caller supplied
  // in E (+0x04) — then clear the working fields (sub-position, travel/row counters, sub-state
  // and animation accumulators) to a clean start, leaving +0x07 seeded to 1.
  mem8[rec + 0x00] = 0x01;
  mem8[rec + 0x02] = 0x03;
  mem8[rec + 0x04] = eField;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x06] = 0x00;
  mem8[rec + 0x08] = 0x00;
  mem8[rec + 0x07] = 0x01;
  mem8[rec + 0x0b] = 0x00;

  // Round parity (ROM 0x5759/0x575b, sampled again at 0x5779 and 0x579f). ROUND_COUNTER (0x8907)
  // bit 0 splits the whole spawn into an odd-round variant and an even-round variant — it picks
  // which velocity and timer tables are read below, and it gates the early-stage column spread.
  const odd = mem8[ROUND_COUNTER] & 0x01;

  // Build the spawn-column index (ROM 0x5763-0x578a). This single index drives both the enemy's
  // speed and the reload cadence; it is assembled in four stages.
  //
  // Stage 1 (ROM 0x5763-0x576a): start from the difficulty setting DIFFICULTY_DSW (0x8820),
  // clamped to at most 3, so the DIP-switch value can never index past the low end of the tables.
  let column = Math.min(mem8[DIFFICULTY_DSW], 0x03); // clamp difficulty to 3
  // Stage 2 (ROM 0x576d-0x5776): once the phase gauge GAUGE_PHASE_COUNTER (0x8908) has drained to
  // its 4th phase or later, add the late-gauge bias SPAWN_COLUMN_BIAS (0x8d4c) — the game presses
  // harder as the gauge runs down. Below phase 4 the bias is skipped entirely.
  if (mem8[GAUGE_PHASE_COUNTER] >= 0x04) column = (mem8[SPAWN_COLUMN_BIAS] + column) & 0xff; // late-gauge bias
  // Stage 3 (ROM 0x5779-0x577e): on even rounds only, slide the column further right by the
  // wave's fill progress while the stage is still opening (adjustSpawnColumn), so early spawns
  // spread across the screen instead of stacking. Odd rounds skip this.
  if (!odd) column = adjustSpawnColumn(m, column); // even round: early-stage wave shift
  // Stage 4 (ROM 0x5781-0x578a): add the round number ROUND_COUNTER (0x8907) so later rounds bias
  // toward the higher table entries, then clamp below 0x20 — the arena is 32 columns wide, so the
  // index can never run off the end of the tables.
  column = Math.min((mem8[ROUND_COUNTER] + column) & 0xff, 0x1f); // add round, clamp below arena width

  // Enemy travel velocity (ROM 0x5756/0x5760 select, 0x578b-0x5793 read/store). Pick the velocity
  // table by round parity — SPAWN_FIELD_TABLE_ODD (0x58e0) on odd rounds, SPAWN_FIELD_TABLE
  // (0x5902) on even — index it with the spawn column, and store the byte as the record's velocity
  // (+0x09). Its two's-complement negation goes into the mirrored/paired velocity field (+0x0a).
  const velTable = odd ? SPAWN_FIELD_TABLE_ODD : SPAWN_FIELD_TABLE;
  const [vel] = fetchByteFromTableIndex(m, velTable, column);
  mem8[rec + 0x09] = vel;
  mem8[rec + 0x0a] = -vel; // mirrored (negated) velocity

  // Arm the animation (ROM 0x5796-0x5799). Point the new record at the 4-frame enemy animation
  // sequence ANIM_TABLE_3829 (0x3829) and restart it at frame 0, so the freshly spawned enemy
  // begins drawing from the first frame of its walk cycle.
  setActorAnimation(m, rec, ANIM_TABLE_3829);

  // Reload the spawn cadence (ROM 0x579c-0x57ab). Pick the timer table by the same round parity —
  // SPAWN_TIMER_TABLE_ODD (0x589b) on odd rounds, SPAWN_TIMER_TABLE_EVEN (0x58c0) on even — index
  // it with the same spawn column, and write the result into ENEMY_SPAWN_TIMER (0x8d07). That is
  // the countdown gating the next spawn, so the same column that set this enemy's speed also sets
  // how long until the next one is due.
  const timerTable = odd ? SPAWN_TIMER_TABLE_ODD : SPAWN_TIMER_TABLE_EVEN;
  const [timer] = fetchByteFromTableIndex(m, timerTable, column);
  mem8[ENEMY_SPAWN_TIMER] = timer;

  // Census + first frame (ROM 0x57ae-0x57b2). Bump the live-enemy count ACTIVE_ENEMY_COUNT
  // (0x8d40) so the spawn gate knows one more enemy is on the board, then run the new actor's
  // sub-state head for its opening frame — the spawn column (carried in `col`) doubles as the
  // phase counter that head decrements.
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] + 1;
  decrementPhaseCounterAndDispatchSpawnOrStep(m, col, rec); // run the scan-state head for the new actor
  // A slot was filled (ROM 0x57b3): report true so the caller aborts the rest of its sweep — only
  // one enemy is born per scan.
  return true; // spawned -> caller aborts its sweep
}
