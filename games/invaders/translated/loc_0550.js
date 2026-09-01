// SPDX-License-Identifier: GPL-3.0-only
// loc_0550 (ROM 0x0550-0x055a) -- CALLed head (from 0x048f/0x04c7/0x0514). Stashes A at 0x207f,
// points HL at 0x2073, loads B=0x0b, then tail-jumps to the shared row helper 0x1a32 (delegate).
export function loc_0550(m) {
  const { regs, mem } = m;
  mem.write8(0x207f, regs.a); m.step(0x0553, 13); // 0550 sta 0x207f
  regs.hl = 0x2073; m.step(0x0556, 10);           // 0553 lxi h,0x2073
  regs.b = 0x0b; m.step(0x0558, 7);               // 0556 mvi b,0x0b
  m.step(0x1a32, 10); return m.call(0x1a32);      // 0558 jmp 0x1a32
}
