// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1757  (ROM 0x1757–0x176B) — call 0x306f + 0x176c (cull), then 0x1783 sprite-clear caller-skip; if clear, arm 0x6009=0x40 + advance 0x6388.
 */
export function loc_1757(m) {
  const { regs, mem } = m;
  m.push16(0x175a); m.step(0x306f, 17); m.call(0x306f); // call 0x306f
  m.push16(0x175d); m.step(0x176c, 17); m.call(0x176c); // call 0x176c
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x175e, 6); // inc hl
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x175f, 6); // inc de
  m.push16(0x1762); m.step(0x1783, 17);
  if (!m.call(0x1783)) return; // sub_1783 caller-skip: sprites not clear -> abort
  regs.a = 0x40;
  m.step(0x1764, 7);
  mem.write8(0x6009, regs.a);
  m.step(0x1767, 13);
  regs.hl = 0x6388;
  m.step(0x176a, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x176b, 11); // inc (0x6388)
  m.ret(10);
}
