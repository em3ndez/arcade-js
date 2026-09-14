// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { WORK_PTR_LO, WORK_PTR_HI, DRAW_CURSOR_OFFSET, POINTER_PARITY, DRAW_PTR_TABLE_A, DRAW_PTR_TABLE_B } from "./names.js";

/**
 * seatAltDrawPointer -- seat the alternate draw pointer $3b/$3c for a layer. ROM 0xb2de.
 *
 * Role in the machine: Tempest draws its vector shapes by chasing a pointer into a shape/coordinate
 * list. This is the alternate seater (companion to seatDrawCursor, which seats $74/$75): it installs
 * the working draw pointer at $3b/$3c (WORK_PTR_LO/HI) for the requested layer index, choosing between
 * two candidate pointer tables by a per-index parity flag. Its table sense is deliberately reversed
 * versus seatDrawCursor -- the nonzero flag here picks DRAW_PTR_TABLE_B (ROM 0xce7a), the zero flag
 * DRAW_PTR_TABLE_A (0xce68).
 *
 * Behavior: take the layer selector in A as the index; double it (u8-wrapped) into the two-byte table
 * stride. Read the per-index flag at POINTER_PARITY+idx ($415+index): nonzero selects table B, zero
 * selects table A. Copy that table's low byte at +off into $3b and its high byte at +off+1 into $3c.
 * Finally clear the status/offset cell $a9 (DRAW_CURSOR_OFFSET) so the consumer starts at the head.
 *
 * Live-out: the alternate draw pointer $3b/$3c (WORK_PTR_LO/HI) and the cleared status cell $a9
 * (DRAW_CURSOR_OFFSET). Grounding: [seen].
 */
export function seatAltDrawPointer(m, a = m.regs.a) {
  const { mem8 } = m;
  const idx = a;                                             // layer selector = table index
  const off = (a << 1) & 0xff;                               // two-byte table stride
  // Nonzero flag selects table B; zero selects table A (sense reversed vs seatDrawCursor).
  const table = mem8[u16(POINTER_PARITY + idx)] !== 0 ? DRAW_PTR_TABLE_B : DRAW_PTR_TABLE_A;
  mem8[WORK_PTR_LO] = mem8[u16(table + off)];                     // pointer low byte
  mem8[WORK_PTR_HI] = mem8[u16(table + 1 + off)];                 // pointer high byte
  mem8[DRAW_CURSOR_OFFSET] = 0;                                          // clear the status cell
}
