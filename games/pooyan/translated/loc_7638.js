// SPDX-License-Identifier: GPL-3.0-only
//
// ROM range 0x7638-0x76af = the per-entry animation tick invoked by loc_7627's walk: the dispatcher
// loc_7638 plus the three state handlers it selects (0->loc_7644, 1->loc_7675, 2->loc_76a6). The
// handlers return a BOOLEAN per the caller-skip convention: true = a plain ret back into loc_7627's
// loop; false = a `pop af; ret` that discarded loc_7627's call return and unwound to loc_7627's own
// caller, aborting the walk. loc_7638 tail-dispatches, so that boolean flows straight back to it.
// Un-annotated instruction addresses = the previous m.step's nextAddr arg.

const DISPATCH_763E = "0x763e (ix-tick states 0..2: 7644 7675 76a6)";

// loc_7638  (ROM 0x7638-0x7643) -- dispatch on (ix+2)&3 through the rst-0x28 word table at 0x763e.
export function loc_7638(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 2) & 0xffff);
  m.step(0x763b, 19); // 7638  ld a,(ix+0x02)
  regs.and(0x03);
  m.step(0x763d, 7); // 763b  and 0x03
  m.push16(0x763e);
  m.step(0x0028, 11); // 763d  rst 0x28 -- pushes table base 0x763e; loc_0028 does the indexed jump
  return m.call(0x0028, DISPATCH_763E);
}

// loc_7644  (ROM 0x7644-0x7674) -- state 0: while the entry is active ((ix+0)!=0), advance its
// (ix+5) sub-position by (ix+9), rolling frame counter (ix+6) on underflow; once (ix+6) reaches 6
// RESET all 14 entries' state byte (ix+2) to 1 and CALLER-SKIP to abort loc_7627's walk.
export function loc_7644(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0) & 0xffff);
  m.step(0x7647, 19); // 7644  ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x7648, 4); // 7647  and a
  if (regs.fZ) { m.ret(11); return true; } // 7648  ret z -- inactive entry
  m.step(0x7649, 5);
  m.push16(0x764c);
  m.step(0x4006, 17); // 7649  call 0x4006
  m.call(0x4006);
  regs.a = mem.read8((regs.ix + 5) & 0xffff);
  m.step(0x764f, 19); // 764c  ld a,(ix+0x05)
  regs.sub(mem.read8((regs.ix + 9) & 0xffff));
  m.step(0x7652, 19); // 764f  sub (ix+0x09)
  if (regs.fC) {
    m.step(0x7654, 7); // 7652  jr nc not taken (borrow)
    regs.decMem8(mem, (regs.ix + 6) & 0xffff);
    m.step(0x7657, 23); // 7654  dec (ix+0x06)
  } else {
    m.step(0x7657, 12); // 7652  jr nc,0x7657
  }
  mem.write8((regs.ix + 5) & 0xffff, regs.a);
  m.step(0x765a, 19); // 7657  ld (ix+0x05),a
  regs.a = mem.read8((regs.ix + 6) & 0xffff);
  m.step(0x765d, 19); // 765a  ld a,(ix+0x06)
  regs.cp(0x06);
  m.step(0x765f, 7); // 765d  cp 0x06
  if (regs.fNC) { m.ret(11); return true; } // 765f  ret nc -- frame < 6, still animating
  m.step(0x7660, 5);
  regs.a = 0x20;
  m.step(0x7662, 7); // 7660  ld a,0x20
  mem.write8(0x892e, regs.a);
  m.step(0x7665, 13); // 7662  ld (0x892e),a
  regs.de = 0x0018;
  m.step(0x7668, 10); // 7665  ld de,0x0018
  regs.b = 0x0e;
  m.step(0x766a, 7); // 7668  ld b,0x0e
  regs.a = 0x01;
  m.step(0x766c, 7); // 766a  ld a,0x01
  for (;;) {
    mem.write8((regs.ix + 2) & 0xffff, regs.a);
    m.step(0x766f, 19); // 766c  ld (ix+0x02),a
    regs.addIx(regs.de);
    m.step(0x7671, 15); // 766f  add ix,de
    regs.djnz();
    if (regs.b) { m.step(0x766c, 13); continue; } // 7671  djnz 0x766c
    m.step(0x7673, 8);
    break;
  }
  regs.af = m.pop16();
  m.step(0x7674, 10); // 7673  pop af -- discard loc_7627's call-0x7638 return
  m.ret(); // 7674  ret -- to loc_7627's caller (caller-skip)
  return false;
}

