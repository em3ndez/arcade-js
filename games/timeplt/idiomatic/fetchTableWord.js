// SPDX-License-Identifier: GPL-3.0-only
/** fetchTableWord — pick one entry out of a table of two-byte entries and hand back the word held
 * there. The entry number is doubled to reach its entry, and that doubling wraps at eight bits,
 * so number 128 selects the same entry as number 0. LIVE-OUT: the word, returned and left
 * standing for the caller, which reads it as a pointer or as a pair of bytes. Nothing is written. */

import { u8 } from "../../../core/int.js";
import { offsetAddress } from "./offsetAddress.js";

export function fetchTableWord(m, a = m.regs.a, table = m.regs.hl) {
  const { regs, mem16 } = m;
  const entryAddress = offsetAddress(m, table, u8(a + a));
  const word = mem16[entryAddress];
  return (regs.de = word);
}
