// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillDescendingColumn — write a 3-cell descending run into memory at a caller stride.  ROM 0x0514.
 *
 * A tiny fixed-count fill primitive. Starting at the pointer HL, it stores the
 * byte in A, then steps the pointer by the stride in DE and decrements the value,
 * exactly THREE times — laying A, A-1, A-2 into the cells HL, HL+DE, HL+2·DE. The
 * trip count is hard-loaded (B := 3 at entry), so there is no data-dependent branch:
 * it is always three passes, no "loop 0/1/many" case.
 *
 *   - The stored value DESCENDS by one per cell (8-bit, so 0x00 wraps to 0xFF).
 *   - The pointer advances by the caller's DE stride (16-bit, wraps at 0xFFFF).
 *   - HL, A, DE, and the target address are all caller-supplied; the routine names
 *     no fixed address of its own.
 *
 * Every observed caller hands it a colour-RAM column: DE = 0x0020 (one tilemap row),
 * a start in the 0x74xx–0x77xx character/colour window, and a descending colour byte
 * — so in practice it paints a 3-tile vertical colour gradient during the attract /
 * intro colour cycle (loc_04a3, loc_04be, loc_04f1) and board init (spawnInterludeHeart,
 * loc_17b6). But the routine itself is generic: it is the 3-cell descending fill.
 *
 * A LEAF: it reads only HL/A/DE, writes three memory cells, and calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0514.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (the live board-1 shape
 *           HL=0x75C4 A=0x10 DE=0x20 via loc_04a3), plus crafted entries for the caller
 *           shapes attract does not reach (loc_04be A=0xDF@0x7623, loc_04f1 A=0xEF@0x7583,
 *           loc_17b6/spawnInterludeHeart A=0x10@0x7623), the A 8-bit dec-underflow edge (A=0x01 →
 *           0x01/0x00/0xFF), and a non-0x20 stride to pin that DE is honored. Not
 *           exhaustive (the input is target-memory × HL × A × DE). Teeth: an ascending
 *           twin (value goes UP not down) and a fixed-stride twin (ignores DE).
 * LIVE-OUT: memory (the three cells) + regs A / HL / B — A = the start value minus 3
 *           (8-bit), HL = the start advanced by 3·DE (16-bit), B = 0. All three are DEAD
 *           at every traced return site — every caller reloads HL/A (and never re-reads B)
 *           before its next use (loc_04a3 `ld a,(0x6905)`; loc_04be/loc_04f1/loc_17b6/
 *           spawnInterludeHeart `ld hl,…`) — but they are reproduced faithfully rather than dropped,
 *           matching the clearStridedBytes (0x30e4) sibling. DE is preserved (read-only).
 *           FLAGS are dropped as dead: the oracle's final `dec a` S/Z/H/PV/N and `add hl,de`
 *           C reach no traced conditional; each caller overwrites F before its next branch.
 * NAMES:    none from names.js — HL/A/DE are caller-supplied; the routine references no fixed
 *           game RAM address. The targets fall in the colour-RAM window (noted for context).
 *           0x0514 stays hex, in this header only.
 */
export function fillDescendingColumn(m) {
  const { regs, mem } = m;

  let addr = regs.hl & 0xffff; // HL — the first cell; advances by DE each pass, 16-bit
  let val = regs.a & 0xff;     // A  — the value; descends by one each pass, 8-bit
  const stride = regs.de & 0xffff; // DE — the caller stride (0x0020 in every real call)

  // B is hard-loaded to 3, so the loop count is invariant: always three cells.
  for (let pass = 0; pass < 3; pass++) {
    mem.write8(addr, val);            // ld (hl),a
    addr = (addr + stride) & 0xffff;  // add hl,de
    val = (val - 1) & 0xff;           // dec a (8-bit: 0x00 -> 0xFF)
  }

  // Live-out registers, matching the oracle: A = start-3, HL = start + 3·DE, B = 0.
  regs.a = val;
  regs.hl = addr;
  regs.b = 0;
}
