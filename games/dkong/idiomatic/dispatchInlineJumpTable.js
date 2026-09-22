// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInlineJumpTable — inline-jump-table trampoline: pop the table base the caller pushed as
 * data, read the little-endian word at table[selector], and dispatch to it. The shared
 * computed-dispatch primitive; steered only by the selector and the table base on the stack.
 *
 * LIVE-OUT: the stack pointer past the consumed base, the arm's memory writes, and the arm's skip
 * boolean, which this routine propagates unchanged.
 */
import { u16 } from "../../../core/int.js";
import { loc_00ca } from "./loc_00ca.js";

export function dispatchInlineJumpTable(m, site = "the NMI game-state table", a = m.regs.a) {
  const { mem8 } = m;

  // Double the selector into a byte offset (8-bit, so 0x80 wraps to 0), pop the table base the
  // caller pushed, and read the little-endian target word at table[selector].
  const offset = (a << 1) & 0xff;
  const base = m.pop16();
  const entryAddr = u16(base + offset);
  const target = mem8[entryAddr] | (mem8[u16(entryAddr + 1)] << 8);

  return loc_00ca(m, target, site);
}
