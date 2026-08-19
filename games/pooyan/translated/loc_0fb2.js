// SPDX-License-Identifier: GPL-3.0-only

// loc_0fb2  (ROM 0x0fb2-0x0fbb) -- enqueue two sound commands: 0x27 then 0x15,
// each via the ring-buffer enqueue at 0x0eb3. The second is a tail-jp.
export function loc_0fb2(m) {
  const { regs } = m;

  regs.a = 0x27;
  m.step(0x0fb4, 7); // 0fb2  ld a,0x27
  m.push16(0x0fb7);
  m.step(0x0eb3, 17); // 0fb4  call 0x0eb3 -- enqueue 0x27 (returns to 0x0fb7)
  m.call(0x0eb3);

  regs.a = 0x15;
  m.step(0x0fb9, 7); // 0fb7  ld a,0x15
  m.step(0x0eb3, 10); // 0fb9  jp 0x0eb3 -- tail: enqueue 0x15, its ret is ours
  return m.call(0x0eb3);
}
