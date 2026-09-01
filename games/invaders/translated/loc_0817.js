// SPDX-License-Identifier: GPL-3.0-only
// loc_0817  (ROM 0x0817-0x081e) -- `jmp 0x0817` entry from 0x032f (loc_028e's doJ arm). Same tail as
// loc_0814 but without the leading `call 0x00b1`: two calls (B=0x20 for the last), then falls through
// into the main frame loop loc_081f.
export function loc_0817(m) {
  const { regs } = m;

  m.push16(0x081a); m.step(0x19d1, 17); m.call(0x19d1); // 0817  call 0x19d1
  regs.b = 0x20; m.step(0x081c, 7); // 081a  mvi b,0x20
  m.push16(0x081f); m.step(0x18fa, 17); m.call(0x18fa); // 081c  call 0x18fa
  return m.call(0x081f); // fall through into loc_081f
}
