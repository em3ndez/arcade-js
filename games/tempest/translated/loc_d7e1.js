// SPDX-License-Identifier: GPL-3.0-only
// loc_d7e1 (ROM 0xd7e1-0xd803) -- sets $05=0x00, $01=0x02, then a guarded delegate. Falls through
// to jsr $abac [EXPORTED-delegate] only when $01ca==0 AND ($0c00 & 0x10)!=0 AND ($01c9 & 0x03)==0
// (also sets $00=0x00 once past the second guard); any guard fails -> straight to rts at $d803.
export function loc_d7e1(m) {
  const { regs, mem } = m;
  L_d803: {
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xd7e3, 2);
    mem.write8(0x05, regs.a); m.step(0xd7e5, 3);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xd7e7, 2);
    mem.write8(0x01, regs.a); m.step(0xd7e9, 3);
    regs.a = mem.read8(0x01ca); regs.setNZ(regs.a); m.step(0xd7ec, 4);
    if (!regs.fZ) { m.step(0xd803, 4); break L_d803; } // bne taken (page cross)
    m.step(0xd7ee, 2);
    regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xd7f1, 4);
    regs.and(0x10); m.step(0xd7f3, 2);
    if (regs.fZ) { m.step(0xd803, 4); break L_d803; } // beq taken (page cross)
    m.step(0xd7f5, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xd7f7, 2);
    mem.write8(0x00, regs.a); m.step(0xd7f9, 3);
    regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xd7fc, 4);
    regs.and(0x03); m.step(0xd7fe, 2);
    if (regs.fZ) { m.step(0xd803, 3); break L_d803; } // beq taken (same page)
    m.step(0xd800, 2);
    m.push16(0xd802); m.step(0xd803, 6); m.call(0xabac); // jsr $abac delegate (pushes 0xd800+2)
  }
  return m.ret(6); // 0xd803 rts
}
