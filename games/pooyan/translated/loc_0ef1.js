// SPDX-License-Identifier: GPL-3.0-only

// loc_0ef1  (ROM 0x0ef1-0x0ef5) -- enqueue sound command 0x05: load A then tail-jr
// into the ring-buffer enqueue at 0x0eb3 (its ret returns to our caller).
export function loc_0ef1(m) {
  const { regs } = m;

  regs.a = 0x05;
  m.step(0x0ef3, 7); // 0ef1  ld a,0x05
  m.step(0x0eb3, 12); // 0ef3  jr 0x0eb3 -- tail into loc_0eb3
  return m.call(0x0eb3);
}
