// SPDX-License-Identifier: GPL-3.0-only
// loc_23da  (ROM 0x23da-0x24f8) -- per-frame player/actor dispatcher: gates on $87/$db/$d6/$43/$86, branches
// out to loc_2932/2505/24ff/24f8 or runs the death/respawn update chain; falls through into loc_24f8.
export function loc_23da(m) {
  const { regs, mem } = m;
  let label = 0x23da;
  for (;;) {
    switch (label) {
      case 0x23da: {
        regs.a = mem.read8(0x0087); regs.setNZ(regs.a); m.step(0x23dc, 3); // 23da lda $87
        if (regs.fNZ) { m.step(0x23df, 3); label = 0x23df; continue; }     // 23dc bne $23df
        m.step(0x23de, 2);
        label = 0x23de; continue;
      }
      case 0x23de: {
        return m.ret(6);                                                   // 23de rts
      }
      case 0x23df: {
        regs.a = mem.read8(0x00db); regs.setNZ(regs.a); m.step(0x23e1, 3); // 23df lda $db
        if (regs.fNZ) { m.step(0x23de, 3); label = 0x23de; continue; }     // 23e1 bne $23de
        m.step(0x23e3, 2);
        mem.write8(0x0087, regs.dec8(mem.read8(0x0087))); m.step(0x23e5, 5);
        if (regs.fNZ) { m.step(0x23de, 3); label = 0x23de; continue; }     // 23e5 bne $23de
        m.step(0x23e7, 2);
        regs.a = mem.read8(0x00d6); regs.setNZ(regs.a); m.step(0x23e9, 3); // 23e7 lda $d6
        if (regs.fZ) { m.step(0x23fa, 3); label = 0x23fa; continue; }      // 23e9 beq $23fa
        m.step(0x23eb, 2);
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x23ed, 2);
        m.step(0x23f0, 6); m.call(0x37d5);                                 // 23ed jsr $37d5
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x23f2, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x23f3, 2);
        mem.write8((mem.read16(0x0091) + regs.y) & 0xffff, regs.a); m.step(0x23f5, 6); // 23f3 sta ($91),y
        mem.write8(0x00d6, regs.a); m.step(0x23f7, 3);                     // 23f5 sta $d6
        m.step(0x2932, 3); return m.call(0x2932);                          // 23f7 jmp $2932
      }
      case 0x23fa: {
        regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x23fc, 3); // 23fa lda $43
        regs.and(0xaf); m.step(0x23fe, 2);
        if (regs.fNZ) { m.step(0x2403, 3); label = 0x2403; continue; }     // 23fe bne $2403
        m.step(0x2400, 2);
        m.step(0x2505, 3); return m.call(0x2505);                          // 2400 jmp $2505
      }
      case 0x2403: {
        m.step(0x2406, 6); m.call(0x2932);                                 // 2403 jsr $2932
        regs.a = mem.read8(0x0086); regs.setNZ(regs.a); m.step(0x2408, 3); // 2406 lda $86
        if (regs.fPl) { m.step(0x241b, 3); label = 0x241b; continue; }     // 2408 bpl $241b
        m.step(0x240a, 2);
        regs.a = mem.read8(0x0001); regs.setNZ(regs.a); m.step(0x240c, 3); // 240a lda $01
        if (regs.fPl) { m.step(0x2418, 3); label = 0x2418; continue; }     // 240c bpl $2418
        m.step(0x240e, 2);
        regs.and(0x7f); m.step(0x2410, 2);
        mem.write8(0x0001, regs.a); m.step(0x2412, 3);                     // 2410 sta $01
        m.step(0x2415, 6); m.call(0x31d5);                                 // 2412 jsr $31d5
        m.step(0x2418, 6); m.call(0x2d5c);                                 // 2415 jsr $2d5c
        label = 0x2418; continue;
      }
      case 0x2418: {
        m.step(0x24ff, 3); return m.call(0x24ff);                          // 2418 jmp $24ff
      }
      case 0x241b: {
        regs.a = mem.read8(0x00a5); regs.setNZ(regs.a); m.step(0x241d, 3); // 241b lda $a5
        regs.ora(mem.read8(0x00a6)); m.step(0x241f, 3);
        if (regs.fNZ) { m.step(0x2467, 3); label = 0x2467; continue; }     // 241f bne $2467
        m.step(0x2421, 2);
        mem.write8(0x0086, regs.dec8(mem.read8(0x0086))); m.step(0x2423, 5); // 2421 dec $86
        m.step(0x2426, 6); m.call(0x323e);                                 // 2423 jsr $323e
        regs.a = mem.read8(0x00ef); regs.setNZ(regs.a); m.step(0x2428, 3); // 2426 lda $ef
        if (regs.fZ) { m.step(0x2442, 3); label = 0x2442; continue; }      // 2428 beq $2442
        m.step(0x242a, 2);
        regs.a = mem.read8(0x00c2); regs.setNZ(regs.a); m.step(0x242c, 3); // 242a lda $c2
        if (regs.fPl) { m.step(0x2442, 3); label = 0x2442; continue; }     // 242c bpl $2442
        m.step(0x242e, 2);
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x2430, 2);
        mem.write8(0x00ee, regs.a); m.step(0x2432, 3);                     // 2430 sta $ee
        m.step(0x2435, 6); m.call(0x2509);                                 // 2432 jsr $2509
        m.step(0x2438, 6); m.call(0x2932);                                 // 2435 jsr $2932
        m.step(0x243b, 6); m.call(0x31d5);                                 // 2438 jsr $31d5
        regs.a = mem.read8(0x00c1); regs.setNZ(regs.a); m.step(0x243d, 3); // 243b lda $c1
        if (regs.fPl) { m.step(0x2442, 3); label = 0x2442; continue; }     // 243d bpl $2442
        m.step(0x243f, 2);
        m.step(0x2442, 6); m.call(0x2d5c);                                 // 243f jsr $2d5c
        label = 0x2442; continue;
      }
      case 0x2442: {
        m.step(0x2445, 6); m.call(0x21c7);                                 // 2442 jsr $21c7
        m.step(0x2448, 6); m.call(0x231f);                                 // 2445 jsr $231f
        m.step(0x244b, 6); m.call(0x20e8);                                 // 2448 jsr $20e8
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x244d, 2);
        mem.write8(0x0000, regs.a); m.step(0x244f, 3);                     // 244d sta $00
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2451, 2);
        m.step(0x2454, 6); m.call(0x37d5);                                 // 2451 jsr $37d5
        regs.x = mem.read8(0x0089); regs.setNZ(regs.x); m.step(0x2456, 3); // 2454 ldx $89
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x2458, 2);
        mem.write8((0x1c02 + regs.x) & 0xffff, regs.a); m.step(0x245b, 5); // 2458 sta $1c02,x
        m.step(0x245e, 6); m.call(0x3a08);                                 // 245b jsr $3a08
        regs.a = 0x3d; regs.setNZ(regs.a); m.step(0x2460, 2);
        mem.write8(0x00f9, regs.a); m.step(0x2462, 3);                     // 2460 sta $f9
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2464, 2);
        mem.write8(0x00fa, regs.a); m.step(0x2466, 3);                     // 2464 sta $fa
        return m.ret(6);                                                   // 2466 rts
      }
      case 0x2467: {
        regs.x = mem.read8(0x0089); regs.setNZ(regs.x); m.step(0x2469, 3); // 2467 ldx $89
        regs.x = regs.dec8(regs.x); m.step(0x246a, 2);
        if (regs.fNZ) { m.step(0x246f, 3); label = 0x246f; continue; }     // 246a bne $246f
        m.step(0x246c, 2);
        m.step(0x24f8, 3); return m.call(0x24f8);                          // 246c jmp $24f8
      }
      case 0x246f: {
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2471, 3); // 246f ldx $88
        regs.a = mem.read8((0x00a4 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2473, 4); // 2471 lda $a4,x
        if (regs.fNZ) { m.step(0x2499, 3); label = 0x2499; continue; }     // 2473 bne $2499
        m.step(0x2475, 2);
        regs.a = mem.read8(0x00a7); regs.setNZ(regs.a); m.step(0x2477, 3); // 2475 lda $a7
        if (regs.fNZ) { m.step(0x2497, 3); label = 0x2497; continue; }     // 2477 bne $2497
        m.step(0x2479, 2);
        mem.write8(0x00a7, regs.inc8(mem.read8(0x00a7))); m.step(0x247b, 5); // 2479 inc $a7
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x247d, 2);
        mem.write8(0x0087, regs.a); m.step(0x247f, 3);                     // 247d sta $87
        regs.a = 0xf9; regs.setNZ(regs.a); m.step(0x2481, 2);
        mem.write8(0x0043, regs.a); m.step(0x2483, 3);                     // 2481 sta $43
        mem.write8(0x0042, regs.a); m.step(0x2485, 3);                     // 2483 sta $42
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2487, 2);
        m.step(0x248a, 6); m.call(0x37d5);                                 // 2487 jsr $37d5
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x248c, 2);
        m.step(0x248f, 6); m.call(0x37d5);                                 // 248c jsr $37d5
        regs.a = mem.read8(0x0088); regs.setNZ(regs.a); m.step(0x2491, 3); // 248f lda $88
        regs.ora(0x20); m.step(0x2493, 2);
        m.step(0x2496, 6); m.call(0x3836);                                 // 2493 jsr $3836
        return m.ret(6);                                                   // 2496 rts
      }
      case 0x2497: {
        mem.write8(0x00a7, regs.dec8(mem.read8(0x00a7))); m.step(0x2499, 5); // 2497 dec $a7
        label = 0x2499; continue;
      }
      case 0x2499: {
        regs.a = mem.read8(0x0088); regs.setNZ(regs.a); m.step(0x249b, 3); // 2499 lda $88
        regs.eor(0x03); m.step(0x249d, 2);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x249e, 2);
        regs.a = mem.read8((0x00a4 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x24a0, 4); // 249e lda $a4,x
        if (regs.fZ) { m.step(0x24f8, 3); return m.call(0x24f8); }         // 24a0 beq $24f8
        m.step(0x24a2, 2);
        mem.write8(0x0088, regs.x); m.step(0x24a4, 3);                     // 24a2 stx $88
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x24a6, 2);
        regs.and(mem.read8(0x00ee)); m.step(0x24a8, 3);
        regs.ora(mem.read8(0x0088)); m.step(0x24aa, 3);
        mem.write8(0x00ee, regs.a); m.step(0x24ac, 3);                     // 24aa sta $ee
        regs.cmp(0x82); m.step(0x24ae, 2);
        if (regs.fNZ) { m.step(0x24b3, 3); label = 0x24b3; continue; }     // 24ae bne $24b3
        m.step(0x24b0, 2);
        m.step(0x24b3, 6); m.call(0x252a);                                 // 24b0 jsr $252a
        label = 0x24b3; continue;
      }
      case 0x24b3: {
        regs.a = mem.read8((0x00a1 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x24b5, 4); // 24b3 lda $a1,x
        mem.write8(0x00a0, regs.a); m.step(0x24b7, 3);                     // 24b5 sta $a0
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x24b9, 3); // 24b7 ldx $88
        regs.cpx(0x01); m.step(0x24bb, 2);
        if (regs.fNZ) { m.step(0x24c0, 3); label = 0x24c0; continue; }     // 24bb bne $24c0
        m.step(0x24bd, 2);
        m.step(0x24c0, 6); m.call(0x2509);                                 // 24bd jsr $2509
        label = 0x24c0; continue;
      }
      case 0x24c0: {
        m.step(0x24c3, 6); m.call(0x31d5);                                 // 24c0 jsr $31d5
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x24c5, 3); // 24c3 ldx $88
        regs.cpx(0x02); m.step(0x24c7, 2);
        if (regs.fNZ) { m.step(0x24da, 3); label = 0x24da; continue; }     // 24c7 bne $24da
        m.step(0x24c9, 2);
        regs.a = mem.read8((0x00a4 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x24cb, 4); // 24c9 lda $a4,x
        regs.cmp(mem.read8(0x00a4)); m.step(0x24cd, 3);
        if (regs.fNZ) { m.step(0x24da, 3); label = 0x24da; continue; }     // 24cd bne $24da
        m.step(0x24cf, 2);
        regs.a = mem.read8(0x00ad); regs.setNZ(regs.a); m.step(0x24d1, 3); // 24cf lda $ad
        if (regs.fNZ) { m.step(0x24da, 3); label = 0x24da; continue; }     // 24d1 bne $24da
        m.step(0x24d3, 2);
        regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x24d5, 2);
        mem.write8((0x0094 + regs.x) & 0xff, regs.a); m.step(0x24d7, 4);   // 24d5 sta $94,x
        m.step(0x24da, 6); m.call(0x28bf);                                 // 24d7 jsr $28bf
        label = 0x24da; continue;
      }
      case 0x24da: {
        regs.a = mem.read8((0x00c2 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x24dc, 4); // 24da lda $c2,x
        regs.ora(0x40); m.step(0x24de, 2);
        mem.write8((0x00c2 + regs.x) & 0xff, regs.a); m.step(0x24e0, 4);   // 24de sta $c2,x
        regs.a = 0xa0; regs.setNZ(regs.a); m.step(0x24e2, 2);
        mem.write8(0x0087, regs.a); m.step(0x24e4, 3);                     // 24e2 sta $87
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x24e6, 2);
        m.step(0x24e9, 6); m.call(0x37d5);                                 // 24e6 jsr $37d5
        regs.a = mem.read8(0x0088); regs.setNZ(regs.a); m.step(0x24eb, 3); // 24e9 lda $88
        regs.ora(0x20); m.step(0x24ed, 2);
        m.step(0x24f0, 6); m.call(0x3836);                                 // 24ed jsr $3836
        regs.a = 0xf9; regs.setNZ(regs.a); m.step(0x24f2, 2);
        mem.write8(0x0043, regs.a); m.step(0x24f4, 3);                     // 24f2 sta $43
        mem.write8(0x0042, regs.a); m.step(0x24f6, 3);                     // 24f4 sta $42
        mem.write8(0x00d6, regs.a); m.step(0x24f8, 3);                     // 24f6 sta $d6
        return m.call(0x24f8);                                             // fall into loc_24f8
      }
    }
  }
}
