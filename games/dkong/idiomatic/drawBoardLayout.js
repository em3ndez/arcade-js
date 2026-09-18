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
import { loc_2ff0 } from "../translated/loc_2ff0.js";
import { loc_0dd3 } from "./loc_0dd3.js";
import { SEG_ADDR1, SEG_SUBTILE1, SEG_KIND, SEG_SUBTILE_Y1 } from "./names.js";

export function drawBoardLayout(m, sp = m.regs.sp) {
  const { regs, mem8, mem16 } = m;

  // The conversion leaf and the per-segment step each pop the guest stack with no matching push
  // on this path; the hardware balances to no net movement per record, so sp is pinned back to
  // this base each iteration. A stack seam, not logic, and not a live-out.
  const spBase = sp;

  for (;;) {
    regs.sp = spBase;

    const kind = mem8[regs.de];
    mem8[SEG_KIND] = kind;
    if (kind === 0xaa) return;

    // First point: y then x, each held in two registers — one pair for the conversion, one the
    // per-segment step reads afterwards.
    regs.de = (regs.de + 1) & 0xffff;
    const y = mem8[regs.de];
    regs.h = y;
    regs.b = y;
    regs.de = (regs.de + 1) & 0xffff;
    const x = mem8[regs.de];
    regs.l = x;
    regs.c = x;

    // Convert the first point to a tile address; the conversion clobbers the table pointer.
    const savedDe = regs.de;
    loc_2ff0(m);
    regs.de = savedDe;
    mem16[SEG_ADDR1] = regs.hl;

    // Sub-tile remainders: the conversion dropped the low three bits of each coordinate.
    mem8[SEG_SUBTILE_Y1] = y & 0x07;
    mem8[SEG_SUBTILE1] = x & 0x07;

    // Second point's y, and the segment height — the ABSOLUTE difference of the two y values.
    regs.de = (regs.de + 1) & 0xffff;
    const y2 = mem8[regs.de];
    regs.h = y2;

    loc_0dd3(m, Math.abs(y2 - y) & 0xff);
  }
}
