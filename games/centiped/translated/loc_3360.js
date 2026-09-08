// SPDX-License-Identifier: GPL-3.0-only
// loc_3360  (ROM 0x3360-0x3413) -- per-column centipede segment advance: steps the $CF,X body cell, runs its
// $D2/$CC,X timers, folds the move into the $C9/$CA accumulator, loops X down a column at a time (JMP $3360),
// and on the last column subtracts the $3413,Y threshold before exiting to 0x341B. The 6502 control flow
// re-converges too heavily to unroll, so each ROM address is a switch case dispatched off a local pc: the case
// labels ARE the ROM addresses and the m.step targets carry every fall-through and branch edge.
export function loc_3360(m) {
  const { regs, mem } = m;
  let pc = 0x3360;
  for (;;) {
    switch (pc) {
      case 0x3360: regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3363, 4); pc = 0x3363; break;
      case 0x3363: regs.cpx(0x01); m.step(0x3365, 2); pc = 0x3365; break; // 3363 cpx #$01
      case 0x3365: if (regs.fZ) { m.step(0x336a, 3); pc = 0x336a; } else { m.step(0x3367, 2); pc = 0x3367; } break; // 3365 beq $336a
      case 0x3367: if (regs.fC) { m.step(0x336b, 3); pc = 0x336b; } else { m.step(0x3369, 2); pc = 0x3369; } break; // 3367 bcs $336b
      case 0x3369: regs.a = regs.asl(regs.a); m.step(0x336a, 2); pc = 0x336a; break;
      case 0x336a: regs.a = regs.asl(regs.a); m.step(0x336b, 2); pc = 0x336b; break;
      case 0x336b: regs.a = regs.asl(regs.a); m.step(0x336c, 2); pc = 0x336c; break;
      case 0x336c: regs.a = mem.read8((0x00cf + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x336e, 4); pc = 0x336e; break; // 336c lda $cf,x
      case 0x336e: regs.and(0x1f); m.step(0x3370, 2); pc = 0x3370; break;
      case 0x3370: if (regs.fC) { m.step(0x33a9, 3); pc = 0x33a9; } else { m.step(0x3372, 2); pc = 0x3372; } break; // 3370 bcs $33a9
      case 0x3372: if (regs.fZ) { m.step(0x3384, 3); pc = 0x3384; } else { m.step(0x3374, 2); pc = 0x3374; } break; // 3372 beq $3384
      case 0x3374: regs.cmp(0x1b); m.step(0x3376, 2); pc = 0x3376; break;
      case 0x3376: if (regs.fC) { m.step(0x3382, 3); pc = 0x3382; } else { m.step(0x3378, 2); pc = 0x3378; } break; // 3376 bcs $3382
      case 0x3378: regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3379, 2); pc = 0x3379; break;
      case 0x3379: regs.a = mem.read8(0x00d4); regs.setNZ(regs.a); m.step(0x337b, 3); pc = 0x337b; break; // 3379 lda $d4
      case 0x337b: regs.and(0x07); m.step(0x337d, 2); pc = 0x337d; break;
      case 0x337d: regs.cmp(0x07); m.step(0x337f, 2); pc = 0x337f; break;
      case 0x337f: regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3380, 2); pc = 0x3380; break;
      case 0x3380: if (regs.fNC) { m.step(0x3384, 3); pc = 0x3384; } else { m.step(0x3382, 2); pc = 0x3382; } break; // 3380 bcc $3384
      case 0x3382: regs.sbc(0x01); m.step(0x3384, 2); pc = 0x3384; break; // 3382 sbc #$01
      case 0x3384: mem.write8((0x00cf + regs.x) & 0xff, regs.a); m.step(0x3386, 4); pc = 0x3386; break; // 3384 sta $cf,x
      case 0x3386: regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3389, 4); pc = 0x3389; break;
      case 0x3389: regs.and(0x10); m.step(0x338b, 2); pc = 0x338b; break;
      case 0x338b: if (regs.fNZ) { m.step(0x3391, 3); pc = 0x3391; } else { m.step(0x338d, 2); pc = 0x338d; } break; // 338b bne $3391
      case 0x338d: regs.a = 0xf0; regs.setNZ(regs.a); m.step(0x338f, 2); pc = 0x338f; break;
      case 0x338f: mem.write8(0x00d2, regs.a); m.step(0x3391, 3); pc = 0x3391; break; // 338f sta $d2
      case 0x3391: regs.a = mem.read8(0x00d2); regs.setNZ(regs.a); m.step(0x3393, 3); pc = 0x3393; break;
      case 0x3393: if (regs.fZ) { m.step(0x339d, 3); pc = 0x339d; } else { m.step(0x3395, 2); pc = 0x3395; } break; // 3393 beq $339d
      case 0x3395: mem.write8(0x00d2, regs.dec8(mem.read8(0x00d2))); m.step(0x3397, 5); pc = 0x3397; break; // 3395 dec $d2
      case 0x3397: regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3399, 2); pc = 0x3399; break;
      case 0x3399: mem.write8((0x00cf + regs.x) & 0xff, regs.a); m.step(0x339b, 4); pc = 0x339b; break;
      case 0x339b: mem.write8((0x00cc + regs.x) & 0xff, regs.a); m.step(0x339d, 4); pc = 0x339d; break; // 339b sta $cc,x
      case 0x339d: regs.clc(); m.step(0x339e, 2); pc = 0x339e; break;
      case 0x339e: regs.a = mem.read8((0x00cc + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x33a0, 4); pc = 0x33a0; break; // 339e lda $cc,x
      case 0x33a0: if (regs.fZ) { m.step(0x33c5, 3); pc = 0x33c5; } else { m.step(0x33a2, 2); pc = 0x33a2; } break; // 33a0 beq $33c5
      case 0x33a2: mem.write8((0x00cc + regs.x) & 0xff, regs.dec8(mem.read8((0x00cc + regs.x) & 0xff))); m.step(0x33a4, 6); pc = 0x33a4; break; // 33a2 dec $cc,x
      case 0x33a4: if (regs.fNZ) { m.step(0x33c5, 3); pc = 0x33c5; } else { m.step(0x33a6, 2); pc = 0x33a6; } break; // 33a4 bne $33c5
      case 0x33a6: regs.sec(); m.step(0x33a7, 2); pc = 0x33a7; break;
      case 0x33a7: if (regs.fC) { m.step(0x33c5, 3); pc = 0x33c5; } else { m.step(0x33a9, 2); pc = 0x33a9; } break; // 33a7 bcs $33c5
      case 0x33a9: regs.cmp(0x1b); m.step(0x33ab, 2); pc = 0x33ab; break; // 33a9 cmp #$1b
      case 0x33ab: if (regs.fC) { m.step(0x33b6, 3); pc = 0x33b6; } else { m.step(0x33ad, 2); pc = 0x33ad; } break; // 33ab bcs $33b6
      case 0x33ad: regs.a = mem.read8((0x00cf + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x33af, 4); pc = 0x33af; break;
      case 0x33af: regs.adc(0x20); m.step(0x33b1, 2); pc = 0x33b1; break; // 33af adc #$20
      case 0x33b1: if (regs.fNC) { m.step(0x3384, 3); pc = 0x3384; } else { m.step(0x33b3, 2); pc = 0x33b3; } break; // 33b1 bcc $3384
      case 0x33b3: if (regs.fZ) { m.step(0x33b6, 3); pc = 0x33b6; } else { m.step(0x33b5, 2); pc = 0x33b5; } break; // 33b3 beq $33b6
      case 0x33b5: regs.clc(); m.step(0x33b6, 2); pc = 0x33b6; break;
      case 0x33b6: regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x33b8, 2); pc = 0x33b8; break;
      case 0x33b8: if (regs.fC) { m.step(0x3384, 3); pc = 0x3384; } else { m.step(0x33ba, 2); pc = 0x33ba; } break; // 33b8 bcs $3384
      case 0x33ba: mem.write8((0x00cf + regs.x) & 0xff, regs.a); m.step(0x33bc, 4); pc = 0x33bc; break;
      case 0x33bc: regs.a = mem.read8((0x00cc + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x33be, 4); pc = 0x33be; break;
      case 0x33be: if (regs.fZ) { m.step(0x33c1, 3); pc = 0x33c1; } else { m.step(0x33c0, 2); pc = 0x33c0; } break; // 33be beq $33c1
      case 0x33c0: regs.sec(); m.step(0x33c1, 2); pc = 0x33c1; break;
      case 0x33c1: regs.a = 0x78; regs.setNZ(regs.a); m.step(0x33c3, 2); pc = 0x33c3; break;
      case 0x33c3: mem.write8((0x00cc + regs.x) & 0xff, regs.a); m.step(0x33c5, 4); pc = 0x33c5; break; // 33c3 sta $cc,x
      case 0x33c5: if (regs.fNC) { m.step(0x33f1, 3); pc = 0x33f1; } else { m.step(0x33c7, 2); pc = 0x33c7; } break; // 33c5 bcc $33f1
      case 0x33c7: regs.a = 0x00; regs.setNZ(regs.a); m.step(0x33c9, 2); pc = 0x33c9; break;
      case 0x33c9: regs.cpx(0x01); m.step(0x33cb, 2); pc = 0x33cb; break; // 33c9 cpx #$01
      case 0x33cb: if (regs.fNC) { m.step(0x33e3, 3); pc = 0x33e3; } else { m.step(0x33cd, 2); pc = 0x33cd; } break; // 33cb bcc $33e3
      case 0x33cd: if (regs.fZ) { m.step(0x33db, 3); pc = 0x33db; } else { m.step(0x33cf, 2); pc = 0x33cf; } break; // 33cd beq $33db
      case 0x33cf: regs.a = mem.read8(0x00d3); regs.setNZ(regs.a); m.step(0x33d1, 3); pc = 0x33d1; break; // 33cf lda $d3
      case 0x33d1: regs.and(0x0c); m.step(0x33d3, 2); pc = 0x33d3; break;
      case 0x33d3: regs.a = regs.lsr(regs.a); m.step(0x33d4, 2); pc = 0x33d4; break;
      case 0x33d4: regs.a = regs.lsr(regs.a); m.step(0x33d5, 2); pc = 0x33d5; break;
      case 0x33d5: if (regs.fZ) { m.step(0x33e3, 3); pc = 0x33e3; } else { m.step(0x33d7, 2); pc = 0x33d7; } break; // 33d5 beq $33e3
      case 0x33d7: regs.adc(0x02); m.step(0x33d9, 2); pc = 0x33d9; break; // 33d7 adc #$02
      case 0x33d9: if (regs.fNZ) { m.step(0x33e3, 3); pc = 0x33e3; } else { m.step(0x33db, 2); pc = 0x33db; } break; // 33d9 bne $33e3
      case 0x33db: regs.a = mem.read8(0x00d3); regs.setNZ(regs.a); m.step(0x33dd, 3); pc = 0x33dd; break; // 33db lda $d3
      case 0x33dd: regs.and(0x10); m.step(0x33df, 2); pc = 0x33df; break;
      case 0x33df: if (regs.fZ) { m.step(0x33e3, 3); pc = 0x33e3; } else { m.step(0x33e1, 2); pc = 0x33e1; } break; // 33df beq $33e3
      case 0x33e1: regs.a = 0x01; regs.setNZ(regs.a); m.step(0x33e3, 2); pc = 0x33e3; break;
      case 0x33e3: regs.sec(); m.step(0x33e4, 2); pc = 0x33e4; break;
      case 0x33e4: m.push8(regs.a); m.step(0x33e5, 3); pc = 0x33e5; break; // 33e4 pha (save the row delta)
      case 0x33e5: regs.adc(mem.read8(0x00ca)); m.step(0x33e7, 3); pc = 0x33e7; break; // 33e5 adc $ca
      case 0x33e7: mem.write8(0x00ca, regs.a); m.step(0x33e9, 3); pc = 0x33e9; break;
      case 0x33e9: regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x33ea, 4); pc = 0x33ea; break; // 33e9 pla
      case 0x33ea: regs.sec(); m.step(0x33eb, 2); pc = 0x33eb; break;
      case 0x33eb: regs.adc(mem.read8(0x00c9)); m.step(0x33ed, 3); pc = 0x33ed; break; // 33eb adc $c9
      case 0x33ed: mem.write8(0x00c9, regs.a); m.step(0x33ef, 3); pc = 0x33ef; break;
      case 0x33ef: mem.write8((0x00c5 + regs.x) & 0xff, regs.inc8(mem.read8((0x00c5 + regs.x) & 0xff))); m.step(0x33f1, 6); pc = 0x33f1; break; // 33ef inc $c5,x
      case 0x33f1: regs.x = regs.dec8(regs.x); m.step(0x33f2, 2); pc = 0x33f2; break; // 33f1 dex (column counter)
      case 0x33f2: if (regs.fN) { m.step(0x33f7, 3); pc = 0x33f7; } else { m.step(0x33f4, 2); pc = 0x33f4; } break; // 33f2 bmi $33f7
      case 0x33f4: m.step(0x3360, 3); pc = 0x3360; break; // 33f4 jmp $3360 (next column)
      case 0x33f7: regs.a = mem.read8(0x00d3); regs.setNZ(regs.a); m.step(0x33f9, 3); pc = 0x33f9; break; // 33f7 lda $d3
      case 0x33f9: regs.a = regs.lsr(regs.a); m.step(0x33fa, 2); pc = 0x33fa; break;
      case 0x33fa: regs.a = regs.lsr(regs.a); m.step(0x33fb, 2); pc = 0x33fb; break;
      case 0x33fb: regs.a = regs.lsr(regs.a); m.step(0x33fc, 2); pc = 0x33fc; break;
      case 0x33fc: regs.a = regs.lsr(regs.a); m.step(0x33fd, 2); pc = 0x33fd; break;
      case 0x33fd: regs.a = regs.lsr(regs.a); m.step(0x33fe, 2); pc = 0x33fe; break;
      case 0x33fe: regs.y = regs.a; regs.setNZ(regs.y); m.step(0x33ff, 2); pc = 0x33ff; break;
      case 0x33ff: regs.a = mem.read8(0x00ca); regs.setNZ(regs.a); m.step(0x3401, 3); pc = 0x3401; break; // 33ff lda $ca
      case 0x3401: regs.sec(); m.step(0x3402, 2); pc = 0x3402; break;
      case 0x3402: { const ea = (0x3413 + regs.y) & 0xffff; regs.sbc(mem.read8(ea)); m.step(0x3405, 4 + ((0x3413 & 0xff00) !== (ea & 0xff00) ? 1 : 0)); pc = 0x3405; } break; // 3402 sbc $3413,y
      case 0x3405: if (regs.fN) { m.step(0x341b, 3); return m.call(0x341b); } m.step(0x3407, 2); pc = 0x3407; break; // 3405 bmi $341b
      case 0x3407: mem.write8(0x00ca, regs.a); m.step(0x3409, 3); pc = 0x3409; break; // 3407 sta $ca
      case 0x3409: mem.write8(0x00cb, regs.inc8(mem.read8(0x00cb))); m.step(0x340b, 5); pc = 0x340b; break; // 3409 inc $cb
      case 0x340b: regs.cpy(0x03); m.step(0x340d, 2); pc = 0x340d; break; // 340b cpy #$03
      case 0x340d: if (regs.fNZ) { m.step(0x341b, 3); return m.call(0x341b); } m.step(0x340f, 2); pc = 0x340f; break; // 340d bne $341b
      case 0x340f: mem.write8(0x00cb, regs.inc8(mem.read8(0x00cb))); m.step(0x3411, 5); pc = 0x3411; break; // 340f inc $cb
      case 0x3411: if (regs.fNZ) { m.step(0x341b, 3); return m.call(0x341b); } throw new Error("loc_3360: 0x3411 BNE not-taken falls into the 0x3413,Y threshold DATA table -- a dead arm; trap rather than execute data as code"); // 3411 bne $341b (else dead arm into 0x3413 data -- trapped)
      default: throw new Error("loc_3360: dispatch pc left the routine at 0x" + pc.toString(16));
    }
  }
}
