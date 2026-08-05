// SPDX-License-Identifier: GPL-3.0-only

// loc_178c  (ROM 0x178C-0x17B8)
export function loc_178c(m) {
  const { regs, mem } = m;

  m.push16(0x178f);
  m.step(0x0b06, 17); // 178c  call 0x0b06
  m.call(0x0b06);

  m.push16(0x1792);
  m.step(0x0b39, 17); // 178f  call 0x0b39
  m.call(0x0b39);

  regs.hl = 0xa9eb;
  m.step(0x1795, 10); // 1792  ld hl,0xa9eb
  regs.decMem8(mem, regs.hl);
  m.step(0x1796, 11); // 1795  dec (hl)

  if (regs.fNZ) {
    m.ret(11); // 1796  ret nz (taken) -- the countdown has not expired
    return;
  }
  m.step(0x1797, 5); // 1796  ret nz (not taken)

  m.push16(0x179a);
  m.step(0x19da, 17); // 1797  call 0x19da
  m.call(0x19da);

  regs.a = mem.read8(0x47b3);
  m.step(0x179d, 13); // 179a  ld a,(0x47b3) -- 0x3A, an opcode read as data
  regs.add(0x02);
  m.step(0x179f, 7); // 179d  add a,0x02
  regs.l = regs.a;
  m.step(0x17a0, 4); // 179f  ld l,a
  regs.add(0x6a);
  m.step(0x17a2, 7); // 17a0  add a,0x6a
  regs.h = regs.a;
  m.step(0x17a3, 4); // 17a2  ld h,a -- HL = 0xA63C on a clean ROM
  regs.a = mem.read8(regs.hl);
  m.step(0x17a4, 7); // 17a3  ld a,(hl)
  regs.cp(0x3b);
  m.step(0x17a6, 7); // 17a4  cp 0x3b

  if (regs.fNZ) {
    m.step(0x15ca, 10); // 17a6  jp nz,0x15ca -- TAIL into the trap, nothing pushed
    return m.call(0x15ca);
  }
  m.step(0x17a9, 10); // 17a6  jp nz,0x15ca (not taken)

  regs.hl = 0xa67c;
  m.step(0x17ac, 10); // 17a9  ld hl,0xa67c
  regs.de = 0xab43;
  m.step(0x17af, 10); // 17ac  ld de,0xab43
  regs.a = mem.read8(regs.hl);
  m.step(0x17b0, 7); // 17af  ld a,(hl) -- the glyph
  mem.write8(regs.de, regs.a);
  m.step(0x17b1, 7); // 17b0  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x17b2, 6); // 17b1  inc de
  regs.h = regs.res(2, regs.h); // no flags
  m.step(0x17b4, 8); // 17b2  res 2,h -- 0xA67C becomes 0xA27C, COLOUR RAM
  regs.a = mem.read8(regs.hl);
  m.step(0x17b5, 7); // 17b4  ld a,(hl) -- the colour
  mem.write8(regs.de, regs.a);
  m.step(0x17b6, 7); // 17b5  ld (de),a

  m.step(0x0f1a, 10); // 17b6  jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
