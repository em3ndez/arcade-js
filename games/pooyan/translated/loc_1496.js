// SPDX-License-Identifier: GPL-3.0-only

// loc_1496  (ROM 0x1496-0x14db) -- per-object worker (IX = the object record). It first calls
// 0x4006, then advances the object's position field (ix+0x03) by its signed step (ix+0x0a):
// if the current pos < -(step) [`cp b`, b = neg(ix+0a)] it first decrements the lap counter
// (ix+0x04), then adds the step and stores it back. B is reloaded with (ix+0x04) for the
// dispatch that follows. When the active flag (ix+0x07) is set it gates on B: B>=4 returns the
// value in (ix+0x06); B<4 zeroes the sub-state (ix+0x02) and sets the anim field (ix+0x11)=0x20.
// When (ix+0x07)==0 it gates on B: B>=2 returns immediately; B<2 runs helper 0x381e (DE=0x3bd1)
// then sets (ix+0x02)=2 and (ix+0x11)=0x28.
export function loc_1496(m) {
  const { regs, mem } = m;

  m.push16(0x1499); // 1496  call 0x4006 -- seat the return
  m.step(0x4006, 17);
  m.call(0x4006, 'per-frame object pre-update');

  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);
  m.step(0x149c, 19); // 1499  ld a,(ix+0x0a)
  regs.neg();
  m.step(0x149e, 8); // 149c  neg
  regs.b = regs.a;
  m.step(0x149f, 4); // 149e  ld b,a
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x14a2, 19); // 149f  ld a,(ix+0x03)
  regs.cp(regs.b);
  m.step(0x14a3, 4); // 14a2  cp b

  if (regs.fNC) {
    m.step(0x14a8, 12); // 14a3  jr nc,0x14a8 (taken -- pos >= -step, skip lap dec)
  } else {
    m.step(0x14a5, 7); // 14a3  jr nc (not taken)
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);
    m.step(0x14a8, 23); // 14a5  dec (ix+0x04)
  }

  // loc_14a8
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff));
  m.step(0x14ab, 19); // 14a8  add a,(ix+0x0a)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x14ae, 19); // 14ab  ld (ix+0x03),a
  regs.b = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x14b1, 19); // 14ae  ld b,(ix+0x04)
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff);
  m.step(0x14b4, 19); // 14b1  ld a,(ix+0x07)
  regs.and(regs.a);
  m.step(0x14b5, 4); // 14b4  and a

  if (regs.fZ) {
    m.step(0x14c9, 12); // 14b5  jr z,0x14c9 (taken -- object inactive)
    // loc_14c9
    regs.a = regs.b;
    m.step(0x14ca, 4); // 14c9  ld a,b
    regs.cp(0x02);
    m.step(0x14cc, 7); // 14ca  cp 0x02
    if (regs.fNC) {
      m.ret(11); // 14cc  ret nc (taken -- B >= 2)
      return;
    }
    m.step(0x14cd, 5); // 14cc  ret nc (not taken)
    regs.de = 0x3bd1;
    m.step(0x14d0, 10); // 14cd  ld de,0x3bd1
    m.push16(0x14d3); // 14d0  call 0x381e -- seat the return
    m.step(0x381e, 17);
    m.call(0x381e, 'inactive-object handler (DE=0x3bd1)');
    mem.write8((regs.ix + 0x02) & 0xffff, 0x02);
    m.step(0x14d7, 19); // 14d3  ld (ix+0x02),0x02
    mem.write8((regs.ix + 0x11) & 0xffff, 0x28);
    m.step(0x14db, 19); // 14d7  ld (ix+0x11),0x28
    m.ret(); // 14db  ret
    return;
  }
  m.step(0x14b7, 7); // 14b5  jr z (not taken -- object active)

  regs.a = regs.b;
  m.step(0x14b8, 4); // 14b7  ld a,b
  regs.cp(0x04);
  m.step(0x14ba, 7); // 14b8  cp 0x04
  if (regs.fC) {
    m.step(0x14c0, 12); // 14ba  jr c,0x14c0 (taken -- B < 4)
    // loc_14c0
    mem.write8((regs.ix + 0x02) & 0xffff, 0x00);
    m.step(0x14c4, 19); // 14c0  ld (ix+0x02),0x00
    mem.write8((regs.ix + 0x11) & 0xffff, 0x20);
    m.step(0x14c8, 19); // 14c4  ld (ix+0x11),0x20
    m.ret(); // 14c8  ret
    return;
  }
  m.step(0x14bc, 7); // 14ba  jr c (not taken -- B >= 4)

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x14bf, 19); // 14bc  ld a,(ix+0x06)
  m.ret(); // 14bf  ret
}
