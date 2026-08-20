// SPDX-License-Identifier: GPL-3.0-only

// loc_1a64  (ROM 0x1a64-0x1a95) -- gameplay-state entry: while the 0x8f50 latch is set it tails to
// loc_1a01; otherwise it runs the reset pair (loc_0f4e, loc_2527), clears 0x89e3, and (credit gate
// 0x8806 open) counts the 0x8908 phase down. On 0 or an already-zero count it tails to loc_1a96;
// else loc_03c2 renders the gauge and 0x880a is seeded 0x0a (0x0b for player 1). Closed gate -> loc_1d3c.
export function loc_1a64(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f50);   m.step(0x1a67, 13);
  regs.and(regs.a);             m.step(0x1a68, 4);
  if (regs.fNZ) {
    m.step(0x1a01, 12);         // latch set -> tail into loc_1a01
    return m.call(0x1a01);
  }
  m.step(0x1a6a, 7);
  m.push16(0x1a6d); m.step(0x0f4e, 17); m.call(0x0f4e);
  m.push16(0x1a70); m.step(0x2527, 17); m.call(0x2527);
  regs.xor(regs.a);             m.step(0x1a71, 4);
  mem.write8(0x89e3, regs.a);   m.step(0x1a74, 13);
  regs.a = mem.read8(0x8806);   m.step(0x1a77, 13);
  regs.and(regs.a);             m.step(0x1a78, 4);
  if (regs.fZ) {
    m.step(0x1d3c, 10);         // credit gate closed -> tail to loc_1d3c
    return m.call(0x1d3c);
  }
  m.step(0x1a7b, 10);
  regs.hl = 0x8908;             m.step(0x1a7e, 10);
  regs.a = mem.read8(regs.hl);  m.step(0x1a7f, 7);
  regs.and(regs.a);             m.step(0x1a80, 4);
  if (regs.fZ) {
    m.step(0x1a96, 12);         // count already 0 -> tail to loc_1a96
    return m.call(0x1a96);
  }
  m.step(0x1a82, 7);
  regs.decMem8(mem, regs.hl);   m.step(0x1a83, 11);
  if (regs.fZ) {
    m.step(0x1a96, 12);         // count reached 0 -> tail to loc_1a96
    return m.call(0x1a96);
  }
  m.step(0x1a85, 7);
  m.push16(0x1a88); m.step(0x03c2, 17); m.call(0x03c2);
  regs.c = 0x0a;                m.step(0x1a8a, 7);
  regs.a = mem.read8(0x880d);   m.step(0x1a8d, 13);
  regs.and(regs.a);             m.step(0x1a8e, 4);
  if (regs.fZ) {
    m.step(0x1a91, 12);         // player 0
  } else {
    m.step(0x1a90, 7);
    regs.c = regs.inc8(regs.c); m.step(0x1a91, 4); // player 1 -> 0x0b
  }
  regs.a = regs.c;              m.step(0x1a92, 4);
  mem.write8(0x880a, regs.a);   m.step(0x1a95, 13);
  return m.ret(10);
}
