// SPDX-License-Identifier: GPL-3.0-only
//
// loc_24db  (ROM 0x24db-0x24fa) -- 0x8a80 actor state 4 (dispatch 0x2436[4]). Frame-delay countdown;
// on expiry nudges base Y (ix+0x04) += 4 and (ix+0x06) -= 8, sets the display tile (ix+0x0f)=0x1a,
// reseeds a long frame delay (ix+0x11)=0x30, and advances the state.
export function loc_24db(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x24de, 23); // 24db  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 24de  ret nz
  m.step(0x24df, 5);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x24e2, 19); // 24df  ld a,(ix+0x04)
  regs.add(0x04); m.step(0x24e4, 7); // 24e2  add a,0x04
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x24e7, 19); // 24e4  ld (ix+0x04),a
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x24ea, 19); // 24e7  ld a,(ix+0x06)
  regs.sub(0x08); m.step(0x24ec, 7); // 24ea  sub 0x08
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x24ef, 19); // 24ec  ld (ix+0x06),a
  mem.write8((regs.ix + 0x0f) & 0xffff, 0x1a); m.step(0x24f3, 19); // 24ef  ld (ix+0x0f),0x1a
  mem.write8((regs.ix + 0x11) & 0xffff, 0x30); m.step(0x24f7, 19); // 24f3  ld (ix+0x11),0x30
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x24fa, 23); // 24f7  inc (ix+0x02)
  m.ret(); // 24fa  ret
}
