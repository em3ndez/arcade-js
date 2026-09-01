// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2008, loc_2009, ALIEN_DRAW_ADDR, FLEET_MOVE_DIR } from "./names.js";
import { activeFieldRecordPointer } from "./activeFieldRecordPointer.js";

// Load the active record's 16-bit pointer, mirror it to two cells, then derive a count byte (dropped by one when 3) and an edge flag (set when the count reads 0xfe) from the byte just below the pointer.
export function loadReferenceAlienState(m) {
  const { mem8, mem16 } = m;
  const ptr = activeFieldRecordPointer(m);
  const value = mem16[ptr];
  mem16[loc_2009] = value;
  mem16[ALIEN_DRAW_ADDR] = value;
  const below = mem8[u16(ptr - 1)];
  const count = below === 0x03 ? u8(below - 1) : below;
  mem8[loc_2008] = count;
  mem8[FLEET_MOVE_DIR] = count === 0xfe ? 0x01 : 0x00;
}
