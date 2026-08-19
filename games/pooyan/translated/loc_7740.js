// SPDX-License-Identifier: GPL-3.0-only

// loc_7740  (ROM 0x7740-0x778f) -- rst-0x28 state 1 (dispatch 0x7715[1]): advance one object.
// call 0x4006 refreshes work state, then (ix+0x03) is stepped by the signed speed (ix+0x0a): if the
// position underflows past neg(speed) the sub-position (ix+0x04) borrows (dec). While (ix+0x04)&0x1f
// stays >= 9 it just returns; when it drops below 9 the object crosses into the next cell -- advance
// state (inc (ix+2)), reload the frame timer (ix+0x11)=0x18, run 0x0ef1, look up a word for sprite
// (ix+0x17) via 0x0c45 (table 0x41b1) and queue a display command via 0x381e. Finally a 5-byte
// checksum guard over 0x0bb3 (masked &0x1f, summed through rst 0x20): if it clears it `ret z`s,
// otherwise it bumps the tamper counter (0x89e9).
export function loc_7740(m) {
  const { regs, mem } = m;

  m.push16(0x7743);
  m.step(0x4006, 17); // 7740  call 0x4006
  m.call(0x4006);
  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);
  m.step(0x7746, 19); // 7743  ld a,(ix+0x0a) -- speed
  regs.neg();
  m.step(0x7748, 8); // 7746  neg
  regs.b = regs.a;
  m.step(0x7749, 4); // 7748  ld b,a
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x774c, 19); // 7749  ld a,(ix+0x03) -- position
  regs.cp(regs.b);
  m.step(0x774d, 4); // 774c  cp b
  if (regs.fNC) {
    m.step(0x7752, 12); // 774d  jr nc,0x7752 -- no borrow
  } else {
    m.step(0x774f, 7);
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);
    m.step(0x7752, 23); // 774f  dec (ix+0x04) -- borrow sub-position
  }

  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff));
  m.step(0x7755, 19); // 7752  add a,(ix+0x0a)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x7758, 19); // 7755  ld (ix+0x03),a
  regs.b = regs.a;
  m.step(0x7759, 4); // 7758  ld b,a
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x775c, 19); // 7759  ld a,(ix+0x04)
  regs.and(0x1f);
  m.step(0x775e, 7); // 775c  and 0x1f
  regs.cp(0x09);
  m.step(0x7760, 7); // 775e  cp 0x09
  if (regs.fNC) { m.ret(11); return; } // 7760  ret nc -- not across a cell yet
  m.step(0x7761, 5);

  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x7764, 23); // 7761  inc (ix+2) -- advance state
  mem.write8((regs.ix + 0x11) & 0xffff, 0x18);
  m.step(0x7768, 19); // 7764  ld (ix+0x11),0x18
  m.push16(0x776b);
  m.step(0x0ef1, 17); // 7768  call 0x0ef1
  m.call(0x0ef1);
  regs.a = mem.read8((regs.ix + 0x17) & 0xffff);
  m.step(0x776e, 19); // 776b  ld a,(ix+0x17)
  regs.hl = 0x41b1;
  m.step(0x7771, 10); // 776e  ld hl,0x41b1
  m.push16(0x7774);
  m.step(0x0c45, 17); // 7771  call 0x0c45 -- DE := table_0x41b1[A]
  m.call(0x0c45);
  m.push16(0x7777);
  m.step(0x381e, 17); // 7774  call 0x381e -- queue display command
  m.call(0x381e);
  regs.de = 0x0bb3;
  m.step(0x777a, 10); // 7777  ld de,0x0bb3 -- guard table
  regs.b = 0x05;
  m.step(0x777c, 7); // 777a  ld b,0x05
  regs.xor(regs.a);
  m.step(0x777d, 4); // 777c  xor a
  regs.l = regs.a;
  m.step(0x777e, 4); // 777d  ld l,a
  regs.h = regs.a;
  m.step(0x777f, 4); // 777e  ld h,a -- HL = 0 accumulator

  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x7780, 7); // 777f  ld a,(de)
    regs.and(0x1f);
    m.step(0x7782, 7); // 7780  and 0x1f
    m.push16(0x7783);
    m.step(0x0020, 11); // 7782  rst 0x20 -- HL += A; A := (HL)
    m.call(0x0020);
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x7784, 6); // 7783  inc de
    if (regs.djnz() !== 0) { m.step(0x777f, 13); continue; } // 7784  djnz 0x777f
    m.step(0x7786, 8);
    break;
  }

  regs.a = regs.l;
  m.step(0x7787, 4); // 7786  ld a,l
  regs.add(regs.h);
  m.step(0x7788, 4); // 7787  add a,h
  regs.add(0xc7);
  m.step(0x778a, 7); // 7788  add a,0xc7
  if (regs.fZ) { m.ret(11); return; } // 778a  ret z -- guard passed
  m.step(0x778b, 5);

  regs.hl = 0x89e9;
  m.step(0x778e, 10); // 778b  ld hl,0x89e9
  regs.incMem8(mem, regs.hl);
  m.step(0x778f, 11); // 778e  inc (hl) -- tamper counter
  m.ret(); // 778f  ret
}
