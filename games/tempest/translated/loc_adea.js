// SPDX-License-Identifier: GPL-3.0-only
// loc_adea  (ROM 0xadea-0xae1b) -- draws the fixed frame (jsr $a8b4/$ab17/$aa97/$ab14 with vector
// params), decrements $016e, computes A = $0602 - $0604, then tail-jumps to loc_ae4e.
export function loc_adea(m) {
  const { regs, mem } = m;
  m.push16(0xadec); m.step(0xaded, 6); m.call(0xa8b4);
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xadef, 2);
  regs.x = 0x02; regs.setNZ(regs.x); m.step(0xadf1, 2);
  m.push16(0xadf3); m.step(0xadf4, 6); m.call(0xab17);
  mem.write8(0x016e, regs.dec8(mem.read8(0x016e))); m.step(0xadf7, 6);
  m.push16(0xadf9); m.step(0xadfa, 6); m.call(0xaa97);
  regs.x = 0x0a; regs.setNZ(regs.x); m.step(0xadfc, 2);
  m.push16(0xadfe); m.step(0xadff, 6); m.call(0xab14);
  regs.a = 0xa6; regs.setNZ(regs.a); m.step(0xae01, 2);
  regs.x = 0x0c; regs.setNZ(regs.x); m.step(0xae03, 2);
  m.push16(0xae05); m.step(0xae06, 6); m.call(0xab17);
  regs.a = 0x9c; regs.setNZ(regs.a); m.step(0xae08, 2);
  regs.x = 0x0e; regs.setNZ(regs.x); m.step(0xae0a, 2);
  m.push16(0xae0c); m.step(0xae0d, 6); m.call(0xab17);
  regs.x = 0x2c; regs.setNZ(regs.x); m.step(0xae0f, 2);
  m.push16(0xae11); m.step(0xae12, 6); m.call(0xab14);
  regs.a = mem.read8(0x0602); regs.setNZ(regs.a); m.step(0xae15, 4);
  regs.sec(); m.step(0xae16, 2);
  regs.sbc(mem.read8(0x0604)); m.step(0xae19, 4);
  m.step(0xae4e, 3); return m.call(0xae4e);
}
