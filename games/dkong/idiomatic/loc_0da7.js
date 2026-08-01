// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0da7 — walk the board-layout segment table and draw each segment.  ROM 0x0da7.
 *
 * The head of the playfield-record walk. DE points at a table of LINE-SEGMENT
 * records (girders and ladders) that make up the static board; each record is at
 * least five bytes and the table ends with a leading 0xAA. Record layout as the
 * code uses it:
 *
 *   +0  kind / terminator   -> stashed at SEG_KIND (0x63b3); 0xAA ends the walk
 *   +1  y  (first point)     -> H/B
 *   +2  x  (first point)     -> L/C
 *   +3  y2 (second point y)  -> H, then A = |y2 - y| (the segment's height/extent)
 *   +4  x2 (second point x)  -> read by loc_0dd3
 *
 * Per record this converts the FIRST point (y, x) to a tile address via sub_2ff0
 * (saving the sub-tile remainders y&7 / x&7 separately, since sub_2ff0 discards
 * the low three bits), computes the segment height A = |y2 - y|, and hands off to
 * loc_0dd3 with H=y2, C=x, A=height, DE=record+3. loc_0dd3 converts the second
 * point and dispatches the girder or ladder drawer; its renderer tails step DE
 * past the record and return here (the ROM's `jp 0x0da7` loop-back is the for-loop),
 * so the walk continues to the next record until the 0xAA terminator.
 *
 * `sub b / jp nc / neg` is an ABSOLUTE DIFFERENCE — the `neg` runs only on the
 * borrow path, so A = |y2 - y| unsigned either way (an extent, not a signed delta).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0da7.test.js.
 * GATE:     crafted-entry — attract's 25m board draw dispatches it (once per board
 *           setup); its record walk covers every segment naturally. Crafted synthetic
 *           tables pin both abs-diff arms (y2>=y non-borrow, y2<y neg) and the
 *           empty-table terminator. Teeth: a dropped-neg abs-diff (caught in RAM at
 *           the height byte) and a widened sub-tile mask (caught at 0x63b4).
 * LIVE-OUT: memory-only — the drawn playfield (VRAM tiles) plus the segment scratch
 *           SEG_ADDR1/SEG_SUBTILE1/SEG_KIND/SEG_SUBTILE_Y1 this routine writes and
 *           SEG_ADDR2/SEG_SUBTILE2/SEG_HEIGHT/SEG_RUN loc_0dd3 writes. No live registers:
 *           every caller reloads A/HL/DE right
 *           after the call (loc_0f35/loc_0b68/loc_0a8a/loc_0cc6 checked). SP/pc are
 *           the dropped stack model (the oracle's push/call/ret becomes the JS call
 *           stack); sub_2ff0's `ret` drifts SP but writes no game-visible RAM.
 * NAMES:    SEG_ADDR1 (0x63ab), SEG_SUBTILE1 (0x63af), SEG_KIND (0x63b3),
 *           SEG_SUBTILE_Y1 (0x63b4) from ram.js — the board-render segment scratch.
 *           Neutral loc_ name kept to match the record-drawing family (loc_0dd3 /
 *           loc_0e19 / loc_0e4f / loc_0e2a), per loc_0dd3's confirmer note that this
 *           family's game-level semantics are documented but not at the name bar.
 */

import { sub_2ff0 } from "../translated/sub_2ff0.js"; // ROM 0x2FF0 — (H=y, L=x) -> HL = tile address; no idiomatic yet
import { loc_0dd3 } from "./loc_0dd3.js"; // ROM 0x0DD3 — convert the 2nd endpoint + draw the segment
import { SEG_ADDR1, SEG_SUBTILE1, SEG_KIND, SEG_SUBTILE_Y1 } from "./ram.js"; // board-render segment scratch

export function loc_0da7(m) {
  const { regs, mem } = m;

  // The frozen-oracle leaf sub_2ff0 ends in `ret`, which pops the JS-modeled Z80
  // stack (SP += 2) with no matching push on this direct-call path — and loc_0dd3
  // does the same internally. Over the walk's records that would drift SP clean out
  // of mapped RAM. The oracle keeps SP net-0 across each record (its push/pop
  // balance), so we pin SP to that per-record invariant at the top of every
  // iteration: the exact SP the oracle also holds at each record boundary. SP is
  // vestigial here (we make direct calls, not stack transfers), carries no
  // game-visible state, and is not a live-out — this is a stack seam, not logic.
  const spBase = regs.sp;

  for (;;) {
    regs.sp = spBase;

    // record[+0] = kind -> SEG_KIND scratch; 0xAA terminates the walk.
    const kind = mem.read8(regs.de);
    mem.write8(SEG_KIND, kind);
    if (kind === 0xaa) return; // cp 0xaa / ret z

    // First point: record[+1] = y, record[+2] = x. Held in H/B and L/C for the
    // conversion; C (= first x) is also read by loc_0dd3.
    regs.de = (regs.de + 1) & 0xffff;
    const y = mem.read8(regs.de);
    regs.h = y;
    regs.b = y;
    regs.de = (regs.de + 1) & 0xffff;
    const x = mem.read8(regs.de);
    regs.l = x;
    regs.c = x;

    // Convert (y, x) -> the first point's tile address in HL, preserving DE across
    // sub_2ff0 (which clobbers D/E) exactly as the ROM's push de / call / pop de did.
    const savedDe = regs.de; // = record+2
    sub_2ff0(m); // ROM 0x2FF0
    regs.de = savedDe;
    mem.write16(SEG_ADDR1, regs.hl);

    // Sub-tile remainders kept beside the tile address — sub_2ff0 divided each
    // coordinate by 8 and dropped the low three bits, so save them here.
    mem.write8(SEG_SUBTILE_Y1, y & 0x07); // from B
    mem.write8(SEG_SUBTILE1, x & 0x07); // from C

    // Second point's y: record[+3]. A := |y2 - y| — the segment's height/extent
    // (the ROM's `sub b / jp nc / neg`; the neg runs only on the borrow path, so the
    // result is unsigned either way). H := y2, DE := record+3, C := x, A := height
    // are the register image loc_0dd3 consumes next.
    regs.de = (regs.de + 1) & 0xffff;
    const y2 = mem.read8(regs.de);
    regs.h = y2;
    regs.a = Math.abs(y2 - y) & 0xff;

    // Draw this segment (girder span + endpoint caps, or ladder). Its renderer tail
    // steps DE to the next record and returns, so the loop continues.
    loc_0dd3(m); // ROM 0x0DD3
  }
}
