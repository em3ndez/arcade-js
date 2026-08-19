// SPDX-License-Identifier: GPL-3.0-only

// loc_71ce  (ROM 0x71ce-0x7286) -- eagle/arrow approach state machine. A (0x8f36) hold counter gates
// entry. It then drives the eagle animation flag byte (0x8a87) bits 2/3 from the eagle's screen X
// (0x8a84) vs the thresholds 0x59/0x60 and the sub-phase (0x8f39), and once phase (0x8f3e) is armed
// it steps an every-8-frames grid pointer: reads column/row from (0x8c96)/(0x8c94), erases the old
// cell, writes a 0x2c marker, and sets its colour attribute (0x00/0x40/0x80/0xc0) from the low bits.
// The 0x71e3 block is re-entered from 0x7204 (jr nc); 0x7287/0x7292 are tail-delegated.
export function loc_71ce(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f36;
  m.step(0x71d1, 10); // 71ce  ld hl,0x8f36
  regs.a = mem.read8(regs.hl);
  m.step(0x71d2, 7); // 71d1  ld a,(hl)
  regs.and(regs.a);
  m.step(0x71d3, 4); // 71d2  and a
  if (regs.fNZ) {
    m.step(0x71d5, 7); // 71d3  jr z,0x71d7 (not taken)
    regs.decMem8(mem, regs.hl);
    m.step(0x71d6, 11); // 71d5  dec (hl)
    m.ret(); // 71d6  ret
    return;
  }
  m.step(0x71d7, 12); // 71d3  jr z,0x71d7

  regs.hl = 0x8a99;
  m.step(0x71da, 10); // 71d7  ld hl,0x8a99
  regs.a = mem.read8(0x8c90);
  m.step(0x71dd, 13); // 71da  ld a,(0x8c90)
  regs.or(mem.read8(regs.hl));
  m.step(0x71de, 7); // 71dd  or (hl)
  regs.hl = 0x8a87;
  m.step(0x71e1, 10); // 71de  ld hl,0x8a87
  let at71e3;
  if (regs.fNZ) { m.step(0x71fd, 12); at71e3 = false; } // 71e1  jr nz,0x71fd
  else { m.step(0x71e3, 7); at71e3 = true; }

  for (;;) {
    if (at71e3) {
      regs.a = mem.read8(0x8f5b);
      m.step(0x71e6, 13); // 71e3  ld a,(0x8f5b)
      regs.and(regs.a);
      m.step(0x71e7, 4); // 71e6  and a
      if (regs.fNZ) {
        m.step(0x71f8, 12); // 71e7  jr nz,0x71f8
        mem.write8(regs.hl, regs.set(2, mem.read8(regs.hl)));
        m.step(0x71fa, 15); // 71f8  set 2,(hl)
        mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl)));
        m.step(0x71fc, 15); // 71fa  res 3,(hl)
        m.ret(); // 71fc  ret
        return;
      }
      m.step(0x71e9, 7);
      regs.a = mem.read8(0x8a84);
      m.step(0x71ec, 13); // 71e9  ld a,(0x8a84)
      regs.cp(0x60);
      m.step(0x71ee, 7); // 71ec  cp 0x60
      if (regs.fC) {
        m.step(0x71f3, 12); // 71ee  jr c,0x71f3
      } else {
        m.step(0x71f0, 7);
        mem.write8(0x8f5b, regs.a);
        m.step(0x71f3, 13); // 71f0  ld (0x8f5b),a
      }
      mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl)));
      m.step(0x71f5, 15); // 71f3  res 2,(hl)
      mem.write8(regs.hl, regs.set(3, mem.read8(regs.hl)));
      m.step(0x71f7, 15); // 71f5  set 3,(hl)
      m.ret(); // 71f7  ret
      return;
    }

    // 71fd block
    regs.a = mem.read8(0x8a84);
    m.step(0x7200, 13); // 71fd  ld a,(0x8a84)
    regs.cp(0x59);
    m.step(0x7202, 7); // 7200  cp 0x59
    if (regs.fZ) {
      m.step(0x720b, 12); // 7202  jr z,0x720b
      // 720b block
      regs.a = mem.read8(0x8f39);
      m.step(0x720e, 13); // 720b  ld a,(0x8f39)
      regs.and(regs.a);
      m.step(0x720f, 4); // 720e  and a
      if (regs.fNZ) {
        m.step(0x721b, 12); // 720f  jr nz,0x721b
      } else {
        m.step(0x7211, 7);
        regs.a = 0x01;
        m.step(0x7213, 7); // 7211  ld a,0x01
        mem.write8(0x8f39, regs.a);
        m.step(0x7216, 13); // 7213  ld (0x8f39),a
        mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl)));
        m.step(0x7218, 15); // 7216  res 2,(hl)
        mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl)));
        m.step(0x721a, 15); // 7218  res 3,(hl)
        m.ret(); // 721a  ret
        return;
      }
      // 721b block (A still = (0x8f39))
      regs.cp(0x02);
      m.step(0x721d, 7); // 721b  cp 0x02
      if (regs.fZ) {
        m.step(0x722a, 12); // 721d  jr z,0x722a
      } else {
        m.step(0x721f, 7);
        regs.a = 0x02;
        m.step(0x7221, 7); // 721f  ld a,0x02
        mem.write8(0x8f39, regs.a);
        m.step(0x7224, 13); // 7221  ld (0x8f39),a
        regs.a = 0x10;
        m.step(0x7226, 7); // 7224  ld a,0x10
        mem.write8(0x8a87, regs.a);
        m.step(0x7229, 13); // 7226  ld (0x8a87),a
        m.ret(); // 7229  ret
        return;
      }
      return loc_71ce_722a(m); // 722a
    }
    m.step(0x7204, 7);
    if (regs.fNC) { m.step(0x71e3, 12); at71e3 = true; continue; } // 7204  jr nc,0x71e3
    m.step(0x7206, 7);
    mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl)));
    m.step(0x7208, 15); // 7206  res 2,(hl)
    mem.write8(regs.hl, regs.set(3, mem.read8(regs.hl)));
    m.step(0x720a, 15); // 7208  set 3,(hl)
    m.ret(); // 720a  ret
    return;
  }
}

