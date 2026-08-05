// SPDX-License-Identifier: GPL-3.0-only

// loc_0010  (ROM 0x0010-0x0016) — RST 0x10: fetch a word from a table indexed by A.
export function loc_0010(m) {
  const { regs, mem } = m;

  regs.add(regs.a);
  m.step(0x0011, 4); // add a,a

  m.push16(0x0012);
  m.step(0x0018, 11); // rst 0x18
  m.call(0x0018);

  regs.e = mem.read8(regs.hl);
  m.step(0x0013, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0014, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0015, 7); // ld d,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0016, 6); // inc hl
  m.ret(); // 0016  ret
}
