// SPDX-License-Identifier: GPL-3.0-only
//
// ROM 0x39af-0x3a63 = one actor state handler (rst-0x28 dispatch target dw 0x39af at 0x33a5)
// with two extra externally-jumped entry points: loc_39ba (jp nz from 0x3b8b) and loc_39e0
// (jp from 0x3bab). Split into the exported entries the seam can dispatch (loc_39af, loc_39ba,
// loc_39e0, plus the two small tail blocks loc_3a48/loc_3a51 reached by jr from loc_39ba);
// the internal convergent labels 0x39fb and 0x3a08 are module-local helpers (l_39fb/l_3a08).
// Un-annotated instruction addresses = the previous m.step's nextAddr arg.
//
// loc_39af: run the animation player, then act only on odd frames of (0x8907); else jp 0x3b87.
export function loc_39af(m) {
  const { regs, mem } = m;

  m.push16(0x39b2);
  m.step(0x4006, 17); // 39af  call 0x4006 -- animation player
  m.call(0x4006);
  regs.a = mem.read8(0x8907);
  m.step(0x39b5, 13); // 39b2  ld a,(0x8907)
  regs.and(0x01);
  m.step(0x39b7, 7); // 39b5  and 0x01
  if (regs.fZ) { m.step(0x3b87, 10); return m.call(0x3b87); } // 39b7  jp z,0x3b87
  m.step(0x39ba, 10);
  return m.call(0x39ba); // fall through to loc_39ba
}

// loc_39ba: advance the actor's vertical position (ix+0x03) by its velocity (ix+0x0a), carrying
// into (ix+0x04); then branch on the state byte (ix+0x07) and the new (ix+0x04) high position.
export function loc_39ba(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);
  m.step(0x39bd, 19); // 39ba  ld a,(ix+0x0a)
  regs.neg();
  m.step(0x39bf, 8); // 39bd  neg
  regs.b = regs.a;
  m.step(0x39c0, 4); // 39bf  ld b,a
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x39c3, 19); // 39c0  ld a,(ix+0x03)
  regs.cp(regs.b);
  m.step(0x39c4, 4); // 39c3  cp b
  if (regs.fNC) {
    m.step(0x39c9, 12); // 39c4  jr nc,0x39c9
  } else {
    m.step(0x39c6, 7);
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);
    m.step(0x39c9, 23); // 39c6  dec (ix+0x04)
  }
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff));
  m.step(0x39cc, 19); // 39c9  add a,(ix+0x0a)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x39cf, 19); // 39cc  ld (ix+0x03),a
  regs.b = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x39d2, 19); // 39cf  ld b,(ix+0x04)
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff);
  m.step(0x39d5, 19); // 39d2  ld a,(ix+0x07)
  regs.and(regs.a);
  m.step(0x39d6, 4); // 39d5  and a
  if (regs.fZ) { m.step(0x3a51, 12); return m.call(0x3a51); } // 39d6  jr z,0x3a51
  m.step(0x39d8, 7);
  regs.a = regs.b;
  m.step(0x39d9, 4); // 39d8  ld a,b
  regs.cp(0x04);
  m.step(0x39db, 7); // 39d9  cp 0x04
  if (regs.fC) { m.step(0x3a48, 12); return m.call(0x3a48); } // 39db  jr c,0x3a48
  m.step(0x39dd, 7);
  regs.cp(0x10);
  m.step(0x39df, 7); // 39dd  cp 0x10
  if (regs.fC) { m.ret(11); return; } // 39df  ret c
  m.step(0x39e0, 5);
  return m.call(0x39e0); // fall through to loc_39e0
}

