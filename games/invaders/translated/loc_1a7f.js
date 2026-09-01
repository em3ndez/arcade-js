// SPDX-License-Identifier: GPL-3.0-only
// loc_1a7f  (ROM 0x1a7f-0x1a8a) -- call loc_092e (returns A); if A==0 bail (rz). Else save A across
// loc_19e6: store A-1 at (HL), call loc_19e6, restore A (push/pop psw), then fall through into the
// loc_1a8b head (its own entry) -- delegate, not inlined.
export function loc_1a7f(m) {
  const { regs, mem } = m;

  m.push16(0x1a82); m.step(0x092e, 17); m.call(0x092e); // 1a7f  call 0x092e
  regs.and(regs.a); m.step(0x1a83, 4); // 1a82  ana a
  if (regs.fZ) { return m.ret(11); } // 1a83  rz
  m.step(0x1a84, 5);
  m.push16(regs.af); m.step(0x1a85, 11); // 1a84  push psw
  regs.a = regs.dec8(regs.a); m.step(0x1a86, 5); // 1a85  dcr a
  mem.write8(regs.hl, regs.a); m.step(0x1a87, 7); // 1a86  mov m,a
  m.push16(0x1a8a); m.step(0x19e6, 17); m.call(0x19e6); // 1a87  call 0x19e6
  regs.af = m.pop16(); m.step(0x1a8b, 10); // 1a8a  pop psw
  return m.call(0x1a8b); // fall through into loc_1a8b
}
