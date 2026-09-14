// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  TABLE_CURSOR, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI,
  DRAW_CURSOR_LO, DRAW_CURSOR_OFFSET, OBJ_DY_HI, OBJ_DY_LO, OBJ_DX_HI, OBJ_DX_LO,
} from "./names.js";

/**
 * emitSlotMidpointVertex -- append the geometric midpoint between one tube slot and its
 * neighbour to the enemy display list. ROM 0xc66d.
 *
 * Role in the machine: Tempest's tube is a ring of sixteen slots (lanes). When the enemy
 * display builder (buildEnemyDisplayList, 0xc5c2) needs a vertex that sits *between* two
 * lanes -- for a shape straddling a lane boundary -- it calls here. This routine takes the
 * slot named by the table cursor (loc_38) and its wrap-around neighbour ((slot+1) & 0x0f,
 * so slot 15 wraps to slot 0), averages the two lanes' object coordinates, and lays the
 * resulting midpoint vertex into the pointer-based vector list. It is the "halfway point on
 * the rim" primitive for objects that span a segment gap.
 *
 * Behaviour: the slot's Y coordinate pair lives in the parallel low/high tables OBJ_DY_LO/HI
 * (loc_35a/loc_36a) and its X pair in OBJ_DX_LO/HI (loc_37a/loc_38a). halfSum() adds a pair
 * to the neighbour's pair with a +1 round-up bias into the low byte, propagates carry into
 * the high byte, then right-shifts the 16-bit sum one bit while preserving the sign bit --
 * the 6502 ROR-with-sign halve. The Y midpoint is stashed into PROJ_Y_LO/HI (loc_61/loc_62)
 * and the X midpoint into PROJ_X_LO/HI (loc_63/loc_64). It then reads the display cursor
 * base pointer (DRAW_CURSOR_LO, loc_74) and its running byte offset (DRAW_CURSOR_OFFSET,
 * loc_a9), and writes four bytes at (ptr+offset): X-lo, X-hi, Y-lo, Y-hi. Each high byte is
 * masked to 0x1f before it is written (the top three bits are vector opcode tag bits, not
 * coordinate data, so they must be cleared). The same four values are also mirrored into the
 * PREV_X/PREV_Y scratch cells so the next record can reference this vertex. The offset is
 * bumped one per byte and written back.
 *
 * Live-out: PROJ_X/PROJ_Y (loc_61-loc_64) hold the computed midpoint; PREV_X/PREV_Y mirror
 * the four emitted bytes; the display list at (loc_74) gains four bytes and DRAW_CURSOR_OFFSET
 * (loc_a9) advances by four. Grounding: [seen].
 */

// Round-up signed average of two 16-bit bytes (halve preserving the sign bit): sum the two
// low bytes with a +1 bias, carry into the high sum, then right-shift the 16-bit result one
// place with the high byte's sign bit held (the 6502 ROR-preserving-sign halve).
function halfSum(loA, hiA, loB, hiB) {
  const loSum = loA + loB + 1;
  const low = loSum & 0xff;
  const carry = loSum > 0xff ? 1 : 0;
  const high = (hiA + hiB + carry) & 0xff;
  return [(low >> 1) | ((high & 0x01) << 7), (high >> 1) | (high & 0x80)];
}

// Average one slot's two coordinate pairs with its wrap-around neighbour, stash the two
// midpoints, then append the four midpoint bytes to the pointer-based display list (high
// bytes masked to 0x1f) and mirror all four into a scratch block.
export function emitSlotMidpointVertex(m) {
  const { mem8, mem16 } = m;
  const slot = mem8[TABLE_CURSOR];            // loc_38: the active tube slot (lane 0..15)
  const next = (slot + 1) & 0x0f;             // its ring neighbour, wrapping 15 -> 0

  // Y midpoint: average this slot's and the neighbour's Y coordinate pair.
  const [lo1, hi1] = halfSum(
    mem8[u16(OBJ_DY_LO + slot)], mem8[u16(OBJ_DY_HI + slot)],
    mem8[u16(OBJ_DY_LO + next)], mem8[u16(OBJ_DY_HI + next)]);
  mem8[PROJ_Y_LO] = lo1;                      // loc_61/loc_62: stash the Y midpoint
  mem8[PROJ_Y_HI] = hi1;

  // X midpoint: same average over the X coordinate pair.
  const [lo2, hi2] = halfSum(
    mem8[u16(OBJ_DX_LO + slot)], mem8[u16(OBJ_DX_HI + slot)],
    mem8[u16(OBJ_DX_LO + next)], mem8[u16(OBJ_DX_HI + next)]);
  mem8[PROJ_X_LO] = lo2;                      // loc_63/loc_64: stash the X midpoint
  mem8[PROJ_X_HI] = hi2;

  // Append four vertex bytes (X-lo, X-hi, Y-lo, Y-hi) to the display list at (loc_74)+loc_a9.
  const ptr = mem16[DRAW_CURSOR_LO];          // loc_74: display-list base pointer
  let cursor = mem8[DRAW_CURSOR_OFFSET];      // loc_a9: running byte offset into the list
  mem8[u16(ptr + cursor)] = lo2; cursor = u8(cursor + 1);
  mem8[PREV_X_LO] = lo2;                      // mirror X into the PREV scratch pair
  mem8[PREV_X_HI] = hi2;
  mem8[u16(ptr + cursor)] = hi2 & 0x1f; cursor = u8(cursor + 1); // strip opcode tag bits
  mem8[u16(ptr + cursor)] = lo1; cursor = u8(cursor + 1);
  mem8[PREV_Y_LO] = lo1;                      // mirror Y into the PREV scratch pair
  mem8[PREV_Y_HI] = hi1;
  mem8[u16(ptr + cursor)] = hi1 & 0x1f; cursor = u8(cursor + 1); // strip opcode tag bits
  mem8[DRAW_CURSOR_OFFSET] = cursor;          // commit the advanced offset (loc_a9 += 4)
}
