// SPDX-License-Identifier: GPL-3.0-only
// loc_01f8  (ROM 0x01f8-0x0208) -- shared body reached from loc_01ef (jmp, HL=0x2142) and
// loc_01f5 (fall-through, HL=0x2242). Runs a 4-pass loop: each pass pushes DE=0x1d20, sets
// B=0x2c, calls loc_1a32, restores DE, decrements C; returns when C reaches 0.
export function loc_01f8(m) {
  const { regs } = m;

  regs.c = 0x04; m.step(0x01fa, 7); // 01f8  mvi c,0x04
  regs.de = 0x1d20; m.step(0x01fd, 10); // 01fa  lxi d,0x1d20
  for (;;) { // loc_01fd
    m.push16(regs.de); m.step(0x01fe, 11); // 01fd  push d
    regs.b = 0x2c; m.step(0x0200, 7); // 01fe  mvi b,0x2c
    m.push16(0x0203); m.step(0x1a32, 17); m.call(0x1a32); // 0200  call 0x1a32
    regs.de = m.pop16(); m.step(0x0204, 10); // 0203  pop d
    regs.c = regs.dec8(regs.c); m.step(0x0205, 5); // 0204  dcr c
    if (regs.fNZ) { m.step(0x01fd, 10); continue; } // 0205  jnz 0x01fd (taken)
    m.step(0x0208, 10); // 0205  jnz 0x01fd (not taken)
    break;
  }
  return m.ret(10); // 0208  ret
}
