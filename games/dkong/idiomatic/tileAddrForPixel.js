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
 * LIVE-OUT: memory-only for the pure function — the returned address, the tilemap cell
 *           the caller then dereferences (`ld a,(hl)`) or stores. The wired address takes
 *           H/L and returns HL, and its seam entry below is register-exact (A/D/E/F too):
 *           five of the six call sites overwrite DE with their own `pop de`, but loc_298c
 *           does not, so DE is reproduced rather than argued away.
 * NAMES:    none — pure arithmetic on register inputs; references no RAM address.
 *           0x7400 is the hardware tilemap VRAM base, not a names.js name.
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

/**
 * The SEAM ENTRY for ROM 0x2FF0 — `ROUTINES[0x2ff0].entry`, the export the override
 * resolvers wire. The seam dispatches an override as `fn(m)`, one argument; the pure
 * function above keeps its `(y, x)` shape for its direct idiomatic callers and its
 * exhaustive gate.
 *
 * ABI, read off the frozen oracle (translated/loc_2ff0.js, ROM 0x2FF0-0x3008):
 *
 *     2ff0  7d 0f 0f 0f e6 1f 6f   ld a,l / rrca x3 / and 0x1f / ld l,a   ; L = col
 *     2ff7  7c 2f e6 f8 5f         ld a,h / cpl / and 0xf8 / ld e,a       ; E = row*8
 *     2ffc  af 67                  xor a / ld h,a                        ; HL = col
 *     2ffe  cb 13 17 cb 13 17      rl e / rla / rl e / rla                ; A:E = row*32
 *     3004  c6 74 57               add a,0x74 / ld d,a                   ; DE = row base
 *     3007  19 c9                  add hl,de / ret                       ; HL = the cell
 *
 *   IN:   H = y, L = x, both in PIXELS.
 *   OUT:  HL = the tilemap cell address (0x7400-0x77FF), which every caller then
 *         dereferences with `ld a,(hl)` or stores.
 *   ALSO: DE = 0x7400 + row*32 (the row's base) and A = D (the page byte `add a,0x74`
 *         produced), plus F from the closing `add hl,de` over the `add a,0x74` result.
 *   MEM:  nothing — a pure leaf.
 *
 * REGISTER-EXACT, flags included, and deliberately so. FIVE of the six oracle call sites
 * overwrite DE immediately after the call — `push de` / `pop de` at 0x0DB7 (loc_0da7) and
 * 0x0DE4 (loc_0dd3), `push hl` / `pop de` at 0x2A3A (loc_2a2f), 0x2AA2 (startMarioFallWhenGroundGivesWay) and
 * 0x2B9C (loc_2b9b) — which would make D/E dead there. THE SIXTH DOES NOT: loc_298c calls
 * it at 0x299A with no push/pop bracket at all, and its own DE then flows on to its caller.
 * So the wrapper reproduces DE rather than resting on an argument about who reads what.
 * It costs three lines, because everything after the col/row split is recoverable from the
 * pure function itself: the row base is `tileAddrForPixel(y, 0)`, and replaying the
 * oracle's own last two instructions (`add a,0x74`, `add hl,de`) reproduces A, D, E and F
 * exactly instead of hand-assembling a flag byte.
 */
export function tileAddrForPixelFromRegisters(m) {
  const { regs } = m;
  const y = regs.h; // read both coordinates BEFORE HL is rebuilt below
  const x = regs.l;

  // The row's base, 0x7400 + row*32 — the pure function at column zero. The oracle builds
  // it in A:E across the two `rl e / rla` pairs, then adds the 0x74 page byte.
  const rowBase = tileAddrForPixel(y, 0);

  regs.hl = (x >> 3) & 0x1f; // 0x2FF0-0x2FF6 + `xor a / ld h,a`: HL = the column, H = 0
  regs.e = rowBase & 0xff; // 0x2FFB..0x3003: E = the low byte of row*32
  regs.a = (rowBase >> 8) - 0x74; // ...and A its high byte, before the page add
  regs.add(0x74); // 0x3004 `add a,0x74`
  regs.d = regs.a; // 0x3006 `ld d,a` — DE is now the row base
  regs.addHl(regs.de); // 0x3007 `add hl,de` — HL = the tilemap cell address
}
