// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";
import { emitObjectPositionRecord } from "./emitObjectPositionVector.js";

/**
 * layHeaderAndBuildRecord — prepend a fixed vector header, then emit a position record. ROM 0xc765.
 *
 * Role in the machine: the vector display list is built by writing bytes at a moving draw cursor
 * (loc_74/loc_75, DRAW_CURSOR_LO/HI). This is an alternate entry into the shared position-record
 * builder for objects whose record must be preceded by a two-byte control word. It lays that fixed
 * 0x00,0x71 header into the first two cursor bytes, then hands off to emitObjectPositionRecord with
 * the write offset started at slot 2 — so the header stays put and the six-byte X/Y position record
 * lands immediately after it.
 *
 * Behavior: reassemble the 16-bit cursor from its low/high halves, store 0x00 at offset 0 and 0x71
 * at offset 1, then tail-call emitObjectPositionRecord(m, x, 2). That callee writes the object's
 * X/Y vector and advances the cursor past the emitted bytes; this entry adds only the header.
 *
 * Live-out: two header bytes at the current cursor, plus whatever emitObjectPositionRecord writes
 * and the advanced cursor loc_74/loc_75 it leaves.
 *
 * Grounding: [seen].
 */
// Alt entry: write the fixed 0x00/0x71 header word at the cursor start (loc_74/loc_75), then
// resume the shared vector-record build from cursor offset 2.
export function layHeaderAndBuildRecord(m, x = m.regs.x) {
  const { mem8 } = m;
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8); // reassemble the 16-bit draw cursor
  mem8[u16(base + 0)] = 0x00; // fixed header byte 0
  mem8[u16(base + 1)] = 0x71; // fixed header byte 1
  return emitObjectPositionRecord(m, x, 2); // build the X/Y record starting past the header
}
