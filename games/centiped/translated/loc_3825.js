// SPDX-License-Identifier: GPL-3.0-only
// loc_3825  (ROM 0x3825-0x382b) -- clears the $8C sign byte, then re-enters the 0x3801 draw loop (BEQ always taken).
export function loc_3825(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3827, 2);       // 3825 ldy #$00
  mem.write8(0x008c, regs.y); m.step(0x3829, 3);              // 3827 sty $8c
  if (regs.fZ) { m.step(0x3801, 3); return m.call(0x3801); }  // 3829 beq $3801 (Y=0 -> Z set -> always taken)
  m.step(0x382b, 2); return m.call(0x382b);                   // 3829 beq $3801 (unreachable fall-through)
}
