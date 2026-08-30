// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3838 } from "./names.js";

/**
 * loc_125f — countdown-driven phase transition for the actor record at IX (rec = m.regs.ix).
 *
 * Ticks the per-phase timer; while non-zero it returns untouched. On reaching zero it advances
 * the phase field, seats the advance latch, and restarts the record's animation from the shared
 * table. REGISTER BRIDGE: rec = m.regs.ix. LIVE-OUT: memory only — the phase timer always; the
 * phase field, advance latch, and animation fields on expiry. No load-bearing register output.
 */

const PHASE_TIMER = 0x11; // per-phase countdown timer
const PHASE_FIELD = 0x02; // phase field, advanced on expiry
const ADVANCE_LATCH = 0x08; // set to 1 on the phase advance

export function loc_125f(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + PHASE_TIMER] = mem8[rec + PHASE_TIMER] - 1;
  if (mem8[rec + PHASE_TIMER] !== 0) return;

  mem8[rec + PHASE_FIELD] = mem8[rec + PHASE_FIELD] + 1;
  mem8[rec + ADVANCE_LATCH] = 1;
  setActorAnimation(m, rec, ANIM_TABLE_3838);
}
