// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27ea — dive/turtle animation driver: dispatch on the dive phase.
 * The below-2 phase is a no-op; the at-or-above-5 phase hands off to a dedicated arm; the middle band
 * runs an extra step when a secondary counter is zero, then continues into the shared surface-timer step.
 * LIVE-OUT: memory-only.
 */
import { LIVES_COUNT, FIGURE_ANIM_PHASE } from "./names.js";

const DIVE_PHASE_HIGH = 0x2874;
const SURFACE_COUNTER_RESET = 0x288c;
const SURFACE_TIMER_STEP = 0x27fe;

export function loc_27ea(m) {
  const { mem8 } = m;

  const phase = mem8[LIVES_COUNT];
  if (phase < 2) return;
  if (phase >= 5) return m.call(DIVE_PHASE_HIGH);

  if (mem8[FIGURE_ANIM_PHASE] === 0) {
    m.push16(SURFACE_TIMER_STEP);
    m.call(SURFACE_COUNTER_RESET);
  }
  return m.call(SURFACE_TIMER_STEP);
}
