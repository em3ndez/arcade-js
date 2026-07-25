// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0413  (ROM 0x0413–0x0423) — frame flags: gate on (0x6391)/(0x601A), then fall into loc_0426.
 */
export function loc_0413(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6391);
  m.step(0x0416, 13); // ld a,(0x6391)
  regs.and(regs.a);
  m.step(0x0417, 4); // and a
  if (regs.fNZ) { m.step(0x0426, 10); return m.call(0x0426); } // jp nz,0x0426
  m.step(0x041a, 10);
  regs.a = mem.read8(0x601a);
  m.step(0x041d, 13); // ld a,(0x601a)
  regs.and(regs.a);
  m.step(0x041e, 4); // and a
  if (regs.fNZ) { m.step(0x0486, 10); return m.call(0x0486); } // jp nz,0x0486
  m.step(0x0421, 10);
  regs.a = 0x01;
  m.step(0x0423, 7); // ld a,0x01
  mem.write8(0x6391, regs.a);
  m.step(0x0426, 13); // ld (0x6391),a -- falls into 0x0426
  return m.call(0x0426);
}
