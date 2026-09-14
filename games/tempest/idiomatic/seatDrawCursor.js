// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_OFFSET, POINTER_PARITY, DRAW_PTR_TABLE_A, DRAW_PTR_TABLE_B } from "./names.js";

/**
 * seatDrawCursor -- seat the indirect draw cursor $74/$75 for a layer. ROM 0xb2be.
 *
 * Role in the machine: this is the primary vector-draw pointer seater. Tempest renders a layer by
 * walking a coordinate/shape list through the indirect cursor at $74/$75 (DRAW_CURSOR_LO/HI); this
 * routine installs that cursor for the requested layer index, choosing between two candidate pointer
 * tables by a per-index parity flag. It is the companion of seatAltDrawPointer (which seats $3b/$3c):
 * here the nonzero flag picks DRAW_PTR_TABLE_A (ROM 0xce68), the zero flag DRAW_PTR_TABLE_B (0xce7a)
 * -- the opposite sense from the alternate seater.
 *
 * Behavior: take the layer selector in A as the index; double it (u8-wrapped) into the two-byte table
 * stride. Read the per-index flag at POINTER_PARITY+idx ($415+index): nonzero selects table A, zero
 * selects table B. Copy that table's low byte at +off into $74 and its high byte at +off+1 into $75.
 * Finally clear the status/offset cell $a9 (DRAW_CURSOR_OFFSET) so the walk begins at the list head.
 *
 * Live-out: the draw cursor $74/$75 (DRAW_CURSOR_LO/HI) and the cleared status cell $a9
 * (DRAW_CURSOR_OFFSET). Grounding: [seen].
 */
export function seatDrawCursor(m, a = m.regs.a) {
  const { mem8 } = m;
  const idx = a;                                             // layer selector = table index
  const off = (a << 1) & 0xff;                               // two-byte table stride
  // Nonzero flag selects table A; zero selects table B (sense reversed vs seatAltDrawPointer).
  const table = mem8[u16(POINTER_PARITY + idx)] !== 0 ? DRAW_PTR_TABLE_A : DRAW_PTR_TABLE_B;
  mem8[DRAW_CURSOR_LO] = mem8[u16(table + off)];                     // pointer low byte
  mem8[DRAW_CURSOR_HI] = mem8[u16(table + 1 + off)];                 // pointer high byte
  mem8[DRAW_CURSOR_OFFSET] = 0;                                          // clear the status cell
}
