// SPDX-License-Identifier: GPL-3.0-only
import { STAGE_COUNTDOWN, WAVE_PROGRESS_COUNTER } from "./names.js";
/**
 * adjustSpawnColumn — shift the spawn-column index by the wave's progress, in the early stages only.
 *
 * Leaves the column untouched once the stage countdown has advanced (>= 3), or while wave progress is
 * still below 0x0c; otherwise adds (progress - 0x0c) to the column.
 *
 * LIVE-OUT: register C (the adjusted column). Caller consumes C, so wiring must write the return back
 * into C.
 */
export function adjustSpawnColumn(m, col = m.regs.c) {
  const { mem8 } = m;

  if (mem8[STAGE_COUNTDOWN] >= 0x03) return (m.regs.c = col); // late stage: column unchanged
  const progress = mem8[WAVE_PROGRESS_COUNTER];
  if (progress < 0x0c) return (m.regs.c = col); // below threshold: column unchanged
  return (m.regs.c = (col + progress - 0x0c) & 0xff); // shift column by (progress - 0x0c)
}
