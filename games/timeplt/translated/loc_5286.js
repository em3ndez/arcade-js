// SPDX-License-Identifier: GPL-3.0-only

// loc_5286  (ROM 0x5286–0x52A9)
export function loc_5286(m) {
  const { regs, mem } = m;

  m.push16(0x5289);
  m.step(0x530e, 17); // call 0x530e
  m.call(0x530e);

  m.push16(0x528c);
  m.step(0x52d2, 17); // call 0x52d2
  m.call(0x52d2);

  regs.a = mem.read8(0xae00);
  m.step(0x528f, 13); // ld a,(0xae00)
  regs.cp(0x04);
  m.step(0x5291, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x526a, 12); // jr z,0x526a
    return m.call(0x526a); // tail transfer -- no push
  }
  m.step(0x5293, 7); // jr z -- not taken

  regs.c = regs.a;
  m.step(0x5294, 4); // ld c,a
  regs.b = 0x00;
  m.step(0x5296, 7); // ld b,0x00
  regs.hl = 0xae00;
  m.step(0x5299, 10); // ld hl,0xae00
  regs.de = 0xae80;
  m.step(0x529c, 10); // ld de,0xae80
  m.ldirAt(0x529c, 0x529e); // ldir -- BC bytes, 0xAE00 -> 0xAE80

  regs.add(0x80);
  m.step(0x52a0, 7); // add a,0x80
  mem.write8(0xae80, regs.a);
  m.step(0x52a3, 13); // ld (0xae80),a
  regs.hl = 0xae04;
  m.step(0x52a6, 10); // ld hl,0xae04
  mem.write16(0xae00, regs.hl);
  m.step(0x52a9, 16); // ld (0xae00),hl

  m.ret(10); // ret (0x52A9)
}
