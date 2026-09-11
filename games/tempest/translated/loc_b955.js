// SPDX-License-Identifier: GPL-3.0-only
// loc_b955  (ROM 0xb955-0xb966) -- reads $57>>4, counts remaining shifts-to-zero into Y (do-while
// iny/lsr/bne), then A = 0 + 2 (clc/adc) and Y reset to 0 before rts.
export function loc_b955(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xb957, 3);
  regs.a = regs.lsr(regs.a); m.step(0xb958, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb959, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb95a, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb95b, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb95d, 2);
  // b95d..b95f do-while: iny; lsr a; bne 0xb95d
  while (true) {
    regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb95e, 2);
    regs.a = regs.lsr(regs.a); m.step(0xb95f, 2);
    if (regs.fNZ) { m.step(0xb95d, 3); continue; }
    m.step(0xb961, 2); break;
  }
  regs.clc(); m.step(0xb962, 2);
  regs.adc(0x02); m.step(0xb964, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb966, 2);
  return m.ret(6);
}
