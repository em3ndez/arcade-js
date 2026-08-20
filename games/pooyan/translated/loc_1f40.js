// SPDX-License-Identifier: GPL-3.0-only

// loc_1f40  (ROM 0x1f40-0x1f86) -- ROM self-check guard entry (loc_32bd `jp nz,0x1f40`). Runs the
// 0x1f41 table-scan shared with loc_1f2f but prefixed by `dec b`: scan (HL) for A, C tracking the
// slot; no match -> ret (0x1f48). A match falls into loc_1f2f's tail at 0x1f4e: slot C==0 renders the
// BCD round counter (loc_1f8c, glyph table 0x1fda/0x1fe6 per DAA bit4, rst 0x10 clear, stash 0x8901);
// either way it draws the fixed label (loc_0c45 + loc_1f8c). The 0x1f40 byte (0x05) doubles as the
// operand of loc_1f2f's `ld b,05h`, so 0x1f41 is a shared loop-latch, not a separate routine.
export function loc_1f40(m) {
  const { regs, mem } = m;

  regs.b = regs.dec8(regs.b);        m.step(0x1f41, 4); // 1f40  dec b

  for (;;) { // loc_1f41: scan (HL) for A, C tracks the slot
    regs.cp(mem.read8(regs.hl));       m.step(0x1f42, 7);
    if (regs.fZ) { m.step(0x1f4e, 12); break; } // jr z,0x1f4e -- matched
    m.step(0x1f44, 7);
    regs.c = regs.inc8(regs.c);        m.step(0x1f45, 4);
    regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x1f46, 6);
    if (regs.djnz()) { m.step(0x1f41, 13); } else { m.step(0x1f48, 8); return m.ret(10); } // no match -> ret
  }

  regs.a = regs.c;                   m.step(0x1f4f, 4); // 1f4e  ld a,c
  regs.and(regs.a);                  m.step(0x1f50, 4);
  if (regs.fNZ) {
    m.step(0x1f7a, 12);              // jr nz,0x1f7a -- slot != 0, skip the round render
  } else {
    m.step(0x1f52, 7);
    regs.a = mem.read8(0x8907);      m.step(0x1f55, 13);
    regs.add(0x01);                  m.step(0x1f57, 7);
    regs.b = regs.a;                 m.step(0x1f58, 4);
    regs.xor(regs.a);                m.step(0x1f59, 4);
    for (;;) { // loc_1f59: BCD-count A up B times
      regs.add(0x01);                m.step(0x1f5b, 7);
      regs.daa();                    m.step(0x1f5c, 4);
      if (regs.djnz()) { m.step(0x1f59, 13); } else { m.step(0x1f5e, 8); break; }
    }
    regs.de = 0x1fe6;                m.step(0x1f61, 10);
    regs.bit(4, regs.a);             m.step(0x1f63, 8); // pick glyph table by DAA bit4
    if (regs.fNZ) {
      m.step(0x1f68, 12);            // jr nz,0x1f68 -- DE stays 0x1fe6
    } else {
      m.step(0x1f65, 7);
      regs.de = 0x1fda;              m.step(0x1f68, 10);
    }
    regs.hl = 0x8722;                m.step(0x1f6b, 10);
    m.push16(0x1f6e); m.step(0x1f8c, 17); m.call(0x1f8c); // 1f6b  call 0x1f8c
    regs.a = 0x10;                   m.step(0x1f70, 7);
    regs.b = 0x03;                   m.step(0x1f72, 7);
    m.push16(0x1f73); m.step(0x0010, 11); m.call(0x0010); // 1f72  rst 0x10 (clear HUD cell)
    regs.a = mem.read8(0x8901);      m.step(0x1f76, 13);
    mem.write8(0x8743, regs.a);      m.step(0x1f79, 13);
    regs.xor(regs.a);                m.step(0x1f7a, 4);
  }

  regs.hl = 0x1fa3;                  m.step(0x1f7d, 10); // 1f7a  ld hl,0x1fa3
  m.push16(0x1f80); m.step(0x0c45, 17); m.call(0x0c45); // 1f7d  call 0x0c45
  regs.hl = 0x8322;                  m.step(0x1f83, 10);
  m.push16(0x1f86); m.step(0x1f8c, 17); m.call(0x1f8c); // 1f83  call 0x1f8c
  return m.ret(10);                  // 1f86  ret
}
