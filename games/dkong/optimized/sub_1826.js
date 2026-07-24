// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1826 — hand-optimized rewrite of the translated routine at ROM 0x1826,
 * proven equal to its oracle by the equivalence harness. A generic rectangular tile fill;
 * it names no work RAM (the destination HL is the caller's).
 */

/**
 * sub_1826 -- fill a 5-wide × 14-tall tile block with 0x10.  [ROM 0x1826-0x1837]
 *
 * A screen-region fill (5 callers), destination HL supplied by the caller. It writes tile
 * 0x10 across 5 columns, then steps HL by DE = -0x25 so the next row starts one tilemap row
 * up and back at the left edge (5 written, then -0x25 = net -0x20 per row). Repeats for
 * C = 0x0E rows. The fill value 0x10 is loaded ONCE, before the outer loop.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. No hardware-bus write on any path (the
 * fill lands in the caller's VRAM tilemap region, not the 0x7800-0x780f/0x7c00/0x7c80/
 * 0x7d00-07/0x7d80-87 latches), so nothing forces a partial-collapse boundary. Each block
 * total is the exact SUM of the oracle's per-instruction charges: ld-de+ld-c+ld-a 24 t (entry,
 * before the outer-loop head 0x182d); ld-b,0x05 7 t (its own block -- 0x182f, the inner-loop
 * head, is a separate merge point reached also by djnz); ld-(hl),a+inc-hl+djnz 26 t (taken,
 * loop) / 21 t (not taken, falls through); add-hl,de+dec-c+jp-nz/z 25 t (taken loops back to
 * 0x182d, not taken falls to the ret). Five call paths, not all provably mask-cleared, so
 * total-preservation keeps the cumulative clock identical to the oracle's on every path.
 */
export function sub_1826(m) {
  const { regs, mem } = m;

  // Block: ld de,0xffdb [10] + ld c,0x0e [7] + ld a,0x10 [7] = 24 t
  regs.de = 0xffdb; // -0x25
  regs.c = 0x0e; // 14 rows
  regs.a = 0x10; // fill tile, loaded once
  m.step(0x182d, 24);

  do {
    // outer row loop head -- merge point: entered here AND via the loop-back jp nz below.
    // Block: ld b,0x05 [7] -- lone instr: 0x182f (the inner-loop head) is a separate merge point.
    regs.b = 0x05; // 5 columns
    m.step(0x182f, 7);
    do {
      // Block: ld (hl),a [7] + inc hl [6] + djnz 0x182f [13 taken / 8 not] = 26 / 21 t
      mem.write8(regs.hl, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.djnz();
      m.step(regs.b !== 0 ? 0x182f : 0x1833, regs.b !== 0 ? 26 : 21);
    } while (regs.b !== 0);
    // Block: add hl,de [11] + dec c [4] + jp nz,0x182d / jp z,0x1838 [10] = 25 t
    regs.addHl(regs.de); // HL -= 0x25 -> next row up, left edge
    regs.c = regs.dec8(regs.c);
    m.step(regs.fNZ ? 0x182d : 0x1838, 25);
  } while (regs.fNZ);

  m.ret(); // 0x1838
}
