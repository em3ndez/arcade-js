// SPDX-License-Identifier: GPL-3.0-only

// loc_73ce  (ROM 0x73ce-0x73e2) -- eagle-record state 2 (retire). Clears the whole 0x18-byte record
// (HL := IX, fill 0x18 bytes with 0 via rst 0x10), then decrements the live-record count (0x8f3c);
// when it reaches 0 it seeds the inter-wave hold (0x8f36)=0x30.
export function loc_73ce(m) {
  const { regs, mem } = m;

  regs.a = regs.ix & 0xff;
  m.step(0x73d0, 8); // 73ce  ld a,ixl
  regs.l = regs.a;
  m.step(0x73d1, 4); // 73d0  ld l,a
  regs.a = (regs.ix >> 8) & 0xff;
  m.step(0x73d3, 8); // 73d1  ld a,ixh
  regs.h = regs.a;
  m.step(0x73d4, 4); // 73d3  ld h,a -- HL = IX
  regs.xor(regs.a);
  m.step(0x73d5, 4); // 73d4  xor a
  regs.b = 0x18;
  m.step(0x73d7, 7); // 73d5  ld b,0x18
  m.push16(0x73d8);
  m.step(0x0010, 11); // 73d7  rst 0x10 -- clear the 0x18-byte record
  m.call(0x0010);
  regs.hl = 0x8f3c;
  m.step(0x73db, 10); // 73d8  ld hl,0x8f3c
  regs.decMem8(mem, regs.hl);
  m.step(0x73dc, 11); // 73db  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 73dc  ret nz
  m.step(0x73dd, 5);
  regs.a = 0x30;
  m.step(0x73df, 7); // 73dd  ld a,0x30
  mem.write8(0x8f36, regs.a);
  m.step(0x73e2, 13); // 73df  ld (0x8f36),a
  m.ret(); // 73e2  ret
}
