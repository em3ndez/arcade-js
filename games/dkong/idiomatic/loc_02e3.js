// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02e3 — consume one task from the ring and run its handler.
 *
 * The task-scheduler main loop is the only caller, and it discards what comes back. It arrives
 * here when the opcode byte of the slot at TASK_HEAD has its top bit CLEAR — that is, the slot
 * holds a queued task rather than the 0xFF that marks it free — handing over the slot address
 * and the opcode byte ALREADY DOUBLED, because doubling is how the loop got the top bit into
 * the flag it tested. Doubled is exactly what indexing a table of 16-bit addresses wants, so
 * that value is the byte offset into the handler table and opcode n selects the n-th handler:
 *
 *   opcode 0 -> add to the score          opcode 4 -> draw the attract credit line
 *   opcode 1 -> reset the score counter   opcode 5 -> the bonus-readout task
 *   opcode 2 -> draw the score            opcode 6 -> draw lives and level
 *   opcode 3 -> draw a vertical string
 *
 * Both bytes of the slot are released back to 0xFF as they are consumed — the payload is taken
 * before its byte goes free — and TASK_HEAD steps past them, restarting at the ring base
 * rather than at 0 because the ring occupies only the top of its page. The handler then runs
 * with the payload in the accumulator.
 *
 * The table holds seven entries and stops where the next routine begins, but the offset is
 * masked to five bits: opcodes 7..15 index PAST the table into the bytes that follow, and
 * opcodes 16 and up alias back onto it. What, if anything, can enqueue an opcode above 6 is
 * not derived here; a target outside the table faults rather than being jumped to.
 *
 * LIVE-OUT: memory — the two ring bytes released and the advanced TASK_HEAD — plus whatever
 * the dispatched handler leaves, the dispatch being a tail call whose result is returned on.
 * The handler is handed the payload in the accumulator; every other register the table walk
 * touches is dead, because each handler takes its argument from the accumulator alone and the
 * main loop reloads everything at the top of each pass.
 */

import { u8 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { TASK_HEAD, TASK_RING } from "./names.js";
import { addToScoreTask } from "./addToScoreTask.js";
import { resetScoreCounter } from "./resetScoreCounter.js";
import { drawScoreTask } from "./drawScoreTask.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { drawCreditLineInAttract } from "./drawCreditLineInAttract.js";
import { drawLivesAndLevel } from "./drawLivesAndLevel.js";

const HANDLER_TABLE = 0x0307; // seven 16-bit handler addresses, one per task opcode
const OFFSET_MASK = 0x1f; //    the doubled opcode is masked to five bits before indexing
const SLOT_FREE = 0xff; //      written back into both ring bytes as the task is consumed
const RING_BASE = u8(TASK_RING); // the dequeue pointer is a low byte within its page
const MAIN_LOOP = 0x02bd; //    the bonus-readout handler returns straight to the main loop

/** The handlers the table names, keyed by the address it holds for each. */
const HANDLERS = new Map([
  [0x051c, addToScoreTask],
  [0x059b, resetScoreCounter],
  [0x05c6, drawScoreTask],
  [0x05e9, drawStringVertical],
  [0x0611, drawCreditLineInAttract],
  [0x06b8, drawLivesAndLevel],
]);

export function loc_02e3(
  m,
  // Defaults for the seam: the sole caller hands both of these over in registers, and the
  // live engine dispatches this routine with the machine alone.
  slot = m.regs.hl,
  doubledOpcode = m.regs.a,
) {
  const { regs, mem8, mem16 } = m;

  // Release the slot as it is consumed, taking the payload before its byte goes free. The
  // dequeue pointer walks WITHIN one page, so only its low byte advances.
  const payloadCell = (slot & 0xff00) | u8(slot + 1);
  mem8[slot] = SLOT_FREE;
  const payload = mem8[payloadCell];
  mem8[payloadCell] = SLOT_FREE;

  // Step the pointer past both bytes; past the end of the ring it restarts at the ring
  // base, not at 0.
  const next = u8(payloadCell + 1);
  mem8[TASK_HEAD] = next < RING_BASE ? RING_BASE : next;

  const target = mem16[HANDLER_TABLE + (doubledOpcode & OFFSET_MASK)];
  regs.a = payload; // the handler's argument

  const handler = HANDLERS.get(target);
  if (handler !== undefined) return handler(m);

  if (target === 0x062a) {
    // The bonus-readout handler is dispatched by address, and it returns by consuming the
    // main-loop address pushed for it here.
    m.push16(MAIN_LOOP);
    return m.call(0x062a);
  }

  throw new NotImplemented(
    `task handler at ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(0x0307 table offset ${doubledOpcode & OFFSET_MASK}, payload 0x${payload.toString(16)})`,
  );
}
