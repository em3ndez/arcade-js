// SPDX-License-Identifier: GPL-3.0-only

// loc_3b87  (ROM 0x3b87-0x3bd0) -- reached by `jp z,0x3b87` from loc_39af's mover. Handles the
// horizontal-travel phase of an actor whose (ix+0x08) bit0 is clear: advance the sub-position
// (ix+0x03) by velocity (ix+0x0a) carrying into (ix+0x04). If bit0 of (ix+0x08) is set instead,
// hand off to loc_0x39ba. With (ix+0x07)==0 it runs the "land" test (loc_3bca); otherwise, once the
// integer position (ix+0x04) reaches 0x1d it retires the actor (advance state, clear flags, queue
// the 0x3829 animation via loc_381e); before 0x1d it continues via loc_0x39e0.
// The 0x3bd1-0x3be2 bytes after the ret are animation-table data (loc_381e sequences), not code.
export function loc_3b87(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3b8b, 20);
  if (regs.fNZ) { m.step(0x39ba, 10); return m.call(0x39ba); }
  m.step(0x3b8e, 10);

  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x3b91, 19);
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff)); m.step(0x3b94, 19);
  if (regs.fNC) {
    m.step(0x3b99, 12);
  } else {
    m.step(0x3b96, 7);
    regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x3b99, 23);
  }
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x3b9c, 19);
  regs.b = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x3b9f, 19);
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3ba2, 19);
  regs.and(regs.a); m.step(0x3ba3, 4);
  if (regs.fZ) {
    m.step(0x3bca, 10);
    // loc_3bca: with (ix+7)==0, if position b >= 0x1b run the land handler loc_3553
    regs.a = regs.b; m.step(0x3bcb, 4);
    regs.cp(0x1b); m.step(0x3bcd, 7);
    if (regs.fNC) {
      m.push16(0x3bd0); m.step(0x3553, 17); m.call(0x3553);
    } else {
      m.step(0x3bd0, 10);
    }
    m.ret();
    return;
  }
  m.step(0x3ba6, 10);

  regs.a = regs.b; m.step(0x3ba7, 4);
  regs.cp(0x1d); m.step(0x3ba9, 7);
  if (regs.fNC) {
    m.step(0x3bae, 12); // 3ba9  jr nc,0x3bae -- reached 0x1d, retire
  } else {
    m.step(0x3bab, 7);
    m.step(0x39e0, 10); return m.call(0x39e0); // 3bab  jp 0x39e0 -- keep travelling
  }

  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x3bb1, 23); // 3bae  inc (ix+0x02) -- next state
  regs.xor(regs.a); m.step(0x3bb2, 4);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x3bb5, 19);
  mem.write8((regs.ix + 0x01) & 0xffff, 0x01); m.step(0x3bb9, 19);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.res(0, mem.read8((regs.ix + 0x08) & 0xffff))); m.step(0x3bbd, 23);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x20); m.step(0x3bc1, 19);
  mem.write8((regs.ix + 0x14) & 0xffff, regs.a); m.step(0x3bc4, 19);
  regs.de = 0x3829; m.step(0x3bc7, 10);
  m.step(0x381e, 10); return m.call(0x381e); // 3bc7  jp 0x381e -- queue retire animation, tail-ret
}
