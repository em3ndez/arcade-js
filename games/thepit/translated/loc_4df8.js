// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4df8  (ROM 0x4df8-0x4ee9, The Pit) -- stages a multi-part labelled tilemap
 * display, then runs a frame-paced animation loop that decrements the step
 * counter at 0x804b once per pass. Role is best-effort from the code; the
 * addresses, flags, cycle costs and control flow are exact, one JS statement per
 * Z80 instruction.
 *
 * Shape:
 *   - 0x4df8-0x4e2d  clears the frame counter (0x8010), then a fixed sequence of
 *     setup/draw calls: 0x4b55 (DSW decode), 0x4b44, 0x3cc1, three 0x3e1d strip
 *     draws (C=column, A=row), and one column-address pair 0x3dae -> 0x3dc9 seeded
 *     from coords (0x8058=0x0f,0x8059=0x08), fill count (0x8055=0x12).
 *   - 0x4e2e-0x4e48  reads the variant selector (0x8048) and picks a data pointer
 *     into IX: 0x4a8e if ==3, 0x4a7b if ==2, else 0x4a68 (converge at loc_4e49).
 *   - 0x4e49-0x4e7a  a second column block (coords 0x8058=0x16,0x8059=0x03, fill
 *     0x8055=0x1a, IX=0x4aa9, via 0x3dea + a 0x3e1d strip), then seeds the step
 *     counter 0x804b=0x03.
 *   - 0x4e7b-0x4ead  reads (0x8048) AGAIN and picks a THREE-value bundle -- the
 *     loop count B, a work-RAM object pointer IX, a video-RAM cursor HL and a
 *     colour-RAM cursor DE: (==3) B=7/IX=0x8043/HL=0x915f/DE=0x895f;
 *     (==2) B=4/IX=0x803e/HL=0x927f/DE=0x8a7f; (else) B=6/IX=0x8039/HL=0x939f/
 *     DE=0x8b9f. Converge at loc_4eae.
 *   - 0x4eae-0x4eb6  clears 0x8010, sets C=0x0a, stashes B into (DE).
 *   - loc_4eb7 (loop)  writes C then 0x24 into (HL) (each followed by a 0x4bff
 *     frame-wait), runs the per-frame handler 0x4eea, then reads the step counter
 *     0x804b. While it is NON-zero (0x4eea has not yet exhausted it) control goes to
 *     loc_4ee2, which returns once the frame counter 0x8010 reaches 0x3c and
 *     otherwise loops back to loc_4eb7. When 0x804b reaches zero the loop FALLS
 *     THROUGH (0x4ecd): it emits sound 0xd0 (0x4b46) and sound 0x05 (0x4c63), waits
 *     0x3c frames (0x4bff), clears the variant selector 0x8048, and TAIL-jumps to
 *     0x4cca.
 *
 * EXITS (two):
 *   - 0x4edf  jp 0x4cca -- a TAIL-jump that discards this routine's own return
 *     path: loc_4cca runs and ITS ret unwinds to loc_4df8's caller. Modelled per
 *     the thepit convention (loc_4894 / loc_4b55) as `m.step(0x4cca,10);
 *     return m.call(0x4cca)` with NO trailing m.ret -- a second ret would double-
 *     pop the stack.
 *   - 0x4ee7  ret nc -- returns to the caller once (0x8010) >= 0x3c.
 * The back-edge at 0x4ee8 (jr 0x4eb7) is a loop; it is driven by a JS `for(;;)`
 * whose `continue` re-runs loc_4eb7, charging the jr's 12 T via m.step. loc_4eea
 * and loc_4cca have no thepit translation yet (forward references); m.call resolves
 * them through the routine registry at run time.
 *
 * loc_4df8:
 *   4df8  3e 00        ld   a,0x00
 *   4dfa  32 10 80     ld   (0x8010),a
 *   4dfd  cd 55 4b     call 0x4b55
 *   4e00  cd 44 4b     call 0x4b44
 *   4e03  cd c1 3c     call 0x3cc1
 *   4e06  0e 03        ld   c,0x03
 *   4e08  3e 07        ld   a,0x07
 *   4e0a  cd 1d 3e     call 0x3e1d
 *   4e0d  3e 09        ld   a,0x09
 *   4e0f  cd 1d 3e     call 0x3e1d
 *   4e12  0e 06        ld   c,0x06
 *   4e14  3e 0d        ld   a,0x0d
 *   4e16  cd 1d 3e     call 0x3e1d
 *   4e19  3e 0f        ld   a,0x0f
 *   4e1b  32 58 80     ld   (0x8058),a
 *   4e1e  3e 08        ld   a,0x08
 *   4e20  32 59 80     ld   (0x8059),a
 *   4e23  cd ae 3d     call 0x3dae
 *   4e26  cd c9 3d     call 0x3dc9
 *   4e29  3e 12        ld   a,0x12
 *   4e2b  32 55 80     ld   (0x8055),a
 *   4e2e  3a 48 80     ld   a,(0x8048)
 *   4e31  fe 03        cp   0x03
 *   4e33  28 10        jr   z,0x4e45
 *   4e35  fe 02        cp   0x02
 *   4e37  28 06        jr   z,0x4e3f
 *   4e39  dd 21 68 4a  ld   ix,0x4a68
 *   4e3d  18 0a        jr   0x4e49
 * loc_4e3f:
 *   4e3f  dd 21 7b 4a  ld   ix,0x4a7b
 *   4e43  18 04        jr   0x4e49
 * loc_4e45:
 *   4e45  dd 21 8e 4a  ld   ix,0x4a8e
 * loc_4e49:
 *   4e49  cd ea 3d     call 0x3dea
 *   4e4c  0e 06        ld   c,0x06
 *   4e4e  3e 0f        ld   a,0x0f
 *   4e50  cd 1d 3e     call 0x3e1d
 *   4e53  3e 16        ld   a,0x16
 *   4e55  32 58 80     ld   (0x8058),a
 *   4e58  3e 03        ld   a,0x03
 *   4e5a  32 59 80     ld   (0x8059),a
 *   4e5d  cd ae 3d     call 0x3dae
 *   4e60  cd c9 3d     call 0x3dc9
 *   4e63  3e 1a        ld   a,0x1a
 *   4e65  32 55 80     ld   (0x8055),a
 *   4e68  dd 21 a9 4a  ld   ix,0x4aa9
 *   4e6c  cd ea 3d     call 0x3dea
 *   4e6f  3e 16        ld   a,0x16
 *   4e71  0e 07        ld   c,0x07
 *   4e73  cd 1d 3e     call 0x3e1d
 *   4e76  3e 03        ld   a,0x03
 *   4e78  32 4b 80     ld   (0x804b),a
 *   4e7b  3a 48 80     ld   a,(0x8048)
 *   4e7e  fe 03        cp   0x03
 *   4e80  28 20        jr   z,0x4ea2
 *   4e82  fe 02        cp   0x02
 *   4e84  28 0e        jr   z,0x4e94
 *   4e86  06 06        ld   b,0x06
 *   4e88  dd 21 39 80  ld   ix,0x8039
 *   4e8c  21 9f 93     ld   hl,0x939f
 *   4e8f  11 9f 8b     ld   de,0x8b9f
 *   4e92  18 1a        jr   0x4eae
 * loc_4e94:
 *   4e94  06 04        ld   b,0x04
 *   4e96  dd 21 3e 80  ld   ix,0x803e
 *   4e9a  21 7f 92     ld   hl,0x927f
 *   4e9d  11 7f 8a     ld   de,0x8a7f
 *   4ea0  18 0c        jr   0x4eae
 * loc_4ea2:
 *   4ea2  06 07        ld   b,0x07
 *   4ea4  dd 21 43 80  ld   ix,0x8043
 *   4ea8  21 5f 91     ld   hl,0x915f
 *   4eab  11 5f 89     ld   de,0x895f
 * loc_4eae:
 *   4eae  3e 00        ld   a,0x00
 *   4eb0  32 10 80     ld   (0x8010),a
 *   4eb3  0e 0a        ld   c,0x0a
 *   4eb5  78           ld   a,b
 *   4eb6  12           ld   (de),a
 * loc_4eb7:
 *   4eb7  71           ld   (hl),c
 *   4eb8  3e 08        ld   a,0x08
 *   4eba  cd ff 4b     call 0x4bff
 *   4ebd  36 24        ld   (hl),0x24
 *   4ebf  3e 04        ld   a,0x04
 *   4ec1  cd ff 4b     call 0x4bff
 *   4ec4  cd ea 4e     call 0x4eea
 *   4ec7  3a 4b 80     ld   a,(0x804b)
 *   4eca  b7           or   a
 *   4ecb  20 15        jr   nz,0x4ee2
 *   4ecd  3e d0        ld   a,0xd0
 *   4ecf  cd 46 4b     call 0x4b46
 *   4ed2  cd 63 4c     call 0x4c63
 *   4ed5  3e 3c        ld   a,0x3c
 *   4ed7  cd ff 4b     call 0x4bff
 *   4eda  3e 00        ld   a,0x00
 *   4edc  32 48 80     ld   (0x8048),a
 *   4edf  c3 ca 4c     jp   0x4cca
 * loc_4ee2:
 *   4ee2  3a 10 80     ld   a,(0x8010)
 *   4ee5  fe 3c        cp   0x3c
 *   4ee7  d0           ret  nc
 *   4ee8  18 cd        jr   0x4eb7
 */
