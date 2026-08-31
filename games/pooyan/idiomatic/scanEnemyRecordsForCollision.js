// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { testEnemyRecordHitAndRegister } from "./testEnemyRecordHitAndRegister.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * scanEnemyRecordsForCollision — sweep the per-record collision check across the six enemy-actor records.
 *
 * WHAT IT IS
 *   One of the collision passes the game runs over its actor world every frame. It is a thin driver:
 *   it does no geometry of its own. Instead it visits six enemy-actor records back to back and hands
 *   each one to the per-record proximity/collision check (the callee), which answers one yes/no
 *   question per record — did this enemy overlap a live enemy-target entry? — and, when it did,
 *   registers the hit (arming the struck actor's reaction animation and marking it struck). This
 *   driver's only job is to march the pointer across the six records and to stop the instant a hit
 *   is reported.
 *
 * ROLE IN THE MACHINE
 *   This is one of the eleven per-record proximity passes fired in a fixed order by the master
 *   actor updater (runActorUpdatePipeline, ROM 0x5ae4) each frame. The updater reads nothing back
 *   from the pass in registers — the collision work is done entirely through the records in RAM.
 *   The six records this pass walks are the enemy-actor sub-array ENEMY_ACTOR_TABLE (0x8ae0), a
 *   0x18-byte-stride block sitting 0x60 bytes into the flat actor arena based at 0x8a80. Because
 *   every actor/target/object record shares the same 0x18-byte layout, a fixed-stride walk of six
 *   records is all that is needed to cover this pool.
 *
 * ROM
 *   0x5b86-0x5b98 (the driver body; the per-record check it calls begins at 0x5b99).
 *
 * GROUNDING
 *   [seen]. The pool it sweeps, ENEMY_ACTOR_TABLE (0x8ae0), is tagged [seen], as is the per-record
 *   collision check it drives and the enemy-target pair (ENEMY_TARGET_REC0, 0x8c90) that check
 *   tests against.
 *
 * LIVE-OUT
 *   Memory only — whatever the per-record check writes on a hit (the struck record's reaction
 *   animation pointer, its hit timer, and its state byte, plus the matching on-screen sprite slot).
 *   This driver hands nothing back to its caller: the loop index and record pointer are throwaway
 *   scratch that no caller reads. A hit is signalled purely by the driver returning early (below).
 */
// Each enemy-actor record is 0x18 bytes wide, so the next record is exactly one stride on.
const RECORD_STRIDE = 0x18;
// This pass covers exactly six records of the ENEMY_ACTOR_TABLE (0x8ae0) pool.
const RECORD_COUNT = 6;

export function scanEnemyRecordsForCollision(m) {
  // Start the walk at the base of the enemy-actor sub-array, ENEMY_ACTOR_TABLE (0x8ae0) — the first
  // of the six 0x18-byte records this pass tests.
  let record = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Hand the current record to the per-record proximity/collision check. It returns true on a
    // clean pass (no overlap, or a guard rejected the record) and false when it registered a hit.
    //
    // A hit is more than the end of this sweep: the check unwinds an extra return level, so control
    // resumes above this driver and the rest of the master updater's work for this record set is
    // skipped for the frame. That short-circuit shows up here as an immediate return the moment the
    // check reports a hit — no further records are tested this frame.
    if (!testEnemyRecordHitAndRegister(m, record)) return; // hit -> abort the sweep
    // Clean pass: advance the pointer one 0x18-byte stride to the next enemy-actor record. u16 keeps
    // the address inside the 16-bit work-RAM space so the walk stays within the actor arena.
    record = u16(record + RECORD_STRIDE);
  }
}
