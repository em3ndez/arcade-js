// SPDX-License-Identifier: GPL-3.0-only
// loc_050f (ROM 0x050f-0x054f) -- object step handler (tail-jump target from the 0x068e dispatch).
// Primes a strip (call 0x0550), snapshots 0x2046/0x2036, steps it (call 0x0563), clamps 0x2076 at
// 0x15, then either tail-delegates to loc_055b or blits via loc_1a32 and stores 0x2076 -> 0x2058
// before returning. m.step targets carry every landing address.
export function loc_050f(m) {
  const { regs, mem } = m;

  regs.de = 0x2055; m.step(0x0512, 10);
  regs.a = 0xdb; m.step(0x0514, 7);
  m.push16(0x0517); m.step(0x0550, 17); m.call(0x0550);
  regs.a = mem.read8(0x2046); m.step(0x051a, 13);
  mem.write8(0x2070, regs.a); m.step(0x051d, 13);
  regs.a = mem.read8(0x2036); m.step(0x0520, 13);
  mem.write8(0x2071, regs.a); m.step(0x0523, 13);
  m.push16(0x0526); m.step(0x0563, 17); m.call(0x0563);
  regs.a = mem.read8(0x2076); m.step(0x0529, 13);
  regs.cp(0x15); m.step(0x052b, 7);
  if (!regs.fC) {                                   // jc 0x0534 not taken: clamp 0x2076
    m.step(0x052e, 10);
    regs.a = mem.read8(0x1b58); m.step(0x0531, 13);
    mem.write8(0x2076, regs.a); m.step(0x0534, 13);
  } else {
    m.step(0x0534, 10);
  }
  regs.a = mem.read8(0x2078); m.step(0x0537, 13);  // loc_0534
  regs.and(regs.a); m.step(0x0538, 4);             // ana a
  regs.hl = 0x2055; m.step(0x053b, 10);
  if (regs.fNZ) {                                   // jnz 0x055b: tail-delegate
    m.step(0x055b, 10);
    return m.call(0x055b);
  }
  m.step(0x053e, 10);
  regs.de = 0x1b50; m.step(0x0541, 10);
  regs.hl = 0x2050; m.step(0x0544, 10);
  regs.b = 0x10; m.step(0x0546, 7);
  m.push16(0x0549); m.step(0x1a32, 17); m.call(0x1a32);
  regs.hl = mem.read16(0x2076); m.step(0x054c, 16);
  mem.write16(0x2058, regs.hl); m.step(0x054f, 16); // shld 0x2058
  return m.ret(10);
}
