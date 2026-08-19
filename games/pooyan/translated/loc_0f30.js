// SPDX-License-Identifier: GPL-3.0-only

// loc_0f30  (ROM 0x0f30-0x0f3e) -- queue three sound commands (0x95, 0x03, 0x11) via enqueue
// helper 0x0ea2. First two are pattern-A calls (return to 0x0f35 / 0x0f3a); the last is a
// tail-jp, so 0x0ea2's ret carries control back to loc_0f30's caller.
export function loc_0f30(m) {
  const { regs } = m;

  regs.a = 0x95;
  m.step(0x0f32, 7); // 0f30  ld a,0x95
  m.push16(0x0f35); m.step(0x0ea2, 17); m.call(0x0ea2); // 0f32  call 0x0ea2
  regs.a = 0x03;
  m.step(0x0f37, 7); // 0f35  ld a,0x03
  m.push16(0x0f3a); m.step(0x0ea2, 17); m.call(0x0ea2); // 0f37  call 0x0ea2
  regs.a = 0x11;
  m.step(0x0f3c, 7); // 0f3a  ld a,0x11
  m.step(0x0ea2, 10); // 0f3c  jp 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
