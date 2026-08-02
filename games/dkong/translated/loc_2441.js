// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2441  (ROM 0x2441–0x24B3).
 *
 *   -- head A: modular sum over ROM 0x3F0C picks the IY base
 *   2441  21 0c 3f     ld   hl,0x3f0c
 *   2444  3e 5e        ld   a,0x5e
 *   2446  06 06        ld   b,0x06
 *   2448  86           add  a,(hl)          ; loc_2448
 *   2449  23           inc  hl
 *   244a  10 fc        djnz 0x2448
 *   244c  fd 21 10 63  ld   iy,0x6310
 *   2450  a7           and  a
 *   2451  ca 56 24     jp   z,0x2456
 *   2454  fd 23        inc  iy
 *
 *   -- head B: 0x6227 picks one of four record tables
 *   2456  3a 27 62     ld   a,(0x6227)      ; entry_2456
 *   2459  3d           dec  a
 *   245a  21 e4 3a     ld   hl,0x3ae4
 *   245d  ca 71 24     jp   z,0x2471
 *   2460  3d           dec  a
 *   2461  21 5d 3b     ld   hl,0x3b5d
 *   2464  ca 71 24     jp   z,0x2471
 *   2467  3d           dec  a
 *   2468  21 e5 3b     ld   hl,0x3be5
 *   246b  ca 71 24     jp   z,0x2471
 *   246e  21 8b 3c     ld   hl,0x3c8b
 *   2471  dd 21 00 63  ld   ix,0x6300       ; entry_2471
 *   2475  11 05 00     ld   de,0x0005
 *
 *  -- the walk: SCC 0x2478 / 0x2488 / 0x249E
 *   2478  7e           ld   a,(hl)          ; loc_2478
 *   ...                                       (full listing in section 1)
 *   24b1  c3 78 24     jp   0x2478
 *
 * The walk is a JUMP cycle, not a call cycle -- no call/push/pop/rst in the whole
 * 115 bytes, so the ROM's stack depth is flat across it. Written as one loop for
 * that reason; three mutually-calling functions would be shape-faithful and grow a
 * JS frame per record.
 *
 * CALLED FROM 0x0D62 (`cd 41 24`), the only reference to 0x2441 in the ROM. That
 * is a real `call`, so it pushes 0x0D65. That alone, however, does NOT
 * establish that it "returns to 0x0D65".
 */
