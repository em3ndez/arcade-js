// SPDX-License-Identifier: GPL-3.0-only

// loc_7595  (ROM 0x7595-0x7617) -- try to launch one object into a free slot; called per record
// by loc_756d with IX = the 0x8ae0-table record, IY = the paired 0x8b70-table record.
// If the slot is already active (low bit of (ix+0)|(ix+1) set) it just returns to loc_756d's loop.
// Otherwise it initialises the IX record (and, from wave 2 on, the IY record: state, a table-2h
// lookup at (0x8922) via rst 0x20, and a word from loc_0c45's 0x5657 table), advances the wave
// counter (0x892d), reseeds the frame delay (0x8929) from the table at 0x761e, queues a display
// command via 0x381e, then does `pop af`/`ret`: it discards loc_756d's in-loop return and returns
// to loc_756d's OWN caller -- a caller-skip that aborts the remaining 8-record loop after a launch.
// Data tables 0x7618 (6 bytes, indexed by (0x8922)) and 0x761e (3 bytes) live just past this ret.
export function loc_7595(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x7598, 19); // 7595  ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff));
  m.step(0x759b, 19); // 7598  or (ix+1)
  regs.rrca();
  m.step(0x759c, 4);
  if (regs.fC) { m.ret(11); return true; } // 759c  ret c -- slot occupied; loop continues
  m.step(0x759d, 5);

  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x75a1, 19); // 759d  (ix+0) := 1 -- mark active
  regs.xor(regs.a);
  m.step(0x75a2, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x75a5, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  m.step(0x75a8, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, 0x15);
  m.step(0x75ac, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, 0x1e);
  m.step(0x75b0, 19);
  regs.a = mem.read8(0x892d);
  m.step(0x75b3, 13); // 75b0  ld a,(0x892d) -- wave index
  regs.cp(0x02);
  m.step(0x75b5, 7);
  if (regs.fC) {
    m.step(0x75e8, 12); // 75b5  jr c,0x75e8 -- waves 0/1 skip the IY record
  } else {
    m.step(0x75b7, 7);
    regs.xor(regs.a);
    m.step(0x75b8, 4);
    mem.write8((regs.iy + 0x03) & 0xffff, regs.a);
    m.step(0x75bb, 19);
    mem.write8((regs.iy + 0x05) & 0xffff, regs.a);
    m.step(0x75be, 19);
    mem.write8((regs.iy + 0x04) & 0xffff, 0x14);
    m.step(0x75c2, 19);
    mem.write8((regs.iy + 0x06) & 0xffff, 0x1e);
    m.step(0x75c6, 19);
    regs.hl = 0x7618;
    m.step(0x75c9, 10);
    regs.a = mem.read8(0x8922);
    m.step(0x75cc, 13);
    m.push16(0x75cd);
    m.step(0x0020, 11); // 75cc  rst 0x20 -- A := table_0x7618[(0x8922)]
    m.call(0x0020);
    mem.write8((regs.iy + 0x17) & 0xffff, regs.a);
    m.step(0x75d0, 19); // 75cd  (iy+0x17) := lookup
    regs.hl = 0x5657;
    m.step(0x75d3, 10);
    m.push16(0x75d6);
    m.step(0x0c45, 17); // 75d3  call 0x0c45 -- DE := 0x5657 table[A]
    m.call(0x0c45);
    mem.write8((regs.iy + 0x0c) & 0xffff, regs.e);
    m.step(0x75d9, 19);
    mem.write8((regs.iy + 0x0d) & 0xffff, regs.d);
    m.step(0x75dc, 19);
    mem.write8((regs.iy + 0x09) & 0xffff, 0x18);
    m.step(0x75e0, 19);
    mem.write8((regs.iy + 0x00) & 0xffff, 0x01);
    m.step(0x75e4, 19);
    regs.hl = 0x8922;
    m.step(0x75e7, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x75e8, 11); // 75e7  inc (0x8922)
  }

  mem.write8((regs.ix + 0x09) & 0xffff, 0x18);
  m.step(0x75ec, 19); // 75e8  (ix+9) := 0x18
  regs.a = mem.read8(0x892d);
  m.step(0x75ef, 13);
  regs.cp(0x02);
  m.step(0x75f1, 7);
  if (regs.fC) {
    m.step(0x75f5, 12); // 75f1  jr c,0x75f5
  } else {
    m.step(0x75f3, 7);
    regs.a = 0x02;
    m.step(0x75f5, 7); // 75f3  ld a,0x02 -- clamp index to 2
  }
  regs.hl = 0x761e;
  m.step(0x75f8, 10);
  m.push16(0x75f9);
  m.step(0x0020, 11); // 75f8  rst 0x20 -- A := table_0x761e[min((0x892d),2)]
  m.call(0x0020);
  mem.write8(0x8929, regs.a);
  m.step(0x75fc, 13); // 75f9  (0x8929) := reseed frame delay
  regs.hl = 0x892d;
  m.step(0x75ff, 10);
  regs.incMem8(mem, regs.hl);
  m.step(0x7600, 11); // 75ff  inc (0x892d) -- next wave
  regs.a = mem.read8(regs.hl);
  m.step(0x7601, 7);
  regs.cp(0x03);
  m.step(0x7603, 7);
  regs.de = 0x76dd;
  m.step(0x7606, 10);
  if (regs.fNC) {
    m.step(0x760b, 12); // 7606  jr nc,0x760b -- wave >= 3 keeps 0x76dd
  } else {
    m.step(0x7608, 7);
    regs.de = 0x76d4;
    m.step(0x760b, 10); // 7608  ld de,0x76d4
  }
  m.push16(0x760e);
  m.step(0x381e, 17); // 760b  call 0x381e -- queue display command DE
  m.call(0x381e);
  regs.a = mem.read8(0x892d);
  m.step(0x7611, 13);
  regs.add(regs.a);
  m.step(0x7612, 4); // 7611  add a,a
  regs.add(regs.a);
  m.step(0x7613, 4); // 7612  add a,a -- A = wave*4
  mem.write8((regs.iy + 0x11) & 0xffff, regs.a);
  m.step(0x7616, 19); // 7613  (iy+0x11) := wave*4
  regs.af = m.pop16();
  m.step(0x7617, 10); // 7616  pop af -- drop loc_756d's in-loop return
  m.ret(); // 7617  ret -- return to loc_756d's caller (caller-skip)
  return false; // signal the skip: loc_756d must abort its 8-record loop
}
