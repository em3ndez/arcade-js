// SPDX-License-Identifier: GPL-3.0-only
import { dispatchTargetPairCollisionSweep } from "./dispatchTargetPairCollisionSweep.js";
import { u16 } from "../../../core/int.js";
import { ROUND_COUNTER, SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";

// Two sweep passes per invocation: one per interrupt-parity, so both of the alternating
// enemy/target formation records get a turn on the same frame this driver runs.
const PASSES = 2; // the sweep runs the actor-record table twice
// One stride-4 actor record separates the box each pass tests against; advancing by this
// between passes moves the "target box" from the first slot (0x8848) to the second (0x884c).
const SLOT_STRIDE = 4; // one record between passes

/**
 * sweepActorRecordSlotsBothParitiesOnOddRound — gated actor-sweep driver.
 *
 * ROM 0x5e78-0x5e97. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * The odd-round entry point into Pooyan's per-slot collision sweep. Collision candidates that
 * belong to the enemy/target formation are described by two records that the display interrupt
 * services on alternate parities — one record on even frames, the other on odd frames. This
 * driver fires that sweep twice back-to-back, once for each parity, so both formation records are
 * screened against the actor-record slots in a single call.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The top of the collision pipeline: it stands above the per-slot dispatcher (which chooses the
 * formation record for a parity and screens it) and, through it, the sweep bodies that do the
 * actual overlap testing. Its own job is only three things — decide whether the sweep should run
 * this frame at all, run it once per parity, and step the "target box" pointer between the two
 * runs. It performs no overlap arithmetic and touches no record itself.
 *
 * THE ODD-ROUND GATE
 * ------------------
 * The whole sweep is fenced behind bit0 of ROUND_COUNTER (0x8907). On an even round the bit is
 * clear and the driver returns immediately, leaving the actor-record slots unscanned for the
 * frame; only on odd rounds does the collision pass below run. This keeps the enemy/target
 * collision work on the same round cadence the rest of the formation machinery uses.
 *
 * THE TWO PASSES
 * --------------
 * Each pass hands the per-slot dispatcher two things: a phase latch and a target box.
 *  - The phase latch is the interrupt-parity selector — 0 on the first pass, 1 on the second.
 *    The dispatcher uses it to pick which of the two alternating formation records to service.
 *  - The target box is the actor-record slot the sweep tests overlap against. It starts at
 *    SPRITE_ACTOR_RECORD_SLOTS (0x8848), the head of the stride-4 actor-record table, and is
 *    advanced one record (SLOT_STRIDE = 4) after the first pass so the second pass tests against
 *    the next slot (0x884c).
 *
 * LIVE-OUT: none — a void per-frame driver; the caller reads nothing back. Everything the sweep
 * produces (a latched formation-record pointer, a retired slot, a lit flash cell, an enqueued hit
 * sound) is left behind by the dispatched sweep bodies, not by this routine.
 */
export function sweepActorRecordSlotsBothParitiesOnOddRound(m) {
  const { mem8 } = m;
  // Odd-round gate. ROUND_COUNTER (0x8907) bit0 selects the round parity; when it is clear the
  // frame is an even round and the collision sweep is disabled, so return before doing any work.
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return; // even round -> disabled
  // The target box starts at the head of the stride-4 actor-record table, SPRITE_ACTOR_RECORD_SLOTS
  // (0x8848). This pointer walks forward one record between passes; the dispatcher tests the chosen
  // formation record's actors against whichever slot it points at.
  let table = SPRITE_ACTOR_RECORD_SLOTS;
  // Run the sweep once per interrupt-parity (PASSES = 2). Pass 0 carries phase latch 0 and the box
  // at 0x8848; pass 1 carries phase latch 1 and the box at 0x884c.
  for (let pass = 0; pass < PASSES; pass++) {
    // Enter the per-slot dispatcher for this parity. The phase latch (0 then 1) tells it which
    // alternating formation record to service; the target box (the current table pointer) is the
    // actor-record slot its overlap test compares against.
    dispatchTargetPairCollisionSweep(m, pass === 0 ? 0 : 1, table); // phase latch, target box
    // Advance the target box to the next stride-4 actor record so the second pass tests against
    // 0x884c instead of 0x8848. u16 wraps the pointer to the Z80's 16-bit address space.
    table = u16(table + SLOT_STRIDE);
  }
}
