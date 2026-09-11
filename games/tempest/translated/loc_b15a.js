// SPDX-License-Identifier: GPL-3.0-only
// loc_b15a (ROM 0xb15a-0xb1b3) -- stashes A/X into $57/$56, copies $014d into the walking cursor $37,
// decrements $016e, then loops $37 from $014d up to $014e in steps of 2. Each pass: build Y from $37
// (asl x2 & $7f) and A from $37 (lsr x5) then jsr $df6c; pick a param -- 0 when $37 == $014d, else 3
// when (($37>>3) & 7) == 7 else the ($37>>3)&7 value -- into Y, load A=0x68, jsr $df4c; reload A/X from
// $57/$56, jsr $df39; advance $37 += 2 and loop while $37 < $014e. After the loop jsr $ab17 (X=0x2c,
// A=0xd0) then load A=0x3f,X=0xf2 and tail-jmp $df39. No POKEY/RNG read; no abs,x/abs,y load.
export function loc_b15a(m) {
  const { regs, mem } = m;
  mem.write8(0x57, regs.a); m.step(0xb15c, 3);
  mem.write8(0x56, regs.x); m.step(0xb15e, 3);
  regs.a = mem.read8(0x014d); regs.setNZ(regs.a); m.step(0xb161, 4);
  mem.write8(0x37, regs.a); m.step(0xb163, 3);
  { const v = regs.dec8(mem.read8(0x016e)); mem.write8(0x016e, v); m.step(0xb166, 6); } // dec 0x016e (abs RMW = 6)
  while (true) {
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xb168, 3);
    regs.a = regs.asl(regs.a); m.step(0xb169, 2);
    regs.a = regs.asl(regs.a); m.step(0xb16a, 2);
    regs.and(0x7f); m.step(0xb16c, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb16d, 2);   // tay
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xb16f, 3);
    regs.a = regs.lsr(regs.a); m.step(0xb170, 2);
    regs.a = regs.lsr(regs.a); m.step(0xb171, 2);
    regs.a = regs.lsr(regs.a); m.step(0xb172, 2);
    regs.a = regs.lsr(regs.a); m.step(0xb173, 2);
    regs.a = regs.lsr(regs.a); m.step(0xb174, 2);            // lsr a x5 -> $37 >> 5
    m.push16(0xb176); m.step(0xb177, 6); m.call(0xdf6c);     // jsr 0xdf6c (pushes 0xb176)
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xb179, 3);
    regs.cmp(mem.read8(0x014d)); m.step(0xb17c, 4);
    if (regs.fNZ) {
      m.step(0xb183, 3);                                     // bne 0xb183 taken ($37 != $014d)
      regs.a = regs.lsr(regs.a); m.step(0xb184, 2);
      regs.a = regs.lsr(regs.a); m.step(0xb185, 2);
      regs.a = regs.lsr(regs.a); m.step(0xb186, 2);          // lsr a x3 -> $37 >> 3
      m.step(0xb187, 2);                                     // nop
      regs.and(0x07); m.step(0xb189, 2);
      regs.cmp(0x07); m.step(0xb18b, 2);
      if (regs.fZ) { m.step(0xb18d, 2); regs.a = 0x03; regs.setNZ(regs.a); m.step(0xb18f, 2); } // bne not taken (==7): lda #0x03
      else { m.step(0xb18f, 3); }                            // bne 0xb18f taken (!= 7)
    } else {
      m.step(0xb17e, 2);                                     // bne not taken ($37 == $014d)
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb180, 2);
      regs.clv(); m.step(0xb181, 2);
      m.step(0xb18f, 3);                                     // bvc 0xb18f (unconditional join)
    }
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb190, 2);  // tay
    regs.a = 0x68; regs.setNZ(regs.a); m.step(0xb192, 2);
    m.push16(0xb194); m.step(0xb195, 6); m.call(0xdf4c);     // jsr 0xdf4c (pushes 0xb194)
    regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xb197, 3);
    regs.x = mem.read8(0x56); regs.setNZ(regs.x); m.step(0xb199, 3);
    m.push16(0xb19b); m.step(0xb19c, 6); m.call(0xdf39);     // jsr 0xdf39 (pushes 0xb19b)
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xb19e, 3);
    regs.clc(); m.step(0xb19f, 2);
    regs.adc(0x02); m.step(0xb1a1, 2);
    mem.write8(0x37, regs.a); m.step(0xb1a3, 3);
    regs.cmp(mem.read8(0x014e)); m.step(0xb1a6, 4);
    if (regs.fC) { m.step(0xb1a8, 2); break; }               // bcc not taken ($37 >= $014e): exit loop
    m.step(0xb166, 3);                                       // bcc 0xb166 taken: loop
  }
  regs.x = 0x2c; regs.setNZ(regs.x); m.step(0xb1aa, 2);
  regs.a = 0xd0; regs.setNZ(regs.a); m.step(0xb1ac, 2);
  m.push16(0xb1ae); m.step(0xb1af, 6); m.call(0xab17);       // jsr 0xab17 (pushes 0xb1ae)
  regs.a = 0x3f; regs.setNZ(regs.a); m.step(0xb1b1, 2);
  regs.x = 0xf2; regs.setNZ(regs.x); m.step(0xb1b3, 2);
  m.step(0xdf39, 3); return m.call(0xdf39);                  // jmp 0xdf39 (tail, abs jmp = 3)
}
