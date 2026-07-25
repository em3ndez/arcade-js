// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1670  (ROM 0x1670–0x1689) — rst-0x18 gate, copy 0x3932->0x6908, arm 0x6009=0x20, advance 0x6388, rst-0x30 gate, rst 0x38.
 */
export function sub_1670(m) {
  const { regs, mem } = m;
  m.push16(0x1671); m.step(0x0018, 11); if (!m.call(0x0018)) return; // rst 0x18
  regs.hl = 0x3932;
  m.step(0x1674, 10); // ld hl,0x3932
  m.push16(0x1677); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.a = 0x20;
  m.step(0x1679, 7); // ld a,0x20
  mem.write8(0x6009, regs.a);
  m.step(0x167c, 13); // ld (0x6009),a
  regs.hl = 0x6388;
  m.step(0x167f, 10); // ld hl,0x6388
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x1680, 11); // inc (0x6388)
  regs.a = 0x04;
  m.step(0x1682, 7); // ld a,0x04
  m.push16(0x1683); m.step(0x0030, 11); if (!m.call(0x0030)) return; // rst 0x30 caller-skip
  regs.hl = 0x690b;
  m.step(0x1686, 10); // ld hl,0x690b
  regs.c = 0x04;
  m.step(0x1688, 7); // ld c,0x04
  m.push16(0x1689); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  m.ret(10);
}
