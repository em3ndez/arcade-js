// SPDX-License-Identifier: GPL-3.0-only

// loc_1ead  (ROM 0x1ead-0x1f17) -- bonus/round HUD setup then the per-frame update chain.
// If 0x881e is nonzero (already set up) it jumps straight to the update chain (0x1f18/0x34c9).
// Otherwise: blit a fixed field from ROM 0x1ea7 (0x10-terminated, bottom-up hl-=0x20) into 0x855f;
// BCD-convert the round counter 0x8907+1 (add-1 loop), split it into two nibbles rendered into
// 0x849f (high nibble -> blank tile 0x10 when zero) and 0x847f (low nibble), stash the low nibble
// at 0x8483, call the sub-renderers (0x0c45/0x3307/0x1f8c) and 0x1ffb, then fall into the update
// chain. Three `push af` preserve the BCD value across the srl splits; the third is popped at 0x1f07.
export function loc_1ead(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x881e);        m.step(0x1eb0, 13);
  regs.and(regs.a);                  m.step(0x1eb1, 4);
  if (regs.fNZ) {
    m.step(0x1f11, 12);              // jr nz -> straight to the update chain
  } else {
    m.step(0x1eb3, 7);
    regs.hl = 0x855f;                m.step(0x1eb6, 10);
    regs.bc = 0x1ea7;                m.step(0x1eb9, 10);
    regs.de = 0xffe0;                m.step(0x1ebc, 10);

    for (;;) { // loc_1ebc: copy ROM field bytes until the 0x10 sentinel, bottom-up
      regs.a = mem.read8(regs.bc);       m.step(0x1ebd, 7);
      mem.write8(regs.hl, regs.a);       m.step(0x1ebe, 7);
      regs.bc = (regs.bc + 1) & 0xffff;  m.step(0x1ebf, 6);
      regs.addHl(regs.de);               m.step(0x1ec0, 11);
      regs.cp(0x10);                     m.step(0x1ec2, 7);
      if (regs.fNZ) { m.step(0x1ebc, 12); } else { m.step(0x1ec4, 7); break; }
    }

    regs.a = mem.read8(0x8907);       m.step(0x1ec7, 13);
    regs.a = regs.inc8(regs.a);       m.step(0x1ec8, 4);
    regs.b = regs.a;                  m.step(0x1ec9, 4);
    regs.xor(regs.a);                 m.step(0x1eca, 4);
    for (;;) { // loc_1eca: BCD-convert B by adding 1 B times
      regs.add(0x01);                 m.step(0x1ecc, 7);
      regs.daa();                     m.step(0x1ecd, 4);
      if (regs.djnz()) { m.step(0x1eca, 13); } else { m.step(0x1ecf, 8); break; }
    }

    m.push16(regs.af);               m.step(0x1ed0, 11);
    m.push16(regs.af);               m.step(0x1ed1, 11);
    m.push16(regs.af);               m.step(0x1ed2, 11);
    regs.a = regs.srl(regs.a);       m.step(0x1ed4, 8);
    regs.a = regs.srl(regs.a);       m.step(0x1ed6, 8);
    regs.a = regs.srl(regs.a);       m.step(0x1ed8, 8);
    regs.a = regs.srl(regs.a);       m.step(0x1eda, 8); // A = high BCD nibble
    regs.hl = 0x849f;                m.step(0x1edd, 10);
    regs.and(regs.a);                m.step(0x1ede, 4);
    if (regs.fNZ) {
      m.step(0x1ee2, 12);            // jr nz -> high nibble nonzero, keep it
    } else {
      m.step(0x1ee0, 7);
      regs.a = 0x10;                 m.step(0x1ee2, 7); // blank tile for a leading zero
    }
    mem.write8(regs.hl, regs.a);      m.step(0x1ee3, 7);

    regs.af = m.pop16();             m.step(0x1ee4, 10);
    regs.and(0x0f);                  m.step(0x1ee6, 7); // A = low BCD nibble
    regs.hl = 0x847f;                m.step(0x1ee9, 10);
    mem.write8(regs.hl, regs.a);      m.step(0x1eea, 7);

    regs.af = m.pop16();             m.step(0x1eeb, 10);
    regs.a = regs.srl(regs.a);       m.step(0x1eed, 8);
    regs.a = regs.srl(regs.a);       m.step(0x1eef, 8);
    regs.a = regs.srl(regs.a);       m.step(0x1ef1, 8);
    regs.a = regs.srl(regs.a);       m.step(0x1ef3, 8);
    regs.and(0x01);                  m.step(0x1ef5, 7);
    regs.hl = 0x200d;                m.step(0x1ef8, 10);
    m.push16(0x1efb);
    m.step(0x0c45, 17);              // 1ef8  call 0x0c45
    m.call(0x0c45);
    regs.hl = 0x8462;                m.step(0x1efe, 10);
    m.push16(0x1f01);
    m.step(0x3307, 17);              // 1efe  call 0x3307
    m.call(0x3307);
    regs.hl = 0x8722;                m.step(0x1f04, 10);
    m.push16(0x1f07);
    m.step(0x1f8c, 17);              // 1f04  call 0x1f8c
    m.call(0x1f8c);
    regs.af = m.pop16();             m.step(0x1f08, 10); // the third stashed BCD value
    regs.b = regs.a;                 m.step(0x1f09, 4);
    regs.and(0x0f);                  m.step(0x1f0b, 7);
    mem.write8(0x8483, regs.a);       m.step(0x1f0e, 13);
    m.push16(0x1f11);
    m.step(0x1ffb, 17);              // 1f0e  call 0x1ffb
    m.call(0x1ffb);
  }

  // loc_1f11: per-frame update chain (also the jr-nz target)
  m.push16(0x1f14);
  m.step(0x1f18, 17);                // 1f11  call 0x1f18
  m.call(0x1f18);
  m.push16(0x1f17);
  m.step(0x34c9, 17);                // 1f14  call 0x34c9
  m.call(0x34c9);
  return m.ret(10);                  // 1f17  ret
}
