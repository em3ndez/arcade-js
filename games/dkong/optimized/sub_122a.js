// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_122a — hand-optimized rewrite of the translated routine at ROM 0x122A,
 * proven equal to its oracle by the equivalence harness. A generic strided block-fill;
 * it names no work RAM (its operands are the caller's HL/DE/BC).
 */

/**
 * sub_122a -- strided block copy: B passes of 4 bytes, stride C+4.  [ROM 0x122A-0x123B]
 *
 * A sprite/shadow-table filler used across the per-board setups (loc_0fd7, 0x101F, 0x1131,
 * 0x1186). Each outer pass copies 4 source bytes (HL) into the destination (DE, `inc e` so
 * D's page is fixed), then advances E by C (the stride) + the 4 just written, and repeats B
 * times. B is the pass count, C the stride; the inner count is always 4 (never 0).
 *
 * THE REGISTER CONTRACT (three callers depend on it from outside and none can see it):
 *   - HL PRESERVED actively -- `push hl`/`pop hl` bracket the inner loop, discarding its
 *     four `inc hl`.
 *   - C  PRESERVED actively -- restored by `pop bc`. This is load-bearing: three routines
 *     set C via `ld bc,nn`, call here, then reload B ONLY before a `call 0x11d3` that
 *     consumes C -- satisfied solely by this `pop bc`.
 *   - B  CLOBBERED (0 at the ret); DE: D untouched, E advanced by B0*(C+4) mod 256;
 *     A  CLOBBERED (exits == E, never read before written); IX/IY passed through untouched
 *     (no DD/FD prefix). The carry out of the final `add a,c` escapes through the `ret`.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of each
 * straight-line run folded into a single charge at the block's exit PC). sub_122a is called
 * only from the per-board setup coordinators (loc_0fd7/loc_101f/etc.), each a one-shot
 * dispatch-time build, not a per-frame main-loop routine -- the same reasoning that licenses
 * the board-setup family's collapse. Three blocks per outer pass:
 *   A (prologue: push hl; push bc; ld b,4)                              11+11+7  = 29 t
 *   B (inner iteration: ld a,(hl); ld (de),a; inc hl; inc e; djnz)       7+7+6+4  = 24 t body,
 *     + the djnz's own charge: +13 t looping (exit 0x122e) / +8 t falling through (exit 0x1234)
 *   C (outer tail: pop bc; pop hl; ld a,e; add a,c; ld e,a; djnz)   10+10+4+4+4  = 32 t body,
 *     + the djnz's own charge: +13 t looping (exit 0x122a) / +8 t done (exit 0x123b)
 * Every charge in the sum is the oracle's own per-instruction value (see the prior
 * per-instruction cycle comments, preserved in git history) -- only the granularity changed.
 * The push/pop that preserve HL and C stay explicit (m.push16/m.pop16) -- they are the
 * contract -- and every memory read/write keeps its original order within each block.
 */
export function sub_122a(m) {
  const { regs, mem } = m;

  do {
    // Block A -- outer-loop prologue: push hl; push bc; ld b,4.  11+11+7 = 29 t, exit 0x122e.
    m.push16(regs.hl);
    m.push16(regs.bc);
    regs.b = 0x04; // inner count, always 4, never 0
    m.step(0x122e, 29);

    do {
      // Block B -- inner iteration: ld a,(hl); ld (de),a; inc hl; inc e; djnz.
      // Body 7+7+6+4 = 24 t, + the djnz's own charge (13 taken / 8 not).
      regs.a = mem.read8(regs.hl);
      mem.write8(regs.de, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.e = regs.inc8(regs.e); // `inc e`, NOT `inc de` -- D untouched
      regs.djnz();
      m.step(regs.b !== 0 ? 0x122e : 0x1234, regs.b !== 0 ? 37 : 32);
    } while (regs.b !== 0);

    // Block C -- outer tail: pop bc; pop hl; ld a,e; add a,c; ld e,a; djnz.
    // Body 10+10+4+4+4 = 32 t, + the djnz's own charge (13 taken / 8 not).
    regs.bc = m.pop16(); // restores the OUTER counter B *and* the stride C
    regs.hl = m.pop16(); // discards the inner loop's four `inc hl`
    regs.a = regs.e;
    regs.add(regs.c); // A = E + stride; carry escapes via the ret
    regs.e = regs.a;
    regs.djnz();
    m.step(regs.b !== 0 ? 0x122a : 0x123b, regs.b !== 0 ? 45 : 40);
  } while (regs.b !== 0);

  m.ret(); // 0x123B
}
