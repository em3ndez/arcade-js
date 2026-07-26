// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_29ad  (ROM 0x29ad-0x2bcf, The Pit) -- the per-frame handler for the digging
 * object anchored at (0x806e). It first clears three "overlap" flags 0x8080/0x807f/
 * 0x807e; when BOTH (0x8078) and (0x8076) are non-zero it gates on the projectile
 * counter 0x80bd (0 -> loc_2bf2, spawn) and on (0x80aa)!=0x30 (-> loc_2cb7). It then
 * dispatches on (0x80bd): 0 -> loc_2f71; ==2 -> compute an overlap flag D from the
 * object bbox vs (0x806b)/(0x80b9)/(0x8068)/(0x80b6), store it into 0x8080. It runs
 * the 0x80b1 animation timer: while it counts down it advances the dig position
 * (0x80a9) and either steps a sub-phase (loc_2a52/loc_2a6e) or re-carves the tile map
 * -- computing a VRAM cell address into 0x80af from (0x80a9)/(0x80ac) (the loc_2b16
 * arithmetic), classifying the tile there, remapping it through the 0x2dc7 table, and
 * poking (ix+0)/(ix+1) -- then calls 0x4c9b, decrements 0x80bd and (while non-zero)
 * tail-jumps to 0x2934 (the second-entity path inside loc_28ab). Every terminal path
 * leaves via a tail-jump to another routine (loc_2bd3/loc_2f71/loc_2cb7/loc_2bf2/
 * loc_2934); there is no plain `ret` in this routine. (Role is best-effort from the
 * code; the addresses, constants and control flow are exact.)
 *
 * The forward-jump targets that are only reached from within this routine
 * (loc_29d3/loc_29ff/loc_2a03/loc_2a52/loc_2a65/loc_2a6e/loc_2a87/loc_2aaa/loc_2ab1/
 * loc_2ae6/loc_2b11/loc_2b16/loc_2b6e/loc_2b9f/loc_2ba4/loc_2bac/loc_2bae) are
 * modelled as local closures reached by `return loc_xxxx()`. Jumps OUT to other ROM
 * routines (0x2bf2, 0x2cb7, 0x2f71, 0x2bd3, 0x2934) are tail-jumps: `m.step(target,T)`
 * then `return m.call(target)` with NO trailing `m.ret` -- the callee's own `ret`
 * returns to loc_29ad's caller. The three `call`s (0x4c77/0x1b5b/0x4c9b) push their
 * return address, step to the target and `m.call` it. `jr cc` = 12 T taken / 7 T not
 * taken; `jp cc` = 10 T either way; unconditional `jr` = 12 T, `jp` = 10 T.
 *
 * loc_29ad:
 *   29ad  3e 00        ld   a,0x00
 *   29af  32 80 80     ld   (0x8080),a
 *   29b2  32 7f 80     ld   (0x807f),a
 *   29b5  32 7e 80     ld   (0x807e),a
 *   29b8  3a 78 80     ld   a,(0x8078)
 *   29bb  b7           or   a
 *   29bc  28 15        jr   z,0x29d3
 *   29be  3a 76 80     ld   a,(0x8076)
 *   29c1  b7           or   a
 *   29c2  28 0f        jr   z,0x29d3
 *   29c4  3a bd 80     ld   a,(0x80bd)
 *   29c7  b7           or   a
 *   29c8  ca f2 2b     jp   z,0x2bf2
 *   29cb  3a aa 80     ld   a,(0x80aa)
 *   29ce  fe 30        cp   0x30
 *   29d0  c2 b7 2c     jp   nz,0x2cb7
 * loc_29d3:
 *   29d3  3a bd 80     ld   a,(0x80bd)
 *   29d6  b7           or   a
 *   29d7  ca 71 2f     jp   z,0x2f71
 *   29da  fe 02        cp   0x02
 *   29dc  20 25        jr   nz,0x2a03
 *   29de  16 00        ld   d,0x00
 *   29e0  3a 6b 80     ld   a,(0x806b)
 *   29e3  47           ld   b,a
 *   29e4  3a b9 80     ld   a,(0x80b9)
 *   29e7  c6 0c        add  a,0x0c
 *   29e9  b8           cp   b
 *   29ea  20 13        jr   nz,0x29ff
 *   29ec  3a 68 80     ld   a,(0x8068)
 *   29ef  4f           ld   c,a
 *   29f0  3a b6 80     ld   a,(0x80b6)
 *   29f3  e6 fe        and  0xfe
 *   29f5  b9           cp   c
 *   29f6  30 07        jr   nc,0x29ff
 *   29f8  c6 08        add  a,0x08
 *   29fa  b9           cp   c
 *   29fb  38 02        jr   c,0x29ff
 *   29fd  16 01        ld   d,0x01
 * loc_29ff:
 *   29ff  7a           ld   a,d
 *   2a00  32 80 80     ld   (0x8080),a
 * loc_2a03:
 *   2a03  3a b1 80     ld   a,(0x80b1)
 *   2a06  a7           and  a
 *   2a07  ca b1 2a     jp   z,0x2ab1
 *   2a0a  3d           dec  a
 *   2a0b  32 b1 80     ld   (0x80b1),a
 *   2a0e  20 42        jr   nz,0x2a52
 *   2a10  3a a9 80     ld   a,(0x80a9)
 *   2a13  3d           dec  a
 *   2a14  32 a9 80     ld   (0x80a9),a
 *   2a17  3a c1 80     ld   a,(0x80c1)
 *   2a1a  a7           and  a
 *   2a1b  ca b1 2a     jp   z,0x2ab1
 *   2a1e  3a ac 80     ld   a,(0x80ac)
 *   2a21  c6 08        add  a,0x08
 *   2a23  32 ac 80     ld   (0x80ac),a
 *   2a26  cd 77 4c     call 0x4c77
 *   2a29  3e 09        ld   a,0x09
 *   2a2b  32 69 80     ld   (0x8069),a
 *   2a2e  cd 5b 1b     call 0x1b5b
 *   2a31  3e 00        ld   a,0x00
 *   2a33  32 bd 80     ld   (0x80bd),a
 *   2a36  3e b4        ld   a,0xb4
 *   2a38  32 7c 80     ld   (0x807c),a
 *   2a3b  3a c0 80     ld   a,(0x80c0)
 *   2a3e  fe 02        cp   0x02
 *   2a40  c2 d3 2b     jp   nz,0x2bd3
 *   2a43  dd 2a 6e 80  ld   ix,(0x806e)
 *   2a47  dd 36 fe c1  ld   (ix-0x02),0xc1
 *   2a4b  dd 36 fd 70  ld   (ix-0x03),0x70
 *   2a4f  c3 d3 2b     jp   0x2bd3
 * loc_2a52:
 *   2a52  e6 07        and  0x07
 *   2a54  28 0f        jr   z,0x2a65
 *   2a56  e6 03        and  0x03
 *   2a58  20 2d        jr   nz,0x2a87
 *   2a5a  3a a9 80     ld   a,(0x80a9)
 *   2a5d  3c           inc  a
 *   2a5e  32 a9 80     ld   (0x80a9),a
 *   2a61  06 b7        ld   b,0xb7
 *   2a63  18 09        jr   0x2a6e
 * loc_2a65:
 *   2a65  3a a9 80     ld   a,(0x80a9)
 *   2a68  3d           dec  a
 *   2a69  32 a9 80     ld   (0x80a9),a
 *   2a6c  06 37        ld   b,0x37
 * loc_2a6e:
 *   2a6e  3a c1 80     ld   a,(0x80c1)
 *   2a71  b7           or   a
 *   2a72  28 13        jr   z,0x2a87
 *   2a74  78           ld   a,b
 *   2a75  32 69 80     ld   (0x8069),a
 *   2a78  3a c0 80     ld   a,(0x80c0)
 *   2a7b  fe 02        cp   0x02
 *   2a7d  20 08        jr   nz,0x2a87
 *   2a7f  dd 2a 6e 80  ld   ix,(0x806e)
 *   2a83  dd 36 fd c1  ld   (ix-0x03),0xc1
 * loc_2a87:
 *   2a87  3a 80 80     ld   a,(0x8080)
 *   2a8a  57           ld   d,a
 *   2a8b  3a 6b 80     ld   a,(0x806b)
 *   2a8e  47           ld   b,a
 *   2a8f  3a ac 80     ld   a,(0x80ac)
 *   2a92  c6 0c        add  a,0x0c
 *   2a94  b8           cp   b
 *   2a95  20 13        jr   nz,0x2aaa
 *   2a97  3a 68 80     ld   a,(0x8068)
 *   2a9a  4f           ld   c,a
 *   2a9b  3a a9 80     ld   a,(0x80a9)
 *   2a9e  e6 fe        and  0xfe
 *   2aa0  b9           cp   c
 *   2aa1  30 07        jr   nc,0x2aaa
 *   2aa3  c6 08        add  a,0x08
 *   2aa5  b9           cp   c
 *   2aa6  38 02        jr   c,0x2aaa
 *   2aa8  16 01        ld   d,0x01
 * loc_2aaa:
 *   2aaa  7a           ld   a,d
 *   2aab  32 80 80     ld   (0x8080),a
 *   2aae  c3 d3 2b     jp   0x2bd3
 * loc_2ab1:
 *   2ab1  3a c1 80     ld   a,(0x80c1)
 *   2ab4  a7           and  a
 *   2ab5  20 2f        jr   nz,0x2ae6
 *   2ab7  3a 6b 80     ld   a,(0x806b)
 *   2aba  47           ld   b,a
 *   2abb  3a ac 80     ld   a,(0x80ac)
 *   2abe  c6 0a        add  a,0x0a
 *   2ac0  b8           cp   b
 *   2ac1  30 23        jr   nc,0x2ae6
 *   2ac3  c6 03        add  a,0x03
 *   2ac5  b8           cp   b
 *   2ac6  38 1e        jr   c,0x2ae6
 *   2ac8  3a 68 80     ld   a,(0x8068)
 *   2acb  4f           ld   c,a
 *   2acc  3a a9 80     ld   a,(0x80a9)
 *   2acf  d6 03        sub  0x03
 *   2ad1  b9           cp   c
 *   2ad2  30 12        jr   nc,0x2ae6
 *   2ad4  c6 0b        add  a,0x0b
 *   2ad6  b9           cp   c
 *   2ad7  38 0d        jr   c,0x2ae6
 *   2ad9  d6 04        sub  0x04
 *   2adb  32 68 80     ld   (0x8068),a
 *   2ade  3e 01        ld   a,0x01
 *   2ae0  32 c1 80     ld   (0x80c1),a
 *   2ae3  c3 87 2a     jp   0x2a87
 * loc_2ae6:
 *   2ae6  3a 6b 80     ld   a,(0x806b)
 *   2ae9  47           ld   b,a
 *   2aea  3a ac 80     ld   a,(0x80ac)
 *   2aed  d6 05        sub  0x05
 *   2aef  b8           cp   b
 *   2af0  30 24        jr   nc,0x2b16
 *   2af2  c6 11        add  a,0x11
 *   2af4  38 20        jr   c,0x2b16
 *   2af6  3a 68 80     ld   a,(0x8068)
 *   2af9  c6 03        add  a,0x03
 *   2afb  e6 f8        and  0xf8
 *   2afd  4f           ld   c,a
 *   2afe  3a a9 80     ld   a,(0x80a9)
 *   2b01  3d           dec  a
 *   2b02  b9           cp   c
 *   2b03  28 0c        jr   z,0x2b11
 *   2b05  c6 10        add  a,0x10
 *   2b07  b9           cp   c
 *   2b08  20 0c        jr   nz,0x2b16
 *   2b0a  3e 01        ld   a,0x01
 *   2b0c  32 7e 80     ld   (0x807e),a
 *   2b0f  18 05        jr   0x2b16
 * loc_2b11:
 *   2b11  3e 01        ld   a,0x01
 *   2b13  32 7f 80     ld   (0x807f),a
 * loc_2b16:
 *   2b16  3a a9 80     ld   a,(0x80a9)
 *   2b19  c6 07        add  a,0x07
 *   2b1b  cb 3f        srl  a
 *   2b1d  cb 3f        srl  a
 *   2b1f  cb 3f        srl  a
 *   2b21  ed 44        neg
 *   2b23  c6 1f        add  a,0x1f
 *   2b25  67           ld   h,a
 *   2b26  3a ac 80     ld   a,(0x80ac)
 *   2b29  c6 01        add  a,0x01
 *   2b2b  32 ac 80     ld   (0x80ac),a
 *   2b2e  c6 09        add  a,0x09
 *   2b30  5f           ld   e,a
 *   2b31  cb 3f        srl  a
 *   2b33  cb 3f        srl  a
 *   2b35  cb 3f        srl  a
 *   2b37  4f           ld   c,a
 *   2b38  3e 00        ld   a,0x00
 *   2b3a  47           ld   b,a
 *   2b3b  cb 3c        srl  h
 *   2b3d  1f           rra
 *   2b3e  cb 3c        srl  h
 *   2b40  1f           rra
 *   2b41  cb 3c        srl  h
 *   2b43  1f           rra
 *   2b44  6f           ld   l,a
 *   2b45  09           add  hl,bc
 *   2b46  01 00 90     ld   bc,0x9000
 *   2b49  09           add  hl,bc
 *   2b4a  22 af 80     ld   (0x80af),hl
 *   2b4d  dd 2a af 80  ld   ix,(0x80af)
 *   2b51  16 c1        ld   d,0xc1
 *   2b53  dd 7e 01     ld   a,(ix+0x01)
 *   2b56  fe 2a        cp   0x2a
 *   2b58  28 52        jr   z,0x2bac
 *   2b5a  fe 2b        cp   0x2b
 *   2b5c  28 4e        jr   z,0x2bac
 *   2b5e  fe c1        cp   0xc1
 *   2b60  28 4a        jr   z,0x2bac
 *   2b62  fe 95        cp   0x95
 *   2b64  28 46        jr   z,0x2bac
 *   2b66  fe c4        cp   0xc4
 *   2b68  20 04        jr   nz,0x2b6e
 *   2b6a  cb 53        bit  2,e
 *   2b6c  20 36        jr   nz,0x2ba4
 * loc_2b6e:
 *   2b6e  fe 71        cp   0x71
 *   2b70  38 61        jr   c,0x2bd3
 *   2b72  fe 9a        cp   0x9a
 *   2b74  30 5d        jr   nc,0x2bd3
 *   2b76  d6 71        sub  0x71
 *   2b78  06 00        ld   b,0x00
 *   2b7a  cb 27        sla  a
 *   2b7c  cb 27        sla  a
 *   2b7e  cb 27        sla  a
 *   2b80  cb 10        rl   b
 *   2b82  4f           ld   c,a
 *   2b83  7b           ld   a,e
 *   2b84  e6 07        and  0x07
 *   2b86  b1           or   c
 *   2b87  4f           ld   c,a
 *   2b88  21 c7 2d     ld   hl,0x2dc7
 *   2b8b  09           add  hl,bc
 *   2b8c  56           ld   d,(hl)
 *   2b8d  7a           ld   a,d
 *   2b8e  a7           and  a
 *   2b8f  20 0e        jr   nz,0x2b9f
 *   2b91  7b           ld   a,e
 *   2b92  e6 07        and  0x07
 *   2b94  fe 07        cp   0x07
 *   2b96  20 3b        jr   nz,0x2bd3
 *   2b98  3e 70        ld   a,0x70
 *   2b9a  dd 77 01     ld   (ix+0x01),a
 *   2b9d  18 34        jr   0x2bd3
 * loc_2b9f:
 *   2b9f  7b           ld   a,e
 *   2ba0  e6 07        and  0x07
 *   2ba2  28 08        jr   z,0x2bac
 * loc_2ba4:
 *   2ba4  7a           ld   a,d
 *   2ba5  dd 77 01     ld   (ix+0x01),a
 *   2ba8  3e c4        ld   a,0xc4
 *   2baa  18 02        jr   0x2bae
 * loc_2bac:
 *   2bac  3e c1        ld   a,0xc1
 * loc_2bae:
 *   2bae  dd 77 00     ld   (ix+0x00),a
 *   2bb1  cd 9b 4c     call 0x4c9b
 *   2bb4  3a bd 80     ld   a,(0x80bd)
 *   2bb7  3d           dec  a
 *   2bb8  32 bd 80     ld   (0x80bd),a
 *   2bbb  c2 34 29     jp   nz,0x2934
 *   2bbe  3e 00        ld   a,0x00
 *   2bc0  32 a9 80     ld   (0x80a9),a
 *   2bc3  3e 09        ld   a,0x09
 *   2bc5  32 aa 80     ld   (0x80aa),a
 *   2bc8  3a c0 80     ld   a,(0x80c0)
 *   2bcb  fe 02        cp   0x02
 *   2bcd  20 04        jr   nz,0x2bd3
 *   2bcf  dd 36 ff c1  ld   (ix-0x01),0xc1     ; then falls through into loc_2bd3
 */
