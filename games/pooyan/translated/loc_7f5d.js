// SPDX-License-Identifier: GPL-3.0-only

// loc_7f5d  (ROM 0x7f5d-0x7fa7) -- write-anim dispatcher table entry 2 (via 7e94).
// A=((0x8e21)); four rlca push bit4 into carry, then `rl (hl)` shifts it into the
// (0x8e29) ring. Gate: ((0x8e29)&7)!=1 -> ret nz. On the 1-phase it stores 0x03a0
// at (0x8e2b), copies (0x8e23) to *(0x8e1f)++ (writeback), and decrements (0x8e25).
// When that hits 0, jr z tail-delegates to 0x7fa8 (its ret is ours); otherwise it
// writes (0x8e23) to *(0x8e27), backs (0x8e27) up 0x20, seeds 0x11/(0x8e26)=1, and
// re-primes (0x8e23)=0x11. The `and a` at 0x7f86 sets the Z the jr z tests -- the
// intervening `ld (nn),a` leaves flags untouched, so that reading must hold.
export function loc_7f5d(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x8e21);      m.step(0x7f60, 16);
  regs.a = mem.read8(regs.hl);       m.step(0x7f61, 7);
  regs.hl = 0x8e29;                  m.step(0x7f64, 10);
  regs.rlca();                       m.step(0x7f65, 4);
  regs.rlca();                       m.step(0x7f66, 4);
  regs.rlca();                       m.step(0x7f67, 4);
  regs.rlca();                       m.step(0x7f68, 4);            // carry = original bit4
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl))); m.step(0x7f6a, 15); // rl (hl)
  regs.a = mem.read8(regs.hl);       m.step(0x7f6b, 7);
  regs.and(0x07);                    m.step(0x7f6d, 7);
  regs.cp(0x01);                     m.step(0x7f6f, 7);
  if (regs.fNZ) { m.ret(11); return; }              // ret nz -- not the 1-phase
  m.step(0x7f70, 5);                                // ret nz not taken

  regs.hl = 0x03a0;                  m.step(0x7f73, 10);
  mem.write16(0x8e2b, regs.hl);      m.step(0x7f76, 16);
  regs.a = mem.read8(0x8e23);        m.step(0x7f79, 13);
  regs.hl = mem.read16(0x8e1f);      m.step(0x7f7c, 16);
  mem.write8(regs.hl, regs.a);       m.step(0x7f7d, 7);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x7f7e, 6);            // inc hl
  mem.write16(0x8e1f, regs.hl);      m.step(0x7f81, 16);
  regs.hl = 0x8e25;                  m.step(0x7f84, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); m.step(0x7f85, 11); // dec (hl)
  regs.a = mem.read8(regs.hl);       m.step(0x7f86, 7);
  regs.and(regs.a);                  m.step(0x7f87, 4);            // Z tested by jr z below
  mem.write8(0x8e25, regs.a);        m.step(0x7f8a, 13);
  if (regs.fZ) {
    m.step(0x7fa8, 12);                             // jr z,0x7fa8 taken -- countdown drained
    return m.call(0x7fa8);                          // tail delegation (BOUNDARY)
  }
  m.step(0x7f8c, 7);                                // jr z not taken

  regs.a = mem.read8(0x8e23);        m.step(0x7f8f, 13);
  regs.hl = mem.read16(0x8e27);      m.step(0x7f92, 16);
  mem.write8(regs.hl, regs.a);       m.step(0x7f93, 7);
  regs.bc = 0xffe0;                  m.step(0x7f96, 10);
  regs.addHl(regs.bc);               m.step(0x7f97, 11);          // add hl,bc (HL-=0x20)
  mem.write16(0x8e27, regs.hl);      m.step(0x7f9a, 16);
  regs.a = 0x11;                     m.step(0x7f9c, 7);
  mem.write8(regs.hl, regs.a);       m.step(0x7f9d, 7);
  regs.a = 0x01;                     m.step(0x7f9f, 7);
  mem.write8(0x8e26, regs.a);        m.step(0x7fa2, 13);
  regs.a = 0x11;                     m.step(0x7fa4, 7);
  mem.write8(0x8e23, regs.a);        m.step(0x7fa7, 13);
  m.ret(10); return;                                // ret
}
