// SPDX-License-Identifier: GPL-3.0-only

// loc_771d  (ROM 0x771d-0x773f) -- rst-0x28 state 0 (dispatch 0x7715[0]): arm a new object.
// (ix+0x11) is a frame countdown; while non-zero it just returns. On expiry it pulls the next
// spawn index from the ring counter (0x8d57) (read, inc), stores it as (ix+0x13), looks up a word
// from table 0x7869 (via rst 0x20 low byte + the following high byte) into (ix+0x15)/(ix+0x16),
// seeds (ix+0x0a)=0xec, then advances the state (inc (ix+2)) and FALLS THROUGH into state 1 (0x7740)
// so the freshly-armed object also runs a move step this same frame.
export function loc_771d(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x7720, 23); // 771d  dec (ix+0x11) -- frame countdown
  if (regs.fNZ) { m.ret(11); return; } // 7720  ret nz -- still counting
  m.step(0x7721, 5);

  regs.hl = 0x8d57;
  m.step(0x7724, 10); // 7721  ld hl,0x8d57 -- spawn ring counter
  regs.a = mem.read8(regs.hl);
  m.step(0x7725, 7); // 7724  ld a,(hl)
  regs.c = regs.a;
  m.step(0x7726, 4); // 7725  ld c,a
  regs.incMem8(mem, regs.hl);
  m.step(0x7727, 11); // 7726  inc (hl) -- advance ring
  mem.write8((regs.ix + 0x13) & 0xffff, regs.a);
  m.step(0x772a, 19); // 7727  (ix+0x13) := spawn index
  regs.a = regs.c;
  m.step(0x772b, 4); // 772a  ld a,c
  regs.hl = 0x7869;
  m.step(0x772e, 10); // 772b  ld hl,0x7869 -- word table
  regs.add(regs.a);
  m.step(0x772f, 4); // 772e  add a,a -- index*2
  m.push16(0x7730);
  m.step(0x0020, 11); // 772f  rst 0x20 -- A := table_0x7869[index*2] (low byte), HL += A
  m.call(0x0020);
  mem.write8((regs.ix + 0x15) & 0xffff, regs.a);
  m.step(0x7733, 19); // 7730  (ix+0x15) := word low
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x7734, 6); // 7733  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x7735, 7); // 7734  ld a,(hl) -- word high byte
  mem.write8((regs.ix + 0x16) & 0xffff, regs.a);
  m.step(0x7738, 19); // 7735  (ix+0x16) := word high
  regs.a = 0xec;
  m.step(0x773a, 7); // 7738  ld a,0xec
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);
  m.step(0x773d, 19); // 773a  (ix+0x0a) := 0xec
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x7740, 23); // 773d  inc (ix+2) -- advance state, fall into 0x7740

  return m.call(0x7740); // fall-through into state 1 (loc_7740)
}
