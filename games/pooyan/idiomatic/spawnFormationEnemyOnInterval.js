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
 * Below round 4 a difficulty gate can veto the tick: round < 2 needs difficulty >= 3, round in {2,3}
 * needs difficulty >= 2; round >= 4 always proceeds. Past the gate it drains the per-type countdown,
 * returning until it hits zero; on zero it reloads the countdown from the reload table (indexed by the
 * schedule cursor's low nibble), advances the cursor, and falls into the formation spawn loop.
 * LIVE-OUT: none — memory + the spawn it seeds; the caller reloads its own registers.
 */
const SLOT_STRIDE = 0x18; // formation-record stride
const SPAWN_COUNT = 0x01; // seed one slot per tick

export function spawnFormationEnemyOnInterval(m) {
  const { mem8 } = m;

  const round = mem8[ROUND_COUNTER];
  if (round < 0x04) {
    const difficulty = mem8[DIFFICULTY_DSW];
    if (round < 0x02 ? difficulty < 0x03 : difficulty < 0x02) return; // difficulty gate vetoes the tick
  }

  mem8[SPAWN_COUNTDOWN_A] = mem8[SPAWN_COUNTDOWN_A] - 1; // drain the per-type countdown (mem8 truncates)
  if (mem8[SPAWN_COUNTDOWN_A] !== 0) return; // still counting -> no spawn this tick

  const idx = mem8[SPAWN_TYPE_CURSOR] & 0x0f;
  mem8[SPAWN_COUNTDOWN_A] = fetchByteFromTableIndex(m, SPAWN_RELOAD_TABLE, idx)[0]; // reload from the table byte
  mem8[SPAWN_TYPE_CURSOR] = mem8[SPAWN_TYPE_CURSOR] + 1; // advance the schedule cursor (mem8 truncates)
  return seedFirstFreeActorBlockFromSpawnTypeTable(m, FORMATION_TABLE, SLOT_STRIDE, SPAWN_COUNT); // fall through into the spawn loop
}
