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
 *
 * ROM 0x346d: the row-descriptor pointer table lives in ROM at loc_346d [seen]; a (selector, mode-bits) pair
 * indexes it to pick which ROM descriptor — and therefore which pre-authored screen row — to paint.
 * CONFIG_DIP_BYTE ($fd) [seen] is the mode/config byte whose low two bits vary the selection.
 * GROUNDING: [code] for the control flow; the ROM table loc_346d and the config cell $fd are [seen].
 * LIVE-OUT: register carry — the last emitted byte's cursor-advance carry-out, forwarded to the caller.
 */
export function writePointerTableRow(m, a = m.regs.a) {
  const { mem8, mem16 } = m;

  // The selector A carries the "blank this row" intent in its top bit. Rotate that bit into the sign cell
  // loc_8c == $8c (shifting $8c right first), so the emit loop below can read $8c bit7 as a blank-out flag
  // while the low bits of $8c are unrelated state that shifts along.
  // Rotate A's top bit into the sign cell.
  mem8[loc_8c] = (mem8[loc_8c] >> 1) | (((a >> 7) & 1) << 7);
  // Build the pointer-table index: the selector is shifted up two bits (A << 2), OR'd with the mode cell's
  // low two bits so the same selector picks different rows per config, then doubled because each table entry
  // is a 2-byte pointer. loc_8b == $8b is reused here as scratch for the pre-doubled value.
  // Derive the pointer-table index from (A << 2) OR'd with the mode cell's low two bits, then doubled.
  const doubled = u8(a << 2);
  mem8[loc_8b] = doubled;
  const idx = u8(((mem8[CONFIG_DIP_BYTE] & 0x03) | doubled) << 1);
  // Read the two-byte descriptor pointer out of the ROM table at loc_346d+idx into $93 (low) / $94 (high).
  // Fetch the row descriptor pointer from the table.
  mem8[loc_93] = mem8[u16(loc_346d + idx)];
  mem8[loc_94] = mem8[u16(loc_346d + 1 + idx)];

  // The descriptor's first word is the emit-target video cursor. Which word depends on orientation: offset 0
  // for the upright cabinet (loc_ef == $ef == 0), offset 2 for the flipped one — so the row lands at the
  // mirrored screen position without a second descriptor.
  // The emit-target pointer sits at descriptor offset 0 (loc_ef == 0) or 2 (loc_ef != 0).
  const startY = mem8[loc_ef] === 0 ? 0 : 2;
  const descriptor = mem16[loc_93];
  // Seed the output cursor $91/$92 from that descriptor word — this is where the store primitive will paint.
  mem8[loc_91] = mem8[u16(descriptor + startY)];
  mem8[loc_92] = mem8[u16(descriptor + startY + 1)];
  // Tile codes begin at descriptor offset 4 (offsets 0..3 held the target word). Point the walk index there.
  // The tile codes start at descriptor offset 4.
  mem8[loc_8b] = 0x04;
  return runEmitLoop(m);
}

export function rewritePointerTableRowFromStart(m, y = m.regs.y) {
  // Redraw entry: keep whatever descriptor $93/$94 already point at, but reset the walk index (from Y, which
  // callers pass as 0) so the emit loop re-runs from the top of the SAME row. Used to repaint a row in place.
  // Re-enter at descriptor offset 0 (Y = 0), keeping the current descriptor.
  m.mem8[loc_8b] = y;
  return runEmitLoop(m);
}

// The shared emit loop: walk the descriptor from the index cursor, emit each byte, stop at the first
// byte whose top bit is set.
function runEmitLoop(m) {
  const { mem8, mem16 } = m;
  const descriptor = mem16[loc_93]; // the descriptor pointer is stable across the loop (the emit sub moves the output cursor)
  let carry; // exit carry (register-out): the last emit's cursor-advance carry-out
  for (;;) {
    // Read the next descriptor byte at the walk index ($8b). Its low 6 bits are the tile code; the top bit
    // (checked at the bottom) is the row terminator flag.
    const idx = mem8[loc_8b];
    const raw = mem8[u16(descriptor + idx)];
    let byte = raw & 0x3f;
    // A 0x20 code is the "space" tile, and a negative sign cell ($8c bit7) means the whole row is blanked —
    // either way the emitted tile becomes a literal blank (0x00).
    // Force to blank on the space code 0x20 or when the sign cell is flagged negative.
    if (byte === 0x20 || mem8[loc_8c] & 0x80) byte = 0x00;
    // Codes in the 0x30 range are folded down into the 0x20 range (& 0x2f) — a character-set remap so the
    // descriptor can use a compact code that maps onto the actual tile glyph.
    // Fold a 0x30-range code down into the 0x20 range.
    if (byte >= 0x30) byte &= 0x2f;
    // Hand the resolved tile to the store primitive, which paints it and advances the output cursor one cell;
    // keep its carry-out as this loop's running result.
    // Emit through the output cursor (advances it) via the store sub.
    carry = writeMaskedByteAndAdvancePointer(m, byte);
    // Step the walk index to the next descriptor byte.
    mem8[loc_8b] = u8(idx + 1);
    // The row ends at the first descriptor byte whose top bit is set. Re-read the raw byte we just processed
    // (its low bits were the tile; its top bit is the terminator) and return once we hit that sentinel.
    // Re-read the raw descriptor byte just processed: its top bit terminates the row.
    if (mem8[u16(descriptor + idx)] & 0x80) return carry;
  }
}
