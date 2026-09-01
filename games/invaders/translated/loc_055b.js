// SPDX-License-Identifier: GPL-3.0-only
// loc_055b (ROM 0x055b-0x0562) -- tail-jump entry (reached by `jnz 0x055b` from 0x04a8/0x04ee/0x053b).
// Points DE at 0x2073, loads B=0x0b, tail-jumps to the shared row helper 0x1a32 (delegate).
export function loc_055b(m) {
  const { regs } = m;
  regs.de = 0x2073; m.step(0x055e, 10);      // 055b lxi d,0x2073
  regs.b = 0x0b; m.step(0x0560, 7);          // 055e mvi b,0x0b
  m.step(0x1a32, 10); return m.call(0x1a32); // 0560 jmp 0x1a32
}
