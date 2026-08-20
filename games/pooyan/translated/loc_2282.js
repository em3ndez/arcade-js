// SPDX-License-Identifier: GPL-3.0-only

// loc_2282  (ROM 0x2282-0x22b0) -- load motion params for the current phase (0x8f0f):
// 0x8f0e <- table[0x2712] via rst 0x20 (loc_0020); 0x8f10 <- word loc_0c45(0x271c); 0x8f12 <-
// word loc_0c45(0x2730). Then advance the phase byte, clamping 0x09 back to 0x08 (loop the tail).
export function loc_2282(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f0f);        m.step(0x2285, 13);
  regs.hl = 0x2712;                  m.step(0x2288, 10);
  m.push16(0x2289); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 table lookup -> A
  mem.write8(0x8f0e, regs.a);        m.step(0x228c, 13);
  regs.a = mem.read8(0x8f0f);        m.step(0x228f, 13);
  regs.hl = 0x271c;                  m.step(0x2292, 10);
  m.push16(0x2295); m.step(0x0c45, 17); m.call(0x0c45); // DE = word table[0x271c][A]
  mem.write16(0x8f10, regs.de);      m.step(0x2299, 20);
  regs.a = mem.read8(0x8f0f);        m.step(0x229c, 13);
  regs.hl = 0x2730;                  m.step(0x229f, 10);
  m.push16(0x22a2); m.step(0x0c45, 17); m.call(0x0c45); // DE = word table[0x2730][A]
  mem.write16(0x8f12, regs.de);      m.step(0x22a6, 20);
  regs.hl = 0x8f0f;                  m.step(0x22a9, 10);
  regs.incMem8(mem, regs.hl);        m.step(0x22aa, 11); // phase++
  regs.a = mem.read8(regs.hl);       m.step(0x22ab, 7);
  regs.cp(0x09);                     m.step(0x22ad, 7);
  if (regs.fNZ) { m.ret(11); return; } // 22ad  ret nz -- phase < 9
  m.step(0x22ae, 5);
  mem.write8(regs.hl, 0x08);         m.step(0x22b0, 10); // clamp 9 -> 8

  m.ret(10); // 22b0  ret
}
