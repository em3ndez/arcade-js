// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_17b6  (ROM 0x17B6–0x1825) — 0x1644 idx 0: 0x6388-sequence SETUP arm (render 4 items, arm 0x6009, repoint 0x63C0).
 */
export function loc_17b6(m) {
  const { regs, mem } = m;
  m.step(0x17b7, 4); // nop
  m.push16(0x17ba); m.step(0x011c, 17); m.call(0x011c);
  regs.hl = 0x608a;
  m.step(0x17bd, 10); // ld hl,0x608a
  mem.write8(regs.hl, 0x0e);
  m.step(0x17bf, 10); // ld (hl),0x0e
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x17c0, 6); // inc hl
  mem.write8(regs.hl, 0x03);
  m.step(0x17c2, 10); // ld (hl),0x03
  regs.a = 0x10;
  m.step(0x17c4, 7); // ld a,0x10
  regs.de = 0x0020;
  m.step(0x17c7, 10); // ld de,0x0020
  regs.hl = 0x7623;
  m.step(0x17ca, 10); // ld hl,0x7623
  m.push16(0x17cd); m.step(0x0514, 17); m.call(0x0514); // A/DE live-in
  regs.hl = 0x7583;
  m.step(0x17d0, 10); // ld hl,0x7583
  m.push16(0x17d3); m.step(0x0514, 17); m.call(0x0514);
  // four render pairs: ld hl,vhl / call 0x1826 / ld de,rde / call 0x0da7 (straight-line)
  for (const [vhl, rde, retA, retB] of [
    [0x76da, 0x3a47, 0x17d9, 0x17df],
    [0x76d5, 0x3a4d, 0x17e5, 0x17eb],
    [0x76d0, 0x3a53, 0x17f1, 0x17f7],
    [0x76cb, 0x3a59, 0x17fd, 0x1803],
  ]) {
    regs.hl = vhl;
    m.step(retA - 3, 10); // ld hl,vhl -> the call at retA-3
    m.push16(retA); m.step(0x1826, 17); m.call(0x1826);
    regs.de = rde;
    m.step(retB - 3, 10); // ld de,rde -> the call at retB-3
    m.push16(retB); m.step(0x0da7, 17); m.call(0x0da7);
  }
  regs.hl = 0x385c;
  m.step(0x1806, 10); // ld hl,0x385c
  m.push16(0x1809); m.step(0x004e, 17); m.call(0x004e);
  regs.hl = 0x6908;
  m.step(0x180c, 10); // ld hl,0x6908
  regs.c = 0x44;
  m.step(0x180e, 7); // ld c,0x44
  m.push16(0x180f); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.hl = 0x6905;
  m.step(0x1812, 10); // ld hl,0x6905
  mem.write8(regs.hl, 0x13);
  m.step(0x1814, 10); // ld (hl),0x13
  regs.a = 0x20;
  m.step(0x1816, 7); // ld a,0x20
  mem.write8(0x6009, regs.a); // arm countdown
  m.step(0x1819, 13);
  regs.a = 0x80;
  m.step(0x181b, 7); // ld a,0x80
  mem.write8(0x6390, regs.a);
  m.step(0x181e, 13);
  regs.hl = 0x6388;
  m.step(0x1821, 10); // ld hl,0x6388
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance selector; HL stays 0x6388
  m.step(0x1822, 11);
  mem.write16(0x63c0, regs.hl); // REPOINT loc_3069 at 0x6388
  m.step(0x1825, 16);
  m.ret();
}
