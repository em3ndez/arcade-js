// SPDX-License-Identifier: GPL-3.0-only
import { LAUNCH_STATE } from "./names.js";
/**
 * loc_2778 — per-frame driver for the launch-sequence state machine.
 *
 * Selects a handler by the low three bits of the launch state and hands off through the shared
 * rst-0x28 trampoline; the selected handler returns straight to this routine's caller.
 *
 * LIVE-OUT: none — a void per-frame dispatch; the caller reads nothing back.
 */
export function loc_2778(m) {
  m.regs.a = m.mem8[LAUNCH_STATE] & 0x07; // dispatch index
  m.push16(0x277e); // inline jump-table base
  return m.call(0x0028); // rst-0x28 spine dispatcher (unlifted) -> handler
}
