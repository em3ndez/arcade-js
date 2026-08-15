// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27ea — dive/turtle animation driver: dispatch on the dive phase.
 * The below-2 and at-or-above-5 phases hand off to dedicated arms; the middle band runs an extra
 * step when a secondary counter is zero, then continues into the shared surface-timer step.
 * LIVE-OUT: memory-only.
 */
import { loc_83b7, loc_8101 } from "./names.js";

const DIVE_PHASE_LOW = 0x2873;
const DIVE_PHASE_HIGH = 0x2874;
const SURFACE_COUNTER_RESET = 0x288c;
const SURFACE_TIMER_STEP = 0x27fe;

export function loc_27ea(m) {
  const { mem8 } = m;

  const phase = mem8[loc_83b7];
  if (phase < 2) return m.call(DIVE_PHASE_LOW);
  if (phase >= 5) return m.call(DIVE_PHASE_HIGH);

  if (mem8[loc_8101] === 0) {
    m.push16(SURFACE_TIMER_STEP);
    m.call(SURFACE_COUNTER_RESET);
  }
  return m.call(SURFACE_TIMER_STEP);
}
