// SPDX-License-Identifier: GPL-3.0-only
// loc_df09  (ROM 0xdf09-0xdf0c) -- presets A=0xc0 then bne into loc_df0d at $df12 (the shared header tail).
export function loc_df09(m) {
  const { regs, mem } = m;
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xdf0b, 2);
  if (regs.fNZ) { m.step(0xdf12, 3); return m.call(0xdf12); }
  m.step(0xdf0d, 2); return m.call(0xdf0d);
}
