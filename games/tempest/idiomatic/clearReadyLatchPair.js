// SPDX-License-Identifier: GPL-3.0-only
import { SWEEP_STAGE, WAVE_PHASE_LATCH } from "./names.js";

/**
 * clearReadyLatchPair — reset leaf: clear the sweep-stage cell and the block-ready latch together.
 * ROM 0xa831.
 *
 * Role in the machine: two cooperating cells govern when a new block of wave state is allowed to go live.
 * loc_3aa is a sweep/stage cell; loc_125 is the block-ready latch, which is armed to 0xff elsewhere once a
 * block is prepared. This leaf clears both at once, disarming the ready latch and resetting the stage, as
 * part of the wave-spawn chain (fired from tickWaveSpawnCadence via selectWaveStartSlot) so a fresh wave
 * cannot inherit a stale "ready" state from the previous one.
 *
 * Behavior: two unconditional stores of 0x00 — first into loc_3aa, then into loc_125. No branches, no loop,
 * no reads. Both cells are direct-page addresses named at build time, so no runtime address arithmetic.
 *
 * Live-out: loc_3aa = 0 and loc_125 = 0 (ready latch disarmed). Nothing else touched. Grounding: [seen].
 */
export function clearReadyLatchPair(m) {
  const { mem8 } = m;
  // Reset the sweep/stage cell loc_3aa.
  mem8[SWEEP_STAGE] = 0x00;
  // Disarm the block-ready latch loc_125 (set to 0xff elsewhere once a block is prepared).
  mem8[WAVE_PHASE_LATCH] = 0x00;
}
