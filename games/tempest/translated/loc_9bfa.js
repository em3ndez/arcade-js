// SPDX-License-Identifier: GPL-3.0-only
// loc_9bfa (ROM 0x9bfa-0x9c0b) -- demo-state leaf: bumps counter $010b; then if gate $010c == 0, reloads
// $010b from table $a0f7,y indexed by the new counter (a table-driven counter reset/jump).
export function loc_9bfa(m) {
  const { regs, mem } = m;
  { const e = 0x010b; mem.write8(e, regs.inc8(mem.read8(e))); m.step(0x9bfd, 6); } // inc $010b
  regs.a = mem.read8(0x010c); regs.setNZ(regs.a); m.step(0x9c00, 4);                 // lda $010c
  if (regs.fNZ) {
    m.step(0x9c0b, 3); // bne $9c0b taken (same-page) -> rts
  } else {
    m.step(0x9c02, 2); // bne not taken
    regs.y = mem.read8(0x010b); regs.setNZ(regs.y); m.step(0x9c05, 4); // ldy $010b
    { const b = 0xa0f7, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c08, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); } // lda $a0f7,y
    mem.write8(0x010b, regs.a); m.step(0x9c0b, 4); // sta $010b
  }
  return m.ret(6); // rts
}
