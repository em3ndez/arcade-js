// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1a02  (ROM 0x1a02-0x1b58, The Pit) -- the VERTICAL-movement sibling of the
 * tile/terrain interaction handler loc_1704. It runs only while the "climb" gate
 * 0x8080 is clear; otherwise it bails straight to the epilogue. It derives the
 * actor's tilemap cell pointer 0x806e (=> IX) from the animation phase 0x8068 and
 * the column 0x806b, reads the tile under the actor (ix+0) into B, and dispatches
 * on that tile code exactly as loc_1704 does for the horizontal case -- consuming
 * collectibles (0x3a via call 0x467b / bump 0x8081; 0x3b/0x3c/0x3d via call 0x4683
 * / bump 0x8082), bailing on solid codes (0x2a/0x41/0xc1 and the 0x95-0x99 band),
 * or -- for the diggable band -- doing two direction-keyed table lookups
 * (0x2118 for the current cell -> 0x80a7, 0x2280 for the neighbour cell -> 0x80a8)
 * and, on a mismatch, staging a 0xf6 reaction event (0x8069:=0xf6, 0x80a2:=4,
 * 0x80a4:=(0x80a3)). The consume arm and the loc_1b45 default both fold the column
 * 0x806b back by the per-step delta 0x806d and pick sprite code 0xb4/0x34 by bit 1
 * before joining the epilogue.
 *
 * Preamble math (0x1a02-0x1a20): H := 0x1f - ((phase+3) >> 3) is the row anchor;
 * later (0x1a54) three `srl h`/`rra` pairs slide H's low 3 bits into L's top, and
 * two `add hl,bc` fold in the column-derived offset (E>>3) and the tilemap base
 * 0x9000 -- so IX = 0x9000 + ((0x1f-((phase+3)>>3)) tiled with column). The two
 * 3x`sla a`+`rl b` blocks build BC = ((tile-0x71)<<3) | (E&7 nibble) as a 16-bit
 * table index (the third sla spills bit 8 to carry, which `rl b` catches).
 *
 * EVERY terminal transfer is a TAIL-jump to the epilogue at 0x1b5b (loc_1b5b, which
 * builds the 4-byte sprite record at 0x8220 and RETs). Modelled `m.step(0x1b5b,t);
 * return m.call(0x1b5b)` with NO trailing m.ret -- loc_1b5b's own ret unwinds to
 * OUR caller; a second ret would double-pop. The block at 0x1b58 (`ld (0x8069),a`)
 * FALLS into 0x1b5b, which is the same tail-jump. The two real `call`s (0x467b /
 * 0x4683, score sfx) DO push their return address. Role is best-effort; addresses,
 * flags, cycle costs and control flow are exact, one JS statement per Z80
 * instruction. The loc_* labels below are basic blocks of this ONE routine (none is
 * referenced from outside 0x1a02-0x1b58 except the shared epilogue 0x1b5b); they
 * are driven by a label-dispatch loop (`next` holds the ROM address of the block to
 * run, exactly as loc_1704). The loop charges NO T-states; only m.step does.
 * Conditional costs follow the Z80: jr taken 12 / not 7; jp cc 10 either way;
 * call 17.
 *
 * loc_1a02:
 *   1a02  3a 80 80     ld   a,(0x8080)
 *   1a05  a7           and  a
 *   1a06  c2 5b 1b     jp   nz,0x1b5b
 *   1a09  3e b4        ld   a,0xb4
 *   1a0b  32 69 80     ld   (0x8069),a
 *   1a0e  3a 68 80     ld   a,(0x8068)
 *   1a11  c6 03        add  a,0x03
 *   1a13  cb 3f        srl  a
 *   1a15  cb 3f        srl  a
 *   1a17  cb 3f        srl  a
 *   1a19  ed 44        neg
 *   1a1b  c6 1f        add  a,0x1f
 *   1a1d  32 73 80     ld   (0x8073),a
 *   1a20  67           ld   h,a
 *   1a21  3a 6b 80     ld   a,(0x806b)
 *   1a24  fe 23        cp   0x23
 *   1a26  20 0f        jr   nz,0x1a37
 *   1a28  3a 78 80     ld   a,(0x8078)
 *   1a2b  a7           and  a
 *   1a2c  ca 5b 1b     jp   z,0x1b5b
 *   1a2f  3e 01        ld   a,0x01
 *   1a31  32 7b 80     ld   (0x807b),a
 *   1a34  c3 5b 1b     jp   0x1b5b
 * loc_1a37:
 *   1a37  fe 53        cp   0x53
 *   1a39  30 08        jr   nc,0x1a43
 *   1a3b  3e 00        ld   a,0x00
 *   1a3d  32 e7 80     ld   (0x80e7),a
 *   1a40  3a 6b 80     ld   a,(0x806b)
 * loc_1a43:
 *   1a43  92           sub  d
 *   1a44  c6 05        add  a,0x05
 *   1a46  5f           ld   e,a
 *   1a47  cb 3f        srl  a
 *   1a49  cb 3f        srl  a
 *   1a4b  cb 3f        srl  a
 *   1a4d  32 71 80     ld   (0x8071),a
 *   1a50  4f           ld   c,a
 *   1a51  3e 00        ld   a,0x00
 *   1a53  47           ld   b,a
 *   1a54  cb 3c        srl  h
 *   1a56  1f           rra
 *   1a57  cb 3c        srl  h
 *   1a59  1f           rra
 *   1a5a  cb 3c        srl  h
 *   1a5c  1f           rra
 *   1a5d  6f           ld   l,a
 *   1a5e  09           add  hl,bc
 *   1a5f  01 00 90     ld   bc,0x9000
 *   1a62  09           add  hl,bc
 *   1a63  22 6e 80     ld   (0x806e),hl
 *   1a66  dd 2a 6e 80  ld   ix,(0x806e)
 *   1a6a  3e 00        ld   a,0x00
 *   1a6c  32 a8 80     ld   (0x80a8),a
 *   1a6f  dd 7e 00     ld   a,(ix+0x00)
 *   1a72  32 a5 80     ld   (0x80a5),a
 *   1a75  32 a7 80     ld   (0x80a7),a
 *   1a78  47           ld   b,a
 *   1a79  7b           ld   a,e
 *   1a7a  e6 07        and  0x07
 *   1a7c  20 36        jr   nz,0x1ab4
 *   1a7e  78           ld   a,b
 *   1a7f  fe 3a        cp   0x3a
 *   1a81  20 0c        jr   nz,0x1a8f
 *   1a83  cd 7b 46     call 0x467b        ; +10 score sfx
 *   1a86  3a 81 80     ld   a,(0x8081)
 *   1a89  3c           inc  a
 *   1a8a  32 81 80     ld   (0x8081),a
 *   1a8d  18 19        jr   0x1aa8
 * loc_1a8f:
 *   1a8f  fe 3b        cp   0x3b
 *   1a91  28 08        jr   z,0x1a9b
 *   1a93  fe 3c        cp   0x3c
 *   1a95  28 04        jr   z,0x1a9b
 *   1a97  fe 3d        cp   0x3d
 *   1a99  20 19        jr   nz,0x1ab4
 * loc_1a9b:
 *   1a9b  32 78 80     ld   (0x8078),a
 *   1a9e  cd 83 46     call 0x4683        ; +20 score
 *   1aa1  3a 82 80     ld   a,(0x8082)
 *   1aa4  3c           inc  a
 *   1aa5  32 82 80     ld   (0x8082),a
 * loc_1aa8:
 *   1aa8  dd 2a 6e 80  ld   ix,(0x806e)
 *   1aac  3e 70        ld   a,0x70
 *   1aae  dd 77 00     ld   (ix+0x00),a
 *   1ab1  c3 45 1b     jp   0x1b45
 * loc_1ab4:
 *   1ab4  78           ld   a,b
 *   1ab5  fe 2a        cp   0x2a
 *   1ab7  ca 5b 1b     jp   z,0x1b5b
 *   1aba  fe 41        cp   0x41
 *   1abc  ca 5b 1b     jp   z,0x1b5b
 *   1abf  fe c1        cp   0xc1
 *   1ac1  ca 5b 1b     jp   z,0x1b5b
 *   1ac4  fe c5        cp   0xc5
 *   1ac6  28 0d        jr   z,0x1ad5
 *   1ac8  fe 95        cp   0x95
 *   1aca  38 10        jr   c,0x1adc
 *   1acc  fe 9a        cp   0x9a
 *   1ace  da 5b 1b     jp   c,0x1b5b
 *   1ad1  fe 9e        cp   0x9e
 *   1ad3  30 70        jr   nc,0x1b45
 * loc_1ad5:
 *   1ad5  cb 53        bit  2,e
 *   1ad7  20 03        jr   nz,0x1adc
 *   1ad9  c3 5b 1b     jp   0x1b5b
 * loc_1adc:
 *   1adc  fe 71        cp   0x71
 *   1ade  38 65        jr   c,0x1b45
 *   1ae0  fe 9e        cp   0x9e
 *   1ae2  30 61        jr   nc,0x1b45
 *   1ae4  57           ld   d,a
 *   1ae5  d6 71        sub  0x71
 *   1ae7  06 00        ld   b,0x00
 *   1ae9  cb 27        sla  a
 *   1aeb  cb 27        sla  a
 *   1aed  cb 27        sla  a
 *   1aef  cb 10        rl   b
 *   1af1  4f           ld   c,a
 *   1af2  7b           ld   a,e
 *   1af3  e6 07        and  0x07
 *   1af5  ee 07        xor  0x07
 *   1af7  b1           or   c
 *   1af8  4f           ld   c,a
 *   1af9  21 18 21     ld   hl,0x2118
 *   1afc  09           add  hl,bc
 *   1afd  7e           ld   a,(hl)
 *   1afe  32 a7 80     ld   (0x80a7),a
 *   1b01  ba           cp   d
 *   1b02  28 41        jr   z,0x1b45
 *   1b04  3a a3 80     ld   a,(0x80a3)
 *   1b07  32 a4 80     ld   (0x80a4),a
 *   1b0a  3e 04        ld   a,0x04
 *   1b0c  32 a2 80     ld   (0x80a2),a
 *   1b0f  3e f6        ld   a,0xf6
 *   1b11  32 69 80     ld   (0x8069),a
 *   1b14  7b           ld   a,e
 *   1b15  3c           inc  a
 *   1b16  e6 07        and  0x07
 *   1b18  28 41        jr   z,0x1b5b
 *   1b1a  dd 7e ff     ld   a,(ix-0x01)
 *   1b1d  32 a6 80     ld   (0x80a6),a
 *   1b20  fe 71        cp   0x71
 *   1b22  38 37        jr   c,0x1b5b
 *   1b24  fe 9e        cp   0x9e
 *   1b26  30 33        jr   nc,0x1b5b
 *   1b28  d6 71        sub  0x71
 *   1b2a  06 00        ld   b,0x00
 *   1b2c  cb 27        sla  a
 *   1b2e  cb 27        sla  a
 *   1b30  cb 27        sla  a
 *   1b32  cb 10        rl   b
 *   1b34  4f           ld   c,a
 *   1b35  7b           ld   a,e
 *   1b36  3c           inc  a
 *   1b37  e6 07        and  0x07
 *   1b39  b1           or   c
 *   1b3a  4f           ld   c,a
 *   1b3b  21 80 22     ld   hl,0x2280
 *   1b3e  09           add  hl,bc
 *   1b3f  7e           ld   a,(hl)
 *   1b40  32 a8 80     ld   (0x80a8),a
 *   1b43  18 16        jr   0x1b5b
 * loc_1b45:
 *   1b45  3a 6d 80     ld   a,(0x806d)
 *   1b48  57           ld   d,a
 *   1b49  3a 6b 80     ld   a,(0x806b)
 *   1b4c  92           sub  d
 *   1b4d  32 6b 80     ld   (0x806b),a
 *   1b50  e6 02        and  0x02
 *   1b52  3e b4        ld   a,0xb4
 *   1b54  28 02        jr   z,0x1b58
 *   1b56  3e 34        ld   a,0x34
 * loc_1b58:
 *   1b58  32 69 80     ld   (0x8069),a
 *   (fall into 0x1b5b -- loc_1b5b, the epilogue, RETs to OUR caller)
 */
