// SPDX-License-Identifier: GPL-3.0-only

// loc_4a0b  (ROM 0x4a0b-0x4a4f) -- gated on 0x8907 bit0, snapshots the count at 0x8902 into 0x8d43/0x8934,
// then draws a marker sprite and enqueues its layout. Count 0: seed HL=0x8682, DE=0x2754 and call loc_3307.
// Count N>0: seed pointer 0x86a3, paint N rows of the 4-tile marker at 0x86c3 (row stride 0xffdf), back the
// pointer up by 0xffbf, then DE=0x2754 and call loc_3307.
export function loc_4a0b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);      m.step(0x4a0e, 13);
  regs.bit(0, regs.a);             m.step(0x4a10, 8);  // Z = !bit0
  if (regs.fZ) { return m.ret(11); } // ret z -- feature bit0 clear
  m.step(0x4a11, 5);
  regs.a = mem.read8(0x8902);      m.step(0x4a14, 13);
  mem.write8(0x8d43, regs.a);      m.step(0x4a17, 13);
  mem.write8(0x8934, regs.a);      m.step(0x4a1a, 13);
  regs.and(regs.a);                m.step(0x4a1b, 4);
  if (regs.fNZ) {
    m.step(0x4a2c, 12);            // jr nz -- count N>0
    regs.b = regs.a;               m.step(0x4a2d, 4);
    regs.hl = 0x86a3;              m.step(0x4a30, 10);
    mem.write16(0x8932, regs.hl);  m.step(0x4a33, 16); // ld (0x8932),hl
    regs.l = 0xc3;                 m.step(0x4a35, 7);  // HL = 0x86c3
    regs.de = 0xffdf;              m.step(0x4a38, 10);
    for (;;) { // loc_4a38: paint N rows of the 4-tile marker
      mem.write8(regs.hl, 0xda);   m.step(0x4a3a, 10);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x4a3b, 6);
      mem.write8(regs.hl, 0xdb);   m.step(0x4a3d, 10);
      regs.addHl(regs.de);         m.step(0x4a3e, 11);
      mem.write8(regs.hl, 0xd8);   m.step(0x4a40, 10);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x4a41, 6);
      mem.write8(regs.hl, 0xd9);   m.step(0x4a43, 10);
      regs.addHl(regs.de);         m.step(0x4a44, 11);
      if (regs.djnz()) { m.step(0x4a38, 13); } else { m.step(0x4a46, 8); break; }
    }
    regs.e = 0xbf;                 m.step(0x4a48, 7);  // DE = 0xffbf
    regs.addHl(regs.de);           m.step(0x4a49, 11);
    regs.de = 0x2754;              m.step(0x4a4c, 10);
    m.push16(0x4a4f);
    m.step(0x3307, 17);            // 4a4c  call 0x3307 (enqueue layout)
    m.call(0x3307);
    return m.ret(10);              // 4a4f  ret
  }

  // 4a1d: count 0
  m.step(0x4a1d, 7);              // jr nz not taken
  regs.hl = 0x86e3;               m.step(0x4a20, 10);
  mem.write16(0x8932, regs.hl);   m.step(0x4a23, 16); // ld (0x8932),hl
  regs.l = 0x82;                  m.step(0x4a25, 7);  // HL = 0x8682
  regs.de = 0x2754;               m.step(0x4a28, 10);
  m.push16(0x4a2b);
  m.step(0x3307, 17);             // 4a28  call 0x3307 (enqueue layout)
  m.call(0x3307);
  return m.ret(10);               // 4a2b  ret
}
