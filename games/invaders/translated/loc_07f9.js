// SPDX-License-Identifier: GPL-3.0-only
// loc_07f9  (ROM 0x07f9-0x0803) -- `jmp 0x07f9` entry. Runs two init calls, clears 0x20c1,
// then falls through into loc_0804 (the frame-loop preamble).
export function loc_07f9(m) {
  const { regs, mem } = m;

  m.push16(0x07fc); m.step(0x088d, 17); m.call(0x088d); // 07f9  call 0x088d
  m.push16(0x07ff); m.step(0x09d6, 17); m.call(0x09d6); // 07fc  call 0x09d6
  m.step(0x0800, 4); // 07ff  nop
  regs.xor(regs.a); m.step(0x0801, 4); // 0800  xra a
  mem.write8(0x20c1, regs.a); m.step(0x0804, 13); // 0801  sta 0x20c1
  return m.call(0x0804); // fall through into loc_0804
}