// loc_39e0: gate the "fire / drop" decision on the level counters (0x8d7d, 0x8907, 0x8908),
// routing into the shared tail l_3a08 (or l_39fb for the mid gate).
export function loc_39e0(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d7d;
  m.step(0x39e3, 10); // 39e0  ld hl,0x8d7d
  regs.a = mem.read8(regs.hl);
  m.step(0x39e4, 7); // 39e3  ld a,(hl)
  regs.cp(0x0e);
  m.step(0x39e6, 7); // 39e4  cp 0x0e
  if (regs.fNC) { m.step(0x3a08, 12); return l_3a08(m); } // 39e6  jr nc,0x3a08
  m.step(0x39e8, 7);
  regs.a = mem.read8(0x8907);
  m.step(0x39eb, 13); // 39e8  ld a,(0x8907)
  regs.cp(0x06);
  m.step(0x39ed, 7); // 39eb  cp 0x06
  if (regs.fNC) { m.step(0x39fb, 12); return l_39fb(m); } // 39ed  jr nc,0x39fb
  m.step(0x39ef, 7);
  regs.a = mem.read8(0x8908);
  m.step(0x39f2, 13); // 39ef  ld a,(0x8908)
  regs.cp(0x03);
  m.step(0x39f4, 7); // 39f2  cp 0x03
  if (regs.fC) { m.step(0x39fb, 12); return l_39fb(m); } // 39f4  jr c,0x39fb
  m.step(0x39f6, 7);
  regs.a = mem.read8(regs.hl);
  m.step(0x39f7, 7); // 39f6  ld a,(hl) -- (0x8d7d)
  regs.cp(0x08);
  m.step(0x39f9, 7); // 39f7  cp 0x08
  if (regs.fNC) { m.step(0x3a08, 12); return l_3a08(m); } // 39f9  jr nc,0x3a08
  m.step(0x39fb, 7);
  return l_39fb(m); // fall through to 0x39fb
}

// l_39fb (0x39fb) -- extra gate on the difficulty DSW (0x8820) and (ix+0x06); shared by loc_39e0.
function l_39fb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8820);
  m.step(0x39fe, 13); // 39fb  ld a,(0x8820)
  regs.cp(0x07);
  m.step(0x3a00, 7); // 39fe  cp 0x07
  if (regs.fZ) { m.step(0x3a08, 12); return l_3a08(m); } // 3a00  jr z,0x3a08
  m.step(0x3a02, 7);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x3a05, 19); // 3a02  ld a,(ix+0x06)
  regs.cp(0x10);
  m.step(0x3a07, 7); // 3a05  cp 0x10
  if (regs.fNC) { m.ret(11); return; } // 3a07  ret nc
  m.step(0x3a08, 5);
  return l_3a08(m); // fall through to 0x3a08
}

