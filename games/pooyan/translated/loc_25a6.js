// SPDX-License-Identifier: GPL-3.0-only
//
// loc_25a6  (ROM 0x25a6-0x26bc) -- the pull-rope / lift sprite driver at sprite pointer (0x8932).
// Gated on (0x8907) bit0 (else it hands off to loc_2d66). Runs a 0x10-frame timer (0x8f09), then on
// the (0x8920) direction flag and the (0x8934) segment count it either extends the rope upward (ix
// path, block 0x2608), clears/retracts it (iy path, block 0x2635), or leaves it steady (block
// 0x266b). All three converge on the 0x2678 loop that stamps the B chosen sprite records (source HL,
// 0x40-byte stride via DE=0xffc0) then, when (0x8920)==0, appends a display command via loc_3307.
// loc_0f19/0f11/0f49/3307 are pattern A. Source tables 0x2754..0x2774 are ROM data.
export function loc_25a6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907); m.step(0x25a9, 13); // 25a6  ld a,(0x8907)
  regs.bit(0, regs.a); m.step(0x25ab, 8);
  if (regs.fZ) { m.step(0x2d66, 10); return m.call(0x2d66); }
  m.step(0x25ae, 10); // 25ab  jp z,0x2d66 (not taken)
  regs.hl = 0x8f09; m.step(0x25b1, 10);
  regs.decMem8(mem, regs.hl); m.step(0x25b2, 11); // 25b1  dec (hl)
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x25b3, 5);
  mem.write8(regs.hl, 0x10); m.step(0x25b5, 10); // 25b3  ld (hl),0x10
  regs.a = mem.read8(0x8902); m.step(0x25b8, 13); // 25b5  ld a,(0x8902)
  regs.and(regs.a); m.step(0x25b9, 4);
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x25ba, 5);
  regs.c = regs.a; m.step(0x25bb, 4);
  regs.a = mem.read8(0x8920); m.step(0x25be, 13); // 25bb  ld a,(0x8920)
  regs.and(regs.a); m.step(0x25bf, 4);

  if (regs.fNZ) {
    m.step(0x2635, 12); // 25bf  jr nz,0x2635  (retract / iy path)
    regs.a = mem.read8(0x8f0a); m.step(0x2638, 13); // 2635  ld a,(0x8f0a)
    regs.bit(0, regs.a); m.step(0x263a, 8);
    regs.hl = 0x2770; m.step(0x263d, 10);
    if (regs.fZ) {
      m.step(0x2642, 12);
    } else {
      m.step(0x263f, 7);
      regs.hl = 0x2774; m.step(0x2642, 10);
    }
    regs.iy = mem.read16(0x8932); m.step(0x2646, 20); // 2642  ld iy,(0x8932)
    regs.a = (regs.iy >> 8) & 0xff; m.step(0x2648, 8);
    regs.sub(0x04); m.step(0x264a, 7);
    regs.iy = (regs.iy & 0x00ff) | (regs.a << 8); m.step(0x264c, 8);
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x264f, 19); // 264c  ld a,(iy+0)
    regs.cp(0x80); m.step(0x2651, 7);
    regs.b = 0x07; m.step(0x2653, 7);
    if (regs.fZ) {
      m.step(0x2678, 12); // 2653  jr z,0x2678 (already blanked)
    } else {
      m.step(0x2655, 7);
      regs.a = 0x80; m.step(0x2657, 7);
      regs.de = 0xffc0; m.step(0x265a, 10);
      for (;;) {
        mem.write8((regs.iy + 0x00) & 0xffff, regs.a); m.step(0x265d, 19); // 265a  ld (iy+0),a
        mem.write8((regs.iy + 0x01) & 0xffff, regs.a); m.step(0x2660, 19); // 265d  ld (iy+1),a
        regs.addIy(regs.de); m.step(0x2662, 15);
        if (regs.djnz() !== 0) { m.step(0x265a, 13); continue; }
        m.step(0x2664, 8); break;
      }
      m.push16(0x2667); m.step(0x0f49, 17); m.call(0x0f49); // 2664  call 0x0f49 (pattern A)
      regs.b = 0x07; m.step(0x2669, 7);
      m.step(0x2678, 12);
    }
  } else {
    m.step(0x25c1, 7);
    regs.a = regs.c; m.step(0x25c2, 4);
    regs.de = 0x8f05; m.step(0x25c5, 10);
    regs.hl = 0x8934; m.step(0x25c8, 10);
    regs.cp(mem.read8(regs.hl)); m.step(0x25c9, 7); // 25c8  cp (hl)

    let to25eb = false;
    if (regs.fZ) {
      m.step(0x25db, 12);
    } else {
      m.step(0x25cb, 7);
      regs.a = mem.read8(regs.de); m.step(0x25cc, 7); // 25cb  ld a,(de)
      regs.and(regs.a); m.step(0x25cd, 4);
      if (regs.fNZ) {
        m.step(0x25db, 12);
      } else {
        m.step(0x25cf, 7);
        regs.incMem8(mem, regs.hl); m.step(0x25d0, 11); // 25cf  inc (hl)
        regs.a = regs.inc8(regs.a); m.step(0x25d1, 4);
        mem.write8(regs.de, regs.a); m.step(0x25d2, 7); // 25d1  ld (de),a
        regs.de = 0x86e3; m.step(0x25d5, 10);
        mem.write16(0x8932, regs.de); m.step(0x25d9, 20); // 25d5  ld (0x8932),de
        m.step(0x25eb, 12); to25eb = true;
      }
    }
    if (!to25eb) {
      regs.a = mem.read8(regs.de); m.step(0x25dc, 7); // 25db  ld a,(de)
      regs.and(regs.a); m.step(0x25dd, 4);
      if (regs.fZ) {
        m.step(0x25eb, 12);
      } else {
        m.step(0x25df, 7);
        regs.a = mem.read8(0x8932); m.step(0x25e2, 13); // 25df  ld a,(0x8932)
        regs.cp(0xa3); m.step(0x25e4, 7);
        if (regs.fNZ) {
          m.step(0x25eb, 12);
        } else {
          m.step(0x25e6, 7);
          regs.xor(regs.a); m.step(0x25e7, 4);
          mem.write8(regs.de, regs.a); m.step(0x25e8, 7); // 25e7  ld (de),a
          mem.write8(0x8f63, regs.a); m.step(0x25eb, 13); // 25e8  ld (0x8f63),a
        }
      }
    }
    // 25eb -- pick sprite count B from the segment tile at (0x8934)
    regs.a = mem.read8(regs.hl); m.step(0x25ec, 7); // 25eb  ld a,(hl)
    regs.cp(0x07); m.step(0x25ee, 7);
    if (regs.fC) {
      m.step(0x25fe, 12);
    } else {
      m.step(0x25f0, 7);
      regs.a = mem.read8(0x8932); m.step(0x25f3, 13); // 25f0  ld a,(0x8932)
      regs.cp(0xc3); m.step(0x25f5, 7);
      if (regs.fNZ) {
        m.step(0x25fc, 12);
      } else {
        m.step(0x25f7, 7);
        regs.a = 0x01; m.step(0x25f9, 7);
        mem.write8(0x8f04, regs.a); m.step(0x25fc, 13); // 25f9  ld (0x8f04),a
      }
      regs.a = 0x07; m.step(0x25fe, 7);
    }
    regs.b = regs.a; m.step(0x25ff, 4);
    regs.de = 0xffc0; m.step(0x2602, 10);
    regs.a = mem.read8(0x8f05); m.step(0x2605, 13); // 2602  ld a,(0x8f05)
    regs.and(regs.a); m.step(0x2606, 4);
    if (regs.fZ) {
      m.step(0x266b, 12); // 2606  jr z,0x266b (steady)
      regs.a = mem.read8(0x8f0a); m.step(0x266e, 13); // 266b  ld a,(0x8f0a)
      regs.bit(0, regs.a); m.step(0x2670, 8);
      regs.hl = 0x2768; m.step(0x2673, 10);
      if (regs.fZ) {
        m.step(0x2678, 12);
      } else {
        m.step(0x2675, 7);
        regs.hl = 0x276c; m.step(0x2678, 10);
      }
    } else {
      m.step(0x2608, 7);
      regs.hl = 0x8f09; m.step(0x260b, 10);
      mem.write8(regs.hl, 0x1c); m.step(0x260d, 10); // 260b  ld (hl),0x1c
      regs.de = 0xffe0; m.step(0x2610, 10);
      regs.ix = mem.read16(0x8932); m.step(0x2614, 20); // 2610  ld ix,(0x8932)
      regs.addIx(regs.de); m.step(0x2616, 15);
      mem.write16(0x8932, regs.ix); m.step(0x261a, 20); // 2616  ld (0x8932),ix
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x261b, 6); // 261a  inc hl -> 0x8f0a
      regs.bit(0, mem.read8(regs.hl)); m.step(0x261d, 12); // 261b  bit 0,(hl)
      regs.hl = 0x276c; m.step(0x2620, 10);
      if (regs.fNZ) {
        m.step(0x2625, 12);
      } else {
        m.step(0x2622, 7);
        regs.hl = 0x2768; m.step(0x2625, 10);
      }
      mem.write8((regs.ix + 0x40) & 0xffff, 0x10); m.step(0x2629, 19); // 2625  ld (ix+0x40),0x10
      mem.write8((regs.ix + 0x41) & 0xffff, 0x10); m.step(0x262d, 19); // 2629  ld (ix+0x41),0x10
      m.push16(0x2630); m.step(0x0f19, 17); m.call(0x0f19); // 262d  call 0x0f19 (pattern A)
      m.push16(0x2633); m.step(0x0f11, 17); m.call(0x0f11); // 2630  call 0x0f11 (pattern A)
      m.step(0x2678, 12);
    }
  }

  // 2678 -- stamp B sprite records from source (HL), 0x40-byte record stride (2*0x20 via DE=0xffc0)
  regs.ix = mem.read16(0x8932); m.step(0x267c, 20); // 2678  ld ix,(0x8932)
  regs.de = 0xffc0; m.step(0x267f, 10);
  for (;;) {
    m.push16(regs.hl); m.step(0x2680, 11);
    regs.a = mem.read8(regs.hl); m.step(0x2681, 7); // 2680  ld a,(hl)
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x2684, 19); // 2681  ld (ix+0),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2685, 6);
    regs.a = mem.read8(regs.hl); m.step(0x2686, 7); // 2685  ld a,(hl)
    mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x2689, 19); // 2686  ld (ix+1),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x268a, 6);
    regs.a = mem.read8(regs.hl); m.step(0x268b, 7); // 268a  ld a,(hl)
    mem.write8((regs.ix + 0x20) & 0xffff, regs.a); m.step(0x268e, 19); // 268b  ld (ix+0x20),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x268f, 6);
    regs.a = mem.read8(regs.hl); m.step(0x2690, 7); // 268f  ld a,(hl)
    mem.write8((regs.ix + 0x21) & 0xffff, regs.a); m.step(0x2693, 19); // 2690  ld (ix+0x21),a
    regs.addIx(regs.de); m.step(0x2695, 15);
    regs.hl = m.pop16(); m.step(0x2696, 10);
    if (regs.djnz() !== 0) { m.step(0x267f, 13); continue; }
    m.step(0x2698, 8); break;
  }
  regs.a = mem.read8(0x8920); m.step(0x269b, 13); // 2698  ld a,(0x8920)
  regs.and(regs.a); m.step(0x269c, 4);
  if (regs.fNZ) {
    m.step(0x26b8, 12);
  } else {
    m.step(0x269e, 7);
    regs.de = 0xffdf; m.step(0x26a1, 10);
    regs.addIx(regs.de); m.step(0x26a3, 15);
    m.push16(regs.ix); m.step(0x26a5, 15);
    regs.hl = m.pop16(); m.step(0x26a6, 10);
    regs.a = mem.read8(0x8f0a); m.step(0x26a9, 13); // 26a6  ld a,(0x8f0a)
    regs.bit(0, regs.a); m.step(0x26ab, 8);
    regs.de = 0x2754; m.step(0x26ae, 10);
    if (regs.fZ) {
      m.step(0x26b3, 12);
    } else {
      m.step(0x26b0, 7);
      regs.de = 0x275e; m.step(0x26b3, 10);
    }
    m.push16(0x26b6); m.step(0x3307, 17); m.call(0x3307); // 26b3  call 0x3307 (pattern A)
    mem.write8(regs.hl, 0x10); m.step(0x26b8, 10); // 26b6  ld (hl),0x10
  }
  regs.hl = 0x8f0a; m.step(0x26bb, 10);
  regs.incMem8(mem, regs.hl); m.step(0x26bc, 11); // 26bb  inc (hl)
  m.ret();
}
