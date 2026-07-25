// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_319d  (ROM 0x319D–0x33B9) — per-object move/collision driver.
 *
 * Fast-exits when the object's target column already matches (0x807A==0x8093),
 * then runs a small state machine on 0x8090 (negative -> 0x34DA, positive ->
 * respawn window, zero -> countdown 0x808B). If the object overlaps the player
 * box (0x8094/0x8097) or the second box (0x8068/0x806B) it retargets/kills.
 * Otherwise it derives the VRAM tile pointer (0x8089) and the sub-tile phase
 * (0x808D) from the pixel position (0x8083/0x8086) and, keyed by direction
 * (0x8092) and column (0x8093), probes the neighbouring tiles via the cpir
 * tables in sub_33BC/33DA/3410/3425, tail-jumping to a movement handler
 * (0x3476/347D/3484/348B) or a state routine (0x3458/0x34DA).
 *
 * All internal jumps are forward or leave the routine; every labelled region
 * except the entry ends in a return, so each `loc_*` is modelled as a nested
 * helper reached by `return loc_xxxx()` (a jp: control transfer, no stack
 * effect), and a tail-jump into another routine as `return m.call(target)`
 * (the target's own ret pops THIS routine's return address, per doc 03).
 *
 *   319d  3a 93 80     ld   a,(0x8093)
 *   31a0  47           ld   b,a
 *   31a1  3a 7a 80     ld   a,(0x807a)
 *   31a4  b8           cp   b
 *   31a5  ca 58 34     jp   z,0x3458
 *   31a8  3a 90 80     ld   a,(0x8090)
 *   31ab  b7           or   a
 *   31ac  fa da 34     jp   m,0x34da
 *   31af  20 1f        jr   nz,0x31d0
 *   31b1  3a 8b 80     ld   a,(0x808b)
 *   31b4  3d           dec  a
 *   31b5  32 8b 80     ld   (0x808b),a
 *   31b8  c0           ret  nz
 *   31b9  3e 01        ld   a,0x01
 *   31bb  32 90 80     ld   (0x8090),a
 *   31be  32 8b 80     ld   (0x808b),a
 *   31c1  3e e4        ld   a,0xe4
 *   31c3  32 83 80     ld   (0x8083),a
 *   31c6  3e 23        ld   a,0x23
 *   31c8  32 86 80     ld   (0x8086),a
 *   31cb  3e ec        ld   a,0xec
 *   31cd  32 e8 80     ld   (0x80e8),a
 * loc_31d0:
 *   31d0  3a a1 80     ld   a,(0x80a1)
 *   31d3  b7           or   a
 *   31d4  28 2d        jr   z,0x3203
 *   31d6  3a 83 80     ld   a,(0x8083)
 *   31d9  67           ld   h,a
 *   31da  3a 94 80     ld   a,(0x8094)
 *   31dd  c6 04        add  a,0x04
 *   31df  bc           cp   h
 *   31e0  38 21        jr   c,0x3203
 *   31e2  d6 0c        sub  0x0c
 *   31e4  bc           cp   h
 *   31e5  30 1c        jr   nc,0x3203
 *   31e7  3a 86 80     ld   a,(0x8086)
 *   31ea  6f           ld   l,a
 *   31eb  3a 97 80     ld   a,(0x8097)
 *   31ee  c6 03        add  a,0x03
 *   31f0  bd           cp   l
 *   31f1  38 10        jr   c,0x3203
 *   31f3  d6 07        sub  0x07
 *   31f5  bd           cp   l
 *   31f6  30 0b        jr   nc,0x3203
 *   31f8  cd 73 46     call 0x4673
 *   31fb  3e c0        ld   a,0xc0
 *   31fd  32 90 80     ld   (0x8090),a
 *   3200  c3 da 34     jp   0x34da
 * loc_3203:
 *   3203  3a 7a 80     ld   a,(0x807a)
 *   3206  b7           or   a
 *   3207  20 4f        jr   nz,0x3258
 *   3209  3a c1 80     ld   a,(0x80c1)
 *   320c  b7           or   a
 *   320d  20 49        jr   nz,0x3258
 *   320f  3a 83 80     ld   a,(0x8083)
 *   3212  67           ld   h,a
 *   3213  3a 68 80     ld   a,(0x8068)
 *   3216  c6 08        add  a,0x08
 *   3218  bc           cp   h
 *   3219  38 3d        jr   c,0x3258
 *   321b  d6 12        sub  0x12
 *   321d  bc           cp   h
 *   321e  30 38        jr   nc,0x3258
 *   3220  3a 86 80     ld   a,(0x8086)
 *   3223  6f           ld   l,a
 *   3224  3a 6b 80     ld   a,(0x806b)
 *   3227  c6 07        add  a,0x07
 *   3229  bd           cp   l
 *   322a  38 2c        jr   c,0x3258
 *   322c  d6 0f        sub  0x0f
 *   322e  bd           cp   l
 *   322f  30 27        jr   nc,0x3258
 *   3231  3a 93 80     ld   a,(0x8093)
 *   3234  32 7a 80     ld   (0x807a),a
 *   3237  3a 68 80     ld   a,(0x8068)
 *   323a  32 83 80     ld   (0x8083),a
 *   323d  3a 6b 80     ld   a,(0x806b)
 *   3240  32 86 80     ld   (0x8086),a
 *   3243  3e 81        ld   a,0x81
 *   3245  32 8b 80     ld   (0x808b),a
 *   3248  3e 17        ld   a,0x17
 *   324a  32 84 80     ld   (0x8084),a
 *   324d  3e 35        ld   a,0x35
 *   324f  32 69 80     ld   (0x8069),a
 *   3252  cd 9f 4c     call 0x4c9f
 *   3255  c3 58 34     jp   0x3458
 * loc_3258:
 *   3258  3a 86 80     ld   a,(0x8086)
 *   325b  fe 23        cp   0x23
 *   325d  20 18        jr   nz,0x3277
 *   325f  3a 93 80     ld   a,(0x8093)
 *   3262  fe 04        cp   0x04
 *   3264  3a 83 80     ld   a,(0x8083)
 *   3267  20 06        jr   nz,0x326f
 *   3269  fe e5        cp   0xe5
 *   326b  c2 8b 34     jp   nz,0x348b
 *   326e  c9           ret
 * loc_326f:
 *   326f  fe dd        cp   0xdd
 *   3271  d2 8b 34     jp   nc,0x348b
 *   3274  c3 84 34     jp   0x3484
 * loc_3277:
 *   3277  3a 83 80     ld   a,(0x8083)
 *   327a  fe dc        cp   0xdc
 *   327c  20 0b        jr   nz,0x3289
 *   327e  3a 86 80     ld   a,(0x8086)
 *   3281  fe 33        cp   0x33
 *   3283  da 84 34     jp   c,0x3484
 *   3286  c3 8b 34     jp   0x348b
 * loc_3289:
 *   3289  3a 83 80     ld   a,(0x8083)
 *   328c  c6 04        add  a,0x04
 *   328e  cb 3f        srl  a
 *   3290  cb 3f        srl  a
 *   3292  cb 3f        srl  a
 *   3294  ed 44        neg
 *   3296  c6 1f        add  a,0x1f
 *   3298  67           ld   h,a
 *   3299  3a 86 80     ld   a,(0x8086)
 *   329c  c6 05        add  a,0x05
 *   329e  06 00        ld   b,0x00
 *   32a0  cb 3f        srl  a
 *   32a2  cb 18        rr   b
 *   32a4  cb 3f        srl  a
 *   32a6  cb 18        rr   b
 *   32a8  cb 3f        srl  a
 *   32aa  cb 18        rr   b
 *   32ac  4f           ld   c,a
 *   32ad  78           ld   a,b
 *   32ae  32 8d 80     ld   (0x808d),a
 *   32b1  3e 00        ld   a,0x00
 *   32b3  47           ld   b,a
 *   32b4  cb 3c        srl  h
 *   32b6  1f           rra
 *   32b7  cb 3c        srl  h
 *   32b9  1f           rra
 *   32ba  cb 3c        srl  h
 *   32bc  1f           rra
 *   32bd  6f           ld   l,a
 *   32be  09           add  hl,bc
 *   32bf  01 00 90     ld   bc,0x9000
 *   32c2  09           add  hl,bc
 *   32c3  22 89 80     ld   (0x8089),hl
 *   32c6  3a 93 80     ld   a,(0x8093)
 *   32c9  fe 05        cp   0x05
 *   32cb  ca 45 33     jp   z,0x3345
 *   32ce  3a 92 80     ld   a,(0x8092)
 *   32d1  3d           dec  a
 *   32d2  ca f2 32     jp   z,0x32f2
 *   32d5  3d           dec  a
 *   32d6  ca 11 33     jp   z,0x3311
 *   32d9  3d           dec  a
 *   32da  ca 26 33     jp   z,0x3326
 *   32dd  cd da 33     call 0x33da
 *   32e0  ca 7d 34     jp   z,0x347d
 *   32e3  cd bc 33     call 0x33bc
 *   32e6  ca 76 34     jp   z,0x3476
 *   32e9  cd 25 34     call 0x3425
 *   32ec  ca 8b 34     jp   z,0x348b
 *   32ef  c3 84 34     jp   0x3484
 * loc_32f2:
 *   32f2  3a 83 80     ld   a,(0x8083)
 *   32f5  c6 04        add  a,0x04
 *   32f7  e6 07        and  0x07
 *   32f9  c2 7d 34     jp   nz,0x347d
 *   32fc  cd 10 34     call 0x3410
 *   32ff  ca 84 34     jp   z,0x3484
 *   3302  cd da 33     call 0x33da
 *   3305  ca 7d 34     jp   z,0x347d
 *   3308  cd bc 33     call 0x33bc
 *   330b  ca 76 34     jp   z,0x3476
 *   330e  c3 8b 34     jp   0x348b
 * loc_3311:
 *   3311  cd 25 34     call 0x3425
 *   3314  ca 8b 34     jp   z,0x348b
 *   3317  cd 10 34     call 0x3410
 *   331a  ca 84 34     jp   z,0x3484
 *   331d  cd da 33     call 0x33da
 *   3320  ca 7d 34     jp   z,0x347d
 *   3323  c3 76 34     jp   0x3476
 * loc_3326:
 *   3326  3a 83 80     ld   a,(0x8083)
 *   3329  c6 04        add  a,0x04
 *   332b  e6 07        and  0x07
 *   332d  c2 8b 34     jp   nz,0x348b
 *   3330  cd bc 33     call 0x33bc
 *   3333  ca 76 34     jp   z,0x3476
 *   3336  cd 25 34     call 0x3425
 *   3339  ca 8b 34     jp   z,0x348b
 *   333c  cd 10 34     call 0x3410
 *   333f  ca 84 34     jp   z,0x3484
 *   3342  c3 7d 34     jp   0x347d
 * loc_3345:
 *   3345  3a 92 80     ld   a,(0x8092)
 *   3348  3d           dec  a
 *   3349  ca 69 33     jp   z,0x3369
 *   334c  3d           dec  a
 *   334d  ca 88 33     jp   z,0x3388
 *   3350  3d           dec  a
 *   3351  ca 9d 33     jp   z,0x339d
 *   3354  cd 25 34     call 0x3425
 *   3357  ca 8b 34     jp   z,0x348b
 *   335a  cd bc 33     call 0x33bc
 *   335d  ca 76 34     jp   z,0x3476
 *   3360  cd da 33     call 0x33da
 *   3363  ca 7d 34     jp   z,0x347d
 *   3366  c3 84 34     jp   0x3484
 * loc_3369:
 *   3369  3a 83 80     ld   a,(0x8083)
 *   336c  c6 04        add  a,0x04
 *   336e  e6 07        and  0x07
 *   3370  c2 7d 34     jp   nz,0x347d
 *   3373  cd bc 33     call 0x33bc
 *   3376  ca 76 34     jp   z,0x3476
 *   3379  cd da 33     call 0x33da
 *   337c  ca 7d 34     jp   z,0x347d
 *   337f  cd 10 34     call 0x3410
 *   3382  ca 84 34     jp   z,0x3484
 *   3385  c3 8b 34     jp   0x348b
 * loc_3388:
 *   3388  cd da 33     call 0x33da
 *   338b  ca 7d 34     jp   z,0x347d
 *   338e  cd 10 34     call 0x3410
 *   3391  ca 84 34     jp   z,0x3484
 *   3394  cd 25 34     call 0x3425
 *   3397  ca 8b 34     jp   z,0x348b
 *   339a  c3 76 34     jp   0x3476
 * loc_339d:
 *   339d  3a 83 80     ld   a,(0x8083)
 *   33a0  c6 04        add  a,0x04
 *   33a2  e6 07        and  0x07
 *   33a4  c2 8b 34     jp   nz,0x348b
 *   33a7  cd 10 34     call 0x3410
 *   33aa  ca 84 34     jp   z,0x3484
 *   33ad  cd 25 34     call 0x3425
 *   33b0  ca 8b 34     jp   z,0x348b
 *   33b3  cd bc 33     call 0x33bc
 *   33b6  ca 76 34     jp   z,0x3476
 *   33b9  c3 7d 34     jp   0x347d
 */
