// SPDX-License-Identifier: GPL-3.0-only

// loc_7881  (ROM 0x7881-0x78ff) -- periodic self-integrity routine dispatched via the pointer at
// 0x771b. Decrements the (IX+0x11) frame countdown and returns until it hits 0. Then:
//  (1) ROM check: 9 blocks x 32 bytes from 0x0779, running 16-bit sum in DE, each block's cumulative
//      sum compared to the 9-word table at 0x7900 (via IY). Any mismatch tail-jumps to the shared
//      `ret` at 0x780e, aborting to the caller.
//  (2) sets state selector (0x8e51)=2, then a serpentine 16-bit sum in HL over videoRAM from 0x8548
//      (two 12-cell columns). If (L + H + 0xa6) != 0 it tail-jumps to code 0x0320 (tamper); else it
//      clears two spans via rst 0x10 and re-inits the actor slot through loc_77c8, then returns.
// FD-prefixed iyl/iyh ops are the undocumented 8T forms. Each m.step carries its landing address.
export function loc_7881(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x7884, 23); // 7881  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 7884  ret nz  -- act only every Nth frame
  m.step(0x7885, 5); // 7884  ret nz (not taken)

  regs.iy = 0x7900;
  m.step(0x7889, 14); // 7885  ld iy,0x7900  (expected-sum table)
  regs.hl = 0x0779;
  m.step(0x788c, 10); // 7889  ld hl,0x0779
  regs.de = 0x0000;
  m.step(0x788f, 10); // 788c  ld de,0x0000  (16-bit sum)
  regs.c = 0x09;
  m.step(0x7891, 7); // 788f  ld c,0x09  (9 blocks)

  for (;;) {
    regs.b = 0x20;
    m.step(0x7893, 7); // 7891  ld b,0x20  (32 bytes/block)
    for (;;) {
      regs.a = mem.read8(regs.hl);
      m.step(0x7894, 7); // 7893  ld a,(hl)
      regs.add(regs.e);
      m.step(0x7895, 4); // 7894  add a,e
      regs.e = regs.a;
      m.step(0x7896, 4); // 7895  ld e,a
      if (regs.fNC) {
        m.step(0x7899, 12); // 7896  jr nc
      } else {
        m.step(0x7898, 7);
        regs.d = regs.inc8(regs.d);
        m.step(0x7899, 4); // 7898  inc d  -- carry into high byte
      }
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x789a, 6); // 7899  inc hl
      if (regs.djnz() !== 0) { m.step(0x7893, 13); continue; } // 789a  djnz 0x7893
      m.step(0x789c, 8);
      break;
    }
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
    m.step(0x789f, 19); // 789c  ld a,(iy+0)
    regs.cp(regs.e);
    m.step(0x78a0, 4); // 789f  cp e
    if (regs.fNZ) { m.step(0x780e, 10); m.ret(); return; } // 78a0  jp nz,0x780e (shared ret)
    m.step(0x78a3, 10); // 78a0  jp nz (not taken)
    regs.a = mem.read8((regs.iy + 0x01) & 0xffff);
    m.step(0x78a6, 19); // 78a3  ld a,(iy+1)
    regs.cp(regs.d);
    m.step(0x78a7, 4); // 78a6  cp d
    if (regs.fNZ) { m.step(0x780e, 10); m.ret(); return; } // 78a7  jp nz,0x780e (shared ret)
    m.step(0x78aa, 10); // 78a7  jp nz (not taken)
    regs.a = regs.iy & 0xff;
    m.step(0x78ac, 8); // 78aa  ld a,iyl
    regs.add(0x02);
    m.step(0x78ae, 7); // 78ac  add a,0x02  (advance IY by 2)
    if (regs.fNC) {
      m.step(0x78b2, 12); // 78ae  jr nc
    } else {
      m.step(0x78b0, 7);
      regs.iy = (((regs.inc8((regs.iy >> 8) & 0xff)) << 8) | (regs.iy & 0xff)) & 0xffff;
      m.step(0x78b2, 8); // 78b0  inc iyh
    }
    regs.iy = (regs.iy & 0xff00) | (regs.a & 0xff);
    m.step(0x78b4, 8); // 78b2  ld iyl,a
    regs.c = regs.dec8(regs.c);
    m.step(0x78b5, 4); // 78b4  dec c
    if (regs.fNZ) { m.step(0x7891, 12); continue; } // 78b5  jr nz,0x7891
    m.step(0x78b7, 7); // 78b5  jr nz (not taken)
    break;
  }

  regs.a = 0x02;
  m.step(0x78b9, 7); // 78b7  ld a,0x02
  mem.write8(0x8e51, regs.a);
  m.step(0x78bc, 13); // 78b9  ld (0x8e51),a  -- state selector
  regs.iy = 0x8548;
  m.step(0x78c0, 14); // 78bc  ld iy,0x8548
  regs.hl = 0x0000;
  m.step(0x78c3, 10); // 78c0  ld hl,0x0000  (16-bit sum)
  regs.de = 0x0020;
  m.step(0x78c6, 10); // 78c3  ld de,0x0020  (column step, down)
  regs.c = 0x04;
  m.step(0x78c8, 7); // 78c6  ld c,0x04

  for (;;) {
    regs.b = 0x0c;
    m.step(0x78ca, 7); // 78c8  ld b,0x0c  (12 cells/column)
    for (;;) {
      regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
      m.step(0x78cd, 19); // 78ca  ld a,(iy+0)
      regs.add(regs.l);
      m.step(0x78ce, 4); // 78cd  add a,l
      if (regs.fNC) {
        m.step(0x78d1, 12); // 78ce  jr nc
      } else {
        m.step(0x78d0, 7);
        regs.h = regs.inc8(regs.h);
        m.step(0x78d1, 4); // 78d0  inc h
      }
      regs.l = regs.a;
      m.step(0x78d2, 4); // 78d1  ld l,a
      regs.addIy(regs.de);
      m.step(0x78d4, 15); // 78d2  add iy,de
      if (regs.djnz() !== 0) { m.step(0x78ca, 13); continue; } // 78d4  djnz 0x78ca
      m.step(0x78d6, 8);
      break;
    }
    const cBit0 = regs.bit(0, regs.c);
    m.step(0x78d8, 8); // 78d6  bit 0,c
    if (cBit0) {
      m.step(0x78e2, 12); // 78d8  jr nz,0x78e2
      for (;;) {
        regs.c = regs.dec8(regs.c);
        m.step(0x78e3, 4); // 78e2  dec c
        if (regs.fZ) { m.step(0x78ec, 12); break; } // 78e3  jr z,0x78ec
        m.step(0x78e5, 7); // 78e3  jr z (not taken)
        regs.de = 0xfbff;
        m.step(0x78e8, 10); // 78e5  ld de,0xfbff
        regs.addIy(regs.de);
        m.step(0x78ea, 15); // 78e8  add iy,de
        m.step(0x78e2, 12); // 78ea  jr 0x78e2
      }
      break; // reached 0x78ec
    }
    m.step(0x78da, 7); // 78d8  jr nz (not taken)
    regs.de = 0xffe0;
    m.step(0x78dd, 10); // 78da  ld de,0xffe0  (next column, up)
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x78df, 10); // 78dd  inc iy
    regs.c = regs.dec8(regs.c);
    m.step(0x78e0, 4); // 78df  dec c
    m.step(0x78c8, 12); // 78e0  jr 0x78c8
  }

  regs.a = regs.l;
  m.step(0x78ed, 4); // 78ec  ld a,l
  regs.add(regs.h);
  m.step(0x78ee, 4); // 78ed  add a,h
  regs.add(0xa6);
  m.step(0x78f0, 7); // 78ee  add a,0xa6
  if (regs.fNZ) { m.step(0x0320, 10); return m.call(0x0320); } // 78f0  jp nz,0x0320 (tamper)
  m.step(0x78f3, 10); // 78f0  jp nz (not taken)
  regs.hl = 0x8ae0;
  m.step(0x78f6, 10); // 78f3  ld hl,0x8ae0
  regs.xor(regs.a);
  m.step(0x78f7, 4); // 78f6  xor a
  regs.b = regs.a;
  m.step(0x78f8, 4); // 78f7  ld b,a  (B=0 -> rst 0x10 fills 256)

  m.push16(0x78f9);
  m.step(0x0010, 11); // 78f8  rst 0x10 (fill 256 bytes)
  m.call(0x0010);
  regs.b = 0x37;
  m.step(0x78fb, 7); // 78f9  ld b,0x37
  m.push16(0x78fc);
  m.step(0x0010, 11); // 78fb  rst 0x10 (fill 0x37 bytes)
  m.call(0x0010);
  m.push16(0x78ff);
  m.step(0x77c8, 17); // 78fc  call 0x77c8
  m.call(0x77c8);
  m.ret(); // 78ff  ret
}
