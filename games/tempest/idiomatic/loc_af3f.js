// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_METRIC, loc_2e, COUNT_GLYPH_COORD_TABLE } from "./names.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { loc_af71 } from "./loc_af71.js";
import { emitBlankValueRecord } from "./emitBlankValueRecord.js";
import { drawShapeListAtPosition } from "./drawShapeListAtPosition.js";
import { emitSlotIndexDigit } from "./emitSlotIndexDigit.js";

// Draw one slot: skip it when empty, else emit its capped count at the slot's screen position.
export function loc_af3f(m, x = m.regs.x) {
  const { mem8 } = m;
  const count = mem8[u16(SLOT_METRIC + x)];
  if (count === 0) return;
  mem8[loc_2e] = x;
  emitColorStatIfChanged(m, 0x03);
  loc_ab0d(m);
  emitScaledCoordinateRecord(m, 0xd0, mem8[u16(COUNT_GLYPH_COORD_TABLE + mem8[loc_2e])]);
  loc_af71(m, count);
  emitBlankValueRecord(m, 0xa0);
  drawShapeListAtPosition(m, 0x04, 0x10);
  emitSlotIndexDigit(m, mem8[loc_2e]);
}
