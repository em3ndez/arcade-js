// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2f71  (ROM 0x2f71-0x3045, The Pit) -- per-frame update for a scrolling /
 * animated background element, driven by a block of counters at 0x80db-0x80e7,
 * that finally TAIL-JUMPS into loc_312d.
 *
 * Three stages, each gated by its own counter, all converging on loc_3029:
 *
 *   1. Scroll-reveal (0x2f71-0x2fbe), only when the enable flag (0x80e7)!=0.
 *      A one-shot gate at 0x2f78 calls 0x4c7b when (0x8077)!=0 AND (0x806b)==0x6b.
 *      Counter (0x80e5) counts down; on wrap it reloads from (0x80e4) and, if the
 *      table index (0x80e6)-6 does not underflow, copies SIX bytes from the tile
 *      table at 0x3048+index into a vertical video-RAM column starting at 0x938c,
 *      stepping UP one row (-0x20) each byte -- a column of terrain scrolled in.
 *
 *   2. Animation / oscillator select (0x2fc0-0x3026). Frame counter (0x80e3)
 *      counts down mod 8; on wrap it reloads to 8 and toggles the sprite frame
 *      (0x80dc) between 0x38 and 0x39. Otherwise, only every 4th frame ((cnt&3)==0)
 *      does it run the oscillator body at 0x2fe3.
 *      Oscillator: x (0x80db) += velocity (0x80df); at x>=0x38 velocity:=0xff (-1),
 *      at x<0x19 velocity:=+1, else velocity held -- a bounce in [0x19,0x38).
 *      y (0x80de) += an accelerating step (0x80e0, pre-incremented each frame);
 *      on y>=0x86 it clamps y=0x86, calls 0x4b1a, resets the step via or 0xf8/dec,
 *      and bumps (0x80dd) (mod bit-3 cleared).
 *
 *   3. Publish (0x3029-0x3044). Writes four bytes to the scroll/sprite block at
 *      0x822c: (x - (0x8051)), the sprite frame (0x80dc), (0x80dd), (y + (0x8051)).
 *      (0x8051) is a hero/camera x used to convert to screen-relative coordinates.
 *
 *   4. `jp 0x312d` at 0x3045 -- UNCONDITIONAL tail-jump; this routine has NO ret,
 *      so loc_312d's own ret returns to OUR caller. Modelled per the thepit
 *      convention (loc_2f2f / loc_02ca): `m.step(0x312d,10); return m.call(0x312d)`
 *      with NO trailing m.ret (a call+ret would push a spurious frame and
 *      double-pop). loc_2f88 / loc_2fb7 / loc_2fc0 / loc_2fd9 / loc_2fde /
 *      loc_2fe3 / loc_2ff6 / loc_2ffc / loc_2fff / loc_3029 are all reached ONLY
 *      from inside this routine, so they are internal labels, not ROM boundaries.
 *      All stores are to work RAM / video RAM (no hardware write-bus offset).
 *
 * (Role text is best-effort from the code; the addresses, constants, arithmetic
 *  and control flow are exact per the disassembly.)
 *
 * loc_2f71:
 *   2f71  3a e7 80     ld   a,(0x80e7)
 *   2f74  a7           and  a
 *   2f75  ca c0 2f     jp   z,0x2fc0
 *   2f78  3a 77 80     ld   a,(0x8077)
 *   2f7b  a7           and  a
 *   2f7c  28 0a        jr   z,0x2f88
 *   2f7e  3a 6b 80     ld   a,(0x806b)
 *   2f81  fe 6b        cp   0x6b
 *   2f83  20 03        jr   nz,0x2f88
 *   2f85  cd 7b 4c     call 0x4c7b
 * loc_2f88:
 *   2f88  3a e5 80     ld   a,(0x80e5)
 *   2f8b  3d           dec  a
 *   2f8c  32 e5 80     ld   (0x80e5),a
 *   2f8f  20 2f        jr   nz,0x2fc0
 *   2f91  3a e4 80     ld   a,(0x80e4)
 *   2f94  32 e5 80     ld   (0x80e5),a
 *   2f97  3a e6 80     ld   a,(0x80e6)
 *   2f9a  d6 06        sub  0x06
 *   2f9c  38 22        jr   c,0x2fc0
 *   2f9e  32 e6 80     ld   (0x80e6),a
 *   2fa1  5f           ld   e,a
 *   2fa2  16 00        ld   d,0x00
 *   2fa4  21 48 30     ld   hl,0x3048
 *   2fa7  19           add  hl,de
 *   2fa8  22 e1 80     ld   (0x80e1),hl
 *   2fab  dd 2a e1 80  ld   ix,(0x80e1)
 *   2faf  21 8c 93     ld   hl,0x938c
 *   2fb2  11 e0 ff     ld   de,0xffe0
 *   2fb5  06 06        ld   b,0x06
 * loc_2fb7:
 *   2fb7  dd 7e 00     ld   a,(ix+0x00)
 *   2fba  77           ld   (hl),a
 *   2fbb  19           add  hl,de
 *   2fbc  dd 23        inc  ix
 *   2fbe  10 f7        djnz 0x2fb7
 * loc_2fc0:
 *   2fc0  3a e3 80     ld   a,(0x80e3)
 *   2fc3  3d           dec  a
 *   2fc4  32 e3 80     ld   (0x80e3),a
 *   2fc7  20 15        jr   nz,0x2fde
 *   2fc9  3e 08        ld   a,0x08
 *   2fcb  32 e3 80     ld   (0x80e3),a
 *   2fce  3a dc 80     ld   a,(0x80dc)
 *   2fd1  47           ld   b,a
 *   2fd2  3e 38        ld   a,0x38
 *   2fd4  b8           cp   b
 *   2fd5  20 02        jr   nz,0x2fd9
 *   2fd7  3e 39        ld   a,0x39
 * loc_2fd9:
 *   2fd9  32 dc 80     ld   (0x80dc),a
 *   2fdc  18 05        jr   0x2fe3
 * loc_2fde:
 *   2fde  e6 03        and  0x03
 *   2fe0  c2 29 30     jp   nz,0x3029
 * loc_2fe3:
 *   2fe3  3a df 80     ld   a,(0x80df)
 *   2fe6  4f           ld   c,a
 *   2fe7  3a db 80     ld   a,(0x80db)
 *   2fea  81           add  a,c
 *   2feb  32 db 80     ld   (0x80db),a
 *   2fee  fe 38        cp   0x38
 *   2ff0  38 04        jr   c,0x2ff6
 *   2ff2  3e ff        ld   a,0xff
 *   2ff4  18 06        jr   0x2ffc
 * loc_2ff6:
 *   2ff6  fe 19        cp   0x19
 *   2ff8  30 05        jr   nc,0x2fff
 *   2ffa  3e 01        ld   a,0x01
 * loc_2ffc:
 *   2ffc  32 df 80     ld   (0x80df),a
 * loc_2fff:
 *   2fff  3a e0 80     ld   a,(0x80e0)
 *   3002  3c           inc  a
 *   3003  32 e0 80     ld   (0x80e0),a
 *   3006  47           ld   b,a
 *   3007  3a de 80     ld   a,(0x80de)
 *   300a  80           add  a,b
 *   300b  32 de 80     ld   (0x80de),a
 *   300e  fe 86        cp   0x86
 *   3010  38 17        jr   c,0x3029
 *   3012  3e 86        ld   a,0x86
 *   3014  32 de 80     ld   (0x80de),a
 *   3017  cd 1a 4b     call 0x4b1a
 *   301a  f6 f8        or   0xf8
 *   301c  3d           dec  a
 *   301d  32 e0 80     ld   (0x80e0),a
 *   3020  3a dd 80     ld   a,(0x80dd)
 *   3023  3c           inc  a
 *   3024  e6 f7        and  0xf7
 *   3026  32 dd 80     ld   (0x80dd),a
 * loc_3029:
 *   3029  21 2c 82     ld   hl,0x822c
 *   302c  3a 51 80     ld   a,(0x8051)
 *   302f  47           ld   b,a
 *   3030  3a db 80     ld   a,(0x80db)
 *   3033  90           sub  b
 *   3034  77           ld   (hl),a
 *   3035  23           inc  hl
 *   3036  3a dc 80     ld   a,(0x80dc)
 *   3039  77           ld   (hl),a
 *   303a  23           inc  hl
 *   303b  3a dd 80     ld   a,(0x80dd)
 *   303e  77           ld   (hl),a
 *   303f  23           inc  hl
 *   3040  3a de 80     ld   a,(0x80de)
 *   3043  80           add  a,b
 *   3044  77           ld   (hl),a
 *   3045  c3 2d 31     jp   0x312d
 */
