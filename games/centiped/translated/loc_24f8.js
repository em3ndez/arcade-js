// SPDX-License-Identifier: GPL-3.0-only
// loc_24f8  (ROM 0x24f8-0x24ff) -- decrements $a4,X (X=$88), calls loc_26b8, then falls into loc_24ff.
export function loc_24f8(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x24fa, 3);    // 24f8 ldx $88
  const _a = (0x00a4 + regs.x) & 0xff; mem.write8(_a, regs.dec8(mem.read8(_a))); m.step(0x24fc, 6); // 24fa dec $a4,x
  m.step(0x24ff, 6); m.call(0x26b8);                                    // 24fc jsr $26b8
  return m.call(0x24ff);                                                // fall into loc_24ff
}
