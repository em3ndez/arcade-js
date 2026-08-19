// SPDX-License-Identifier: GPL-3.0-only

// loc_72e1  (ROM 0x72e1-0x733b) -- eagle-wave seeder. Runs only once video RAM flag (0x8c90) is clear.
// Sets the launch flag (0x8f3a)=1 and bumps the wave index (0x8f3d); on the 4th wave it just re-arms
// the outer phase (0x8f38) and the hold (0x8f36)=0x20. Otherwise it initialises 2*(0x8f3d) records of
// the 0x8ae0 table (stride 0x18) from the 4-byte-per-record parameter table at 0x7409 -- state=1,
// plus fields (ix+6/0x10/4/0x0f); records with bit3 of IXL set get (ix+3)=0x80 -- then latches the
// record count into (0x8f38)/(0x8f39).
export function loc_72e1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8c90);
  m.step(0x72e4, 13); // 72e1  ld a,(0x8c90)
  regs.and(regs.a);
  m.step(0x72e5, 4); // 72e4  and a
  if (regs.fNZ) { m.ret(11); return; } // 72e5  ret nz
  m.step(0x72e6, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x72e7, 4); // 72e6  inc a
  mem.write8(0x8f3a, regs.a);
  m.step(0x72ea, 13); // 72e7  ld (0x8f3a),a -- launch flag = 1
  regs.hl = 0x8f3d;
  m.step(0x72ed, 10); // 72ea  ld hl,0x8f3d
  regs.incMem8(mem, regs.hl);
  m.step(0x72ee, 11); // 72ed  inc (hl) -- next wave
  regs.a = mem.read8(regs.hl);
  m.step(0x72ef, 7); // 72ee  ld a,(hl)
  regs.cp(0x04);
  m.step(0x72f1, 7); // 72ef  cp 0x04
  if (regs.fNZ) {
    m.step(0x72fb, 12); // 72f1  jr nz,0x72fb
  } else {
    m.step(0x72f3, 7);
    regs.l = 0x38;
    m.step(0x72f5, 7); // 72f3  ld l,0x38 -> 0x8f38
    regs.incMem8(mem, regs.hl);
    m.step(0x72f6, 11); // 72f5  inc (hl)
    regs.l = 0x36;
    m.step(0x72f8, 7); // 72f6  ld l,0x36 -> 0x8f36
    mem.write8(regs.hl, 0x20);
    m.step(0x72fa, 10); // 72f8  ld (hl),0x20
    m.ret(); // 72fa  ret
    return;
  }

  regs.add(regs.a);
  m.step(0x72fc, 4); // 72fb  add a,a -- 2*(0x8f3d)
  mem.write8(0x8f3c, regs.a);
  m.step(0x72ff, 13); // 72fc  ld (0x8f3c),a
  regs.b = regs.a;
  m.step(0x7300, 4); // 72ff  ld b,a
  regs.hl = 0x7409;
  m.step(0x7303, 10); // 7300  ld hl,0x7409 -- parameter table
  regs.de = 0x0018;
  m.step(0x7306, 10); // 7303  ld de,0x0018
  regs.ix = 0x8ae0;
  m.step(0x730a, 14); // 7306  ld ix,0x8ae0
  for (;;) {
    mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
    m.step(0x730e, 19); // 730a  ld (ix+0x00),0x01 -- active, state 1
    regs.a = mem.read8(regs.hl);
    m.step(0x730f, 7); // 730e  ld a,(hl)
    mem.write8((regs.ix + 0x06) & 0xffff, regs.a);
    m.step(0x7312, 19); // 730f  ld (ix+0x06),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x7313, 6); // 7312  inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x7314, 7); // 7313  ld a,(hl)
    mem.write8((regs.ix + 0x10) & 0xffff, regs.a);
    m.step(0x7317, 19); // 7314  ld (ix+0x10),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x7318, 6); // 7317  inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x7319, 7); // 7318  ld a,(hl)
    mem.write8((regs.ix + 0x04) & 0xffff, regs.a);
    m.step(0x731c, 19); // 7319  ld (ix+0x04),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x731d, 6); // 731c  inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x731e, 7); // 731d  ld a,(hl)
    mem.write8((regs.ix + 0x0f) & 0xffff, regs.a);
    m.step(0x7321, 19); // 731e  ld (ix+0x0f),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x7322, 6); // 7321  inc hl
    regs.a = regs.ix & 0xff;
    m.step(0x7324, 8); // 7322  ld a,ixl
    regs.bit(3, regs.a);
    m.step(0x7326, 8); // 7324  bit 3,a
    if (regs.fZ) {
      m.step(0x732c, 12); // 7326  jr z,0x732c
    } else {
      m.step(0x7328, 7);
      mem.write8((regs.ix + 0x03) & 0xffff, 0x80);
      m.step(0x732c, 19); // 7328  ld (ix+0x03),0x80
    }
    mem.write8((regs.ix + 0x05) & 0xffff, 0x80);
    m.step(0x7330, 19); // 732c  ld (ix+0x05),0x80
    regs.addIx(regs.de);
    m.step(0x7332, 15); // 7330  add ix,de
    if (regs.djnz() !== 0) { m.step(0x730a, 13); continue; } // 7332  djnz 0x730a
    m.step(0x7334, 8);
    break;
  }
  regs.a = regs.b;
  m.step(0x7335, 4); // 7334  ld a,b -- B=0 after the loop
  regs.hl = 0x8f38;
  m.step(0x7338, 10); // 7335  ld hl,0x8f38
  mem.write8(regs.hl, regs.a);
  m.step(0x7339, 7); // 7338  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x733a, 6); // 7339  inc hl -> 0x8f39
  mem.write8(regs.hl, regs.a);
  m.step(0x733b, 7); // 733a  ld (hl),a
  m.ret(); // 733b  ret
}
