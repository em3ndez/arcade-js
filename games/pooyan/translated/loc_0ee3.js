// SPDX-License-Identifier: GPL-3.0-only

// loc_0ee3  (ROM 0x0ee3-0x0ef0) -- conditional sound command 0x04: enqueue only when both
// gate flags (0x8f24 and 0x8d32) are zero; a non-zero flag ret's early. On the go path,
// A=0x04 then tail-jr into enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0ee3(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f24);
  m.step(0x0ee6, 13); // 0ee3  ld a,(0x8f24)
  regs.and(regs.a);
  m.step(0x0ee7, 4); // 0ee6  and a
  if (regs.fNZ) { m.ret(11); return; } // 0ee7  ret nz -- gate 0x8f24 busy
  m.step(0x0ee8, 5); // 0ee7  ret nz not taken
  regs.a = mem.read8(0x8d32);
  m.step(0x0eeb, 13); // 0ee8  ld a,(0x8d32)
  regs.and(regs.a);
  m.step(0x0eec, 4); // 0eeb  and a
  if (regs.fNZ) { m.ret(11); return; } // 0eec  ret nz -- gate 0x8d32 busy
  m.step(0x0eed, 5); // 0eec  ret nz not taken
  regs.a = 0x04;
  m.step(0x0eef, 7); // 0eed  ld a,0x04
  m.step(0x0ea2, 12); // 0eef  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
