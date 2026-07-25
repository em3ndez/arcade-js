// SPDX-License-Identifier: GPL-3.0-only
/**
 * addToSpriteObjectColumn — the `rst 0x38` vector: add the delta C into one field
 * across all ten sprite-object records.  ROM 0x0038.
 *
 * A two-instruction shim in front of addStrided (ROM 0x003d). It fixes the stride to
 * 4 (one sprite-object record) and the count to 10 (the number of records in the
 * SPRITE_OBJ_BLOCK, 0x6908–0x692F), then runs the shared add-loop, which
 * read-modify-adds the caller's byte C into each of those ten stride-4 bytes —
 * `for k in 0..9: (HL + 4k) += C`, 8-bit wrap. HL (which field: +0 = the X column at
 * 0x6908, +3 = the Y column at 0x690b) and C (a SIGNED delta) come from the caller.
 *
 * Every one of its 16+ callers points HL at 0x6908 or 0x690b, so the effect is always
 * "shift the X-column or Y-column of all ten sprite-object records by C" during board
 * and cutscene setup — repositioning a whole row of props with one number. C is
 * signed: 0xFC (−4) / 0xFF (−1) nudge left or up; 0x44 / 0x50 / 0x78 reposition.
 * One caller (sub_306f) invokes it purely for the DE = 4 side effect that its later
 * sub_3096 calls consume — the add still runs, on that caller's own HL/C.
 *
 * FALL-THROUGH, NOT A CALL. The ROM runs straight from 0x003b into addStrided's body
 * at 0x003d with nothing pushed, and addStrided's single `ret` returns for both entry
 * points. In JS that is just a direct call that returns normally; addStrided leaves
 * DE and C untouched, so the DE = 4 it was handed survives.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0038.test.js.
 * GATE:     crafted-entry — real captured rst-0x38 dispatches (attract board setup:
 *           HL = 0x6908/0x690b, various C, always the fixed B = 0x0A / DE = 4) +
 *           crafted entries varying C over both columns, an 8-bit add-wrap, and
 *           GARBAGE incoming B/DE to prove the two constants are hardcoded (not read
 *           from the caller). Teeth: a wrong-count twin (9 records). Reached from 16+
 *           rst-0x38 sites; attract exercises the board-setup arm.
 * LIVE-OUT: memory (the ten stride-4 bytes, each += C with 8-bit wrap) + DE = 0x0004
 *           — a GENUINE live-out: sub_306f calls this for the stride alone. A/B/HL are
 *           inherited from addStrided (A = last byte written, B = 0, HL advanced by
 *           B*DE = 0x28); dead at continuing sites but kept faithful for the tail-
 *           return callers. FLAGS dropped as dead (same analysis as addStrided — the
 *           per-byte and final add carries reach no branch after the return).
 * NAMES:    none — the routine hardcodes only the stride 4 and record-count 10; HL
 *           (the field within the record) and C (the delta) are caller-supplied, and
 *           it references no fixed RAM address. Callers aim HL at SPRITE_OBJ_BLOCK
 *           (0x6908, named in ram.js), which is what earns the name.
 */
import { addStrided } from "./addStrided.js";

export function addToSpriteObjectColumn(m) {
  const { regs } = m;
  regs.de = 0x0004; // stride 4 = the gap between successive sprite-object records
  regs.b = 0x0a; // 10 = the number of records in SPRITE_OBJ_BLOCK (0x6908–0x692F)

  // Fall-through into addStrided: adds C into each of the B stride-DE bytes at HL.
  // HL and C are the caller's; DE and C come back unchanged.
  addStrided(m);
}