export function loc_2441(m) {
  const { regs, mem } = m;

  // -- head A ------------------------------------------------------------
  regs.hl = 0x3f0c;
  m.step(0x2444, 10); // ld hl,0x3f0c
  regs.a = 0x5e;
  m.step(0x2446, 7); // ld a,0x5e
  regs.b = 0x06;
  m.step(0x2448, 7); // ld b,0x06

  // loc_2448 -- regs.add() masks to 8 bits, which is the point: the carry out
  // of each step is DISCARDED and the sum is mod 256. An open-coded `+=` that
  // forgets the mask diverges on the first sum over 0xFF.
  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x2449, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x244a, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2448 : 0x244c, regs.b !== 0 ? 13 : 8); // djnz
  } while (regs.b !== 0);

  // `ld rr,nn` affects no flags, and `and a` regenerates them from A anyway,
  // so this sits harmlessly between the loop and its test. By contrast, an
  // identically flag-neutral `ld hl,nn` elsewhere is NOT harmless.
  regs.iy = 0x6310;
  m.step(0x2450, 14); // ld iy,0x6310
  regs.and(regs.a);
  m.step(0x2451, 4); // and a

  if (regs.fZ) {
    m.step(0x2456, 10); // jp z,0x2456 TAKEN -- sum was 0, IY stays 0x6310
  } else {
    m.step(0x2454, 10); // NOT taken -- falls through
    regs.iy = (regs.iy + 1) & 0xffff; // 16-bit INC: no flags
    m.step(0x2456, 10); // inc iy -- IY becomes 0x6311
  }

  // -- head B ------------------------------------------------------------
  // Every `ld hl,nn` below is FLAG-NEUTRAL, so each `jp z` tests the `dec a`
  // TWO instructions earlier, across an intervening load -- the same
  // flag-neutral-load trap shape seen elsewhere in this file.
  regs.a = mem.read8(0x6227);
  m.step(0x2459, 13); // ld a,(0x6227) -- discards the head-A sum

  selectTable: {
    regs.a = regs.dec8(regs.a);
    m.step(0x245a, 4); // dec a
    regs.hl = 0x3ae4;
    m.step(0x245d, 10); // ld hl,0x3ae4  (flag-neutral)
    if (regs.fZ) {
      m.step(0x2471, 10); // jp z,0x2471 TAKEN -- 0x6227 was 1
      break selectTable;
    }
    m.step(0x2460, 10); // falls through

    regs.a = regs.dec8(regs.a);
    m.step(0x2461, 4); // dec a
    regs.hl = 0x3b5d;
    m.step(0x2464, 10); // ld hl,0x3b5d  (flag-neutral)
    if (regs.fZ) {
      m.step(0x2471, 10); // 0x6227 was 2
      break selectTable;
    }
    m.step(0x2467, 10); // falls through

    regs.a = regs.dec8(regs.a);
    m.step(0x2468, 4); // dec a
    regs.hl = 0x3be5;
    m.step(0x246b, 10); // ld hl,0x3be5  (flag-neutral)
    if (regs.fZ) {
      m.step(0x2471, 10); // 0x6227 was 3
      break selectTable;
    }
    m.step(0x246e, 10); // falls through

    // Default: EVERYTHING else reaches here, including 0x6227 == 0, which
    // wraps to 0xFF on the first `dec a` and never hits Z.
    regs.hl = 0x3c8b;
    m.step(0x2471, 10); // ld hl,0x3c8b
  }

  regs.ix = 0x6300;
  m.step(0x2475, 14); // ld ix,0x6300
  regs.de = 0x0005;
  m.step(0x2478, 10); // ld de,0x0005

  // -- the walk: falls through into loc_2478 ------------------------------
  // A still holds (0x6227 - 1..3) here and HL past the checksum block is long
  // gone; both are dead -- `ld a,(hl)` below overwrites A immediately and HL
  // was reloaded in head B. Checked, not assumed.
  for (;;) {
    // -- loc_2478 --
    regs.a = mem.read8(regs.hl);
    m.step(0x2479, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x247a, 4); // and a

    if (regs.fZ) {
      // -- loc_2488: type 0 -> IX block --
      m.step(0x2488, 10); // jp z,0x2488 TAKEN

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x2489, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x248a, 7); // ld a,(hl)
      mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
      m.step(0x248d, 19); // ld (ix+0x00),a

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x248e, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x248f, 7); // ld a,(hl)
      mem.write8((regs.ix + 0x15) & 0xffff, regs.a);
      m.step(0x2492, 19); // ld (ix+0x15),a

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x2493, 6); // inc hl -- record byte +3 stepped over, never read
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x2494, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x2495, 7); // ld a,(hl)
      mem.write8((regs.ix + 0x2a) & 0xffff, regs.a);
      m.step(0x2498, 19); // ld (ix+0x2a),a

      // `inc ix` is 16-bit INC and affects NO flags. Deliberately NOT
      // regs.addIx(1) -- that is `add ix,rr`, which writes H, N, C and F3/F5.
      // Mirror image of the sub_0593 correction at mainloop.js:878: there,
      // open-coding an `add` DROPPED flags that should have been set; here,
      // reaching for the helper would SET flags that must stay untouched.
      regs.ix = (regs.ix + 1) & 0xffff;
      m.step(0x249a, 10); // inc ix
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x249b, 6); // inc hl
      m.step(0x2478, 10); // jp 0x2478
      continue;
    }
    m.step(0x247d, 10); // jp z,0x2488 NOT taken -- falls through

    regs.a = regs.dec8(regs.a);
    m.step(0x247e, 4); // dec a -- A is original-1 from here down

    if (regs.fZ) {
      // -- loc_249e: type 1 -> IY block --
      m.step(0x249e, 10); // jp z,0x249e TAKEN

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x249f, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x24a0, 7); // ld a,(hl)
      mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
      m.step(0x24a3, 19); // ld (iy+0x00),a

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x24a4, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x24a5, 7); // ld a,(hl)
      mem.write8((regs.iy + 0x15) & 0xffff, regs.a);
      m.step(0x24a8, 19); // ld (iy+0x15),a

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x24a9, 6); // inc hl -- record byte +3 stepped over here too
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x24aa, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x24ab, 7); // ld a,(hl)
      mem.write8((regs.iy + 0x2a) & 0xffff, regs.a);
      m.step(0x24ae, 19); // ld (iy+0x2a),a

      regs.iy = (regs.iy + 1) & 0xffff; // 16-bit INC: no flags. See note above.
      m.step(0x24b0, 10); // inc iy
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x24b1, 6); // inc hl
      m.step(0x2478, 10); // jp 0x2478
      continue;
    }
    m.step(0x2481, 10); // jp z,0x249e NOT taken -- falls through

    regs.cp(0xa9);
    m.step(0x2483, 7); // cp 0xa9 -- against the DECREMENTED A.

    if (regs.fZ) {
      m.ret(11); // ret z TAKEN -- 11 T-states, not 10. THE ONLY EXIT.
      return;
    }
    m.step(0x2484, 5); // ret z NOT taken -- 5 T-states, falls through

    regs.addHl(regs.de);
    m.step(0x2485, 11); // add hl,de
    m.step(0x2478, 10); // jp 0x2478
  }
}
