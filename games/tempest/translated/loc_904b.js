// SPDX-License-Identifier: GPL-3.0-only
// loc_904b (ROM 0x904b-0x90c1) -- scroll/position accumulator. Sign-extends $0121 into $2b:$2a:$29
// (bpl skips the dec $2b), double-ror's it (dex/bpl loop, 2 iters), then folds it into the 24-bit
// accumulator $69:$68:$0122. Adds $18 to the 16-bit $5b:$5f; if the high byte reaches >=$fc it flags
// $0115=1. Computes ($5b:$5f)-$5d; on a zero high-diff it resets $5f=$5d/$5b=$ff, picks $00 = $04 or
// $08 by bit7 of $05, and clears $0102,$3d. Always sets $0114=$ff, then tail-jmps loc_9749 (no push).
export function loc_904b(m) {
  const { regs, mem } = m;
  L_90bc: {
    regs.a = 0x10; regs.setNZ(regs.a); m.step(0x904d, 2);
    mem.write8(0x0202, regs.a); m.step(0x9050, 4);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9052, 2);
    mem.write8(0x29, regs.a); m.step(0x9054, 3);
    mem.write8(0x2b, regs.a); m.step(0x9056, 3);
    regs.a = mem.read8(0x0121); regs.setNZ(regs.a); m.step(0x9059, 4);
    mem.write8(0x2a, regs.a); m.step(0x905b, 3);
    if (regs.fPl) { m.step(0x905f, 3); }                              // bpl: $0121 positive, skip sign-extend
    else { m.step(0x905d, 2); { const r = regs.dec8(mem.read8(0x2b)); mem.write8(0x2b, r); } m.step(0x905f, 5); }
    regs.x = 0x01; regs.setNZ(regs.x); m.step(0x9061, 2);
    for (;;) {                                                        // dex/bpl loop -- 2 iterations (x: 1,0)
      regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0x9063, 3);
      regs.a = regs.asl(regs.a); m.step(0x9064, 2);                   // asl a: C <- bit7 of $2a
      { const r = regs.ror(mem.read8(0x2a)); mem.write8(0x2a, r); } m.step(0x9066, 5);
      { const r = regs.ror(mem.read8(0x29)); mem.write8(0x29, r); } m.step(0x9068, 5);
      regs.x = regs.dec8(regs.x); m.step(0x9069, 2);
      if (regs.fPl) { m.step(0x9061, 3); continue; }
      m.step(0x906b, 2); break;
    }
    regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x906d, 3);  // 24-bit accumulate into $69:$68:$0122
    regs.clc(); m.step(0x906e, 2);
    regs.adc(mem.read8(0x0122)); m.step(0x9071, 4);
    mem.write8(0x0122, regs.a); m.step(0x9074, 4);
    regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0x9076, 3);
    regs.adc(mem.read8(0x68)); m.step(0x9078, 3);
    mem.write8(0x68, regs.a); m.step(0x907a, 3);
    regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x907c, 3);
    regs.adc(mem.read8(0x69)); m.step(0x907e, 3);
    mem.write8(0x69, regs.a); m.step(0x9080, 3);
    regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0x9082, 3);  // 16-bit $5b:$5f += $18
    regs.clc(); m.step(0x9083, 2);
    regs.adc(0x18); m.step(0x9085, 2);
    mem.write8(0x5f, regs.a); m.step(0x9087, 3);
    regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0x9089, 3);
    regs.adc(0x00); m.step(0x908b, 2);
    mem.write8(0x5b, regs.a); m.step(0x908d, 3);
    regs.cmp(0xfc); m.step(0x908f, 2);
    if (regs.fNC) { m.step(0x9096, 3); }                             // bcc: high byte < $fc, no clamp
    else { m.step(0x9091, 2); regs.a = 0x01; regs.setNZ(regs.a); m.step(0x9093, 2); mem.write8(0x0115, regs.a); m.step(0x9096, 4); }
    regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0x9098, 3); // ($5b:$5f) - $5d, high-diff test
    regs.sec(); m.step(0x9099, 2);
    regs.sbc(mem.read8(0x5d)); m.step(0x909b, 3);
    regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0x909d, 3);
    if (regs.fZ) { m.step(0x90a1, 3); }                              // beq: $5b == 0, skip sbc #$ff
    else { m.step(0x909f, 2); regs.sbc(0xff); m.step(0x90a1, 2); }
    if (regs.fNZ) { m.step(0x90bc, 3); break L_90bc; }               // bne: nonzero high-diff -> tail
    m.step(0x90a3, 2);
    regs.a = mem.read8(0x5d); regs.setNZ(regs.a); m.step(0x90a5, 3);
    mem.write8(0x5f, regs.a); m.step(0x90a7, 3);
    regs.a = 0xff; regs.setNZ(regs.a); m.step(0x90a9, 2);
    mem.write8(0x5b, regs.a); m.step(0x90ab, 3);
    regs.a = 0x04; regs.setNZ(regs.a); m.step(0x90ad, 2);
    regs.bit(mem.read8(0x05)); m.step(0x90af, 3);
    if (regs.fN) { m.step(0x90b3, 3); }                              // bmi: bit7 of $05 set -> keep $04
    else { m.step(0x90b1, 2); regs.a = 0x08; regs.setNZ(regs.a); m.step(0x90b3, 2); }
    mem.write8(0x00, regs.a); m.step(0x90b5, 3);
    regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0x90b7, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x90b9, 2);
    mem.write8((0x0102 + regs.x) & 0xffff, regs.a); m.step(0x90bc, 5); // abs,x store: fixed 5
  }
  // L_90bc: epilogue + tail-delegate
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x90be, 2);
  mem.write8(0x0114, regs.a); m.step(0x90c1, 4);
  m.step(0x9749, 3); return m.call(0x9749); // jmp 0x9749 (tail, no push16)
}
