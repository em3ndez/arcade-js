// SPDX-License-Identifier: GPL-3.0-only

// loc_6931  (ROM 0x6931-0x69ac) -- per-record spawn/init for one ix/iy record pair. Skips an already-
// active record ((ix+0)|(ix+1) bit0 SET -> ret c); spawns into an empty one. Activates both records, seeds their fields,
// arms the (0x8929) respawn delay to 0x10, and on the first spawn of a wave ((0x892d)==0) enqueues two
// display commands (rst 0x38 -> loc_0038) and paints the BCD (0x8903) count to VRAM 0x863b/0x861b, then
// bumps (0x892d). Ends in the shared pop-af/ret: the pop drops the caller's return, so control returns
// to the caller's caller (skip-return).
export function loc_6931(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x6934, 19); // ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x6937, 19); // or (ix+1)
  regs.rrca();                                   m.step(0x6938, 4);
  if (regs.fC) { return m.ret(11); }             // ret c -- record already active, skip
  m.step(0x6939, 5);

  regs.xor(regs.a);                              m.step(0x693a, 4);  // xor a
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x693d, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x6940, 19);
  regs.a = regs.inc8(regs.a);                    m.step(0x6941, 4);  // inc a -> 1
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x6944, 19); // activate ix record
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a); m.step(0x6947, 19); // activate iy record
  mem.write8((regs.ix + 0x04) & 0xffff, 0x15);   m.step(0x694b, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, 0x1e);   m.step(0x694f, 19);
  mem.write8((regs.iy + 0x03) & 0xffff, 0x80);   m.step(0x6953, 19);
  mem.write8((regs.iy + 0x05) & 0xffff, 0xa0);   m.step(0x6957, 19);
  mem.write8((regs.iy + 0x04) & 0xffff, 0x14);   m.step(0x695b, 19);
  mem.write8((regs.iy + 0x06) & 0xffff, 0x1e);   m.step(0x695f, 19);
  mem.write8((regs.iy + 0x0f) & 0xffff, 0x03);   m.step(0x6963, 19);
  mem.write8((regs.iy + 0x10) & 0xffff, 0x40);   m.step(0x6967, 19);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x24);   m.step(0x696b, 19);
  mem.write8((regs.iy + 0x09) & 0xffff, 0x24);   m.step(0x696f, 19);
  regs.de = 0x3838;                              m.step(0x6972, 10);
  m.push16(0x6975); m.step(0x381e, 17); m.call(0x381e); // call 0x381e
  regs.a = 0x10;                                 m.step(0x6977, 7);
  mem.write8(0x8929, regs.a);                    m.step(0x697a, 13); // (0x8929) := respawn delay
  regs.a = mem.read8(0x892d);                    m.step(0x697d, 13);
  regs.and(regs.a);                              m.step(0x697e, 4);
  if (regs.fNZ) {
    m.step(0x69a7, 12);                          // jr nz taken -- not the first spawn, skip the paint
  } else {
    m.step(0x6980, 7);                           // jr nz not taken -- first spawn of the wave
    regs.de = 0x0625;                            m.step(0x6983, 10);
    m.push16(0x6984); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 -> loc_0038 enqueue
    regs.e = 0x0a;                               m.step(0x6986, 7);
    m.push16(0x6987); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 -> loc_0038 enqueue
    regs.hl = 0x863b;                            m.step(0x698a, 10);
    regs.a = mem.read8(0x8903);                  m.step(0x698d, 13); // wave count
    regs.b = regs.a;                             m.step(0x698e, 4);
    regs.xor(regs.a);                            m.step(0x698f, 4);
    for (;;) { // binary (0x8903) -> BCD in A by B repeated daa-increments
      regs.add(0x01);                            m.step(0x6991, 7);
      regs.daa();                                m.step(0x6992, 4);
      if (regs.djnz() !== 0) { m.step(0x698f, 13); continue; }
      m.step(0x6994, 8);
      break;
    }
    regs.e = regs.a;                             m.step(0x6995, 4);
    regs.and(0xf0);                              m.step(0x6997, 7);  // high BCD digit
    regs.rrca();                                 m.step(0x6998, 4);
    regs.rrca();                                 m.step(0x6999, 4);
    regs.rrca();                                 m.step(0x699a, 4);
    regs.rrca();                                 m.step(0x699b, 4);
    mem.write8(regs.hl, regs.a);                 m.step(0x699c, 7);  // paint high digit
    regs.bc = 0xffe0;                            m.step(0x699f, 10);
    regs.addHl(regs.bc);                         m.step(0x69a0, 11); // hl -= 0x20 (prev VRAM column)
    regs.a = regs.e;                             m.step(0x69a1, 4);
    regs.and(0x0f);                              m.step(0x69a3, 7);  // low BCD digit
    mem.write8(regs.hl, regs.a);                 m.step(0x69a4, 7);  // paint low digit
    m.push16(0x69a7); m.step(0x0f97, 17); m.call(0x0f97); // call 0x0f97
  }

  regs.hl = 0x892d;                              m.step(0x69aa, 10);
  regs.incMem8(mem, regs.hl);                    m.step(0x69ab, 11); // (0x892d) spawn ordinal++
  regs.af = m.pop16();                           m.step(0x69ac, 10); // pop af -- drop caller return
  return m.ret();                                // ret -- to caller's caller
}
