// SPDX-License-Identifier: GPL-3.0-only

// loc_3e6c  (ROM 0x3E6C–0x3E7D)
export function loc_3e6c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x3e6f, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x3e71, 7); // cp 0x04

  if (regs.fZ) {
    m.push16(0x3e74);
    m.step(0x3e7e, 17); // call z,0x3e7e (taken)
    m.call(0x3e7e);
  } else {
    m.step(0x3e74, 10); // call z,0x3e7e (not taken)
  }

  m.push16(0x3e77);
  m.step(0x3e05, 17); // call 0x3e05
  m.call(0x3e05);

  m.push16(0x3e7a);
  m.step(0x2b83, 17); // call 0x2b83 -- verdict comes back in CARRY
  m.call(0x2b83);

  if (regs.fNC) {
    m.ret(11); // ret nc (taken)
    return;
  }
  m.step(0x3e7b, 5); // ret nc (not taken)

  m.step(0x40ab, 10);
  return m.call(0x40ab);
}
