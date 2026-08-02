// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd3 — convert a segment record's second endpoint, compute its run deltas,
 * and draw the segment (girder span + end caps, or ladder).  ROM 0x0dd3.
 *
 * The tail of sub_0da7's playfield-record walk. Each record is a LINE SEGMENT
 * between two points; sub_0da7 has already converted the first point (+1,+2 =
 * y,x) to a tile address at SEG_ADDR1 (0x63ab) and stashed its sub-tile x at
 * SEG_SUBTILE1 (0x63af), and it enters here with A = |y2 - y| (the segment's
 * height/length), H = y2, C = the first point's x, and DE pointing at record+3.
 * This routine:
 *
 *   1. Stores the height counter A at SEG_HEIGHT (0x63b1).
 *   2. Reads the second x (record+4) into L, computes x2 - x -> SEG_RUN (0x63b2,
 *      the horizontal run) and x2 & 7 -> SEG_SUBTILE2 (0x63b0, the second point's
 *      sub-tile x).
 *   3. Converts (y2, x2) to a tile address via loc_2ff0 -> SEG_ADDR2 (0x63ad). DE
 *      is saved across that call (loc_2ff0 clobbers D/E) as the ROM's push/pop did.
 *   4. Dispatches on the record kind at SEG_KIND (0x63b3):
 *        - kind >= 2 (the `jp p` sign test on kind-2): hand off to the LADDER
 *          drawer loc_0e4f (kind 2) / strip drawer loc_0ee8 (kind 3+, via loc_0e4f).
 *        - otherwise (kind 0/1): finish the GIRDER setup -- fold the second point's
 *          sub-tile x into the run (SEG_RUN = (x2-x-0x10) + SEG_SUBTILE1), stamp the
 *          segment's two endpoint-cap tiles at SEG_ADDR1 (codes SEG_SUBTILE1+0xf0 then
 *          that -0x30 in the next cell), zero the run for kind 1, then draw the span
 *          with loc_0e19.
 *
 * `jp p` at 0x0df0 tests bit 7 of (kind - 2), NOT `kind >= 2` unsigned -- the two
 * coincide only because real kinds are small (see the oracle's note); this
 * reproduces the sign test faithfully.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0dd3.test.js.
 * GATE:     crafted-entry — real captured attract dispatches exercise all three
 *           arms naturally (kind 0 girder, kind 1 girder+zero, kind 2 ladder);
 *           crafted entries pin each kind + the kind-3 strip-drawer arm attract's
 *           25m never produces. Teeth: drop-the-DE-restore (RAM-blind, caught on
 *           DE), a wrong endpoint-cap tile (caught in RAM), and an inverted
 *           dispatch that swaps the renderer (caught in RAM).
 * LIVE-OUT: memory (segment scratch SEG_SUBTILE2..SEG_KIND 0x63b0-0x63b3 + SEG_ADDR2
 *           0x63ad, and the girder/ladder
 *           tiles the renderers stamp) + DE. DE is the record-walk pointer
 *           (= record+4); it is written to NO memory here, so the RAM gate is blind
 *           to it, but the renderer tails' `inc de` and sub_0da7's loop consume it,
 *           so the test asserts it directly. A/HL/BC are reloaded by the renderers
 *           or dead in the successor; SP/pc are the dropped stack model (the oracle's
 *           push/call/ret becomes the JS call stack).
 * NAMES:    the segment scratch is the SEG_* cluster in ram.js (SEG_ADDR1/SEG_ADDR2/
 *           SEG_SUBTILE1/SEG_SUBTILE2/SEG_HEIGHT/SEG_RUN/SEG_KIND) — imported and used
 *           below. Kept loc_ pending its own confirmer (proposer!=confirmer): the sibling
 *           record routines it once matched as "neutral" are already named — the walk head
 *           drawBoardLayout (0x0da7) and the leaf drawers drawGirderSpan (0x0e19) /
 *           drawLadder (0x0e4f) / drawSegmentEndCap (0x0e2a) — so loc_0dd3 is now the last
 *           neutral member of the family and a reasonable future promotion (its game-level
 *           "kind" semantics are documented).
 */

// ROM 0x2FF0 — (y,x) -> tile address. The FROZEN ORACLE deliberately: an idiomatic twin exists
// (tileAddrForPixel.js, machine-shaped entry tileAddrForPixelFromRegisters) and 0x2FF0 is in
// ram.js's ROUTINES, so "no idiomatic yet" is FALSE. Unlike the two segment drawers below, this
// one is NOT stack-neutral: 0x2FF0 is a pure leaf ending in `ret`, consuming a guest-stack word
// the twin's JS return does not. Left because no gate here can prove the swap safe — the 2-byte
// delta was injected at this call site and neither this routine's equivalence gate (RAM + DE
// only) nor the full-flip gate caught it. If you dissolve it later, import the FromRegisters
// wrapper: the bare tileAddrForPixel is a pure (y, x) function and passing it the Machine
// corrupts SEG_ADDR2 silently.
import { loc_2ff0 } from "../translated/loc_2ff0.js";
import { drawLadder } from "./drawLadder.js"; //         ROM 0x0E4F — ladder (kind 2) / strip (kind 3+) drawer
import { drawGirderSpan } from "./drawGirderSpan.js"; // ROM 0x0E19 — girder-span fill + end cap

// Board-render line-segment scratch, all named in ram.js (SEG_* cluster):
//   SEG_HEIGHT   0x63b1  |y2 - y| — the segment's height/length counter
//   SEG_RUN      0x63b2  x2 - x — the horizontal run (down-counted 8px/tile by loc_0e19)
//   SEG_SUBTILE2 0x63b0  x2 & 7 — the second point's sub-tile x
//   SEG_ADDR2    0x63ad  tile address of the second point (y2, x2)
//   SEG_SUBTILE1 0x63af  x & 7 — the first point's sub-tile x (set by sub_0da7)
//   SEG_ADDR1    0x63ab  tile address of the first point (set by sub_0da7)
//   SEG_KIND     0x63b3  record kind / dispatch selector (set by sub_0da7)
import {
  SEG_HEIGHT,
  SEG_RUN,
  SEG_SUBTILE2,
  SEG_ADDR2,
  SEG_SUBTILE1,
  SEG_ADDR1,
  SEG_KIND,
} from "./ram.js";

export function loc_0dd3(m) {
  const { regs, mem } = m;

  // A arrives as |y2 - y| (sub_0da7's absolute Y-difference): the height counter.
  mem.write8(SEG_HEIGHT, regs.a);

  // Step DE from record+3 to record+4 and read the second point's x. L := x2
  // (loc_2ff0 reads L as the x coordinate); SEG_RUN := x2 - x (first point x in C).
  regs.de = (regs.de + 1) & 0xffff;
  const x2 = mem.read8(regs.de);
  regs.l = x2;
  mem.write8(SEG_RUN, (x2 - regs.c) & 0xff);
  mem.write8(SEG_SUBTILE2, x2 & 0x07);

  // Convert (H = y2, L = x2) -> tile address in HL. loc_2ff0 clobbers D/E, so save
  // and restore DE around it exactly as the ROM's `push de / call / pop de` did:
  // DE (= record+4) is live into the renderer tails, which step it to the next record.
  const savedDe = regs.de;
  loc_2ff0(m);
  regs.de = savedDe;
  mem.write16(SEG_ADDR2, regs.hl);

  // Dispatch on the record kind. `jp p` = bit 7 of (kind - 2) clear — a SIGN test,
  // not unsigned `>= 2` (they only agree because real kinds are small). Kind >= 2
  // takes the ladder / strip drawer, which reloads HL and reads DE itself.
  const kind = mem.read8(SEG_KIND);
  if ((((kind - 0x02) & 0xff) & 0x80) === 0) {
    drawLadder(m); // ROM 0x0E4F
    return;
  }

  // -- Girder arm (kind 0/1) --

  // Fold the second point's sub-tile x into the run before the span fill.
  const step = (mem.read8(SEG_RUN) - 0x10) & 0xff;
  mem.write8(SEG_RUN, (mem.read8(SEG_SUBTILE1) + step) & 0xff);

  // Stamp the segment's two endpoint-cap tiles at the first point's address: code
  // (SEG_SUBTILE1 + 0xf0) in the base cell, then that - 0x30 in the next cell. `inc l`
  // wraps within the page (NOT inc hl). HL is left at base+1 for loc_0e19.
  const cap1 = (mem.read8(SEG_SUBTILE1) + 0xf0) & 0xff;
  regs.hl = mem.read16(SEG_ADDR1);
  mem.write8(regs.hl, cap1);
  regs.l = (regs.l + 1) & 0xff;
  mem.write8(regs.hl, (cap1 - 0x30) & 0xff);

  // Kind 1 zeroes the run so loc_0e19 lays no span (a single-cell girder). A is
  // dead here — loc_0e19 reloads it from SEG_RUN — so only the memory write survives.
  if (mem.read8(SEG_KIND) === 0x01) {
    mem.write8(SEG_RUN, 0x00);
  }

  drawGirderSpan(m); // ROM 0x0E19 — walk the run stamping girder tile 0xC0, then the end cap
}
