// SPDX-License-Identifier: GPL-3.0-only
import { STAGE_COUNTDOWN, WAVE_PROGRESS_COUNTER } from "./names.js";
/**
 * adjustSpawnColumn — nudge the spawn-column index rightward as a wave fills up, but only during
 * the opening of a stage.
 *
 * ROM 0x57b4-0x57c2. Grounding: [seen].
 *
 * ROLE. When the enemy-travel tick (loc_12af) decides to release a new formation child, it needs a
 * screen column to spawn it in. This little pure helper takes the column the caller has already
 * chosen (in C) and, under two conditions, slides it further along by however far the current wave
 * has progressed past a fixed threshold. The effect is that early in a stage, as the wave gets
 * denser, fresh spawns march across the screen instead of stacking on the same column.
 *
 * The two gates that switch the adjustment OFF:
 *   - STAGE_COUNTDOWN (0x8901) >= 3. This is the stage's phase/countdown counter. Once the stage
 *     has advanced past its opening (value 3 or more), the column is returned untouched — the
 *     progressive spread applies only while the stage is still ramping up.
 *   - WAVE_PROGRESS_COUNTER (0x8d7d) < 0x0c. The wave-progress counter has not yet reached the
 *     0x0c threshold, so there is nothing to add; the column is returned untouched.
 * Only when the stage is still early AND the wave has progressed to 0x0c or beyond does the routine
 * add (progress - 0x0c) to the column. The add is taken 8-bit, so the column WRAPS at 0x100 rather
 * than growing without bound.
 *
 * A PURE LEAF: it reads two RAM cells, writes nothing to memory, and calls nothing.
 *
 * LIVE-OUT: register C (the adjusted column). The caller consumes C, so the wiring writes the
 * return value back into C on every path — including the two "unchanged" paths, which return C as
 * it came in.
 */
export function adjustSpawnColumn(m, col = m.regs.c) {
  const { mem8 } = m;

  // Opening-of-stage gate: once the stage countdown has advanced to 3+, the spread is disabled and
  // the caller's column passes straight through.
  if (mem8[STAGE_COUNTDOWN] >= 0x03) return (m.regs.c = col); // late stage: column unchanged

  // Wave-density gate: nothing is added until the wave has filled to the 0x0c mark. Below it, the
  // amount to add would be negative, so the routine returns the column as-is instead.
  const progress = mem8[WAVE_PROGRESS_COUNTER];
  if (progress < 0x0c) return (m.regs.c = col); // below threshold: column unchanged

  // Both gates passed: slide the column right by how far the wave has run past 0x0c. Kept 8-bit, so
  // a column that would overflow 0xff wraps around.
  return (m.regs.c = (col + progress - 0x0c) & 0xff); // shift column by (progress - 0x0c)
}
