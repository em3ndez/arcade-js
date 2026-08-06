// SPDX-License-Identifier: GPL-3.0-only
/** loc_0010 — pick one entry out of a table of two-byte entries and hand back the word held
 * there. The entry number is doubled to reach its entry, and that doubling wraps at eight bits,
 * so number 128 selects the same entry as number 0. LIVE-OUT: the word, returned and left
 * standing for the caller, which reads it as a pointer or as a pair of bytes; the table pointer,
 * moved on to just past the entry so a caller can keep walking; and the low half of the entry's
 * address, echoed back into the byte the entry number came in on. Nothing is written. */

import { u8 } from "../../../core/int.js";
import { offsetAddress } from "./offsetAddress.js";

export function loc_0010(m) {
  const { regs, mem16 } = m;
  const entryNumber = regs.a;
  regs.a = u8(entryNumber + entryNumber);
  const entryAddress = offsetAddress(m);
  const word = mem16[entryAddress];
  regs.de = word;
  regs.hl = entryAddress + 2;
  return word;
}
