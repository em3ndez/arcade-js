// SPDX-License-Identifier: GPL-3.0-only
// loc_2c96  (ROM 0x2c96-0x2cc2) -- folds the X-object dx ($54,X - $63) and dy ($64,X - $73) through the
// $382B distance fold, RTS-ing early when either exceeds its bound; on success stores dx in $8D, sums
// dx+dy in A, and (unless X==0x0D) falls through to loc_2cc2 with CMP #$0C set.
export function loc_2c96(m) {
  const { regs, mem } = m;
  regs.a = mem.read8((0x54 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2c98, 4);
  regs.sec(); m.step(0x2c99, 2);
  regs.sbc(mem.read8(0x0063)); m.step(0x2c9b, 3);
  m.step(0x2c9e, 6); m.call(0x382b);
  regs.cpx(0x0d); m.step(0x2ca0, 2);                                     // 2c9e cpx #$0d
  if (regs.fNZ) {
    m.step(0x2ca7, 3);                                                   // 2ca0 bne $2ca7 (taken)
    regs.cmp(0x07); m.step(0x2ca9, 2);                                   // 2ca7 cmp #$07
    if (regs.fC) { m.step(0x2ca6, 3); return m.ret(6); }                 // 2ca9 bcs $2ca6 (taken -> rts)
    m.step(0x2cab, 2);                                                   // 2ca9 bcs (not taken) -> 2cab
  } else {
    m.step(0x2ca2, 2);                                                   // 2ca0 bne (not taken)
    regs.cmp(0x0a); m.step(0x2ca4, 2);                                   // 2ca2 cmp #$0a
    if (regs.fNC) { m.step(0x2cab, 3); }                                 // 2ca4 bcc $2cab (taken)
    else { m.step(0x2ca6, 2); return m.ret(6); }                        // 2ca4 bcc (nt) -> 2ca6 rts
  }
  mem.write8(0x008d, regs.a); m.step(0x2cad, 3);                         // 2cab sta $8d
  regs.a = mem.read8((0x64 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2caf, 4);
  regs.sec(); m.step(0x2cb0, 2);
  regs.sbc(mem.read8(0x0073)); m.step(0x2cb2, 3);
  m.step(0x2cb5, 6); m.call(0x382b);
  regs.cmp(0x07); m.step(0x2cb7, 2);                                     // 2cb5 cmp #$07
  if (regs.fC) { m.step(0x2ca6, 3); return m.ret(6); }                   // 2cb7 bcs $2ca6 (taken -> rts)
  m.step(0x2cb9, 2);                                                     // 2cb7 bcs (not taken)
  regs.clc(); m.step(0x2cba, 2);
  regs.adc(mem.read8(0x008d)); m.step(0x2cbc, 3);
  regs.cpx(0x0d); m.step(0x2cbe, 2);                                     // 2cbc cpx #$0d
  if (regs.fZ) { m.step(0x2cea, 3); return m.call(0x2cea); }             // 2cbe beq $2cea (out)
  m.step(0x2cc0, 2);                                                     // 2cbe beq (not taken)
  regs.cmp(0x0c); m.step(0x2cc2, 2);                                     // 2cc0 cmp #$0c
  return m.call(0x2cc2);                                                 // fall through to loc_2cc2
}
