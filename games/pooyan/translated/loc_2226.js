// SPDX-License-Identifier: GPL-3.0-only

// loc_2226  (ROM 0x2226-0x2280) -- advance a two-axis moving object. When the 0x8f0e phase counter
// hits 0, reload the motion params via loc_2282. Integrate X velocity (0x8f10) into (iy+5:iy+6):
// direction from iyl bit3 (picks table byte 0x8d19/0x8d1a) bit0 -> add hl,de else sbc hl,de. Integrate
// Y velocity (0x8f12) into (iy+3:iy+4); if the Y high byte reaches >= 0xe8 the object is spent -> clear
// its scratch state (0x8f0e/0f/30, 0x8d45/77, 0x8f3f) and tail-jump to the clear helper 0x221e; else
// store the new Y and decrement the phase counter.
export function loc_2226(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f0e);                     m.step(0x2229, 13);
  regs.and(regs.a);                               m.step(0x222a, 4);
  if (regs.fZ) {
    m.push16(0x222d); m.step(0x2282, 17); m.call(0x2282); // call z,0x2282 -- reload params
  } else {
    m.step(0x222d, 10);                           // call z not taken
  }

  regs.de = mem.read16(0x8f10);                   m.step(0x2231, 20);
  regs.a = regs.iy & 0xff;                        m.step(0x2233, 8);  // ld a,iyl
  regs.bit(3, regs.a);                            m.step(0x2235, 8);
  regs.l = mem.read8((regs.iy + 0x05) & 0xffff);  m.step(0x2238, 19);
  regs.h = mem.read8((regs.iy + 0x06) & 0xffff);  m.step(0x223b, 19);
  regs.bc = 0x8d19;                               m.step(0x223e, 10);
  if (regs.fZ) {
    m.step(0x2241, 12);                           // jr z,0x2241 (iyl bit3 clear)
  } else {
    m.step(0x2240, 7);
    regs.bc = (regs.bc + 1) & 0xffff;             m.step(0x2241, 6);  // inc bc
  }
  regs.a = mem.read8(regs.bc);                    m.step(0x2242, 7);
  regs.bit(0, regs.a);                            m.step(0x2244, 8);
  if (regs.fZ) {
    m.step(0x2249, 12);                           // jr z,0x2249 -- subtract
    regs.sbcHl(regs.de);                          m.step(0x224b, 15);
  } else {
    m.step(0x2246, 7);
    regs.addHl(regs.de);                          m.step(0x2247, 11);
    m.step(0x224b, 12);                           // jr 0x224b
  }
  mem.write8((regs.iy + 0x05) & 0xffff, regs.l);  m.step(0x224e, 19);
  mem.write8((regs.iy + 0x06) & 0xffff, regs.h);  m.step(0x2251, 19);

  regs.de = mem.read16(0x8f12);                   m.step(0x2255, 20);
  regs.l = mem.read8((regs.iy + 0x03) & 0xffff);  m.step(0x2258, 19);
  regs.h = mem.read8((regs.iy + 0x04) & 0xffff);  m.step(0x225b, 19);
  regs.addHl(regs.de);                            m.step(0x225c, 11);
  regs.a = regs.h;                                m.step(0x225d, 4);
  regs.cp(0xe8);                                  m.step(0x225f, 7);
  if (regs.fNC) {
    m.step(0x226c, 12);                           // jr nc,0x226c -- Y high >= 0xe8, object spent
    regs.xor(regs.a);                             m.step(0x226d, 4);
    mem.write8(0x8f0e, regs.a);                   m.step(0x2270, 13);
    mem.write8(0x8f0f, regs.a);                   m.step(0x2273, 13);
    mem.write8(0x8f30, regs.a);                   m.step(0x2276, 13);
    mem.write8(0x8d45, regs.a);                   m.step(0x2279, 13);
    mem.write8(0x8d77, regs.a);                   m.step(0x227c, 13);
    mem.write8(0x8f3f, regs.a);                   m.step(0x227f, 13);
    m.step(0x221e, 12);                           // 227f  jr 0x221e (tail; boundary)
    return m.call(0x221e);
  }

  m.step(0x2261, 7);                              // jr nc not taken -- keep moving
  mem.write8((regs.iy + 0x03) & 0xffff, regs.l);  m.step(0x2264, 19);
  mem.write8((regs.iy + 0x04) & 0xffff, regs.h);  m.step(0x2267, 19);
  regs.hl = 0x8f0e;                               m.step(0x226a, 10);
  regs.decMem8(mem, regs.hl);                     m.step(0x226b, 11);

  m.ret(10); // 226b  ret
}
