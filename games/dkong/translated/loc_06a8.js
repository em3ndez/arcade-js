// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_06a8  (ROM 0x06A8–0x06B7) — after-subtract DAA arm; joins the shared digit-render tail at loc_066a.
 *
 *   06a8  d6 01        sub  0x01      ; sets N=1, and H/C
 *   06aa  20 05        jr   nz,0x06b1
 *   06ac  21 b8 63     ld   hl,0x63b8
 *   06af  36 01        ld   (hl),0x01
 *   06b1  27           daa            ; loc_06b1
 *   06b2  32 8c 63     ld   (0x638c),a
 *   06b5  c3 6a 06     jp   0x066a
 *
 * THE `daa` RUNS WITH N=1, AND ITS INPUTS ARE SET NINE BYTES EARLIER ACROSS A
 * CONDITIONAL BRANCH. `daa` reads H, N and C, all three set by `sub 0x01` at
 * 0x06A8; on the fallthrough path `ld hl,nn` and `ld (hl),n` sit between them
 * and NEITHER WRITES FLAGS, so both paths deliver the `sub`'s H/N/C intact.
 *
 * This is the after-subtract DAA, which had NO EXECUTED PRECEDENT -- every daa
 * this project had run followed an `add` or `adc` (N=0). cpu.js implemented the
 * N=1 branch and had never taken it. Pinned exhaustively against MAME 0.288's
 * daa BEFORE this landed: 2048 cases, 1024 of them N=1, zero mismatches,
 * mutation-tested three ways. A `sub` implemented without H produces a wrong
 * A here, and the error is a VALUE, not a crash.
 *
 * `jp 0x066a` at 0x06B5 is BACKWARD BUT NOT A LOOP -- 0x066A cannot reach
 * 0x06B5, so this is a join into the shared digit-rendering tail, not a cycle.
 */
export function loc_06a8(m) {
  const { regs, mem } = m;

  regs.sub(0x01); // sets N=1, H and C -- all read by the daa at 0x06B1
  m.step(0x06aa, 7); // sub 0x01
  if (regs.fNZ) {
    m.step(0x06b1, 12); // jr nz,0x06b1 taken
  } else {
    m.step(0x06ac, 7); // jr nz not taken
    regs.hl = 0x63b8;
    m.step(0x06af, 10); // ld hl,0x63b8   -- writes no flags
    mem.write8(regs.hl, 0x01);
    m.step(0x06b1, 10); // ld (hl),0x01   -- writes no flags
  }

  regs.daa(); // N=1 path -- see the note above
  m.step(0x06b2, 4); // daa
  mem.write8(0x638c, regs.a);
  m.step(0x06b5, 13); // ld (0x638c),a

  m.step(0x066a, 10); // jp 0x066a -- backward, and NOT a loop
  return m.call(0x066a);
}