export function loc_1a02(m) {
  const { regs, mem } = m;

  let next = 0x1a02;
  for (;;) {
    switch (next) {
      case 0x1a02: {
        regs.a = mem.read8(0x8080); m.step(0x1a05, 13); // 1a02  ld a,(0x8080) -- climb/vertical gate
        regs.and(regs.a); m.step(0x1a06, 4); // 1a05  and a -- Z iff gate == 0
        if (regs.fNZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1a06  jp nz,0x1b5b (gated off -> epilogue)
        m.step(0x1a09, 10); // 1a06  jp nz,0x1b5b (not taken)
        regs.a = 0xb4; m.step(0x1a0b, 7); // 1a09  ld a,0xb4
        mem.write8(0x8069, regs.a); m.step(0x1a0e, 13); // 1a0b  ld (0x8069),a -- default sprite code
        regs.a = mem.read8(0x8068); m.step(0x1a11, 13); // 1a0e  ld a,(0x8068) -- animation phase
        regs.add(0x03); m.step(0x1a13, 7); // 1a11  add a,0x03
        regs.a = regs.srl(regs.a); m.step(0x1a15, 8); // 1a13  srl a
        regs.a = regs.srl(regs.a); m.step(0x1a17, 8); // 1a15  srl a
        regs.a = regs.srl(regs.a); m.step(0x1a19, 8); // 1a17  srl a -- (phase+3) >> 3
        regs.neg(); m.step(0x1a1b, 8); // 1a19  neg
        regs.add(0x1f); m.step(0x1a1d, 7); // 1a1b  add a,0x1f -- H := 0x1f - ((phase+3)>>3)
        mem.write8(0x8073, regs.a); m.step(0x1a20, 13); // 1a1d  ld (0x8073),a
        regs.h = regs.a; m.step(0x1a21, 4); // 1a20  ld h,a -- row anchor
        regs.a = mem.read8(0x806b); m.step(0x1a24, 13); // 1a21  ld a,(0x806b) -- column
        regs.cp(0x23); m.step(0x1a26, 7); // 1a24  cp 0x23
        if (regs.fNZ) { m.step(0x1a37, 12); next = 0x1a37; break; } // 1a26  jr nz,0x1a37 (column != 0x23)
        m.step(0x1a28, 7); // 1a26  jr nz,0x1a37 (not taken -- column == 0x23, top rung)
        regs.a = mem.read8(0x8078); m.step(0x1a2b, 13); // 1a28  ld a,(0x8078)
        regs.and(regs.a); m.step(0x1a2c, 4); // 1a2b  and a
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1a2c  jp z,0x1b5b (0x8078 clear -> epilogue)
        m.step(0x1a2f, 10); // 1a2c  jp z,0x1b5b (not taken)
        regs.a = 0x01; m.step(0x1a31, 7); // 1a2f  ld a,0x01
        mem.write8(0x807b, regs.a); m.step(0x1a34, 13); // 1a31  ld (0x807b),a -- latch top-rung flag
        m.step(0x1b5b, 10); return m.call(0x1b5b); // 1a34  jp 0x1b5b
      }
      case 0x1a37: {
        regs.cp(0x53); m.step(0x1a39, 7); // 1a37  cp 0x53
        if (regs.fNC) { m.step(0x1a43, 12); next = 0x1a43; break; } // 1a39  jr nc,0x1a43 (column >= 0x53)
        m.step(0x1a3b, 7); // 1a39  jr nc,0x1a43 (not taken -- column < 0x53)
        regs.a = 0x00; m.step(0x1a3d, 7); // 1a3b  ld a,0x00
        mem.write8(0x80e7, regs.a); m.step(0x1a40, 13); // 1a3d  ld (0x80e7),a -- clear scratch
        regs.a = mem.read8(0x806b); m.step(0x1a43, 13); // 1a40  ld a,(0x806b) -- reload column, fall into loc_1a43
        next = 0x1a43; break;
      }
      case 0x1a43: {
        regs.sub(regs.d); m.step(0x1a44, 4); // 1a43  sub d -- column - move delta
        regs.add(0x05); m.step(0x1a46, 7); // 1a44  add a,0x05
        regs.e = regs.a; m.step(0x1a47, 4); // 1a46  ld e,a -- E := column - d + 5 (sub-cell accumulator)
        regs.a = regs.srl(regs.a); m.step(0x1a49, 8); // 1a47  srl a
        regs.a = regs.srl(regs.a); m.step(0x1a4b, 8); // 1a49  srl a
        regs.a = regs.srl(regs.a); m.step(0x1a4d, 8); // 1a4b  srl a -- E >> 3 (cell column)
        mem.write8(0x8071, regs.a); m.step(0x1a50, 13); // 1a4d  ld (0x8071),a
        regs.c = regs.a; m.step(0x1a51, 4); // 1a50  ld c,a
        regs.a = 0x00; m.step(0x1a53, 7); // 1a51  ld a,0x00
        regs.b = regs.a; m.step(0x1a54, 4); // 1a53  ld b,a -- BC := E>>3
        regs.h = regs.srl(regs.h); m.step(0x1a56, 8); // 1a54  srl h
        regs.rra(); m.step(0x1a57, 4); // 1a56  rra
        regs.h = regs.srl(regs.h); m.step(0x1a59, 8); // 1a57  srl h
        regs.rra(); m.step(0x1a5a, 4); // 1a59  rra
        regs.h = regs.srl(regs.h); m.step(0x1a5c, 8); // 1a5a  srl h
        regs.rra(); m.step(0x1a5d, 4); // 1a5c  rra -- slide H's low 3 bits into A's top
        regs.l = regs.a; m.step(0x1a5e, 4); // 1a5d  ld l,a
        regs.addHl(regs.bc); m.step(0x1a5f, 11); // 1a5e  add hl,bc -- fold in the cell column
        regs.bc = 0x9000; m.step(0x1a62, 10); // 1a5f  ld bc,0x9000 -- tilemap base
        regs.addHl(regs.bc); m.step(0x1a63, 11); // 1a62  add hl,bc
        mem.write16(0x806e, regs.hl); m.step(0x1a66, 16); // 1a63  ld (0x806e),hl -- actor cell pointer
        regs.ix = mem.read16(0x806e); m.step(0x1a6a, 20); // 1a66  ld ix,(0x806e)
        regs.a = 0x00; m.step(0x1a6c, 7); // 1a6a  ld a,0x00
        mem.write8(0x80a8, regs.a); m.step(0x1a6f, 13); // 1a6c  ld (0x80a8),a -- pre-clear neighbour slot
        regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x1a72, 19); // 1a6f  ld a,(ix+0x00) -- tile under actor
        mem.write8(0x80a5, regs.a); m.step(0x1a75, 13); // 1a72  ld (0x80a5),a
        mem.write8(0x80a7, regs.a); m.step(0x1a78, 13); // 1a75  ld (0x80a7),a
        regs.b = regs.a; m.step(0x1a79, 4); // 1a78  ld b,a -- keep tile in B
        regs.a = regs.e; m.step(0x1a7a, 4); // 1a79  ld a,e
        regs.and(0x07); m.step(0x1a7c, 7); // 1a7a  and 0x07 -- on a cell boundary?
        if (regs.fNZ) { m.step(0x1ab4, 12); next = 0x1ab4; break; } // 1a7c  jr nz,0x1ab4 (off boundary -> classify)
        m.step(0x1a7e, 7); // 1a7c  jr nz,0x1ab4 (not taken -- on boundary)
        regs.a = regs.b; m.step(0x1a7f, 4); // 1a7e  ld a,b
        regs.cp(0x3a); m.step(0x1a81, 7); // 1a7f  cp 0x3a
        if (regs.fNZ) { m.step(0x1a8f, 12); next = 0x1a8f; break; } // 1a81  jr nz,0x1a8f (not the 0x3a collectible)
        m.step(0x1a83, 7); // 1a81  jr nz,0x1a8f (not taken -- tile == 0x3a)
        m.push16(0x1a86); m.step(0x467b, 17); m.call(0x467b); // 1a83  call 0x467b -- +10 score sfx
        regs.a = mem.read8(0x8081); m.step(0x1a89, 13); // 1a86  ld a,(0x8081)
        regs.a = regs.inc8(regs.a); m.step(0x1a8a, 4); // 1a89  inc a
        mem.write8(0x8081, regs.a); m.step(0x1a8d, 13); // 1a8a  ld (0x8081),a -- bump 0x3a counter
        m.step(0x1aa8, 12); next = 0x1aa8; break; // 1a8d  jr 0x1aa8 (consume)
      }
      case 0x1a8f: {
        regs.cp(0x3b); m.step(0x1a91, 7); // 1a8f  cp 0x3b
        if (regs.fZ) { m.step(0x1a9b, 12); next = 0x1a9b; break; } // 1a91  jr z,0x1a9b
        m.step(0x1a93, 7); // 1a91  jr z,0x1a9b (not taken)
        regs.cp(0x3c); m.step(0x1a95, 7); // 1a93  cp 0x3c
        if (regs.fZ) { m.step(0x1a9b, 12); next = 0x1a9b; break; } // 1a95  jr z,0x1a9b
        m.step(0x1a97, 7); // 1a95  jr z,0x1a9b (not taken)
        regs.cp(0x3d); m.step(0x1a99, 7); // 1a97  cp 0x3d
        if (regs.fNZ) { m.step(0x1ab4, 12); next = 0x1ab4; break; } // 1a99  jr nz,0x1ab4 (none of 0x3b/0x3c/0x3d)
        m.step(0x1a9b, 7); next = 0x1a9b; break; // 1a99  jr nz,0x1ab4 (not taken -- tile == 0x3d, fall into loc_1a9b)
      }
      case 0x1a9b: {
        mem.write8(0x8078, regs.a); m.step(0x1a9e, 13); // 1a9b  ld (0x8078),a -- record consumed tile code
        m.push16(0x1aa1); m.step(0x4683, 17); m.call(0x4683); // 1a9e  call 0x4683 -- +20 score
        regs.a = mem.read8(0x8082); m.step(0x1aa1, 13); // 1aa1  ld a,(0x8082)
        regs.a = regs.inc8(regs.a); m.step(0x1aa4, 4); // 1aa4  inc a
        mem.write8(0x8082, regs.a); m.step(0x1aa8, 13); // 1aa5  ld (0x8082),a -- bump 0x3b/c/d counter, fall into loc_1aa8
        next = 0x1aa8; break;
      }
      case 0x1aa8: {
        regs.ix = mem.read16(0x806e); m.step(0x1aac, 20); // 1aa8  ld ix,(0x806e) -- actor cell ptr
        regs.a = 0x70; m.step(0x1aae, 7); // 1aac  ld a,0x70
        mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x1ab1, 19); // 1aae  ld (ix+0x00),a -- blank consumed cell
        m.step(0x1b45, 10); next = 0x1b45; break; // 1ab1  jp 0x1b45
      }
      case 0x1ab4: {
        regs.a = regs.b; m.step(0x1ab5, 4); // 1ab4  ld a,b -- tile code
        regs.cp(0x2a); m.step(0x1ab7, 7); // 1ab5  cp 0x2a
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1ab7  jp z,0x1b5b (solid)
        m.step(0x1aba, 10); // 1ab7  jp z,0x1b5b (not taken)
        regs.cp(0x41); m.step(0x1abc, 7); // 1aba  cp 0x41
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1abc  jp z,0x1b5b (solid)
        m.step(0x1abf, 10); // 1abc  jp z,0x1b5b (not taken)
        regs.cp(0xc1); m.step(0x1ac1, 7); // 1abf  cp 0xc1
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1ac1  jp z,0x1b5b (solid)
        m.step(0x1ac4, 10); // 1ac1  jp z,0x1b5b (not taken)
        regs.cp(0xc5); m.step(0x1ac6, 7); // 1ac4  cp 0xc5
        if (regs.fZ) { m.step(0x1ad5, 12); next = 0x1ad5; break; } // 1ac6  jr z,0x1ad5
        m.step(0x1ac8, 7); // 1ac6  jr z,0x1ad5 (not taken)
        regs.cp(0x95); m.step(0x1aca, 7); // 1ac8  cp 0x95
        if (regs.fC) { m.step(0x1adc, 12); next = 0x1adc; break; } // 1aca  jr c,0x1adc (tile < 0x95 -> table check)
        m.step(0x1acc, 7); // 1aca  jr c,0x1adc (not taken)
        regs.cp(0x9a); m.step(0x1ace, 7); // 1acc  cp 0x9a
        if (regs.fC) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1ace  jp c,0x1b5b (0x95-0x99 solid)
        m.step(0x1ad1, 10); // 1ace  jp c,0x1b5b (not taken)
        regs.cp(0x9e); m.step(0x1ad3, 7); // 1ad1  cp 0x9e
        if (regs.fNC) { m.step(0x1b45, 12); next = 0x1b45; break; } // 1ad3  jr nc,0x1b45 (tile >= 0x9e -> passable)
        m.step(0x1ad5, 7); next = 0x1ad5; break; // 1ad3  jr nc,0x1b45 (not taken -- 0x9a-0x9d, fall into loc_1ad5)
      }
      case 0x1ad5: {
        regs.bit(2, regs.e); m.step(0x1ad7, 8); // 1ad5  bit 2,e (Z = !bit2 of E)
        if (regs.fNZ) { m.step(0x1adc, 12); next = 0x1adc; break; } // 1ad7  jr nz,0x1adc (bit2 set -> table check)
        m.step(0x1ad9, 7); // 1ad7  jr nz,0x1adc (not taken -- Z80 jr cc not-taken is 7 T, not 10)
        m.step(0x1b5b, 10); return m.call(0x1b5b); // 1ad9  jp 0x1b5b (bit2 clear -> solid)
      }
      case 0x1adc: {
        regs.cp(0x71); m.step(0x1ade, 7); // 1adc  cp 0x71
        if (regs.fC) { m.step(0x1b45, 12); next = 0x1b45; break; } // 1ade  jr c,0x1b45 (tile < 0x71 -> passable)
        m.step(0x1ae0, 7); // 1ade  jr c,0x1b45 (not taken)
        regs.cp(0x9e); m.step(0x1ae2, 7); // 1ae0  cp 0x9e
        if (regs.fNC) { m.step(0x1b45, 12); next = 0x1b45; break; } // 1ae2  jr nc,0x1b45 (tile >= 0x9e -> passable)
        m.step(0x1ae4, 7); // 1ae2  jr nc,0x1b45 (not taken -- 0x71..0x9d)
        regs.d = regs.a; m.step(0x1ae5, 4); // 1ae4  ld d,a -- keep tile code in D
        regs.sub(0x71); m.step(0x1ae7, 7); // 1ae5  sub 0x71 -- table row index
        regs.b = 0x00; m.step(0x1ae9, 7); // 1ae7  ld b,0x00
        regs.a = regs.sla(regs.a); m.step(0x1aeb, 8); // 1ae9  sla a
        regs.a = regs.sla(regs.a); m.step(0x1aed, 8); // 1aeb  sla a
        regs.a = regs.sla(regs.a); m.step(0x1aef, 8); // 1aed  sla a -- row*8, carry -> bit8
        regs.b = regs.rl(regs.b); m.step(0x1af1, 8); // 1aef  rl b -- capture bit8 into B
        regs.c = regs.a; m.step(0x1af2, 4); // 1af1  ld c,a
        regs.a = regs.e; m.step(0x1af3, 4); // 1af2  ld a,e
        regs.and(0x07); m.step(0x1af5, 7); // 1af3  and 0x07 -- sub-cell offset
        regs.xor(0x07); m.step(0x1af7, 7); // 1af5  xor 0x07 -- mirror it (7 - (E&7))
        regs.or(regs.c); m.step(0x1af8, 4); // 1af7  or c -- BC = row*8 | mirrored offset
        regs.c = regs.a; m.step(0x1af9, 4); // 1af8  ld c,a
        regs.hl = 0x2118; m.step(0x1afc, 10); // 1af9  ld hl,0x2118 -- current-cell table
        regs.addHl(regs.bc); m.step(0x1afd, 11); // 1afc  add hl,bc
        regs.a = mem.read8(regs.hl); m.step(0x1afe, 7); // 1afd  ld a,(hl) -- expected tile
        mem.write8(0x80a7, regs.a); m.step(0x1b01, 13); // 1afe  ld (0x80a7),a
        regs.cp(regs.d); m.step(0x1b02, 4); // 1b01  cp d -- matches the running tile?
        if (regs.fZ) { m.step(0x1b45, 12); next = 0x1b45; break; } // 1b02  jr z,0x1b45 (match -> passable)
        m.step(0x1b04, 7); // 1b02  jr z,0x1b45 (not taken -- mismatch: stage reaction)
        regs.a = mem.read8(0x80a3); m.step(0x1b07, 13); // 1b04  ld a,(0x80a3)
        mem.write8(0x80a4, regs.a); m.step(0x1b0a, 13); // 1b07  ld (0x80a4),a
        regs.a = 0x04; m.step(0x1b0c, 7); // 1b0a  ld a,0x04
        mem.write8(0x80a2, regs.a); m.step(0x1b0f, 13); // 1b0c  ld (0x80a2),a
        regs.a = 0xf6; m.step(0x1b11, 7); // 1b0f  ld a,0xf6
        mem.write8(0x8069, regs.a); m.step(0x1b14, 13); // 1b11  ld (0x8069),a -- arm 0xf6 event
        regs.a = regs.e; m.step(0x1b15, 4); // 1b14  ld a,e
        regs.a = regs.inc8(regs.a); m.step(0x1b16, 4); // 1b15  inc a
        regs.and(0x07); m.step(0x1b18, 7); // 1b16  and 0x07 -- next sub-cell on a boundary?
        if (regs.fZ) { m.step(0x1b5b, 12); return m.call(0x1b5b); } // 1b18  jr z,0x1b5b (boundary -> skip neighbour lookup)
        m.step(0x1b1a, 7); // 1b18  jr z,0x1b5b (not taken)
        regs.a = mem.read8((regs.ix - 0x01) & 0xffff); m.step(0x1b1d, 19); // 1b1a  ld a,(ix-0x01) -- neighbour tile
        mem.write8(0x80a6, regs.a); m.step(0x1b20, 13); // 1b1d  ld (0x80a6),a
        regs.cp(0x71); m.step(0x1b22, 7); // 1b20  cp 0x71
        if (regs.fC) { m.step(0x1b5b, 12); return m.call(0x1b5b); } // 1b22  jr c,0x1b5b (neighbour < 0x71 -> no lookup)
        m.step(0x1b24, 7); // 1b22  jr c,0x1b5b (not taken)
        regs.cp(0x9e); m.step(0x1b26, 7); // 1b24  cp 0x9e
        if (regs.fNC) { m.step(0x1b5b, 12); return m.call(0x1b5b); } // 1b26  jr nc,0x1b5b (neighbour >= 0x9e -> no lookup)
        m.step(0x1b28, 7); // 1b26  jr nc,0x1b5b (not taken -- neighbour in [0x71,0x9e))
        regs.sub(0x71); m.step(0x1b2a, 7); // 1b28  sub 0x71 -- table row index
        regs.b = 0x00; m.step(0x1b2c, 7); // 1b2a  ld b,0x00
        regs.a = regs.sla(regs.a); m.step(0x1b2e, 8); // 1b2c  sla a
        regs.a = regs.sla(regs.a); m.step(0x1b30, 8); // 1b2e  sla a
        regs.a = regs.sla(regs.a); m.step(0x1b32, 8); // 1b30  sla a -- row*8, carry -> bit8
        regs.b = regs.rl(regs.b); m.step(0x1b34, 8); // 1b32  rl b -- capture bit8 into B
        regs.c = regs.a; m.step(0x1b35, 4); // 1b34  ld c,a
        regs.a = regs.e; m.step(0x1b36, 4); // 1b35  ld a,e
        regs.a = regs.inc8(regs.a); m.step(0x1b37, 4); // 1b36  inc a
        regs.and(0x07); m.step(0x1b39, 7); // 1b37  and 0x07 -- next sub-cell offset
        regs.or(regs.c); m.step(0x1b3a, 4); // 1b39  or c -- BC = row*8 | offset
        regs.c = regs.a; m.step(0x1b3b, 4); // 1b3a  ld c,a
        regs.hl = 0x2280; m.step(0x1b3e, 10); // 1b3b  ld hl,0x2280 -- neighbour-cell table
        regs.addHl(regs.bc); m.step(0x1b3f, 11); // 1b3e  add hl,bc
        regs.a = mem.read8(regs.hl); m.step(0x1b40, 7); // 1b3f  ld a,(hl)
        mem.write8(0x80a8, regs.a); m.step(0x1b43, 13); // 1b40  ld (0x80a8),a
        m.step(0x1b5b, 12); return m.call(0x1b5b); // 1b43  jr 0x1b5b
      }
      case 0x1b45: {
        regs.a = mem.read8(0x806d); m.step(0x1b48, 13); // 1b45  ld a,(0x806d) -- per-step delta
        regs.d = regs.a; m.step(0x1b49, 4); // 1b48  ld d,a
        regs.a = mem.read8(0x806b); m.step(0x1b4c, 13); // 1b49  ld a,(0x806b) -- column
        regs.sub(regs.d); m.step(0x1b4d, 4); // 1b4c  sub d -- advance column by the delta
        mem.write8(0x806b, regs.a); m.step(0x1b50, 13); // 1b4d  ld (0x806b),a
        regs.and(0x02); m.step(0x1b52, 7); // 1b50  and 0x02 -- bit1 selects the sprite frame
        regs.a = 0xb4; m.step(0x1b54, 7); // 1b52  ld a,0xb4 (flags survive from and 0x02)
        if (regs.fZ) { m.step(0x1b58, 12); next = 0x1b58; break; } // 1b54  jr z,0x1b58 (bit1 clear -> keep 0xb4)
        m.step(0x1b56, 7); // 1b54  jr z,0x1b58 (not taken)
        regs.a = 0x34; m.step(0x1b58, 7); // 1b56  ld a,0x34 (bit1 set -> 0x34), fall into loc_1b58
        next = 0x1b58; break;
      }
      case 0x1b58: {
        mem.write8(0x8069, regs.a); m.step(0x1b5b, 13); // 1b58  ld (0x8069),a -- sprite code; fall into loc_1b5b epilogue
        return m.call(0x1b5b);
      }
      default:
        throw new Error(
          "loc_1a02: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
