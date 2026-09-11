// SPDX-License-Identifier: GPL-3.0-only
// loc_9d67 (ROM 0x9d67-0x9d81) -- reads slot x's target ($02b9,x -> Y), calls loc_a7a6 with A=$0200, then
// the asl carry picks whether to SET (ora #$40) or CLEAR (and #$bf) bit6 of $0283,x. jsr'd from loc_9d06.
export function loc_9d67(m) {
  const { regs, mem } = m;
  let e = (0x02b9 + regs.x) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d6a, 4 + ((0x02b9 & 0xff00) !== (e & 0xff00) ? 1 : 0));
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9d6b, 2);
  regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0x9d6e, 4);
  m.push16(0x9d70); m.step(0x9d71, 6); m.call(0xa7a6); // jsr 0xa7a6 (pushes jsraddr+2 = 0x9d70)
  regs.a = regs.asl(regs.a); m.step(0x9d72, 2);
  e = (0x0283 + regs.x) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9d75, 4 + ((0x0283 & 0xff00) !== (e & 0xff00) ? 1 : 0));
  if (regs.fC) { m.step(0x9d7c, 3); regs.and(0xbf); m.step(0x9d7e, 2); } // bcs taken -> clear bit6
  else { m.step(0x9d77, 2); regs.ora(0x40); m.step(0x9d79, 2); regs.clv(); m.step(0x9d7a, 2); m.step(0x9d7e, 3); } // set bit6, bvc join
  mem.write8(e, regs.a); m.step(0x9d81, 5);
  return m.ret(6);
}
