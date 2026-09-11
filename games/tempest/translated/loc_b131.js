// SPDX-License-Identifier: GPL-3.0-only
// loc_b131 (ROM 0xb131-0xb159) -- jsr $b15a (committed delegate) with A=$3f/X=$4e, then clamps two
// bytes: $014d is decremented while >= $30 (early rts once the result is >= $80), and $014e is stepped
// down toward but not below $014d. cmp #$30 leaves carry set for the following sbc #$01 (no clc -- faithful).
export function loc_b131(m) {
  const { regs, mem } = m;
  regs.a = 0x3f; regs.setNZ(regs.a); m.step(0xb133, 2);
  regs.x = 0x4e; regs.setNZ(regs.x); m.step(0xb135, 2);
  m.push16(0xb137); m.step(0xb138, 6); m.call(0xb15a); // jsr $b15a (pushes 0xb135+2)
  regs.a = mem.read8(0x014d); regs.setNZ(regs.a); m.step(0xb13b, 4);
  regs.cmp(0x30); m.step(0xb13d, 2);
  if (!regs.fC) { m.step(0xb144, 3); } // bcc taken -> $014d already < $30
  else {
    m.step(0xb13f, 2);
    regs.sbc(0x01); m.step(0xb141, 2); // uses carry set by cmp #$30
    mem.write8(0x014d, regs.a); m.step(0xb144, 4);
  }
  regs.cmp(0x80); m.step(0xb146, 2);
  if (regs.fC) { m.step(0xb159, 3); return m.ret(6); } // bcs taken -> rts
  m.step(0xb148, 2);
  regs.a = mem.read8(0x014e); regs.setNZ(regs.a); m.step(0xb14b, 4);
  regs.sec(); m.step(0xb14c, 2);
  regs.sbc(0x01); m.step(0xb14e, 2);
  regs.cmp(mem.read8(0x014d)); m.step(0xb151, 4);
  if (regs.fC) { m.step(0xb156, 3); } // bcs taken -> keep $014e-1
  else { m.step(0xb153, 2); regs.a = mem.read8(0x014d); regs.setNZ(regs.a); m.step(0xb156, 4); }
  mem.write8(0x014e, regs.a); m.step(0xb159, 4);
  return m.ret(6);
}
