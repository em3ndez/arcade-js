// SPDX-License-Identifier: GPL-3.0-only

// loc_0000  (ROM 0x0000-0x0006) — the Z80 RESET vector: clear A, clear the irq_enable latch (0x7001)
// so the vblank NMI is off during cold boot, then tail-jump into the cold-boot init at 0x1a55.
//   0000  af        xor a
//   0001  32 01 70  ld (0x7001),a
//   0004  c3 55 1a  jp 0x1a55
export function loc_0000(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0001, 4); // xor a -- A=0

  mem.write8(0x7001, regs.a, 10);
  m.step(0x0004, 13); // ld (0x7001),a -- clear irq_enable (NMI off during boot)

  // jp 0x1a55 -- tail-jump into cold-boot init (pushes nothing; 0x1a55's flow is ours)
  m.step(0x1a55, 10);
  return m.call(0x1a55);
}
