// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueTaskBatch — post a fixed, hard-coded batch of messages onto the task ring.  ROM 0x0965.
 *
 * A one-shot screen-composition helper: it posts seven deferred-work messages in a
 * row through enqueueTask (the shared task-ring primitive), and does nothing else.
 * The batch is constant —
 *
 *   - one message [opcode 0x04, argument 0x00], then
 *   - six messages [opcode 0x03, argument 0x14 .. 0x19] (the argument counts up while
 *     the opcode holds at 0x03).
 *
 * The dispatcher masks the opcode to its low 5 bits to index the handler table at
 * ROM 0x0307 (see dispatchTask), so these post handler #4 once and handler #3 six
 * times with successive arguments 0x14..0x19 — "several strings drawn from one
 * routine," as the oracle puts it. Both callers are screen-setup routines that
 * bracket this call with their own opcode-0x03 posts (handler_0779, the attract
 * title at state 1 / sub-state 0, posts args 0x1B/0x1C; loc_08ba, the credited
 * screen, posts arg 0x0C), which corroborates 0x03 as the screen-text handler. The
 * exact job of handler #4 / the string ids is not independently verified here, so
 * the routine is named for what is certain: it posts this fixed message batch.
 *
 * The message pair travels in the Z80 D/E registers, which is enqueueTask's ABI
 * (D = opcode, E = argument) — dozens of sites feed it that way — so this marshals
 * each pair through regs.d/regs.e before the call. enqueueTask reads D/E and never
 * writes them, so incrementing the argument between calls is safe.
 *
 * A LEAF over enqueueTask: writes only the task ring + its tail (via the callee).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0965.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (the routine fires once
 *           per attract cycle as the title screen is composed; 4 in 9000 frames,
 *           incl. a near-wrap tail=0xFC) + crafted CLEAN-ring / FULL-ring / WRAP arms
 *           that force ring states attract does not, poked identically on both sides.
 * LIVE-OUT: memory-only — the task ring (TASK_RING 0x60C0-0x60FF) and TASK_TAIL
 *           (0x60B0), both written through enqueueTask. The oracle's residual
 *           D/E/B/A/HL/flags are dead ABI: both successors overwrite them before any
 *           read (handler_0779 loads HL=0x6009 next; loc_08ba does xor a then HL=0x7D86).
 *           SP/pc are the dropped stack model — the oracle's per-call push/ret residue
 *           lands in STACK_SCRATCH, excluded by the contract.
 * NAMES:    imports enqueueTask (the idiomatic ROM 0x309F callee); opcode/argument
 *           bytes kept literal — they are the fixed message payloads, not RAM addrs.
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
