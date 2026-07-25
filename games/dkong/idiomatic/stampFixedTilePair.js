// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampFixedTilePair — paint a fixed two-tile decoration into the tilemap.  ROM 0x3F24.
 *
 * A constant, input-free repaint: it writes tile code 0x9F to video-RAM cell
 * 0x74AF and tile code 0x9E to 0x748F, unconditionally. The two cells sit 0x20
 * apart (0x748F = 0x74AF - 0x20) and, per the oracle, the lower-address one is
 * one screen-cell BELOW the other, so the pair is a two-tall glyph stamped at a
 * fixed screen spot. The oracle reaches the second cell by loading DE = 0xFFE0
 * and doing a 16-bit `add hl,de` — an unsigned wrap that subtracts 0x20
 * (0x74AF + 0xFFE0 = 0x1748F -> 0x748F). Only the resulting address matters, so
 * that whole dance is just "write the cell 0x20 below".
 *
 * NO INPUTS. Reads no register and no memory; its behaviour is fixed by its own
 * twelve bytes. Called by loc_07cb's countdown-animation repaint (alongside
 * sub_004e). A LEAF: calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3f24.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (loc_07cb's countdown
 *           repaint fires it from ~frame 1200; 64 captured by frame 4500) + input-
 *           independence crafts (junk-filled target cells, arbitrary registers and
 *           surrounding RAM) proving the two writes are unconditional and state-
 *           blind. A constant routine: one behaviour, no branches, no inputs.
 * LIVE-OUT: memory-only — exactly the two tilemap cells 0x74AF (<-0x9F) and
 *           0x748F (<-0x9E). The oracle's exit HL=0x748F / DE=0xFFE0 / carry-set
 *           are dead ABI: the sole caller (loc_07cb, ROM 0x0820) overwrites HL
 *           with `ld hl,0x6908` and reads neither DE nor carry. pc/SP are the
 *           dropped stack model — the oracle's `ret` is the JS return here — and
 *           this routine pushes nothing, so oracle and idiomatic leave RAM byte-
 *           identical with no stack residue at all.
 * NAMES:    none in ram.js — 0x74AF/0x748F are raw video-RAM tilemap cells (the
 *           0x7400-0x77FF tilemap), kept as hex literals; 0x9E/0x9F are tile codes.
 */
export function stampFixedTilePair(m) {
  const { mem } = m;
  // Upper cell, then the cell 0x20 below it (0x74AF - 0x20 = 0x748F).
  mem.write8(0x74af, 0x9f);
  mem.write8(0x748f, 0x9e);
}
