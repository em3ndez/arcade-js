// SPDX-License-Identifier: GPL-3.0-only
import { SPINNER_ACCUM } from "./names.js";

/**
 * clearByte50 — minimal reset leaf: zero the single spinner-accumulator cell loc_50. ROM 0x92ad.
 *
 * Role in the machine: Tempest steers the player's Blaster around the rim of the tube with a spinner
 * (the rotary knob), whose motion is integrated into loc_50 — a running accumulator that ranges roughly
 * 0x00..0xde across a wave as the player rotates. This is the one-line leaf that drops that accumulator
 * back to its baseline, called as part of the wave-spawn reset chain so a fresh wave starts from a clean
 * spinner position rather than inheriting the previous wave's drift.
 *
 * Behavior: a single store of zero into loc_50, then return. No branches, no loop, no other state touched.
 * It is invoked from the spawn chain in tickWaveSpawnCadence (via selectWaveStartSlot) alongside the other
 * clear-leaves that blank the per-wave working tables.
 *
 * Live-out: loc_50 = 0. Nothing else is read or written. Grounding: [seen].
 */
export function clearByte50(m) {
  const { mem8 } = m;
  // Zero the spinner accumulator loc_50 (the integrated rotary position); return.
  mem8[SPINNER_ACCUM] = 0;
}
