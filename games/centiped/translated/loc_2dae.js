// SPDX-License-Identifier: GPL-3.0-only
// loc_2dae  (ROM 0x2dae-0x2db6) -- decrements the $94,X delay counter for object $88, then falls into loc_2db6.
export function loc_2dae(m) {
  const { regs, mem } = m;
  mem.write8(0x008d, regs.x); m.step(0x2db0, 3);                                                        // 2dae stx $8d
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2db2, 3);                                    // 2db0 ldx $88
  mem.write8((0x94 + regs.x) & 0xff, regs.dec8(mem.read8((0x94 + regs.x) & 0xff))); m.step(0x2db4, 6);  // 2db2 dec $94,x
  regs.x = mem.read8(0x008d); regs.setNZ(regs.x); m.step(0x2db6, 3);                                    // 2db4 ldx $8d
  return m.call(0x2db6);                                                                                // fall through into loc_2db6
}
