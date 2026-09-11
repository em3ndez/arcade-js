// SPDX-License-Identifier: GPL-3.0-only
// loc_adce  (ROM 0xadce-0xade9) -- fold $50 (a signed step) into $51 (=$50*8+$51), then add sign of
// $50 to A (carry from the fold), and clear $50.  A entering = the slot value being nudged.
export function loc_adce(m) {
  const { regs, mem } = m;
  m.push8(regs.a); m.step(0xadcf, 3);
  regs.a = mem.read8(0x0050); regs.setNZ(regs.a); m.step(0xadd1, 3);
  regs.a = regs.asl(regs.a); m.step(0xadd2, 2);
  regs.a = regs.asl(regs.a); m.step(0xadd3, 2);
  regs.a = regs.asl(regs.a); m.step(0xadd4, 2);
  regs.clc(); m.step(0xadd5, 2);
  regs.adc(mem.read8(0x0051)); m.step(0xadd7, 3);
  mem.write8(0x0051, regs.a); m.step(0xadd9, 3);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xadda, 4);
  regs.y = mem.read8(0x0050); regs.setNZ(regs.y); m.step(0xaddc, 3);
  if (regs.fN) {
    m.step(0xade3, 3);
    regs.adc(0xff); m.step(0xade5, 2);
  } else {
    m.step(0xadde, 2);
    regs.adc(0x00); m.step(0xade0, 2);
    regs.clv(); m.step(0xade1, 2);
    m.step(0xade5, 3);
  }
  // ade5:
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xade7, 2);
  mem.write8(0x0050, regs.y); m.step(0xade9, 3);
  return m.ret(6);
}
