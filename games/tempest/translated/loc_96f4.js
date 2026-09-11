// SPDX-License-Identifier: GPL-3.0-only
// loc_96f4 (ROM 0x96f4-0x96ff) -- $2b minus the (0x2c),y-2 entry, leaving Y advanced by 0. A sub-helper of
// loc_96e2 (repeat count). loc_9700 (ROM 0x9700-0x970a) is a sibling dispatch target ($968f table): call
// loc_96f4, then bump Y by the low bit and read (0x2c),y.
export function loc_96f4(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x96f6, 3);
  mem.write8(0x29, regs.y); m.step(0x96f8, 3);
  regs.y = regs.dec8(regs.y); m.step(0x96f9, 2);
  regs.y = regs.dec8(regs.y); m.step(0x96fa, 2);
  regs.sec(); m.step(0x96fb, 2);
  { const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
    regs.sbc(mem.read8(e)); m.step(0x96fd, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.y = regs.inc8(regs.y); m.step(0x96fe, 2);
  regs.y = regs.inc8(regs.y); m.step(0x96ff, 2);
  return m.ret(6);
}

export function loc_9700(m) {
  const { regs, mem } = m;
  m.push16(0x9702); m.step(0x96f4, 6); m.call(0x96f4); // jsr 0x96f4 (returns to 0x9703)
  regs.and(0x01); m.step(0x9705, 2);
  if (regs.fZ) { m.step(0x9708, 3); } // beq 0x9708 -> skip iny
  else { m.step(0x9707, 2); regs.y = regs.inc8(regs.y); m.step(0x9708, 2); }
  const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x970a, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0));
  return m.ret(6);
}
