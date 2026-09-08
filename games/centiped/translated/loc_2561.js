// SPDX-License-Identifier: GPL-3.0-only
// loc_2561  (ROM 0x2561-0x2656) -- level/wave init: reads $0801, seeds $8d/$c8/$a4, gates on $86, drives the
// $37d5/$3836 emitters and the $1c03/$1c04 hardware latches, clears the object tables, then tail-JMPs $26b8.
export function loc_2561(m) {
  const { regs, mem } = m;
  let label = 0x2561;
  for (;;) {
    switch (label) {
      case 0x2561: {
        regs.a = mem.read8(0x0801); regs.setNZ(regs.a); m.step(0x2564, 4);        // 2561 lda $0801
        mem.write8(0x00d3, regs.a); m.step(0x2566, 3);                            // 2564 sta $d3
        regs.and(0x03); m.step(0x2568, 2);
        mem.write8(0x008d, regs.a); m.step(0x256a, 3);                            // 2568 sta $8d
        if (regs.fNZ) { m.step(0x2570, 3); label = 0x2570; continue; }            // 256a bne $2570 (taken)
        m.step(0x256c, 2);
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x256e, 2);
        mem.write8(0x00c8, regs.a); m.step(0x2570, 3);                            // 256e sta $c8
        label = 0x2570; continue;
      }
      case 0x2570: {
        regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x2572, 3);        // 2570 lda $fd
        regs.and(0x0c); m.step(0x2574, 2);
        regs.a = regs.lsr(regs.a); m.step(0x2575, 2);
        regs.a = regs.lsr(regs.a); m.step(0x2576, 2);
        regs.adc(0x02); m.step(0x2578, 2);
        mem.write8(0x00a4, regs.a); m.step(0x257a, 3);                            // 2578 sta $a4
        regs.a = mem.read8(0x0086); regs.setNZ(regs.a); m.step(0x257c, 3);        // 257a lda $86
        if (regs.fN) { m.step(0x257f, 3); label = 0x257f; continue; }             // 257c bmi $257f (taken)
        m.step(0x257e, 2);
        return m.ret(6);                                                          // 257e rts
      }
      case 0x257f: {
        regs.a = mem.read8(0x008d); regs.setNZ(regs.a); m.step(0x2581, 3);        // 257f lda $8d
        if (regs.fZ) { m.step(0x2586, 3); label = 0x2586; continue; }             // 2581 beq $2586 (taken)
        m.step(0x2583, 2);
        m.push16(0x2585); m.step(0x2586, 6); m.call(0x37d5);                                        // 2583 jsr $37d5
        label = 0x2586; continue;
      }
      case 0x2586: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2588, 3);        // 2586 lda $00
        regs.and(0x20); m.step(0x258a, 2);
        regs.a = regs.asl(regs.a); m.step(0x258b, 2);
        regs.a = regs.asl(regs.a); m.step(0x258c, 2);
        mem.write8(0x008d, regs.a); m.step(0x258e, 3);                            // 258c sta $8d
        regs.a = mem.read8(0x00c8); regs.setNZ(regs.a); m.step(0x2590, 3);        // 258e lda $c8
        regs.ora(mem.read8(0x00c9)); m.step(0x2592, 3);                           // 2590 ora $c9
        if (regs.fZ) { m.step(0x25a4, 3); label = 0x25a4; continue; }             // 2592 beq $25a4 (taken)
        m.step(0x2594, 2);
        regs.x = mem.read8(0x00dc); regs.setNZ(regs.x); m.step(0x2596, 3);        // 2594 ldx $dc
        if (regs.fPl) { m.step(0x25bf, 3); label = 0x25bf; continue; }            // 2596 bpl $25bf (taken)
        m.step(0x2598, 2);
        regs.cmp(0x02); m.step(0x259a, 2);                                        // 2598 cmp #$02
        if (regs.fNC) { m.step(0x25b8, 3); label = 0x25b8; continue; }            // 259a bcc $25b8 (taken)
        m.step(0x259c, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x259e, 2);                     // 259c lda #$00
        mem.write8(0x00dc, regs.a); m.step(0x25a0, 3);                            // 259e sta $dc
        regs.a = 0x8a; regs.setNZ(regs.a); m.step(0x25a2, 2);
        if (regs.fNZ) { m.step(0x25bc, 3); label = 0x25bc; continue; }            // 25a2 bne $25bc (taken)
        m.step(0x25a4, 2);
        label = 0x25a4; continue;
      }
      case 0x25a4: {
        regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x25a6, 3);        // 25a4 lda $fd
        regs.and(0x80); m.step(0x25a8, 2);
        mem.write8(0x00dc, regs.a); m.step(0x25aa, 3);                            // 25a8 sta $dc
        regs.eor(0x8a); m.step(0x25ac, 2);                                        // 25aa eor #$8a
        m.push16(0x25ae); m.step(0x25af, 6); m.call(0x37d5);                                        // 25ac jsr $37d5
        regs.x = 0xff; regs.setNZ(regs.x); m.step(0x25b1, 2);                     // 25af ldx #$ff
        mem.write8(0x1c03, regs.x); m.step(0x25b4, 4);                            // 25b1 stx $1c03
        mem.write8(0x1c04, regs.x); m.step(0x25b7, 4);                            // 25b4 stx $1c04
        label = 0x25b7; continue;
      }
      case 0x25b7: {
        return m.ret(6);                                                          // 25b7 rts
      }
      case 0x25b8: {
        regs.a = 0x0a; regs.setNZ(regs.a); m.step(0x25ba, 2);
        regs.ora(mem.read8(0x008d)); m.step(0x25bc, 3);
        label = 0x25bc; continue;
      }
      case 0x25bc: {
        m.push16(0x25be); m.step(0x25bf, 6); m.call(0x37d5);                                        // 25bc jsr $37d5
        label = 0x25bf; continue;
      }
      case 0x25bf: {
        regs.a = 0x09; regs.setNZ(regs.a); m.step(0x25c1, 2);
        m.push16(0x25c3); m.step(0x25c4, 6); m.call(0x37d5);                                        // 25c1 jsr $37d5
        regs.a = mem.read8(0x00c8); regs.setNZ(regs.a); m.step(0x25c6, 3);        // 25c4 lda $c8
        regs.cmp(0x0a); m.step(0x25c8, 2);                                        // 25c6 cmp #$0a
        if (regs.fNC) { m.step(0x25d4, 3); label = 0x25d4; continue; }            // 25c8 bcc $25d4 (taken)
        m.step(0x25ca, 2);
        regs.a = 0x21; regs.setNZ(regs.a); m.step(0x25cc, 2);
        m.push16(0x25ce); m.step(0x25cf, 6); m.call(0x3836);                                        // 25cc jsr $3836
        regs.a = mem.read8(0x00c8); regs.setNZ(regs.a); m.step(0x25d1, 3);        // 25cf lda $c8
        regs.sec(); m.step(0x25d2, 2);
        regs.sbc(0x0a); m.step(0x25d4, 2);
        label = 0x25d4; continue;
      }
      case 0x25d4: {
        regs.ora(0x20); m.step(0x25d6, 2);
        m.push16(0x25d8); m.step(0x25d9, 6); m.call(0x3836);                                        // 25d6 jsr $3836
        regs.a = mem.read8(0x00c9); regs.setNZ(regs.a); m.step(0x25db, 3);        // 25d9 lda $c9
        if (regs.fZ) { m.step(0x25df, 3); label = 0x25df; continue; }             // 25db beq $25df (taken)
        m.step(0x25dd, 2);
        regs.a = 0x1e; regs.setNZ(regs.a); m.step(0x25df, 2);
        label = 0x25df; continue;
      }
      case 0x25df: {
        m.push16(0x25e1); m.step(0x25e2, 6); m.call(0x3836);                                        // 25df jsr $3836
        regs.x = mem.read8(0x00c8); regs.setNZ(regs.x); m.step(0x25e4, 3);        // 25e2 ldx $c8
        if (regs.fZ) { m.step(0x25b7, 3); label = 0x25b7; continue; }             // 25e4 beq $25b7 (taken)
        m.step(0x25e6, 2);
        regs.a = mem.read8(0x00dc); regs.setNZ(regs.a); m.step(0x25e8, 3);        // 25e6 lda $dc
        if (regs.fN) { m.step(0x25b7, 3); label = 0x25b7; continue; }             // 25e8 bmi $25b7 (taken)
        m.step(0x25ea, 2);
        regs.a = mem.read8(0x008d); regs.setNZ(regs.a); m.step(0x25ec, 3);        // 25ea lda $8d
        mem.write8(0x1c03, regs.a); m.step(0x25ef, 4);                            // 25ec sta $1c03
        regs.cpx(0x02); m.step(0x25f1, 2);                                        // 25ef cpx #$02
        if (regs.fNC) { m.step(0x2607, 4); label = 0x2607; continue; }            // 25f1 bcc $2607 (taken, page-cross +1)
        m.step(0x25f3, 2);
        mem.write8(0x1c04, regs.a); m.step(0x25f6, 4);                            // 25f3 sta $1c04
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0x25f8, 2);                     // 25f6 ldx #$02
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x25fb, 4);        // 25f8 lda $0c01
        regs.and(0x02); m.step(0x25fd, 2);
        if (regs.fNZ) { m.step(0x2607, 4); label = 0x2607; continue; }            // 25fd bne $2607 (taken, page-cross +1)
        m.step(0x25ff, 2);
        regs.a = mem.read8(0x00a4); regs.setNZ(regs.a); m.step(0x2601, 3);        // 25ff lda $a4
        mem.write8(0x00a6, regs.a); m.step(0x2603, 3);                            // 2601 sta $a6
        mem.write8(0x00c8, regs.dec8(mem.read8(0x00c8))); m.step(0x2605, 5);      // 2603 dec $c8
        if (regs.fPl) { m.step(0x260f, 3); label = 0x260f; continue; }            // 2605 bpl $260f (taken)
        m.step(0x2607, 2);
        label = 0x2607; continue;
      }
      case 0x2607: {
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x260a, 4);        // 2607 lda $0c01
        regs.x = mem.read8(0x00ff); regs.setNZ(regs.x); m.step(0x260c, 3);        // 260a ldx $ff
        regs.a = regs.lsr(regs.a); m.step(0x260d, 2);
        if (regs.fC) { m.step(0x25b7, 4); label = 0x25b7; continue; }             // 260d bcs $25b7 (taken, page-cross +1)
        m.step(0x260f, 2);
        label = 0x260f; continue;
      }
      case 0x260f: {
        mem.write8(0x00c8, regs.dec8(mem.read8(0x00c8))); m.step(0x2611, 5);      // 260f dec $c8
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x2613, 2);
        mem.write8(0x1c03, regs.a); m.step(0x2616, 4);                            // 2613 sta $1c03
        mem.write8(0x1c04, regs.a); m.step(0x2619, 4);                            // 2616 sta $1c04
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x261b, 2);
        mem.write8(0x00fb, regs.a); m.step(0x261d, 3);                            // 261b sta $fb
        mem.write8(0x00fc, regs.a); m.step(0x261f, 3);                            // 261d sta $fc
        mem.write8(0x009a, regs.a); m.step(0x2621, 3);                            // 261f sta $9a
        mem.write8(0x00cb, regs.a); m.step(0x2623, 3);                            // 2621 sta $cb
        mem.write8(0x00ca, regs.a); m.step(0x2625, 3);                            // 2623 sta $ca
        mem.write8(0x0089, regs.x); m.step(0x2627, 3);                            // 2625 stx $89
        mem.write8((0x1c02 + regs.x) & 0xffff, regs.a); m.step(0x262a, 5);        // 2627 sta $1c02,x
        regs.x = mem.read8(0x00a4); regs.setNZ(regs.x); m.step(0x262c, 3);        // 262a ldx $a4
        regs.x = regs.dec8(regs.x); m.step(0x262d, 2);                            // 262c dex
        mem.write8(0x00a5, regs.x); m.step(0x262f, 3);                            // 262d stx $a5
        mem.write8(0x0086, regs.inc8(mem.read8(0x0086))); m.step(0x2631, 5);      // 262f inc $86
        m.push16(0x2633); m.step(0x2634, 6); m.call(0x26a0);                                        // 2631 jsr $26a0
        m.push16(0x2636); m.step(0x2637, 6); m.call(0x21b3);                                        // 2634 jsr $21b3
        mem.write8(0x00ae, regs.a); m.step(0x2639, 3);                            // 2637 sta $ae
        mem.write8(0x00af, regs.a); m.step(0x263b, 3);                            // 2639 sta $af
        {
          const base = 0x21c0; const addr = (base + regs.y) & 0xffff;
          regs.a = mem.read8(addr); regs.setNZ(regs.a);
          m.step(0x263e, 4 + ((base & 0xff00) !== (addr & 0xff00) ? 1 : 0));      // 263b lda $21c0,y
        }
        mem.write8(0x00b0, regs.a); m.step(0x2640, 3);                            // 263e sta $b0
        mem.write8(0x00b1, regs.a); m.step(0x2642, 3);                            // 2640 sta $b1
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x2645, 4);        // 2642 lda $0c00
        regs.and(0x10); m.step(0x2647, 2);
        if (regs.fZ) { m.step(0x2650, 3); label = 0x2650; continue; }            // 2647 beq $2650 (taken)
        m.step(0x2649, 2);
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x264b, 2);
        mem.write8(0x00ee, regs.a); m.step(0x264d, 3);                            // 264b sta $ee
        m.push16(0x264f); m.step(0x2650, 6); m.call(0x2509);                                        // 264d jsr $2509
        label = 0x2650; continue;
      }
      case 0x2650: {
        m.push16(0x2652); m.step(0x2653, 6); m.call(0x2872);                                        // 2650 jsr $2872
        m.step(0x26b8, 3); return m.call(0x26b8);                                 // 2653 jmp $26b8
      }
    }
  }
}
