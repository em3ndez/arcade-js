// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_186f  (ROM 0x186F–0x187F) — 0x1644 idx 3: rst-0x18-gated table copy (0x3A1F->0x6908) + selector advance.
 */
export function loc_186f(m) {
  const { regs, mem } = m;
  m.push16(0x1870); m.step(0x0018, 11); if (!m.call(0x0018)) return; // rst 0x18 gate
  regs.hl = 0x3a1f;
  m.step(0x1873, 10); // ld hl,0x3a1f
  m.push16(0x1876); m.step(0x004e, 17); m.call(0x004e); // copy 0x28 bytes -> 0x6908
  regs.a = 0x03;
  m.step(0x1878, 7); // ld a,0x03
  mem.write8(0x6084, regs.a);
  m.step(0x187b, 13); // ld (0x6084),a
  regs.hl = 0x6388;
  m.step(0x187e, 10); // ld hl,0x6388
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance the selector
  m.step(0x187f, 11);
  m.ret();
}
