// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueTaskBatch — post a fixed, hard-coded batch of messages onto the task ring.
 *
 * A one-shot screen-composition helper: it posts seven deferred-work messages in a
 * row through the shared task-ring primitive, and does nothing else. The batch is
 * constant —
 *
 *   - one message [opcode 0x04, argument 0x00], then
 *   - six messages [opcode 0x03, argument 0x14 .. 0x19] (the argument counts up while
 *     the opcode holds at 0x03).
 *
 * The task dispatcher masks the opcode to its low 5 bits to index its handler table,
 * so these post handler #4 once and handler #3 six times with successive arguments
 * 0x14..0x19. Handler #3 draws screen text: the screen-setup routines that bracket
 * this call post their own opcode-3 messages with other string arguments. The exact
 * job of handler #4, and which strings the ids name, is not established here, so the
 * routine is named for what is certain: it posts this fixed message batch.
 *
 * The message pair travels in a register pair (opcode, argument) — the task-ring
 * primitive's calling convention — so each pair is marshalled into those registers
 * before the call. The primitive reads them and never writes them, which is why the
 * argument can simply be incremented between calls.
 *
 * A LEAF over the task-ring primitive: it writes only the ring and its tail, and does
 * so through the callee.
 *
 * LIVE-OUT: memory-only — the task ring and its tail pointer.
 */

import { enqueueTask } from "./enqueueTask.js";

export function enqueueTaskBatch(m) {
  const { regs } = m;

  // One message: handler #4, argument 0.
  regs.d = 0x04;
  regs.e = 0x00;
  enqueueTask(m);

  // Six messages: handler #3, arguments 0x14..0x19.
  regs.d = 0x03;
  for (let arg = 0x14; arg <= 0x19; arg++) {
    regs.e = arg;
    enqueueTask(m);
  }
}
