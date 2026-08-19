// SPDX-License-Identifier: GPL-3.0-only

// loc_6f42  (ROM 0x6f42-0x6f5d) -- level-intro phase 2: draw the round/stage counter. Advances the
// phase (0x8f51); if the (0x8f52) tally is non-zero it runs 0x1131 with B = tally, then computes a
// screen address via 0x1119 from base 0x8634 (+2*BC), forms 2*E as a packed BCD digit (daa), and
// paints it through 0x1119 again.
export function loc_6f42(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f51;
  m.step(0x6f45, 10); // 6f42  ld hl,0x8f51
  regs.incMem8(mem, regs.hl);
  m.step(0x6f46, 11); // 6f45  inc (hl) -- advance phase
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6f47, 6); // 6f46  inc hl -> 0x8f52
  regs.a = mem.read8(regs.hl);
  m.step(0x6f48, 7); // 6f47  ld a,(hl)
  regs.and(regs.a);
  m.step(0x6f49, 4); // 6f48  and a
  if (regs.fZ) {
    m.step(0x6f4f, 12); // 6f49  jr z,0x6f4f
  } else {
    m.step(0x6f4b, 7);
    regs.b = regs.a;
    m.step(0x6f4c, 4); // 6f4b  ld b,a
    m.push16(0x6f4f);
    m.step(0x1131, 17); // 6f4c  call 0x1131
    m.call(0x1131);
  }
  regs.hl = 0x8634;
  m.step(0x6f52, 10); // 6f4f  ld hl,0x8634
  m.push16(0x6f55);
  m.step(0x1119, 17); // 6f52  call 0x1119
  m.call(0x1119);
  regs.addHl(regs.bc);
  m.step(0x6f56, 11); // 6f55  add hl,bc
  regs.addHl(regs.bc);
  m.step(0x6f57, 11); // 6f56  add hl,bc
  regs.a = regs.e;
  m.step(0x6f58, 4); // 6f57  ld a,e
  regs.add(regs.a);
  m.step(0x6f59, 4); // 6f58  add a,a
  regs.daa();
  m.step(0x6f5a, 4); // 6f59  daa
  m.push16(0x6f5d);
  m.step(0x1119, 17); // 6f5a  call 0x1119
  m.call(0x1119);
  m.ret(); // 6f5d  ret
}
