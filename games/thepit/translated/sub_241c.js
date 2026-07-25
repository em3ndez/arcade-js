// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_241c  (ROM 0x241c-0x24ce) -- frame-gated tile-column animation step (The Pit).
 *
 * Bails while a mode/phase byte at 0x8010 is below 0x0A. Otherwise counts down the
 * per-step frame timer at 0x8067; only when it reaches 1 does the step run. When it
 * runs it fixes up the two tiles above the write pointer at 0x8065 (turning an 0xAE
 * marker into 0xFE/0xFD, else 0x24), then classifies the tile AT the pointer and
 * either advances/shifts the 3-tile window (tail-jumping to 0x23e8) or, at a
 * wall/edge tile (0x24/0x33/0x32/0x30 family), walks the pointer forward by 0x20
 * writing 0x31 until it hits the 0x93C0 row boundary, updates state at
 * 0x807B/0x810D/0x811E, and tail-jumps to 0x4C6B. (Role is best-effort from the code;
 * addresses and control flow are exact.)
 *
 *   241c  3a 10 80     ld   a,(0x8010)
 *   241f  fe 0a        cp   0x0a
 *   2421  d8           ret  c
 *   2422  3a 67 80     ld   a,(0x8067)
 *   2425  3d           dec  a
 *   2426  28 04        jr   z,0x242c
 *   2428  32 67 80     ld   (0x8067),a
 *   242b  c0           ret  nz
 * loc_242c:
 *   242c  cd 8b 4c     call 0x4c8b
 *   242f  dd 2a 65 80  ld   ix,(0x8065)
 *   2433  dd 7e e0     ld   a,(ix-0x20)
 *   2436  fe ae        cp   0xae
 *   2438  20 0a        jr   nz,0x2444
 *   243a  dd 36 e0 fe  ld   (ix-0x20),0xfe
 *   243e  dd 36 c0 fd  ld   (ix-0x40),0xfd
 *   2442  18 04        jr   0x2448
 * loc_2444:
 *   2444  dd 36 e0 24  ld   (ix-0x20),0x24
 * loc_2448:
 *   2448  dd 7e 00     ld   a,(ix+0x00)
 *   244b  fe 24        cp   0x24
 *   244d  28 44        jr   z,0x2493
 *   244f  fe 33        cp   0x33
 *   2451  28 40        jr   z,0x2493
 *   2453  fe 32        cp   0x32
 *   2455  28 3c        jr   z,0x2493
 *   2457  fe 30        cp   0x30
 *   2459  28 07        jr   z,0x2462
 *   245b  3c           inc  a
 *   245c  dd 77 00     ld   (ix+0x00),a
 *   245f  c3 e8 23     jp   0x23e8
 * loc_2462:
 *   2462  dd 7e ff     ld   a,(ix-0x01)
 *   2465  fe 24        cp   0x24
 *   2467  28 11        jr   z,0x247a
 *   2469  dd 77 00     ld   (ix+0x00),a
 *   246c  dd 7e fe     ld   a,(ix-0x02)
 *   246f  dd 77 ff     ld   (ix-0x01),a
 *   2472  3e 24        ld   a,0x24
 *   2474  dd 77 fe     ld   (ix-0x02),a
 *   2477  c3 e8 23     jp   0x23e8
 * loc_247a:
 *   247a  dd 7e 20     ld   a,(ix+0x20)
 *   247d  fe 24        cp   0x24
 *   247f  28 12        jr   z,0x2493
 *   2481  dd 7e 40     ld   a,(ix+0x40)
 *   2484  fe 24        cp   0x24
 *   2486  28 0b        jr   z,0x2493
 *   2488  dd 36 20 2d  ld   (ix+0x20),0x2d
 *   248c  dd 36 00 24  ld   (ix+0x00),0x24
 *   2490  c3 e8 23     jp   0x23e8
 * loc_2493:
 *   2493  2a 65 80     ld   hl,(0x8065)
 *   2496  11 c0 93     ld   de,0x93c0
 *   2499  7a           ld   a,d
 *   249a  bc           cp   h
 *   249b  d8           ret  c
 *   249c  36 31        ld   (hl),0x31
 *   249e  11 20 00     ld   de,0x0020
 *   24a1  19           add  hl,de
 *   24a2  22 65 80     ld   (0x8065),hl
 *   24a5  11 a4 92     ld   de,0x92a4
 *   24a8  7b           ld   a,e
 *   24a9  bd           cp   l
 *   24aa  c0           ret  nz
 *   24ab  7a           ld   a,d
 *   24ac  bc           cp   h
 *   24ad  28 01        jr   z,0x24b0
 *   24af  c9           ret
 * loc_24b0:
 *   24b0  3a 7b 80     ld   a,(0x807b)
 *   24b3  a7           and  a
 *   24b4  28 11        jr   z,0x24c7
 *   24b6  fe 02        cp   0x02
 *   24b8  d0           ret  nc
 *   24b9  3a 0d 81     ld   a,(0x810d)
 *   24bc  fe 17        cp   0x17
 *   24be  d8           ret  c
 *   24bf  3e 16        ld   a,0x16
 *   24c1  32 0d 81     ld   (0x810d),a
 *   24c4  32 1e 81     ld   (0x811e),a
 * loc_24c7:
 *   24c7  3e 02        ld   a,0x02
 *   24c9  32 7b 80     ld   (0x807b),a
 *   24cc  c3 6b 4c     jp   0x4c6b
 *
 * Control-flow notes:
 *  - Conditional `ret cc` = 11 T taken (does the pop), 5 T not taken (falls through).
 *  - Unconditional `jp NNNN` into another routine is a tail-jump: nothing is pushed,
 *    so it is modelled `m.step(target,10); return m.call(target)` -- the callee runs
 *    its own `ret`, which pops OUR caller's return address (0x23e8 ends in `ret`).
 *  - loc_2493_tail is a translator split for the forward-jump target at 0x2493 (all
 *    four `jr z,0x2493` sites reach it); it is a local closure, never a ROM routine.
 */
