// SPDX-License-Identifier: GPL-3.0-only

// loc_2bab  (ROM 0x2BAB-0x2BFA) — IX sprite-object arm. IX = object struct, IY = sprite slot;
// (ix+0x09) is a countdown reloaded to 0x08; on expiry it nudges (ix+0x02) toward a 0x80xx target,
// and when (0x8004)==0 clears the 16-byte struct at IX and the 4-byte block at 0x8058.
export function loc_2bab(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2bae, 19);
  regs.or(regs.a);
  m.step(0x2baf, 4);
  if (regs.fZ) {
    m.ret(11); // ret z -- object inactive
    return;
  }
  m.step(0x2bb0, 5);
  regs.decMem8(mem, (regs.ix + 0x09) & 0xffff);
  m.step(0x2bb3, 23);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- countdown not expired
    return;
  }
  m.step(0x2bb4, 5);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x08);
  m.step(0x2bb8, 19); // reload the countdown
  regs.l = mem.read8((regs.ix + 0x0b) & 0xffff);
  m.step(0x2bbb, 19);
  regs.h = 0x80;
  m.step(0x2bbd, 7); // HL = 0x80(ix+0x0b)
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2bc0, 19);
  regs.or(regs.a);
  m.step(0x2bc1, 4);
  if (regs.fZ) {
    m.step(0x2bd0, 12);
    return block_2bd0();
  }
  m.step(0x2bc3, 7);
  regs.a = mem.read8(regs.hl);
  m.step(0x2bc4, 7);
  regs.sub(mem.read8((regs.ix + 0x00) & 0xffff));
  m.step(0x2bc7, 19);
  regs.cp(mem.read8((regs.iy + 0x00) & 0xffff));
  m.step(0x2bca, 19);
  if (regs.fNC) {
    m.step(0x2bdd, 12);
    return block_2bdd();
  }
  m.step(0x2bcc, 7);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x2bcf, 23);
  m.ret();

  function block_2bd0() {
    regs.a = mem.read8(regs.hl);
    m.step(0x2bd1, 7);
    regs.sub(mem.read8((regs.ix + 0x01) & 0xffff));
    m.step(0x2bd4, 19);
    regs.cp(mem.read8((regs.iy + 0x00) & 0xffff));
    m.step(0x2bd7, 19);
    if (regs.fC) {
      m.step(0x2bdd, 12);
      return block_2bdd();
    }
    m.step(0x2bd9, 7);
    regs.decMem8(mem, (regs.ix + 0x02) & 0xffff);
    m.step(0x2bdc, 23);
    m.ret();
  }

  function block_2bdd() {
    regs.a = mem.read8(0x8004);
    m.step(0x2be0, 13);
    regs.or(regs.a);
    m.step(0x2be1, 4);
    if (regs.fNZ) {
      m.ret(11); // ret nz -- (0x8004)!=0, keep the struct
      return;
    }
    m.step(0x2be2, 5);
    m.push16(regs.ix);
    m.step(0x2be4, 15);
    regs.hl = m.pop16();
    m.step(0x2be5, 10); // HL = IX
    regs.d = regs.h;
    m.step(0x2be6, 4);
    regs.e = regs.l;
    m.step(0x2be7, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x2be8, 4); // DE = IX+1
    regs.bc = 0x000f;
    m.step(0x2beb, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x2bec, 7); // (IX)=0, seeds the fill
    m.ldirAt(0x2bec, 0x2bee); // clear the 16-byte object struct
    regs.hl = 0x8058;
    m.step(0x2bf1, 10);
    regs.de = 0x8059;
    m.step(0x2bf4, 10);
    regs.bc = 0x0003;
    m.step(0x2bf7, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x2bf8, 7);
    m.ldirAt(0x2bf8, 0x2bfa); // clear the 4-byte block at 0x8058
    m.ret();
  }
}
