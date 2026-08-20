// SPDX-License-Identifier: GPL-3.0-only

// loc_1bcc  (ROM 0x1bcc-0x1c02) -- leaf 0x15a8 handler. If 0x8948 is nonzero, clear 0x880d; then
// ldir-copy 0x8900..0x893e -> 0x8980..0x89be (0x3f bytes), clear 0x880a. Then checksum 0x0e ROM
// bytes at 0x5328 (each masked to 5 bits) into DE -- which STILL holds the post-ldir 0x89bf, not a
// fresh value. If the running low byte lands E==0x60 and D==0x8a, ret; otherwise bump 0x8a38, ret.
export function loc_1bcc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8948);   m.step(0x1bcf, 13);
  regs.and(regs.a);             m.step(0x1bd0, 4);
  if (regs.fZ) {
    m.step(0x1bd6, 12);         // jr z -> 0x1bd6
  } else {
    m.step(0x1bd2, 7);
    regs.xor(regs.a);           m.step(0x1bd3, 4);
    mem.write8(0x880d, regs.a); m.step(0x1bd6, 13);
  }

  // loc_1bd6: copy the 0x3f-byte block, clear 0x880a
  regs.de = 0x8980;            m.step(0x1bd9, 10);
  regs.hl = 0x8900;            m.step(0x1bdc, 10);
  regs.bc = 0x003f;            m.step(0x1bdf, 10);
  m.ldirAt(0x1bdf, 0x1be1);    // ldir 0x8900..0x893e -> 0x8980..0x89be; leaves DE=0x89bf
  regs.xor(regs.a);            m.step(0x1be2, 4);
  mem.write8(0x880a, regs.a);  m.step(0x1be5, 13);

  regs.hl = 0x5328;            m.step(0x1be8, 10);
  regs.b = 0x0e;               m.step(0x1bea, 7);

  for (;;) { // loc_1bea: DE += (mem[HL] & 0x1f), carry into D
    regs.a = mem.read8(regs.hl); m.step(0x1beb, 7);
    regs.and(0x1f);              m.step(0x1bed, 7);
    regs.add(regs.e);            m.step(0x1bee, 4);
    regs.e = regs.a;             m.step(0x1bef, 4);
    if (regs.fNC) {
      m.step(0x1bf2, 12);        // jr nc -> 0x1bf2 (no carry into D)
    } else {
      m.step(0x1bf1, 7);
      regs.d = regs.inc8(regs.d); m.step(0x1bf2, 4);
    }
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1bf3, 6);
    regs.b = (regs.b - 1) & 0xff; // djnz: dec b, no flags
    if (regs.b !== 0) { m.step(0x1bea, 13); continue; }
    m.step(0x1bf5, 8); break;
  }

  regs.a = 0x60;               m.step(0x1bf7, 7);
  regs.cp(regs.e);             m.step(0x1bf8, 4);
  if (regs.fNZ) {
    m.step(0x1bfe, 12);        // jr nz -> 0x1bfe
  } else {
    m.step(0x1bfa, 7);
    regs.a = 0x8a;             m.step(0x1bfc, 7);
    regs.sub(regs.d);          m.step(0x1bfd, 4);
    if (regs.fZ) { return m.ret(11); } // ret z -- checksum matched
    m.step(0x1bfe, 5);
  }

  // loc_1bfe: bump the 0x8a38 counter, ret
  regs.hl = 0x8a38;            m.step(0x1c01, 10);
  regs.incMem8(mem, regs.hl);  m.step(0x1c02, 11);

  m.ret(10); // 1c02  ret
}