export function loc_4df8(m) {
  const { regs, mem } = m;

  regs.a = 0x00; m.step(0x4dfa, 7); // 4df8  ld a,0x00
  mem.write8(0x8010, regs.a); m.step(0x4dfd, 13); // 4dfa  ld (0x8010),a -- clear frame counter
  m.push16(0x4e00); m.step(0x4b55, 17); m.call(0x4b55); // 4dfd  call 0x4b55 -- DSW decode
  m.push16(0x4e03); m.step(0x4b44, 17); m.call(0x4b44); // 4e00  call 0x4b44
  m.push16(0x4e06); m.step(0x3cc1, 17); m.call(0x3cc1); // 4e03  call 0x3cc1
  regs.c = 0x03; m.step(0x4e08, 7); // 4e06  ld c,0x03
  regs.a = 0x07; m.step(0x4e0a, 7); // 4e08  ld a,0x07
  m.push16(0x4e0d); m.step(0x3e1d, 17); m.call(0x3e1d); // 4e0a  call 0x3e1d
  regs.a = 0x09; m.step(0x4e0f, 7); // 4e0d  ld a,0x09
  m.push16(0x4e12); m.step(0x3e1d, 17); m.call(0x3e1d); // 4e0f  call 0x3e1d
  regs.c = 0x06; m.step(0x4e14, 7); // 4e12  ld c,0x06
  regs.a = 0x0d; m.step(0x4e16, 7); // 4e14  ld a,0x0d
  m.push16(0x4e19); m.step(0x3e1d, 17); m.call(0x3e1d); // 4e16  call 0x3e1d
  regs.a = 0x0f; m.step(0x4e1b, 7); // 4e19  ld a,0x0f
  mem.write8(0x8058, regs.a); m.step(0x4e1e, 13); // 4e1b  ld (0x8058),a -- column coord
  regs.a = 0x08; m.step(0x4e20, 7); // 4e1e  ld a,0x08
  mem.write8(0x8059, regs.a); m.step(0x4e23, 13); // 4e20  ld (0x8059),a -- row coord
  m.push16(0x4e26); m.step(0x3dae, 17); m.call(0x3dae); // 4e23  call 0x3dae -- coord -> offset
  m.push16(0x4e29); m.step(0x3dc9, 17); m.call(0x3dc9); // 4e26  call 0x3dc9 -- offset -> addresses
  regs.a = 0x12; m.step(0x4e2b, 7); // 4e29  ld a,0x12
  mem.write8(0x8055, regs.a); m.step(0x4e2e, 13); // 4e2b  ld (0x8055),a -- fill count
  regs.a = mem.read8(0x8048); m.step(0x4e31, 13); // 4e2e  ld a,(0x8048) -- variant selector
  regs.cp(0x03); m.step(0x4e33, 7); // 4e31  cp 0x03

  // 4e33  jr z,0x4e45 -- pick the first IX pointer from the variant
  if (regs.fZ) {
    m.step(0x4e45, 12); // taken -> loc_4e45
    regs.ix = 0x4a8e; m.step(0x4e49, 14); // 4e45  ld ix,0x4a8e (falls into loc_4e49)
  } else {
    m.step(0x4e35, 7); // not taken -> 4e35
    regs.cp(0x02); m.step(0x4e37, 7); // 4e35  cp 0x02
    // 4e37  jr z,0x4e3f
    if (regs.fZ) {
      m.step(0x4e3f, 12); // taken -> loc_4e3f
      regs.ix = 0x4a7b; m.step(0x4e43, 14); // 4e3f  ld ix,0x4a7b
      m.step(0x4e49, 12); // 4e43  jr 0x4e49
    } else {
      m.step(0x4e39, 7); // not taken -> 4e39
      regs.ix = 0x4a68; m.step(0x4e3d, 14); // 4e39  ld ix,0x4a68
      m.step(0x4e49, 12); // 4e3d  jr 0x4e49
    }
  }

  // loc_4e49 (converge)
  m.push16(0x4e4c); m.step(0x3dea, 17); m.call(0x3dea); // 4e49  call 0x3dea
  regs.c = 0x06; m.step(0x4e4e, 7); // 4e4c  ld c,0x06
  regs.a = 0x0f; m.step(0x4e50, 7); // 4e4e  ld a,0x0f
  m.push16(0x4e53); m.step(0x3e1d, 17); m.call(0x3e1d); // 4e50  call 0x3e1d
  regs.a = 0x16; m.step(0x4e55, 7); // 4e53  ld a,0x16
  mem.write8(0x8058, regs.a); m.step(0x4e58, 13); // 4e55  ld (0x8058),a
  regs.a = 0x03; m.step(0x4e5a, 7); // 4e58  ld a,0x03
  mem.write8(0x8059, regs.a); m.step(0x4e5d, 13); // 4e5a  ld (0x8059),a
  m.push16(0x4e60); m.step(0x3dae, 17); m.call(0x3dae); // 4e5d  call 0x3dae
  m.push16(0x4e63); m.step(0x3dc9, 17); m.call(0x3dc9); // 4e60  call 0x3dc9
  regs.a = 0x1a; m.step(0x4e65, 7); // 4e63  ld a,0x1a
  mem.write8(0x8055, regs.a); m.step(0x4e68, 13); // 4e65  ld (0x8055),a -- fill count
  regs.ix = 0x4aa9; m.step(0x4e6c, 14); // 4e68  ld ix,0x4aa9
  m.push16(0x4e6f); m.step(0x3dea, 17); m.call(0x3dea); // 4e6c  call 0x3dea
  regs.a = 0x16; m.step(0x4e71, 7); // 4e6f  ld a,0x16
  regs.c = 0x07; m.step(0x4e73, 7); // 4e71  ld c,0x07
  m.push16(0x4e76); m.step(0x3e1d, 17); m.call(0x3e1d); // 4e73  call 0x3e1d
  regs.a = 0x03; m.step(0x4e78, 7); // 4e76  ld a,0x03
  mem.write8(0x804b, regs.a); m.step(0x4e7b, 13); // 4e78  ld (0x804b),a -- step counter = 3
  regs.a = mem.read8(0x8048); m.step(0x4e7e, 13); // 4e7b  ld a,(0x8048) -- selector again
  regs.cp(0x03); m.step(0x4e80, 7); // 4e7e  cp 0x03

  // 4e80  jr z,0x4ea2 -- pick the loop-count B + the IX/HL/DE cursor bundle
  if (regs.fZ) {
    m.step(0x4ea2, 12); // taken -> loc_4ea2
    regs.b = 0x07; m.step(0x4ea4, 7); // 4ea2  ld b,0x07
    regs.ix = 0x8043; m.step(0x4ea8, 14); // 4ea4  ld ix,0x8043
    regs.hl = 0x915f; m.step(0x4eab, 10); // 4ea8  ld hl,0x915f
    regs.de = 0x895f; m.step(0x4eae, 10); // 4eab  ld de,0x895f (falls into loc_4eae)
  } else {
    m.step(0x4e82, 7); // not taken -> 4e82
    regs.cp(0x02); m.step(0x4e84, 7); // 4e82  cp 0x02
    // 4e84  jr z,0x4e94
    if (regs.fZ) {
      m.step(0x4e94, 12); // taken -> loc_4e94
      regs.b = 0x04; m.step(0x4e96, 7); // 4e94  ld b,0x04
      regs.ix = 0x803e; m.step(0x4e9a, 14); // 4e96  ld ix,0x803e
      regs.hl = 0x927f; m.step(0x4e9d, 10); // 4e9a  ld hl,0x927f
      regs.de = 0x8a7f; m.step(0x4ea0, 10); // 4e9d  ld de,0x8a7f
      m.step(0x4eae, 12); // 4ea0  jr 0x4eae
    } else {
      m.step(0x4e86, 7); // not taken -> 4e86
      regs.b = 0x06; m.step(0x4e88, 7); // 4e86  ld b,0x06
      regs.ix = 0x8039; m.step(0x4e8c, 14); // 4e88  ld ix,0x8039
      regs.hl = 0x939f; m.step(0x4e8f, 10); // 4e8c  ld hl,0x939f
      regs.de = 0x8b9f; m.step(0x4e92, 10); // 4e8f  ld de,0x8b9f
      m.step(0x4eae, 12); // 4e92  jr 0x4eae
    }
  }

  // loc_4eae (converge)
  regs.a = 0x00; m.step(0x4eb0, 7); // 4eae  ld a,0x00
  mem.write8(0x8010, regs.a); m.step(0x4eb3, 13); // 4eb0  ld (0x8010),a -- clear frame counter
  regs.c = 0x0a; m.step(0x4eb5, 7); // 4eb3  ld c,0x0a
  regs.a = regs.b; m.step(0x4eb6, 4); // 4eb5  ld a,b
  mem.write8(regs.de, regs.a); m.step(0x4eb7, 7); // 4eb6  ld (de),a -- stash B into the colour cursor

  // loc_4eb7 -- the animation loop; `continue` is the 0x4ee8 back-edge.
  for (;;) {
    mem.write8(regs.hl, regs.c); m.step(0x4eb8, 7); // 4eb7  ld (hl),c
    regs.a = 0x08; m.step(0x4eba, 7); // 4eb8  ld a,0x08
    m.push16(0x4ebd); m.step(0x4bff, 17); m.call(0x4bff); // 4eba  call 0x4bff -- wait A frames
    mem.write8(regs.hl, 0x24); m.step(0x4ebf, 10); // 4ebd  ld (hl),0x24
    regs.a = 0x04; m.step(0x4ec1, 7); // 4ebf  ld a,0x04
    m.push16(0x4ec4); m.step(0x4bff, 17); m.call(0x4bff); // 4ec1  call 0x4bff -- wait A frames
    m.push16(0x4ec7); m.step(0x4eea, 17); m.call(0x4eea); // 4ec4  call 0x4eea -- per-frame handler
    regs.a = mem.read8(0x804b); m.step(0x4eca, 13); // 4ec7  ld a,(0x804b) -- step counter
    regs.or(regs.a); m.step(0x4ecb, 4); // 4eca  or a -- Z <- (0x804b == 0)

    // 4ecb  jr nz,0x4ee2 -- counter still non-zero: go poll the frame counter
    if (regs.fNZ) {
      m.step(0x4ee2, 12); // taken -> loc_4ee2
      // loc_4ee2
      regs.a = mem.read8(0x8010); m.step(0x4ee5, 13); // 4ee2  ld a,(0x8010) -- frame counter
      regs.cp(0x3c); m.step(0x4ee7, 7); // 4ee5  cp 0x3c
      // 4ee7  ret nc -- (0x8010) >= 0x3c: done, return to caller
      if (regs.fNC) { m.ret(11); return; } // ret nc taken
      m.step(0x4ee8, 5); // ret nc not taken
      m.step(0x4eb7, 12); // 4ee8  jr 0x4eb7 -- loop back-edge
      continue;
    }

    // 4ecb  jr nz not taken -> fall through: the counter hit zero, finish up
    m.step(0x4ecd, 7);
    regs.a = 0xd0; m.step(0x4ecf, 7); // 4ecd  ld a,0xd0
    m.push16(0x4ed2); m.step(0x4b46, 17); m.call(0x4b46); // 4ecf  call 0x4b46 -- sound 0xd0
    m.push16(0x4ed5); m.step(0x4c63, 17); m.call(0x4c63); // 4ed2  call 0x4c63 -- sound 0x05
    regs.a = 0x3c; m.step(0x4ed7, 7); // 4ed5  ld a,0x3c
    m.push16(0x4eda); m.step(0x4bff, 17); m.call(0x4bff); // 4ed7  call 0x4bff -- wait 0x3c frames
    regs.a = 0x00; m.step(0x4edc, 7); // 4eda  ld a,0x00
    mem.write8(0x8048, regs.a); m.step(0x4edf, 13); // 4edc  ld (0x8048),a -- clear the selector

    // 4edf  jp 0x4cca -- TAIL-jump: loc_4cca's ret unwinds to OUR caller (no m.ret)
    m.step(0x4cca, 10);
    return m.call(0x4cca);
  }
}
