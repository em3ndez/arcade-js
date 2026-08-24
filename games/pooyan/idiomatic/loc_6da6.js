// SPDX-License-Identifier: GPL-3.0-only
import { INTRO_PHASE_INDEX } from "./names.js";
/**
 * loc_6da6 — level-intro / round-start phase dispatcher (top-level game state 2).
 * Reads the intro phase counter and tail-dispatches it through the shared rst-0x28 trampoline into
 * the seven-entry inline phase table. PURE tail dispatch: no handler-return slot is pushed, so the
 * handler returns straight to this dispatcher's own caller.
 * LIVE-OUT: none — a void per-frame dispatch (A carries the selector into the frozen trampoline).
 */
const PHASE_TABLE_BASE = 0x6daa;

export function loc_6da6(m) {
  m.regs.a = m.mem8[INTRO_PHASE_INDEX];
  m.push16(PHASE_TABLE_BASE);
  return m.call(0x0028); // spine dispatcher -> handler -> our caller
}
