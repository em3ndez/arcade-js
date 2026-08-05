// SPDX-License-Identifier: GPL-3.0-only

// loc_2a57  (ROM 0x2A57-0x2A76)
export function loc_2a57(m) {
  const { regs, mem } = m;

  regs.de = 0x0010;
  m.step(0x2a5a, 10); // ld de,0x0010
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x2a5d, 19); // ld a,(ix+0x02)
  regs.add(0x08);
  m.step(0x2a5f, 7); // add a,0x08
  regs.rrca();
  m.step(0x2a60, 4); // rrca
  regs.rrca();
  m.step(0x2a61, 4); // rrca
  regs.rrca();
  m.step(0x2a62, 4); // rrca
  regs.rrca();
  m.step(0x2a63, 4); // rrca
  regs.and(0x0f);
  m.step(0x2a65, 7); // and 0x0f -- 16-way direction
  regs.hl = 0x2a77;
  m.step(0x2a68, 10); // ld hl,0x2a77

  m.push16(0x2a69);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.b = mem.read8(regs.hl);
  m.step(0x2a6a, 7); // ld b,(hl)
  regs.addHl(regs.de);
  m.step(0x2a6b, 11); // add hl,de -- the second table
  regs.c = mem.read8(regs.hl);
  m.step(0x2a6c, 7); // ld c,(hl)
  regs.a = mem.read8(0xa980);
  m.step(0x2a6f, 13); // ld a,(0xa980) -- frame counter
  regs.bit(1, regs.a);
  m.step(0x2a71, 8); // bit 1,a
  if (regs.fZ) {
    m.ret(11); // ret z -- B unchanged this pair of frames
    return;
  }
  m.step(0x2a72, 5); // ret z not taken

  regs.a = regs.b;
  m.step(0x2a73, 4); // ld a,b
  regs.add(0x08);
  m.step(0x2a75, 7); // add a,0x08
  regs.b = regs.a;
  m.step(0x2a76, 4); // ld b,a
  m.ret(10); // 2a76
}
