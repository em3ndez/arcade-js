// SPDX-License-Identifier: GPL-3.0-only
// loc_b0d1  (ROM 0xb0d1-0xb0dc) -- if Y==$9e rts; else store Y->$9e, lda #$08, tail-jmp 0xdf4c.
export function loc_b0d1(m) {
  const { regs, mem } = m;
  regs.cpy(mem.read8(0x9e)); m.step(0xb0d3, 3);
  if (regs.fZ) { m.step(0xb0dc, 3); return m.ret(6); }
  m.step(0xb0d5, 2);
  mem.write8(0x9e, regs.y); m.step(0xb0d7, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xb0d9, 2);
  m.step(0xdf4c, 3); return m.call(0xdf4c);
}
