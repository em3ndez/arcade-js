// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_9e, loc_9f, SLOT_LOOP_INDEX, OBJ_DEPTH, loc_29, HIGH_LEVEL_MARKER, loc_720,
  SHAPE_ACTIVE, SHAPE_COORD, SHAPE_ID, SHAPE_ANIM, ENEMY_SHAPE_BASE,
} from "./names.js";
import { animateShapeOneVector } from "./animateShapeOneVector.js";
import { seatShapeParamsAndEmit } from "./seatShapeParamsAndEmit.js";

/**
 * drawEnemyShapeList — emit one shape record per active enemy slot. ROM 0xb79a.
 *
 * Role in the machine: the eight-slot shape bank holds the enemies currently on the tube. Each frame this
 * routine walks that bank top-down and, for every occupied slot, emits the vector-shape record that draws
 * that enemy at its depth and coordinate. Shape id 1 (the animated flipper form) has its own multi-vector
 * draw path; every other shape id is drawn from a computed shape-table word. After the walk it latches the
 * current level into a high-level marker so deep levels are remembered for later display work.
 *
 * Behaviour: clear scratch loc_9e (0x9e), then loop the slot index SLOT_LOOP_INDEX (0x37) from 7 down to
 * 0. For each slot read its active flag from SHAPE_ACTIVE+slot (0x30a); a zero means the slot is empty and
 * is skipped. For a live slot, that same byte is the object depth, so seat it in OBJ_DEPTH (0x57), and
 * copy the slot's coordinate SHAPE_COORD+slot (0x2fa) into scratch loc_29 (0x29). Then branch on the shape
 * id SHAPE_ID+slot (0x302): id 1 draws via animateShapeOneVector; otherwise build a shape-table word —
 * take the slot's animation byte SHAPE_ANIM+slot (0x312) >>1 masked to even (&0xfe) as the base, force the
 * base to 0 for any shape id >= 2, add the per-shape offset ENEMY_SHAPE_BASE+shape (0xb7e5), mask to a
 * byte, and emit via seatShapeParamsAndEmit with the coordinate from loc_29. Decrement the loop index and
 * stop once it goes negative (bit 7 set). After the walk: if the guard loc_720 (0x720) is zero, return;
 * otherwise read the level byte loc_9f (0x9f), and only when it is at least 0x0d latch it into the high-
 * level marker HIGH_LEVEL_MARKER (0x1ff).
 *
 * Live-out: OBJ_DEPTH (0x57) and loc_29 (0x29) left holding the last drawn slot's depth/coordinate; the
 * shape records appended to the active display list; SLOT_LOOP_INDEX (0x37) left at 0xff; and, on a deep
 * level with loc_720 set, HIGH_LEVEL_MARKER (0x1ff) latched to the level byte. Grounding: [seen].
 */
export function drawEnemyShapeList(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x00;               // clear scratch loc_9e
  mem8[SLOT_LOOP_INDEX] = 0x07;      // walk slots 7 down to 0
  while (true) {
    const slot = mem8[SLOT_LOOP_INDEX];
    const cell = mem8[u16(SHAPE_ACTIVE + slot)];   // active flag doubles as the object depth
    if (cell !== 0) {                              // skip empty slots
      mem8[OBJ_DEPTH] = cell;                      // seat depth
      mem8[loc_29] = mem8[u16(SHAPE_COORD + slot)]; // seat this slot's coordinate
      const shape = mem8[u16(SHAPE_ID + slot)];
      if (shape === 1) {
        animateShapeOneVector(m);                  // shape 1: special animated draw
      } else {
        // Build the shape-table word: anim-byte base (0 for shape>=2) + per-shape ROM offset.
        let base = (mem8[u16(SHAPE_ANIM + slot)] >> 1) & 0xfe;
        if (shape >= 2) base = 0x00;
        const val = (base + mem8[u16(ENEMY_SHAPE_BASE + shape)]) & 0xff;
        seatShapeParamsAndEmit(m, val, mem8[loc_29]);
      }
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;          // stop once the index goes negative
  }
  if (mem8[loc_720] === 0) return;   // guard clear: nothing to latch
  const saved = mem8[loc_9f];        // current level byte
  if (saved < 0x0d) return;          // only deep levels are remembered
  mem8[HIGH_LEVEL_MARKER] = saved;   // latch the high-level marker
}
