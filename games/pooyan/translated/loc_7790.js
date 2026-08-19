// SPDX-License-Identifier: GPL-3.0-only

// loc_7790  (ROM 0x7790-0x77c7) -- rst-0x28 state 2 (dispatch 0x7715[2]): draw one object, twice.
// call 0x4006 refreshes work state; (ix+0x11) is a frame timer -- while non-zero it just returns.
// On expiry it looks up a char-data word for sprite (ix+0x13) via 0x0c45 (table 0x7821), takes the
// object's screen pointer (ix+0x15/0x16) and blits through 0x780f; then repeats with table 0x7841
// at the pointer - 0x0400 (the row above). Finally it sets the "drawn" flag (0x8d58)=1 if it was 0,
// then FALLS THROUGH into loc_77c8 (which clears the object record).
export function loc_7790(m) {
  const { regs, mem } = m;

  m.push16(0x7793);
  m.step(0x4006, 17); // 7790  call 0x4006
  m.call(0x4006);
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x7796, 23); // 7793  dec (ix+0x11) -- frame timer
  if (regs.fNZ) { m.ret(11); return; } // 7796  ret nz -- still counting
  m.step(0x7797, 5);

  regs.a = mem.read8((regs.ix + 0x13) & 0xffff);
  m.step(0x779a, 19); // 7797  ld a,(ix+0x13) -- sprite index
  regs.hl = 0x7821;
  m.step(0x779d, 10); // 779a  ld hl,0x7821 -- char-data table
  m.push16(0x77a0);
  m.step(0x0c45, 17); // 779d  call 0x0c45 -- DE := table_0x7821[A]
  m.call(0x0c45);
  regs.l = mem.read8((regs.ix + 0x15) & 0xffff);
  m.step(0x77a3, 19); // 77a0  ld l,(ix+0x15)
  regs.h = mem.read8((regs.ix + 0x16) & 0xffff);
  m.step(0x77a6, 19); // 77a3  ld h,(ix+0x16) -- HL = screen pointer
  m.push16(0x77a9);
  m.step(0x780f, 17); // 77a6  call 0x780f -- blit DE at HL
  m.call(0x780f);

  regs.hl = 0x7841;
  m.step(0x77ac, 10); // 77a9  ld hl,0x7841 -- second char-data table
  regs.a = mem.read8((regs.ix + 0x13) & 0xffff);
  m.step(0x77af, 19); // 77ac  ld a,(ix+0x13)
  m.push16(0x77b2);
  m.step(0x0c45, 17); // 77af  call 0x0c45 -- DE := table_0x7841[A]
  m.call(0x0c45);
  regs.l = mem.read8((regs.ix + 0x15) & 0xffff);
  m.step(0x77b5, 19); // 77b2  ld l,(ix+0x15)
  regs.h = mem.read8((regs.ix + 0x16) & 0xffff);
  m.step(0x77b8, 19); // 77b5  ld h,(ix+0x16)
  regs.bc = 0xfc00;
  m.step(0x77bb, 10); // 77b8  ld bc,0xfc00 -- -0x400 (row above)
  regs.addHl(regs.bc);
  m.step(0x77bc, 11); // 77bb  add hl,bc
  m.push16(0x77bf);
  m.step(0x780f, 17); // 77bc  call 0x780f -- blit DE at HL-0x400
  m.call(0x780f);

  regs.hl = 0x8d58;
  m.step(0x77c2, 10); // 77bf  ld hl,0x8d58
  regs.a = mem.read8(regs.hl);
  m.step(0x77c3, 7); // 77c2  ld a,(hl)
  regs.and(regs.a);
  m.step(0x77c4, 4); // 77c3  and a
  if (regs.fNZ) {
    m.step(0x77c8, 12); // 77c4  jr nz,0x77c8 -- flag already set
  } else {
    m.step(0x77c6, 7);
    mem.write8(regs.hl, 0x01);
    m.step(0x77c8, 10); // 77c6  ld (hl),0x01 -- set drawn flag
  }

  return m.call(0x77c8); // fall-through into loc_77c8 (clear the record)
}
