// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_0400  (ROM 0x0400–0x04BD) — scheduled task 0x0400 handler.
 * The SAME body as entry_03fb entered at 0x0400 (the jp nz,0x0413), with the task-runner's
 * Z flag as a LIVE-IN (instead of entry_03fb's ld a,(0x6227)/cp 0x02). Reuses entry_03fb's
 * loc_0413 chain (which already covers the full 0x0486 tail incl. the 0x6227==4 arm).
 */
export function entry_0400(m) {
  const { regs, mem } = m;
  if (regs.fNZ) { m.step(0x0413, 10); return m.call(0x0413); } // jp nz,0x0413 (Z live-in)
  m.step(0x0403, 10);
  // -- 0x0403: the (0x6227)==2 preamble (identical to entry_03fb's) -> loc_0413 --
  regs.hl = 0x6908;
  m.step(0x0406, 10); // ld hl,0x6908
  regs.a = mem.read8(0x63a3);
  m.step(0x0409, 13); // ld a,(0x63a3)
  regs.c = regs.a;
  m.step(0x040a, 4); // ld c,a
  m.push16(0x040b); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.a = mem.read8(0x6910);
  m.step(0x040e, 13); // ld a,(0x6910)
  regs.sub(0x3b);
  m.step(0x0410, 7); // sub 0x3b
  mem.write8(0x63b7, regs.a);
  m.step(0x0413, 13); // ld (0x63b7),a -- falls into loc_0413
  return m.call(0x0413);
}
