// SPDX-License-Identifier: GPL-3.0-only
/**
 * tileAddrForPixel — map a screen pixel (y,x) to its tilemap cell address. ROM 0x2FF0.
 *
 * The playfield is a 32-column tile grid backed by 1 KB of video RAM at 0x7400.
 * This routine takes a pixel coordinate and returns the VRAM byte address of the
 * tile that contains it, so every tile-probe and tile-write helper can address
 * "the cell under this pixel" without repeating the arithmetic. It is
 *
 *     col = (x >> 3) & 0x1f          // x / 8, the tile column (0..31)
 *     row = (255 - y) >> 3           // (255 - y) / 8, the tile row  <- note the complement
 *     HL  = 0x7400 + row * 32 + col
 *
 * THE COMPLEMENT IS THE INTERESTING PART: the ROM complements Y (`cpl`) before the
 * divide, so its own address arithmetic is VERTICALLY MIRRORED. The 180-degree
 * rotation the video path renders is not something imposed on top of a
 * conventionally-addressed tilemap — the game computes flipped addresses itself,
 * and renderRowRGB's flip reproduces a transform the ROM already assumes.
 *
 * The divide-by-8 on x is a rotate (`rrca` x3 + `and 0x1f`): the low three bits of x
 * wrap into the top of the byte and are masked off, which is why the mask is 0x1F
 * (five column bits), not 0x3F. row*32 is built by a 16-bit left-shift-by-2 of row*8
 * across A:E, plus the 0x74 page byte; since row <= 31, row*32 <= 0x3E0 and the
 * result stays inside the 0x7400-0x77FF tilemap page — the final `add hl,de` never
 * wraps 16 bits (the `& 0xffff` is faithful to the add's width, not a live case).
 *
 * Shared by every board's tile-probe / VRAM-write path: loc_0dd3, sub_0da7,
 * sub_298c, sub_2a2f, sub_2a85, entry_2b9b. A PURE LEAF: reads only its two inputs
 * (y = H, x = L), writes no memory, calls nothing, returns HL.
 *
 * Inputs are Z80 register bytes (0..255): y = H, x = L; result = HL (0x7400..0x77FF).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ff0.test.js.
 * GATE:     exhaustive — pure total function; output vs oracle over all 65,536
 *           (y,x) combos, plus real captured dispatches (989 in a 1200-frame attract).
 * LIVE-OUT: memory-only — the returned HL, the tilemap address the caller then
 *           dereferences (`ld a,(hl)`) or stores. No live registers/flags: every
 *           caller restores DE with its own `pop de` and reads the tile from (HL),
 *           so the oracle's residual A/D/E are dead ABI (the whole-machine gate
 *           backstops that).
 * NAMES:    none — pure arithmetic on register inputs; references no RAM address.
 *           0x7400 is the hardware tilemap VRAM base, not a ram.js name.
 */
export function tileAddrForPixel(y, x) {
  // col = x / 8 (0..31). The ROM's three `rrca` + `and 0x1f` is a rotate-based
  // divide-by-8 whose wrapped low bits are masked off — mask 0x1F, not 0x3F.
  const col = (x >> 3) & 0x1f;

  // row = (255 - y) / 8. `cpl` complements Y first, mirroring the address vertically.
  const row = ((~y) & 0xff) >> 3;

  // HL = 0x7400 + row*32 + col. row <= 31 keeps HL in the 0x7400-0x77FF page,
  // so the 16-bit `add hl,de` never wraps; the mask is faithful to its width.
  return (0x7400 + row * 32 + col) & 0xffff;
}
