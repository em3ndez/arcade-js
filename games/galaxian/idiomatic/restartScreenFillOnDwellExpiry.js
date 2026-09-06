// SPDX-License-Identifier: GPL-3.0-only
// Tick the dwell timer's high tier — the byte just past the pointer. Already zero, or reaching zero on
// this tick, re-seeds the screen-fill state; while it is still counting down, nothing happens.
import { u16 } from "../../../core/int.js";
import { resetScreenFillState } from "./resetScreenFillState.js";

export function restartScreenFillOnDwellExpiry(m, timerBase = m.regs.hl) {
  const { mem8 } = m;
  const tier = u16(timerBase + 1);

  // Already expired: re-seed without ticking.
  if (mem8[tier] === 0) return resetScreenFillState(m);

  // Tick; keep waiting while nonzero, else re-seed.
  mem8[tier] = mem8[tier] - 1;
  if (mem8[tier] !== 0) return;
  return resetScreenFillState(m);
}
