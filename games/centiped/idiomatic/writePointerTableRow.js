// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_346d, loc_8b, loc_8c, loc_91, loc_92, loc_93, loc_94, loc_ef, CONFIG_DIP_BYTE } from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * writePointerTableRow — draw one row of a screen layout by walking a descriptor and emitting its bytes
 * through the output cursor. A row selector in A, plus the low two bits of a mode cell, indexes a pointer
 * table to fetch the row descriptor pointer. The descriptor's first word (offset 0 normally, else 2) is
 * the emit-target cursor; bytes from offset 4 on are tile codes. The selector's top bit is rotated into a
 * sign cell the emit loop reads as a blank-out flag. rewritePointerTableRowFromStart re-enters the loop
 * at descriptor offset 0 with the current descriptor. The loop keeps each byte's low 6 bits, forces it to
 * 0 on the 0x20 "space" code or a negative sign cell, folds a 0x30-range code into the 0x20 range, and
 * hands it to the store sub; the row ends at the first descriptor byte whose top bit is set. [code]
 */
export function writePointerTableRow(m, a = m.regs.a) {
  const { mem8, mem16 } = m;

  // Rotate A's top bit into the sign cell.
  mem8[loc_8c] = (mem8[loc_8c] >> 1) | (((a >> 7) & 1) << 7);
  // Derive the pointer-table index from (A << 2) OR'd with the mode cell's low two bits, then doubled.
  const doubled = u8(a << 2);
  mem8[loc_8b] = doubled;
  const idx = u8(((mem8[CONFIG_DIP_BYTE] & 0x03) | doubled) << 1);
  // Fetch the row descriptor pointer from the table.
  mem8[loc_93] = mem8[u16(loc_346d + idx)];
  mem8[loc_94] = mem8[u16(loc_346d + 1 + idx)];

  // The emit-target pointer sits at descriptor offset 0 (loc_ef == 0) or 2 (loc_ef != 0).
  const startY = mem8[loc_ef] === 0 ? 0 : 2;
  const descriptor = mem16[loc_93];
  mem8[loc_91] = mem8[u16(descriptor + startY)];
  mem8[loc_92] = mem8[u16(descriptor + startY + 1)];
  // The tile codes start at descriptor offset 4.
  mem8[loc_8b] = 0x04;
  return runEmitLoop(m);
}

export function rewritePointerTableRowFromStart(m, y = m.regs.y) {
  // Re-enter at descriptor offset 0 (Y = 0), keeping the current descriptor.
  m.mem8[loc_8b] = y;
  return runEmitLoop(m);
}

// The shared emit loop: walk the descriptor from the index cursor, emit each byte, stop at the first
// byte whose top bit is set.
function runEmitLoop(m) {
  const { mem8, mem16 } = m;
  const descriptor = mem16[loc_93]; // the descriptor pointer is stable across the loop (the emit sub moves the output cursor)
  for (;;) {
    const idx = mem8[loc_8b];
    const raw = mem8[u16(descriptor + idx)];
    let byte = raw & 0x3f;
    // Force to blank on the space code 0x20 or when the sign cell is flagged negative.
    if (byte === 0x20 || mem8[loc_8c] & 0x80) byte = 0x00;
    // Fold a 0x30-range code down into the 0x20 range.
    if (byte >= 0x30) byte &= 0x2f;
    // Emit through the output cursor (advances it) via the store sub.
    writeMaskedByteAndAdvancePointer(m, byte);
    mem8[loc_8b] = u8(idx + 1);
    // Re-read the raw descriptor byte just processed: its top bit terminates the row.
    if (mem8[u16(descriptor + idx)] & 0x80) return;
  }
}
