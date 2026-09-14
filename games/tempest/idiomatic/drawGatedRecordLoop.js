// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, VG_RECORD_HEADER, DRAW_CURSOR_LO, DRAW_CURSOR_HI,
  DRAW_PATCH_PTR_LO, DRAW_PATCH_PTR_HI, TUBE_GEOM_FLAG, COL_VAL_A, COL_SUB_A, COL_VAL_B, COL_SUB_B,
} from "./names.js";
import { emitObjectPositionVector } from "./emitObjectPositionVector.js";
import { emitProjectedSlotRecord } from "./emitProjectedSlotRecord.js";

/**
 * drawGatedRecordLoop — draw a gated run of projected slot records across the tube. ROM 0xc36e.
 *
 * Role in the machine: emits one row/ring of projected slot records into the vector display list,
 * but only when its gate argument permits. It seats a projected position from four parallel
 * indexed coordinate tables, plants the record header, then walks the slot index backwards drawing
 * one record per pass over the whole tube — 0x0f passes normally, one fewer when the tube-geometry
 * flag marks an open (non-wrapping) tube. The index-fixup keeps the walk aligned to the 16-slot
 * ring structure Tempest uses for lane positions.
 *
 * Behavior: returns immediately when the gate byte A is nonzero. Otherwise seats SLOT_LOOP_INDEX
 * (loc_37) from Y, then loads the projected coordinate fields — PROJ_Y_LO/HI (loc_61/62) from the
 * COL_SUB_A/COL_VAL_A tables and PROJ_X_LO/HI (loc_63/64) from COL_SUB_B/COL_VAL_B, all indexed by
 * Y. It emits the object position vector (0x61), then caches the draw cursor (DRAW_CURSOR_LO/HI)
 * into the patch pointer (DRAW_PATCH_PTR_LO/HI) so the header can be back-patched. The pass count
 * is 0x0e when TUBE_GEOM_FLAG (loc_111) is set, else 0x0f; the header (loc_73) is set to 0xc0 and
 * the pass counter TABLE_CURSOR (loc_...) is seeded. The loop decrements SLOT_LOOP_INDEX each pass,
 * and whenever the low nibble wraps to 0x0f it adds 0x10 (stepping to the next 16-slot ring group),
 * emits a projected slot record, and decrements the pass counter until it goes negative (bit7 set).
 *
 * Live-out: the run of projected slot records in the display list, the seated PROJ_Y/X fields, the
 * back-patch pointer DRAW_PATCH_PTR_LO/HI, VG_RECORD_HEADER (0xc0), and SLOT_LOOP_INDEX left at the
 * final stepped index. Grounding: [seen].
 */
export function drawGatedRecordLoop(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  if (a !== 0) return; // gate: nonzero A suppresses the whole draw

  // Seat the projected position from the four parallel coordinate tables, indexed by Y.
  mem8[SLOT_LOOP_INDEX] = y;
  mem8[PROJ_Y_LO] = mem8[u16(COL_SUB_A + y)];
  mem8[PROJ_Y_HI] = mem8[u16(COL_VAL_A + y)];
  mem8[PROJ_X_LO] = mem8[u16(COL_SUB_B + y)];
  mem8[PROJ_X_HI] = mem8[u16(COL_VAL_B + y)];

  emitObjectPositionVector(m, 0x61);
  // Cache the draw cursor so the emitted header can be back-patched later.
  mem8[DRAW_PATCH_PTR_LO] = mem8[DRAW_CURSOR_LO];
  mem8[DRAW_PATCH_PTR_HI] = mem8[DRAW_CURSOR_HI];

  // One fewer pass on an open tube; header 0xc0 opens the record run.
  const count = mem8[TUBE_GEOM_FLAG] !== 0 ? 0x0e : 0x0f;
  mem8[VG_RECORD_HEADER] = 0xc0;
  mem8[TABLE_CURSOR] = count;

  do {
    let t = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = t;
    // Low-nibble wrap: hop to the next 16-slot ring group.
    if ((t & 0x0f) === 0x0f) mem8[SLOT_LOOP_INDEX] = t + 0x10;
    emitProjectedSlotRecord(m);
    mem8[TABLE_CURSOR] = mem8[TABLE_CURSOR] - 1;
  } while ((mem8[TABLE_CURSOR] & 0x80) === 0); // until the pass counter goes negative
}
