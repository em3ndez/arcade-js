// SPDX-License-Identifier: GPL-3.0-only
// loc_9c21 (ROM 0x9c21-0x9c3a) -- reads slot x's segment index $02b9,x, looks up $03ac[idx]
// (treated as $ff when that table entry is 0), compares it to the slot's hi coord $02df,x, and
// stores a boolean to $010c: 1 when the looked-up value >= $02df,x (carry set), else 0.
export function loc_9c21(m) {
  const { regs, mem } = m;
  { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0x9c24, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0x03ac, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c27, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fNZ) { m.step(0x9c2b, 3); }                                                    // bne 9c2b: entry != 0
  else { m.step(0x9c29, 2); regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9c2b, 2); }       // lda #$ff
  { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.cmp(mem.read8(e)); m.step(0x9c2e, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fC) { m.step(0x9c35, 3); regs.a = 0x01; regs.setNZ(regs.a); m.step(0x9c37, 2); } // bcs -> flag = 1
  else { m.step(0x9c30, 2); regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9c32, 2); regs.clv(); m.step(0x9c33, 2); m.step(0x9c37, 3); } // flag = 0; clv;bvc join
  mem.write8(0x010c, regs.a); m.step(0x9c3a, 4);
  return m.ret(6); // 9c3a rts
}
