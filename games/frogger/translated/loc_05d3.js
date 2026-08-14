// SPDX-License-Identifier: GPL-3.0-only

// loc_05d3  (ROM 0x05D3-0x05EF) — set the 2-player / demo start flags: (0x826d)=(0x825a)=(0x83cd)=1,
// (0x825b)=(0x83ea)=0, (0x8297)=0xff, (0x8298)=0x40. Leaf; reached from the loc_0066 NMI handler.
export function loc_05d3(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x05d5, 7);
  mem.write8(0x826d, regs.a);
  m.step(0x05d8, 13);
  mem.write8(0x825a, regs.a);
  m.step(0x05db, 13);
  mem.write8(0x83cd, regs.a);
  m.step(0x05de, 13);

  regs.xor(regs.a);
  m.step(0x05df, 4); // A = 0
  mem.write8(0x825b, regs.a);
  m.step(0x05e2, 13);
  mem.write8(0x83ea, regs.a);
  m.step(0x05e5, 13);

  regs.a = 0xff;
  m.step(0x05e7, 7);
  mem.write8(0x8297, regs.a);
  m.step(0x05ea, 13);

  regs.a = 0x40;
  m.step(0x05ec, 7);
  mem.write8(0x8298, regs.a);
  m.step(0x05ef, 13);

  m.ret();
}
