// SPDX-License-Identifier: GPL-3.0-only
import { CONFIG_DIP_BYTE, loc_21bf } from "./names.js";

/**
 * readFdBitsTableByte — pick a ROM table byte using bits 5-4 of the option-config cell.
 *
 * CONFIG_DIP_BYTE ($fd [seen]) is the snapshot of the machine's option DIP bank taken at
 * boot; its upper bits select ROM-table variants for various difficulty/mode features.
 * This is a small shared HELPER: several callers need "the table entry selected by the
 * two option bits 5-4", so this routine folds those bits down to an even table index
 * {0,2,4,6} and reads the corresponding byte out of the ROM table at loc_21bf ($21bf [seen]).
 *
 * The index is even (spaced by 2) because the callers keep a PARALLEL table alongside
 * loc_21bf and reuse the very same index against it — hence the index is handed back in Y
 * so the caller can index that companion table without recomputing the shift.
 *
 * ROM 0x… . Grounding: CONFIG_DIP_BYTE and the loc_21bf ROM table are [seen]; the bit-select
 * arithmetic is [code], read from behaviour.
 * Live-out: A = the selected table byte; Y = the even index (for the caller's parallel table).
 */
export function readFdBitsTableByte(m) {
  const { mem8 } = m;
  // Extract config bits 5-4 (& 0x30) and shift right by 3. That drops the pair to
  // an even index: 0x00→0, 0x10→2, 0x20→4, 0x30→6 — one slot per option combination,
  // spaced by 2 so the same index also addresses the caller's parallel table.
  // Bits 5-4 of $fd shifted to an even index 0/2/4/6.
  const idx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  // Fetch the selected byte from the ROM table at loc_21bf.
  const value = mem8[loc_21bf + idx];
  // Publish both outputs: Y carries the index (reused for the parallel table),
  // A carries the fetched table byte.
  // Y carries the index (the caller reuses it for a parallel table); A carries the byte.
  return (m.regs.y = idx), (m.regs.a = value);
}
