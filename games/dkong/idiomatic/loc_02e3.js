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

import { u8, page } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { TASK_HEAD, TASK_RING } from "./names.js";
import { addToScoreTask } from "./addToScoreTask.js";
import { resetScoreCounter } from "./resetScoreCounter.js";
import { drawScoreTask } from "./drawScoreTask.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { drawCreditLineInAttract } from "./drawCreditLineInAttract.js";
import { drawLivesAndLevel } from "./drawLivesAndLevel.js";
import { loc_062a } from "./loc_062a.js";

const OFFSET_MASK = 0x1f; // the doubled opcode is masked to five bits before indexing
const SLOT_FREE = 0xff;
const RING_BASE = u8(TASK_RING); // the dequeue pointer is a low byte within its page

export function loc_02e3(
  m,
  // The sole caller hands both over in registers; the live engine dispatches with the machine alone.
  slot = m.regs.hl,
  doubledOpcode = m.regs.a,
) {
  const { regs, mem8 } = m;

  // Release the slot as consumed, taking the payload before its byte frees. The dequeue pointer
  // walks WITHIN one page, so only its low byte advances.
  const payloadCell = page(slot) | u8(slot + 1);
  mem8[slot] = SLOT_FREE;
  const payload = mem8[payloadCell];
  mem8[payloadCell] = SLOT_FREE;

  // Past the end of the ring the pointer restarts at the ring base, not at 0.
  const next = u8(payloadCell + 1);
  mem8[TASK_HEAD] = next < RING_BASE ? RING_BASE : next;

  regs.a = payload; // the handler's argument

  // The doubled opcode selects the n-th task handler (opcode n -> the n-th of seven). Offsets past
  // the seven entries (or aliased by the 5-bit mask) fault.
  switch (doubledOpcode & OFFSET_MASK) {
    case 0: return addToScoreTask(m);
    case 2: return resetScoreCounter(m);
    case 4: return drawScoreTask(m);
    case 6: return drawStringVertical(m);
    case 8: return drawCreditLineInAttract(m);
    case 10: return loc_062a(m); // one bonus-readout step; returns to the task loop
    case 12: return drawLivesAndLevel(m);
    default:
      throw new NotImplemented(
        `task handler offset ${doubledOpcode & OFFSET_MASK} has no entry (payload 0x${payload.toString(16)})`,
      );
  }
}
