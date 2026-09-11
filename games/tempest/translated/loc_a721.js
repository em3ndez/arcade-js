// SPDX-License-Identifier: GPL-3.0-only
// loc_a721 (ROM 0xa721-0xa75c) -- clamps slot x's 3 axis velocities against a fixed step. Seeds a running
// flag $29 = $fd, then for each axis (velocity-low $02c3/$02e3/$0303,x paired with velocity-whole
// $0323/$0343/$0363,x) calls loc_a75d, which returns the stepped low byte in A and whole byte in Y and may
// inc $29 on saturation. Stores each result back. If $29 is still nonzero (no axis saturated the flag to 0)
// -> skip; else store A(=0) into $0283,x, zeroing the whole coord. rts.
export function loc_a721(m) {
  const { regs, mem } = m;
  regs.a = 0xfd; regs.setNZ(regs.a); m.step(0xa723, 2); // lda #$fd
  mem.write8(0x29, regs.a); m.step(0xa725, 3); // sta $29
  // --- axis 0 ---
  { const b = 0x02c3, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa728, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0x0323, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xa72b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  m.push16(0xa72d); m.step(0xa72e, 6); m.call(0xa75d); // jsr $a75d (pushes a72b+2)
  mem.write8((0x02c3 + regs.x) & 0xffff, regs.a); m.step(0xa731, 5);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xa732, 2); // tya
  mem.write8((0x0323 + regs.x) & 0xffff, regs.a); m.step(0xa735, 5);
  // --- axis 1 ---
  { const b = 0x02e3, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa738, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0x0343, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xa73b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  m.push16(0xa73d); m.step(0xa73e, 6); m.call(0xa75d); // jsr $a75d
  mem.write8((0x02e3 + regs.x) & 0xffff, regs.a); m.step(0xa741, 5);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xa742, 2); // tya
  mem.write8((0x0343 + regs.x) & 0xffff, regs.a); m.step(0xa745, 5);
  // --- axis 2 ---
  { const b = 0x0303, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa748, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0x0363, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xa74b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  m.push16(0xa74d); m.step(0xa74e, 6); m.call(0xa75d); // jsr $a75d
  mem.write8((0x0303 + regs.x) & 0xffff, regs.a); m.step(0xa751, 5);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xa752, 2); // tya
  mem.write8((0x0363 + regs.x) & 0xffff, regs.a); m.step(0xa755, 5);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xa757, 3); // lda $29
  if (regs.fNZ) { m.step(0xa75c, 3); return m.ret(6); } // bne taken -> skip, a75c rts
  m.step(0xa759, 2);
  mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0xa75c, 5); // sta $0283,x
  return m.ret(6); // a75c rts
}
