// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawBoardLayout — walk the board-layout segment table and draw each segment (the girders and
 * ladders the board is made of). Each record is at least five bytes; the table ends with a
 * terminator (0xaa) in the kind field.
 *
 * LIVE-OUT: memory-only.
 */

// The seam entry marshals the register file to the pure (y, x) leaf — not a bare (y, x) call.
import { u16 } from "../../../core/int.js";
import { tileAddrForPixel, tileAddrForPixelFromRegisters } from "./tileAddrForPixel.js";
import { loc_0dd3 } from "./loc_0dd3.js";
import { SEG_ADDR1, SEG_SUBTILE1, SEG_KIND, SEG_SUBTILE_Y1 } from "./names.js";

export function drawBoardLayout(m, sp = m.regs.sp, de = m.regs.de) {
  const { regs, mem8, mem16 } = m;

  for (;;) {
    const kind = mem8[de];
    mem8[SEG_KIND] = kind;
    if (kind === 0xaa) return;

    // First point: y then x. Hand them to the converter as arguments; the local pointer keeps
    // walking the table independently.
    de = u16(de + 1);
    const y = mem8[de];
    de = u16(de + 1);
    const x = mem8[de];

    // First point -> tile address. The converter clobbers the register file but not our local
    // pointer; SEG_ADDR1 takes the pure leaf's value (== the HL the converter leaves).
    tileAddrForPixelFromRegisters(m, y, x);
    mem16[SEG_ADDR1] = tileAddrForPixel(y, x);

    // Sub-tile remainders: the conversion dropped the low three bits of each coordinate.
    mem8[SEG_SUBTILE_Y1] = y & 0x07;
    mem8[SEG_SUBTILE1] = x & 0x07;

    // Second point's y, and the segment height — the ABSOLUTE difference of the two y values. The
    // step callee converts the second point, takes the first x and record cursor as arguments, and
    // walks DE on to the next record — which comes back through the register (no return path for it).
    de = u16(de + 1);
    const y2 = mem8[de];

    loc_0dd3(m, Math.abs(y2 - y) & 0xff, x, de, y2);
    de = regs.de;
  }
}
