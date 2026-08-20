// SPDX-License-Identifier: GPL-3.0-only

// loc_1f2f  (ROM 0x1f2f-0x1f86) -- level-tag / stage-label HUD updater. Gated on (0x8d56)==0.
// The current stage index (0x8901) maps to a column code C: <0x0a passes straight through and
// latches 0x8d56; otherwise it is looked up in the 5-entry table at 0x1f87 (C = 0x0a + slot).
// When C==0 (first stage) it renders a BCD round counter derived from (0x8907)+1 (loc_1f8c with
// a 0x1fda/0x1fe6 glyph table per DAA bit4), clears a HUD cell (rst 0x10), and stashes 0x8901.
// It then always draws the fixed label via loc_0c45 and a second loc_1f8c pass.
export function loc_1f2f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d56);        m.step(0x1f32, 13);
  regs.and(regs.a);                  m.step(0x1f33, 4);
  if (regs.fNZ) { return m.ret(11); } // 1f33  ret nz
  m.step(0x1f34, 5);

  regs.c = regs.a;                   m.step(0x1f35, 4); // C = 0
  regs.a = mem.read8(0x8901);        m.step(0x1f38, 13);
  regs.cp(0x0a);                     m.step(0x1f3a, 7);
  if (regs.fC) {
    m.step(0x1f49, 12);              // jr c,0x1f49 taken -- index < 0x0a, passes through
    regs.a = 0x01;                   m.step(0x1f4b, 7);
    mem.write8(0x8d56, regs.a);      m.step(0x1f4e, 13); // latch: done once
  } else {
    m.step(0x1f3c, 7);              // jr c not taken -- scan the table
    regs.hl = 0x1f87;                m.step(0x1f3f, 10);
    regs.b = 0x05;                   m.step(0x1f41, 7);
    for (;;) { // loc_1f41: find A among table[0x1f87], C tracks the slot
      regs.cp(mem.read8(regs.hl));   m.step(0x1f42, 7);
      if (regs.fZ) { m.step(0x1f4e, 12); break; } // jr z,0x1f4e -- matched
      m.step(0x1f44, 7);
      regs.c = regs.inc8(regs.c);    m.step(0x1f45, 4);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1f46, 6);
      if (regs.djnz()) { m.step(0x1f41, 13); } else { m.step(0x1f48, 8); return m.ret(10); } // no match -> ret
    }
    // table match (jr z -> 0x1f4e): converges with the index<0x0a path at ld a,c below
  }

  regs.a = regs.c;                   m.step(0x1f4f, 4); // 1f4e  ld a,c
  regs.and(regs.a);                  m.step(0x1f50, 4);
  if (regs.fNZ) {
    m.step(0x1f7a, 12);              // jr nz,0x1f7a taken -- not the first stage, skip round render
  } else {
    m.step(0x1f52, 7);
    regs.a = mem.read8(0x8907);      m.step(0x1f55, 13);
    regs.add(0x01);                  m.step(0x1f57, 7);
    regs.b = regs.a;                 m.step(0x1f58, 4);
    regs.xor(regs.a);                m.step(0x1f59, 4); // A = 0
    for (;;) { // loc_1f59: BCD-count A up B times
      regs.add(0x01);                m.step(0x1f5b, 7);
      regs.daa();                    m.step(0x1f5c, 4);
      if (regs.djnz()) { m.step(0x1f59, 13); } else { m.step(0x1f5e, 8); break; }
    }
    regs.de = 0x1fe6;                m.step(0x1f61, 10);
    regs.bit(4, regs.a);             m.step(0x1f63, 8); // bit 4,a -- pick glyph table
    if (regs.fNZ) {
      m.step(0x1f68, 12);            // jr nz,0x1f68 taken -- DE stays 0x1fe6
    } else {
      m.step(0x1f65, 7);
      regs.de = 0x1fda;              m.step(0x1f68, 10);
    }
    regs.hl = 0x8722;                m.step(0x1f6b, 10);
    m.push16(0x1f6e); m.step(0x1f8c, 17); m.call(0x1f8c); // 1f6b  call 0x1f8c
    regs.a = 0x10;                   m.step(0x1f70, 7);
    regs.b = 0x03;                   m.step(0x1f72, 7);
    m.push16(0x1f73); m.step(0x0010, 11); m.call(0x0010); // 1f72  rst 0x10
    regs.a = mem.read8(0x8901);      m.step(0x1f76, 13);
    mem.write8(0x8743, regs.a);      m.step(0x1f79, 13);
    regs.xor(regs.a);                m.step(0x1f7a, 4);
  }

  regs.hl = 0x1fa3;                  m.step(0x1f7d, 10);
  m.push16(0x1f80); m.step(0x0c45, 17); m.call(0x0c45); // 1f7d  call 0x0c45
  regs.hl = 0x8322;                  m.step(0x1f83, 10);
  m.push16(0x1f86); m.step(0x1f8c, 17); m.call(0x1f8c); // 1f83  call 0x1f8c
  return m.ret(10);                  // 1f86  ret
}
