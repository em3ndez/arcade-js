// SPDX-License-Identifier: GPL-3.0-only

// loc_1bab  (ROM 0x1bab-0x1bcb) -- leaf 0x15a8 handler. If both 0x880e and 0x8988 are nonzero,
// latch 0x880d=1; then ldir-copy 0x8900..0x893e -> 0x8940..0x897e (0x3f bytes), clear 0x880a, ret.
export function loc_1bab(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x880e);   m.step(0x1bae, 13);
  regs.and(regs.a);             m.step(0x1baf, 4);
  if (regs.fZ) {
    m.step(0x1bbc, 12);         // jr z -> 0x1bbc
  } else {
    m.step(0x1bb1, 7);
    regs.a = mem.read8(0x8988); m.step(0x1bb4, 13);
    regs.and(regs.a);           m.step(0x1bb5, 4);
    if (regs.fZ) {
      m.step(0x1bbc, 12);       // jr z -> 0x1bbc
    } else {
      m.step(0x1bb7, 7);
      regs.a = 0x01;            m.step(0x1bb9, 7);
      mem.write8(0x880d, regs.a); m.step(0x1bbc, 13);
    }
  }

  // loc_1bbc: copy the 0x3f-byte block, clear 0x880a
  regs.de = 0x8940;            m.step(0x1bbf, 10);
  regs.hl = 0x8900;            m.step(0x1bc2, 10);
  regs.bc = 0x003f;            m.step(0x1bc5, 10);
  m.ldirAt(0x1bc5, 0x1bc7);    // ldir 0x8900..0x893e -> 0x8940..0x897e
  regs.xor(regs.a);            m.step(0x1bc8, 4);
  mem.write8(0x880a, regs.a);  m.step(0x1bcb, 13);

  m.ret(10); // 1bcb  ret
}
