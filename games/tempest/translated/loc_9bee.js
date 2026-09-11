// SPDX-License-Identifier: GPL-3.0-only
// loc_9bee (ROM 0x9bee-0x9bf9) -- demo-state leaf: if flag $010c != 0 do nothing, else advance counter
// $010b by two (two inc's). $010b/$010c are the demo/attract step + gate cells.
export function loc_9bee(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x010c); regs.setNZ(regs.a); m.step(0x9bf1, 4); // lda $010c
  if (regs.fNZ) {
    m.step(0x9bf9, 3); // bne $9bf9 taken (same-page) -> rts
  } else {
    m.step(0x9bf3, 2); // bne not taken
    { const e = 0x010b; mem.write8(e, regs.inc8(mem.read8(e))); m.step(0x9bf6, 6); } // inc $010b
    { const e = 0x010b; mem.write8(e, regs.inc8(mem.read8(e))); m.step(0x9bf9, 6); } // inc $010b
  }
  return m.ret(6); // rts
}
