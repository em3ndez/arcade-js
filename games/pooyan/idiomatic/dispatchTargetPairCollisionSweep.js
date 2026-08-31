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
 * The parity picks one of the two pair records; an inactive pair (lead bit0 clear) returns at once.
 * Otherwise the chosen record is latched as the active pair, and the pair's bit1 selects which of
 * the two sweep variants runs over the four coordinate/state records. Both variants tail-return.
 *
 * LIVE-OUT: none in registers — the caller ignores the result. Memory: the latched pair pointer
 * plus whatever the selected variant writes.
 */
const SWEEP_COUNT = 0x04;

export function dispatchTargetPairCollisionSweep(m, ireg = m.regs.i, target = m.regs.iy) {
  const { mem8, mem16 } = m;
  const pair = ireg === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1;
  if ((mem8[pair] & 0x01) === 0) return; // inactive pair
  mem16[ACTIVE_ENEMY_TARGET_PAIR_PTR] = pair; // latch for the variant's reload
  // bit1 selects the sweep variant. Both receive the same register state (B=count, IX=coord slots,
  // HL=formation table, IY=target, I=parity) but expose it through different parameter orders, so
  // each is dispatched with its own signature.
  if ((mem8[pair] & 0x02) !== 0) {
    return scanActorSlotsMarkStruckAndFlash(m, SWEEP_COUNT, FORMATION_COORD_SLOTS, FORMATION_TABLE, target, ireg);
  }
  return testAndCatchActorSlotOnOverlap(m, FORMATION_TABLE, FORMATION_COORD_SLOTS, target, SWEEP_COUNT);
}
