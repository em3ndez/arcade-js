// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawBoardLayout — walk the board-layout segment table and draw each segment (the girders and
 * ladders the board is made of). Each record is at least five bytes; the table ends with a
 * terminator (0xaa) in the kind field.
 *
 * LIVE-OUT: memory-only.
 */

// The imported second-point conversion is the faithful lift (consumes one guest-stack word the
// idiomatic twin does not) — use its machine-shaped entry, not a bare (y, x) pure function.
import { u16 } from "../../../core/int.js";
import { loc_2ff0 } from "../translated/loc_2ff0.js";
import { loc_0dd3 } from "./loc_0dd3.js";
import { SEG_ADDR1, SEG_SUBTILE1, SEG_KIND, SEG_SUBTILE_Y1 } from "./names.js";

export function drawBoardLayout(m, sp = m.regs.sp, de = m.regs.de) {
  const { regs, mem8, mem16 } = m;

  // The conversion leaf and the per-segment step each pop the guest stack
  // with no matching push on this path; the hardware balances to no net movement per record, so
  // sp is pinned back to this base each iteration. A stack seam, not logic, and not a live-out.
  const spBase = sp;

  for (;;) {
    regs.sp = spBase;

    const kind = mem8[de];
    mem8[SEG_KIND] = kind;
    if (kind === 0xaa) return;

    // First point: y then x. The address-conversion leaf reads them from H and L, so hand them
    // over there; the local pointer keeps walking the table independently.
    de = u16(de + 1);
    const y = mem8[de];
    regs.h = y;
    de = u16(de + 1);
    const x = mem8[de];
    regs.l = x;

    // Convert the first point to a tile address. The callee clobbers the register file (including
    // DE) but not our local pointer, so no save/restore is needed around it.
    loc_2ff0(m);
    mem16[SEG_ADDR1] = regs.hl;

    // Sub-tile remainders: the conversion dropped the low three bits of each coordinate.
    mem8[SEG_SUBTILE_Y1] = y & 0x07;
    mem8[SEG_SUBTILE1] = x & 0x07;

    // Second point's y, and the segment height — the ABSOLUTE difference of the two y values.
    // The step callee converts the second point itself: it reads that y from H (kept in the
    // register, since its frozen converter takes H and nothing hands it over as a param), takes the
    // first x and the record cursor as arguments, and walks DE on to the next record — which comes
    // back through the register, as the step has no return path for it.
    de = u16(de + 1);
    const y2 = mem8[de];
    regs.h = y2;

    loc_0dd3(m, Math.abs(y2 - y) & 0xff, x, de);
    de = regs.de;
  }
}
