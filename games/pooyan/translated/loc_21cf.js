// SPDX-License-Identifier: GPL-3.0-only

// loc_21cf  (ROM 0x21cf-0x2225) -- per-object state step for the iy record. When (iy+7) bit0 is
// set it runs the 0x2204 sub-phase (advance (iy+4) by 4 until 0xe8, seeding (iy+f)). Otherwise it
// primes (iy+0x12)/loc_0ed2 once, and unless (iy+0) bit1 is set (-> boundary 0x2226) it consumes
// a per-object timer cell at 0x8d1b/0x8d1c or decrements (iy+6) by 4; expiring cells fall into the
// 0x221e clear (push iy->hl, blank 0x18 tiles via rst 0x10).
export function loc_21cf(m) {
  const { regs, mem } = m;

  // 0x221e tail: HL <- IY, blank 0x18 tiles at that address (rst 0x10), ret.
  const tail21e = () => {
    m.push16(regs.iy);           m.step(0x2220, 15);
    regs.hl = m.pop16();         m.step(0x2221, 10); // HL = IY
    regs.b = 0x18;               m.step(0x2223, 7);
    regs.xor(regs.a);            m.step(0x2224, 4);
    m.push16(0x2225);
    m.step(0x0010, 11);          // 2224  rst 0x10 (loc_0010)
    m.call(0x0010);
    return m.ret(10);            // 2225  ret
  };

  // 0x2204 sub-phase (reached via jr nz,0x2204): step (iy+4) by 4, seeding (iy+f) on the first tick.
  const path204 = () => {
    regs.a = mem.read8((regs.iy + 0x01) & 0xffff); m.step(0x2207, 19);
    regs.cp(0x01);               m.step(0x2209, 7);
    if (regs.fC) { return m.ret(11); } // ret c
    m.step(0x220a, 5);
    if (regs.fNZ) {
      m.step(0x2213, 12);        // jr nz,0x2213
    } else {
      m.step(0x220c, 7);
      mem.write8((regs.iy + 0x0f) & 0xffff, 0x1b);  m.step(0x2210, 19);
      regs.incMem8(mem, (regs.iy + 0x01) & 0xffff); m.step(0x2213, 23);
    }
    regs.a = mem.read8((regs.iy + 0x04) & 0xffff); m.step(0x2216, 19);
    regs.add(0x04);              m.step(0x2218, 7);
    mem.write8((regs.iy + 0x04) & 0xffff, regs.a); m.step(0x221b, 19);
    regs.cp(0xe8);               m.step(0x221d, 7);
    if (regs.fC) { return m.ret(11); } // ret c
    m.step(0x221e, 5);
    return tail21e();
  };

  regs.bit(0, mem.read8((regs.iy + 0x07) & 0xffff), ((regs.iy + 0x07) >> 8) & 0xff); m.step(0x21d3, 20);
  if (regs.fNZ) { m.step(0x2204, 12); return path204(); } // jr nz,0x2204
  m.step(0x21d5, 7);
  regs.a = mem.read8((regs.iy + 0x12) & 0xffff); m.step(0x21d8, 19);
  regs.and(regs.a);             m.step(0x21d9, 4);
  if (regs.fNZ) {
    m.step(0x21e1, 12);         // jr nz,0x21e1
  } else {
    m.step(0x21db, 7);
    regs.incMem8(mem, (regs.iy + 0x12) & 0xffff); m.step(0x21de, 23);
    m.push16(0x21e1);
    m.step(0x0ed2, 17);         // 21de  call 0x0ed2
    m.call(0x0ed2);
  }
  regs.bit(1, mem.read8(regs.iy), (regs.iy >> 8) & 0xff); m.step(0x21e5, 20);
  if (regs.fNZ) { m.step(0x2226, 12); return m.call(0x2226); } // jr nz,0x2226 (tail -> boundary)
  m.step(0x21e7, 7);
  regs.a = regs.iy & 0xff;      m.step(0x21e9, 8); // ld a,iyl
  regs.bit(3, regs.a);          m.step(0x21eb, 8);
  regs.hl = 0x8d1b;             m.step(0x21ee, 10);
  if (regs.fZ) {
    m.step(0x21f1, 12);         // jr z,0x21f1
  } else {
    m.step(0x21f0, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x21f1, 6);
  }
  regs.a = mem.read8(regs.hl);  m.step(0x21f2, 7);
  regs.and(regs.a);             m.step(0x21f3, 4);
  if (regs.fZ) {
    m.step(0x21f9, 12);         // jr z,0x21f9
  } else {
    m.step(0x21f5, 7);
    mem.write8(regs.hl, 0x00);  m.step(0x21f7, 10);
    m.step(0x221e, 12);         // 21f7  jr 0x221e
    return tail21e();
  }
  regs.a = mem.read8((regs.iy + 0x06) & 0xffff); m.step(0x21fc, 19);
  regs.sub(0x04);               m.step(0x21fe, 7);
  if (regs.fC) { m.step(0x221e, 12); return tail21e(); } // jr c,0x221e
  m.step(0x2200, 7);
  mem.write8((regs.iy + 0x06) & 0xffff, regs.a); m.step(0x2203, 19);
  return m.ret(10);             // 2203  ret
}
