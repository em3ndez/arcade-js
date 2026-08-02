// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2ad3  (ROM 0x2AD3–0x2B1B) — platform-row player mover: Y==0x50/0x78/0xC8 -> pick velocity, X+=vel, clamp via 0x241F, edge-adjust.
 */
export function loc_2ad3(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6203);
  m.step(0x2ad6, 13);
  regs.b = regs.a;
  m.step(0x2ad7, 4); // B = X
  regs.a = mem.read8(0x6205);
  m.step(0x2ada, 13);
  regs.cp(0x50);
  m.step(0x2adc, 7);
  if (regs.fZ) {
    m.step(0x2aea, 10);
    regs.a = mem.read8(0x63a3);
    m.step(0x2aed, 13);
    m.step(0x2b02, 10);
    return m.call(0x2b02);
  }
  m.step(0x2adf, 10);
  regs.cp(0x78);
  m.step(0x2ae1, 7);
  if (regs.fZ) { m.step(0x2af6, 10); return m.call(0x2af6); }
  m.step(0x2ae4, 10);
  regs.cp(0xc8);
  m.step(0x2ae6, 7);
  if (regs.fZ) {
    m.step(0x2af0, 10);
    regs.a = mem.read8(0x63a6);
    m.step(0x2af3, 13);
    m.step(0x2b02, 10);
    return m.call(0x2b02);
  }
  m.step(0x2ae9, 10);
  m.ret(10); // Y not on a platform row
}
