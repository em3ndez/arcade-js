// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillDescendingColumn — write a 3-cell descending run into memory at a caller stride.
 *
 * A tiny fixed-count fill primitive. Starting at a caller-supplied pointer, it stores a
 * caller-supplied byte, then steps the pointer by a caller-supplied stride and decrements the
 * value, exactly THREE times — laying v, v-1, v-2 into the cells at p, p+stride, p+2·stride.
 * The trip count is fixed at three, so there is no data-dependent branch and no "loop 0/1/many"
 * case.
 *
 *   - The stored value DESCENDS by one per cell, wrapping at 8 bits.
 *   - The pointer advances by the caller's stride, wrapping at 16 bits.
 *   - Pointer, value, stride and target are all caller-supplied; the routine names no fixed
 *     address of its own.
 *
 * Every caller hands it a colour-RAM column: a one-tilemap-row stride, a start inside the
 * character/colour window, and a descending colour byte — so in practice it paints a 3-tile
 * vertical colour gradient, during the attract colour cycle and during board init. The routine
 * itself is generic: it is the 3-cell descending fill.
 *
 * A LEAF: it reads only its three inputs, writes three memory cells, and calls nothing.
 *
 * LIVE-OUT: memory (the three cells) plus the three registers the walk leaves behind — the
 * value 3 lower, the pointer advanced by three strides, and a zeroed loop counter. All three
 * are dead at every call site (each caller reloads them), but they are reproduced faithfully
 * rather than dropped. The stride is read-only and preserved; the flags are dead.
 */
export function fillDescendingColumn(m) {
  const { regs, mem } = m;

  let addr = regs.hl & 0xffff; // the first cell; advances by the stride each pass, 16-bit
  let val = regs.a & 0xff;     // the value; descends by one each pass, 8-bit
  const stride = regs.de & 0xffff; // the caller stride (one tilemap row in every real call)

  // The trip count is fixed, so the loop is invariant: always three cells.
  for (let pass = 0; pass < 3; pass++) {
    mem.write8(addr, val);            // lay the value
    addr = (addr + stride) & 0xffff;  // step the pointer
    val = (val - 1) & 0xff;           // descend, wrapping at 8 bits
  }

  // The registers the walk leaves behind: value − 3, pointer + 3 strides, counter spent.
  regs.a = val;
  regs.hl = addr;
  regs.b = 0;
}