// 0x722a-0x7286: grid-cell placement, reached only from 0x721d (jr z). Split out so the 0x71e3
// re-entry loop above stays a plain loop.
function loc_71ce_722a(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f3e;
  m.step(0x722d, 10); // 722a  ld hl,0x8f3e
  regs.a = mem.read8(regs.hl);
  m.step(0x722e, 7); // 722d  ld a,(hl)
  regs.and(regs.a);
  m.step(0x722f, 4); // 722e  and a
  if (regs.fNZ) {
    m.step(0x7292, 10); // 722f  jp nz,0x7292
    return m.call(0x7292);
  }
  m.step(0x7232, 10);
  regs.l = 0x3b;
  m.step(0x7234, 7); // 7232  ld l,0x3b -> 0x8f3b
  regs.incMem8(mem, regs.hl);
  m.step(0x7235, 11); // 7234  inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x7236, 7); // 7235  ld a,(hl)
  regs.and(0x07);
  m.step(0x7238, 7); // 7236  and 0x07
  if (regs.fNZ) {
    m.step(0x7287, 10); // 7238  jp nz,0x7287 -- not an 8-frame boundary
    return m.call(0x7287);
  }
  m.step(0x723b, 10);
  regs.a = mem.read8(0x8c96);
  m.step(0x723e, 13); // 723b  ld a,(0x8c96)
  regs.a = regs.srl(regs.a);
  m.step(0x7240, 8); // 723e  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7242, 8); // 7240  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7244, 8); // 7242  srl a
  regs.a = regs.inc8(regs.a);
  m.step(0x7245, 4); // 7244  inc a
  regs.b = regs.a;
  m.step(0x7246, 4); // 7245  ld b,a
  regs.hl = 0x87e0;
  m.step(0x7249, 10); // 7246  ld hl,0x87e0
  regs.de = 0xffe0;
  m.step(0x724c, 10); // 7249  ld de,0xffe0
  for (;;) {
    regs.addHl(regs.de);
    m.step(0x724d, 11); // 724c  add hl,de
    if (regs.djnz() !== 0) { m.step(0x724c, 13); continue; } // 724d  djnz 0x724c
    m.step(0x724f, 8);
    break;
  }
  m.push16(0x7252);
  m.step(0x7287, 17); // 724f  call 0x7287 -- erase the old marker cell
  m.call(0x7287);
  regs.a = regs.srl(regs.a);
  m.step(0x7254, 8); // 7252  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7256, 8); // 7254  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7258, 8); // 7256  srl a
  regs.a = regs.inc8(regs.a);
  m.step(0x7259, 4); // 7258  inc a
  regs.b = regs.a;
  m.step(0x725a, 4); // 7259  ld b,a
  for (;;) {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x725b, 6); // 725a  inc hl
    if (regs.djnz() !== 0) { m.step(0x725a, 13); continue; } // 725b  djnz 0x725a
    m.step(0x725d, 8);
    break;
  }
  mem.write8(regs.hl, 0x2c);
  m.step(0x725f, 10); // 725d  ld (hl),0x2c -- marker tile
  regs.de = 0xfc00;
  m.step(0x7262, 10); // 725f  ld de,0xfc00
  regs.addHl(regs.de);
  m.step(0x7263, 11); // 7262  add hl,de -- to colour RAM
  regs.a = mem.read8(0x8c96);
  m.step(0x7266, 13); // 7263  ld a,(0x8c96)
  regs.and(0x06);
  m.step(0x7268, 7); // 7266  and 0x06
  regs.cp(0x06);
  m.step(0x726a, 7); // 7268  cp 0x06
  regs.a = mem.read8(0x8c94);
  m.step(0x726d, 13); // 726a  ld a,(0x8c94)
  if (regs.fZ) {
    m.step(0x727b, 12); // 726d  jr z,0x727b
    regs.and(0x06);
    m.step(0x727d, 7); // 727b  and 0x06
    regs.cp(0x02);
    m.step(0x727f, 7); // 727d  cp 0x02
    if (regs.fZ) {
      m.step(0x7284, 12); // 727f  jr z,0x7284
      mem.write8(regs.hl, 0xc0);
      m.step(0x7286, 10); // 7284  ld (hl),0xc0
      m.ret(); // 7286  ret
      return;
    }
    m.step(0x7281, 7);
    mem.write8(regs.hl, 0x80);
    m.step(0x7283, 10); // 7281  ld (hl),0x80
    m.ret(); // 7283  ret
    return;
  }
  m.step(0x726f, 7);
  regs.and(0x06);
  m.step(0x7271, 7); // 726f  and 0x06
  regs.cp(0x02);
  m.step(0x7273, 7); // 7271  cp 0x02
  if (regs.fZ) {
    m.step(0x7278, 12); // 7273  jr z,0x7278
    mem.write8(regs.hl, 0x40);
    m.step(0x727a, 10); // 7278  ld (hl),0x40
    m.ret(); // 727a  ret
    return;
  }
  m.step(0x7275, 7);
  mem.write8(regs.hl, 0x00);
  m.step(0x7277, 10); // 7275  ld (hl),0x00
  m.ret(); // 7277  ret
}
