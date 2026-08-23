// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_EXTEND_STATE, ROPE_EXTEND_DISPATCH_TABLE } from "./names.js";
/**
 * dispatchRopeExtendState — per-frame driver for the rope-extend state machine. Selects a handler by the rope-extend
 * state and hands off through the shared rst-0x28 trampoline; the handler returns to our caller.
 *
 * LIVE-OUT: none — a void per-frame dispatch; the caller reads nothing back. The dispatch index is
 * marshalled into the still-frozen spine dispatcher through the register bridge.
 */
export function dispatchRopeExtendState(m) {
  m.regs.a = m.mem8[ROPE_EXTEND_STATE]; // dispatch index
  m.push16(ROPE_EXTEND_DISPATCH_TABLE); // inline jump-table base
  return m.call(0x0028); // rst-0x28 spine dispatcher (unlifted) -> handler
}
