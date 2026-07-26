// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c04  (ROM 0x2c04-0x2cb6, The Pit) -- reached from loc_2bf2 when the pending
 * table at 0x80c3 holds a non-zero entry: picks ONE random non-empty slot, clears it,
 * paints tile 0x25 into the tilemap cell that slot maps to, and flags whether the new
 * cell overlaps the tracked object at 0x8068/0x806b. Tail-jumps to 0x2bd3.
 *
 * Sequence (role best-effort from the code; addresses, arithmetic and control flow exact):
 *   - 0x80bd = 1                    ; raise the "active" flag
 *   - call 0x4c97                   ; side effect (leaf)
 *   - 0x80aa = 0x10, 0x80ab = 0x06  ; seed two record bytes (see loc_2bd3's 4-byte record)
 *   - 0x80b1 = (0x80c2)             ; copy a lifetime/limit byte
 *   loc_2c1c: RANDOM-SLOT RETRY LOOP --
 *     - call 0x4b1a (RNG) & 0x1f -> 0..31; reject >= 0x18 (24) -> retry
 *     - index the 24-entry table at 0x80c3+n; empty slot -> retry
 *   - c = slot value. If the column index e < 0x0c (left half), consult the PAIRED right
 *     slot at +0x0c: if it is non-empty (loc_2c44) switch to it (c = its value, column
 *     b += 0x0c); if empty, back HL up by 0x0c (0xfff4) and keep the left slot.
 *   loc_2c49:
 *     - clear the chosen slot (ld (hl),0); 0x80a9 = value + 1
 *     - 0x80ac = 0xb7 (left, b < 0x0c) or 0xbf (right)   ; column base cell/coordinate
 *   loc_2c5b: compute the tilemap address --
 *       h  = 0x1f - ((0x80a9) >> 3)         ; inverted row  (Y)
 *       bc = ((0x80ac)+1) >> 3              ; column        (X)
 *       hl = (h:a) >> 3  == Y * 32          ; three srl h/rra pairs
 *       hl = hl + bc + 0x9000 + 0xffe1      ; VRAM base, minus 0x1f
 *     - ld (hl),0x25                        ; paint the tile
 *   loc_2c91: overlap test -- if (0x80ac)+0x0c == (0x806b) AND
 *       (0x80a9) < (0x8068) <= (0x80a9)+8, then d = 1 else d = 0
 *   loc_2cb0: 0x8080 = d ; jp 0x2bd3
 *
 * The `call 0x4b1a` returns the fresh random byte in A (an RNG leaf); the routine
 * masks and range-checks it, so a bad slot simply loops. The final `jp 0x2bd3` is a
 * TAIL-JUMP: loc_2c04 keeps no frame of its own, so 0x2bd3's own `ret` (through 0x2f71)
 * returns to loc_2c04's caller -- modelled `m.step(0x2bd3,10); return m.call(0x2bd3)`
 * with NO trailing m.ret (a second ret would double-pop). The two regular `call`s
 * (0x4c97, 0x4b1a) push their own return address and resume in-line.
 *
 *   2c04  3e 01        ld   a,0x01
 *   2c06  32 bd 80     ld   (0x80bd),a
 *   2c09  cd 97 4c     call 0x4c97
 *   2c0c  3e 10        ld   a,0x10
 *   2c0e  32 aa 80     ld   (0x80aa),a
 *   2c11  3e 06        ld   a,0x06
 *   2c13  32 ab 80     ld   (0x80ab),a
 *   2c16  3a c2 80     ld   a,(0x80c2)
 *   2c19  32 b1 80     ld   (0x80b1),a
 * loc_2c1c:
 *   2c1c  cd 1a 4b     call 0x4b1a
 *   2c1f  e6 1f        and  0x1f
 *   2c21  fe 18        cp   0x18
 *   2c23  30 f7        jr   nc,0x2c1c
 *   2c25  47           ld   b,a
 *   2c26  5f           ld   e,a
 *   2c27  16 00        ld   d,0x00
 *   2c29  21 c3 80     ld   hl,0x80c3
 *   2c2c  19           add  hl,de
 *   2c2d  7e           ld   a,(hl)
 *   2c2e  a7           and  a
 *   2c2f  28 eb        jr   z,0x2c1c
 *   2c31  4f           ld   c,a
 *   2c32  7b           ld   a,e
 *   2c33  fe 0c        cp   0x0c
 *   2c35  30 12        jr   nc,0x2c49
 *   2c37  1e 0c        ld   e,0x0c
 *   2c39  19           add  hl,de
 *   2c3a  7e           ld   a,(hl)
 *   2c3b  a7           and  a
 *   2c3c  20 06        jr   nz,0x2c44
 *   2c3e  11 f4 ff     ld   de,0xfff4
 *   2c41  19           add  hl,de
 *   2c42  18 05        jr   0x2c49
 * loc_2c44:
 *   2c44  4f           ld   c,a
 *   2c45  78           ld   a,b
 *   2c46  c6 0c        add  a,0x0c
 *   2c48  47           ld   b,a
 * loc_2c49:
 *   2c49  3e 00        ld   a,0x00
 *   2c4b  77           ld   (hl),a
 *   2c4c  79           ld   a,c
 *   2c4d  c6 01        add  a,0x01
 *   2c4f  32 a9 80     ld   (0x80a9),a
 *   2c52  78           ld   a,b
 *   2c53  fe 0c        cp   0x0c
 *   2c55  3e b7        ld   a,0xb7
 *   2c57  38 02        jr   c,0x2c5b
 *   2c59  3e bf        ld   a,0xbf
 * loc_2c5b:
 *   2c5b  32 ac 80     ld   (0x80ac),a
 *   2c5e  3a a9 80     ld   a,(0x80a9)
 *   2c61  cb 3f        srl  a
 *   2c63  cb 3f        srl  a
 *   2c65  cb 3f        srl  a
 *   2c67  ed 44        neg
 *   2c69  c6 1f        add  a,0x1f
 *   2c6b  67           ld   h,a
 *   2c6c  3a ac 80     ld   a,(0x80ac)
 *   2c6f  3c           inc  a
 *   2c70  5f           ld   e,a
 *   2c71  cb 3f        srl  a
 *   2c73  cb 3f        srl  a
 *   2c75  cb 3f        srl  a
 *   2c77  4f           ld   c,a
 *   2c78  3e 00        ld   a,0x00
 *   2c7a  47           ld   b,a
 *   2c7b  cb 3c        srl  h
 *   2c7d  1f           rra
 *   2c7e  cb 3c        srl  h
 *   2c80  1f           rra
 *   2c81  cb 3c        srl  h
 *   2c83  1f           rra
 *   2c84  6f           ld   l,a
 *   2c85  09           add  hl,bc
 *   2c86  01 00 90     ld   bc,0x9000
 *   2c89  09           add  hl,bc
 *   2c8a  3e 25        ld   a,0x25
 *   2c8c  01 e1 ff     ld   bc,0xffe1
 *   2c8f  09           add  hl,bc
 *   2c90  77           ld   (hl),a
 * loc_2c91:
 *   2c91  16 00        ld   d,0x00
 *   2c93  3a 6b 80     ld   a,(0x806b)
 *   2c96  47           ld   b,a
 *   2c97  3a ac 80     ld   a,(0x80ac)
 *   2c9a  c6 0c        add  a,0x0c
 *   2c9c  b8           cp   b
 *   2c9d  20 11        jr   nz,0x2cb0
 *   2c9f  3a 68 80     ld   a,(0x8068)
 *   2ca2  4f           ld   c,a
 *   2ca3  3a a9 80     ld   a,(0x80a9)
 *   2ca6  b9           cp   c
 *   2ca7  30 07        jr   nc,0x2cb0
 *   2ca9  c6 08        add  a,0x08
 *   2cab  b9           cp   c
 *   2cac  38 02        jr   c,0x2cb0
 *   2cae  16 01        ld   d,0x01
 * loc_2cb0:
 *   2cb0  7a           ld   a,d
 *   2cb1  32 80 80     ld   (0x8080),a
 *   2cb4  c3 d3 2b     jp   0x2bd3
 */
export function loc_2c04(m) {
  const { regs, mem } = m;

  // 2c04  ld a,0x01
  regs.a = 0x01;
  m.step(0x2c06, 7);
  // 2c06  ld (0x80bd),a -- raise the "active" flag
  mem.write8(0x80bd, regs.a);
  m.step(0x2c09, 13);
  // 2c09  call 0x4c97 -- leaf side effect; resumes in-line
  m.push16(0x2c0c);
  m.step(0x4c97, 17);
  m.call(0x4c97);
  // 2c0c  ld a,0x10
  regs.a = 0x10;
  m.step(0x2c0e, 7);
  // 2c0e  ld (0x80aa),a -- record byte 2
  mem.write8(0x80aa, regs.a);
  m.step(0x2c11, 13);
  // 2c11  ld a,0x06
  regs.a = 0x06;
  m.step(0x2c13, 7);
  // 2c13  ld (0x80ab),a -- record byte 3
  mem.write8(0x80ab, regs.a);
  m.step(0x2c16, 13);
  // 2c16  ld a,(0x80c2)
  regs.a = mem.read8(0x80c2);
  m.step(0x2c19, 13);
  // 2c19  ld (0x80b1),a -- copy a lifetime/limit byte
  mem.write8(0x80b1, regs.a);
  m.step(0x2c1c, 13);

  // loc_2c1c: pick a random NON-empty slot in the 24-entry table at 0x80c3
  for (;;) {
    // 2c1c  call 0x4b1a -- RNG leaf; returns a fresh random byte in A
    m.push16(0x2c1f);
    m.step(0x4b1a, 17);
    m.call(0x4b1a);
    // 2c1f  and 0x1f -- mask to 0..31
    regs.and(0x1f);
    m.step(0x2c21, 7);
    // 2c21  cp 0x18 -- reject 24..31
    regs.cp(0x18);
    m.step(0x2c23, 7);
    // 2c23  jr nc,0x2c1c -- out of range: draw again
    if (regs.fNC) {
      m.step(0x2c1c, 12);
      continue;
    }
    m.step(0x2c25, 7);
    // 2c25  ld b,a -- b = column/slot index
    regs.b = regs.a;
    m.step(0x2c26, 4);
    // 2c26  ld e,a
    regs.e = regs.a;
    m.step(0x2c27, 4);
    // 2c27  ld d,0x00 -- de = index
    regs.d = 0x00;
    m.step(0x2c29, 7);
    // 2c29  ld hl,0x80c3 -- table base
    regs.hl = 0x80c3;
    m.step(0x2c2c, 10);
    // 2c2c  add hl,de -- hl = &table[index]
    regs.addHl(regs.de);
    m.step(0x2c2d, 11);
    // 2c2d  ld a,(hl) -- slot value
    regs.a = mem.read8(regs.hl);
    m.step(0x2c2e, 7);
    // 2c2e  and a -- Z iff the slot is empty
    regs.and(regs.a);
    m.step(0x2c2f, 4);
    // 2c2f  jr z,0x2c1c -- empty slot: draw again
    if (regs.fZ) {
      m.step(0x2c1c, 12);
      continue;
    }
    m.step(0x2c31, 7);
    break;
  }

  // 2c31  ld c,a -- c = chosen slot value
  regs.c = regs.a;
  m.step(0x2c32, 4);
  // 2c32  ld a,e -- a = column index
  regs.a = regs.e;
  m.step(0x2c33, 4);
  // 2c33  cp 0x0c -- left half (< 12) vs right half
  regs.cp(0x0c);
  m.step(0x2c35, 7);
  // 2c35  jr nc,0x2c49 -- right half: keep this slot, skip the pairing check
  if (regs.fNC) {
    m.step(0x2c49, 12);
  } else {
    m.step(0x2c37, 7);
    // 2c37  ld e,0x0c -- de = 0x000c (d still 0)
    regs.e = 0x0c;
    m.step(0x2c39, 7);
    // 2c39  add hl,de -- hl = &pairedRightSlot (index + 0x0c)
    regs.addHl(regs.de);
    m.step(0x2c3a, 11);
    // 2c3a  ld a,(hl) -- the paired right slot value
    regs.a = mem.read8(regs.hl);
    m.step(0x2c3b, 7);
    // 2c3b  and a -- Z iff the pair is empty
    regs.and(regs.a);
    m.step(0x2c3c, 4);
    // 2c3c  jr nz,0x2c44 -- pair non-empty: switch to it
    if (regs.fNZ) {
      m.step(0x2c44, 12);
      // loc_2c44:
      // 2c44  ld c,a -- c = paired slot value
      regs.c = regs.a;
      m.step(0x2c45, 4);
      // 2c45  ld a,b
      regs.a = regs.b;
      m.step(0x2c46, 4);
      // 2c46  add a,0x0c -- move column into the right half
      regs.add(0x0c);
      m.step(0x2c48, 7);
      // 2c48  ld b,a
      regs.b = regs.a;
      m.step(0x2c49, 4);
      // falls into loc_2c49
    } else {
      m.step(0x2c3e, 7);
      // 2c3e  ld de,0xfff4 -- -0x0c
      regs.de = 0xfff4;
      m.step(0x2c41, 10);
      // 2c41  add hl,de -- back HL to the original (left) slot
      regs.addHl(regs.de);
      m.step(0x2c42, 11);
      // 2c42  jr 0x2c49
      m.step(0x2c49, 12);
    }
  }

  // loc_2c49:
  // 2c49  ld a,0x00
  regs.a = 0x00;
  m.step(0x2c4b, 7);
  // 2c4b  ld (hl),a -- clear the chosen slot
  mem.write8(regs.hl, regs.a);
  m.step(0x2c4c, 7);
  // 2c4c  ld a,c
  regs.a = regs.c;
  m.step(0x2c4d, 4);
  // 2c4d  add a,0x01 -- value + 1
  regs.add(0x01);
  m.step(0x2c4f, 7);
  // 2c4f  ld (0x80a9),a -- record byte 1
  mem.write8(0x80a9, regs.a);
  m.step(0x2c52, 13);
  // 2c52  ld a,b -- a = column index
  regs.a = regs.b;
  m.step(0x2c53, 4);
  // 2c53  cp 0x0c -- carry set iff left half (< 12)
  regs.cp(0x0c);
  m.step(0x2c55, 7);
  // 2c55  ld a,0xb7 -- left-half column base (flags untouched)
  regs.a = 0xb7;
  m.step(0x2c57, 7);
  // 2c57  jr c,0x2c5b -- left half: keep 0xb7
  if (regs.fC) {
    m.step(0x2c5b, 12);
  } else {
    m.step(0x2c59, 7);
    // 2c59  ld a,0xbf -- right-half column base
    regs.a = 0xbf;
    m.step(0x2c5b, 7);
  }

  // loc_2c5b: derive the tilemap cell address from 0x80a9 (row) and 0x80ac (column)
  // 2c5b  ld (0x80ac),a -- column base
  mem.write8(0x80ac, regs.a);
  m.step(0x2c5e, 13);
  // 2c5e  ld a,(0x80a9)
  regs.a = mem.read8(0x80a9);
  m.step(0x2c61, 13);
  // 2c61  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2c63, 8);
  // 2c63  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2c65, 8);
  // 2c65  srl a -- a = row >> 3
  regs.a = regs.srl(regs.a);
  m.step(0x2c67, 8);
  // 2c67  neg
  regs.neg();
  m.step(0x2c69, 8);
  // 2c69  add a,0x1f -- a = 0x1f - (row>>3): invert row into tilemap Y
  regs.add(0x1f);
  m.step(0x2c6b, 7);
  // 2c6b  ld h,a
  regs.h = regs.a;
  m.step(0x2c6c, 4);
  // 2c6c  ld a,(0x80ac)
  regs.a = mem.read8(0x80ac);
  m.step(0x2c6f, 13);
  // 2c6f  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x2c70, 4);
  // 2c70  ld e,a
  regs.e = regs.a;
  m.step(0x2c71, 4);
  // 2c71  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2c73, 8);
  // 2c73  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2c75, 8);
  // 2c75  srl a -- c = (col+1) >> 3 (tilemap X)
  regs.a = regs.srl(regs.a);
  m.step(0x2c77, 8);
  // 2c77  ld c,a
  regs.c = regs.a;
  m.step(0x2c78, 4);
  // 2c78  ld a,0x00
  regs.a = 0x00;
  m.step(0x2c7a, 7);
  // 2c7a  ld b,a -- bc = tilemap X
  regs.b = regs.a;
  m.step(0x2c7b, 4);
  // 2c7b  srl h
  regs.h = regs.srl(regs.h);
  m.step(0x2c7d, 8);
  // 2c7d  rra
  regs.rra();
  m.step(0x2c7e, 4);
  // 2c7e  srl h
  regs.h = regs.srl(regs.h);
  m.step(0x2c80, 8);
  // 2c80  rra
  regs.rra();
  m.step(0x2c81, 4);
  // 2c81  srl h
  regs.h = regs.srl(regs.h);
  m.step(0x2c83, 8);
  // 2c83  rra -- (h:a) >>= 3 : hl = Y * 32
  regs.rra();
  m.step(0x2c84, 4);
  // 2c84  ld l,a
  regs.l = regs.a;
  m.step(0x2c85, 4);
  // 2c85  add hl,bc -- hl = Y*32 + X
  regs.addHl(regs.bc);
  m.step(0x2c86, 11);
  // 2c86  ld bc,0x9000
  regs.bc = 0x9000;
  m.step(0x2c89, 10);
  // 2c89  add hl,bc -- + VRAM base
  regs.addHl(regs.bc);
  m.step(0x2c8a, 11);
  // 2c8a  ld a,0x25 -- tile code to paint
  regs.a = 0x25;
  m.step(0x2c8c, 7);
  // 2c8c  ld bc,0xffe1 -- -0x1f
  regs.bc = 0xffe1;
  m.step(0x2c8f, 10);
  // 2c8f  add hl,bc -- final cell address
  regs.addHl(regs.bc);
  m.step(0x2c90, 11);
  // 2c90  ld (hl),a -- paint tile 0x25 into the cell
  mem.write8(regs.hl, regs.a);
  m.step(0x2c91, 7);

  // loc_2c91: overlap test against the tracked object at 0x8068/0x806b
  // 2c91  ld d,0x00 -- default: no overlap
  regs.d = 0x00;
  m.step(0x2c93, 7);
  // 2c93  ld a,(0x806b)
  regs.a = mem.read8(0x806b);
  m.step(0x2c96, 13);
  // 2c96  ld b,a
  regs.b = regs.a;
  m.step(0x2c97, 4);
  // 2c97  ld a,(0x80ac)
  regs.a = mem.read8(0x80ac);
  m.step(0x2c9a, 13);
  // 2c9a  add a,0x0c
  regs.add(0x0c);
  m.step(0x2c9c, 7);
  // 2c9c  cp b -- same row band?
  regs.cp(regs.b);
  m.step(0x2c9d, 4);
  // 2c9d  jr nz,0x2cb0 -- different band: leave d = 0
  if (regs.fNZ) {
    m.step(0x2cb0, 12);
  } else {
    m.step(0x2c9f, 7);
    // 2c9f  ld a,(0x8068)
    regs.a = mem.read8(0x8068);
    m.step(0x2ca2, 13);
    // 2ca2  ld c,a
    regs.c = regs.a;
    m.step(0x2ca3, 4);
    // 2ca3  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2ca6, 13);
    // 2ca6  cp c
    regs.cp(regs.c);
    m.step(0x2ca7, 4);
    // 2ca7  jr nc,0x2cb0 -- object not to the right of the cell: leave d = 0
    if (regs.fNC) {
      m.step(0x2cb0, 12);
    } else {
      m.step(0x2ca9, 7);
      // 2ca9  add a,0x08
      regs.add(0x08);
      m.step(0x2cab, 7);
      // 2cab  cp c
      regs.cp(regs.c);
      m.step(0x2cac, 4);
      // 2cac  jr c,0x2cb0 -- object beyond the 8-pixel window: leave d = 0
      if (regs.fC) {
        m.step(0x2cb0, 12);
      } else {
        m.step(0x2cae, 7);
        // 2cae  ld d,0x01 -- overlap detected
        regs.d = 0x01;
        m.step(0x2cb0, 7);
      }
    }
  }

  // loc_2cb0:
  // 2cb0  ld a,d
  regs.a = regs.d;
  m.step(0x2cb1, 4);
  // 2cb1  ld (0x8080),a -- publish the overlap flag
  mem.write8(0x8080, regs.a);
  m.step(0x2cb4, 13);
  // 2cb4  jp 0x2bd3 -- tail-jump: 0x2bd3's ret returns to loc_2c04's caller
  m.step(0x2bd3, 10);
  return m.call(0x2bd3);
}
