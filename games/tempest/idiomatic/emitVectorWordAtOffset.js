// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * emitVectorWordAtOffset — lay one vector word at an indexed offset into the display list. ROM 0xdf59.
 *
 * Role in the machine: the sibling of emitVectorWord for callers that are filling a multi-word object
 * record and already hold a running byte offset Y within it. Instead of writing at the cursor origin,
 * it stores the pair `a`/`x` at cursor+Y and cursor+Y+1, then advances the cursor to just past the
 * second byte — so a builder can splice a word at an arbitrary slot of the record it is composing.
 *
 * Behavior: read the write cursor from DRAW_CURSOR_LO ($74/$75), compute next = (Y+1) & 0xff, store
 * `a` at cursor+Y and `x` at cursor+next, then advanceDisplayCursor(m, next) bumps the cursor by
 * next+1 bytes (the offset consumed plus the carry-forced +1). Live-out: two bytes in the display
 * list and DRAW_CURSOR_LO advanced past them. Grounding: [seen]
 */
export function emitVectorWordAtOffset(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const ptr = mem16[DRAW_CURSOR_LO]; // vector-RAM write cursor $74/$75
  const next = (y + 1) & 0xff;       // offset of the second byte, wrapped in a byte
  mem8[u16(ptr + y)] = a;            // first byte at cursor+Y
  mem8[u16(ptr + next)] = x;         // second byte at cursor+Y+1
  advanceDisplayCursor(m, next);     // advance the cursor past both bytes
}
