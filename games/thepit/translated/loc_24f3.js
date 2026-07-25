// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_24f3  (ROM 0x24f3-0x2777, The Pit) -- per-frame elevator/lift object update.
 *
 * A state machine over the object's phase byte 0x80a2 (1..4) that walks a step
 * timer 0x80a4, chooses a sprite code (0x8095) and a facing/blank code (0x8069),
 * nudges the position bytes 0x8094/0x8097, occasionally re-seeds the linked entity
 * at (0x806e) and calls the setup helper 0x28ab, then builds the 4-byte sprite
 * record at 0x8224 (loc_2677) and tail-jumps to 0x29ad. Bit 3 of 0x80a1 diverts to
 * a table-walk (loc_272d/cpir over the 0x277a data), and a 0x80bd/edge-collision
 * arm (loc_2696) tail-jumps to 0x29ad early. (Role best-effort from the code;
 * addresses, flags and control flow are exact.)
 *
 * loc_24f3:
 *   24f3  3a 77 80     ld   a,(0x8077)
 *   24f6  a7           and  a
 *   24f7  20 06        jr   nz,0x24ff
 *   24f9  3a c1 80     ld   a,(0x80c1)
 *   24fc  a7           and  a
 *   24fd  28 08        jr   z,0x2507
 * loc_24ff:
 *   24ff  3e 09        ld   a,0x09
 *   2501  32 95 80     ld   (0x8095),a
 *   2504  c3 77 26     jp   0x2677
 * loc_2507:
 *   2507  3a a1 80     ld   a,(0x80a1)
 *   250a  e6 08        and  0x08
 *   250c  c2 2d 27     jp   nz,0x272d
 *   250f  3a bd 80     ld   a,(0x80bd)
 *   2512  fe 02        cp   0x02
 *   2514  ca 96 26     jp   z,0x2696
 *   2517  3a a4 80     ld   a,(0x80a4)
 *   251a  fe 18        cp   0x18
 *   251c  cc 73 4c     call z,0x4c73
 *   251f  3a a2 80     ld   a,(0x80a2)
 *   2522  3d           dec  a
 *   2523  28 0f        jr   z,0x2534
 *   2525  3d           dec  a
 *   2526  ca 87 25     jp   z,0x2587
 *   2529  3d           dec  a
 *   252a  ca da 25     jp   z,0x25da
 *   252d  3d           dec  a
 *   252e  ca 28 26     jp   z,0x2628
 *   2531  c3 96 26     jp   0x2696
 * loc_2534:
 *   2534  3e a8        ld   a,0xa8
 *   2536  32 95 80     ld   (0x8095),a
 *   2539  3a a4 80     ld   a,(0x80a4)
 *   253c  3d           dec  a
 *   253d  32 a4 80     ld   (0x80a4),a
 *   2540  20 2b        jr   nz,0x256d
 *   2542  3e 09        ld   a,0x09
 *   2544  32 95 80     ld   (0x8095),a
 *   2547  dd 2a 6e 80  ld   ix,(0x806e)
 *   254b  3a a7 80     ld   a,(0x80a7)
 *   254e  a7           and  a
 *   254f  28 03        jr   z,0x2554
 *   2551  dd 77 00     ld   (ix+0x00),a
 * loc_2554:
 *   2554  3a a8 80     ld   a,(0x80a8)
 *   2557  a7           and  a
 *   2558  28 03        jr   z,0x255d
 *   255a  dd 77 01     ld   (ix+0x01),a
 * loc_255d:
 *   255d  3e b2        ld   a,0xb2
 *   255f  32 69 80     ld   (0x8069),a
 *   2562  cd ab 28     call 0x28ab
 *   2565  3e 00        ld   a,0x00
 *   2567  32 a2 80     ld   (0x80a2),a
 *   256a  c3 77 26     jp   0x2677
 * loc_256d:
 *   256d  3a 68 80     ld   a,(0x8068)
 *   2570  d6 08        sub  0x08
 *   2572  32 94 80     ld   (0x8094),a
 *   2575  3a 6b 80     ld   a,(0x806b)
 *   2578  32 97 80     ld   (0x8097),a
 *   257b  3a 96 80     ld   a,(0x8096)
 *   257e  3d           dec  a
 *   257f  e6 07        and  0x07
 *   2581  32 96 80     ld   (0x8096),a
 *   2584  c3 77 26     jp   0x2677
 * loc_2587:
 *   2587  3e 28        ld   a,0x28
 *   2589  32 95 80     ld   (0x8095),a
 *   258c  3a a4 80     ld   a,(0x80a4)
 *   258f  3d           dec  a
 *   2590  32 a4 80     ld   (0x80a4),a
 *   2593  20 2b        jr   nz,0x25c0
 *   2595  3e 00        ld   a,0x00
 *   2597  32 a2 80     ld   (0x80a2),a
 *   259a  3e 09        ld   a,0x09
 *   259c  32 95 80     ld   (0x8095),a
 *   259f  dd 2a 6e 80  ld   ix,(0x806e)
 *   25a3  3a a7 80     ld   a,(0x80a7)
 *   25a6  a7           and  a
 *   25a7  28 03        jr   z,0x25ac
 *   25a9  dd 77 00     ld   (ix+0x00),a
 * loc_25ac:
 *   25ac  3a a8 80     ld   a,(0x80a8)
 *   25af  a7           and  a
 *   25b0  28 03        jr   z,0x25b5
 *   25b2  dd 77 01     ld   (ix+0x01),a
 * loc_25b5:
 *   25b5  3e 32        ld   a,0x32
 *   25b7  32 69 80     ld   (0x8069),a
 *   25ba  cd ab 28     call 0x28ab
 *   25bd  c3 77 26     jp   0x2677
 * loc_25c0:
 *   25c0  3a 68 80     ld   a,(0x8068)
 *   25c3  c6 08        add  a,0x08
 *   25c5  32 94 80     ld   (0x8094),a
 *   25c8  3a 6b 80     ld   a,(0x806b)
 *   25cb  32 97 80     ld   (0x8097),a
 *   25ce  3a 96 80     ld   a,(0x8096)
 *   25d1  3d           dec  a
 *   25d2  e6 07        and  0x07
 *   25d4  32 96 80     ld   (0x8096),a
 *   25d7  c3 77 26     jp   0x2677
 * loc_25da:
 *   25da  3e 29        ld   a,0x29
 *   25dc  32 95 80     ld   (0x8095),a
 *   25df  3a a4 80     ld   a,(0x80a4)
 *   25e2  3d           dec  a
 *   25e3  32 a4 80     ld   (0x80a4),a
 *   25e6  20 27        jr   nz,0x260f
 *   25e8  3e 00        ld   a,0x00
 *   25ea  32 a2 80     ld   (0x80a2),a
 *   25ed  3e 09        ld   a,0x09
 *   25ef  32 95 80     ld   (0x8095),a
 *   25f2  dd 2a 6e 80  ld   ix,(0x806e)
 *   25f6  3a a7 80     ld   a,(0x80a7)
 *   25f9  a7           and  a
 *   25fa  28 03        jr   z,0x25ff
 *   25fc  dd 77 00     ld   (ix+0x00),a
 * loc_25ff:
 *   25ff  3a a8 80     ld   a,(0x80a8)
 *   2602  a7           and  a
 *   2603  28 03        jr   z,0x2608
 *   2605  dd 77 01     ld   (ix+0x01),a
 * loc_2608:
 *   2608  3e 34        ld   a,0x34
 *   260a  32 69 80     ld   (0x8069),a
 *   260d  18 68        jr   0x2677
 * loc_260f:
 *   260f  3a 68 80     ld   a,(0x8068)
 *   2612  32 94 80     ld   (0x8094),a
 *   2615  3a 6b 80     ld   a,(0x806b)
 *   2618  c6 08        add  a,0x08
 *   261a  32 97 80     ld   (0x8097),a
 *   261d  3a 96 80     ld   a,(0x8096)
 *   2620  3d           dec  a
 *   2621  e6 07        and  0x07
 *   2623  32 96 80     ld   (0x8096),a
 *   2626  18 4f        jr   0x2677
 * loc_2628:
 *   2628  3e 69        ld   a,0x69
 *   262a  32 95 80     ld   (0x8095),a
 *   262d  3a a4 80     ld   a,(0x80a4)
 *   2630  3d           dec  a
 *   2631  32 a4 80     ld   (0x80a4),a
 *   2634  20 2a        jr   nz,0x2660
 *   2636  3e 09        ld   a,0x09
 *   2638  32 95 80     ld   (0x8095),a
 *   263b  dd 2a 6e 80  ld   ix,(0x806e)
 *   263f  3a a7 80     ld   a,(0x80a7)
 *   2642  a7           and  a
 *   2643  28 03        jr   z,0x2648
 *   2645  dd 77 00     ld   (ix+0x00),a
 * loc_2648:
 *   2648  3a a8 80     ld   a,(0x80a8)
 *   264b  a7           and  a
 *   264c  28 03        jr   z,0x2651
 *   264e  dd 77 ff     ld   (ix-0x01),a
 * loc_2651:
 *   2651  3e b4        ld   a,0xb4
 *   2653  32 69 80     ld   (0x8069),a
 *   2656  cd ab 28     call 0x28ab
 *   2659  3e 00        ld   a,0x00
 *   265b  32 a2 80     ld   (0x80a2),a
 *   265e  18 17        jr   0x2677
 * loc_2660:
 *   2660  3a 68 80     ld   a,(0x8068)
 *   2663  32 94 80     ld   (0x8094),a
 *   2666  3a 6b 80     ld   a,(0x806b)
 *   2669  d6 08        sub  0x08
 *   266b  32 97 80     ld   (0x8097),a
 *   266e  3a 96 80     ld   a,(0x8096)
 *   2671  3d           dec  a
 *   2672  e6 07        and  0x07
 *   2674  32 96 80     ld   (0x8096),a
 * loc_2677:
 *   2677  21 24 82     ld   hl,0x8224
 *   267a  3a 51 80     ld   a,(0x8051)
 *   267d  47           ld   b,a
 *   267e  3a 94 80     ld   a,(0x8094)
 *   2681  90           sub  b
 *   2682  77           ld   (hl),a
 *   2683  23           inc  hl
 *   2684  3a 95 80     ld   a,(0x8095)
 *   2687  77           ld   (hl),a
 *   2688  23           inc  hl
 *   2689  3a 96 80     ld   a,(0x8096)
 *   268c  77           ld   (hl),a
 *   268d  23           inc  hl
 *   268e  3a 97 80     ld   a,(0x8097)
 *   2691  80           add  a,b
 *   2692  77           ld   (hl),a
 *   2693  c3 ad 29     jp   0x29ad
 * loc_2696:
 *   2696  3a 79 80     ld   a,(0x8079)
 *   2699  b7           or   a
 *   269a  28 1f        jr   z,0x26bb
 *   269c  3a 7b 80     ld   a,(0x807b)
 *   269f  b7           or   a
 *   26a0  20 19        jr   nz,0x26bb
 *   26a2  3a e7 80     ld   a,(0x80e7)
 *   26a5  b7           or   a
 *   26a6  20 13        jr   nz,0x26bb
 *   26a8  3a 18 80     ld   a,(0x8018)
 *   26ab  47           ld   b,a
 *   26ac  3a a1 80     ld   a,(0x80a1)
 *   26af  b7           or   a
 *   26b0  28 0c        jr   z,0x26be
 *   26b2  cb 60        bit  4,b
 *   26b4  20 05        jr   nz,0x26bb
 *   26b6  3e 00        ld   a,0x00
 *   26b8  32 a1 80     ld   (0x80a1),a
 * loc_26bb:
 *   26bb  c3 ad 29     jp   0x29ad
 * loc_26be:
 *   26be  cb 60        bit  4,b
 *   26c0  28 f9        jr   z,0x26bb
 *   26c2  0e f8        ld   c,0xf8
 *   26c4  3a 69 80     ld   a,(0x8069)
 *   26c7  fe b2        cp   0xb2
 *   26c9  28 0e        jr   z,0x26d9
 *   26cb  fe b3        cp   0xb3
 *   26cd  28 0a        jr   z,0x26d9
 *   26cf  0e 08        ld   c,0x08
 *   26d1  fe 32        cp   0x32
 *   26d3  28 04        jr   z,0x26d9
 *   26d5  fe 33        cp   0x33
 *   26d7  20 e2        jr   nz,0x26bb
 * loc_26d9:
 *   26d9  79           ld   a,c
 *   26da  32 a1 80     ld   (0x80a1),a
 *   26dd  cd 7f 4c     call 0x4c7f
 *   26e0  3e 03        ld   a,0x03
 *   26e2  32 96 80     ld   (0x8096),a
 *   26e5  3e 3a        ld   a,0x3a
 *   26e7  32 95 80     ld   (0x8095),a
 *   26ea  3a 68 80     ld   a,(0x8068)
 *   26ed  32 94 80     ld   (0x8094),a
 *   26f0  c6 03        add  a,0x03
 *   26f2  cb 3f        srl  a
 *   26f4  cb 3f        srl  a
 *   26f6  cb 3f        srl  a
 *   26f8  ed 44        neg
 *   26fa  c6 1f        add  a,0x1f
 *   26fc  67           ld   h,a
 *   26fd  3a 6b 80     ld   a,(0x806b)
 *   2700  32 97 80     ld   (0x8097),a
 *   2703  c6 05        add  a,0x05
 *   2705  06 00        ld   b,0x00
 *   2707  cb 3f        srl  a
 *   2709  cb 18        rr   b
 *   270b  cb 3f        srl  a
 *   270d  cb 18        rr   b
 *   270f  cb 3f        srl  a
 *   2711  cb 18        rr   b
 *   2713  4f           ld   c,a
 *   2714  78           ld   a,b
 *   2715  32 9e 80     ld   (0x809e),a
 *   2718  3e 00        ld   a,0x00
 *   271a  47           ld   b,a
 *   271b  cb 3c        srl  h
 *   271d  1f           rra
 *   271e  cb 3c        srl  h
 *   2720  1f           rra
 *   2721  cb 3c        srl  h
 *   2723  1f           rra
 *   2724  6f           ld   l,a
 *   2725  09           add  hl,bc
 *   2726  01 00 90     ld   bc,0x9000
 *   2729  09           add  hl,bc
 *   272a  22 9a 80     ld   (0x809a),hl
 * loc_272d:
 *   272d  3a a1 80     ld   a,(0x80a1)
 *   2730  4f           ld   c,a
 *   2731  11 20 00     ld   de,0x0020
 *   2734  cb 79        bit  7,c
 *   2736  20 03        jr   nz,0x273b
 *   2738  11 e0 ff     ld   de,0xffe0
 * loc_273b:
 *   273b  3a 94 80     ld   a,(0x8094)
 *   273e  81           add  a,c
 *   273f  32 94 80     ld   (0x8094),a
 *   2742  2a 9a 80     ld   hl,(0x809a)
 *   2745  19           add  hl,de
 *   2746  22 9a 80     ld   (0x809a),hl
 *   2749  dd 2a 9a 80  ld   ix,(0x809a)
 *   274d  3a 9e 80     ld   a,(0x809e)
 *   2750  5f           ld   e,a
 *   2751  fe a0        cp   0xa0
 *   2753  dd 7e 00     ld   a,(ix+0x00)
 *   2756  38 03        jr   c,0x275b
 *   2758  dd 7e 01     ld   a,(ix+0x01)
 * loc_275b:
 *   275b  16 00        ld   d,0x00
 *   275d  21 7a 27     ld   hl,0x277a
 *   2760  19           add  hl,de
 *   2761  01 20 00     ld   bc,0x0020
 *   2764  ed b1        cpir
 *   2766  c2 77 26     jp   nz,0x2677
 *   2769  3e 00        ld   a,0x00
 *   276b  32 94 80     ld   (0x8094),a
 *   276e  3c           inc  a
 *   276f  32 a1 80     ld   (0x80a1),a
 *   2772  3e 09        ld   a,0x09
 *   2774  32 95 80     ld   (0x8095),a
 *   2777  c3 77 26     jp   0x2677
 *
 * Control-flow notes:
 *  - `jp 0x2677`, `jp 0x2696`, `jp 0x272d`, `jp z,0x2587`, ... are INTERNAL labels
 *    of this routine; each is a nested closure and the jump is `return loc_XXXX()`.
 *  - `jp 0x29ad` (loc_2677, loc_26bb) is a TAIL-jump into another routine: nothing is
 *    pushed, so it is `m.step(0x29ad,10); return m.call(0x29ad)` -- 0x29ad's own `ret`
 *    pops OUR caller's return address. No m.ret() here (that would pop twice; see
 *    loc_24cf / games/dkong/translated/loc_0cf2.js for the same tail idiom).
 *  - Real `call`s (0x4c73, 0x28ab, 0x4c7f) push the return address and go through
 *    m.call; execution continues at the instruction after the call.
 *  - `jp cc,nn` is 10 T whether taken or not; `jr cc,d` is 12 T taken / 7 not; a
 *    conditional `call cc,nn` is 17 T taken / 10 not.
 *  - `cpir` T-states are the caller's to charge: 21*(n-1)+16 for the n iterations
 *    regs.cpir returns.
 */
