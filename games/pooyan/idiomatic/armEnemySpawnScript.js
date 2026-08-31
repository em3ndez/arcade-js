// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import {
  SCRIPT_ADVANCE_GUARD,
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  SCRIPT_ROW_TABLE,
  SCRIPT_DATA_TABLE_A,
  SCRIPT_DATA_TABLE_B,
  SCRIPT_VALUE_BYTE,
  SCRIPT_DELAY_TIMER,
  SCRIPT_DATA_PTR,
  ALT_TARGET_TABLE_PTR,
  SLOT_SPAWN_INDEX,
  LANE_RESET_LATCH,
} from "./names.js";
/**
 * armEnemySpawnScript — arm the board's scripted enemy-spawn sequence for the current round/stage.
 *
 * WHAT IT IS
 *   The one-shot that installs the "spawn script" the wave machinery then plays out. Every board
 *   drives its enemy releases from a small script chosen by the round: a run of stride-2
 *   {stage-threshold, value} records, plus two per-value data tables that seed a live cursor and an
 *   alternate target-column source. This routine finds the record matching where the stage clock
 *   has reached, seeds those live cells, and latches a guard so it re-arms exactly once per
 *   threshold as the stage drains.
 *
 * ROLE IN THE MACHINE
 *   The stage clock STAGE_COUNTDOWN (0x8901) counts down across a stage. Each board's script row
 *   lists the stage values at which a new spawn program should be installed. When the clock reaches
 *   one of those thresholds this routine re-arms: it seeds the live-script cursor SCRIPT_DATA_PTR
 *   (0x8d71) and its pacing timer SCRIPT_DELAY_TIMER (0x8d73) from data table A, points
 *   ALT_TARGET_TABLE_PTR (0x8d6f) at the selected row of data table B, resets the per-spawn tally,
 *   and re-opens the one-shot lane reset. The per-frame spawn tick (spawnNextScriptedEnemy) then
 *   walks that cursor to release enemies, reading the alternate-target pointer and the tally to
 *   pick each spawn's target column and animation. A nonzero guard means a program is already in
 *   force, so this stays inert until the guard is cleared.
 *
 * ROM 0x5150-0x5199 · grounding: [seen].
 *
 * LIVE-OUT: none (memory only) — everything it produces lives in the script/spawn RAM cells above.
 */
const STAGE_FLOOR = 0x07; //   the stage clock must still read this or more for the script to arm
const ROUND_MASK = 0x0f; //    keep the round to its low nibble as the row-table index
const RECORD_STRIDE = 2; //    a script record is a {threshold, value} pair, 2 bytes wide

export function armEnemySpawnScript(m) {
  const { mem8 } = m;
  // The advance guard SCRIPT_ADVANCE_GUARD (0x8d6d) holds the stage-threshold the script last armed
  // at; nonzero means a spawn program is already installed and still in force. Suppress re-arming
  // until it has been cleared elsewhere.
  if (mem8[SCRIPT_ADVANCE_GUARD] !== 0) return; // script busy

  // Pick this board's script row. ROUND_COUNTER (0x8907) masked to its low nibble indexes the word
  // table SCRIPT_ROW_TABLE (0x519a); the fetched word is the address of the row — a run of stride-2
  // {stage-threshold, value} records for this round.
  let row = fetchWordFromTableIndex(m, mem8[ROUND_COUNTER] & ROUND_MASK, SCRIPT_ROW_TABLE);
  // The stage clock STAGE_COUNTDOWN (0x8901) drains from its start value across the stage. The
  // script only installs a new program while the clock still reads STAGE_FLOOR (7) or more; once it
  // has drained below that the stage is nearly over and nothing more is armed.
  const stage = mem8[STAGE_COUNTDOWN];
  if (stage < STAGE_FLOOR) return; // stage below 7

  // Walk the row for the record whose threshold equals the current stage value. The records run in
  // descending threshold order (the scan relies on it): skip records whose threshold is still above
  // the stage (stage < threshold), match on equality, and give up once a threshold has dropped
  // below the stage (stage > threshold) — that stage value has no program to install this pass.
  for (;;) {
    const threshold = mem8[row];
    if (stage === threshold) break; // match
    if (stage >= threshold) return; // past the last matching record
    row = u16(row + RECORD_STRIDE);
  }

  // A record matched. Latch the guard at this threshold so nothing re-arms until it is cleared, then
  // read the record's value byte — the key that selects which spawn program to install. Stash it in
  // SCRIPT_VALUE_BYTE (0x8d74), where later spawn logic reads it as an index into the script flag
  // table.
  mem8[SCRIPT_ADVANCE_GUARD] = stage; // latch the guard at the matched threshold
  const value = mem8[u16(row + 1)];
  mem8[SCRIPT_VALUE_BYTE] = value;

  // Resolve the value through data table A: SCRIPT_DATA_TABLE_A (0x5264) is a word table indexed by
  // the value byte, and the word it yields addresses this program's script blob. The blob's first
  // byte is the initial delay, seated into SCRIPT_DELAY_TIMER (0x8d73) to pace the first release;
  // the bytes after it are the live script. Point the live cursor SCRIPT_DATA_PTR (0x8d71) one past
  // the delay byte, at the first script step, storing it as a 16-bit little-endian pointer.
  const dataA = fetchWordFromTableIndex(m, value, SCRIPT_DATA_TABLE_A);
  mem8[SCRIPT_DELAY_TIMER] = mem8[dataA];
  const ptr = u16(dataA + 1);
  mem8[SCRIPT_DATA_PTR] = ptr; // low byte (the store truncates)
  mem8[SCRIPT_DATA_PTR + 1] = ptr >> 8;

  // Resolve the same value through data table B: SCRIPT_DATA_TABLE_B (0x52b0), another word table,
  // yields the alternate target-column / animation source for this program. Store its address at
  // ALT_TARGET_TABLE_PTR (0x8d6f) as a 16-bit little-endian pointer; the spawn tick reads it
  // together with the per-spawn tally to choose each enemy's target column and animation.
  const dataB = fetchWordFromTableIndex(m, value, SCRIPT_DATA_TABLE_B);
  mem8[ALT_TARGET_TABLE_PTR] = dataB; // low byte
  mem8[ALT_TARGET_TABLE_PTR + 1] = dataB >> 8;

  // Fresh program installed: reset the per-spawn tally SLOT_SPAWN_INDEX (0x8d7b) to 0 so the first
  // spawn indexes the start of the alternate-target source, and clear the one-shot guard
  // LANE_RESET_LATCH (0x8d7e) so the state-0 lane reset is free to run again for this program.
  mem8[SLOT_SPAWN_INDEX] = 0x00;
  mem8[LANE_RESET_LATCH] = 0x00;
}
