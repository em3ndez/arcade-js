// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2f2f  (ROM 0x2f2f-0x2f92) -- rope-cell state 4 (rst 0x2e3d[3]): retract. On the per-cell timer
// (loc_2e45), and while (0x8931) rope segments remain, it selects a retract animation pointer from
// table 0x2f93 (loc_0c45, keyed by (0x8907)>>2 clamped to 3 plus the 0x8820 cabinet bit) and reads an
// attribute byte for this segment ((0x8931)-1 clamped to 0x1f) via rst 0x20. It merges that into the
// paired cell, clears the 0x8c30 formation record (rst 0x10), advances the cell (ix+0), and blits the
// segment (0x2e1a via loc_2e52/loc_3325). loc_2e45 leaves HL=timer address and Z.
export function loc_2f2f(m) {
  const { regs, mem } = m;

  m.push16(0x2f32); m.step(0x2e45, 17); m.call(0x2e45);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2f33, 5);
  regs.a = mem.read8(0x8931); m.step(0x2f36, 13); // 2f33  ld a,(0x8931)
  regs.and(regs.a); m.step(0x2f37, 4);
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x2f38, 5);
  m.push16(regs.hl); m.step(0x2f39, 11);
  regs.a = mem.read8(0x8907); m.step(0x2f3c, 13); // 2f39  ld a,(0x8907)
  regs.a = regs.srl(regs.a); m.step(0x2f3e, 8);
  regs.a = regs.srl(regs.a); m.step(0x2f40, 8);
  regs.cp(0x04); m.step(0x2f42, 7);
  if (regs.fC) {
    m.step(0x2f46, 12);
  } else {
    m.step(0x2f44, 7);
    regs.a = 0x03; m.step(0x2f46, 7); // 2f44  ld a,0x03 (clamp)
  }
  regs.b = regs.a; m.step(0x2f47, 4);
  regs.a = mem.read8(0x8820); m.step(0x2f4a, 13); // 2f47  ld a,(0x8820)
  regs.and(0x04); m.step(0x2f4c, 7);
  regs.rrca(); m.step(0x2f4d, 4);
  regs.add(regs.b); m.step(0x2f4e, 4);
  regs.hl = 0x2f93; m.step(0x2f51, 10);
  m.push16(0x2f54); m.step(0x0c45, 17); m.call(0x0c45); // 2f51  call 0x0c45 -> DE = table[A]
  regs.exDeHl(); m.step(0x2f55, 4);
  regs.a = mem.read8(0x8931); m.step(0x2f58, 13); // 2f55  ld a,(0x8931)
  regs.a = regs.dec8(regs.a); m.step(0x2f59, 4);
  regs.cp(0x20); m.step(0x2f5b, 7);
  if (regs.fC) {
    m.step(0x2f5f, 12);
  } else {
    m.step(0x2f5d, 7);
    regs.a = 0x1f; m.step(0x2f5f, 7); // 2f5d  ld a,0x1f (clamp)
  }
  m.push16(0x2f60); m.step(0x0020, 11); m.call(0x0020); // 2f5f  rst 0x20 (A := ptr[A])
  regs.hl = m.pop16(); m.step(0x2f61, 10); // 2f60  pop hl (timer address)
  regs.e = regs.a; m.step(0x2f62, 4);
  regs.a = regs.l; m.step(0x2f63, 4);
  regs.cp(0x28); m.step(0x2f65, 7);
  if (regs.fZ) {
    m.step(0x2f73, 12);
  } else {
    m.step(0x2f67, 7);
    regs.sub(0x02); m.step(0x2f69, 7);
    regs.l = regs.a; m.step(0x2f6a, 4);
    regs.a = mem.read8(regs.hl); m.step(0x2f6b, 7); // 2f6a  ld a,(hl)
    regs.and(0x1c); m.step(0x2f6d, 7);
    regs.add(regs.e); m.step(0x2f6e, 4);
    regs.e = regs.a; m.step(0x2f6f, 4);
    regs.a = regs.l; m.step(0x2f70, 4);
    regs.add(0x02); m.step(0x2f72, 7);
    regs.l = regs.a; m.step(0x2f73, 4);
  }
  regs.a = regs.e; m.step(0x2f74, 4);
  mem.write8(regs.hl, regs.a); m.step(0x2f75, 7); // 2f74  ld (hl),a
  regs.de = 0x0018; m.step(0x2f78, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2f79, 6);
  regs.b = mem.read8(regs.hl); m.step(0x2f7a, 7); // 2f79  ld b,(hl)
  regs.hl = 0x8c30; m.step(0x2f7d, 10);
  regs.b = (regs.b + 1) & 0xff; m.step(0x2f7e, 4);
  for (;;) {
    regs.addHl(regs.de); m.step(0x2f7f, 11);
    if (regs.djnz() !== 0) { m.step(0x2f7e, 13); continue; }
    m.step(0x2f81, 8); break;
  }
  regs.xor(regs.a); m.step(0x2f82, 4);
  regs.b = 0x18; m.step(0x2f84, 7);
  m.push16(0x2f85); m.step(0x0010, 11); m.call(0x0010); // 2f84  rst 0x10 (clear 0x18 = 0)
  regs.a = regs.inc8(regs.a); m.step(0x2f86, 4);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x2f89, 19); // 2f86  ld (ix+0),a
  m.push16(0x2f8c); m.step(0x2e52, 17); m.call(0x2e52);
  regs.de = 0x2e1a; m.step(0x2f8f, 10);
  m.push16(0x2f92); m.step(0x3325, 17); m.call(0x3325);
  m.ret();
}