export function loc_2f71(m) {
  const { regs, mem } = m;

  // === Stage 1: scroll-reveal (0x2f71-0x2fbe). Every exit lands at loc_2fc0. ===
  scroll: {
    // 2f71  ld a,(0x80e7) -- the enable flag
    regs.a = mem.read8(0x80e7);
    m.step(0x2f74, 13);
    // 2f74  and a
    regs.and(regs.a);
    m.step(0x2f75, 4);
    // 2f75  jp z,0x2fc0 -- disabled: skip the whole reveal stage
    if (regs.fZ) {
      m.step(0x2fc0, 10);
      break scroll;
    }
    m.step(0x2f78, 10); // jp z NOT taken -> fall to 0x2f78

    // 2f78  gate: call 0x4c7b only if (0x8077)!=0 && (0x806b)==0x6b
    regs.a = mem.read8(0x8077);
    m.step(0x2f7b, 13);
    // 2f7b  and a
    regs.and(regs.a);
    m.step(0x2f7c, 4);
    // 2f7c  jr z,0x2f88
    if (regs.fNZ) {
      m.step(0x2f7e, 7); // jr z NOT taken
      // 2f7e  ld a,(0x806b)
      regs.a = mem.read8(0x806b);
      m.step(0x2f81, 13);
      // 2f81  cp 0x6b
      regs.cp(0x6b);
      m.step(0x2f83, 7);
      // 2f83  jr nz,0x2f88
      if (regs.fZ) {
        m.step(0x2f85, 7); // jr nz NOT taken -> do the call
        // 2f85  call 0x4c7b
        m.push16(0x2f88);
        m.step(0x4c7b, 17);
        m.call(0x4c7b);
      } else {
        m.step(0x2f88, 12); // jr nz taken -> skip the call
      }
    } else {
      m.step(0x2f88, 12); // jr z taken -> skip the gate + call
    }

    // loc_2f88: decrement the reveal counter; act only on wrap
    regs.a = mem.read8(0x80e5);
    m.step(0x2f8b, 13); // 2f88  ld a,(0x80e5)
    regs.a = regs.dec8(regs.a);
    m.step(0x2f8c, 4); // 2f8b  dec a
    mem.write8(0x80e5, regs.a);
    m.step(0x2f8f, 13); // 2f8c  ld (0x80e5),a
    // 2f8f  jr nz,0x2fc0 -- not yet wrapped: nothing to reveal this frame
    if (regs.fNZ) {
      m.step(0x2fc0, 12);
      break scroll;
    }
    m.step(0x2f91, 7); // jr nz NOT taken

    // 2f91  ld a,(0x80e4) -- reload the reveal counter from (0x80e4)
    regs.a = mem.read8(0x80e4);
    m.step(0x2f94, 13);
    // 2f94  ld (0x80e5),a
    mem.write8(0x80e5, regs.a);
    m.step(0x2f97, 13);
    // 2f97  ld a,(0x80e6) -- the tile-table index
    regs.a = mem.read8(0x80e6);
    m.step(0x2f9a, 13);
    // 2f9a  sub 0x06 -- advance the index by one 6-byte row
    regs.sub(0x06);
    m.step(0x2f9c, 7);
    // 2f9c  jr c,0x2fc0 -- table exhausted (underflow): stop revealing
    if (regs.fC) {
      m.step(0x2fc0, 12);
      break scroll;
    }
    m.step(0x2f9e, 7); // jr c NOT taken

    // 2f9e  ld (0x80e6),a
    mem.write8(0x80e6, regs.a);
    m.step(0x2fa1, 13);
    // 2fa1  ld e,a
    regs.e = regs.a;
    m.step(0x2fa2, 4);
    // 2fa2  ld d,0x00 -- DE = the row index (0..0xff)
    regs.d = 0x00;
    m.step(0x2fa4, 7);
    // 2fa4  ld hl,0x3048 -- the tile table base
    regs.hl = 0x3048;
    m.step(0x2fa7, 10);
    // 2fa7  add hl,de -- HL = &table[index]
    regs.addHl(regs.de);
    m.step(0x2fa8, 11);
    // 2fa8  ld (0x80e1),hl -- stash the source pointer
    mem.write16(0x80e1, regs.hl);
    m.step(0x2fab, 16);
    // 2fab  ld ix,(0x80e1) -- IX = source pointer
    regs.ix = mem.read16(0x80e1);
    m.step(0x2faf, 20);
    // 2faf  ld hl,0x938c -- video-RAM destination (bottom of the column)
    regs.hl = 0x938c;
    m.step(0x2fb2, 10);
    // 2fb2  ld de,0xffe0 -- stride -0x20 (one row up per byte)
    regs.de = 0xffe0;
    m.step(0x2fb5, 10);
    // 2fb5  ld b,0x06 -- 6 tiles to copy
    regs.b = 0x06;
    m.step(0x2fb7, 7);

    // loc_2fb7: copy 6 bytes table[index..index+5] up the column
    for (;;) {
      // 2fb7  ld a,(ix+0x00)
      regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
      m.step(0x2fba, 19);
      // 2fba  ld (hl),a
      mem.write8(regs.hl, regs.a);
      m.step(0x2fbb, 7);
      // 2fbb  add hl,de -- step up one row
      regs.addHl(regs.de);
      m.step(0x2fbc, 11);
      // 2fbc  inc ix
      regs.ix = (regs.ix + 1) & 0xffff;
      m.step(0x2fbe, 10);
      // 2fbe  djnz 0x2fb7 (touches no flags)
      if (regs.djnz() !== 0) {
        m.step(0x2fb7, 13); // djnz taken
      } else {
        m.step(0x2fc0, 8); // djnz not taken -> fall to loc_2fc0
        break;
      }
    }
    // fall through out of `scroll` to loc_2fc0
  }

  // loc_2fc0: frame counter mod 8; on wrap animate, else oscillate every 4th frame.
  regs.a = mem.read8(0x80e3);
  m.step(0x2fc3, 13); // 2fc0  ld a,(0x80e3)
  regs.a = regs.dec8(regs.a);
  m.step(0x2fc4, 4); // 2fc3  dec a
  mem.write8(0x80e3, regs.a);
  m.step(0x2fc7, 13); // 2fc4  ld (0x80e3),a

  // === Stage 2: everything here converges on loc_3029. ===
  frame: {
    // 2fc7  jr nz,0x2fde -- not a wrap frame
    if (regs.fNZ) {
      m.step(0x2fde, 12); // jr nz taken -> loc_2fde
      // loc_2fde: and 0x03 -- run the oscillator only 1 frame in 4
      regs.and(0x03);
      m.step(0x2fe0, 7);
      // 2fe0  jp nz,0x3029 -- off-beat frame: skip straight to publish
      if (regs.fNZ) {
        m.step(0x3029, 10);
        break frame;
      }
      m.step(0x2fe3, 10); // jp nz NOT taken -> fall into loc_2fe3
    } else {
      m.step(0x2fc9, 7); // jr nz NOT taken -- wrap frame: reload + animate
      // 2fc9  ld a,0x08
      regs.a = 0x08;
      m.step(0x2fcb, 7);
      // 2fcb  ld (0x80e3),a -- reload the frame counter
      mem.write8(0x80e3, regs.a);
      m.step(0x2fce, 13);
      // 2fce  ld a,(0x80dc) -- current sprite frame
      regs.a = mem.read8(0x80dc);
      m.step(0x2fd1, 13);
      // 2fd1  ld b,a
      regs.b = regs.a;
      m.step(0x2fd2, 4);
      // 2fd2  ld a,0x38
      regs.a = 0x38;
      m.step(0x2fd4, 7);
      // 2fd4  cp b -- was it 0x38?
      regs.cp(regs.b);
      m.step(0x2fd5, 4);
      // 2fd5  jr nz,0x2fd9 -- not 0x38: keep A=0x38 (toggle -> 0x38)
      if (regs.fNZ) {
        m.step(0x2fd9, 12); // jr nz taken
      } else {
        m.step(0x2fd7, 7); // jr nz NOT taken -- was 0x38: toggle -> 0x39
        // 2fd7  ld a,0x39
        regs.a = 0x39;
        m.step(0x2fd9, 7);
      }
      // loc_2fd9: ld (0x80dc),a -- store the toggled frame
      mem.write8(0x80dc, regs.a);
      m.step(0x2fdc, 13);
      // 2fdc  jr 0x2fe3
      m.step(0x2fe3, 12);
    }

    // loc_2fe3: horizontal oscillator on x (0x80db) with velocity (0x80df)
    regs.a = mem.read8(0x80df);
    m.step(0x2fe6, 13); // 2fe3  ld a,(0x80df)
    regs.c = regs.a;
    m.step(0x2fe7, 4); // 2fe6  ld c,a
    regs.a = mem.read8(0x80db);
    m.step(0x2fea, 13); // 2fe7  ld a,(0x80db)
    regs.add(regs.c);
    m.step(0x2feb, 4); // 2fea  add a,c
    mem.write8(0x80db, regs.a);
    m.step(0x2fee, 13); // 2feb  ld (0x80db),a
    regs.cp(0x38);
    m.step(0x2ff0, 7); // 2fee  cp 0x38
    // 2ff0  jr c,0x2ff6
    if (regs.fC) {
      m.step(0x2ff6, 12); // jr c taken -- x < 0x38
      // loc_2ff6: cp 0x19
      regs.cp(0x19);
      m.step(0x2ff8, 7);
      // 2ff8  jr nc,0x2fff -- x in [0x19,0x38): leave velocity unchanged
      if (regs.fNC) {
        m.step(0x2fff, 12); // jr nc taken -> skip the velocity store
      } else {
        m.step(0x2ffa, 7); // jr nc NOT taken -- x < 0x19: velocity := +1
        // 2ffa  ld a,0x01
        regs.a = 0x01;
        m.step(0x2ffc, 7);
        // loc_2ffc: ld (0x80df),a
        mem.write8(0x80df, regs.a);
        m.step(0x2fff, 13);
      }
    } else {
      m.step(0x2ff2, 7); // jr c NOT taken -- x >= 0x38: velocity := -1 (0xff)
      // 2ff2  ld a,0xff
      regs.a = 0xff;
      m.step(0x2ff4, 7);
      // 2ff4  jr 0x2ffc
      m.step(0x2ffc, 12);
      // loc_2ffc: ld (0x80df),a
      mem.write8(0x80df, regs.a);
      m.step(0x2fff, 13);
    }

    // loc_2fff: vertical scroll y (0x80de) by the accelerating step (0x80e0)
    regs.a = mem.read8(0x80e0);
    m.step(0x3002, 13); // 2fff  ld a,(0x80e0)
    regs.a = regs.inc8(regs.a);
    m.step(0x3003, 4); // 3002  inc a -- accelerate the step
    mem.write8(0x80e0, regs.a);
    m.step(0x3006, 13); // 3003  ld (0x80e0),a
    regs.b = regs.a;
    m.step(0x3007, 4); // 3006  ld b,a
    regs.a = mem.read8(0x80de);
    m.step(0x300a, 13); // 3007  ld a,(0x80de)
    regs.add(regs.b);
    m.step(0x300b, 4); // 300a  add a,b
    mem.write8(0x80de, regs.a);
    m.step(0x300e, 13); // 300b  ld (0x80de),a
    regs.cp(0x86);
    m.step(0x3010, 7); // 300e  cp 0x86
    // 3010  jr c,0x3029 -- still on-screen: straight to publish
    if (regs.fC) {
      m.step(0x3029, 12);
      break frame;
    }
    m.step(0x3012, 7); // jr c NOT taken -- y >= 0x86: clamp, retrigger, reset step

    // 3012  ld a,0x86
    regs.a = 0x86;
    m.step(0x3014, 7);
    // 3014  ld (0x80de),a -- clamp y
    mem.write8(0x80de, regs.a);
    m.step(0x3017, 13);
    // 3017  call 0x4b1a
    m.push16(0x301a);
    m.step(0x4b1a, 17);
    m.call(0x4b1a);
    // 301a  or 0xf8
    regs.or(0xf8);
    m.step(0x301c, 7);
    // 301c  dec a
    regs.a = regs.dec8(regs.a);
    m.step(0x301d, 4);
    // 301d  ld (0x80e0),a -- reset the accelerating step
    mem.write8(0x80e0, regs.a);
    m.step(0x3020, 13);
    // 3020  ld a,(0x80dd)
    regs.a = mem.read8(0x80dd);
    m.step(0x3023, 13);
    // 3023  inc a
    regs.a = regs.inc8(regs.a);
    m.step(0x3024, 4);
    // 3024  and 0xf7 -- clear bit 3
    regs.and(0xf7);
    m.step(0x3026, 7);
    // 3026  ld (0x80dd),a
    mem.write8(0x80dd, regs.a);
    m.step(0x3029, 13);
    // fall through out of `frame` to loc_3029
  }

  // loc_3029: publish the four screen-relative bytes to the scroll block at 0x822c
  regs.hl = 0x822c;
  m.step(0x302c, 10); // 3029  ld hl,0x822c
  regs.a = mem.read8(0x8051);
  m.step(0x302f, 13); // 302c  ld a,(0x8051) -- hero/camera x
  regs.b = regs.a;
  m.step(0x3030, 4); // 302f  ld b,a
  regs.a = mem.read8(0x80db);
  m.step(0x3033, 13); // 3030  ld a,(0x80db)
  regs.sub(regs.b);
  m.step(0x3034, 4); // 3033  sub b -- x - camera
  mem.write8(regs.hl, regs.a);
  m.step(0x3035, 7); // 3034  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3036, 6); // 3035  inc hl
  regs.a = mem.read8(0x80dc);
  m.step(0x3039, 13); // 3036  ld a,(0x80dc)
  mem.write8(regs.hl, regs.a);
  m.step(0x303a, 7); // 3039  ld (hl),a -- sprite frame
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x303b, 6); // 303a  inc hl
  regs.a = mem.read8(0x80dd);
  m.step(0x303e, 13); // 303b  ld a,(0x80dd)
  mem.write8(regs.hl, regs.a);
  m.step(0x303f, 7); // 303e  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3040, 6); // 303f  inc hl
  regs.a = mem.read8(0x80de);
  m.step(0x3043, 13); // 3040  ld a,(0x80de)
  regs.add(regs.b);
  m.step(0x3044, 4); // 3043  add a,b -- y + camera
  mem.write8(regs.hl, regs.a);
  m.step(0x3045, 7); // 3044  ld (hl),a

  // 3045  jp 0x312d -- unconditional tail-jump; loc_312d's ret returns to OUR caller
  m.step(0x312d, 10);
  return m.call(0x312d);
}
