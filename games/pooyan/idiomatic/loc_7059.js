// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
/**
 * loc_7059 — phase-5 target-group tick: drop the counter the pointer addresses and queue a command.
 *
 * Decrements the byte HL points at, then enqueues one fixed 16-bit command word into the
 * page-0x88 display-command ring (the enqueue drops it if the target slot is busy). The pointer
 * is preserved.
 *
 * LIVE-OUT: HL = the unchanged counter pointer, and DE = the command word the enqueue reads (left
 * in DE on exit, set to the exit value defensively); the caller reloads both before use. A is
 * scratched by the enqueue.
 */
const TARGET_TICK_DISPLAY_CMD = (0x03 << 8) | 0x15; // display-ring command word: high 0x03, low 0x15

export function loc_7059(m, at = m.regs.hl) {
  const { mem8 } = m;
  mem8[at] = mem8[at] - 1;
  loc_0038(m, TARGET_TICK_DISPLAY_CMD);
  return [(m.regs.hl = at), (m.regs.de = TARGET_TICK_DISPLAY_CMD)];
}
