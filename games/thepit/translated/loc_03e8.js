// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_03e8  (ROM 0x03e8-0x0672, The Pit) -- per-frame player-vs-maze-wall
 * collision classifier. Runs a 30-frame countdown timer (0x800b), then compares
 * the player's offset position against a table of wall boundaries and writes a
 * 4-way "which wall am I against" bitmask to 0x801b.
 *
 * Flow:
 *   - 0x03e8-0x0406  timer/housekeeping. If (0x8010)==0, call 0x4894. Decrement
 *     the frame counter (0x800b); while it is still non-zero, skip straight to
 *     loc_0409. When it reaches 0, reload it to 0x1e (30), and -- gated on
 *     (0x807c)==0 and (0x807b)==0 -- call 0x48c4. (0x807c)!=0 returns early.
 *   - loc_0409  (0x8079)==0 returns early (nothing to classify this frame).
 *     Otherwise form b = (0x8068)+3 and c = (0x806b)+5 (the player's probe
 *     point), then dispatch on the cached region hint (0x800c) to the matching
 *     boundary-test block -- an optimisation so a stationary player re-tests only
 *     the region it was last in.
 *   - loc_0438..loc_0651  a fall-through chain of boundary tests. Each block
 *     compares b and/or c against fixed thresholds; on a match it jumps to one of
 *     the four exit codes, otherwise it falls to the next block. Blocks that head
 *     a new region also rewrite the hint (0x800c) to that region's index.
 *   - loc_0661/0665/0669/066d  set A to 0x01 / 0x02 / 0x04 / 0x08 (the direction
 *     bitmask) and converge on loc_066f, which stores it to (0x801b) and returns.
 *
 * Role is best-effort from the code; the addresses, flags, cycle costs and
 * control flow are exact, one JS statement per Z80 instruction.
 *
 * MODELLING NOTE. The routine is a graph of basic blocks (the loc_* labels) that
 * reach one another only by jumps and fall-through -- none is referenced from
 * outside this routine -- so it is one routine, translated as a single function.
 * Because the forward `jp c` dispatch and the backward-free fall-through chain do
 * not nest cleanly, the blocks are driven by a label-dispatch loop: `next` holds
 * the ROM address of the block to run; each block runs its instructions and ends
 * by returning (a `ret`) or by setting `next` to its successor. The loop itself
 * charges NO T-states -- only m.step does, exactly as the counter loop in
 * loc_02ca charges none for its `do/while`. Conditional-branch cycle costs follow
 * the Z80: jr taken 12 / not 7, jp 10 either way, ret cc taken 11 / not 5, call
 * cc taken 17 / not 10. The four bytes at 0x065d-0x0660 are unreachable and are
 * not translated.
 *
 * loc_03e8:
 *   03e8  3a 10 80     ld a,(0x8010)
 *   03eb  a7           and a
 *   03ec  cc 94 48     call z,0x4894
 *   03ef  3a 0b 80     ld a,(0x800b)
 *   03f2  3d           dec a
 *   03f3  32 0b 80     ld (0x800b),a
 *   03f6  20 11        jr nz,0x0409
 *   03f8  3e 1e        ld a,0x1e
 *   03fa  32 0b 80     ld (0x800b),a
 *   03fd  3a 7c 80     ld a,(0x807c)
 *   0400  a7           and a
 *   0401  c0           ret nz
 *   0402  3a 7b 80     ld a,(0x807b)
 *   0405  a7           and a
 *   0406  cc c4 48     call z,0x48c4
 * loc_0409:
 *   0409  3a 79 80     ld a,(0x8079)
 *   040c  a7           and a
 *   040d  c8           ret z
 *   040e  3a 68 80     ld a,(0x8068)
 *   0411  c6 03        add a,0x03
 *   0413  47           ld b,a
 *   0414  3a 6b 80     ld a,(0x806b)
 *   0417  c6 05        add a,0x05
 *   0419  4f           ld c,a
 *   041a  3a 0c 80     ld a,(0x800c)
 *   041d  fe 07        cp 0x07
 *   041f  38 17        jr c,0x0438
 *   0421  fe 0a        cp 0x0a
 *   0423  da ee 04     jp c,0x04ee
 *   0426  fe 0e        cp 0x0e
 *   0428  da 1d 05     jp c,0x051d
 *   042b  fe 17        cp 0x17
 *   042d  da 5a 05     jp c,0x055a
 *   0430  fe 1e        cp 0x1e
 *   0432  da dd 05     jp c,0x05dd
 *   0435  c3 40 06     jp 0x0640
 * loc_0438:
 *   0438  3e 30        ld a,0x30
 *   043a  b8           cp b
 *   043b  20 09        jr nz,0x0446
 *   043d  3e 37        ld a,0x37
 *   043f  b9           cp c
 *   0440  d2 69 06     jp nc,0x0669
 *   0443  c3 65 06     jp 0x0665
 * loc_0446:
 *   0446  3e 38        ld a,0x38
 *   0448  b9           cp c
 *   0449  20 09        jr nz,0x0454
 *   044b  3e 57        ld a,0x57
 *   044d  b8           cp b
 *   044e  d2 65 06     jp nc,0x0665
 *   0451  c3 69 06     jp 0x0669
 * loc_0454:
 *   0454  3e 58        ld a,0x58
 *   0456  b8           cp b
 *   0457  20 09        jr nz,0x0462
 *   0459  3e 3f        ld a,0x3f
 *   045b  b9           cp c
 *   045c  d2 69 06     jp nc,0x0669
 *   045f  c3 65 06     jp 0x0665
 * loc_0462:
 *   0462  3e 40        ld a,0x40
 *   0464  b9           cp c
 *   0465  20 09        jr nz,0x0470
 *   0467  3e 67        ld a,0x67
 *   0469  b8           cp b
 *   046a  d2 65 06     jp nc,0x0665
 *   046d  c3 69 06     jp 0x0669
 * loc_0470:
 *   0470  3e 68        ld a,0x68
 *   0472  b8           cp b
 *   0473  20 09        jr nz,0x047e
 *   0475  3e 53        ld a,0x53
 *   0477  b9           cp c
 *   0478  d2 69 06     jp nc,0x0669
 *   047b  c3 65 06     jp 0x0665
 * loc_047e:
 *   047e  3e 54        ld a,0x54
 *   0480  b9           cp c
 *   0481  20 09        jr nz,0x048c
 *   0483  3e 8f        ld a,0x8f
 *   0485  b8           cp b
 *   0486  d2 65 06     jp nc,0x0665
 *   0489  c3 69 06     jp 0x0669
 * loc_048c:
 *   048c  3e 90        ld a,0x90
 *   048e  b8           cp b
 *   048f  20 09        jr nz,0x049a
 *   0491  3e 7f        ld a,0x7f
 *   0493  b9           cp c
 *   0494  d2 69 06     jp nc,0x0669
 *   0497  c3 65 06     jp 0x0665
 * loc_049a:
 *   049a  3e 80        ld a,0x80
 *   049c  b9           cp c
 *   049d  20 09        jr nz,0x04a8
 *   049f  3e bf        ld a,0xbf
 *   04a1  b8           cp b
 *   04a2  d2 65 06     jp nc,0x0665
 *   04a5  c3 69 06     jp 0x0669
 * loc_04a8:
 *   04a8  3e c0        ld a,0xc0
 *   04aa  b8           cp b
 *   04ab  20 09        jr nz,0x04b6
 *   04ad  3e 9f        ld a,0x9f
 *   04af  b9           cp c
 *   04b0  d2 69 06     jp nc,0x0669
 *   04b3  c3 65 06     jp 0x0665
 * loc_04b6:
 *   04b6  3e a0        ld a,0xa0
 *   04b8  b9           cp c
 *   04b9  20 09        jr nz,0x04c4
 *   04bb  3e c7        ld a,0xc7
 *   04bd  b8           cp b
 *   04be  d2 65 06     jp nc,0x0665
 *   04c1  c3 69 06     jp 0x0669
 * loc_04c4:
 *   04c4  3e c8        ld a,0xc8
 *   04c6  b8           cp b
 *   04c7  20 09        jr nz,0x04d2
 *   04c9  3e bf        ld a,0xbf
 *   04cb  b9           cp c
 *   04cc  d2 69 06     jp nc,0x0669
 *   04cf  c3 65 06     jp 0x0665
 * loc_04d2:
 *   04d2  3e c0        ld a,0xc0
 *   04d4  b9           cp c
 *   04d5  20 09        jr nz,0x04e0
 *   04d7  3e df        ld a,0xdf
 *   04d9  b8           cp b
 *   04da  d2 65 06     jp nc,0x0665
 *   04dd  c3 69 06     jp 0x0669
 * loc_04e0:
 *   04e0  3e e0        ld a,0xe0
 *   04e2  b8           cp b
 *   04e3  20 09        jr nz,0x04ee
 *   04e5  3e d7        ld a,0xd7
 *   04e7  b9           cp c
 *   04e8  d2 69 06     jp nc,0x0669
 *   04eb  c3 61 06     jp 0x0661
 * loc_04ee:
 *   04ee  3e 07        ld a,0x07
 *   04f0  32 0c 80     ld (0x800c),a
 *   04f3  3e d8        ld a,0xd8
 *   04f5  b9           cp c
 *   04f6  20 09        jr nz,0x0501
 *   04f8  3e b0        ld a,0xb0
 *   04fa  b8           cp b
 *   04fb  da 61 06     jp c,0x0661
 *   04fe  c3 69 06     jp 0x0669
 * loc_0501:
 *   0501  3e b0        ld a,0xb0
 *   0503  b8           cp b
 *   0504  20 09        jr nz,0x050f
 *   0506  3e e7        ld a,0xe7
 *   0508  b9           cp c
 *   0509  d2 69 06     jp nc,0x0669
 *   050c  c3 61 06     jp 0x0661
 * loc_050f:
 *   050f  3e e8        ld a,0xe8
 *   0511  b9           cp c
 *   0512  20 09        jr nz,0x051d
 *   0514  3e a8        ld a,0xa8
 *   0516  b8           cp b
 *   0517  da 61 06     jp c,0x0661
 *   051a  c3 6d 06     jp 0x066d
 * loc_051d:
 *   051d  3e 0a        ld a,0x0a
 *   051f  32 0c 80     ld (0x800c),a
 *   0522  3e a8        ld a,0xa8
 *   0524  b8           cp b
 *   0525  20 09        jr nz,0x0530
 *   0527  3e d8        ld a,0xd8
 *   0529  b9           cp c
 *   052a  da 6d 06     jp c,0x066d
 *   052d  c3 61 06     jp 0x0661
 * loc_0530:
 *   0530  3e d8        ld a,0xd8
 *   0532  b9           cp c
 *   0533  20 09        jr nz,0x053e
 *   0535  3e 48        ld a,0x48
 *   0537  b8           cp b
 *   0538  da 61 06     jp c,0x0661
 *   053b  c3 69 06     jp 0x0669
 * loc_053e:
 *   053e  3e 48        ld a,0x48
 *   0540  b8           cp b
 *   0541  20 09        jr nz,0x054c
 *   0543  3e df        ld a,0xdf
 *   0545  b9           cp c
 *   0546  d2 69 06     jp nc,0x0669
 *   0549  c3 61 06     jp 0x0661
 * loc_054c:
 *   054c  3e e0        ld a,0xe0
 *   054e  b9           cp c
 *   054f  20 09        jr nz,0x055a
 *   0551  3e 18        ld a,0x18
 *   0553  b8           cp b
 *   0554  da 61 06     jp c,0x0661
 *   0557  c3 6d 06     jp 0x066d
 * loc_055a:
 *   055a  3e 0e        ld a,0x0e
 *   055c  32 0c 80     ld (0x800c),a
 *   055f  3e 18        ld a,0x18
 *   0561  b8           cp b
 *   0562  20 09        jr nz,0x056d
 *   0564  3e c0        ld a,0xc0
 *   0566  b9           cp c
 *   0567  da 6d 06     jp c,0x066d
 *   056a  c3 65 06     jp 0x0665
 * loc_056d:
 *   056d  3e c0        ld a,0xc0
 *   056f  b9           cp c
 *   0570  20 09        jr nz,0x057b
 *   0572  3e 2f        ld a,0x2f
 *   0574  b8           cp b
 *   0575  d2 65 06     jp nc,0x0665
 *   0578  c3 6d 06     jp 0x066d
 * loc_057b:
 *   057b  3e 30        ld a,0x30
 *   057d  b8           cp b
 *   057e  20 09        jr nz,0x0589
 *   0580  3e a8        ld a,0xa8
 *   0582  b9           cp c
 *   0583  da 6d 06     jp c,0x066d
 *   0586  c3 65 06     jp 0x0665
 * loc_0589:
 *   0589  3e a8        ld a,0xa8
 *   058b  b9           cp c
 *   058c  20 09        jr nz,0x0597
 *   058e  3e 47        ld a,0x47
 *   0590  b8           cp b
 *   0591  d2 65 06     jp nc,0x0665
 *   0594  c3 6d 06     jp 0x066d
 * loc_0597:
 *   0597  3e 48        ld a,0x48
 *   0599  b8           cp b
 *   059a  20 09        jr nz,0x05a5
 *   059c  3e a0        ld a,0xa0
 *   059e  b9           cp c
 *   059f  da 6d 06     jp c,0x066d
 *   05a2  c3 65 06     jp 0x0665
 * loc_05a5:
 *   05a5  3e a0        ld a,0xa0
 *   05a7  b9           cp c
 *   05a8  20 09        jr nz,0x05b3
 *   05aa  3e 57        ld a,0x57
 *   05ac  b8           cp b
 *   05ad  d2 65 06     jp nc,0x0665
 *   05b0  c3 6d 06     jp 0x066d
 * loc_05b3:
 *   05b3  3e 58        ld a,0x58
 *   05b5  b8           cp b
 *   05b6  20 09        jr nz,0x05c1
 *   05b8  3e 80        ld a,0x80
 *   05ba  b9           cp c
 *   05bb  da 6d 06     jp c,0x066d
 *   05be  c3 65 06     jp 0x0665
 * loc_05c1:
 *   05c1  3e 80        ld a,0x80
 *   05c3  b9           cp c
 *   05c4  20 09        jr nz,0x05cf
 *   05c6  3e 5f        ld a,0x5f
 *   05c8  b8           cp b
 *   05c9  d2 65 06     jp nc,0x0665
 *   05cc  c3 6d 06     jp 0x066d
 * loc_05cf:
 *   05cf  3e 60        ld a,0x60
 *   05d1  b8           cp b
 *   05d2  20 09        jr nz,0x05dd
 *   05d4  3e 6c        ld a,0x6c
 *   05d6  b9           cp c
 *   05d7  da 6d 06     jp c,0x066d
 *   05da  c3 61 06     jp 0x0661
 * loc_05dd:
 *   05dd  3e 17        ld a,0x17
 *   05df  32 0c 80     ld (0x800c),a
 *   05e2  3e 6c        ld a,0x6c
 *   05e4  b9           cp c
 *   05e5  20 09        jr nz,0x05f0
 *   05e7  3e 58        ld a,0x58
 *   05e9  b8           cp b
 *   05ea  da 61 06     jp c,0x0661
 *   05ed  c3 6d 06     jp 0x066d
 * loc_05f0:
 *   05f0  3e 58        ld a,0x58
 *   05f2  b8           cp b
 *   05f3  20 09        jr nz,0x05fe
 *   05f5  3e 5c        ld a,0x5c
 *   05f7  b9           cp c
 *   05f8  da 6d 06     jp c,0x066d
 *   05fb  c3 61 06     jp 0x0661
 * loc_05fe:
 *   05fe  3e 5c        ld a,0x5c
 *   0600  b9           cp c
 *   0601  20 09        jr nz,0x060c
 *   0603  3e 50        ld a,0x50
 *   0605  b8           cp b
 *   0606  da 61 06     jp c,0x0661
 *   0609  c3 6d 06     jp 0x066d
 * loc_060c:
 *   060c  3e 50        ld a,0x50
 *   060e  b8           cp b
 *   060f  20 09        jr nz,0x061a
 *   0611  3e 58        ld a,0x58
 *   0613  b9           cp c
 *   0614  da 6d 06     jp c,0x066d
 *   0617  c3 61 06     jp 0x0661
 * loc_061a:
 *   061a  3e 58        ld a,0x58
 *   061c  b9           cp c
 *   061d  20 09        jr nz,0x0628
 *   061f  3e 28        ld a,0x28
 *   0621  b8           cp b
 *   0622  da 61 06     jp c,0x0661
 *   0625  c3 6d 06     jp 0x066d
 * loc_0628:
 *   0628  3e 28        ld a,0x28
 *   062a  b8           cp b
 *   062b  20 07        jr nz,0x0634
 *   062d  3e 48        ld a,0x48
 *   062f  b9           cp c
 *   0630  38 3b        jr c,0x066d
 *   0632  18 2d        jr 0x0661
 * loc_0634:
 *   0634  3e 48        ld a,0x48
 *   0636  b9           cp c
 *   0637  20 07        jr nz,0x0640
 *   0639  3e 18        ld a,0x18
 *   063b  b8           cp b
 *   063c  38 23        jr c,0x0661
 *   063e  18 2d        jr 0x066d
 * loc_0640:
 *   0640  3e 1e        ld a,0x1e
 *   0642  32 0c 80     ld (0x800c),a
 *   0645  3e 18        ld a,0x18
 *   0647  b8           cp b
 *   0648  20 07        jr nz,0x0651
 *   064a  3e 38        ld a,0x38
 *   064c  b9           cp c
 *   064d  38 1e        jr c,0x066d
 *   064f  18 14        jr 0x0665
 * loc_0651:
 *   0651  3e 38        ld a,0x38
 *   0653  b9           cp c
 *   0654  20 05        jr nz,0x065b
 *   0656  3e 2f        ld a,0x2f
 *   0658  b8           cp b
 *   0659  30 0a        jr nc,0x0665
 * loc_065b:
 *   065b  18 10        jr 0x066d
 *   ==== UNREACHED 0x065d-0x0660 (4 bytes) ====
 *   065d:  defb 0x3e,0x00,0x18,0x0e
 * loc_0661:
 *   0661  3e 01        ld a,0x01
 *   0663  18 0a        jr 0x066f
 * loc_0665:
 *   0665  3e 02        ld a,0x02
 *   0667  18 06        jr 0x066f
 * loc_0669:
 *   0669  3e 04        ld a,0x04
 *   066b  18 02        jr 0x066f
 * loc_066d:
 *   066d  3e 08        ld a,0x08
 * loc_066f:
 *   066f  32 1b 80     ld (0x801b),a
 *   0672  c9           ret
 */