export function loc_24f3(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  // loc_2677: build the 4-byte sprite record at 0x8224, then tail-jump to 0x29ad.
  function loc_2677() {
    regs.hl = 0x8224;
    m.step(0x267a, 10); // ld hl,0x8224
    regs.a = mem.read8(0x8051);
    m.step(0x267d, 13); // ld a,(0x8051)
    regs.b = regs.a;
    m.step(0x267e, 4); // ld b,a
    regs.a = mem.read8(0x8094);
    m.step(0x2681, 13); // ld a,(0x8094)
    regs.sub(regs.b);
    m.step(0x2682, 4); // sub b
    mem.write8(regs.hl, regs.a);
    m.step(0x2683, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2684, 6); // inc hl
    regs.a = mem.read8(0x8095);
    m.step(0x2687, 13); // ld a,(0x8095)
    mem.write8(regs.hl, regs.a);
    m.step(0x2688, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2689, 6); // inc hl
    regs.a = mem.read8(0x8096);
    m.step(0x268c, 13); // ld a,(0x8096)
    mem.write8(regs.hl, regs.a);
    m.step(0x268d, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x268e, 6); // inc hl
    regs.a = mem.read8(0x8097);
    m.step(0x2691, 13); // ld a,(0x8097)
    regs.add(regs.b);
    m.step(0x2692, 4); // add a,b
    mem.write8(regs.hl, regs.a);
    m.step(0x2693, 7); // ld (hl),a
    m.step(0x29ad, 10); // jp 0x29ad -- TAIL
    return m.call(0x29ad);
  }

  // loc_24ff: force sprite code 0x09, then to loc_2677.
  function loc_24ff() {
    regs.a = 0x09;
    m.step(0x2501, 7); // ld a,0x09
    mem.write8(0x8095, regs.a);
    m.step(0x2504, 13); // ld (0x8095),a
    m.step(0x2677, 10); // jp 0x2677
    return loc_2677();
  }

  // loc_26bb: early tail-jump to 0x29ad.
  function loc_26bb() {
    m.step(0x29ad, 10); // jp 0x29ad -- TAIL
    return m.call(0x29ad);
  }

  // loc_272d: horizontal nudge of 0x8094/0x809a by +/-0x20 per 0x80a1 bit7,
  // then cpir over the 0x277a table; on a match reset 0x8094/0x80a1/0x8095.
  // Falls through from loc_26be. Always ends at loc_2677.
  function loc_272d() {
    regs.a = mem.read8(0x80a1);
    m.step(0x2730, 13); // ld a,(0x80a1)
    regs.c = regs.a;
    m.step(0x2731, 4); // ld c,a
    regs.de = 0x0020;
    m.step(0x2734, 10); // ld de,0x0020
    regs.bit(7, regs.c);
    m.step(0x2736, 8); // bit 7,c
    if (regs.fNZ) {
      m.step(0x273b, 12); // jr nz,0x273b taken
    } else {
      m.step(0x2738, 7); // jr nz not taken
      regs.de = 0xffe0;
      m.step(0x273b, 10); // ld de,0xffe0
    }
    // loc_273b:
    regs.a = mem.read8(0x8094);
    m.step(0x273e, 13); // ld a,(0x8094)
    regs.add(regs.c);
    m.step(0x273f, 4); // add a,c
    mem.write8(0x8094, regs.a);
    m.step(0x2742, 13); // ld (0x8094),a
    regs.hl = mem.read16(0x809a);
    m.step(0x2745, 16); // ld hl,(0x809a)
    regs.addHl(regs.de);
    m.step(0x2746, 11); // add hl,de
    mem.write16(0x809a, regs.hl);
    m.step(0x2749, 16); // ld (0x809a),hl
    regs.ix = mem.read16(0x809a);
    m.step(0x274d, 20); // ld ix,(0x809a)
    regs.a = mem.read8(0x809e);
    m.step(0x2750, 13); // ld a,(0x809e)
    regs.e = regs.a;
    m.step(0x2751, 4); // ld e,a
    regs.cp(0xa0);
    m.step(0x2753, 7); // cp 0xa0
    regs.a = mem.read8(R(0x00));
    m.step(0x2756, 19); // ld a,(ix+0x00) -- ld leaves the cp flags
    if (regs.fC) {
      m.step(0x275b, 12); // jr c,0x275b taken
    } else {
      m.step(0x2758, 7); // jr c not taken
      regs.a = mem.read8(R(0x01));
      m.step(0x275b, 19); // ld a,(ix+0x01)
    }
    // loc_275b:
    regs.d = 0x00;
    m.step(0x275d, 7); // ld d,0x00
    regs.hl = 0x277a;
    m.step(0x2760, 10); // ld hl,0x277a
    regs.addHl(regs.de);
    m.step(0x2761, 11); // add hl,de
    regs.bc = 0x0020;
    m.step(0x2764, 10); // ld bc,0x0020
    const n = regs.cpir(mem);
    m.step(0x2766, 21 * (n - 1) + 16); // cpir
    if (regs.fNZ) {
      m.step(0x2677, 10); // jp nz,0x2677 -- no match
      return loc_2677();
    }
    m.step(0x2769, 10); // jp nz not taken (match found)
    regs.a = 0x00;
    m.step(0x276b, 7); // ld a,0x00
    mem.write8(0x8094, regs.a);
    m.step(0x276e, 13); // ld (0x8094),a
    regs.a = regs.inc8(regs.a);
    m.step(0x276f, 4); // inc a
    mem.write8(0x80a1, regs.a);
    m.step(0x2772, 13); // ld (0x80a1),a
    regs.a = 0x09;
    m.step(0x2774, 7); // ld a,0x09
    mem.write8(0x8095, regs.a);
    m.step(0x2777, 13); // ld (0x8095),a
    m.step(0x2677, 10); // jp 0x2677
    return loc_2677();
  }

  // loc_26be: classify the facing byte 0x8069, pick a delta 0x80a1, seed the
  // window at 0x809a (loc_26d9), then fall into loc_272d.
  function loc_26be() {
    regs.bit(4, regs.b);
    m.step(0x26c0, 8); // bit 4,b
    if (regs.fZ) {
      m.step(0x26bb, 12); // jr z,0x26bb taken
      return loc_26bb();
    }
    m.step(0x26c2, 7); // jr z not taken
    regs.c = 0xf8;
    m.step(0x26c4, 7); // ld c,0xf8
    regs.a = mem.read8(0x8069);
    m.step(0x26c7, 13); // ld a,(0x8069)
    regs.cp(0xb2);
    m.step(0x26c9, 7); // cp 0xb2
    if (regs.fZ) {
      m.step(0x26d9, 12); // jr z,0x26d9 taken
      return loc_26d9();
    }
    m.step(0x26cb, 7); // jr z not taken
    regs.cp(0xb3);
    m.step(0x26cd, 7); // cp 0xb3
    if (regs.fZ) {
      m.step(0x26d9, 12); // jr z,0x26d9 taken
      return loc_26d9();
    }
    m.step(0x26cf, 7); // jr z not taken
    regs.c = 0x08;
    m.step(0x26d1, 7); // ld c,0x08
    regs.cp(0x32);
    m.step(0x26d3, 7); // cp 0x32
    if (regs.fZ) {
      m.step(0x26d9, 12); // jr z,0x26d9 taken
      return loc_26d9();
    }
    m.step(0x26d5, 7); // jr z not taken
    regs.cp(0x33);
    m.step(0x26d7, 7); // cp 0x33
    if (regs.fNZ) {
      m.step(0x26bb, 12); // jr nz,0x26bb taken
      return loc_26bb();
    }
    m.step(0x26d9, 7); // jr nz not taken -> fall into loc_26d9
    return loc_26d9();

    function loc_26d9() {
      regs.a = regs.c;
      m.step(0x26da, 4); // ld a,c
      mem.write8(0x80a1, regs.a);
      m.step(0x26dd, 13); // ld (0x80a1),a
      m.push16(0x26e0);
      m.step(0x4c7f, 17);
      m.call(0x4c7f); // call 0x4c7f
      regs.a = 0x03;
      m.step(0x26e2, 7); // ld a,0x03
      mem.write8(0x8096, regs.a);
      m.step(0x26e5, 13); // ld (0x8096),a
      regs.a = 0x3a;
      m.step(0x26e7, 7); // ld a,0x3a
      mem.write8(0x8095, regs.a);
      m.step(0x26ea, 13); // ld (0x8095),a
      regs.a = mem.read8(0x8068);
      m.step(0x26ed, 13); // ld a,(0x8068)
      mem.write8(0x8094, regs.a);
      m.step(0x26f0, 13); // ld (0x8094),a
      regs.add(0x03);
      m.step(0x26f2, 7); // add a,0x03
      regs.a = regs.srl(regs.a);
      m.step(0x26f4, 8); // srl a
      regs.a = regs.srl(regs.a);
      m.step(0x26f6, 8); // srl a
      regs.a = regs.srl(regs.a);
      m.step(0x26f8, 8); // srl a
      regs.neg();
      m.step(0x26fa, 8); // neg
      regs.add(0x1f);
      m.step(0x26fc, 7); // add a,0x1f
      regs.h = regs.a;
      m.step(0x26fd, 4); // ld h,a
      regs.a = mem.read8(0x806b);
      m.step(0x2700, 13); // ld a,(0x806b)
      mem.write8(0x8097, regs.a);
      m.step(0x2703, 13); // ld (0x8097),a
      regs.add(0x05);
      m.step(0x2705, 7); // add a,0x05
      regs.b = 0x00;
      m.step(0x2707, 7); // ld b,0x00
      regs.a = regs.srl(regs.a);
      m.step(0x2709, 8); // srl a
      regs.b = regs.rr(regs.b);
      m.step(0x270b, 8); // rr b
      regs.a = regs.srl(regs.a);
      m.step(0x270d, 8); // srl a
      regs.b = regs.rr(regs.b);
      m.step(0x270f, 8); // rr b
      regs.a = regs.srl(regs.a);
      m.step(0x2711, 8); // srl a
      regs.b = regs.rr(regs.b);
      m.step(0x2713, 8); // rr b
      regs.c = regs.a;
      m.step(0x2714, 4); // ld c,a
      regs.a = regs.b;
      m.step(0x2715, 4); // ld a,b
      mem.write8(0x809e, regs.a);
      m.step(0x2718, 13); // ld (0x809e),a
      regs.a = 0x00;
      m.step(0x271a, 7); // ld a,0x00
      regs.b = regs.a;
      m.step(0x271b, 4); // ld b,a
      regs.h = regs.srl(regs.h);
      m.step(0x271d, 8); // srl h
      regs.rra();
      m.step(0x271e, 4); // rra
      regs.h = regs.srl(regs.h);
      m.step(0x2720, 8); // srl h
      regs.rra();
      m.step(0x2721, 4); // rra
      regs.h = regs.srl(regs.h);
      m.step(0x2723, 8); // srl h
      regs.rra();
      m.step(0x2724, 4); // rra
      regs.l = regs.a;
      m.step(0x2725, 4); // ld l,a
      regs.addHl(regs.bc);
      m.step(0x2726, 11); // add hl,bc
      regs.bc = 0x9000;
      m.step(0x2729, 10); // ld bc,0x9000
      regs.addHl(regs.bc);
      m.step(0x272a, 11); // add hl,bc
      mem.write16(0x809a, regs.hl);
      m.step(0x272d, 16); // ld (0x809a),hl -> fall into loc_272d
      return loc_272d();
    }
  }

  // loc_2696: 0x80bd==2 / edge-collision arm. Clears 0x80a1 on some conditions,
  // else re-seeds via loc_26be; always tail-jumps to 0x29ad.
  function loc_2696() {
    regs.a = mem.read8(0x8079);
    m.step(0x2699, 13); // ld a,(0x8079)
    regs.or(regs.a);
    m.step(0x269a, 4); // or a
    if (regs.fZ) {
      m.step(0x26bb, 12); // jr z,0x26bb taken
      return loc_26bb();
    }
    m.step(0x269c, 7); // jr z not taken
    regs.a = mem.read8(0x807b);
    m.step(0x269f, 13); // ld a,(0x807b)
    regs.or(regs.a);
    m.step(0x26a0, 4); // or a
    if (regs.fNZ) {
      m.step(0x26bb, 12); // jr nz,0x26bb taken
      return loc_26bb();
    }
    m.step(0x26a2, 7); // jr nz not taken
    regs.a = mem.read8(0x80e7);
    m.step(0x26a5, 13); // ld a,(0x80e7)
    regs.or(regs.a);
    m.step(0x26a6, 4); // or a
    if (regs.fNZ) {
      m.step(0x26bb, 12); // jr nz,0x26bb taken
      return loc_26bb();
    }
    m.step(0x26a8, 7); // jr nz not taken
    regs.a = mem.read8(0x8018);
    m.step(0x26ab, 13); // ld a,(0x8018)
    regs.b = regs.a;
    m.step(0x26ac, 4); // ld b,a
    regs.a = mem.read8(0x80a1);
    m.step(0x26af, 13); // ld a,(0x80a1)
    regs.or(regs.a);
    m.step(0x26b0, 4); // or a
    if (regs.fZ) {
      m.step(0x26be, 12); // jr z,0x26be taken
      return loc_26be();
    }
    m.step(0x26b2, 7); // jr z not taken
    regs.bit(4, regs.b);
    m.step(0x26b4, 8); // bit 4,b
    if (regs.fNZ) {
      m.step(0x26bb, 12); // jr nz,0x26bb taken
      return loc_26bb();
    }
    m.step(0x26b6, 7); // jr nz not taken
    regs.a = 0x00;
    m.step(0x26b8, 7); // ld a,0x00
    mem.write8(0x80a1, regs.a);
    m.step(0x26bb, 13); // ld (0x80a1),a -> fall into loc_26bb
    return loc_26bb();
  }

  // loc_2534: phase 1. Step 0x80a4 down; on expiry re-seed (0x806e) + call 0x28ab,
  // else move by -0x08 (loc_256d). Always ends at loc_2677.
  function loc_2534() {
    regs.a = 0xa8;
    m.step(0x2536, 7); // ld a,0xa8
    mem.write8(0x8095, regs.a);
    m.step(0x2539, 13); // ld (0x8095),a
    regs.a = mem.read8(0x80a4);
    m.step(0x253c, 13); // ld a,(0x80a4)
    regs.a = regs.dec8(regs.a);
    m.step(0x253d, 4); // dec a
    mem.write8(0x80a4, regs.a);
    m.step(0x2540, 13); // ld (0x80a4),a
    if (regs.fNZ) {
      m.step(0x256d, 12); // jr nz,0x256d taken
      return loc_256d();
    }
    m.step(0x2542, 7); // jr nz not taken
    regs.a = 0x09;
    m.step(0x2544, 7); // ld a,0x09
    mem.write8(0x8095, regs.a);
    m.step(0x2547, 13); // ld (0x8095),a
    regs.ix = mem.read16(0x806e);
    m.step(0x254b, 20); // ld ix,(0x806e)
    regs.a = mem.read8(0x80a7);
    m.step(0x254e, 13); // ld a,(0x80a7)
    regs.and(regs.a);
    m.step(0x254f, 4); // and a
    if (regs.fZ) {
      m.step(0x2554, 12); // jr z,0x2554 taken
    } else {
      m.step(0x2551, 7); // jr z not taken
      mem.write8(R(0x00), regs.a);
      m.step(0x2554, 19); // ld (ix+0x00),a
    }
    // loc_2554:
    regs.a = mem.read8(0x80a8);
    m.step(0x2557, 13); // ld a,(0x80a8)
    regs.and(regs.a);
    m.step(0x2558, 4); // and a
    if (regs.fZ) {
      m.step(0x255d, 12); // jr z,0x255d taken
    } else {
      m.step(0x255a, 7); // jr z not taken
      mem.write8(R(0x01), regs.a);
      m.step(0x255d, 19); // ld (ix+0x01),a
    }
    // loc_255d:
    regs.a = 0xb2;
    m.step(0x255f, 7); // ld a,0xb2
    mem.write8(0x8069, regs.a);
    m.step(0x2562, 13); // ld (0x8069),a
    m.push16(0x2565);
    m.step(0x28ab, 17);
    m.call(0x28ab); // call 0x28ab
    regs.a = 0x00;
    m.step(0x2567, 7); // ld a,0x00
    mem.write8(0x80a2, regs.a);
    m.step(0x256a, 13); // ld (0x80a2),a
    m.step(0x2677, 10); // jp 0x2677
    return loc_2677();

    function loc_256d() {
      regs.a = mem.read8(0x8068);
      m.step(0x2570, 13); // ld a,(0x8068)
      regs.sub(0x08);
      m.step(0x2572, 7); // sub 0x08
      mem.write8(0x8094, regs.a);
      m.step(0x2575, 13); // ld (0x8094),a
      regs.a = mem.read8(0x806b);
      m.step(0x2578, 13); // ld a,(0x806b)
      mem.write8(0x8097, regs.a);
      m.step(0x257b, 13); // ld (0x8097),a
      regs.a = mem.read8(0x8096);
      m.step(0x257e, 13); // ld a,(0x8096)
      regs.a = regs.dec8(regs.a);
      m.step(0x257f, 4); // dec a
      regs.and(0x07);
      m.step(0x2581, 7); // and 0x07
      mem.write8(0x8096, regs.a);
      m.step(0x2584, 13); // ld (0x8096),a
      m.step(0x2677, 10); // jp 0x2677
      return loc_2677();
    }
  }

  // loc_2587: phase 2. As loc_2534 but sprite 0x28 / facing 0x32, move by +0x08.
  function loc_2587() {
    regs.a = 0x28;
    m.step(0x2589, 7); // ld a,0x28
    mem.write8(0x8095, regs.a);
    m.step(0x258c, 13); // ld (0x8095),a
    regs.a = mem.read8(0x80a4);
    m.step(0x258f, 13); // ld a,(0x80a4)
    regs.a = regs.dec8(regs.a);
    m.step(0x2590, 4); // dec a
    mem.write8(0x80a4, regs.a);
    m.step(0x2593, 13); // ld (0x80a4),a
    if (regs.fNZ) {
      m.step(0x25c0, 12); // jr nz,0x25c0 taken
      return loc_25c0();
    }
    m.step(0x2595, 7); // jr nz not taken
    regs.a = 0x00;
    m.step(0x2597, 7); // ld a,0x00
    mem.write8(0x80a2, regs.a);
    m.step(0x259a, 13); // ld (0x80a2),a
    regs.a = 0x09;
    m.step(0x259c, 7); // ld a,0x09
    mem.write8(0x8095, regs.a);
    m.step(0x259f, 13); // ld (0x8095),a
    regs.ix = mem.read16(0x806e);
    m.step(0x25a3, 20); // ld ix,(0x806e)
    regs.a = mem.read8(0x80a7);
    m.step(0x25a6, 13); // ld a,(0x80a7)
    regs.and(regs.a);
    m.step(0x25a7, 4); // and a
    if (regs.fZ) {
      m.step(0x25ac, 12); // jr z,0x25ac taken
    } else {
      m.step(0x25a9, 7); // jr z not taken
      mem.write8(R(0x00), regs.a);
      m.step(0x25ac, 19); // ld (ix+0x00),a
    }
    // loc_25ac:
    regs.a = mem.read8(0x80a8);
    m.step(0x25af, 13); // ld a,(0x80a8)
    regs.and(regs.a);
    m.step(0x25b0, 4); // and a
    if (regs.fZ) {
      m.step(0x25b5, 12); // jr z,0x25b5 taken
    } else {
      m.step(0x25b2, 7); // jr z not taken
      mem.write8(R(0x01), regs.a);
      m.step(0x25b5, 19); // ld (ix+0x01),a
    }
    // loc_25b5:
    regs.a = 0x32;
    m.step(0x25b7, 7); // ld a,0x32
    mem.write8(0x8069, regs.a);
    m.step(0x25ba, 13); // ld (0x8069),a
    m.push16(0x25bd);
    m.step(0x28ab, 17);
    m.call(0x28ab); // call 0x28ab
    m.step(0x2677, 10); // jp 0x2677
    return loc_2677();

    function loc_25c0() {
      regs.a = mem.read8(0x8068);
      m.step(0x25c3, 13); // ld a,(0x8068)
      regs.add(0x08);
      m.step(0x25c5, 7); // add a,0x08
      mem.write8(0x8094, regs.a);
      m.step(0x25c8, 13); // ld (0x8094),a
      regs.a = mem.read8(0x806b);
      m.step(0x25cb, 13); // ld a,(0x806b)
      mem.write8(0x8097, regs.a);
      m.step(0x25ce, 13); // ld (0x8097),a
      regs.a = mem.read8(0x8096);
      m.step(0x25d1, 13); // ld a,(0x8096)
      regs.a = regs.dec8(regs.a);
      m.step(0x25d2, 4); // dec a
      regs.and(0x07);
      m.step(0x25d4, 7); // and 0x07
      mem.write8(0x8096, regs.a);
      m.step(0x25d7, 13); // ld (0x8096),a
      m.step(0x2677, 10); // jp 0x2677
      return loc_2677();
    }
  }

  // loc_25da: phase 3. Sprite 0x29 / facing 0x34 (no 0x28ab call); move by +0x08
  // on 0x8097 (loc_260f). Ends at loc_2677 via `jr` (12 T).
  function loc_25da() {
    regs.a = 0x29;
    m.step(0x25dc, 7); // ld a,0x29
    mem.write8(0x8095, regs.a);
    m.step(0x25df, 13); // ld (0x8095),a
    regs.a = mem.read8(0x80a4);
    m.step(0x25e2, 13); // ld a,(0x80a4)
    regs.a = regs.dec8(regs.a);
    m.step(0x25e3, 4); // dec a
    mem.write8(0x80a4, regs.a);
    m.step(0x25e6, 13); // ld (0x80a4),a
    if (regs.fNZ) {
      m.step(0x260f, 12); // jr nz,0x260f taken
      return loc_260f();
    }
    m.step(0x25e8, 7); // jr nz not taken
    regs.a = 0x00;
    m.step(0x25ea, 7); // ld a,0x00
    mem.write8(0x80a2, regs.a);
    m.step(0x25ed, 13); // ld (0x80a2),a
    regs.a = 0x09;
    m.step(0x25ef, 7); // ld a,0x09
    mem.write8(0x8095, regs.a);
    m.step(0x25f2, 13); // ld (0x8095),a
    regs.ix = mem.read16(0x806e);
    m.step(0x25f6, 20); // ld ix,(0x806e)
    regs.a = mem.read8(0x80a7);
    m.step(0x25f9, 13); // ld a,(0x80a7)
    regs.and(regs.a);
    m.step(0x25fa, 4); // and a
    if (regs.fZ) {
      m.step(0x25ff, 12); // jr z,0x25ff taken
    } else {
      m.step(0x25fc, 7); // jr z not taken
      mem.write8(R(0x00), regs.a);
      m.step(0x25ff, 19); // ld (ix+0x00),a
    }
    // loc_25ff:
    regs.a = mem.read8(0x80a8);
    m.step(0x2602, 13); // ld a,(0x80a8)
    regs.and(regs.a);
    m.step(0x2603, 4); // and a
    if (regs.fZ) {
      m.step(0x2608, 12); // jr z,0x2608 taken
    } else {
      m.step(0x2605, 7); // jr z not taken
      mem.write8(R(0x01), regs.a);
      m.step(0x2608, 19); // ld (ix+0x01),a
    }
    // loc_2608:
    regs.a = 0x34;
    m.step(0x260a, 7); // ld a,0x34
    mem.write8(0x8069, regs.a);
    m.step(0x260d, 13); // ld (0x8069),a
    m.step(0x2677, 12); // jr 0x2677
    return loc_2677();

    function loc_260f() {
      regs.a = mem.read8(0x8068);
      m.step(0x2612, 13); // ld a,(0x8068)
      mem.write8(0x8094, regs.a);
      m.step(0x2615, 13); // ld (0x8094),a
      regs.a = mem.read8(0x806b);
      m.step(0x2618, 13); // ld a,(0x806b)
      regs.add(0x08);
      m.step(0x261a, 7); // add a,0x08
      mem.write8(0x8097, regs.a);
      m.step(0x261d, 13); // ld (0x8097),a
      regs.a = mem.read8(0x8096);
      m.step(0x2620, 13); // ld a,(0x8096)
      regs.a = regs.dec8(regs.a);
      m.step(0x2621, 4); // dec a
      regs.and(0x07);
      m.step(0x2623, 7); // and 0x07
      mem.write8(0x8096, regs.a);
      m.step(0x2626, 13); // ld (0x8096),a
      m.step(0x2677, 12); // jr 0x2677
      return loc_2677();
    }
  }

  // loc_2628: phase 4. Sprite 0x69 / facing 0xb4, second write is (ix-0x01);
  // calls 0x28ab; move by -0x08 on 0x8097 (loc_2660). loc_2660 falls into loc_2677.
  function loc_2628() {
    regs.a = 0x69;
    m.step(0x262a, 7); // ld a,0x69
    mem.write8(0x8095, regs.a);
    m.step(0x262d, 13); // ld (0x8095),a
    regs.a = mem.read8(0x80a4);
    m.step(0x2630, 13); // ld a,(0x80a4)
    regs.a = regs.dec8(regs.a);
    m.step(0x2631, 4); // dec a
    mem.write8(0x80a4, regs.a);
    m.step(0x2634, 13); // ld (0x80a4),a
    if (regs.fNZ) {
      m.step(0x2660, 12); // jr nz,0x2660 taken
      return loc_2660();
    }
    m.step(0x2636, 7); // jr nz not taken
    regs.a = 0x09;
    m.step(0x2638, 7); // ld a,0x09
    mem.write8(0x8095, regs.a);
    m.step(0x263b, 13); // ld (0x8095),a
    regs.ix = mem.read16(0x806e);
    m.step(0x263f, 20); // ld ix,(0x806e)
    regs.a = mem.read8(0x80a7);
    m.step(0x2642, 13); // ld a,(0x80a7)
    regs.and(regs.a);
    m.step(0x2643, 4); // and a
    if (regs.fZ) {
      m.step(0x2648, 12); // jr z,0x2648 taken
    } else {
      m.step(0x2645, 7); // jr z not taken
      mem.write8(R(0x00), regs.a);
      m.step(0x2648, 19); // ld (ix+0x00),a
    }
    // loc_2648:
    regs.a = mem.read8(0x80a8);
    m.step(0x264b, 13); // ld a,(0x80a8)
    regs.and(regs.a);
    m.step(0x264c, 4); // and a
    if (regs.fZ) {
      m.step(0x2651, 12); // jr z,0x2651 taken
    } else {
      m.step(0x264e, 7); // jr z not taken
      mem.write8(R(-0x01), regs.a);
      m.step(0x2651, 19); // ld (ix-0x01),a
    }
    // loc_2651:
    regs.a = 0xb4;
    m.step(0x2653, 7); // ld a,0xb4
    mem.write8(0x8069, regs.a);
    m.step(0x2656, 13); // ld (0x8069),a
    m.push16(0x2659);
    m.step(0x28ab, 17);
    m.call(0x28ab); // call 0x28ab
    regs.a = 0x00;
    m.step(0x265b, 7); // ld a,0x00
    mem.write8(0x80a2, regs.a);
    m.step(0x265e, 13); // ld (0x80a2),a
    m.step(0x2677, 12); // jr 0x2677
    return loc_2677();

    function loc_2660() {
      regs.a = mem.read8(0x8068);
      m.step(0x2663, 13); // ld a,(0x8068)
      mem.write8(0x8094, regs.a);
      m.step(0x2666, 13); // ld (0x8094),a
      regs.a = mem.read8(0x806b);
      m.step(0x2669, 13); // ld a,(0x806b)
      regs.sub(0x08);
      m.step(0x266b, 7); // sub 0x08
      mem.write8(0x8097, regs.a);
      m.step(0x266e, 13); // ld (0x8097),a
      regs.a = mem.read8(0x8096);
      m.step(0x2671, 13); // ld a,(0x8096)
      regs.a = regs.dec8(regs.a);
      m.step(0x2672, 4); // dec a
      regs.and(0x07);
      m.step(0x2674, 7); // and 0x07
      mem.write8(0x8096, regs.a);
      m.step(0x2677, 13); // ld (0x8096),a -> fall into loc_2677
      return loc_2677();
    }
  }

  // loc_2507: main dispatch on the phase byte 0x80a2.
  function loc_2507() {
    regs.a = mem.read8(0x80a1);
    m.step(0x250a, 13); // ld a,(0x80a1)
    regs.and(0x08);
    m.step(0x250c, 7); // and 0x08
    if (regs.fNZ) {
      m.step(0x272d, 10); // jp nz,0x272d
      return loc_272d();
    }
    m.step(0x250f, 10); // jp nz not taken
    regs.a = mem.read8(0x80bd);
    m.step(0x2512, 13); // ld a,(0x80bd)
    regs.cp(0x02);
    m.step(0x2514, 7); // cp 0x02
    if (regs.fZ) {
      m.step(0x2696, 10); // jp z,0x2696
      return loc_2696();
    }
    m.step(0x2517, 10); // jp z not taken
    regs.a = mem.read8(0x80a4);
    m.step(0x251a, 13); // ld a,(0x80a4)
    regs.cp(0x18);
    m.step(0x251c, 7); // cp 0x18
    if (regs.fZ) {
      m.push16(0x251f);
      m.step(0x4c73, 17);
      m.call(0x4c73); // call z,0x4c73 taken
    } else {
      m.step(0x251f, 10); // call z not taken
    }
    regs.a = mem.read8(0x80a2);
    m.step(0x2522, 13); // ld a,(0x80a2)
    regs.a = regs.dec8(regs.a);
    m.step(0x2523, 4); // dec a
    if (regs.fZ) {
      m.step(0x2534, 12); // jr z,0x2534
      return loc_2534();
    }
    m.step(0x2525, 7); // jr z not taken
    regs.a = regs.dec8(regs.a);
    m.step(0x2526, 4); // dec a
    if (regs.fZ) {
      m.step(0x2587, 10); // jp z,0x2587
      return loc_2587();
    }
    m.step(0x2529, 10); // jp z not taken
    regs.a = regs.dec8(regs.a);
    m.step(0x252a, 4); // dec a
    if (regs.fZ) {
      m.step(0x25da, 10); // jp z,0x25da
      return loc_25da();
    }
    m.step(0x252d, 10); // jp z not taken
    regs.a = regs.dec8(regs.a);
    m.step(0x252e, 4); // dec a
    if (regs.fZ) {
      m.step(0x2628, 10); // jp z,0x2628
      return loc_2628();
    }
    m.step(0x2531, 10); // jp z not taken
    m.step(0x2696, 10); // jp 0x2696
    return loc_2696();
  }

  // ---- entry: 0x24f3 ----
  regs.a = mem.read8(0x8077);
  m.step(0x24f6, 13); // ld a,(0x8077)
  regs.and(regs.a);
  m.step(0x24f7, 4); // and a
  if (regs.fNZ) {
    m.step(0x24ff, 12); // jr nz,0x24ff taken
    return loc_24ff();
  }
  m.step(0x24f9, 7); // jr nz not taken
  regs.a = mem.read8(0x80c1);
  m.step(0x24fc, 13); // ld a,(0x80c1)
  regs.and(regs.a);
  m.step(0x24fd, 4); // and a
  if (regs.fZ) {
    m.step(0x2507, 12); // jr z,0x2507 taken
    return loc_2507();
  }
  m.step(0x24ff, 7); // jr z not taken -> fall into loc_24ff
  return loc_24ff();
}
