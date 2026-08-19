// SPDX-License-Identifier: GPL-3.0-only

// loc_0eda  (ROM 0x0eda-0x0ee2) -- queue two sound commands (0x82 then 0x03) via the
// enqueue helper 0x0eb3. First is a pattern-A call (returns to 0x0edf); the second is a
// tail-jr, so 0x0eb3's ret carries control back to loc_0eda's caller.
export function loc_0eda(m) {
  const { regs } = m;

  regs.a = 0x82;
  m.step(0x0edc, 7); // 0eda  ld a,0x82
  m.push16(0x0edf); m.step(0x0eb3, 17); m.call(0x0eb3); // 0edc  call 0x0eb3
  regs.a = 0x03;
  m.step(0x0ee1, 7); // 0edf  ld a,0x03
  m.step(0x0eb3, 12); // 0ee1  jr 0x0eb3 -- tail into loc_0eb3
  return m.call(0x0eb3);
}
