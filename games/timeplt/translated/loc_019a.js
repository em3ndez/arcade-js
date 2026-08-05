// SPDX-License-Identifier: GPL-3.0-only

// loc_019a  (ROM 0x019A–0x01B4)
export function loc_019a(m) {
  const { regs, mem } = m;

  regs.hl = 0xa400;
  m.step(0x019d, 10); // ld hl,0xa400
  mem.write16(0xa989, regs.hl);
  m.step(0x01a0, 16); // ld (0xa989),hl
  regs.a = 0x20;
  m.step(0x01a2, 7); // ld a,0x20
  mem.write8(0xa988, regs.a);
  m.step(0x01a5, 13); // ld (0xa988),a

  regs.b = 0xf0;
  m.step(0x01a7, 7); // ld b,0xf0 -- 240 bytes
  regs.hl = 0x4ba5;
  m.step(0x01aa, 10); // ld hl,0x4ba5
  regs.xor(regs.a); // A = 0, carry cleared
  m.step(0x01ab, 4); // xor a

  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x01ac, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x01ad, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x01ab : 0x01af, regs.b !== 0 ? 13 : 8); // djnz 0x01ab
  } while (regs.b !== 0);

  regs.sub(0x11); // expected checksum
  m.step(0x01b1, 7); // sub 0x11

  if (regs.fNZ) {
    m.push16(0x01b4);
    m.step(0x0167, 17); // call nz,0x0167 (taken)
    m.call(0x0167);
  } else {
    m.step(0x01b4, 10); // call nz,0x0167 (not taken)
  }

  m.ret(10); // ret (0x01B4)
}
