// SPDX-License-Identifier: GPL-3.0-only
/**
 * rampCounterToCeiling -- a slow pace/difficulty ramp: a gated two-tier prescaler that nudges a 0..7
 * counter up by one every double-wrap and clamps it at the ceiling of 7.
 *
 * WHAT IT IS
 *   One of the background timers the vblank interrupt ticks every frame over gameplay. It very slowly
 *   raises a difficulty counter: a fast outer prescaler must wrap, and only when it does does a slower
 *   inner prescaler tick; only when the inner one wraps too does the 0..7 counter step up. The net
 *   effect is that the counter climbs roughly once every (60 x 20) qualifying frames, giving the game a
 *   gentle ramp in enemy pacing as a round wears on.
 *
 * ROLE IN THE MACHINE
 *   Gated on the object subsystem being live and uninhibited: OBJ_ACTIVE_FLAG (0x4200) bit 0 must be
 *   set and the inhibit flag loc_422b bit 0 must be clear, so the ramp advances only during active
 *   play. The prescalers are loc_4218 (outer, reload 60) and loc_4219 (inner, reload 20). The counter
 *   it drives, loc_421a, is the pace counter read by the enemy-launch pacemaker (paceEnemyLaunchTrigger)
 *   to widen the launch span. A stage advance (advanceStageAndReseedFormation) resets loc_421a to 0.
 *
 * ROM 0x14f3.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: memory only -- the two prescaler cells and the pace counter loc_421a. Every early return
 *   leaves the counter untouched for this frame.
 */
import { OBJ_ACTIVE_FLAG, loc_422b, loc_4218, loc_4219, loc_421a } from "./names.js";

export function rampCounterToCeiling(m) {
  const { mem8 } = m;

  // Gate the whole ramp on active play: the object subsystem must be enabled (OBJ_ACTIVE_FLAG bit 0
  // set) and the inhibit flag must be clear (loc_422b bit 0). Either condition failing skips this frame.
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return;
  if (mem8[loc_422b] & 1) return;

  // Outer prescaler (loc_4218): tick down one, write it back, and bail unless it wrapped to zero. On a
  // wrap, reload it to 60 and fall through to tick the inner prescaler -- so the inner tier only
  // advances once per 60 qualifying frames.
  const outer = (mem8[loc_4218] - 1) & 0xff;
  mem8[loc_4218] = outer;
  if (outer !== 0) return;
  mem8[loc_4218] = 60;

  // Inner prescaler (loc_4219): the same tick-bail-reload one tier up, reloading to 20. Only when this
  // wraps too does the counter itself get to step, so the counter moves once per ~60x20 frames.
  const inner = (mem8[loc_4219] - 1) & 0xff;
  mem8[loc_4219] = inner;
  if (inner !== 0) return;
  mem8[loc_4219] = 20;

  // Step the pace counter (loc_421a) up toward its ceiling of 7. At 7 it holds; the ternary also
  // clamps any out-of-range value back down to 7, so the counter never exceeds the ceiling.
  const step = mem8[loc_421a];
  if (step === 7) return;
  mem8[loc_421a] = step > 7 ? 7 : step + 1;
}