export function loc_03e8(m) {
  const { regs, mem } = m;

  // Label-dispatch loop over the routine's basic blocks (see header). `next` is
  // the ROM address of the block to run; a block returns (ret) or sets `next`.
  let next = 0x03e8;
  for (;;) {
    switch (next) {
      case 0x03e8: {
        regs.a = mem.read8(0x8010); m.step(0x03eb, 13); // 03e8  ld a,(0x8010)
        regs.and(regs.a); m.step(0x03ec, 4); // 03eb  and a
        if (regs.fZ) { m.push16(0x03ef); m.step(0x4894, 17); m.call(0x4894); } // 03ec  call z,0x4894 (taken)
        else { m.step(0x03ef, 10); } // 03ec  call z,0x4894 (not taken)
        regs.a = mem.read8(0x800b); m.step(0x03f2, 13); // 03ef  ld a,(0x800b)
        regs.a = regs.dec8(regs.a); m.step(0x03f3, 4); // 03f2  dec a
        mem.write8(0x800b, regs.a); m.step(0x03f6, 13); // 03f3  ld (0x800b),a
        if (regs.fNZ) { m.step(0x0409, 12); next = 0x0409; break; } // 03f6  jr nz,0x0409 (taken)
        m.step(0x03f8, 7); // 03f6  jr nz,0x0409 (not taken)
        regs.a = 0x1e; m.step(0x03fa, 7); // 03f8  ld a,0x1e
        mem.write8(0x800b, regs.a); m.step(0x03fd, 13); // 03fa  ld (0x800b),a
        regs.a = mem.read8(0x807c); m.step(0x0400, 13); // 03fd  ld a,(0x807c)
        regs.and(regs.a); m.step(0x0401, 4); // 0400  and a
        if (regs.fNZ) { m.ret(11); return; } // 0401  ret nz (taken)
        m.step(0x0402, 5); // 0401  ret nz (not taken)
        regs.a = mem.read8(0x807b); m.step(0x0405, 13); // 0402  ld a,(0x807b)
        regs.and(regs.a); m.step(0x0406, 4); // 0405  and a
        if (regs.fZ) { m.push16(0x0409); m.step(0x48c4, 17); m.call(0x48c4); } // 0406  call z,0x48c4 (taken)
        else { m.step(0x0409, 10); } // 0406  call z,0x48c4 (not taken)
        next = 0x0409; break;
      }
      case 0x0409: {
        regs.a = mem.read8(0x8079); m.step(0x040c, 13); // 0409  ld a,(0x8079)
        regs.and(regs.a); m.step(0x040d, 4); // 040c  and a
        if (regs.fZ) { m.ret(11); return; } // 040d  ret z (taken)
        m.step(0x040e, 5); // 040d  ret z (not taken)
        regs.a = mem.read8(0x8068); m.step(0x0411, 13); // 040e  ld a,(0x8068)
        regs.add(0x03); m.step(0x0413, 7); // 0411  add a,0x03
        regs.b = regs.a; m.step(0x0414, 4); // 0413  ld b,a
        regs.a = mem.read8(0x806b); m.step(0x0417, 13); // 0414  ld a,(0x806b)
        regs.add(0x05); m.step(0x0419, 7); // 0417  add a,0x05
        regs.c = regs.a; m.step(0x041a, 4); // 0419  ld c,a
        regs.a = mem.read8(0x800c); m.step(0x041d, 13); // 041a  ld a,(0x800c)
        regs.cp(0x07); m.step(0x041f, 7); // 041d  cp 0x07
        if (regs.fC) { m.step(0x0438, 12); next = 0x0438; break; } // 041f  jr c,0x0438 (taken)
        m.step(0x0421, 7); // 041f  jr c,0x0438 (not taken)
        regs.cp(0x0a); m.step(0x0423, 7); // 0421  cp 0x0a
        if (regs.fC) { m.step(0x04ee, 10); next = 0x04ee; break; } // 0423  jp c,0x04ee (taken)
        m.step(0x0426, 10); // 0423  jp c,0x04ee (not taken)
        regs.cp(0x0e); m.step(0x0428, 7); // 0426  cp 0x0e
        if (regs.fC) { m.step(0x051d, 10); next = 0x051d; break; } // 0428  jp c,0x051d (taken)
        m.step(0x042b, 10); // 0428  jp c,0x051d (not taken)
        regs.cp(0x17); m.step(0x042d, 7); // 042b  cp 0x17
        if (regs.fC) { m.step(0x055a, 10); next = 0x055a; break; } // 042d  jp c,0x055a (taken)
        m.step(0x0430, 10); // 042d  jp c,0x055a (not taken)
        regs.cp(0x1e); m.step(0x0432, 7); // 0430  cp 0x1e
        if (regs.fC) { m.step(0x05dd, 10); next = 0x05dd; break; } // 0432  jp c,0x05dd (taken)
        m.step(0x0435, 10); // 0432  jp c,0x05dd (not taken)
        m.step(0x0640, 10); next = 0x0640; break; // 0435  jp 0x0640
      }
      case 0x0438: {
        regs.a = 0x30; m.step(0x043a, 7); // 0438  ld a,0x30
        regs.cp(regs.b); m.step(0x043b, 4); // 043a  cp b
        if (regs.fNZ) { m.step(0x0446, 12); next = 0x0446; break; } // 043b  jr nz,0x0446 (taken)
        m.step(0x043d, 7); // 043b  jr nz,0x0446 (not taken)
        regs.a = 0x37; m.step(0x043f, 7); // 043d  ld a,0x37
        regs.cp(regs.c); m.step(0x0440, 4); // 043f  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 0440  jp nc,0x0669 (taken)
        m.step(0x0443, 10); // 0440  jp nc,0x0669 (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 0443  jp 0x0665
      }
      case 0x0446: {
        regs.a = 0x38; m.step(0x0448, 7); // 0446  ld a,0x38
        regs.cp(regs.c); m.step(0x0449, 4); // 0448  cp c
        if (regs.fNZ) { m.step(0x0454, 12); next = 0x0454; break; } // 0449  jr nz,0x0454 (taken)
        m.step(0x044b, 7); // 0449  jr nz,0x0454 (not taken)
        regs.a = 0x57; m.step(0x044d, 7); // 044b  ld a,0x57
        regs.cp(regs.b); m.step(0x044e, 4); // 044d  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 044e  jp nc,0x0665 (taken)
        m.step(0x0451, 10); // 044e  jp nc,0x0665 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 0451  jp 0x0669
      }
      case 0x0454: {
        regs.a = 0x58; m.step(0x0456, 7); // 0454  ld a,0x58
        regs.cp(regs.b); m.step(0x0457, 4); // 0456  cp b
        if (regs.fNZ) { m.step(0x0462, 12); next = 0x0462; break; } // 0457  jr nz,0x0462 (taken)
        m.step(0x0459, 7); // 0457  jr nz,0x0462 (not taken)
        regs.a = 0x3f; m.step(0x045b, 7); // 0459  ld a,0x3f
        regs.cp(regs.c); m.step(0x045c, 4); // 045b  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 045c  jp nc,0x0669 (taken)
        m.step(0x045f, 10); // 045c  jp nc,0x0669 (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 045f  jp 0x0665
      }
      case 0x0462: {
        regs.a = 0x40; m.step(0x0464, 7); // 0462  ld a,0x40
        regs.cp(regs.c); m.step(0x0465, 4); // 0464  cp c
        if (regs.fNZ) { m.step(0x0470, 12); next = 0x0470; break; } // 0465  jr nz,0x0470 (taken)
        m.step(0x0467, 7); // 0465  jr nz,0x0470 (not taken)
        regs.a = 0x67; m.step(0x0469, 7); // 0467  ld a,0x67
        regs.cp(regs.b); m.step(0x046a, 4); // 0469  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 046a  jp nc,0x0665 (taken)
        m.step(0x046d, 10); // 046a  jp nc,0x0665 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 046d  jp 0x0669
      }
      case 0x0470: {
        regs.a = 0x68; m.step(0x0472, 7); // 0470  ld a,0x68
        regs.cp(regs.b); m.step(0x0473, 4); // 0472  cp b
        if (regs.fNZ) { m.step(0x047e, 12); next = 0x047e; break; } // 0473  jr nz,0x047e (taken)
        m.step(0x0475, 7); // 0473  jr nz,0x047e (not taken)
        regs.a = 0x53; m.step(0x0477, 7); // 0475  ld a,0x53
        regs.cp(regs.c); m.step(0x0478, 4); // 0477  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 0478  jp nc,0x0669 (taken)
        m.step(0x047b, 10); // 0478  jp nc,0x0669 (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 047b  jp 0x0665
      }
      case 0x047e: {
        regs.a = 0x54; m.step(0x0480, 7); // 047e  ld a,0x54
        regs.cp(regs.c); m.step(0x0481, 4); // 0480  cp c
        if (regs.fNZ) { m.step(0x048c, 12); next = 0x048c; break; } // 0481  jr nz,0x048c (taken)
        m.step(0x0483, 7); // 0481  jr nz,0x048c (not taken)
        regs.a = 0x8f; m.step(0x0485, 7); // 0483  ld a,0x8f
        regs.cp(regs.b); m.step(0x0486, 4); // 0485  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 0486  jp nc,0x0665 (taken)
        m.step(0x0489, 10); // 0486  jp nc,0x0665 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 0489  jp 0x0669
      }
      case 0x048c: {
        regs.a = 0x90; m.step(0x048e, 7); // 048c  ld a,0x90
        regs.cp(regs.b); m.step(0x048f, 4); // 048e  cp b
        if (regs.fNZ) { m.step(0x049a, 12); next = 0x049a; break; } // 048f  jr nz,0x049a (taken)
        m.step(0x0491, 7); // 048f  jr nz,0x049a (not taken)
        regs.a = 0x7f; m.step(0x0493, 7); // 0491  ld a,0x7f
        regs.cp(regs.c); m.step(0x0494, 4); // 0493  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 0494  jp nc,0x0669 (taken)
        m.step(0x0497, 10); // 0494  jp nc,0x0669 (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 0497  jp 0x0665
      }
      case 0x049a: {
        regs.a = 0x80; m.step(0x049c, 7); // 049a  ld a,0x80
        regs.cp(regs.c); m.step(0x049d, 4); // 049c  cp c
        if (regs.fNZ) { m.step(0x04a8, 12); next = 0x04a8; break; } // 049d  jr nz,0x04a8 (taken)
        m.step(0x049f, 7); // 049d  jr nz,0x04a8 (not taken)
        regs.a = 0xbf; m.step(0x04a1, 7); // 049f  ld a,0xbf
        regs.cp(regs.b); m.step(0x04a2, 4); // 04a1  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 04a2  jp nc,0x0665 (taken)
        m.step(0x04a5, 10); // 04a2  jp nc,0x0665 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 04a5  jp 0x0669
      }
      case 0x04a8: {
        regs.a = 0xc0; m.step(0x04aa, 7); // 04a8  ld a,0xc0
        regs.cp(regs.b); m.step(0x04ab, 4); // 04aa  cp b
        if (regs.fNZ) { m.step(0x04b6, 12); next = 0x04b6; break; } // 04ab  jr nz,0x04b6 (taken)
        m.step(0x04ad, 7); // 04ab  jr nz,0x04b6 (not taken)
        regs.a = 0x9f; m.step(0x04af, 7); // 04ad  ld a,0x9f
        regs.cp(regs.c); m.step(0x04b0, 4); // 04af  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 04b0  jp nc,0x0669 (taken)
        m.step(0x04b3, 10); // 04b0  jp nc,0x0669 (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 04b3  jp 0x0665
      }
      case 0x04b6: {
        regs.a = 0xa0; m.step(0x04b8, 7); // 04b6  ld a,0xa0
        regs.cp(regs.c); m.step(0x04b9, 4); // 04b8  cp c
        if (regs.fNZ) { m.step(0x04c4, 12); next = 0x04c4; break; } // 04b9  jr nz,0x04c4 (taken)
        m.step(0x04bb, 7); // 04b9  jr nz,0x04c4 (not taken)
        regs.a = 0xc7; m.step(0x04bd, 7); // 04bb  ld a,0xc7
        regs.cp(regs.b); m.step(0x04be, 4); // 04bd  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 04be  jp nc,0x0665 (taken)
        m.step(0x04c1, 10); // 04be  jp nc,0x0665 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 04c1  jp 0x0669
      }
      case 0x04c4: {
        regs.a = 0xc8; m.step(0x04c6, 7); // 04c4  ld a,0xc8
        regs.cp(regs.b); m.step(0x04c7, 4); // 04c6  cp b
        if (regs.fNZ) { m.step(0x04d2, 12); next = 0x04d2; break; } // 04c7  jr nz,0x04d2 (taken)
        m.step(0x04c9, 7); // 04c7  jr nz,0x04d2 (not taken)
        regs.a = 0xbf; m.step(0x04cb, 7); // 04c9  ld a,0xbf
        regs.cp(regs.c); m.step(0x04cc, 4); // 04cb  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 04cc  jp nc,0x0669 (taken)
        m.step(0x04cf, 10); // 04cc  jp nc,0x0669 (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 04cf  jp 0x0665
      }
      case 0x04d2: {
        regs.a = 0xc0; m.step(0x04d4, 7); // 04d2  ld a,0xc0
        regs.cp(regs.c); m.step(0x04d5, 4); // 04d4  cp c
        if (regs.fNZ) { m.step(0x04e0, 12); next = 0x04e0; break; } // 04d5  jr nz,0x04e0 (taken)
        m.step(0x04d7, 7); // 04d5  jr nz,0x04e0 (not taken)
        regs.a = 0xdf; m.step(0x04d9, 7); // 04d7  ld a,0xdf
        regs.cp(regs.b); m.step(0x04da, 4); // 04d9  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 04da  jp nc,0x0665 (taken)
        m.step(0x04dd, 10); // 04da  jp nc,0x0665 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 04dd  jp 0x0669
      }
      case 0x04e0: {
        regs.a = 0xe0; m.step(0x04e2, 7); // 04e0  ld a,0xe0
        regs.cp(regs.b); m.step(0x04e3, 4); // 04e2  cp b
        if (regs.fNZ) { m.step(0x04ee, 12); next = 0x04ee; break; } // 04e3  jr nz,0x04ee (taken)
        m.step(0x04e5, 7); // 04e3  jr nz,0x04ee (not taken)
        regs.a = 0xd7; m.step(0x04e7, 7); // 04e5  ld a,0xd7
        regs.cp(regs.c); m.step(0x04e8, 4); // 04e7  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 04e8  jp nc,0x0669 (taken)
        m.step(0x04eb, 10); // 04e8  jp nc,0x0669 (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 04eb  jp 0x0661
      }
      case 0x04ee: {
        regs.a = 0x07; m.step(0x04f0, 7); // 04ee  ld a,0x07
        mem.write8(0x800c, regs.a); m.step(0x04f3, 13); // 04f0  ld (0x800c),a
        regs.a = 0xd8; m.step(0x04f5, 7); // 04f3  ld a,0xd8
        regs.cp(regs.c); m.step(0x04f6, 4); // 04f5  cp c
        if (regs.fNZ) { m.step(0x0501, 12); next = 0x0501; break; } // 04f6  jr nz,0x0501 (taken)
        m.step(0x04f8, 7); // 04f6  jr nz,0x0501 (not taken)
        regs.a = 0xb0; m.step(0x04fa, 7); // 04f8  ld a,0xb0
        regs.cp(regs.b); m.step(0x04fb, 4); // 04fa  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 04fb  jp c,0x0661 (taken)
        m.step(0x04fe, 10); // 04fb  jp c,0x0661 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 04fe  jp 0x0669
      }
      case 0x0501: {
        regs.a = 0xb0; m.step(0x0503, 7); // 0501  ld a,0xb0
        regs.cp(regs.b); m.step(0x0504, 4); // 0503  cp b
        if (regs.fNZ) { m.step(0x050f, 12); next = 0x050f; break; } // 0504  jr nz,0x050f (taken)
        m.step(0x0506, 7); // 0504  jr nz,0x050f (not taken)
        regs.a = 0xe7; m.step(0x0508, 7); // 0506  ld a,0xe7
        regs.cp(regs.c); m.step(0x0509, 4); // 0508  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 0509  jp nc,0x0669 (taken)
        m.step(0x050c, 10); // 0509  jp nc,0x0669 (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 050c  jp 0x0661
      }
      case 0x050f: {
        regs.a = 0xe8; m.step(0x0511, 7); // 050f  ld a,0xe8
        regs.cp(regs.c); m.step(0x0512, 4); // 0511  cp c
        if (regs.fNZ) { m.step(0x051d, 12); next = 0x051d; break; } // 0512  jr nz,0x051d (taken)
        m.step(0x0514, 7); // 0512  jr nz,0x051d (not taken)
        regs.a = 0xa8; m.step(0x0516, 7); // 0514  ld a,0xa8
        regs.cp(regs.b); m.step(0x0517, 4); // 0516  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 0517  jp c,0x0661 (taken)
        m.step(0x051a, 10); // 0517  jp c,0x0661 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 051a  jp 0x066d
      }
      case 0x051d: {
        regs.a = 0x0a; m.step(0x051f, 7); // 051d  ld a,0x0a
        mem.write8(0x800c, regs.a); m.step(0x0522, 13); // 051f  ld (0x800c),a
        regs.a = 0xa8; m.step(0x0524, 7); // 0522  ld a,0xa8
        regs.cp(regs.b); m.step(0x0525, 4); // 0524  cp b
        if (regs.fNZ) { m.step(0x0530, 12); next = 0x0530; break; } // 0525  jr nz,0x0530 (taken)
        m.step(0x0527, 7); // 0525  jr nz,0x0530 (not taken)
        regs.a = 0xd8; m.step(0x0529, 7); // 0527  ld a,0xd8
        regs.cp(regs.c); m.step(0x052a, 4); // 0529  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 052a  jp c,0x066d (taken)
        m.step(0x052d, 10); // 052a  jp c,0x066d (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 052d  jp 0x0661
      }
      case 0x0530: {
        regs.a = 0xd8; m.step(0x0532, 7); // 0530  ld a,0xd8
        regs.cp(regs.c); m.step(0x0533, 4); // 0532  cp c
        if (regs.fNZ) { m.step(0x053e, 12); next = 0x053e; break; } // 0533  jr nz,0x053e (taken)
        m.step(0x0535, 7); // 0533  jr nz,0x053e (not taken)
        regs.a = 0x48; m.step(0x0537, 7); // 0535  ld a,0x48
        regs.cp(regs.b); m.step(0x0538, 4); // 0537  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 0538  jp c,0x0661 (taken)
        m.step(0x053b, 10); // 0538  jp c,0x0661 (not taken)
        m.step(0x0669, 10); next = 0x0669; break; // 053b  jp 0x0669
      }
      case 0x053e: {
        regs.a = 0x48; m.step(0x0540, 7); // 053e  ld a,0x48
        regs.cp(regs.b); m.step(0x0541, 4); // 0540  cp b
        if (regs.fNZ) { m.step(0x054c, 12); next = 0x054c; break; } // 0541  jr nz,0x054c (taken)
        m.step(0x0543, 7); // 0541  jr nz,0x054c (not taken)
        regs.a = 0xdf; m.step(0x0545, 7); // 0543  ld a,0xdf
        regs.cp(regs.c); m.step(0x0546, 4); // 0545  cp c
        if (regs.fNC) { m.step(0x0669, 10); next = 0x0669; break; } // 0546  jp nc,0x0669 (taken)
        m.step(0x0549, 10); // 0546  jp nc,0x0669 (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 0549  jp 0x0661
      }
      case 0x054c: {
        regs.a = 0xe0; m.step(0x054e, 7); // 054c  ld a,0xe0
        regs.cp(regs.c); m.step(0x054f, 4); // 054e  cp c
        if (regs.fNZ) { m.step(0x055a, 12); next = 0x055a; break; } // 054f  jr nz,0x055a (taken)
        m.step(0x0551, 7); // 054f  jr nz,0x055a (not taken)
        regs.a = 0x18; m.step(0x0553, 7); // 0551  ld a,0x18
        regs.cp(regs.b); m.step(0x0554, 4); // 0553  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 0554  jp c,0x0661 (taken)
        m.step(0x0557, 10); // 0554  jp c,0x0661 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 0557  jp 0x066d
      }
      case 0x055a: {
        regs.a = 0x0e; m.step(0x055c, 7); // 055a  ld a,0x0e
        mem.write8(0x800c, regs.a); m.step(0x055f, 13); // 055c  ld (0x800c),a
        regs.a = 0x18; m.step(0x0561, 7); // 055f  ld a,0x18
        regs.cp(regs.b); m.step(0x0562, 4); // 0561  cp b
        if (regs.fNZ) { m.step(0x056d, 12); next = 0x056d; break; } // 0562  jr nz,0x056d (taken)
        m.step(0x0564, 7); // 0562  jr nz,0x056d (not taken)
        regs.a = 0xc0; m.step(0x0566, 7); // 0564  ld a,0xc0
        regs.cp(regs.c); m.step(0x0567, 4); // 0566  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 0567  jp c,0x066d (taken)
        m.step(0x056a, 10); // 0567  jp c,0x066d (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 056a  jp 0x0665
      }
      case 0x056d: {
        regs.a = 0xc0; m.step(0x056f, 7); // 056d  ld a,0xc0
        regs.cp(regs.c); m.step(0x0570, 4); // 056f  cp c
        if (regs.fNZ) { m.step(0x057b, 12); next = 0x057b; break; } // 0570  jr nz,0x057b (taken)
        m.step(0x0572, 7); // 0570  jr nz,0x057b (not taken)
        regs.a = 0x2f; m.step(0x0574, 7); // 0572  ld a,0x2f
        regs.cp(regs.b); m.step(0x0575, 4); // 0574  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 0575  jp nc,0x0665 (taken)
        m.step(0x0578, 10); // 0575  jp nc,0x0665 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 0578  jp 0x066d
      }
      case 0x057b: {
        regs.a = 0x30; m.step(0x057d, 7); // 057b  ld a,0x30
        regs.cp(regs.b); m.step(0x057e, 4); // 057d  cp b
        if (regs.fNZ) { m.step(0x0589, 12); next = 0x0589; break; } // 057e  jr nz,0x0589 (taken)
        m.step(0x0580, 7); // 057e  jr nz,0x0589 (not taken)
        regs.a = 0xa8; m.step(0x0582, 7); // 0580  ld a,0xa8
        regs.cp(regs.c); m.step(0x0583, 4); // 0582  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 0583  jp c,0x066d (taken)
        m.step(0x0586, 10); // 0583  jp c,0x066d (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 0586  jp 0x0665
      }
      case 0x0589: {
        regs.a = 0xa8; m.step(0x058b, 7); // 0589  ld a,0xa8
        regs.cp(regs.c); m.step(0x058c, 4); // 058b  cp c
        if (regs.fNZ) { m.step(0x0597, 12); next = 0x0597; break; } // 058c  jr nz,0x0597 (taken)
        m.step(0x058e, 7); // 058c  jr nz,0x0597 (not taken)
        regs.a = 0x47; m.step(0x0590, 7); // 058e  ld a,0x47
        regs.cp(regs.b); m.step(0x0591, 4); // 0590  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 0591  jp nc,0x0665 (taken)
        m.step(0x0594, 10); // 0591  jp nc,0x0665 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 0594  jp 0x066d
      }
      case 0x0597: {
        regs.a = 0x48; m.step(0x0599, 7); // 0597  ld a,0x48
        regs.cp(regs.b); m.step(0x059a, 4); // 0599  cp b
        if (regs.fNZ) { m.step(0x05a5, 12); next = 0x05a5; break; } // 059a  jr nz,0x05a5 (taken)
        m.step(0x059c, 7); // 059a  jr nz,0x05a5 (not taken)
        regs.a = 0xa0; m.step(0x059e, 7); // 059c  ld a,0xa0
        regs.cp(regs.c); m.step(0x059f, 4); // 059e  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 059f  jp c,0x066d (taken)
        m.step(0x05a2, 10); // 059f  jp c,0x066d (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 05a2  jp 0x0665
      }
      case 0x05a5: {
        regs.a = 0xa0; m.step(0x05a7, 7); // 05a5  ld a,0xa0
        regs.cp(regs.c); m.step(0x05a8, 4); // 05a7  cp c
        if (regs.fNZ) { m.step(0x05b3, 12); next = 0x05b3; break; } // 05a8  jr nz,0x05b3 (taken)
        m.step(0x05aa, 7); // 05a8  jr nz,0x05b3 (not taken)
        regs.a = 0x57; m.step(0x05ac, 7); // 05aa  ld a,0x57
        regs.cp(regs.b); m.step(0x05ad, 4); // 05ac  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 05ad  jp nc,0x0665 (taken)
        m.step(0x05b0, 10); // 05ad  jp nc,0x0665 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 05b0  jp 0x066d
      }
      case 0x05b3: {
        regs.a = 0x58; m.step(0x05b5, 7); // 05b3  ld a,0x58
        regs.cp(regs.b); m.step(0x05b6, 4); // 05b5  cp b
        if (regs.fNZ) { m.step(0x05c1, 12); next = 0x05c1; break; } // 05b6  jr nz,0x05c1 (taken)
        m.step(0x05b8, 7); // 05b6  jr nz,0x05c1 (not taken)
        regs.a = 0x80; m.step(0x05ba, 7); // 05b8  ld a,0x80
        regs.cp(regs.c); m.step(0x05bb, 4); // 05ba  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 05bb  jp c,0x066d (taken)
        m.step(0x05be, 10); // 05bb  jp c,0x066d (not taken)
        m.step(0x0665, 10); next = 0x0665; break; // 05be  jp 0x0665
      }
      case 0x05c1: {
        regs.a = 0x80; m.step(0x05c3, 7); // 05c1  ld a,0x80
        regs.cp(regs.c); m.step(0x05c4, 4); // 05c3  cp c
        if (regs.fNZ) { m.step(0x05cf, 12); next = 0x05cf; break; } // 05c4  jr nz,0x05cf (taken)
        m.step(0x05c6, 7); // 05c4  jr nz,0x05cf (not taken)
        regs.a = 0x5f; m.step(0x05c8, 7); // 05c6  ld a,0x5f
        regs.cp(regs.b); m.step(0x05c9, 4); // 05c8  cp b
        if (regs.fNC) { m.step(0x0665, 10); next = 0x0665; break; } // 05c9  jp nc,0x0665 (taken)
        m.step(0x05cc, 10); // 05c9  jp nc,0x0665 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 05cc  jp 0x066d
      }
      case 0x05cf: {
        regs.a = 0x60; m.step(0x05d1, 7); // 05cf  ld a,0x60
        regs.cp(regs.b); m.step(0x05d2, 4); // 05d1  cp b
        if (regs.fNZ) { m.step(0x05dd, 12); next = 0x05dd; break; } // 05d2  jr nz,0x05dd (taken)
        m.step(0x05d4, 7); // 05d2  jr nz,0x05dd (not taken)
        regs.a = 0x6c; m.step(0x05d6, 7); // 05d4  ld a,0x6c
        regs.cp(regs.c); m.step(0x05d7, 4); // 05d6  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 05d7  jp c,0x066d (taken)
        m.step(0x05da, 10); // 05d7  jp c,0x066d (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 05da  jp 0x0661
      }
      case 0x05dd: {
        regs.a = 0x17; m.step(0x05df, 7); // 05dd  ld a,0x17
        mem.write8(0x800c, regs.a); m.step(0x05e2, 13); // 05df  ld (0x800c),a
        regs.a = 0x6c; m.step(0x05e4, 7); // 05e2  ld a,0x6c
        regs.cp(regs.c); m.step(0x05e5, 4); // 05e4  cp c
        if (regs.fNZ) { m.step(0x05f0, 12); next = 0x05f0; break; } // 05e5  jr nz,0x05f0 (taken)
        m.step(0x05e7, 7); // 05e5  jr nz,0x05f0 (not taken)
        regs.a = 0x58; m.step(0x05e9, 7); // 05e7  ld a,0x58
        regs.cp(regs.b); m.step(0x05ea, 4); // 05e9  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 05ea  jp c,0x0661 (taken)
        m.step(0x05ed, 10); // 05ea  jp c,0x0661 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 05ed  jp 0x066d
      }
      case 0x05f0: {
        regs.a = 0x58; m.step(0x05f2, 7); // 05f0  ld a,0x58
        regs.cp(regs.b); m.step(0x05f3, 4); // 05f2  cp b
        if (regs.fNZ) { m.step(0x05fe, 12); next = 0x05fe; break; } // 05f3  jr nz,0x05fe (taken)
        m.step(0x05f5, 7); // 05f3  jr nz,0x05fe (not taken)
        regs.a = 0x5c; m.step(0x05f7, 7); // 05f5  ld a,0x5c
        regs.cp(regs.c); m.step(0x05f8, 4); // 05f7  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 05f8  jp c,0x066d (taken)
        m.step(0x05fb, 10); // 05f8  jp c,0x066d (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 05fb  jp 0x0661
      }
      case 0x05fe: {
        regs.a = 0x5c; m.step(0x0600, 7); // 05fe  ld a,0x5c
        regs.cp(regs.c); m.step(0x0601, 4); // 0600  cp c
        if (regs.fNZ) { m.step(0x060c, 12); next = 0x060c; break; } // 0601  jr nz,0x060c (taken)
        m.step(0x0603, 7); // 0601  jr nz,0x060c (not taken)
        regs.a = 0x50; m.step(0x0605, 7); // 0603  ld a,0x50
        regs.cp(regs.b); m.step(0x0606, 4); // 0605  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 0606  jp c,0x0661 (taken)
        m.step(0x0609, 10); // 0606  jp c,0x0661 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 0609  jp 0x066d
      }
      case 0x060c: {
        regs.a = 0x50; m.step(0x060e, 7); // 060c  ld a,0x50
        regs.cp(regs.b); m.step(0x060f, 4); // 060e  cp b
        if (regs.fNZ) { m.step(0x061a, 12); next = 0x061a; break; } // 060f  jr nz,0x061a (taken)
        m.step(0x0611, 7); // 060f  jr nz,0x061a (not taken)
        regs.a = 0x58; m.step(0x0613, 7); // 0611  ld a,0x58
        regs.cp(regs.c); m.step(0x0614, 4); // 0613  cp c
        if (regs.fC) { m.step(0x066d, 10); next = 0x066d; break; } // 0614  jp c,0x066d (taken)
        m.step(0x0617, 10); // 0614  jp c,0x066d (not taken)
        m.step(0x0661, 10); next = 0x0661; break; // 0617  jp 0x0661
      }
      case 0x061a: {
        regs.a = 0x58; m.step(0x061c, 7); // 061a  ld a,0x58
        regs.cp(regs.c); m.step(0x061d, 4); // 061c  cp c
        if (regs.fNZ) { m.step(0x0628, 12); next = 0x0628; break; } // 061d  jr nz,0x0628 (taken)
        m.step(0x061f, 7); // 061d  jr nz,0x0628 (not taken)
        regs.a = 0x28; m.step(0x0621, 7); // 061f  ld a,0x28
        regs.cp(regs.b); m.step(0x0622, 4); // 0621  cp b
        if (regs.fC) { m.step(0x0661, 10); next = 0x0661; break; } // 0622  jp c,0x0661 (taken)
        m.step(0x0625, 10); // 0622  jp c,0x0661 (not taken)
        m.step(0x066d, 10); next = 0x066d; break; // 0625  jp 0x066d
      }
      case 0x0628: {
        regs.a = 0x28; m.step(0x062a, 7); // 0628  ld a,0x28
        regs.cp(regs.b); m.step(0x062b, 4); // 062a  cp b
        if (regs.fNZ) { m.step(0x0634, 12); next = 0x0634; break; } // 062b  jr nz,0x0634 (taken)
        m.step(0x062d, 7); // 062b  jr nz,0x0634 (not taken)
        regs.a = 0x48; m.step(0x062f, 7); // 062d  ld a,0x48
        regs.cp(regs.c); m.step(0x0630, 4); // 062f  cp c
        if (regs.fC) { m.step(0x066d, 12); next = 0x066d; break; } // 0630  jr c,0x066d (taken)
        m.step(0x0632, 7); // 0630  jr c,0x066d (not taken)
        m.step(0x0661, 12); next = 0x0661; break; // 0632  jr 0x0661
      }
      case 0x0634: {
        regs.a = 0x48; m.step(0x0636, 7); // 0634  ld a,0x48
        regs.cp(regs.c); m.step(0x0637, 4); // 0636  cp c
        if (regs.fNZ) { m.step(0x0640, 12); next = 0x0640; break; } // 0637  jr nz,0x0640 (taken)
        m.step(0x0639, 7); // 0637  jr nz,0x0640 (not taken)
        regs.a = 0x18; m.step(0x063b, 7); // 0639  ld a,0x18
        regs.cp(regs.b); m.step(0x063c, 4); // 063b  cp b
        if (regs.fC) { m.step(0x0661, 12); next = 0x0661; break; } // 063c  jr c,0x0661 (taken)
        m.step(0x063e, 7); // 063c  jr c,0x0661 (not taken)
        m.step(0x066d, 12); next = 0x066d; break; // 063e  jr 0x066d
      }
      case 0x0640: {
        regs.a = 0x1e; m.step(0x0642, 7); // 0640  ld a,0x1e
        mem.write8(0x800c, regs.a); m.step(0x0645, 13); // 0642  ld (0x800c),a
        regs.a = 0x18; m.step(0x0647, 7); // 0645  ld a,0x18
        regs.cp(regs.b); m.step(0x0648, 4); // 0647  cp b
        if (regs.fNZ) { m.step(0x0651, 12); next = 0x0651; break; } // 0648  jr nz,0x0651 (taken)
        m.step(0x064a, 7); // 0648  jr nz,0x0651 (not taken)
        regs.a = 0x38; m.step(0x064c, 7); // 064a  ld a,0x38
        regs.cp(regs.c); m.step(0x064d, 4); // 064c  cp c
        if (regs.fC) { m.step(0x066d, 12); next = 0x066d; break; } // 064d  jr c,0x066d (taken)
        m.step(0x064f, 7); // 064d  jr c,0x066d (not taken)
        m.step(0x0665, 12); next = 0x0665; break; // 064f  jr 0x0665
      }
      case 0x0651: {
        regs.a = 0x38; m.step(0x0653, 7); // 0651  ld a,0x38
        regs.cp(regs.c); m.step(0x0654, 4); // 0653  cp c
        if (regs.fNZ) { m.step(0x065b, 12); next = 0x065b; break; } // 0654  jr nz,0x065b (taken)
        m.step(0x0656, 7); // 0654  jr nz,0x065b (not taken)
        regs.a = 0x2f; m.step(0x0658, 7); // 0656  ld a,0x2f
        regs.cp(regs.b); m.step(0x0659, 4); // 0658  cp b
        if (regs.fNC) { m.step(0x0665, 12); next = 0x0665; break; } // 0659  jr nc,0x0665 (taken)
        m.step(0x065b, 7); // 0659  jr nc,0x0665 (not taken)
        next = 0x065b; break;
      }
      case 0x065b: {
        m.step(0x066d, 12); next = 0x066d; break; // 065b  jr 0x066d
      }
      case 0x0661: {
        regs.a = 0x01; m.step(0x0663, 7); // 0661  ld a,0x01
        m.step(0x066f, 12); next = 0x066f; break; // 0663  jr 0x066f
      }
      case 0x0665: {
        regs.a = 0x02; m.step(0x0667, 7); // 0665  ld a,0x02
        m.step(0x066f, 12); next = 0x066f; break; // 0667  jr 0x066f
      }
      case 0x0669: {
        regs.a = 0x04; m.step(0x066b, 7); // 0669  ld a,0x04
        m.step(0x066f, 12); next = 0x066f; break; // 066b  jr 0x066f
      }
      case 0x066d: {
        regs.a = 0x08; m.step(0x066f, 7); // 066d  ld a,0x08
        next = 0x066f; break;
      }
      case 0x066f: {
        mem.write8(0x801b, regs.a); m.step(0x0672, 13); // 066f  ld (0x801b),a
        m.ret(); return; // 0672  ret
      }
      default:
        throw new Error(
          "loc_03e8: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
