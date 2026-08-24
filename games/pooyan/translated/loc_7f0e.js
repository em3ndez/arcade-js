// SPDX-License-Identifier: GPL-3.0-only

// loc_7f0e  (ROM 0x7f0e-0x7f5c) -- 7e94 write-anim dispatch entry 1. Decrement the 16-bit counter
// (0x8e2b); when it hits zero jp 0x7fa8 (tail). Otherwise, at loc_7f20 the byte at *(0x8e21) selects
// a phase: bit 3 set -> loc_7f42 (index counts DOWN, wrap below 0x10 -> 0x2c); bit 2 clear -> tail jr
// into 0x7f5d; else count the index UP at 0x7f2b, wrapping 0x2d -> 0x10. Both index paths tick a 0x0c
// reload at 0x8e24 (`ret nz` while it counts), then at loc_7f57 store the index byte through *(0x8e27)
// and fall through into loc_7f5d (tail delegation).
export function loc_7f0e(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x8e2b); m.step(0x7f11, 16);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x7f12, 6);   // dec hl
  mem.write16(0x8e2b, regs.hl); m.step(0x7f15, 16);
  regs.a = regs.h; m.step(0x7f16, 4);
  regs.and(regs.a); m.step(0x7f17, 4);
  if (regs.fZ) {
    m.step(0x7f19, 7);
    regs.a = regs.l; m.step(0x7f1a, 4);
    regs.and(regs.a); m.step(0x7f1b, 4);
    if (regs.fZ) {
      m.step(0x7f1d, 7);
      m.step(0x7fa8, 10); return m.call(0x7fa8);   // jp 0x7fa8 -- counter expired (tail)
    }
    m.step(0x7f20, 12);
  } else {
    m.step(0x7f20, 12);
  }

  // loc_7f20
  regs.hl = mem.read16(0x8e21); m.step(0x7f23, 16);
  regs.bit(3, mem.read8(regs.hl)); m.step(0x7f25, 12);
  if (regs.fNZ) {
    m.step(0x7f42, 12);
    // loc_7f42 -- index counts DOWN
    regs.hl = 0x8e24; m.step(0x7f45, 10);
    regs.decMem8(mem, regs.hl); m.step(0x7f46, 11);
    if (regs.fNZ) { m.ret(11); return; }           // ret nz -- reload still counting
    m.step(0x7f47, 5);
    regs.a = 0x0c; m.step(0x7f49, 7);
    mem.write8(0x8e24, regs.a); m.step(0x7f4c, 13);
    regs.hl = 0x8e23; m.step(0x7f4f, 10);
    regs.decMem8(mem, regs.hl); m.step(0x7f50, 11);
    regs.a = mem.read8(regs.hl); m.step(0x7f51, 7);
    regs.cp(0x10); m.step(0x7f53, 7);
    if (regs.fNC) {
      m.step(0x7f57, 12);
    } else {
      m.step(0x7f55, 7);
      mem.write8(regs.hl, 0x2c); m.step(0x7f57, 10);   // wrap up
    }
  } else {
    m.step(0x7f27, 7);
    regs.bit(2, mem.read8(regs.hl)); m.step(0x7f29, 12);
    if (regs.fZ) {
      m.step(0x7f5d, 12); return m.call(0x7f5d);    // jr z,0x7f5d -- bit 2 clear (tail)
    }
    m.step(0x7f2b, 7);
    // 0x7f2b (loc_7f20 continued) -- index counts UP
    regs.hl = 0x8e24; m.step(0x7f2e, 10);
    regs.decMem8(mem, regs.hl); m.step(0x7f2f, 11);
    if (regs.fNZ) { m.ret(11); return; }           // ret nz -- reload still counting
    m.step(0x7f30, 5);
    regs.a = 0x0c; m.step(0x7f32, 7);
    mem.write8(0x8e24, regs.a); m.step(0x7f35, 13);
    regs.hl = 0x8e23; m.step(0x7f38, 10);
    regs.incMem8(mem, regs.hl); m.step(0x7f39, 11);
    regs.a = mem.read8(regs.hl); m.step(0x7f3a, 7);
    regs.cp(0x2d); m.step(0x7f3c, 7);
    if (regs.fC) {
      m.step(0x7f57, 12);
    } else {
      m.step(0x7f3e, 7);
      mem.write8(regs.hl, 0x10); m.step(0x7f40, 10);   // wrap down
      m.step(0x7f57, 12);
    }
  }

  // loc_7f57 -- store the index byte through *(0x8e27), then fall into loc_7f5d
  regs.bc = mem.read16(0x8e27); m.step(0x7f5b, 20);
  regs.a = mem.read8(regs.hl); m.step(0x7f5c, 7);
  mem.write8(regs.bc, regs.a); m.step(0x7f5d, 7);
  return m.call(0x7f5d);                            // fall-through into loc_7f5d (tail)
}