export function loc_29ad(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // effective address for (ix+d)

  // loc_2bae: write the resolved sprite id A to (ix+0), re-carve via 0x4c9b, then
  // decrement the projectile counter 0x80bd; while it stays non-zero tail-jump to
  // 0x2934 (the second-entity commit inside loc_28ab); on reaching zero reset
  // 0x80a9/0x80aa and (if 0x80c0==2) mark (ix-1)=0xc1, then fall into loc_2bd3.
  function loc_2bae() {
    // 2bae  ld (ix+0x00),a
    mem.write8(R(0x00), regs.a);
    m.step(0x2bb1, 19);
    // 2bb1  call 0x4c9b
    m.push16(0x2bb4);
    m.step(0x4c9b, 17);
    m.call(0x4c9b);
    // 2bb4  ld a,(0x80bd)
    regs.a = mem.read8(0x80bd);
    m.step(0x2bb7, 13);
    // 2bb7  dec a
    regs.a = regs.dec8(regs.a);
    m.step(0x2bb8, 4);
    // 2bb8  ld (0x80bd),a
    mem.write8(0x80bd, regs.a);
    m.step(0x2bbb, 13);
    // 2bbb  jp nz,0x2934 -- more projectiles pending: back to loc_28ab's commit path
    if (regs.fNZ) { m.step(0x2934, 10); return m.call(0x2934); }
    m.step(0x2bbe, 10); // jp nz not taken
    // 2bbe  ld a,0x00
    regs.a = 0x00;
    m.step(0x2bc0, 7);
    // 2bc0  ld (0x80a9),a
    mem.write8(0x80a9, regs.a);
    m.step(0x2bc3, 13);
    // 2bc3  ld a,0x09
    regs.a = 0x09;
    m.step(0x2bc5, 7);
    // 2bc5  ld (0x80aa),a
    mem.write8(0x80aa, regs.a);
    m.step(0x2bc8, 13);
    // 2bc8  ld a,(0x80c0)
    regs.a = mem.read8(0x80c0);
    m.step(0x2bcb, 13);
    // 2bcb  cp 0x02
    regs.cp(0x02);
    m.step(0x2bcd, 7);
    // 2bcd  jr nz,0x2bd3
    if (regs.fNZ) { m.step(0x2bd3, 12); return m.call(0x2bd3); }
    m.step(0x2bcf, 7); // jr nz not taken
    // 2bcf  ld (ix-0x01),0xc1
    mem.write8(R(-0x01), 0xc1);
    m.step(0x2bd3, 19);
    // falls through into loc_2bd3 (a separate routine)
    return m.call(0x2bd3);
  }

  // loc_2bac: keep the tile (sprite id 0xc1), fall into loc_2bae.
  function loc_2bac() {
    // 2bac  ld a,0xc1
    regs.a = 0xc1;
    m.step(0x2bae, 7);
    return loc_2bae();
  }

  // loc_2ba4: write the translated tile D to (ix+1), sprite id 0xc4, jr to loc_2bae.
  function loc_2ba4() {
    // 2ba4  ld a,d
    regs.a = regs.d;
    m.step(0x2ba5, 4);
    // 2ba5  ld (ix+0x01),a
    mem.write8(R(0x01), regs.a);
    m.step(0x2ba8, 19);
    // 2ba8  ld a,0xc4
    regs.a = 0xc4;
    m.step(0x2baa, 7);
    // 2baa  jr 0x2bae
    m.step(0x2bae, 12);
    return loc_2bae();
  }

  // loc_2b9f: translation-table entry non-zero -- if the tile column (E&7)==0 keep
  // it (loc_2bac), else write the translated tile (loc_2ba4).
  function loc_2b9f() {
    // 2b9f  ld a,e
    regs.a = regs.e;
    m.step(0x2ba0, 4);
    // 2ba0  and 0x07
    regs.and(0x07);
    m.step(0x2ba2, 7);
    // 2ba2  jr z,0x2bac
    if (regs.fZ) { m.step(0x2bac, 12); return loc_2bac(); }
    m.step(0x2ba4, 7); // jr z not taken -> falls into loc_2ba4
    return loc_2ba4();
  }

  // loc_2b6e: classify the carved tile against the 0x71..0x99 dig-tile range; below
  // or at/above -> tail-jump loc_2bd3; else index the 0x2dc7 translation table by
  // ((tile-0x71)*8 | (E&7)) and dispatch on the entry.
  function loc_2b6e() {
    // 2b6e  cp 0x71
    regs.cp(0x71);
    m.step(0x2b70, 7);
    // 2b70  jr c,0x2bd3
    if (regs.fC) { m.step(0x2bd3, 12); return m.call(0x2bd3); }
    m.step(0x2b72, 7); // jr c not taken
    // 2b72  cp 0x9a
    regs.cp(0x9a);
    m.step(0x2b74, 7);
    // 2b74  jr nc,0x2bd3
    if (regs.fNC) { m.step(0x2bd3, 12); return m.call(0x2bd3); }
    m.step(0x2b76, 7); // jr nc not taken
    // 2b76  sub 0x71
    regs.sub(0x71);
    m.step(0x2b78, 7);
    // 2b78  ld b,0x00
    regs.b = 0x00;
    m.step(0x2b7a, 7);
    // 2b7a  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x2b7c, 8);
    // 2b7c  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x2b7e, 8);
    // 2b7e  sla a -- a = (tile-0x71)<<3, the high bit rotated into b next
    regs.a = regs.sla(regs.a);
    m.step(0x2b80, 8);
    // 2b80  rl b -- pull the shifted-out bit 8 into b (bc = (tile-0x71)*8)
    regs.b = regs.rl(regs.b);
    m.step(0x2b82, 8);
    // 2b82  ld c,a
    regs.c = regs.a;
    m.step(0x2b83, 4);
    // 2b83  ld a,e
    regs.a = regs.e;
    m.step(0x2b84, 4);
    // 2b84  and 0x07
    regs.and(0x07);
    m.step(0x2b86, 7);
    // 2b86  or c
    regs.or(regs.c);
    m.step(0x2b87, 4);
    // 2b87  ld c,a
    regs.c = regs.a;
    m.step(0x2b88, 4);
    // 2b88  ld hl,0x2dc7
    regs.hl = 0x2dc7;
    m.step(0x2b8b, 10);
    // 2b8b  add hl,bc
    regs.addHl(regs.bc);
    m.step(0x2b8c, 11);
    // 2b8c  ld d,(hl) -- the translated tile
    regs.d = mem.read8(regs.hl);
    m.step(0x2b8d, 7);
    // 2b8d  ld a,d
    regs.a = regs.d;
    m.step(0x2b8e, 4);
    // 2b8e  and a
    regs.and(regs.a);
    m.step(0x2b8f, 4);
    // 2b8f  jr nz,0x2b9f
    if (regs.fNZ) { m.step(0x2b9f, 12); return loc_2b9f(); }
    m.step(0x2b91, 7); // jr nz not taken
    // 2b91  ld a,e
    regs.a = regs.e;
    m.step(0x2b92, 4);
    // 2b92  and 0x07
    regs.and(0x07);
    m.step(0x2b94, 7);
    // 2b94  cp 0x07
    regs.cp(0x07);
    m.step(0x2b96, 7);
    // 2b96  jr nz,0x2bd3
    if (regs.fNZ) { m.step(0x2bd3, 12); return m.call(0x2bd3); }
    m.step(0x2b98, 7); // jr nz not taken
    // 2b98  ld a,0x70
    regs.a = 0x70;
    m.step(0x2b9a, 7);
    // 2b9a  ld (ix+0x01),a
    mem.write8(R(0x01), regs.a);
    m.step(0x2b9d, 19);
    // 2b9d  jr 0x2bd3
    m.step(0x2bd3, 12);
    return m.call(0x2bd3);
  }

  // loc_2b16: compute the carve target's VRAM cell address into 0x80af (and IX) from
  // the dig row (0x80a9) and column (0x80ac) -- a >>3 tile fold plus a 0x9000 base --
  // then read the tile at (ix+1) and classify it against 0x2a/0x2b/0xc1/0x95/0xc4.
  function loc_2b16() {
    // 2b16  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2b19, 13);
    // 2b19  add a,0x07
    regs.add(0x07);
    m.step(0x2b1b, 7);
    // 2b1b  srl a
    regs.a = regs.srl(regs.a);
    m.step(0x2b1d, 8);
    // 2b1d  srl a
    regs.a = regs.srl(regs.a);
    m.step(0x2b1f, 8);
    // 2b1f  srl a -- a = (row+7)>>3
    regs.a = regs.srl(regs.a);
    m.step(0x2b21, 8);
    // 2b21  neg
    regs.neg();
    m.step(0x2b23, 8);
    // 2b23  add a,0x1f -- a = 0x1f - (row+7)>>3 (invert row into tilemap Y)
    regs.add(0x1f);
    m.step(0x2b25, 7);
    // 2b25  ld h,a
    regs.h = regs.a;
    m.step(0x2b26, 4);
    // 2b26  ld a,(0x80ac)
    regs.a = mem.read8(0x80ac);
    m.step(0x2b29, 13);
    // 2b29  add a,0x01
    regs.add(0x01);
    m.step(0x2b2b, 7);
    // 2b2b  ld (0x80ac),a -- advance the dig column
    mem.write8(0x80ac, regs.a);
    m.step(0x2b2e, 13);
    // 2b2e  add a,0x09
    regs.add(0x09);
    m.step(0x2b30, 7);
    // 2b30  ld e,a
    regs.e = regs.a;
    m.step(0x2b31, 4);
    // 2b31  srl a
    regs.a = regs.srl(regs.a);
    m.step(0x2b33, 8);
    // 2b33  srl a
    regs.a = regs.srl(regs.a);
    m.step(0x2b35, 8);
    // 2b35  srl a -- c = (col+9)>>3 (tilemap X)
    regs.a = regs.srl(regs.a);
    m.step(0x2b37, 8);
    // 2b37  ld c,a
    regs.c = regs.a;
    m.step(0x2b38, 4);
    // 2b38  ld a,0x00
    regs.a = 0x00;
    m.step(0x2b3a, 7);
    // 2b3a  ld b,a -- bc = tilemap X
    regs.b = regs.a;
    m.step(0x2b3b, 4);
    // 2b3b  srl h
    regs.h = regs.srl(regs.h);
    m.step(0x2b3d, 8);
    // 2b3d  rra
    regs.rra();
    m.step(0x2b3e, 4);
    // 2b3e  srl h
    regs.h = regs.srl(regs.h);
    m.step(0x2b40, 8);
    // 2b40  rra
    regs.rra();
    m.step(0x2b41, 4);
    // 2b41  srl h
    regs.h = regs.srl(regs.h);
    m.step(0x2b43, 8);
    // 2b43  rra -- (h:a) >>= 3 : hl = Y*32 (five-bit Y shifted into the high byte)
    regs.rra();
    m.step(0x2b44, 4);
    // 2b44  ld l,a
    regs.l = regs.a;
    m.step(0x2b45, 4);
    // 2b45  add hl,bc -- hl = Y*32 + X
    regs.addHl(regs.bc);
    m.step(0x2b46, 11);
    // 2b46  ld bc,0x9000
    regs.bc = 0x9000;
    m.step(0x2b49, 10);
    // 2b49  add hl,bc -- hl = VRAM base + cell
    regs.addHl(regs.bc);
    m.step(0x2b4a, 11);
    // 2b4a  ld (0x80af),hl
    mem.write16(0x80af, regs.hl);
    m.step(0x2b4d, 16);
    // 2b4d  ld ix,(0x80af)
    regs.ix = mem.read16(0x80af);
    m.step(0x2b51, 20);
    // 2b51  ld d,0xc1
    regs.d = 0xc1;
    m.step(0x2b53, 7);
    // 2b53  ld a,(ix+0x01)
    regs.a = mem.read8(R(0x01));
    m.step(0x2b56, 19);
    // 2b56  cp 0x2a
    regs.cp(0x2a);
    m.step(0x2b58, 7);
    // 2b58  jr z,0x2bac
    if (regs.fZ) { m.step(0x2bac, 12); return loc_2bac(); }
    m.step(0x2b5a, 7); // jr z not taken
    // 2b5a  cp 0x2b
    regs.cp(0x2b);
    m.step(0x2b5c, 7);
    // 2b5c  jr z,0x2bac
    if (regs.fZ) { m.step(0x2bac, 12); return loc_2bac(); }
    m.step(0x2b5e, 7); // jr z not taken
    // 2b5e  cp 0xc1
    regs.cp(0xc1);
    m.step(0x2b60, 7);
    // 2b60  jr z,0x2bac
    if (regs.fZ) { m.step(0x2bac, 12); return loc_2bac(); }
    m.step(0x2b62, 7); // jr z not taken
    // 2b62  cp 0x95
    regs.cp(0x95);
    m.step(0x2b64, 7);
    // 2b64  jr z,0x2bac
    if (regs.fZ) { m.step(0x2bac, 12); return loc_2bac(); }
    m.step(0x2b66, 7); // jr z not taken
    // 2b66  cp 0xc4
    regs.cp(0xc4);
    m.step(0x2b68, 7);
    // 2b68  jr nz,0x2b6e
    if (regs.fNZ) { m.step(0x2b6e, 12); return loc_2b6e(); }
    m.step(0x2b6a, 7); // jr nz not taken
    // 2b6a  bit 2,e
    regs.bit(2, regs.e);
    m.step(0x2b6c, 8);
    // 2b6c  jr nz,0x2ba4
    if (regs.fNZ) { m.step(0x2ba4, 12); return loc_2ba4(); }
    m.step(0x2b6e, 7); // jr nz not taken -> falls into loc_2b6e
    return loc_2b6e();
  }

  // loc_2b11: raise the right-overlap flag 0x807f, fall into loc_2b16.
  function loc_2b11() {
    // 2b11  ld a,0x01
    regs.a = 0x01;
    m.step(0x2b13, 7);
    // 2b13  ld (0x807f),a
    mem.write8(0x807f, regs.a);
    m.step(0x2b16, 13);
    return loc_2b16();
  }

  // loc_2ae6: bounds-test the carve position against (0x806b)/(0x8068); may raise the
  // left-overlap flag 0x807e (loc_2b11 raises 0x807f), then continue at loc_2b16.
  function loc_2ae6() {
    // 2ae6  ld a,(0x806b)
    regs.a = mem.read8(0x806b);
    m.step(0x2ae9, 13);
    // 2ae9  ld b,a
    regs.b = regs.a;
    m.step(0x2aea, 4);
    // 2aea  ld a,(0x80ac)
    regs.a = mem.read8(0x80ac);
    m.step(0x2aed, 13);
    // 2aed  sub 0x05
    regs.sub(0x05);
    m.step(0x2aef, 7);
    // 2aef  cp b
    regs.cp(regs.b);
    m.step(0x2af0, 4);
    // 2af0  jr nc,0x2b16
    if (regs.fNC) { m.step(0x2b16, 12); return loc_2b16(); }
    m.step(0x2af2, 7); // jr nc not taken
    // 2af2  add a,0x11
    regs.add(0x11);
    m.step(0x2af4, 7);
    // 2af4  jr c,0x2b16
    if (regs.fC) { m.step(0x2b16, 12); return loc_2b16(); }
    m.step(0x2af6, 7); // jr c not taken
    // 2af6  ld a,(0x8068)
    regs.a = mem.read8(0x8068);
    m.step(0x2af9, 13);
    // 2af9  add a,0x03
    regs.add(0x03);
    m.step(0x2afb, 7);
    // 2afb  and 0xf8
    regs.and(0xf8);
    m.step(0x2afd, 7);
    // 2afd  ld c,a
    regs.c = regs.a;
    m.step(0x2afe, 4);
    // 2afe  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2b01, 13);
    // 2b01  dec a
    regs.a = regs.dec8(regs.a);
    m.step(0x2b02, 4);
    // 2b02  cp c
    regs.cp(regs.c);
    m.step(0x2b03, 4);
    // 2b03  jr z,0x2b11
    if (regs.fZ) { m.step(0x2b11, 12); return loc_2b11(); }
    m.step(0x2b05, 7); // jr z not taken
    // 2b05  add a,0x10
    regs.add(0x10);
    m.step(0x2b07, 7);
    // 2b07  cp c
    regs.cp(regs.c);
    m.step(0x2b08, 4);
    // 2b08  jr nz,0x2b16
    if (regs.fNZ) { m.step(0x2b16, 12); return loc_2b16(); }
    m.step(0x2b0a, 7); // jr nz not taken
    // 2b0a  ld a,0x01
    regs.a = 0x01;
    m.step(0x2b0c, 7);
    // 2b0c  ld (0x807e),a
    mem.write8(0x807e, regs.a);
    m.step(0x2b0f, 13);
    // 2b0f  jr 0x2b16
    m.step(0x2b16, 12);
    return loc_2b16();
  }

  // loc_2ab1: the 0x80c1==0 arm -- range-check the carve against the object bbox; when
  // in-band, retreat (0x8068) by 4, latch 0x80c1=1 and rejoin loc_2a87; else loc_2ae6.
  function loc_2ab1() {
    // 2ab1  ld a,(0x80c1)
    regs.a = mem.read8(0x80c1);
    m.step(0x2ab4, 13);
    // 2ab4  and a
    regs.and(regs.a);
    m.step(0x2ab5, 4);
    // 2ab5  jr nz,0x2ae6
    if (regs.fNZ) { m.step(0x2ae6, 12); return loc_2ae6(); }
    m.step(0x2ab7, 7); // jr nz not taken
    // 2ab7  ld a,(0x806b)
    regs.a = mem.read8(0x806b);
    m.step(0x2aba, 13);
    // 2aba  ld b,a
    regs.b = regs.a;
    m.step(0x2abb, 4);
    // 2abb  ld a,(0x80ac)
    regs.a = mem.read8(0x80ac);
    m.step(0x2abe, 13);
    // 2abe  add a,0x0a
    regs.add(0x0a);
    m.step(0x2ac0, 7);
    // 2ac0  cp b
    regs.cp(regs.b);
    m.step(0x2ac1, 4);
    // 2ac1  jr nc,0x2ae6
    if (regs.fNC) { m.step(0x2ae6, 12); return loc_2ae6(); }
    m.step(0x2ac3, 7); // jr nc not taken
    // 2ac3  add a,0x03
    regs.add(0x03);
    m.step(0x2ac5, 7);
    // 2ac5  cp b
    regs.cp(regs.b);
    m.step(0x2ac6, 4);
    // 2ac6  jr c,0x2ae6
    if (regs.fC) { m.step(0x2ae6, 12); return loc_2ae6(); }
    m.step(0x2ac8, 7); // jr c not taken
    // 2ac8  ld a,(0x8068)
    regs.a = mem.read8(0x8068);
    m.step(0x2acb, 13);
    // 2acb  ld c,a
    regs.c = regs.a;
    m.step(0x2acc, 4);
    // 2acc  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2acf, 13);
    // 2acf  sub 0x03
    regs.sub(0x03);
    m.step(0x2ad1, 7);
    // 2ad1  cp c
    regs.cp(regs.c);
    m.step(0x2ad2, 4);
    // 2ad2  jr nc,0x2ae6
    if (regs.fNC) { m.step(0x2ae6, 12); return loc_2ae6(); }
    m.step(0x2ad4, 7); // jr nc not taken
    // 2ad4  add a,0x0b
    regs.add(0x0b);
    m.step(0x2ad6, 7);
    // 2ad6  cp c
    regs.cp(regs.c);
    m.step(0x2ad7, 4);
    // 2ad7  jr c,0x2ae6
    if (regs.fC) { m.step(0x2ae6, 12); return loc_2ae6(); }
    m.step(0x2ad9, 7); // jr c not taken
    // 2ad9  sub 0x04
    regs.sub(0x04);
    m.step(0x2adb, 7);
    // 2adb  ld (0x8068),a
    mem.write8(0x8068, regs.a);
    m.step(0x2ade, 13);
    // 2ade  ld a,0x01
    regs.a = 0x01;
    m.step(0x2ae0, 7);
    // 2ae0  ld (0x80c1),a
    mem.write8(0x80c1, regs.a);
    m.step(0x2ae3, 13);
    // 2ae3  jp 0x2a87
    m.step(0x2a87, 10);
    return loc_2a87();
  }

  // loc_2aaa: store the overlap flag D into 0x8080, tail-jump loc_2bd3.
  function loc_2aaa() {
    // 2aaa  ld a,d
    regs.a = regs.d;
    m.step(0x2aab, 4);
    // 2aab  ld (0x8080),a
    mem.write8(0x8080, regs.a);
    m.step(0x2aae, 13);
    // 2aae  jp 0x2bd3
    m.step(0x2bd3, 10);
    return m.call(0x2bd3);
  }

  // loc_2a87: recompute the vertical-overlap flag D (1 when the carve row is within
  // one step of the object) from (0x8080)/(0x806b)/(0x80ac)/(0x8068)/(0x80a9), then
  // store it (loc_2aaa) and leave via loc_2bd3.
  function loc_2a87() {
    // 2a87  ld a,(0x8080)
    regs.a = mem.read8(0x8080);
    m.step(0x2a8a, 13);
    // 2a8a  ld d,a
    regs.d = regs.a;
    m.step(0x2a8b, 4);
    // 2a8b  ld a,(0x806b)
    regs.a = mem.read8(0x806b);
    m.step(0x2a8e, 13);
    // 2a8e  ld b,a
    regs.b = regs.a;
    m.step(0x2a8f, 4);
    // 2a8f  ld a,(0x80ac)
    regs.a = mem.read8(0x80ac);
    m.step(0x2a92, 13);
    // 2a92  add a,0x0c
    regs.add(0x0c);
    m.step(0x2a94, 7);
    // 2a94  cp b
    regs.cp(regs.b);
    m.step(0x2a95, 4);
    // 2a95  jr nz,0x2aaa
    if (regs.fNZ) { m.step(0x2aaa, 12); return loc_2aaa(); }
    m.step(0x2a97, 7); // jr nz not taken
    // 2a97  ld a,(0x8068)
    regs.a = mem.read8(0x8068);
    m.step(0x2a9a, 13);
    // 2a9a  ld c,a
    regs.c = regs.a;
    m.step(0x2a9b, 4);
    // 2a9b  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2a9e, 13);
    // 2a9e  and 0xfe
    regs.and(0xfe);
    m.step(0x2aa0, 7);
    // 2aa0  cp c
    regs.cp(regs.c);
    m.step(0x2aa1, 4);
    // 2aa1  jr nc,0x2aaa
    if (regs.fNC) { m.step(0x2aaa, 12); return loc_2aaa(); }
    m.step(0x2aa3, 7); // jr nc not taken
    // 2aa3  add a,0x08
    regs.add(0x08);
    m.step(0x2aa5, 7);
    // 2aa5  cp c
    regs.cp(regs.c);
    m.step(0x2aa6, 4);
    // 2aa6  jr c,0x2aaa
    if (regs.fC) { m.step(0x2aaa, 12); return loc_2aaa(); }
    m.step(0x2aa8, 7); // jr c not taken
    // 2aa8  ld d,0x01
    regs.d = 0x01;
    m.step(0x2aaa, 7); // -> falls into loc_2aaa
    return loc_2aaa();
  }

  // loc_2a6e: with the step code in B, if 0x80c1 set store it to 0x8069 and (when
  // 0x80c0==2) poke (ix-3)=0xc1; either way fall into loc_2a87.
  function loc_2a6e() {
    // 2a6e  ld a,(0x80c1)
    regs.a = mem.read8(0x80c1);
    m.step(0x2a71, 13);
    // 2a71  or a
    regs.or(regs.a);
    m.step(0x2a72, 4);
    // 2a72  jr z,0x2a87
    if (regs.fZ) { m.step(0x2a87, 12); return loc_2a87(); }
    m.step(0x2a74, 7); // jr z not taken
    // 2a74  ld a,b
    regs.a = regs.b;
    m.step(0x2a75, 4);
    // 2a75  ld (0x8069),a
    mem.write8(0x8069, regs.a);
    m.step(0x2a78, 13);
    // 2a78  ld a,(0x80c0)
    regs.a = mem.read8(0x80c0);
    m.step(0x2a7b, 13);
    // 2a7b  cp 0x02
    regs.cp(0x02);
    m.step(0x2a7d, 7);
    // 2a7d  jr nz,0x2a87
    if (regs.fNZ) { m.step(0x2a87, 12); return loc_2a87(); }
    m.step(0x2a7f, 7); // jr nz not taken
    // 2a7f  ld ix,(0x806e)
    regs.ix = mem.read16(0x806e);
    m.step(0x2a83, 20);
    // 2a83  ld (ix-0x03),0xc1
    mem.write8(R(-0x03), 0xc1);
    m.step(0x2a87, 19); // -> falls into loc_2a87
    return loc_2a87();
  }

  // loc_2a65: retreat the dig position (0x80a9), step code B=0x37, fall into loc_2a6e.
  function loc_2a65() {
    // 2a65  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2a68, 13);
    // 2a68  dec a
    regs.a = regs.dec8(regs.a);
    m.step(0x2a69, 4);
    // 2a69  ld (0x80a9),a
    mem.write8(0x80a9, regs.a);
    m.step(0x2a6c, 13);
    // 2a6c  ld b,0x37
    regs.b = 0x37;
    m.step(0x2a6e, 7); // -> falls into loc_2a6e
    return loc_2a6e();
  }

  // loc_2a52: pick the animation sub-phase from the low bits of the (decremented)
  // timer -- multiples of 8 retreat (loc_2a65), odd-of-4 just re-checks overlap
  // (loc_2a87), else advance the dig position (0x80a9), step code B=0xb7, loc_2a6e.
  function loc_2a52() {
    // 2a52  and 0x07
    regs.and(0x07);
    m.step(0x2a54, 7);
    // 2a54  jr z,0x2a65
    if (regs.fZ) { m.step(0x2a65, 12); return loc_2a65(); }
    m.step(0x2a56, 7); // jr z not taken
    // 2a56  and 0x03
    regs.and(0x03);
    m.step(0x2a58, 7);
    // 2a58  jr nz,0x2a87
    if (regs.fNZ) { m.step(0x2a87, 12); return loc_2a87(); }
    m.step(0x2a5a, 7); // jr nz not taken
    // 2a5a  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2a5d, 13);
    // 2a5d  inc a
    regs.a = regs.inc8(regs.a);
    m.step(0x2a5e, 4);
    // 2a5e  ld (0x80a9),a
    mem.write8(0x80a9, regs.a);
    m.step(0x2a61, 13);
    // 2a61  ld b,0xb7
    regs.b = 0xb7;
    m.step(0x2a63, 7);
    // 2a63  jr 0x2a6e
    m.step(0x2a6e, 12);
    return loc_2a6e();
  }

  // loc_2a03: run the 0x80b1 animation timer. Zero -> loc_2ab1 (idle). Else decrement
  // it; while it stays non-zero step the animation (loc_2a52). On reaching zero,
  // advance the dig position (0x80a9); if 0x80c1 is clear -> loc_2ab1, else advance
  // the column (0x80ac) by 8, re-init the projectile (0x4c77 + 0x1b5b), clear 0x80bd,
  // set 0x807c, and (0x80c0==2) patch (ix-2)/(ix-3); tail-jump loc_2bd3.
  function loc_2a03() {
    // 2a03  ld a,(0x80b1)
    regs.a = mem.read8(0x80b1);
    m.step(0x2a06, 13);
    // 2a06  and a
    regs.and(regs.a);
    m.step(0x2a07, 4);
    // 2a07  jp z,0x2ab1
    if (regs.fZ) { m.step(0x2ab1, 10); return loc_2ab1(); }
    m.step(0x2a0a, 10); // jp z not taken
    // 2a0a  dec a
    regs.a = regs.dec8(regs.a);
    m.step(0x2a0b, 4);
    // 2a0b  ld (0x80b1),a
    mem.write8(0x80b1, regs.a);
    m.step(0x2a0e, 13);
    // 2a0e  jr nz,0x2a52
    if (regs.fNZ) { m.step(0x2a52, 12); return loc_2a52(); }
    m.step(0x2a10, 7); // jr nz not taken
    // 2a10  ld a,(0x80a9)
    regs.a = mem.read8(0x80a9);
    m.step(0x2a13, 13);
    // 2a13  dec a
    regs.a = regs.dec8(regs.a);
    m.step(0x2a14, 4);
    // 2a14  ld (0x80a9),a
    mem.write8(0x80a9, regs.a);
    m.step(0x2a17, 13);
    // 2a17  ld a,(0x80c1)
    regs.a = mem.read8(0x80c1);
    m.step(0x2a1a, 13);
    // 2a1a  and a
    regs.and(regs.a);
    m.step(0x2a1b, 4);
    // 2a1b  jp z,0x2ab1
    if (regs.fZ) { m.step(0x2ab1, 10); return loc_2ab1(); }
    m.step(0x2a1e, 10); // jp z not taken
    // 2a1e  ld a,(0x80ac)
    regs.a = mem.read8(0x80ac);
    m.step(0x2a21, 13);
    // 2a21  add a,0x08
    regs.add(0x08);
    m.step(0x2a23, 7);
    // 2a23  ld (0x80ac),a
    mem.write8(0x80ac, regs.a);
    m.step(0x2a26, 13);
    // 2a26  call 0x4c77
    m.push16(0x2a29);
    m.step(0x4c77, 17);
    m.call(0x4c77);
    // 2a29  ld a,0x09
    regs.a = 0x09;
    m.step(0x2a2b, 7);
    // 2a2b  ld (0x8069),a
    mem.write8(0x8069, regs.a);
    m.step(0x2a2e, 13);
    // 2a2e  call 0x1b5b
    m.push16(0x2a31);
    m.step(0x1b5b, 17);
    m.call(0x1b5b);
    // 2a31  ld a,0x00
    regs.a = 0x00;
    m.step(0x2a33, 7);
    // 2a33  ld (0x80bd),a
    mem.write8(0x80bd, regs.a);
    m.step(0x2a36, 13);
    // 2a36  ld a,0xb4
    regs.a = 0xb4;
    m.step(0x2a38, 7);
    // 2a38  ld (0x807c),a
    mem.write8(0x807c, regs.a);
    m.step(0x2a3b, 13);
    // 2a3b  ld a,(0x80c0)
    regs.a = mem.read8(0x80c0);
    m.step(0x2a3e, 13);
    // 2a3e  cp 0x02
    regs.cp(0x02);
    m.step(0x2a40, 7);
    // 2a40  jp nz,0x2bd3
    if (regs.fNZ) { m.step(0x2bd3, 10); return m.call(0x2bd3); }
    m.step(0x2a43, 10); // jp nz not taken
    // 2a43  ld ix,(0x806e)
    regs.ix = mem.read16(0x806e);
    m.step(0x2a47, 20);
    // 2a47  ld (ix-0x02),0xc1
    mem.write8(R(-0x02), 0xc1);
    m.step(0x2a4b, 19);
    // 2a4b  ld (ix-0x03),0x70
    mem.write8(R(-0x03), 0x70);
    m.step(0x2a4f, 19);
    // 2a4f  jp 0x2bd3
    m.step(0x2bd3, 10);
    return m.call(0x2bd3);
  }

  // loc_29ff: store the overlap flag D into 0x8080, fall into loc_2a03.
  function loc_29ff() {
    // 29ff  ld a,d
    regs.a = regs.d;
    m.step(0x2a00, 4);
    // 2a00  ld (0x8080),a
    mem.write8(0x8080, regs.a);
    m.step(0x2a03, 13); // -> falls into loc_2a03
    return loc_2a03();
  }

  // loc_29d3: dispatch on the projectile counter 0x80bd -- 0 -> loc_2f71; !=2 ->
  // loc_2a03 (run the timer); ==2 -> compute a vertical-overlap flag D from
  // (0x806b)/(0x80b9)/(0x8068)/(0x80b6) then fall into loc_29ff.
  function loc_29d3() {
    // 29d3  ld a,(0x80bd)
    regs.a = mem.read8(0x80bd);
    m.step(0x29d6, 13);
    // 29d6  or a
    regs.or(regs.a);
    m.step(0x29d7, 4);
    // 29d7  jp z,0x2f71
    if (regs.fZ) { m.step(0x2f71, 10); return m.call(0x2f71); }
    m.step(0x29da, 10); // jp z not taken
    // 29da  cp 0x02
    regs.cp(0x02);
    m.step(0x29dc, 7);
    // 29dc  jr nz,0x2a03
    if (regs.fNZ) { m.step(0x2a03, 12); return loc_2a03(); }
    m.step(0x29de, 7); // jr nz not taken
    // 29de  ld d,0x00
    regs.d = 0x00;
    m.step(0x29e0, 7);
    // 29e0  ld a,(0x806b)
    regs.a = mem.read8(0x806b);
    m.step(0x29e3, 13);
    // 29e3  ld b,a
    regs.b = regs.a;
    m.step(0x29e4, 4);
    // 29e4  ld a,(0x80b9)
    regs.a = mem.read8(0x80b9);
    m.step(0x29e7, 13);
    // 29e7  add a,0x0c
    regs.add(0x0c);
    m.step(0x29e9, 7);
    // 29e9  cp b
    regs.cp(regs.b);
    m.step(0x29ea, 4);
    // 29ea  jr nz,0x29ff
    if (regs.fNZ) { m.step(0x29ff, 12); return loc_29ff(); }
    m.step(0x29ec, 7); // jr nz not taken
    // 29ec  ld a,(0x8068)
    regs.a = mem.read8(0x8068);
    m.step(0x29ef, 13);
    // 29ef  ld c,a
    regs.c = regs.a;
    m.step(0x29f0, 4);
    // 29f0  ld a,(0x80b6)
    regs.a = mem.read8(0x80b6);
    m.step(0x29f3, 13);
    // 29f3  and 0xfe
    regs.and(0xfe);
    m.step(0x29f5, 7);
    // 29f5  cp c
    regs.cp(regs.c);
    m.step(0x29f6, 4);
    // 29f6  jr nc,0x29ff
    if (regs.fNC) { m.step(0x29ff, 12); return loc_29ff(); }
    m.step(0x29f8, 7); // jr nc not taken
    // 29f8  add a,0x08
    regs.add(0x08);
    m.step(0x29fa, 7);
    // 29fa  cp c
    regs.cp(regs.c);
    m.step(0x29fb, 4);
    // 29fb  jr c,0x29ff
    if (regs.fC) { m.step(0x29ff, 12); return loc_29ff(); }
    m.step(0x29fd, 7); // jr c not taken
    // 29fd  ld d,0x01
    regs.d = 0x01;
    m.step(0x29ff, 7); // -> falls into loc_29ff
    return loc_29ff();
  }

  // ===== entry (loc_29ad) =====
  // 29ad  ld a,0x00
  regs.a = 0x00;
  m.step(0x29af, 7);
  // 29af  ld (0x8080),a -- clear the vertical-overlap flag
  mem.write8(0x8080, regs.a);
  m.step(0x29b2, 13);
  // 29b2  ld (0x807f),a -- clear the right-overlap flag
  mem.write8(0x807f, regs.a);
  m.step(0x29b5, 13);
  // 29b5  ld (0x807e),a -- clear the left-overlap flag
  mem.write8(0x807e, regs.a);
  m.step(0x29b8, 13);
  // 29b8  ld a,(0x8078)
  regs.a = mem.read8(0x8078);
  m.step(0x29bb, 13);
  // 29bb  or a
  regs.or(regs.a);
  m.step(0x29bc, 4);
  // 29bc  jr z,0x29d3 -- (0x8078) idle: skip the spawn gate
  if (regs.fZ) { m.step(0x29d3, 12); return loc_29d3(); }
  m.step(0x29be, 7); // jr z not taken
  // 29be  ld a,(0x8076)
  regs.a = mem.read8(0x8076);
  m.step(0x29c1, 13);
  // 29c1  or a
  regs.or(regs.a);
  m.step(0x29c2, 4);
  // 29c2  jr z,0x29d3 -- (0x8076) idle: skip the spawn gate
  if (regs.fZ) { m.step(0x29d3, 12); return loc_29d3(); }
  m.step(0x29c4, 7); // jr z not taken
  // 29c4  ld a,(0x80bd)
  regs.a = mem.read8(0x80bd);
  m.step(0x29c7, 13);
  // 29c7  or a
  regs.or(regs.a);
  m.step(0x29c8, 4);
  // 29c8  jp z,0x2bf2 -- no projectile active: go spawn one
  if (regs.fZ) { m.step(0x2bf2, 10); return m.call(0x2bf2); }
  m.step(0x29cb, 10); // jp z not taken
  // 29cb  ld a,(0x80aa)
  regs.a = mem.read8(0x80aa);
  m.step(0x29ce, 13);
  // 29ce  cp 0x30
  regs.cp(0x30);
  m.step(0x29d0, 7);
  // 29d0  jp nz,0x2cb7 -- projectile not in the carve phase: handle elsewhere
  if (regs.fNZ) { m.step(0x2cb7, 10); return m.call(0x2cb7); }
  m.step(0x29d3, 10); // jp nz not taken -> falls into loc_29d3
  return loc_29d3();
}
