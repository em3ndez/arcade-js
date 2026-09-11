// SPDX-License-Identifier: GPL-3.0-only
// loc_aeca  (ROM 0xaeca-0xaef0) -- if $0156!=0: stash it in $58, call ab14 with X=0x34, zero $56/$57 and
// call dfb1 on $56 (len 3). Then always: sum 17 bytes of $d575,y (y=0x10..0) plus 0x85 (starting carry
// clear) into A -> store $b5, rts.
export function loc_aeca(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0156); regs.setNZ(regs.a); m.step(0xaecd, 4);
  if (regs.fZ) {
    m.step(0xaee3, 3);
  } else {
    m.step(0xaecf, 2);
    mem.write8(0x58, regs.a); m.step(0xaed1, 3);
    regs.x = 0x34; regs.setNZ(regs.x); m.step(0xaed3, 2);
    m.push16(0xaed5); m.step(0xaed6, 6); m.call(0xab14);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xaed8, 2);
    mem.write8(0x56, regs.a); m.step(0xaeda, 3);
    mem.write8(0x57, regs.a); m.step(0xaedc, 3);
    regs.a = 0x56; regs.setNZ(regs.a); m.step(0xaede, 2);
    regs.y = 0x03; regs.setNZ(regs.y); m.step(0xaee0, 2);
    m.push16(0xaee2); m.step(0xaee3, 6); m.call(0xdfb1);
  }
  regs.clc(); m.step(0xaee4, 2);
  regs.y = 0x10; regs.setNZ(regs.y); m.step(0xaee6, 2);
  regs.a = 0x85; regs.setNZ(regs.a); m.step(0xaee8, 2);
  do {
    regs.adc(mem.read8((0xd575 + regs.y) & 0xffff)); m.step(0xaeeb, 4);
    regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0xaeec, 2);
    if (regs.fN) { m.step(0xaeee, 2); break; }
    m.step(0xaee8, 3);
  } while (true);
  mem.write8(0xb5, regs.a); m.step(0xaef0, 3);
  return m.ret(6);
}
