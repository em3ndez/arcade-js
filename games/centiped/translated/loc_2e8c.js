// SPDX-License-Identifier: GPL-3.0-only
// loc_2e8c  (ROM 0x2e8c-0x2e94) -- stores the new head velocity into $60/$8b, then branches on its zero-ness.
export function loc_2e8c(m) {
  const { regs, mem } = m;
  mem.write8(0x0060, regs.a); m.step(0x2e8e, 3);                     // 2e8c sta $60
  mem.write8(0x008b, regs.a); m.step(0x2e90, 3);                     // 2e8e sta $8b
  if (regs.fNZ) { m.step(0x2e9d, 3); return m.call(0x2e9d); }        // 2e90 bne $2e9d
  m.step(0x2e92, 2);
  if (regs.fZ) { m.step(0x2e9a, 3); m.step(0x20e8, 3); return m.call(0x20e8); } // 2e92 beq $2e9a (-> jmp $20e8)
  m.step(0x2e94, 2); return m.call(0x2e94);                          // beq not taken -> fall into loc_2e94
}
