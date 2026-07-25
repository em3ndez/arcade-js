// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0f35  (ROM 0x0F35–0x0F49).
 */
export function loc_0f35(m) {
  const { regs, mem } = m;

  do {
    regs.a = mem.read8(0x63b5); // re-read every iteration
    m.step(0x0f38, 13); // ld a,(0x63b5)
    mem.write8(regs.hl, regs.a); // HL is runtime-computed
    m.step(0x0f39, 7); // ld (hl),a
    regs.bc = 0x0020;
    m.step(0x0f3c, 10); // ld bc,0x0020 -- INSIDE the loop (10 T/iter)
    regs.addHl(regs.bc); // carry set here is DEAD (overwritten at 0x0F42)
    m.step(0x0f3d, 11); // add hl,bc
    regs.a = mem.read8(0x63b1);
    m.step(0x0f40, 13); // ld a,(0x63b1)
    regs.sub(0x08); // THIS is the carry the branch tests
    m.step(0x0f42, 7); // sub 0x08
    mem.write8(0x63b1, regs.a); // wrapped byte written back on borrow
    m.step(0x0f45, 13); // ld (0x63b1),a
    m.step(regs.fNC ? 0x0f35 : 0x0f48, 10); // jp nc,0x0f35 -- falls through on borrow
  } while (regs.fNC);

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0f49, 6); // inc de

  m.step(0x0da7, 10); // jp 0x0da7 -- TAIL JUMP, nothing pushed
  m.call(0x0da7); // its ret returns for us
}
