// SPDX-License-Identifier: GPL-3.0-only
/**
 * tileAddrForPixel — map a screen pixel (y, x) to its tilemap cell address.
 *
 * The playfield is a 32-column tile grid backed by 1 KB of video RAM. This routine takes a pixel
 * coordinate and returns the video-RAM byte address of the tile that CONTAINS it, so every
 * tile-probe and tile-write helper can address "the cell under this pixel" without repeating the
 * arithmetic. It is
 *
 *     col     = (x >> 3) & 0x1f          // x / 8, the tile column (0..31)
 *     row     = (255 - y) >> 3           // (255 - y) / 8  <- note the complement
 *     address = VRAM_BASE + row * 32 + col
 *
 * THE COMPLEMENT IS THE INTERESTING PART: y is complemented before the divide, so the game's OWN
 * address arithmetic is VERTICALLY MIRRORED. The 180-degree rotation the video path renders is not
 * something imposed on top of a conventionally-addressed tilemap — the game computes flipped
 * addresses itself, and the renderer's flip reproduces a transform the game already assumes.
 *
 * The divide-by-8 on x is a rotate rather than a shift: the low three bits of x wrap into the top of
 * the byte and are masked off, which is why the mask is five column bits and not six. row * 32 is
 * built by a 16-bit shift of row * 8 plus the page byte; since row is 31 at most, row * 32 stays
 * under 0x400 and the result never leaves the tilemap page — so the final 16-bit add never wraps,
 * and the mask below is faithful to the add's width rather than a live case.
 *
 * A PURE LEAF: reads only its two inputs, writes no memory, calls nothing. Both inputs are unsigned
 * bytes and the result is a tilemap cell address.
 *
 * LIVE-OUT: the returned address — the cell the caller then reads from or stores into.
 */
export function tileAddrForPixel(y, x) {
  // col = x / 8 (0..31). The hardware does this as a rotate-based divide-by-8 whose wrapped
  // low bits are then masked off — hence a mask of five column bits, not six.
  const col = (x >> 3) & 0x1f;

  // row = (255 - y) / 8. Complementing y first is what mirrors the address vertically.
  const row = ((~y) & 0xff) >> 3;

  // VRAM base + row*32 + col. row is 31 at most, which keeps the result inside the tilemap
  // page, so the 16-bit add never wraps; the mask is faithful to its width.
  return (0x7400 + row * 32 + col) & 0xffff;
}

/**
 * The SEAM ENTRY — the export the override resolver wires. The seam calls an override with the
 * machine as its one argument; the pure function above keeps its `(y, x)` shape for its direct
 * callers and for its exhaustive test.
 *
 * THE REGISTER CONTRACT. In: y and x arrive as the two halves of one register pair, both in
 * PIXELS. Out: the tilemap cell address, in that same pair — which every caller then reads from or
 * stores into. Also left behind: a second pair holding the ROW'S BASE address, the page byte the
 * final add produced, and the flags of that add. Memory: nothing, a pure leaf.
 *
 * REGISTER-EXACT, FLAGS INCLUDED, AND DELIBERATELY SO. Most call sites bracket the call in a
 * push/pop that overwrites the row-base pair, which would make it dead there — but not all of them
 * do. One calls with no bracket at all, and its own copy of that pair flows on to ITS caller. So
 * the wrapper reproduces the pair rather than resting on an argument about who reads what. It
 * costs three lines, because everything after the column/row split is recoverable from the pure
 * function itself: the row's base is the same function at column zero, and replaying the last two
 * operations reproduces the residual registers and the flags exactly, instead of hand-assembling a
 * flag byte.
 */
export function tileAddrForPixelFromRegisters(m) {
  const { regs } = m;
  const y = regs.h; // read both coordinates BEFORE the register pair is rebuilt below
  const x = regs.l;

  // The row's base — the pure function at column zero. The hardware builds it across two
  // shift pairs and then adds the page byte.
  const rowBase = tileAddrForPixel(y, 0);

  regs.hl = (x >> 3) & 0x1f; // the column, with the high half cleared
  regs.e = rowBase & 0xff; // the low byte of row*32
  regs.a = (rowBase >> 8) - 0x74; // ...and its high byte, before the page add
  regs.add(0x74); // the page add, which also sets the flags
  regs.d = regs.a; // the pair now holds the row base
  regs.addHl(regs.de); // and this leaves the tilemap cell address
}
