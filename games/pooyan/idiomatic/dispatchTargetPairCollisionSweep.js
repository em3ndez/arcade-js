// SPDX-License-Identifier: GPL-3.0-only
import { scanActorSlotsMarkStruckAndFlash } from "./scanActorSlotsMarkStruckAndFlash.js";
import { testAndCatchActorSlotOnOverlap } from "./testAndCatchActorSlotOnOverlap.js";
import {
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  ACTIVE_ENEMY_TARGET_PAIR_PTR,
  FORMATION_COORD_SLOTS,
  FORMATION_TABLE,
} from "./names.js";
/**
 * dispatchTargetPairCollisionSweep — enter the per-slot actor sweep for one interrupt-parity pair.
 *
 * ROM 0x5e98-0x5ebc. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * The gate in front of Pooyan's per-slot collision sweep. Collision candidates that belong to
 * the enemy/target formation are described by two two-entry actor records that alternate frame
 * to frame: the display interrupt runs on one parity on even frames and the other on odd frames,
 * and each parity owns one of the two records. This routine reads the parity, decides whether the
 * pair it owns is even worth scanning, and if so launches the sweep that walks that pair's four
 * coordinate/state slots.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Sits between the odd-round actor sweep that drives it and the two sweep bodies it can hand off
 * to. Because the two enemy/target records are serviced on alternate parities, the collision
 * machinery only ever touches one of them per invocation; this routine is where that one is
 * chosen and where the choice is recorded so the body it dispatches can find the same record
 * again. It does no overlap testing itself — it only picks the record, screens it for activity,
 * and selects which of two sweep variants runs.
 *
 * THE TWO PAIR RECORDS
 * --------------------
 * ENEMY_TARGET_REC0 (0x8c90) is the record for parity 0; ENEMY_TARGET_REC1 (0x8ca8) is the
 * record for the other parity, laid out one record-stride (0x18 bytes) further up the page. In
 * each record, byte0's low bits are presence/state flags: bit0 marks the pair active, and bit1
 * selects which flavour of sweep the pair wants.
 *
 * LIVE-OUT: no register result — the caller ignores what comes back. In memory: the chosen pair
 * pointer latched at ACTIVE_ENEMY_TARGET_PAIR_PTR (0x8d65), plus whatever the dispatched sweep
 * variant leaves behind (a retired slot, a lit flash cell, an enqueued hit sound).
 */
const SWEEP_COUNT = 0x04;

export function dispatchTargetPairCollisionSweep(m, ireg = m.regs.i, target = m.regs.iy) {
  const { mem8, mem16 } = m;
  // Pick the record owned by this frame's interrupt parity. Parity 0 owns the record at
  // ENEMY_TARGET_REC0 (0x8c90); the other parity owns ENEMY_TARGET_REC1 (0x8ca8), the record
  // one 0x18 stride further up. Only one of the two is ever serviced per call.
  const pair = ireg === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1;
  // byte0 bit0 is the pair's presence flag. When it is clear the pair holds no live actor this
  // frame, so there is nothing to scan and the routine returns before latching or dispatching.
  if ((mem8[pair] & 0x01) === 0) return; // inactive pair
  // Latch the chosen record's address at ACTIVE_ENEMY_TARGET_PAIR_PTR (0x8d65). The sweep body
  // reloads this pointer when it needs to reach back to the struck target, so the pair chosen
  // here and the pair the body operates on stay the same record.
  mem16[ACTIVE_ENEMY_TARGET_PAIR_PTR] = pair; // latch for the variant's reload
  // byte0 bit1 selects the sweep variant. Both variants walk the same four (SWEEP_COUNT)
  // coordinate/state slots with the same inputs — the count, the formation coordinate slots at
  // FORMATION_COORD_SLOTS (0x8888), the formation table at FORMATION_TABLE (0x8c30), the target
  // box, and the interrupt parity — but each expects those inputs in its own argument order.
  if ((mem8[pair] & 0x02) !== 0) {
    // bit1 set: the proximity variant. Marks the first overlapping slot struck, lights the
    // interrupt-parity flash cell, and requests the hit sound.
    return scanActorSlotsMarkStruckAndFlash(m, SWEEP_COUNT, FORMATION_COORD_SLOTS, FORMATION_TABLE, target, ireg);
  }
  // bit1 clear: the catch variant. Walks the same slots, and on an overlap clears the caught
  // slot's header, stamps its state, wipes the struck target record, and enqueues the hit sound.
  return testAndCatchActorSlotOnOverlap(m, FORMATION_TABLE, FORMATION_COORD_SLOTS, target, SWEEP_COUNT);
}
