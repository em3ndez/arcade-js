// SPDX-License-Identifier: GPL-3.0-only
// loc_aa6f (ROM 0xaa6f-0xaa76) -- jsr $a8b4, load A=0/X=6, then tail-jmp into $ab17.
// $a8b4 and $ab17 are committed delegates; the jsr pushes a return, the tail jmp does not.
export function loc_aa6f(m) {
  const { regs } = m;
  m.push16(0xaa71); m.step(0xaa72, 6); m.call(0xa8b4); // jsr $a8b4 (pushes 0xaa6f+2)
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xaa74, 2);
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0xaa76, 2);
  m.step(0xab17, 3); return m.call(0xab17); // jmp $ab17 tail (no push16)
}
