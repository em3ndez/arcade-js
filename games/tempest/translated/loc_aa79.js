// SPDX-License-Identifier: GPL-3.0-only
// loc_aa79 (ROM 0xaa79-0xaa8f) -- jsr $ab17 with A=0/X=$32; when ($03 & $1f) < $10 does a second
// jsr $ab17 with A=$e0/X=$22, then either way tail-jmps into $a8b4. All targets are committed delegates.
export function loc_aa79(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xaa7b, 2);
  regs.x = 0x32; regs.setNZ(regs.x); m.step(0xaa7d, 2);
  m.push16(0xaa7f); m.step(0xaa80, 6); m.call(0xab17); // jsr $ab17 (pushes 0xaa7d+2)
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xaa82, 3); // zp read
  regs.and(0x1f); m.step(0xaa84, 2);
  regs.cmp(0x10); m.step(0xaa86, 2);
  if (regs.fC) { m.step(0xaa8f, 3); } // bcs taken -> skip the second jsr
  else {
    m.step(0xaa88, 2);
    regs.a = 0xe0; regs.setNZ(regs.a); m.step(0xaa8a, 2);
    regs.x = 0x22; regs.setNZ(regs.x); m.step(0xaa8c, 2);
    m.push16(0xaa8e); m.step(0xaa8f, 6); m.call(0xab17); // jsr $ab17 (pushes 0xaa8c+2)
  }
  m.step(0xa8b4, 3); return m.call(0xa8b4); // jmp $a8b4 tail (no push16)
}
