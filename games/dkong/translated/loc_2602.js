// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2602  (ROM 0x2602–0x262E) — sub_25f2's 1st callee: even-frame 0x62A0 countdown (call 0x26de), update 0x62A1->0x63A3 (0x26e9), every 32nd frame call 0x26a6.
 */
export function loc_2602(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x2605, 13); // ld a,(0x601a)
  regs.rrca();
  m.step(0x2606, 4); // rrca
  if (regs.fC) {
    m.step(0x2616, 10); // jp c,0x2616 (odd frame)
  } else {
    m.step(0x2609, 10);
    regs.hl = 0x62a0;
    m.step(0x260c, 10); // ld hl,0x62a0
    regs.decMem8(mem, regs.hl);
    m.step(0x260d, 11); // dec (hl)
    if (regs.fNZ) {
      m.step(0x2616, 10); // jp nz,0x2616
    } else {
      m.step(0x2610, 10);
      mem.write8(regs.hl, 0x80);
      m.step(0x2612, 10); // ld (hl),0x80
      regs.l = (regs.l + 1) & 0xff;
      m.step(0x2613, 4); // inc l
      m.push16(0x2616); m.step(0x26de, 17); m.call(0x26de); // call 0x26de
    }
  }
  regs.hl = 0x62a1;
  m.step(0x2619, 10); // ld hl,0x62a1
  m.push16(0x261c); m.step(0x26e9, 17); m.call(0x26e9); // call 0x26e9 -> A
  mem.write8(0x63a3, regs.a);
  m.step(0x261f, 13); // ld (0x63a3),a
  regs.a = mem.read8(0x601a);
  m.step(0x2622, 13); // ld a,(0x601a)
  regs.and(0x1f);
  m.step(0x2624, 7); // and 0x1f
  regs.cp(0x01);
  m.step(0x2626, 7); // cp 0x01
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x2627, 5);
  regs.de = 0x69e4;
  m.step(0x262a, 10); // ld de,0x69e4
  regs.exDeHl();
  m.step(0x262b, 4); // ex de,hl -- HL = 0x69E4
  m.push16(0x262e); m.step(0x26a6, 17); m.call(0x26a6); // call 0x26a6
  m.ret(10);
}
