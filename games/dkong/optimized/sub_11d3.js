// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_11d3 — hand-optimized rewrite of the translated routine at ROM 0x11D3,
 * proven equal to its oracle by the equivalence harness. A generic permuting gather; it
 * names no work RAM (operands are the caller's HL/IX/DE/B).
 */

/**
 * sub_11d3 -- permuting gather from an IX record into four consecutive bytes. [ROM 0x11D3-0x11EB]
 *
 * Five call sites (0x1046, 0x10DB, 0x117A, 0x119E, 0x11CF), all in the per-board setups.
 * Inputs, all caller-supplied: B = pass count, HL = destination, IX = source record base,
 * DE = the IX stride. Each pass gathers four source fields at IX+3, IX+7, IX+8, IX+5 -- IN
 * THAT ORDER (+5 read after +7/+8; +4 and +6 never read) -- into four consecutive
 * destination bytes (HL, `inc l` so H's page is fixed), then advances IX by DE and repeats.
 * A block copy over +3..+6 would look reasonable and be wrong.
 *
 * The djnz targets the routine ENTRY: the first instruction is also the first of the loop,
 * so there is no setup to hoist. `add ix,de` (NOT a 16-bit inc) writes H/N/C; that carry
 * escapes through the `ret`.
 *
 * CYCLES -- COLLAPSED: one m.step per loop iteration (the four-field gather + the
 * `add ix,de` + djnz folded into a single charge, exit PC depending on whether the
 * djnz continues). ATOMIC: sub_11d3's five call sites (0x1046, 0x10DB, 0x117A,
 * 0x119E, 0x11CF) are ALL inside the board-setup family (loc_101f, loc_1087,
 * loc_1131, sub_1186, sub_11a6), reached only via sub_0f56/loc_0d5f, dispatched by
 * dispatchGameState INSIDE the vblank NMI with the mask cleared -- the Z80's own NMI
 * auto-mask (no RETN yet executed in that call chain) means nothing can land
 * mid-routine. Each iteration's total is the exact sum of the oracle's per-instruction
 * charges it replaces: 4*(19+7+4) + 15 + djnz(13 continuing / 8 last) = 120+15+13=148t
 * (continuing) or 120+15+8=143t (last). No 0x7Dxx hardware latch is written (the
 * destination is caller-supplied work RAM), so nothing here needs a partial-collapse
 * boundary.
 */
export function sub_11d3(m) {
  const { regs, mem } = m;

  do {
    // loop body -- the djnz at 0x11E9 lands on the routine entry. Offsets +3,+7,+8,+5.
    for (const disp of [0x03, 0x07, 0x08, 0x05]) {
      regs.a = mem.read8((regs.ix + disp) & 0xffff); // ld a,(ix+d)
      mem.write8(regs.hl, regs.a); // ld (hl),a
      regs.l = regs.inc8(regs.l); // `inc l` -- H untouched, wraps in page
    }

    regs.addIx(regs.de); // add ix,de -- writes H, N, C; carry escapes via the ret

    regs.djnz();
    m.step(regs.b !== 0 ? 0x11d3 : 0x11eb, regs.b !== 0 ? 148 : 143);
  } while (regs.b !== 0);

  m.ret(); // 0x11EB
}