export function sub_241c(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  // 241c  ld a,(0x8010)
  regs.a = mem.read8(0x8010);
  m.step(0x241f, 13);
  // 241f  cp 0x0a
  regs.cp(0x0a);
  m.step(0x2421, 7);
  // 2421  ret c -- phase byte still below 0x0A, nothing to do
  if (regs.fC) { m.ret(11); return; }
  m.step(0x2422, 5); // ret c not taken
  // 2422  ld a,(0x8067)
  regs.a = mem.read8(0x8067);
  m.step(0x2425, 13);
  // 2425  dec a
  regs.a = regs.dec8(regs.a);
  m.step(0x2426, 4);
  // 2426  jr z,0x242c -- timer expired this frame -> run the step
  if (regs.fZ) {
    m.step(0x242c, 12); // jr z taken
  } else {
    m.step(0x2428, 7); // jr z not taken
    // 2428  ld (0x8067),a -- store the decremented timer (ld (nn),a leaves flags)
    mem.write8(0x8067, regs.a);
    m.step(0x242b, 13);
    // 242b  ret nz -- still counting down, return
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x242c, 5); // ret nz not taken (Z was clear here, so this arm is dead)
  }

  // loc_242c:
  // 242c  call 0x4c8b
  m.push16(0x242f); m.step(0x4c8b, 17); m.call(0x4c8b);
  // 242f  ld ix,(0x8065)
  regs.ix = mem.read16(0x8065);
  m.step(0x2433, 20);
  // 2433  ld a,(ix-0x20)
  regs.a = mem.read8(R(-0x20));
  m.step(0x2436, 19);
  // 2436  cp 0xae
  regs.cp(0xae);
  m.step(0x2438, 7);
  // 2438  jr nz,0x2444
  if (regs.fNZ) {
    m.step(0x2444, 12); // jr nz taken -> loc_2444
    // loc_2444: 2444  ld (ix-0x20),0x24
    mem.write8(R(-0x20), 0x24);
    m.step(0x2448, 19);
  } else {
    m.step(0x243a, 7); // jr nz not taken
    // 243a  ld (ix-0x20),0xfe
    mem.write8(R(-0x20), 0xfe);
    m.step(0x243e, 19);
    // 243e  ld (ix-0x40),0xfd
    mem.write8(R(-0x40), 0xfd);
    m.step(0x2442, 19);
    // 2442  jr 0x2448
    m.step(0x2448, 12);
  }

  // The forward-jump target at 0x2493 (reached from five `jr z` sites) as a closure.
  function loc_2493_tail() {
    // 2493  ld hl,(0x8065)
    regs.hl = mem.read16(0x8065);
    m.step(0x2496, 16);
    // 2496  ld de,0x93c0
    regs.de = 0x93c0;
    m.step(0x2499, 10);
    // 2499  ld a,d
    regs.a = regs.d;
    m.step(0x249a, 4);
    // 249a  cp h
    regs.cp(regs.h);
    m.step(0x249b, 4);
    // 249b  ret c -- pointer high byte past 0x93 -> stop
    if (regs.fC) { m.ret(11); return; }
    m.step(0x249c, 5); // ret c not taken
    // 249c  ld (hl),0x31
    mem.write8(regs.hl, 0x31);
    m.step(0x249e, 10);
    // 249e  ld de,0x0020
    regs.de = 0x0020;
    m.step(0x24a1, 10);
    // 24a1  add hl,de
    regs.addHl(regs.de);
    m.step(0x24a2, 11);
    // 24a2  ld (0x8065),hl
    mem.write16(0x8065, regs.hl);
    m.step(0x24a5, 16);
    // 24a5  ld de,0x92a4
    regs.de = 0x92a4;
    m.step(0x24a8, 10);
    // 24a8  ld a,e
    regs.a = regs.e;
    m.step(0x24a9, 4);
    // 24a9  cp l
    regs.cp(regs.l);
    m.step(0x24aa, 4);
    // 24aa  ret nz -- pointer low byte not yet 0xA4 -> return
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x24ab, 5); // ret nz not taken
    // 24ab  ld a,d
    regs.a = regs.d;
    m.step(0x24ac, 4);
    // 24ac  cp h
    regs.cp(regs.h);
    m.step(0x24ad, 4);
    // 24ad  jr z,0x24b0
    if (regs.fZ) {
      m.step(0x24b0, 12); // jr z taken -> loc_24b0
    } else {
      m.step(0x24af, 7); // jr z not taken
      // 24af  ret
      m.ret(10);
      return;
    }

    // loc_24b0:
    // 24b0  ld a,(0x807b)
    regs.a = mem.read8(0x807b);
    m.step(0x24b3, 13);
    // 24b3  and a
    regs.and(regs.a);
    m.step(0x24b4, 4);
    // 24b4  jr z,0x24c7
    if (regs.fZ) {
      m.step(0x24c7, 12); // jr z taken -> loc_24c7
    } else {
      m.step(0x24b6, 7); // jr z not taken
      // 24b6  cp 0x02
      regs.cp(0x02);
      m.step(0x24b8, 7);
      // 24b8  ret nc -- 0x807b >= 2 -> return
      if (regs.fNC) { m.ret(11); return; }
      m.step(0x24b9, 5); // ret nc not taken
      // 24b9  ld a,(0x810d)
      regs.a = mem.read8(0x810d);
      m.step(0x24bc, 13);
      // 24bc  cp 0x17
      regs.cp(0x17);
      m.step(0x24be, 7);
      // 24be  ret c -- 0x810d < 0x17 -> return
      if (regs.fC) { m.ret(11); return; }
      m.step(0x24bf, 5); // ret c not taken
      // 24bf  ld a,0x16
      regs.a = 0x16;
      m.step(0x24c1, 7);
      // 24c1  ld (0x810d),a
      mem.write8(0x810d, regs.a);
      m.step(0x24c4, 13);
      // 24c4  ld (0x811e),a
      mem.write8(0x811e, regs.a);
      m.step(0x24c7, 13);
    }

    // loc_24c7:
    // 24c7  ld a,0x02
    regs.a = 0x02;
    m.step(0x24c9, 7);
    // 24c9  ld (0x807b),a
    mem.write8(0x807b, regs.a);
    m.step(0x24cc, 13);
    // 24cc  jp 0x4c6b -- tail-jump
    m.step(0x4c6b, 10);
    return m.call(0x4c6b);
  }

  // loc_2448:
  // 2448  ld a,(ix+0x00)
  regs.a = mem.read8(R(0x00));
  m.step(0x244b, 19);
  // 244b  cp 0x24
  regs.cp(0x24);
  m.step(0x244d, 7);
  // 244d  jr z,0x2493
  if (regs.fZ) { m.step(0x2493, 12); return loc_2493_tail(); }
  m.step(0x244f, 7); // jr z not taken
  // 244f  cp 0x33
  regs.cp(0x33);
  m.step(0x2451, 7);
  // 2451  jr z,0x2493
  if (regs.fZ) { m.step(0x2493, 12); return loc_2493_tail(); }
  m.step(0x2453, 7); // jr z not taken
  // 2453  cp 0x32
  regs.cp(0x32);
  m.step(0x2455, 7);
  // 2455  jr z,0x2493
  if (regs.fZ) { m.step(0x2493, 12); return loc_2493_tail(); }
  m.step(0x2457, 7); // jr z not taken
  // 2457  cp 0x30
  regs.cp(0x30);
  m.step(0x2459, 7);
  // 2459  jr z,0x2462
  if (regs.fZ) {
    m.step(0x2462, 12); // jr z taken -> loc_2462

    // loc_2462:
    // 2462  ld a,(ix-0x01)
    regs.a = mem.read8(R(-0x01));
    m.step(0x2465, 19);
    // 2465  cp 0x24
    regs.cp(0x24);
    m.step(0x2467, 7);
    // 2467  jr z,0x247a
    if (regs.fZ) {
      m.step(0x247a, 12); // jr z taken -> loc_247a

      // loc_247a:
      // 247a  ld a,(ix+0x20)
      regs.a = mem.read8(R(0x20));
      m.step(0x247d, 19);
      // 247d  cp 0x24
      regs.cp(0x24);
      m.step(0x247f, 7);
      // 247f  jr z,0x2493
      if (regs.fZ) { m.step(0x2493, 12); return loc_2493_tail(); }
      m.step(0x2481, 7); // jr z not taken
      // 2481  ld a,(ix+0x40)
      regs.a = mem.read8(R(0x40));
      m.step(0x2484, 19);
      // 2484  cp 0x24
      regs.cp(0x24);
      m.step(0x2486, 7);
      // 2486  jr z,0x2493
      if (regs.fZ) { m.step(0x2493, 12); return loc_2493_tail(); }
      m.step(0x2488, 7); // jr z not taken
      // 2488  ld (ix+0x20),0x2d
      mem.write8(R(0x20), 0x2d);
      m.step(0x248c, 19);
      // 248c  ld (ix+0x00),0x24
      mem.write8(R(0x00), 0x24);
      m.step(0x2490, 19);
      // 2490  jp 0x23e8 -- tail-jump
      m.step(0x23e8, 10);
      return m.call(0x23e8);
    }
    m.step(0x2469, 7); // jr z (to 0x247a) not taken
    // 2469  ld (ix+0x00),a
    mem.write8(R(0x00), regs.a);
    m.step(0x246c, 19);
    // 246c  ld a,(ix-0x02)
    regs.a = mem.read8(R(-0x02));
    m.step(0x246f, 19);
    // 246f  ld (ix-0x01),a
    mem.write8(R(-0x01), regs.a);
    m.step(0x2472, 19);
    // 2472  ld a,0x24
    regs.a = 0x24;
    m.step(0x2474, 7);
    // 2474  ld (ix-0x02),a
    mem.write8(R(-0x02), regs.a);
    m.step(0x2477, 19);
    // 2477  jp 0x23e8 -- tail-jump
    m.step(0x23e8, 10);
    return m.call(0x23e8);
  }
  m.step(0x245b, 7); // jr z (to 0x2462) not taken
  // 245b  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x245c, 4);
  // 245c  ld (ix+0x00),a
  mem.write8(R(0x00), regs.a);
  m.step(0x245f, 19);
  // 245f  jp 0x23e8 -- tail-jump
  m.step(0x23e8, 10);
  return m.call(0x23e8);
}
