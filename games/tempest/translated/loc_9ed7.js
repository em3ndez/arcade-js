// SPDX-License-Identifier: GPL-3.0-only
// loc_9ed7 (ROM 0x9ed7-0x9ef0) -- returns a $03ee[y] direction byte with bit7 set. If bit6 of the
// caller's A is set: y = (y-1) & 0x0f, then A = ($03ee[y] + 8) & 0x0f (half-turn in a 16-step ring).
// If bit6 is clear: A = $03ee[y] with y untouched. Both paths finish with ora #0x80. Single entry 0x9ed7.
export function loc_9ed7(m) {
  const { regs, mem } = m;
  L_rts: {
    regs.and(0x40); m.step(0x9ed9, 2);
    if (regs.fZ) {                                   // beq -> 9eeb (bit6 clear): plain table load
      m.step(0x9eeb, 3);
      { const b = 0x03ee, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9eee, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      break L_rts;
    }
    m.step(0x9edb, 2);
    regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0x9edc, 2); // dey
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x9edd, 2);              // tya
    regs.and(0x0f); m.step(0x9edf, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9ee0, 2);             // tay -> y = (y-1) & 0x0f
    { const b = 0x03ee, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ee3, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.clc(); m.step(0x9ee4, 2);
    regs.adc(0x08); m.step(0x9ee6, 2);
    regs.and(0x0f); m.step(0x9ee8, 2);
    regs.clv(); m.step(0x9ee9, 2);
    m.step(0x9eee, 3);                               // clv; bvc -> 9eee (unconditional join)
  }
  regs.ora(0x80); m.step(0x9ef0, 2);
  return m.ret(6);                                   // 9ef0 rts
}