export function sub_319d(m) {
  const { regs, mem } = m;

  // loc_3345: 0x8092 direction fan-out for column-0x05 objects.
  function loc_3345() {
    regs.a = mem.read8(0x8092);
    m.step(0x3348, 13); // ld a,(0x8092)
    regs.a = regs.dec8(regs.a);
    m.step(0x3349, 4); // dec a
    if (regs.fZ) { m.step(0x3369, 10); return loc_3369(); } // jp z,0x3369
    m.step(0x334c, 10);
    regs.a = regs.dec8(regs.a);
    m.step(0x334d, 4); // dec a
    if (regs.fZ) { m.step(0x3388, 10); return loc_3388(); } // jp z,0x3388
    m.step(0x3350, 10);
    regs.a = regs.dec8(regs.a);
    m.step(0x3351, 4); // dec a
    if (regs.fZ) { m.step(0x339d, 10); return loc_339d(); } // jp z,0x339d
    m.step(0x3354, 10);
    m.push16(0x3357);
    m.step(0x3425, 17);
    m.call(0x3425); // call 0x3425
    if (regs.fZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp z,0x348b
    m.step(0x335a, 10);
    m.push16(0x335d);
    m.step(0x33bc, 17);
    m.call(0x33bc); // call 0x33bc
    if (regs.fZ) { m.step(0x3476, 10); return m.call(0x3476); } // jp z,0x3476
    m.step(0x3360, 10);
    m.push16(0x3363);
    m.step(0x33da, 17);
    m.call(0x33da); // call 0x33da
    if (regs.fZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp z,0x347d
    m.step(0x3366, 10);
    m.step(0x3484, 10); // jp 0x3484
    return m.call(0x3484);
  }

  // loc_3369 / 3388 / 339d: the three per-direction tile-probe orderings.
  function loc_3369() {
    regs.a = mem.read8(0x8083);
    m.step(0x336c, 13); // ld a,(0x8083)
    regs.add(0x04);
    m.step(0x336e, 7); // add a,0x04
    regs.and(0x07);
    m.step(0x3370, 7); // and 0x07
    if (regs.fNZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp nz,0x347d
    m.step(0x3373, 10);
    m.push16(0x3376);
    m.step(0x33bc, 17);
    m.call(0x33bc); // call 0x33bc
    if (regs.fZ) { m.step(0x3476, 10); return m.call(0x3476); } // jp z,0x3476
    m.step(0x3379, 10);
    m.push16(0x337c);
    m.step(0x33da, 17);
    m.call(0x33da); // call 0x33da
    if (regs.fZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp z,0x347d
    m.step(0x337f, 10);
    m.push16(0x3382);
    m.step(0x3410, 17);
    m.call(0x3410); // call 0x3410
    if (regs.fZ) { m.step(0x3484, 10); return m.call(0x3484); } // jp z,0x3484
    m.step(0x3385, 10);
    m.step(0x348b, 10); // jp 0x348b
    return m.call(0x348b);
  }

  function loc_3388() {
    m.push16(0x338b);
    m.step(0x33da, 17);
    m.call(0x33da); // call 0x33da
    if (regs.fZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp z,0x347d
    m.step(0x338e, 10);
    m.push16(0x3391);
    m.step(0x3410, 17);
    m.call(0x3410); // call 0x3410
    if (regs.fZ) { m.step(0x3484, 10); return m.call(0x3484); } // jp z,0x3484
    m.step(0x3394, 10);
    m.push16(0x3397);
    m.step(0x3425, 17);
    m.call(0x3425); // call 0x3425
    if (regs.fZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp z,0x348b
    m.step(0x339a, 10);
    m.step(0x3476, 10); // jp 0x3476
    return m.call(0x3476);
  }

  function loc_339d() {
    regs.a = mem.read8(0x8083);
    m.step(0x33a0, 13); // ld a,(0x8083)
    regs.add(0x04);
    m.step(0x33a2, 7); // add a,0x04
    regs.and(0x07);
    m.step(0x33a4, 7); // and 0x07
    if (regs.fNZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp nz,0x348b
    m.step(0x33a7, 10);
    m.push16(0x33aa);
    m.step(0x3410, 17);
    m.call(0x3410); // call 0x3410
    if (regs.fZ) { m.step(0x3484, 10); return m.call(0x3484); } // jp z,0x3484
    m.step(0x33ad, 10);
    m.push16(0x33b0);
    m.step(0x3425, 17);
    m.call(0x3425); // call 0x3425
    if (regs.fZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp z,0x348b
    m.step(0x33b3, 10);
    m.push16(0x33b6);
    m.step(0x33bc, 17);
    m.call(0x33bc); // call 0x33bc
    if (regs.fZ) { m.step(0x3476, 10); return m.call(0x3476); } // jp z,0x3476
    m.step(0x33b9, 10);
    m.step(0x347d, 10); // jp 0x347d
    return m.call(0x347d);
  }

  // loc_3326 / 3311 / 32f2: direction fan-out for columns other than 0x05.
  function loc_3326() {
    regs.a = mem.read8(0x8083);
    m.step(0x3329, 13); // ld a,(0x8083)
    regs.add(0x04);
    m.step(0x332b, 7); // add a,0x04
    regs.and(0x07);
    m.step(0x332d, 7); // and 0x07
    if (regs.fNZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp nz,0x348b
    m.step(0x3330, 10);
    m.push16(0x3333);
    m.step(0x33bc, 17);
    m.call(0x33bc); // call 0x33bc
    if (regs.fZ) { m.step(0x3476, 10); return m.call(0x3476); } // jp z,0x3476
    m.step(0x3336, 10);
    m.push16(0x3339);
    m.step(0x3425, 17);
    m.call(0x3425); // call 0x3425
    if (regs.fZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp z,0x348b
    m.step(0x333c, 10);
    m.push16(0x333f);
    m.step(0x3410, 17);
    m.call(0x3410); // call 0x3410
    if (regs.fZ) { m.step(0x3484, 10); return m.call(0x3484); } // jp z,0x3484
    m.step(0x3342, 10);
    m.step(0x347d, 10); // jp 0x347d
    return m.call(0x347d);
  }

  function loc_3311() {
    m.push16(0x3314);
    m.step(0x3425, 17);
    m.call(0x3425); // call 0x3425
    if (regs.fZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp z,0x348b
    m.step(0x3317, 10);
    m.push16(0x331a);
    m.step(0x3410, 17);
    m.call(0x3410); // call 0x3410
    if (regs.fZ) { m.step(0x3484, 10); return m.call(0x3484); } // jp z,0x3484
    m.step(0x331d, 10);
    m.push16(0x3320);
    m.step(0x33da, 17);
    m.call(0x33da); // call 0x33da
    if (regs.fZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp z,0x347d
    m.step(0x3323, 10);
    m.step(0x3476, 10); // jp 0x3476
    return m.call(0x3476);
  }

  function loc_32f2() {
    regs.a = mem.read8(0x8083);
    m.step(0x32f5, 13); // ld a,(0x8083)
    regs.add(0x04);
    m.step(0x32f7, 7); // add a,0x04
    regs.and(0x07);
    m.step(0x32f9, 7); // and 0x07
    if (regs.fNZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp nz,0x347d
    m.step(0x32fc, 10);
    m.push16(0x32ff);
    m.step(0x3410, 17);
    m.call(0x3410); // call 0x3410
    if (regs.fZ) { m.step(0x3484, 10); return m.call(0x3484); } // jp z,0x3484
    m.step(0x3302, 10);
    m.push16(0x3305);
    m.step(0x33da, 17);
    m.call(0x33da); // call 0x33da
    if (regs.fZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp z,0x347d
    m.step(0x3308, 10);
    m.push16(0x330b);
    m.step(0x33bc, 17);
    m.call(0x33bc); // call 0x33bc
    if (regs.fZ) { m.step(0x3476, 10); return m.call(0x3476); } // jp z,0x3476
    m.step(0x330e, 10);
    m.step(0x348b, 10); // jp 0x348b
    return m.call(0x348b);
  }

  // loc_3289: derive VRAM pointer (0x8089) + sub-tile phase (0x808D) from the
  // pixel position, then dispatch on column (0x8093) and direction (0x8092).
  function loc_3289() {
    regs.a = mem.read8(0x8083);
    m.step(0x328c, 13); // ld a,(0x8083)
    regs.add(0x04);
    m.step(0x328e, 7); // add a,0x04
    regs.a = regs.srl(regs.a);
    m.step(0x3290, 8); // srl a
    regs.a = regs.srl(regs.a);
    m.step(0x3292, 8); // srl a
    regs.a = regs.srl(regs.a);
    m.step(0x3294, 8); // srl a
    regs.neg();
    m.step(0x3296, 8); // neg
    regs.add(0x1f);
    m.step(0x3298, 7); // add a,0x1f
    regs.h = regs.a;
    m.step(0x3299, 4); // ld h,a
    regs.a = mem.read8(0x8086);
    m.step(0x329c, 13); // ld a,(0x8086)
    regs.add(0x05);
    m.step(0x329e, 7); // add a,0x05
    regs.b = 0x00;
    m.step(0x32a0, 7); // ld b,0x00
    regs.a = regs.srl(regs.a);
    m.step(0x32a2, 8); // srl a
    regs.b = regs.rr(regs.b);
    m.step(0x32a4, 8); // rr b
    regs.a = regs.srl(regs.a);
    m.step(0x32a6, 8); // srl a
    regs.b = regs.rr(regs.b);
    m.step(0x32a8, 8); // rr b
    regs.a = regs.srl(regs.a);
    m.step(0x32aa, 8); // srl a
    regs.b = regs.rr(regs.b);
    m.step(0x32ac, 8); // rr b
    regs.c = regs.a;
    m.step(0x32ad, 4); // ld c,a
    regs.a = regs.b;
    m.step(0x32ae, 4); // ld a,b
    mem.write8(0x808d, regs.a);
    m.step(0x32b1, 13); // ld (0x808d),a
    regs.a = 0x00;
    m.step(0x32b3, 7); // ld a,0x00
    regs.b = regs.a;
    m.step(0x32b4, 4); // ld b,a
    regs.h = regs.srl(regs.h);
    m.step(0x32b6, 8); // srl h
    regs.rra();
    m.step(0x32b7, 4); // rra
    regs.h = regs.srl(regs.h);
    m.step(0x32b9, 8); // srl h
    regs.rra();
    m.step(0x32ba, 4); // rra
    regs.h = regs.srl(regs.h);
    m.step(0x32bc, 8); // srl h
    regs.rra();
    m.step(0x32bd, 4); // rra
    regs.l = regs.a;
    m.step(0x32be, 4); // ld l,a
    regs.addHl(regs.bc);
    m.step(0x32bf, 11); // add hl,bc
    regs.bc = 0x9000;
    m.step(0x32c2, 10); // ld bc,0x9000
    regs.addHl(regs.bc);
    m.step(0x32c3, 11); // add hl,bc
    mem.write16(0x8089, regs.hl);
    m.step(0x32c6, 16); // ld (0x8089),hl
    regs.a = mem.read8(0x8093);
    m.step(0x32c9, 13); // ld a,(0x8093)
    regs.cp(0x05);
    m.step(0x32cb, 7); // cp 0x05
    if (regs.fZ) { m.step(0x3345, 10); return loc_3345(); } // jp z,0x3345
    m.step(0x32ce, 10);
    regs.a = mem.read8(0x8092);
    m.step(0x32d1, 13); // ld a,(0x8092)
    regs.a = regs.dec8(regs.a);
    m.step(0x32d2, 4); // dec a
    if (regs.fZ) { m.step(0x32f2, 10); return loc_32f2(); } // jp z,0x32f2
    m.step(0x32d5, 10);
    regs.a = regs.dec8(regs.a);
    m.step(0x32d6, 4); // dec a
    if (regs.fZ) { m.step(0x3311, 10); return loc_3311(); } // jp z,0x3311
    m.step(0x32d9, 10);
    regs.a = regs.dec8(regs.a);
    m.step(0x32da, 4); // dec a
    if (regs.fZ) { m.step(0x3326, 10); return loc_3326(); } // jp z,0x3326
    m.step(0x32dd, 10);
    m.push16(0x32e0);
    m.step(0x33da, 17);
    m.call(0x33da); // call 0x33da
    if (regs.fZ) { m.step(0x347d, 10); return m.call(0x347d); } // jp z,0x347d
    m.step(0x32e3, 10);
    m.push16(0x32e6);
    m.step(0x33bc, 17);
    m.call(0x33bc); // call 0x33bc
    if (regs.fZ) { m.step(0x3476, 10); return m.call(0x3476); } // jp z,0x3476
    m.step(0x32e9, 10);
    m.push16(0x32ec);
    m.step(0x3425, 17);
    m.call(0x3425); // call 0x3425
    if (regs.fZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp z,0x348b
    m.step(0x32ef, 10);
    m.step(0x3484, 10); // jp 0x3484
    return m.call(0x3484);
  }

  // loc_3277: special-case column 0xDC, else fall to the position decoder.
  function loc_3277() {
    regs.a = mem.read8(0x8083);
    m.step(0x327a, 13); // ld a,(0x8083)
    regs.cp(0xdc);
    m.step(0x327c, 7); // cp 0xdc
    if (regs.fNZ) { m.step(0x3289, 12); return loc_3289(); } // jr nz,0x3289
    m.step(0x327e, 7);
    regs.a = mem.read8(0x8086);
    m.step(0x3281, 13); // ld a,(0x8086)
    regs.cp(0x33);
    m.step(0x3283, 7); // cp 0x33
    if (regs.fC) { m.step(0x3484, 10); return m.call(0x3484); } // jp c,0x3484
    m.step(0x3286, 10);
    m.step(0x348b, 10); // jp 0x348b
    return m.call(0x348b);
  }

  // loc_326f: 0x8086==0x23 && 0x8093!=0x04 branch.
  function loc_326f() {
    regs.cp(0xdd);
    m.step(0x3271, 7); // cp 0xdd
    if (regs.fNC) { m.step(0x348b, 10); return m.call(0x348b); } // jp nc,0x348b
    m.step(0x3274, 10);
    m.step(0x3484, 10); // jp 0x3484
    return m.call(0x3484);
  }

  // loc_3258: top-row (0x8086==0x23) special handling, else the decoder.
  function loc_3258() {
    regs.a = mem.read8(0x8086);
    m.step(0x325b, 13); // ld a,(0x8086)
    regs.cp(0x23);
    m.step(0x325d, 7); // cp 0x23
    if (regs.fNZ) { m.step(0x3277, 12); return loc_3277(); } // jr nz,0x3277
    m.step(0x325f, 7);
    regs.a = mem.read8(0x8093);
    m.step(0x3262, 13); // ld a,(0x8093)
    regs.cp(0x04);
    m.step(0x3264, 7); // cp 0x04
    regs.a = mem.read8(0x8083);
    m.step(0x3267, 13); // ld a,(0x8083)
    if (regs.fNZ) { m.step(0x326f, 12); return loc_326f(); } // jr nz,0x326f
    m.step(0x3269, 7);
    regs.cp(0xe5);
    m.step(0x326b, 7); // cp 0xe5
    if (regs.fNZ) { m.step(0x348b, 10); return m.call(0x348b); } // jp nz,0x348b
    m.step(0x326e, 10);
    m.ret(10); // ret
    return;
  }

  // loc_3203: overlap test against the second box (0x8068/0x806B); on a hit,
  // retarget the object and hand off to 0x4C9F/0x3458.
  function loc_3203() {
    regs.a = mem.read8(0x807a);
    m.step(0x3206, 13); // ld a,(0x807a)
    regs.or(regs.a);
    m.step(0x3207, 4); // or a
    if (regs.fNZ) { m.step(0x3258, 12); return loc_3258(); } // jr nz,0x3258
    m.step(0x3209, 7);
    regs.a = mem.read8(0x80c1);
    m.step(0x320c, 13); // ld a,(0x80c1)
    regs.or(regs.a);
    m.step(0x320d, 4); // or a
    if (regs.fNZ) { m.step(0x3258, 12); return loc_3258(); } // jr nz,0x3258
    m.step(0x320f, 7);
    regs.a = mem.read8(0x8083);
    m.step(0x3212, 13); // ld a,(0x8083)
    regs.h = regs.a;
    m.step(0x3213, 4); // ld h,a
    regs.a = mem.read8(0x8068);
    m.step(0x3216, 13); // ld a,(0x8068)
    regs.add(0x08);
    m.step(0x3218, 7); // add a,0x08
    regs.cp(regs.h);
    m.step(0x3219, 4); // cp h
    if (regs.fC) { m.step(0x3258, 12); return loc_3258(); } // jr c,0x3258
    m.step(0x321b, 7);
    regs.sub(0x12);
    m.step(0x321d, 7); // sub 0x12
    regs.cp(regs.h);
    m.step(0x321e, 4); // cp h
    if (regs.fNC) { m.step(0x3258, 12); return loc_3258(); } // jr nc,0x3258
    m.step(0x3220, 7);
    regs.a = mem.read8(0x8086);
    m.step(0x3223, 13); // ld a,(0x8086)
    regs.l = regs.a;
    m.step(0x3224, 4); // ld l,a
    regs.a = mem.read8(0x806b);
    m.step(0x3227, 13); // ld a,(0x806b)
    regs.add(0x07);
    m.step(0x3229, 7); // add a,0x07
    regs.cp(regs.l);
    m.step(0x322a, 4); // cp l
    if (regs.fC) { m.step(0x3258, 12); return loc_3258(); } // jr c,0x3258
    m.step(0x322c, 7);
    regs.sub(0x0f);
    m.step(0x322e, 7); // sub 0x0f
    regs.cp(regs.l);
    m.step(0x322f, 4); // cp l
    if (regs.fNC) { m.step(0x3258, 12); return loc_3258(); } // jr nc,0x3258
    m.step(0x3231, 7);
    regs.a = mem.read8(0x8093);
    m.step(0x3234, 13); // ld a,(0x8093)
    mem.write8(0x807a, regs.a);
    m.step(0x3237, 13); // ld (0x807a),a
    regs.a = mem.read8(0x8068);
    m.step(0x323a, 13); // ld a,(0x8068)
    mem.write8(0x8083, regs.a);
    m.step(0x323d, 13); // ld (0x8083),a
    regs.a = mem.read8(0x806b);
    m.step(0x3240, 13); // ld a,(0x806b)
    mem.write8(0x8086, regs.a);
    m.step(0x3243, 13); // ld (0x8086),a
    regs.a = 0x81;
    m.step(0x3245, 7); // ld a,0x81
    mem.write8(0x808b, regs.a);
    m.step(0x3248, 13); // ld (0x808b),a
    regs.a = 0x17;
    m.step(0x324a, 7); // ld a,0x17
    mem.write8(0x8084, regs.a);
    m.step(0x324d, 13); // ld (0x8084),a
    regs.a = 0x35;
    m.step(0x324f, 7); // ld a,0x35
    mem.write8(0x8069, regs.a);
    m.step(0x3252, 13); // ld (0x8069),a
    m.push16(0x3255);
    m.step(0x4c9f, 17);
    m.call(0x4c9f); // call 0x4c9f
    m.step(0x3458, 10); // jp 0x3458
    return m.call(0x3458);
  }

  // loc_31d0: overlap test against the player box (0x8094/0x8097); on a hit,
  // 0x4673 then park the object in state 0xC0 and hand off to 0x34DA.
  function loc_31d0() {
    regs.a = mem.read8(0x80a1);
    m.step(0x31d3, 13); // ld a,(0x80a1)
    regs.or(regs.a);
    m.step(0x31d4, 4); // or a
    if (regs.fZ) { m.step(0x3203, 12); return loc_3203(); } // jr z,0x3203
    m.step(0x31d6, 7);
    regs.a = mem.read8(0x8083);
    m.step(0x31d9, 13); // ld a,(0x8083)
    regs.h = regs.a;
    m.step(0x31da, 4); // ld h,a
    regs.a = mem.read8(0x8094);
    m.step(0x31dd, 13); // ld a,(0x8094)
    regs.add(0x04);
    m.step(0x31df, 7); // add a,0x04
    regs.cp(regs.h);
    m.step(0x31e0, 4); // cp h
    if (regs.fC) { m.step(0x3203, 12); return loc_3203(); } // jr c,0x3203
    m.step(0x31e2, 7);
    regs.sub(0x0c);
    m.step(0x31e4, 7); // sub 0x0c
    regs.cp(regs.h);
    m.step(0x31e5, 4); // cp h
    if (regs.fNC) { m.step(0x3203, 12); return loc_3203(); } // jr nc,0x3203
    m.step(0x31e7, 7);
    regs.a = mem.read8(0x8086);
    m.step(0x31ea, 13); // ld a,(0x8086)
    regs.l = regs.a;
    m.step(0x31eb, 4); // ld l,a
    regs.a = mem.read8(0x8097);
    m.step(0x31ee, 13); // ld a,(0x8097)
    regs.add(0x03);
    m.step(0x31f0, 7); // add a,0x03
    regs.cp(regs.l);
    m.step(0x31f1, 4); // cp l
    if (regs.fC) { m.step(0x3203, 12); return loc_3203(); } // jr c,0x3203
    m.step(0x31f3, 7);
    regs.sub(0x07);
    m.step(0x31f5, 7); // sub 0x07
    regs.cp(regs.l);
    m.step(0x31f6, 4); // cp l
    if (regs.fNC) { m.step(0x3203, 12); return loc_3203(); } // jr nc,0x3203
    m.step(0x31f8, 7);
    m.push16(0x31fb);
    m.step(0x4673, 17);
    m.call(0x4673); // call 0x4673
    regs.a = 0xc0;
    m.step(0x31fd, 7); // ld a,0xc0
    mem.write8(0x8090, regs.a);
    m.step(0x3200, 13); // ld (0x8090),a
    m.step(0x34da, 10); // jp 0x34da
    return m.call(0x34da);
  }

  // --- entry region 0x319d ---------------------------------------------------
  regs.a = mem.read8(0x8093);
  m.step(0x31a0, 13); // ld a,(0x8093)
  regs.b = regs.a;
  m.step(0x31a1, 4); // ld b,a
  regs.a = mem.read8(0x807a);
  m.step(0x31a4, 13); // ld a,(0x807a)
  regs.cp(regs.b);
  m.step(0x31a5, 4); // cp b
  if (regs.fZ) { m.step(0x3458, 10); return m.call(0x3458); } // jp z,0x3458
  m.step(0x31a8, 10);
  regs.a = mem.read8(0x8090);
  m.step(0x31ab, 13); // ld a,(0x8090)
  regs.or(regs.a);
  m.step(0x31ac, 4); // or a
  if (regs.fM) { m.step(0x34da, 10); return m.call(0x34da); } // jp m,0x34da
  m.step(0x31af, 10);
  if (regs.fNZ) { m.step(0x31d0, 12); return loc_31d0(); } // jr nz,0x31d0
  m.step(0x31b1, 7);
  regs.a = mem.read8(0x808b);
  m.step(0x31b4, 13); // ld a,(0x808b)
  regs.a = regs.dec8(regs.a);
  m.step(0x31b5, 4); // dec a
  mem.write8(0x808b, regs.a);
  m.step(0x31b8, 13); // ld (0x808b),a
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x31b9, 5);
  regs.a = 0x01;
  m.step(0x31bb, 7); // ld a,0x01
  mem.write8(0x8090, regs.a);
  m.step(0x31be, 13); // ld (0x8090),a
  mem.write8(0x808b, regs.a);
  m.step(0x31c1, 13); // ld (0x808b),a
  regs.a = 0xe4;
  m.step(0x31c3, 7); // ld a,0xe4
  mem.write8(0x8083, regs.a);
  m.step(0x31c6, 13); // ld (0x8083),a
  regs.a = 0x23;
  m.step(0x31c8, 7); // ld a,0x23
  mem.write8(0x8086, regs.a);
  m.step(0x31cb, 13); // ld (0x8086),a
  regs.a = 0xec;
  m.step(0x31cd, 7); // ld a,0xec
  mem.write8(0x80e8, regs.a);
  m.step(0x31d0, 13); // ld (0x80e8),a -- falls through into loc_31d0
  return loc_31d0();
}
