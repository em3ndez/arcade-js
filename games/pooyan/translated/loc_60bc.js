// SPDX-License-Identifier: GPL-3.0-only

// loc_60bc  (ROM 0x60bc-0x6117) -- tail of loc_6080's hit handler (runs on loc_6080's frame).
// Scan the record table at IY (stride DE, count C) for a byte at +0x14 matching A. On a match whose
// state byte +0x16 has bit1 set AND 0x8d44 == 3, flag the I-parity-selected 0x8c90/0x8ca8 pair via
// loc_0f01 and skip-return one frame ABOVE loc_6080 (pop af drops loc_6080's return). Every other
// outcome (scan exhausted, bit1 clear, 0x8d44 != 3) falls to the main path: back HL up 0x14, mark the
// I-parity 0x8d1c slot active, run loc_619f, then tail-jump loc_611f (no push16 -- frame reuse).
export function loc_60bc(m) {
  const { regs, mem } = m;

  let matched = false;
  for (;;) { // 60bc  scan for A == (iy+0x14)
    regs.cp(mem.read8((regs.iy + 0x14) & 0xffff));   m.step(0x60bf, 19);
    if (regs.fZ) { m.step(0x60c8, 12); matched = true; break; } // jr z,0x60c8
    m.step(0x60c1, 7);
    regs.addIy(regs.de);                             m.step(0x60c3, 15);
    regs.c = regs.dec8(regs.c);                      m.step(0x60c4, 4);
    if (regs.fNZ) { m.step(0x60bc, 12); continue; }  // jr nz,0x60bc
    m.step(0x60c6, 7);
    m.step(0x60d5, 12);                              // 60c6  jr 0x60d5 (scan exhausted -> main)
    break;
  }

  if (matched) { // 60c8  inspect the matched record's state bits
    regs.bit(1, mem.read8((regs.iy + 0x16) & 0xffff)); m.step(0x60cc, 20);
    if (regs.fZ) {
      m.step(0x60d5, 12);                            // jr z,0x60d5 -- bit1 clear -> main
    } else {
      m.step(0x60ce, 7);
      regs.a = mem.read8(0x8d44);                    m.step(0x60d1, 13);
      regs.cp(0x03);                                 m.step(0x60d3, 7);
      if (regs.fNZ) {
        m.step(0x60ff, 12);                          // jr nz,0x60ff -- 0x8d44 != 3

        // 60ff  flag the I-parity 0x8c90/0x8ca8 pair, then skip-return
        regs.ix = 0x8c90;                            m.step(0x6103, 14);
        regs.ldAI();                                 m.step(0x6105, 9);
        if (regs.fZ) {
          m.step(0x610b, 12);                        // jr z,0x610b -- keep 0x8c90
        } else {
          m.step(0x6107, 7);
          regs.ix = 0x8ca8;                          m.step(0x610b, 14);
        }
        mem.write8((regs.ix + 0x01) & 0xffff, 0x01); m.step(0x610f, 19);
        mem.write8((regs.ix + 0x07) & 0xffff, 0x01); m.step(0x6113, 19);
        m.push16(0x6116);
        m.step(0x0f01, 17);                          // 6113  call 0x0f01
        m.call(0x0f01);
        regs.af = m.pop16();                         m.step(0x6117, 10); // 6116  pop af -- drop loc_6080's return
        m.ret(10); // 6117  ret -- lands one frame above loc_6080 (skip-return)
        return;
      }
      m.step(0x60d5, 7);                             // 0x8d44 == 3 -> main
    }
  }

  // 60d5  main path
  regs.de = 0xffec;                                  m.step(0x60d8, 10);
  regs.addHl(regs.de);                               m.step(0x60d9, 11);
  regs.iy = 0x8d1c;                                  m.step(0x60dd, 14);
  regs.ldAI();                                       m.step(0x60df, 9);
  if (regs.fNZ) {
    m.step(0x60e3, 12);                              // jr nz,0x60e3 -- keep 0x8d1c
  } else {
    m.step(0x60e1, 7);
    regs.iy = (regs.iy - 1) & 0xffff;                m.step(0x60e3, 10); // dec iy
  }
  mem.write8((regs.iy + 0x00) & 0xffff, 0x01);       m.step(0x60e7, 19);
  regs.de = 0x0404;                                  m.step(0x60ea, 10);
  m.push16(0x60ed);
  m.step(0x619f, 17);                                // 60ea  call 0x619f
  m.call(0x619f);
  regs.de = 0xfffd;                                  m.step(0x60f0, 10);
  m.step(0x611f, 12);                                // 60f0  jr 0x611f (tail)
  return m.call(0x611f);
}
