// SPDX-License-Identifier: GPL-3.0-only
// loc_0476 (ROM 0x0476-0x04b5) -- object handler reached via dispatch (`pop h` drops the
// dispatcher's return addr). If the 0x2038 countdown is nonzero it decrements + rets; else it
// primes a strip (call 0x0550), snapshots 0x2046/0x2056, steps it (call 0x0563), then either
// tail-delegates to loc_055b or blits via loc_1a32. m.step targets carry every landing address.
export function loc_0476(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); m.step(0x0477, 10);
  regs.a = mem.read8(0x1b32); m.step(0x047a, 13);
  mem.write8(0x2032, regs.a); m.step(0x047d, 13);
  regs.hl = mem.read16(0x2038); m.step(0x0480, 16);
  regs.a = regs.l; m.step(0x0481, 5);
  regs.or(regs.h); m.step(0x0482, 4);
  if (!regs.fNZ) {                                  // jnz 0x048a not taken: HL == 0
    m.step(0x0485, 10);
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0486, 5); // dcx h
    mem.write16(0x2038, regs.hl); m.step(0x0489, 16);    // shld 0x2038
    return m.ret(10);
  }
  m.step(0x048a, 10);
  regs.de = 0x2035; m.step(0x048d, 10);             // loc_048a
  regs.a = 0xf9; m.step(0x048f, 7);
  m.push16(0x0492); m.step(0x0550, 17); m.call(0x0550);
  regs.a = mem.read8(0x2046); m.step(0x0495, 13);
  mem.write8(0x2070, regs.a); m.step(0x0498, 13);
  regs.a = mem.read8(0x2056); m.step(0x049b, 13);
  mem.write8(0x2071, regs.a); m.step(0x049e, 13);
  m.push16(0x04a1); m.step(0x0563, 17); m.call(0x0563);
  regs.a = mem.read8(0x2078); m.step(0x04a4, 13);
  regs.and(regs.a); m.step(0x04a5, 4);             // ana a
  regs.hl = 0x2035; m.step(0x04a8, 10);
  if (regs.fNZ) {                                   // jnz 0x055b: tail-delegate
    m.step(0x055b, 10);
    return m.call(0x055b);
  }
  m.step(0x04ab, 10);
  regs.de = 0x1b30; m.step(0x04ae, 10);
  regs.hl = 0x2030; m.step(0x04b1, 10);
  regs.b = 0x10; m.step(0x04b3, 7);
  m.step(0x1a32, 10);                               // jmp 0x1a32
  return m.call(0x1a32);
}
