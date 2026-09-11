// SPDX-License-Identifier: GPL-3.0-only
// loc_df75  (ROM 0xdf75-0xdf91) -- sign-extend and double two values: A<<1 -> $6e/$6f (16-bit, hi carries
// the shifted-out sign via dey), X<<1 -> $70/$71 likewise, then X=$6e; falls into loc_df92.
export function loc_df75(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf77, 2);
  regs.a = regs.asl(regs.a); m.step(0xdf78, 2);
  if (regs.fNC) { m.step(0xdf7b, 3); }
  else { m.step(0xdf7a, 2); regs.y = regs.dec8(regs.y); m.step(0xdf7b, 2); }
  mem.write8(0x6f, regs.y); m.step(0xdf7d, 3);
  regs.a = regs.asl(regs.a); m.step(0xdf7e, 2);
  mem.write8(0x6f, regs.rol(mem.read8(0x6f))); m.step(0xdf80, 5);
  mem.write8(0x6e, regs.a); m.step(0xdf82, 3);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xdf83, 2);
  regs.a = regs.asl(regs.a); m.step(0xdf84, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf86, 2);
  if (regs.fNC) { m.step(0xdf89, 3); }
  else { m.step(0xdf88, 2); regs.y = regs.dec8(regs.y); m.step(0xdf89, 2); }
  mem.write8(0x71, regs.y); m.step(0xdf8b, 3);
  regs.a = regs.asl(regs.a); m.step(0xdf8c, 2);
  mem.write8(0x71, regs.rol(mem.read8(0x71))); m.step(0xdf8e, 5);
  mem.write8(0x70, regs.a); m.step(0xdf90, 3);
  regs.x = 0x6e; regs.setNZ(regs.x); m.step(0xdf92, 2);
  return m.call(0xdf92);
}
