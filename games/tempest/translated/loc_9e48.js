// SPDX-License-Identifier: GPL-3.0-only
// loc_9e48 (ROM 0x9e48-0x9e5b) -- collision test: if slot x's coords match the player's
// (hi coord $02df,x == $0202 AND segment $02b9,x == $0200) it calls $a343 (loc_a343, Group C);
// on any mismatch it just returns.
export function loc_9e48(m) {
  const { regs, mem } = m;
  { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e4b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.cmp(mem.read8(0x0202)); m.step(0x9e4e, 4);
  if (regs.fNZ) { m.step(0x9e5b, 3); return m.ret(6); }                  // bne 9e5b: hi coord mismatch
  m.step(0x9e50, 2);
  { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e53, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.cmp(mem.read8(0x0200)); m.step(0x9e56, 4);
  if (regs.fNZ) { m.step(0x9e5b, 3); return m.ret(6); }                  // bne 9e5b: segment mismatch
  m.step(0x9e58, 2);
  m.push16(0x9e5a); m.step(0x9e5b, 6); m.call(0xa343);                   // jsr $a343 (pushes 9e58+2)
  return m.ret(6); // 9e5b rts
}