// loc_7675  (ROM 0x7675-0x76a5) -- state 1: count the shared 0x892e timer down; while non-zero,
// just decrement it and ret. At zero, re-seed 8 entries at 0x8ae2 to state 2, clear the 6 at 0x8ba2,
// set (0x8d57)=0 and sub-state (0x8e51)=8, then CALLER-SKIP to abort loc_7627's walk.
export function loc_7675(m) {
  const { regs, mem } = m;

  m.push16(0x7678);
  m.step(0x4006, 17); // 7675  call 0x4006
  m.call(0x4006);
  regs.hl = 0x892e;
  m.step(0x767b, 10); // 7678  ld hl,0x892e
  regs.a = mem.read8(regs.hl);
  m.step(0x767c, 7); // 767b  ld a,(hl)
  regs.and(regs.a);
  m.step(0x767d, 4); // 767c  and a
  if (regs.fZ) {
    m.step(0x7681, 12); // 767d  jr z,0x7681 -- timer expired
  } else {
    m.step(0x767f, 7); // 767d  jr z not taken
    regs.decMem8(mem, regs.hl);
    m.step(0x7680, 11); // 767f  dec (hl)
    m.ret(); // 7680  ret
    return true;
  }
  regs.a = 0x02;
  m.step(0x7683, 7); // 7681  ld a,0x02
  regs.hl = 0x8ae2;
  m.step(0x7686, 10); // 7683  ld hl,0x8ae2
  regs.de = 0x0018;
  m.step(0x7689, 10); // 7686  ld de,0x0018
  regs.b = 0x08;
  m.step(0x768b, 7); // 7689  ld b,0x08
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x768c, 7); // 768b  ld (hl),a -- seed state 2
    regs.addHl(regs.de);
    m.step(0x768d, 11); // 768c  add hl,de
    regs.djnz();
    if (regs.b) { m.step(0x768b, 13); continue; } // 768d  djnz 0x768b
    m.step(0x768f, 8);
    break;
  }
  regs.xor(regs.a);
  m.step(0x7690, 4); // 768f  xor a
  regs.hl = 0x8ba2;
  m.step(0x7693, 10); // 7690  ld hl,0x8ba2
  regs.de = 0x0018;
  m.step(0x7696, 10); // 7693  ld de,0x0018
  regs.b = 0x06;
  m.step(0x7698, 7); // 7696  ld b,0x06
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x7699, 7); // 7698  ld (hl),a -- clear
    regs.addHl(regs.de);
    m.step(0x769a, 11); // 7699  add hl,de
    regs.djnz();
    if (regs.b) { m.step(0x7698, 13); continue; } // 769a  djnz 0x7698
    m.step(0x769c, 8);
    break;
  }
  mem.write8(0x8d57, regs.a);
  m.step(0x769f, 13); // 769c  ld (0x8d57),a
  regs.a = 0x08;
  m.step(0x76a1, 7); // 769f  ld a,0x08
  mem.write8(0x8e51, regs.a);
  m.step(0x76a4, 13); // 76a1  ld (0x8e51),a -- sub-state := 8
  regs.af = m.pop16();
  m.step(0x76a5, 10); // 76a4  pop af -- discard loc_7627's call-0x7638 return
  m.ret(); // 76a5  ret -- caller-skip
  return false;
}

// loc_76a6  (ROM 0x76a6-0x76ae) -- state 2: gate on (0x8d58); while non-zero, ret; otherwise call
// 0x4006 and ret. Never caller-skips, so it always takes the plain (true) return.
export function loc_76a6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d58);
  m.step(0x76a9, 13); // 76a6  ld a,(0x8d58)
  regs.and(regs.a);
  m.step(0x76aa, 4); // 76a9  and a
  if (regs.fNZ) { m.ret(11); return true; } // 76aa  ret nz
  m.step(0x76ab, 5);
  m.push16(0x76ae);
  m.step(0x4006, 17); // 76ab  call 0x4006
  m.call(0x4006);
  m.ret(); // 76ae  ret
  return true;
}
