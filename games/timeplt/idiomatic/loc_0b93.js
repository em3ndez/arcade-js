// SPDX-License-Identifier: GPL-3.0-only
/** loc_0b93 — the foreground loop: take commands off the 64-cell ring, one at a time, for ever.
 *  A read cursor names a cell; high bit set means empty, so the loop looks again — it has no exit
 *  of its own. An occupied cell gives up a command and an argument byte, BOTH freed before the
 *  command runs so it may reuse the pair. The low nibble indexes sixteen handlers, and where one
 *  lands is the exit test. A GENERATOR, yielding where the ring is empty — the only vblank wait
 *  among the foreground loops a coin-and-play tape reaches. ⚠ EMPTY branch: the loop top backs
 *  the ring up. LIVE-OUT: memory, and whatever the command left behind. */



import { u16, u8 } from "../../../core/int.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { COMMAND_READ_CURSOR, COMMAND_RING } from "./names.js";

const RING_CELLS = 64;
const FREE = 255;
const OCCUPIED_BIT = 0x80;
const HANDLERS = 0x0bbc;
const HANDLER_BITS = 0x0f;
const COME_BACK_TO = 0x0b90;

export function* loc_0b93(m) {
  const { regs, mem8 } = m;
  for (;;) {
    const commandCell = u16(COMMAND_RING + mem8[COMMAND_READ_CURSOR]);
    if (mem8[commandCell] & OCCUPIED_BIT) { // high bit SET means EMPTY; the name reads backwards
      yield;
      continue;
    }

    const command = mem8[commandCell];
    mem8[commandCell] = FREE;
    const argumentCell = u16(commandCell + 1);
    const argument = mem8[argumentCell];
    mem8[argumentCell] = FREE;
    mem8[COMMAND_READ_CURSOR] = u8(argumentCell + 1) & (RING_CELLS - 1);

    regs.hl = HANDLERS;
    regs.a = command;
    regs.and(HANDLER_BITS);
    fetchWideTableWord(m);
    const handler = regs.de;

    regs.c = command;
    regs.b = argument;
    regs.a = argument;
    regs.de = COME_BACK_TO;
    regs.hl = handler;
    m.push16(COME_BACK_TO);
    m.call(handler);
    // ⚠ ASK what came back: a blind return strands a coroutine nobody drives, silently.
    if (m.pc !== COME_BACK_TO) {
      const wentTo = m.call(m.pc);
      return wentTo && typeof wentTo.next === "function" ? yield* wentTo : wentTo;
    }
  }
}
