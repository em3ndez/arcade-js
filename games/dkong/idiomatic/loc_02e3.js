// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02e3 — consume one task from the ring and run its handler.
 * The task-scheduler main loop is the only caller and discards the result. It arrives here when
 * the slot at TASK_HEAD holds a queued task (opcode top bit clear, not the 0xFF free marker),
 * handing over the slot address and the opcode ALREADY DOUBLED — doubling is both how the loop
 * tested the top bit and what indexing a table of 16-bit addresses wants, so opcode n selects the
 * n-th handler. Both slot bytes are released back to 0xFF as they are consumed (payload taken
 * first), and TASK_HEAD steps past them, restarting at the ring base rather than 0 because the
 * ring occupies only the top of its page.
 * The table holds seven entries; the offset is masked to five bits, so opcodes 7..15 index PAST it
 * into following bytes and 16+ alias back. A target outside the table faults rather than jumping.
 * LIVE-OUT: memory — the two released ring bytes and the advanced TASK_HEAD — plus whatever the
 * dispatched handler leaves (a tail call). The handler takes its argument from the accumulator.
 */

import { u8 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import {
  TASK_HANDLER_TABLE,
  TASK_HEAD,
  TASK_RING,
} from "./names.js";
import { addToScoreTask } from "./addToScoreTask.js";
import { resetScoreCounter } from "./resetScoreCounter.js";
import { drawScoreTask } from "./drawScoreTask.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { drawCreditLineInAttract } from "./drawCreditLineInAttract.js";
import { drawLivesAndLevel } from "./drawLivesAndLevel.js";

const OFFSET_MASK = 0x1f; // the doubled opcode is masked to five bits before indexing
const SLOT_FREE = 0xff;
const RING_BASE = u8(TASK_RING); // the dequeue pointer is a low byte within its page
const MAIN_LOOP = 0x02bd; // the bonus-readout handler returns straight to the main loop

// The handlers the table names, keyed by the address it holds for each.
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
  // The sole caller hands both over in registers; the live engine dispatches with the machine alone.
  slot = m.regs.hl,
  doubledOpcode = m.regs.a,
) {
  const { regs, mem8, mem16 } = m;

  // Release the slot as consumed, taking the payload before its byte frees. The dequeue pointer
  // walks WITHIN one page, so only its low byte advances.
  const payloadCell = (slot & 0xff00) | u8(slot + 1);
  mem8[slot] = SLOT_FREE;
  const payload = mem8[payloadCell];
  mem8[payloadCell] = SLOT_FREE;

  // Past the end of the ring the pointer restarts at the ring base, not at 0.
  const next = u8(payloadCell + 1);
  mem8[TASK_HEAD] = next < RING_BASE ? RING_BASE : next;

  const target = mem16[TASK_HANDLER_TABLE + (doubledOpcode & OFFSET_MASK)];
  regs.a = payload; // the handler's argument

  const handler = HANDLERS.get(target);
  if (handler !== undefined) return handler(m);

  if (target === 0x062a) {
    // Dispatched by address; it returns by consuming the main-loop address pushed for it here.
    m.push16(MAIN_LOOP);
    return m.call(0x062a);
  }

  throw new NotImplemented(
    `task handler at ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(0x0307 table offset ${doubledOpcode & OFFSET_MASK}, payload 0x${payload.toString(16)})`,
  );
}
