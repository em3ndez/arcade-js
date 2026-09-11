// SPDX-License-Identifier: GPL-3.0-only
// loc_dde9  (ROM 0xdde9-0xddec) -- lda #$04; bne $ddf3 (always taken, A!=0) into the loc_ddf1 tail entry
// at $ddf3 (Y=$ff path). Not-taken falls into loc_dded.
export function loc_dde9(m) {
  const { regs } = m;
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xddeb, 2);
  if (regs.fNZ) { m.step(0xddf3, 3); return m.call(0xddf3); }
  m.step(0xdded, 2); return m.call(0xdded);
}
