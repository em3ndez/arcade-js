// SPDX-License-Identifier: GPL-3.0-only
// loc_dded  (ROM 0xdded-0xddf0) -- lda #$03; bne $ddf3 (always taken, A!=0) into the loc_ddf1 tail entry
// at $ddf3 (Y=$ff path). Not-taken falls into loc_ddf1.
export function loc_dded(m) {
  const { regs } = m;
  regs.a = 0x03; regs.setNZ(regs.a); m.step(0xddef, 2);
  if (regs.fNZ) { m.step(0xddf3, 3); return m.call(0xddf3); }
  m.step(0xddf1, 2); return m.call(0xddf1);
}
