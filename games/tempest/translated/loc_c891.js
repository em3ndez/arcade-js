// SPDX-License-Identifier: GPL-3.0-only
// loc_c891  (ROM 0xc891-0xc90b) -- per-frame dispatcher: on $0c00&0x10 clear seeds $00=0x22; else (unless $05
//   bit6 set) when $0a&1 uses $06/$a2 to seed $01/$00 speed values; then if $06!=0 calls loc_c81b; every 4th
//   ($09&3==0) reseeds $06=2; increments frame $03 and on odd frames calls loc_de1b; if $0c!=0 calls loc_ccfa;
//   sets decimal mode when $016c!=0 and $9f<0x13; finally clears $4e if its bit7 is set. rts at c90b.
// Convergence points c8d2/c8d9/c8e3 reached from several forward jumps -> labeled JS blocks. c8c7-c8c9 are dead
//   (the jmp at c8c4 skips them and nothing branches there).
export function loc_c891(m) {
  const { regs, mem } = m;
  block_c8e3: {
    block_c8d9: {
      block_c8d2: {
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xc894, 4);
        regs.and(0x10); m.step(0xc896, 2);
        if (regs.fZ) {
          m.step(0xc898, 2);
          regs.a = 0x22; regs.setNZ(regs.a); m.step(0xc89a, 2);
          mem.write8(0x00, regs.a); m.step(0xc89c, 3);
          regs.clv(); m.step(0xc89d, 2);
          m.step(0xc8e3, 3); break block_c8e3;
        }
        m.step(0xc89f, 3);
        regs.bit(mem.read8(0x05)); m.step(0xc8a1, 3);
        if (regs.fV) { m.step(0xc8e3, 3); break block_c8e3; }
        m.step(0xc8a3, 2);
        regs.a = mem.read8(0x0a); regs.setNZ(regs.a); m.step(0xc8a5, 3);
        regs.and(0x01); m.step(0xc8a7, 2);
        if (regs.fZ) { m.step(0xc8d2, 3); break block_c8d2; }
        m.step(0xc8a9, 2);
        regs.y = mem.read8(0x06); regs.setNZ(regs.y); m.step(0xc8ab, 3);
        if (regs.fNZ) {
          m.step(0xc8b1, 3);
        } else {
          m.step(0xc8ad, 2);
          regs.a = 0x80; regs.setNZ(regs.a); m.step(0xc8af, 2);
          mem.write8(0xa2, regs.a); m.step(0xc8b1, 3);
        }
        regs.bit(mem.read8(0xa2)); m.step(0xc8b3, 3);
        if (regs.fPl) { m.step(0xc8d2, 3); break block_c8d2; }
        m.step(0xc8b5, 2);
        regs.cpy(0x02); m.step(0xc8b7, 2);
        if (regs.fC) {
          m.step(0xc8ca, 3);
          regs.a = 0x14; regs.setNZ(regs.a); m.step(0xc8cc, 2);
          mem.write8(0x00, regs.a); m.step(0xc8ce, 3);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc8d0, 2);
          mem.write8(0xa2, regs.a); m.step(0xc8d2, 3);
          break block_c8d2;
        }
        m.step(0xc8b9, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0xc8ba, 2);
        if (regs.fNZ) {
          m.step(0xc8bc, 2);
          regs.a = 0x16; regs.setNZ(regs.a); m.step(0xc8be, 2);
          mem.write8(0x01, regs.a); m.step(0xc8c0, 3);
          regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xc8c2, 2);
          mem.write8(0x00, regs.a); m.step(0xc8c4, 3);
        } else {
          m.step(0xc8c4, 3);
        }
        m.step(0xc8d9, 3); break block_c8d9;
      }
      // c8d2 convergence
      regs.a = mem.read8(0x06); regs.setNZ(regs.a); m.step(0xc8d4, 3);
      if (regs.fNZ) {
        m.step(0xc8d6, 2);
        m.push16(0xc8d8); m.step(0xc8d9, 6); m.call(0xc81b);
      } else {
        m.step(0xc8d9, 3);
      }
      // fall into c8d9
    }
    // c8d9 convergence
    regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xc8db, 3);
    regs.and(0x03); m.step(0xc8dd, 2);
    if (regs.fNZ) { m.step(0xc8e3, 3); break block_c8e3; }
    m.step(0xc8df, 2);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xc8e1, 2);
    mem.write8(0x06, regs.a); m.step(0xc8e3, 3);
    // fall into c8e3
  }
  // c8e3 convergence
  { const d = (mem.read8(0x03) + 1) & 0xff; mem.write8(0x03, d); regs.setNZ(d); } m.step(0xc8e5, 5);
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xc8e7, 3);
  regs.and(0x01); m.step(0xc8e9, 2);
  if (regs.fNZ) {
    m.step(0xc8eb, 2);
    m.push16(0xc8ed); m.step(0xc8ee, 6); m.call(0xde1b);
  } else {
    m.step(0xc8ee, 3);
  }
  regs.a = mem.read8(0x0c); regs.setNZ(regs.a); m.step(0xc8f0, 3);
  if (regs.fNZ) {
    m.step(0xc8f2, 2);
    m.push16(0xc8f4); m.step(0xc8f5, 6); m.call(0xccfa);
  } else {
    m.step(0xc8f5, 3);
  }
  regs.a = mem.read8(0x016c); regs.setNZ(regs.a); m.step(0xc8f8, 4);
  if (regs.fNZ) {
    m.step(0xc8fa, 2);
    regs.a = 0x13; regs.setNZ(regs.a); m.step(0xc8fc, 2);
    regs.cmp(mem.read8(0x9f)); m.step(0xc8fe, 3);
    if (regs.fNC) {
      m.step(0xc900, 2);
      regs.sed(); m.step(0xc901, 2);
    } else {
      m.step(0xc901, 3);
    }
  } else {
    m.step(0xc901, 4);
  }
  regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xc903, 3);
  regs.and(0x80); m.step(0xc905, 2);
  if (regs.fZ) { m.step(0xc90b, 4); return m.ret(6); }
  m.step(0xc907, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc909, 2);
  mem.write8(0x4e, regs.a); m.step(0xc90b, 3);
  return m.ret(6);
}
