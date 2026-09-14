// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, DEPTH_LO, DEPTH_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI,
  DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_OFFSET, DRAW_SRC_PTR_LO, DRAW_SRC_PTR_HI, loc_110, TUBE_GEOM_FLAG, REDRAW_COUNTER,
  LANE_TARGET_FLAG, ENEMY_LIST_HEADER,
} from "./names.js";
import { emitSlotMidpointVertex } from "./emitSlotMidpointVertex.js";
import { emitEnemySlotEntry } from "./emitEnemySlotEntry.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";

/**
 * buildEnemyDisplayList — rebuild the per-frame enemy display list. ROM 0xc5c2.
 *
 * Role in the machine: every frame the vector generator needs a fresh list of what to draw for the enemies
 * crawling up the tube. This routine walks the enemy slots (up to sixteen), and for each one appends a
 * record to the display list: a fixed 4-byte header followed by either a freshly computed midpoint vertex
 * pair or a straight coordinate block copied from a source template. The result is the block of vector-list
 * bytes the AVG later chews through to paint the enemies.
 *
 * Behavior: two early-outs first — a nonzero loc_110 gate (a suppress flag) aborts, and a depth guard
 * (DEPTH_LO 0x5b == 0 with DEPTH_HI 0x5f >= 0xf0) aborts when the tube depth says there is nothing to draw.
 * It emits a blank tag-70 vector word as the list opener, saves the source pointer (DRAW_CURSOR_LO/HI = the
 * 0xaa pair here, restored at the end), zeroes the table cursor and the draw offset, and seeds the slot
 * counter to 0x0f — decremented to 0x0e when TUBE_GEOM_FLAG (0x111) is set, so the geometry variant skips
 * one slot. Then per slot: copy the fixed 4-byte header from ENEMY_LIST_HEADER (0xc669) through the running
 * offset; when REDRAW_COUNTER (0x114) is set, emit a computed midpoint vertex (emitSlotMidpointVertex) plus
 * the slot entry (emitEnemySlotEntry); otherwise read the per-lane kind byte from LANE_TARGET_FLAG indexed
 * by the table cursor, and if its top bit is set copy four bytes with X/Y hi sign-extension (values >= 0x10
 * get the 0xe0 fill into PREV_X_HI / PREV_Y_HI, the previous-coordinate cells) before emitting the entry,
 * else copy a straight twelve-byte block. Each pass shifts that lane's kind byte left one (advancing its
 * per-frame flag), bumps the table cursor, and decrements the slot counter until it wraps past 0x80.
 *
 * Live-out: the freshly built enemy vector records at the draw cursor, the previous-coordinate cells
 * PREV_X_LO/HI and PREV_Y_LO/HI, the shifted LANE_TARGET_FLAG bytes, the restored DRAW_SRC_PTR_LO/HI, and
 * the cursor flushed forward via advanceDisplayCursor. Grounding: [seen].
 */
export function buildEnemyDisplayList(m) {
  const { mem8, mem16 } = m;

  if (mem8[loc_110] !== 0) return;                                   // suppress-flag gate: nothing to build
  if (mem8[DEPTH_LO] === 0 && mem8[DEPTH_HI] >= 0xf0) return;        // depth guard: tube empty, skip

  emitBlankVectorWordTag70(m, 0x01);                                 // open the list with a blank tag-70 word

  // Save the source/draw pointer (restored at the end) and reset the table cursor and running draw offset.
  const savedLo = mem8[DRAW_CURSOR_LO];
  const savedHi = mem8[DRAW_CURSOR_HI];
  mem8[TABLE_CURSOR] = 0x00;
  mem8[DRAW_CURSOR_OFFSET] = 0x00;

  // Slots run 0x0f down; the tube-geometry variant starts one lower so it emits one fewer record.
  let slot = 0x0f;
  if (mem8[TUBE_GEOM_FLAG] !== 0) slot = (slot - 1) & 0xff;
  mem8[SLOT_LOOP_INDEX] = slot;

  for (;;) {
    // Copy the fixed 4-byte enemy header into the list at the current offset.
    const dest = mem16[DRAW_CURSOR_LO];
    let cursor = mem8[DRAW_CURSOR_OFFSET];
    for (let h = 3; h >= 0; h--) {
      mem8[u16(dest + cursor)] = mem8[u16(ENEMY_LIST_HEADER + h)];
      cursor = u8(cursor + 1);
    }
    mem8[DRAW_CURSOR_OFFSET] = cursor;

    if (mem8[REDRAW_COUNTER] !== 0) {
      // Redraw pass: append a freshly computed midpoint vertex plus the slot entry.
      emitSlotMidpointVertex(m);
      emitEnemySlotEntry(m);
    } else {
      // Copy-from-template pass: the per-lane kind byte's top bit picks the record shape.
      const kind = mem8[u16(LANE_TARGET_FLAG + mem8[TABLE_CURSOR])];
      const src = mem16[DRAW_SRC_PTR_LO];
      let y = mem8[DRAW_CURSOR_OFFSET];
      if (kind & 0x80) {
        // Sign-fixed coordinate block: copy 4 bytes, sign-extending the X/Y hi nibbles (>=0x10 -> |0xe0)
        // into the previous-coordinate cells so wrapped tube coordinates stay negative.
        const b0 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b0; mem8[PREV_X_LO] = b0; y = u8(y + 1);
        const b1 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b1; mem8[PREV_X_HI] = b1 >= 0x10 ? b1 | 0xe0 : b1; y = u8(y + 1);
        const b2 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b2; mem8[PREV_Y_LO] = b2; y = u8(y + 1);
        const b3 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b3; mem8[PREV_Y_HI] = b3 >= 0x10 ? b3 | 0xe0 : b3; y = u8(y + 1);
        mem8[DRAW_CURSOR_OFFSET] = y;
        emitEnemySlotEntry(m);
      } else {
        // Straight block: copy twelve raw bytes from the template with no sign fix.
        for (let c = 0x0b; c >= 0; c--) {
          mem8[u16(dest + y)] = mem8[u16(src + y)];
          y = u8(y + 1);
        }
        mem8[DRAW_CURSOR_OFFSET] = y;
      }
    }

    // Advance this lane's flag one bit, step the table cursor, and count the slot down until it wraps.
    const idx = mem8[TABLE_CURSOR];
    mem8[u16(LANE_TARGET_FLAG + idx)] = mem8[u16(LANE_TARGET_FLAG + idx)] << 1;
    mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] + 1);
    const next = u8(mem8[SLOT_LOOP_INDEX] - 1);
    mem8[SLOT_LOOP_INDEX] = next;
    if (next >= 0x80) break;                                        // wrapped past 0 -> all slots done
  }

  // Restore the saved source pointer and flush the cursor to the byte just past the last record written.
  mem8[DRAW_SRC_PTR_HI] = savedHi;
  mem8[DRAW_SRC_PTR_LO] = savedLo;
  advanceDisplayCursor(m, u8(mem8[DRAW_CURSOR_OFFSET] - 1));
}
