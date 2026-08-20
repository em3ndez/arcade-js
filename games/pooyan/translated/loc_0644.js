// SPDX-License-Identifier: GPL-3.0-only

// loc_0644  (ROM 0x0644-0x066c) -- idx8: high-score-table checksum guard.
// The header byte at 0x778a must be 0xc8; then A accumulates 0x778a..0x778d (the four checksum
// bytes) with D counting the carries. A - D must equal 0x59 -> `ret z` (table trusted). Any
// mismatch (bad header, or checksum != 0x59) falls through to set the corrupt flag (0x8df8)=1.
export function loc_0644(m) {
  const { regs, mem } = m;

  regs.ix = 0x778a;                              m.step(0x0648, 14);
  regs.d = 0x00;                                 m.step(0x064a, 7);
  regs.a = mem.read8((regs.ix + 0) & 0xffff);    m.step(0x064d, 19);
  regs.cp(0xc8);                                 m.step(0x064f, 7);
  if (!regs.fZ) {
    m.step(0x0667, 12);                          // jr nz,0x0667 taken -> bad header
  } else {
    m.step(0x0651, 7);                           // jr nz not taken (header == 0xc8)

    regs.add(mem.read8((regs.ix + 1) & 0xffff)); m.step(0x0654, 19);
    if (regs.fNC) {
      m.step(0x0657, 12);                        // jr nc,0x0657 taken
    } else {
      m.step(0x0656, 7);                         // jr nc not taken
      regs.d = regs.inc8(regs.d);                m.step(0x0657, 4);
    }

    regs.add(mem.read8((regs.ix + 2) & 0xffff)); m.step(0x065a, 19);
    if (regs.fNC) {
      m.step(0x065d, 12);                        // jr nc,0x065d taken
    } else {
      m.step(0x065c, 7);                         // jr nc not taken
      regs.d = regs.inc8(regs.d);                m.step(0x065d, 4);
    }

    regs.add(mem.read8((regs.ix + 3) & 0xffff)); m.step(0x0660, 19);
    if (regs.fNC) {
      m.step(0x0663, 12);                        // jr nc,0x0663 taken
    } else {
      m.step(0x0662, 7);                         // jr nc not taken
      regs.d = regs.inc8(regs.d);                m.step(0x0663, 4);
    }

    regs.sub(regs.d);                            m.step(0x0664, 4);
    regs.cp(0x59);                               m.step(0x0666, 7);
    if (regs.fZ) {
      m.ret(11);                                 // 0666 ret z taken -> checksum OK
      return;
    }
    m.step(0x0667, 5);                           // ret z not taken -> bad checksum
  }

  // loc_0667: flag the high-score table corrupt
  regs.a = 0x01;                                 m.step(0x0669, 7);
  mem.write8(0x8df8, regs.a);                    m.step(0x066c, 13);
  m.ret(10); // 066c ret
}
