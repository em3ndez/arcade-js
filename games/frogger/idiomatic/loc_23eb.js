// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23eb — advance the river-object phase counter, wrapping to 0 when it reaches 6.
 * LIVE-OUT: memory + register A (the new counter value).
 */
import { loc_8123 } from "./names.js";

const PHASE_COUNT = 6;

export function loc_23eb(m) {
  const { regs, mem8 } = m;
  const next = (mem8[loc_8123] + 1) & 0xff;
  const phase = next < PHASE_COUNT ? next : 0;
  mem8[loc_8123] = phase;
  regs.a = phase;
}
