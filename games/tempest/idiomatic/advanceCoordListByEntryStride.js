// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI } from "./names.js";

/**
 * advanceCoordListByEntryStride — step the coordinate-list cursor by an inter-entry delta. ROM 0x96cb
 * (one of the cursor-advance handlers behind dispatchCursorAdvanceBySelector).
 *
 * Role in the machine: Tempest draws its tube, enemies, and glyphs by walking packed *coordinate lists*
 * through a single zero-page pointer pair, COORD_LIST_PTR_LO/HI ($2c/$2d). A list is a run of entries
 * whose values themselves encode how far apart they sit, so advancing the read cursor is not a fixed
 * increment — each step's size is the difference between the entry under the cursor and the one just
 * before it. This routine is that variable-stride advance: it is one of the three cursor-advance helpers
 * (alongside advanceListCursorByTwo and advanceCursorPastPackedRecord) that dispatchCursorAdvanceBySelector
 * tail-calls, and reseedStateTables reaches it to push the source-list cursor forward when the sought key
 * still lies outside the current entry's range.
 *
 * Behavior: rebuild the 16-bit list base from COORD_LIST_PTR_LO | (COORD_LIST_PTR_HI << 8), then read the
 * entry at the current cursor Y (cur) and its predecessor at Y-1 (prev). Their 8-bit difference cur - prev
 * is the inter-entry stride; it is stashed at loc_29 ($29) as the step delta. The cursor then advances by
 * that stride plus a fixed two: the returned A is (Y-1 + delta + 1) and the returned Y is that A plus 2,
 * both wrapped to a byte. Observed strides run 1..0x0f, the genuine gaps of the lists reached through the
 * coordinate dispatch.
 *
 * Live-out: loc_29 holds the computed step delta for the caller; A and Y both carry the advanced cursor
 * (Y two beyond A). The COORD_LIST_PTR pair is read, not modified. Fired as a direct JS call: no stack
 * frame, just the [A, Y] return. Grounding: [seen].
 */
export function advanceCoordListByEntryStride(m, y = m.regs.y) {
  const { mem8 } = m;
  // Reassemble the list base from the seated zero-page pointer pair ($2c low, $2d high).
  const ptr = mem8[COORD_LIST_PTR_LO] | (mem8[COORD_LIST_PTR_HI] << 8);
  const cur = mem8[u16(ptr + y)];       // entry the cursor currently points at
  const yDec = u8(y - 1);               // predecessor index (Y-1, byte-wrapped)
  const prev = mem8[u16(ptr + yDec)];   // the entry just before it
  const delta = u8(cur - prev);         // inter-entry stride = cur - prev (8-bit)
  mem8[loc_29] = delta;                 // publish the stride at $29 for the caller
  const aOut = u8(yDec + delta + 1);    // cursor stepped forward by the stride (via Y-1 + delta + 1)
  const yOut = u8(aOut + 2);            // Y lands two past A, ready for the next entry pair
  return [(m.regs.a = aOut), (m.regs.y = yOut)];
}
