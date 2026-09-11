// SPDX-License-Identifier: GPL-3.0-only
// loc_ac20  (ROM 0xac20-0xac35) -- calls d6bb, then compares live ($0a&0xf8) vs $071e and ($016a&3) vs
// $071f. If both match, beq $ac3e (shared rts -> no change); on any mismatch it falls through into
// loc_ac36 (which sets $01c9 bits 0-1). Ends in a branch; no rts of its own.
export function loc_ac20(m) {
  const { regs, mem } = m;
  m.push16(0xac22); m.step(0xac23, 6); m.call(0xd6bb);
  regs.a = mem.read8(0x0a); regs.setNZ(regs.a); m.step(0xac25, 3);
  regs.and(0xf8); m.step(0xac27, 2);
  regs.cmp(mem.read8(0x071e)); m.step(0xac2a, 4);
  if (regs.fNZ) {
    m.step(0xac34, 3);
  } else {
    m.step(0xac2c, 2);
    regs.a = mem.read8(0x016a); regs.setNZ(regs.a); m.step(0xac2f, 4);
    regs.and(0x03); m.step(0xac31, 2);
    regs.cmp(mem.read8(0x071f)); m.step(0xac34, 4);
  }
  if (regs.fZ) { m.step(0xac3e, 3); return m.call(0xac3e); }
  m.step(0xac36, 2); return m.call(0xac36);
}
