// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { initEnemyFormationRecord } from "./initEnemyFormationRecord.js";
import { ROUND_COUNTER, FORMATION_TABLE, FORMATION_SPAWN_INDEX, FORMATION_STATE_ROW2 } from "./names.js";
/**
 * spawnEnemyFormation — enemy-formation spawn driver.
 * ROM 0x540d-0x5432. [seen]
 *
 * WHAT IT IS
 * The per-frame driver that kicks off a whole enemy formation. A "formation" is a group of
 * enemies described by four parallel parameter tables in ROM — one entry per member — that say
 * how each enemy moves, how fast, and which animation it runs. This routine is the thing that
 * starts a fresh formation: it rewinds the shared "next entry" cursor to the top of those
 * tables and then brings the first three formation actor records to life in order, one per
 * parameter-table entry.
 *
 * ROLE IN THE MACHINE
 * Formations only appear on odd rounds, so the whole routine is gated on the low bit of the
 * round counter: on an even round it does nothing at all. On an odd round it first zeroes two
 * six-byte bookkeeping rows — the row headed by the formation spawn cursor and its neighbouring
 * per-type spawn countdowns (FORMATION_SPAWN_INDEX, 0x8d01) and a second formation state row
 * (FORMATION_STATE_ROW2, 0x8d11) — so the formation's spawn scheduler restarts from a clean
 * slate. It then walks the first three slots of the formation record table (FORMATION_TABLE,
 * 0x8c30, stride 0x18) and initialises each. Every init reads the parameter entry the spawn
 * cursor currently names and then bumps that cursor, so the three records consume the first
 * three formation entries (0, 1, 2) in succession. Each initialised record is an ordinary
 * 0x18-byte actor slot, driven thereafter by the normal per-record state and animation sweeps
 * like any other enemy.
 *
 * LIVE-OUT: none — a void per-frame driver. It leaves the two blanked rows and three freshly
 * armed formation records (plus the advanced spawn cursor) in work RAM; nothing is returned to
 * the caller.
 */

// Stride between adjacent records in the formation table (0x8c30): each actor slot is 0x18 bytes.
const RECORD_STRIDE = 0x18; // formation record stride
// This driver arms only the first three formation slots per spawn.
const RECORD_COUNT = 3;
// Length of each bookkeeping row blanked at entry: six bytes.
const ROW_BYTES = 6;

export function spawnEnemyFormation(m) {
  const { mem8 } = m;

  // --- Round gate -------------------------------------------------------------------------
  // Formations spawn on odd rounds only. ROUND_COUNTER (0x8907) bit0 selects the current
  // round's stage-type / facing variant; when it is clear the round is "even" and no formation
  // is wanted here, so bail immediately and leave every formation cell untouched.
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return; // even round -> gate closed

  // --- Rewind the formation bookkeeping ---------------------------------------------------
  // Zero the six-byte row headed by FORMATION_SPAWN_INDEX (0x8d01). This resets the shared
  // spawn cursor back to entry 0 — so the records armed below read the formation description
  // from the top — together with the adjacent per-type spawn countdown timers that share the
  // row (0x8d04/0x8d05/0x8d06). Then zero the second six-byte formation state row at
  // FORMATION_STATE_ROW2 (0x8d11). Both blanks put the formation's spawn scheduler on a clean
  // slate for this fresh formation.
  fillByteRun(m, FORMATION_SPAWN_INDEX, 0x00, ROW_BYTES);
  fillByteRun(m, FORMATION_STATE_ROW2, 0x00, ROW_BYTES);

  // --- Arm the first three formation records ----------------------------------------------
  // Walk the formation record table from its base (FORMATION_TABLE, 0x8c30), stepping one
  // 0x18-byte actor slot each pass. Each initEnemyFormationRecord call reads the parameter
  // entry the spawn cursor currently names, stamps that enemy into the record, and bumps the
  // cursor by one — so the three passes consume formation entries 0, 1 and 2 in order, arming
  // three successive members of the formation.
  let rec = FORMATION_TABLE;
  for (let n = 0; n < RECORD_COUNT; n++) {
    initEnemyFormationRecord(m, rec); // init one record (bumps the shared spawn index)
    rec = u16(rec + RECORD_STRIDE); // advance to the next 0x18-byte slot (kept to 16 bits)
  }
}
