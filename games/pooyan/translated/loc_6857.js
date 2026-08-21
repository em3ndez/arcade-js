// SPDX-License-Identifier: GPL-3.0-only

// loc_6857  (ROM 0x6857-0x68a2) -- object ascent step. Runs the sequencer loc_4006, then subtracts
// (ix+9) from the 16-bit position (ix+5):(ix+6). While (ix+6) < 0x1b it keeps going; at/over 0x1b it
// rets early. Otherwise it advances state (ix+2) and runs a two-pass checksum over the 0x86bc tile
// block (0x08 bytes forward at -0x20 stride, then 0x08 bytes at h-4 with +0x20 stride) accumulated in
// C; if the trailing (de) byte + C is non-zero it tails to loc_08b3, else appends de=0x0613 via rst 0x38.
export function loc_6857(m) {
  const { regs, mem } = m;

  m.push16(0x685a); m.step(0x4006, 17); m.call(0x4006);

  regs.a = mem.read8((regs.ix + 5) & 0xffff);   m.step(0x685d, 19);
  regs.sub(mem.read8((regs.ix + 9) & 0xffff));  m.step(0x6860, 19);
  if (regs.fNC) {
    m.step(0x6865, 12);
  } else {
    m.step(0x6862, 7);
    regs.decMem8(mem, (regs.ix + 6) & 0xffff);  m.step(0x6865, 23); // borrow
  }
  mem.write8((regs.ix + 5) & 0xffff, regs.a);   m.step(0x6868, 19);
  regs.a = mem.read8((regs.ix + 6) & 0xffff);   m.step(0x686b, 19);
  regs.cp(0x1b);                                m.step(0x686d, 7);
  if (regs.fNC) { m.ret(11); return; }          // 686d  ret nc -- reached the top
  m.step(0x686e, 5);

  regs.incMem8(mem, (regs.ix + 2) & 0xffff);    m.step(0x6871, 23);
  regs.hl = 0x86bc;                             m.step(0x6874, 10);
  regs.de = 0x68a3;                             m.step(0x6877, 10);
  regs.bc = 0x0800;                             m.step(0x687a, 10);

  for (;;) { // 687a: pass 1 -- 8 bytes, -0x20 stride
    regs.a = mem.read8(regs.de);                m.step(0x687b, 7);
    regs.add(mem.read8(regs.hl));               m.step(0x687c, 7);
    regs.add(regs.c);                           m.step(0x687d, 4);
    regs.c = regs.a;                            m.step(0x687e, 4);
    regs.de = (regs.de + 1) & 0xffff;           m.step(0x687f, 6);
    regs.a = regs.l;                            m.step(0x6880, 4);
    regs.sub(0x20);                             m.step(0x6882, 7);
    if (regs.fNC) {
      m.step(0x6885, 12);
    } else {
      m.step(0x6884, 7);
      regs.h = regs.dec8(regs.h);               m.step(0x6885, 4); // borrow
    }
    regs.l = regs.a;                            m.step(0x6886, 4);
    if (regs.djnz() !== 0) { m.step(0x687a, 13); continue; }
    m.step(0x6888, 8);
    break;
  }

  regs.b = 0x08;                                m.step(0x688a, 7);
  regs.a = regs.h;                              m.step(0x688b, 4);
  regs.sub(0x04);                               m.step(0x688d, 7);
  regs.h = regs.a;                              m.step(0x688e, 4);

  for (;;) { // 688e: pass 2 -- 8 bytes, +0x20 stride
    regs.a = mem.read8(regs.hl);                m.step(0x688f, 7);
    regs.add(regs.c);                           m.step(0x6890, 4);
    regs.c = regs.a;                            m.step(0x6891, 4);
    regs.a = regs.l;                            m.step(0x6892, 4);
    regs.add(0x20);                             m.step(0x6894, 7);
    if (regs.fNC) {
      m.step(0x6897, 12);
    } else {
      m.step(0x6896, 7);
      regs.h = regs.inc8(regs.h);               m.step(0x6897, 4); // carry
    }
    if (regs.djnz() !== 0) { m.step(0x688e, 13); continue; }
    m.step(0x6899, 8);
    break;
  }

  regs.a = mem.read8(regs.de);                  m.step(0x689a, 7);
  regs.add(regs.c);                             m.step(0x689b, 4);
  if (regs.fNZ) {
    m.step(0x08b3, 10); // checksum non-zero -> tail to loc_08b3
    return m.call(0x08b3);
  }
  m.step(0x689e, 10);
  regs.de = 0x0613;                             m.step(0x68a1, 10);
  m.push16(0x68a2); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 -- append de
  m.ret(); // 68a2  ret
}
