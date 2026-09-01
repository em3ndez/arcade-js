// SPDX-License-Identifier: GPL-3.0-only
// loc_1a47  (ROM 0x1a47-0x1a5b) -- save BC, shift HL right by 3 (through carry), then force H into
// 0x20-0x3f (ani 0x3f / ori 0x20) so HL lands in the 0x2000-0x3fff work-RAM window. Restore BC, return.
export function loc_1a47(m) {
  const { regs } = m;
  m.push16(regs.bc); m.step(0x1a48, 11); // 1a47  push b
  regs.b = 0x03; m.step(0x1a4a, 7);      // 1a48  mvi b,0x03
  for (;;) {
    regs.a = regs.h; m.step(0x1a4b, 5);              // 1a4a  mov a,h
    regs.rra(); m.step(0x1a4c, 4);                   // 1a4b  rar
    regs.h = regs.a; m.step(0x1a4d, 5);              // 1a4c  mov h,a
    regs.a = regs.l; m.step(0x1a4e, 5);              // 1a4d  mov a,l
    regs.rra(); m.step(0x1a4f, 4);                   // 1a4e  rar
    regs.l = regs.a; m.step(0x1a50, 5);              // 1a4f  mov l,a
    regs.b = regs.dec8(regs.b); m.step(0x1a51, 5);   // 1a50  dcr b
    if (regs.fNZ) { m.step(0x1a4a, 10); continue; }
    m.step(0x1a54, 10); break;
  }
  regs.a = regs.h; m.step(0x1a55, 5);    // 1a54  mov a,h
  regs.and(0x3f); m.step(0x1a57, 7);     // 1a55  ani 0x3f
  regs.or(0x20); m.step(0x1a59, 7);      // 1a57  ori 0x20
  regs.h = regs.a; m.step(0x1a5a, 5);    // 1a59  mov h,a
  regs.bc = m.pop16(); m.step(0x1a5b, 10); // 1a5a  pop b
  return m.ret(10);                       // 1a5b  ret
}
