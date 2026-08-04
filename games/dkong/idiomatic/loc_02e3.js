// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02e3 — consume one task from the ring and run its handler.  ROM 0x02E3.
 *
 * The task-scheduler main loop (ROM 0x02BD) is the ONLY caller — one `jr nc` at ROM 0x02C5 —
 * and it discards what comes back. It arrives here when the opcode byte of the slot at
 * TASK_HEAD has bit 7 CLEAR, i.e. the slot holds a queued task rather than the 0xFF that
 * marks it free, with the slot address in HL and, in A, that opcode byte ALREADY DOUBLED:
 * the caller doubled it to get bit 7 into the carry it tested. Doubled is exactly what
 * indexing a table of 16-bit addresses wants, so the value in A is the byte offset into the
 * handler table at ROM 0x0307, and opcode n selects the n-th handler:
 *
 *   opcode 0 -> addToScoreTask           opcode 4 -> drawCreditLineInAttract
 *   opcode 1 -> resetScoreCounter        opcode 5 -> ROM 0x062A (still frozen)
 *   opcode 2 -> drawScoreTask            opcode 6 -> drawLivesAndLevel
 *   opcode 3 -> drawStringVertical
 *
 * Both bytes of the slot are released back to 0xFF as they are consumed — the payload is
 * taken before its byte goes free — and TASK_HEAD steps past them, restarting at the ring
 * base rather than at 0 because the ring occupies only the top of page 0x60. The handler
 * then runs with the payload in A.
 *
 * The table holds seven entries and stops where the next routine begins, but the offset is
 * masked to five bits: opcodes 7..15 index PAST the table into the bytes that follow, and
 * opcodes 16 and up alias back onto it. What (if anything) can enqueue an opcode above 6 is
 * not derived here; as in the oracle, a target outside the table faults rather than being
 * jumped to.
 *
 * Memory-equivalent to the frozen oracle — equivalence-02e3.test.js.
 * GATE:     real captured entries from two scenarios, because attract cannot reach every
 *           handler: a 5000-frame ATTRACT run (248 entries, six of the seven handlers, 7 of
 *           them wrapping the dequeue pointer) and a 1200-frame COIN+START run (33 entries,
 *           where the seventh — opcode 1 — fires). 26 of those 281 are replayed against the
 *           oracle: every 20th, plus the first at each handler, plus the first wrap. The
 *           gate asserts the sample covers every handler reached AND that the two runs
 *           between them reach all seven table entries. Neither scenario completes a board
 *           (the coin+start run supplies no joystick input), so an opcode or payload only a
 *           later state enqueues is untested. The rewrite is also wired in
 *           live for a whole 5000-frame run (435 entries) against a reference differing
 *           only in this routine. Teeth: five broken twins.
 * LIVE-OUT: memory — the two ring bytes released to 0xFF and the advanced TASK_HEAD — plus
 *           whatever the dispatched handler leaves, the dispatch being a tail call whose
 *           result is returned on. The handler is handed the payload in A. The oracle also
 *           leaves it in C, and leaves DE, HL and the flags from its walk of the ROM table;
 *           those are DROPPED. Derived at each handler's entry: all seven take their
 *           argument from A and none reads C, DE, HL or the flags before writing them. One
 *           step further out, ROM 0x0691 (reached from the frozen 0x062A on an arm neither
 *           gate scenario drives) DOES take C as a live-in and pushes it, but nothing reads
 *           the value back — 0x051C overwrites C on entry, and the pushed byte lands in the
 *           dead stack scratch. Measured: wired in live, the trace is unchanged over 5000
 *           frames and 435 entries. Back at the main loop nothing survives — it reloads A,
 *           H, L and the flags at the top of every pass, which is also why it discards the
 *           return value.
 * NAMES:    TASK_HEAD (the dequeue pointer) and TASK_RING (its base, whose low byte is
 *           where the pointer restarts). The slot address itself is a live-in.
 */

import { u8 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { TASK_HEAD, TASK_RING } from "./names.js";
import { addToScoreTask } from "./addToScoreTask.js"; //                 ROM 0x051C
import { resetScoreCounter } from "./resetScoreCounter.js"; //           ROM 0x059B
import { drawScoreTask } from "./drawScoreTask.js"; //                   ROM 0x05C6
import { drawStringVertical } from "./drawStringVertical.js"; //         ROM 0x05E9
import { drawCreditLineInAttract } from "./drawCreditLineInAttract.js"; // ROM 0x0611
import { drawLivesAndLevel } from "./drawLivesAndLevel.js"; //           ROM 0x06B8

const HANDLER_TABLE = 0x0307; // ROM: seven 16-bit handler addresses, one per task opcode
const OFFSET_MASK = 0x1f; //    the doubled opcode is masked to five bits before indexing
const SLOT_FREE = 0xff; //      written back into both ring bytes as the task is consumed
const RING_BASE = u8(TASK_RING); // the dequeue pointer is a low byte within page 0x60
const MAIN_LOOP = 0x02bd; //    a still-frozen handler returns straight to the main loop

/** The handlers the 0x0307 table names, keyed by the ROM address it holds for each. */
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
  // oracle-boundary defaults: the sole caller (ROM 0x02BD) hands both of these over in
  // registers, and the live engine dispatches this routine as fn(m).
  slot = m.regs.hl,
  doubledOpcode = m.regs.a,
) {
  const { regs, mem8, mem16 } = m;

  // Release the slot as it is consumed, taking the payload before its byte goes free. The
  // dequeue pointer walks WITHIN page 0x60, so only its low byte advances.
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
    // ROM 0x062A has no idiomatic twin in ROUTINES yet, so it is dispatched through the registry and
    // its own `ret` consumes the main-loop return address pushed for it here. Dissolve
    // this into a direct call once 0x062A is wired into ROUTINES.
    m.push16(MAIN_LOOP);
    return m.call(0x062a);
  }

  throw new NotImplemented(
    `task handler at ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(0x0307 table offset ${doubledOpcode & OFFSET_MASK}, payload 0x${payload.toString(16)})`,
  );
}
