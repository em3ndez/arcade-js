// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawBoardLayout — walk the board-layout segment table and draw each segment.
 *
 * The head of the playfield walk: it is what the board-setup arms call to draw the whole static
 * board. A pointer register aims at a table of LINE-SEGMENT records — the girders and ladders
 * the board is made of. Each record is at least five bytes, and the table ends with a
 * terminator in the kind field. The record layout, as this code uses it:
 *
 *   +0  kind, or the terminator that ends the walk
 *   +1  y of the segment's first point
 *   +2  x of the segment's first point
 *   +3  y of the segment's second point
 *   +4  x of the segment's second point, read by the per-segment step
 *
 * Per record it converts the FIRST point to a tile address, saving the sub-tile remainders of
 * each coordinate separately because the conversion discards the low three bits, computes the
 * segment's height as the ABSOLUTE difference of the two y values, and hands the second point
 * plus that height to the per-segment step. That step converts the second point and dispatches
 * the girder or ladder drawer; its renderer tails advance the table pointer past the record and
 * come back here, so the walk continues until the terminator.
 *
 * The height is an unsigned EXTENT, not a signed delta: the difference is negated only on the
 * borrow path, so either ordering of the two y values gives the same magnitude.
 *
 * Reads: the segment table. Writes: the drawn playfield tiles, plus the board-render segment
 * scratch — the first point's tile address and sub-tile remainders and the segment kind here,
 * and the second point's equivalents in the per-segment step.
 *
 * LIVE-OUT: memory-only. Every caller reloads its own registers straight after the call.
 */

// The pixel-to-tile-address conversion, kept as the faithful lift rather than the idiomatic
// twin. It is a pure leaf that consumes one guest-stack word the twin's plain return does not,
// so swapping it in is not stack-neutral, and nothing here can prove the swap safe: a two-byte
// stack delta injected at this exact call site was caught by neither this routine's own gate nor
// the whole-game one. NOTE for anyone who does swap it later: use the machine-shaped entry, not
// the bare pure function — that one takes (y, x) and handing it the machine instead silently
// corrupts the segment scratch.
import { loc_2ff0 } from "../translated/loc_2ff0.js";
import { loc_0dd3 } from "./loc_0dd3.js";
import { SEG_ADDR1, SEG_SUBTILE1, SEG_KIND, SEG_SUBTILE_Y1 } from "./names.js";

export function drawBoardLayout(m) {
  const { regs, mem } = m;

  // The point-conversion leaf pops the guest stack on the way out with no matching push on
  // this call path, and the per-segment step does the same internally. Over a whole table of
  // records that would drift the stack pointer clean out of mapped memory. The hardware
  // sequence balances out to no net movement across each record, so the pointer is pinned back
  // to that per-record invariant at the top of every iteration. It is vestigial here — these
  // are direct calls, not stack transfers — carries no game-visible state, and is not a
  // live-out. A stack seam, not logic.
  const spBase = regs.sp;

  for (;;) {
    regs.sp = spBase;

    // The record's kind byte goes to the segment scratch; the terminator ends the walk.
    const kind = mem.read8(regs.de);
    mem.write8(SEG_KIND, kind);
    if (kind === 0xaa) return;

    // First point: its y, then its x. Each is held in two registers — one pair for the
    // conversion below, one that the per-segment step reads afterwards.
    regs.de = (regs.de + 1) & 0xffff;
    const y = mem.read8(regs.de);
    regs.h = y;
    regs.b = y;
    regs.de = (regs.de + 1) & 0xffff;
    const x = mem.read8(regs.de);
    regs.l = x;
    regs.c = x;

    // Convert the first point to a tile address. The conversion clobbers the table pointer,
    // so it is saved across the call and put back.
    const savedDe = regs.de;
    loc_2ff0(m);
    regs.de = savedDe;
    mem.write16(SEG_ADDR1, regs.hl);

    // Sub-tile remainders kept beside the tile address: the conversion divided each coordinate
    // by 8 and dropped the low three bits, so the remainders are saved here.
    mem.write8(SEG_SUBTILE_Y1, y & 0x07);
    mem.write8(SEG_SUBTILE1, x & 0x07);

    // Second point's y, and from it the segment's height — the ABSOLUTE difference of the two
    // y values, negated only on the borrow path so it is unsigned either way. The second point,
    // the first point's x, the height and the table pointer are the register image the
    // per-segment step consumes next.
    regs.de = (regs.de + 1) & 0xffff;
    const y2 = mem.read8(regs.de);
    regs.h = y2;
    regs.a = Math.abs(y2 - y) & 0xff;

    // Draw this segment — a girder span with its endpoint caps, or a ladder. Its renderer tail
    // advances the table pointer to the next record and returns, so the loop continues.
    loc_0dd3(m);
  }
}
