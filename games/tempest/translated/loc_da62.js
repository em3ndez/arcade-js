// SPDX-License-Identifier: GPL-3.0-only
// loc_da62  (ROM 0xda62-0xdaf7) -- the SELF-TEST main loop. Reached when loc_d93f's self-test-switch
// branch (and loc_da0a's tail) fall through here after the ROM-checksum / POKEY random-seed settle.
// A short one-time preamble (da62-da8b): calls $de11 (self-test setup), then -- if $01c9 (a pending
// request byte) is nonzero -- stashes it to $7c and calls $ddf1, clearing $01c9; seeds $00 from Y,
// copies an 8-byte color table ($daf9..) into colorram $0800-$0807, clears POKEY $60e0 and writes
// $10 to $4000 (coin/flip control). Then the NON-TERMINATING main loop (top = da8d):
//   * da8d-daa9: a 3kHz-sync drain -- Y=4 outer, X=0x14 inner, spinning bit $0c00 (N=bit7) to phase
//     with the video sync; kicks the watchdog ($5000) each Y pass and, if bit6 (V) of $0c00 stays
//     clear, reloads X ($da8f) -- then pulses the AVG reset ($5800) once Y underflows.
//   * daac-dac0: clears $74, sets $75/$60cb=$20, snapshots the option switches $60c8 -> $52 / low
//     nibble -> $50.
//   * dac0-dada: reads $0c00 (inputs), ~inverts and masks (#$2f -> $4e, #$28 test): if bits set it
//     shifts $4c and may double-bump $00, else reloads $4c=$20.
//   * dadc-dae2: JSR $db0f (select next self-test picture) + JSR $df0d (build AVG frame) then STA
//     $4800 (AVG GO).
//   * dae5-daed: every 4th frame ($03 & 3 == 0) calls $de1b.
//   * daf0-daf7: reads $0c00; while bit4 (self-test switch) stays clear, loops back to da8d; once it
//     changes, falls to `bne 0xdaf7` -- an intentional forever-hang until the watchdog reboots.
// So the routine never returns: modeled as an outer `for(;;)` whose only fall-out is the daf7 spin
// (itself an inner `for(;;)`). All calls (de11, ddf1, db0f, df0d, de1b) are already translated; each
// JSR keeps its m.push16 of the 6502 return address.
export function loc_da62(m) {
  const { regs, mem } = m;

  // ---- one-time preamble (da62-da8b) ----
  m.push16(0xda64); m.step(0xda65, 6); m.call(0xde11);
  regs.y = 0x02; regs.setNZ(regs.y); m.step(0xda67, 2);
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xda6a, 4);
  if (regs.fZ) { m.step(0xda76, 3); }
  else {
    m.step(0xda6c, 2);
    mem.write8(0x7c, regs.a); m.step(0xda6e, 3);
    m.push16(0xda70); m.step(0xda71, 6); m.call(0xddf1);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xda73, 2);
    mem.write8(0x01c9, regs.y); m.step(0xda76, 4);
  }
  mem.write8(0x00, regs.y); m.step(0xda78, 3);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xda7a, 2);
  for (;;) {
    { const base = 0xdaf9; const addr = (base + regs.x) & 0xffff;
      const cross = (base & 0xff00) !== (addr & 0xff00);
      regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xda7d, 4 + (cross ? 1 : 0)); }
    mem.write8((0x0800 + regs.x) & 0xffff, regs.a); m.step(0xda80, 5);
    regs.x = regs.dec8(regs.x); m.step(0xda81, 2);
    if (regs.fPl) { m.step(0xda7a, 3); continue; }
    m.step(0xda83, 2); break;
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xda85, 2);
  mem.write8(0x60e0, regs.a); m.step(0xda88, 4);
  regs.a = 0x10; regs.setNZ(regs.a); m.step(0xda8a, 2);
  mem.write8(0x4000, regs.a); m.step(0xda8d, 4);

  // ---- non-terminating self-test main loop (top = da8d) ----
  for (;;) {
    regs.y = 0x04; regs.setNZ(regs.y); m.step(0xda8f, 2);
    for (;;) {
      regs.x = 0x14; regs.setNZ(regs.x); m.step(0xda91, 2);
      for (;;) {
        do { regs.bit(mem.read8(0x0c00)); m.step(0xda94, 4);
             if (!regs.fN) { m.step(0xda91, 3); } else { m.step(0xda96, 2); }
        } while (!regs.fN);
        do { regs.bit(mem.read8(0x0c00)); m.step(0xda99, 4);
             if (regs.fN) { m.step(0xda96, 3); } else { m.step(0xda9b, 2); }
        } while (regs.fN);
        regs.x = regs.dec8(regs.x); m.step(0xda9c, 2);
        if (regs.fPl) { m.step(0xda91, 3); continue; }
        m.step(0xda9e, 2); break;
      }
      regs.y = regs.dec8(regs.y); m.step(0xda9f, 2);
      if (regs.fN) { m.step(0xdaa9, 3); break; }
      m.step(0xdaa1, 2);
      mem.write8(0x5000, regs.a); m.step(0xdaa4, 4);
      regs.bit(mem.read8(0x0c00)); m.step(0xdaa7, 4);
      if (regs.fNV) { m.step(0xda8f, 3); continue; }
      m.step(0xdaa9, 2); break;
    }
    mem.write8(0x5800, regs.a); m.step(0xdaac, 4);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdaae, 2);
    mem.write8(0x74, regs.a); m.step(0xdab0, 3);
    regs.a = 0x20; regs.setNZ(regs.a); m.step(0xdab2, 2);
    mem.write8(0x75, regs.a); m.step(0xdab4, 3);
    mem.write8(0x60cb, regs.a); m.step(0xdab7, 4);
    regs.a = mem.read8(0x60c8); regs.setNZ(regs.a); m.step(0xdaba, 4);
    mem.write8(0x52, regs.a); m.step(0xdabc, 3);
    regs.and(0x0f); m.step(0xdabe, 2);
    mem.write8(0x50, regs.a); m.step(0xdac0, 3);
    regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xdac3, 4);
    regs.eor(0xff); m.step(0xdac5, 2);
    regs.and(0x2f); m.step(0xdac7, 2);
    mem.write8(0x4e, regs.a); m.step(0xdac9, 3);
    regs.and(0x28); m.step(0xdacb, 2);
    if (regs.fZ) {
      m.step(0xdad8, 3);
      regs.a = 0x20; regs.setNZ(regs.a); m.step(0xdada, 2);
      mem.write8(0x4c, regs.a); m.step(0xdadc, 3);
    } else {
      m.step(0xdacd, 2);
      mem.write8(0x4c, regs.asl(mem.read8(0x4c))); m.step(0xdacf, 5);
      if (regs.fNC) { m.step(0xdad5, 2); }
      else {
        m.step(0xdad1, 2);
        mem.write8(0x00, regs.inc8(mem.read8(0x00))); m.step(0xdad3, 5);
        mem.write8(0x00, regs.inc8(mem.read8(0x00))); m.step(0xdad5, 5);
      }
      regs.clv(); m.step(0xdad6, 2);
      m.step(0xdadc, 3);                                                              // dad6 bvc 0xdadc (always -- V clear)
    }
    m.push16(0xdade); m.step(0xdadf, 6); m.call(0xdb0f);
    m.push16(0xdae1); m.step(0xdae2, 6); m.call(0xdf0d);
    mem.write8(0x4800, regs.a); m.step(0xdae5, 4);
    mem.write8(0x03, regs.inc8(mem.read8(0x03))); m.step(0xdae7, 5);
    regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xdae9, 3);
    regs.and(0x03); m.step(0xdaeb, 2);
    if (regs.fNZ) { m.step(0xdaf0, 3); }
    else {
      m.step(0xdaed, 2);
      m.push16(0xdaef); m.step(0xdaf0, 6); m.call(0xde1b);
    }
    regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xdaf3, 4);
    regs.and(0x10); m.step(0xdaf5, 2);
    if (regs.fZ) { m.step(0xda8d, 3); continue; }                                     // daf5 beq 0xda8d (loop -- switch unchanged)
    m.step(0xdaf7, 2);                                                                // daf5 beq (fall -- switch changed)
    for (;;) { m.step(0xdaf7, 3); }
  }
}
