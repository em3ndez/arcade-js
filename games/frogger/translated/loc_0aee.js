// SPDX-License-Identifier: GPL-3.0-only

// loc_0aee  (ROM 0x0AEE-0x0B09) — ring XOR step in the 0x8400 work-RAM buffer: decrement the cursor at
// (0x8400), wrapping 0->0x1F; then (0x8400+j) ^= (0x8400+cursor), with j = cursor+0x0D folded back below
// 0x20 by -0x1F. Leaf; HL and DE are saved and restored. Shared by the IX sprite arms.
export function loc_0aee(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x0aef, 11);
  m.push16(regs.de);
  m.step(0x0af0, 11);
  regs.hl = 0x8400;
  m.step(0x0af3, 10);
  regs.decMem8(mem, regs.hl); // dec (0x8400) -- the cursor
  m.step(0x0af4, 11);
  if (regs.fNZ) {
    m.step(0x0af8, 12);
    return block_0af8();
  }
  m.step(0x0af6, 7);
  mem.write8(regs.hl, 0x1f); // wrap 0 -> 0x1F
  m.step(0x0af8, 10);
  return block_0af8();

  function block_0af8() {
    regs.d = regs.h; // DE = 0x8400 + cursor
    m.step(0x0af9, 4);
    regs.e = mem.read8(regs.hl);
    m.step(0x0afa, 7);
    regs.a = regs.e;
    m.step(0x0afb, 4);
    regs.add(0x0d);
    m.step(0x0afd, 7); // A = cursor + 0x0D
    regs.cp(0x20);
    m.step(0x0aff, 7);
    if (regs.fC) {
      m.step(0x0b03, 12);
      return block_0b03();
    }
    m.step(0x0b01, 7);
    regs.sub(0x1f); // fold below 0x20
    m.step(0x0b03, 7);
    return block_0b03();
  }

  function block_0b03() {
    regs.l = regs.a; // HL = 0x8400 + j
    m.step(0x0b04, 4);
    regs.a = mem.read8(regs.de); // (0x8400 + cursor)
    m.step(0x0b05, 7);
    regs.xor(mem.read8(regs.hl)); // ^= (0x8400 + j)
    m.step(0x0b06, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x0b07, 7);
    regs.de = m.pop16();
    m.step(0x0b08, 10);
    regs.hl = m.pop16();
    m.step(0x0b09, 10);
    m.ret();
  }
}
