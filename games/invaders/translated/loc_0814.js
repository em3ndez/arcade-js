// SPDX-License-Identifier: GPL-3.0-only
// loc_0814  (ROM 0x0814-0x081e) -- `jmp 0x0814` entry (also reached from loc_0872). Three calls
// (with B=0x20 for the last), then falls through into the main frame loop loc_081f.
export function loc_0814(m) {
  const { regs } = m;

  m.push16(0x0817); m.step(0x00b1, 17); m.call(0x00b1); // 0814  call 0x00b1
  m.push16(0x081a); m.step(0x19d1, 17); m.call(0x19d1); // 0817  call 0x19d1
  regs.b = 0x20; m.step(0x081c, 7); // 081a  mvi b,0x20
  m.push16(0x081f); m.step(0x18fa, 17); m.call(0x18fa); // 081c  call 0x18fa
  return m.call(0x081f); // fall through into loc_081f
}
