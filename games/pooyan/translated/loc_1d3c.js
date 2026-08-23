// SPDX-License-Identifier: GPL-3.0-only

// loc_1d3c  (ROM 0x1d3c-0x1d6d) -- cold-teardown tail of the 0x15a8 dispatch handler, a distinct
// routine (delegated to by loc_1d15 at `jr z,0x1d3c`, and the credit-gate-closed tail of loc_1a01
// / loc_1a64). Zeroes the 0x8806/0x880a/0x880d/0x880e/0x8e51 state block, sets 0x8805=1 /
// 0x881f=1 / 0x8f3f=1, runs loc_02b9 + loc_0ecf, then copies the 0x1e4c table (each byte >>1)
// into 0x89f0.. until the 0x7f terminator.
export function loc_1d3c(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);            m.step(0x1d3d, 4);
  mem.write8(0x8806, regs.a);  m.step(0x1d40, 13);
  mem.write8(0x880a, regs.a);  m.step(0x1d43, 13);
  mem.write8(0x880d, regs.a);  m.step(0x1d46, 13);
  mem.write8(0x880e, regs.a);  m.step(0x1d49, 13);
  mem.write8(0x8e51, regs.a);  m.step(0x1d4c, 13);
  regs.a = regs.inc8(regs.a);  m.step(0x1d4d, 4);
  mem.write8(0x8805, regs.a);  m.step(0x1d50, 13);
  mem.write8(0x881f, regs.a);  m.step(0x1d53, 13);
  mem.write8(0x8f3f, regs.a);  m.step(0x1d56, 13);
  m.push16(0x1d59); m.step(0x02b9, 17); m.call(0x02b9);
  m.push16(0x1d5c); m.step(0x0ecf, 17); m.call(0x0ecf);
  regs.de = 0x1e4c;            m.step(0x1d5f, 10);
  regs.hl = 0x89f0;            m.step(0x1d62, 10);
  for (;;) {                                         // copy 0x1e4c table >>1 into 0x89f0.. until 0x7f
    regs.a = mem.read8(regs.de);  m.step(0x1d63, 7);
    regs.cp(0x7f);                m.step(0x1d65, 7);
    if (regs.fZ) { return m.ret(11); }               // ret z -- 0x7f terminator
    m.step(0x1d66, 5);
    regs.a = regs.srl(regs.a);    m.step(0x1d68, 8);
    mem.write8(regs.hl, regs.a);  m.step(0x1d69, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1d6a, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1d6b, 6);
    m.step(0x1d62, 12);
  }
  // 0x1d6d ret is unreachable: the 0x1d6b jr is unconditional; the loop exits only via the ret z above.
}
