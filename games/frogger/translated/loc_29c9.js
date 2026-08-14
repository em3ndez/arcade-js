// SPDX-License-Identifier: GPL-3.0-only

// loc_29c9  (ROM 0x29C9-0x29F8) — IX sprite-object animation arm: count down the (ix+0x08) frame timer,
// on expiry step the (ix+0x06) phase (1 wraps to 4), read table 0x2CD5[phase], OR the (ix+0x05) flip
// bits, and stage the IY sprite tile/attr pair.
export function loc_29c9(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x08) & 0xffff);
  m.step(0x29cc, 23); // dec (ix+0x08) -- frame timer
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not yet expired
  m.step(0x29cd, 5);

  mem.write8((regs.ix + 0x08) & 0xffff, 0x0c);
  m.step(0x29d1, 19); // ld (ix+0x08),0x0c -- reload
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x29d4, 19);
  regs.or(regs.a);
  m.step(0x29d5, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z -- phase 0 is inactive
  m.step(0x29d6, 5);

  regs.a = regs.dec8(regs.a);
  m.step(0x29d7, 4);
  if (regs.fNZ) { m.step(0x29db, 12); return block_29db(); } // jr nz
  m.step(0x29d9, 7);
  regs.a = 0x04;
  m.step(0x29db, 7); // ld a,0x04 -- wrap phase 1 -> 4
  return block_29db();

  function block_29db() {
    mem.write8((regs.ix + 0x06) & 0xffff, regs.a);
    m.step(0x29de, 19); // ld (ix+0x06),a -- new phase
    regs.l = regs.a;
    m.step(0x29df, 4);
    regs.h = 0x00;
    m.step(0x29e1, 7);
    regs.de = 0x2cd5;
    m.step(0x29e4, 10);
    regs.addHl(regs.de);
    m.step(0x29e5, 11); // add hl,de -- HL = 0x2cd5 + phase
    regs.a = mem.read8(regs.hl);
    m.step(0x29e6, 7); // ld a,(hl) -- the phase tile
    regs.or(mem.read8((regs.ix + 0x05) & 0xffff));
    m.step(0x29e9, 19); // or (ix+0x05) -- fold in flip bits
    mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
    m.step(0x29ec, 19); // ld (iy+0x01),a -- sprite tile
    regs.a = regs.inc8(regs.a);
    m.step(0x29ed, 4);
    mem.write8((regs.iy + 0x05) & 0xffff, regs.a);
    m.step(0x29f0, 19); // ld (iy+0x05),a -- 2nd tile (+1)
    mem.write8((regs.iy + 0x02) & 0xffff, 0x04);
    m.step(0x29f4, 19);
    mem.write8((regs.iy + 0x06) & 0xffff, 0x04);
    m.step(0x29f8, 19);
    m.ret(10);
  }
}