// l_3a08 (0x3a08) -- the shared tail: bail on global gates (0x8d75, ix+0x08), tick the fire
// cooldown (ix+0x15), else compute the target column from the launcher position (0x8842/0x881f)
// and the frame parity (0x8907); if it matches (ix+0x04) delegate to loc_3a6c (spawn a shot).
function l_3a08(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d75);
  m.step(0x3a0b, 13); // 3a08  ld a,(0x8d75)
  regs.and(regs.a);
  m.step(0x3a0c, 4); // 3a0b  and a
  if (regs.fNZ) { m.ret(11); return; } // 3a0c  ret nz
  m.step(0x3a0d, 5);
  regs.a = mem.read8((regs.ix + 0x08) & 0xffff);
  m.step(0x3a10, 19); // 3a0d  ld a,(ix+0x08)
  regs.and(0xf0);
  m.step(0x3a12, 7); // 3a10  and 0xf0
  if (regs.fZ) { m.ret(11); return; } // 3a12  ret z
  m.step(0x3a13, 5);
  regs.a = mem.read8((regs.ix + 0x15) & 0xffff);
  m.step(0x3a16, 19); // 3a13  ld a,(ix+0x15)
  regs.and(regs.a);
  m.step(0x3a17, 4); // 3a16  and a
  if (regs.fNZ) {
    m.step(0x3a19, 7); // 3a17  jr z,0x3a1d (not taken)
    regs.decMem8(mem, (regs.ix + 0x15) & 0xffff);
    m.step(0x3a1c, 23); // 3a19  dec (ix+0x15)
    m.ret(); // 3a1c  ret
    return;
  }
  m.step(0x3a1d, 12);
  regs.a = mem.read8(0x8842);
  m.step(0x3a20, 13); // 3a1d  ld a,(0x8842)
  regs.c = regs.a;
  m.step(0x3a21, 4); // 3a20  ld c,a
  regs.a = mem.read8(0x881f);
  m.step(0x3a24, 13); // 3a21  ld a,(0x881f)
  regs.b = regs.a;
  m.step(0x3a25, 4); // 3a24  ld b,a
  regs.and(regs.a);
  m.step(0x3a26, 4); // 3a25  and a
  regs.a = regs.c;
  m.step(0x3a27, 4); // 3a26  ld a,c
  if (regs.fNZ) {
    m.step(0x3a2b, 12); // 3a27  jr nz,0x3a2b
  } else {
    m.step(0x3a29, 7);
    regs.neg();
    m.step(0x3a2b, 8); // 3a29  neg
  }
  regs.rrca();
  m.step(0x3a2c, 4); // 3a2b  rrca
  regs.rrca();
  m.step(0x3a2d, 4); // 3a2c  rrca
  regs.rrca();
  m.step(0x3a2e, 4); // 3a2d  rrca
  regs.and(0x1f);
  m.step(0x3a30, 7); // 3a2e  and 0x1f
  regs.c = regs.a;
  m.step(0x3a31, 4); // 3a30  ld c,a
  regs.a = regs.b;
  m.step(0x3a32, 4); // 3a31  ld a,b
  regs.and(regs.a);
  m.step(0x3a33, 4); // 3a32  and a
  if (regs.fNZ) {
    m.step(0x3a37, 12); // 3a33  jr nz,0x3a37
  } else {
    m.step(0x3a35, 7);
    regs.c = regs.dec8(regs.c);
    m.step(0x3a36, 4); // 3a35  dec c
    regs.c = regs.dec8(regs.c);
    m.step(0x3a37, 4); // 3a36  dec c
  }
  regs.a = mem.read8(0x8907);
  m.step(0x3a3a, 13); // 3a37  ld a,(0x8907)
  regs.b = regs.a;
  m.step(0x3a3b, 4); // 3a3a  ld b,a
  regs.bit(0, regs.a);
  m.step(0x3a3d, 8); // 3a3b  bit 0,a
  regs.a = regs.c;
  m.step(0x3a3e, 4); // 3a3d  ld a,c
  if (regs.fZ) {
    m.step(0x3a42, 12); // 3a3e  jr z,0x3a42
  } else {
    m.step(0x3a40, 7);
    regs.add(0x04);
    m.step(0x3a42, 7); // 3a40  add a,0x04
  }
  regs.cp(mem.read8((regs.ix + 0x04) & 0xffff));
  m.step(0x3a45, 19); // 3a42  cp (ix+0x04)
  if (regs.fZ) { m.step(0x3a6c, 12); return m.call(0x3a6c); } // 3a45  jr z,0x3a6c (spawn a shot)
  m.step(0x3a47, 7);
  m.ret(); // 3a47  ret
}

// loc_3a48 (0x3a48) -- reset the actor sub-state (ix+0x02)=0 and reload timer (ix+0x11)=0x20.
export function loc_3a48(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x02) & 0xffff, 0x00);
  m.step(0x3a4c, 19); // 3a48  ld (ix+0x02),0x00
  mem.write8((regs.ix + 0x11) & 0xffff, 0x20);
  m.step(0x3a50, 19); // 3a4c  ld (ix+0x11),0x20
  m.ret(); // 3a50  ret
}

// loc_3a51 (0x3a51) -- when B (the (ix+0x04) high position) < 2, seat the 0x3bd1 animation via
// loc_381e and set sub-state (ix+0x02)=2, timer (ix+0x11)=0x28.
export function loc_3a51(m) {
  const { regs, mem } = m;

  regs.a = regs.b;
  m.step(0x3a52, 4); // 3a51  ld a,b
  regs.cp(0x02);
  m.step(0x3a54, 7); // 3a52  cp 0x02
  if (regs.fNC) { m.ret(11); return; } // 3a54  ret nc
  m.step(0x3a55, 5);
  regs.de = 0x3bd1;
  m.step(0x3a58, 10); // 3a55  ld de,0x3bd1
  m.push16(0x3a5b);
  m.step(0x381e, 17); // 3a58  call 0x381e
  m.call(0x381e);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x02);
  m.step(0x3a5f, 19); // 3a5b  ld (ix+0x02),0x02
  mem.write8((regs.ix + 0x11) & 0xffff, 0x28);
  m.step(0x3a63, 19); // 3a5f  ld (ix+0x11),0x28
  m.ret(); // 3a63  ret
}
