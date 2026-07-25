// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_08f8  (ROM 0x08F8–0x095D) — arm 1 of 0x08B2's table; exits the sub-state machine.
 *
 * Consumes loc_08d5's RETURN VALUE in A (= mem[0x7D00] & B), then:
 *   A == 0x04 -> loc_0906 (zero 8 bytes at 0x6048, HL = 0x0000) -> loc_0938
 *   A == 0x08 -> loc_0919 (0x0977 TWICE, copy block to 0x6048, HL = 0x0100) -> loc_0938
 *   else      -> ret, having changed NOTHING (A == 0x0C also lands here)
 *
 * loc_0938 is a SHARED TAIL entered with arm-dependent HL, stored to 0x600E. It ENDS the
 * machine: 0x600A = 0 (this dispatcher's selector) and 0x6005 = 3 (GAME STATE advance).
 * The two ldir blocks (0x091F.. arm-2, 0x093E.. tail) differ ONLY in DE = 0x6048/0x0101
 * vs 0x6040/0x0100 (verified byte-exact vs ROM). The ldir source at 0x095E is live DATA,
 * read twice (tracer marks it "unreached" = not executed, not dead).
 */
export function loc_08f8(m) {
  const { regs, mem } = m;

  m.push16(0x08fb);
  m.step(0x08d5, 17);
  m.call(0x08d5); // A = mem[0x7D00] & B -- the return VALUE is what we test

  regs.cp(0x04);
  m.step(0x08fd, 7); // cp 0x04 -- overwrites loc_08d5's flags
  const isFour = regs.fZ;
  m.step(isFour ? 0x0906 : 0x0900, 10); // jp z,0x0906

  if (isFour) {
    // -- loc_0906 --
    m.push16(0x0909);
    m.step(0x0977, 17);
    m.call(0x0977);
    regs.hl = 0x6048;
    m.step(0x090c, 10); // ld hl,0x6048
    regs.b = 0x08;
    m.step(0x090e, 7); // ld b,0x08
    regs.xor(regs.a); // A = 0
    m.step(0x090f, 4);
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x0910, 7); // ld (hl),a
      regs.l = regs.inc8(regs.l); // inc l -- 8-bit
      m.step(0x0911, 4);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x090f : 0x0913, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.hl = 0x0000; // the JOIN value for this arm
    m.step(0x0916, 10); // ld hl,0x0000
    m.step(0x0938, 10); // jp 0x0938
  } else {
    regs.cp(0x08);
    m.step(0x0902, 7); // cp 0x08
    if (!regs.fZ) {
      m.step(0x0905, 10); // jp z NOT taken
      m.ret(); // does NOTHING -- and A == 0x0C lands here too
      return;
    }
    // -- loc_0919 --
    m.step(0x0919, 10);
    m.push16(0x091c);
    m.step(0x0977, 17);
    m.call(0x0977); // FIRST call
    m.push16(0x091f);
    m.step(0x0977, 17);
    m.call(0x0977); // SECOND call -- not a duplicate

    regs.de = 0x6048; // <-- 0x6048 HERE; the tail uses 0x6040
    m.step(0x0922, 10);
    regs.a = mem.read8(0x6020);
    m.step(0x0925, 13);
    mem.write8(regs.de, regs.a);
    m.step(0x0926, 7); // ld (de),a
    regs.e = regs.inc8(regs.e); // inc e -- 8-bit
    m.step(0x0927, 4);
    regs.hl = 0x095e; // the "unreached"-labelled data
    m.step(0x092a, 10);
    regs.bc = 0x0007;
    m.step(0x092d, 10);
    m.ldir(0x092f); // ldir -- a LOOP

    regs.de = 0x0101; // <-- 0x0101 HERE; the tail uses 0x0100
    m.step(0x0932, 10);
    m.push16(0x0935);
    m.step(0x309f, 17);
    m.call(0x309f);
    regs.hl = 0x0100; // the JOIN value for this arm
    m.step(0x0938, 10); // ld hl,0x0100
  }

  // -- loc_0938: SHARED TAIL, HL is arm-dependent --
  mem.write16(0x600e, regs.hl); // ld (nn),hl -- 16-bit, writes 0x600E AND 0x600F
  m.step(0x093b, 16);
  m.push16(0x093e);
  m.step(0x0874, 17);
  m.call(0x0874); // edge -- not mine

  regs.de = 0x6040; // <-- 0x6040, NOT 0x6048
  m.step(0x0941, 10);
  regs.a = mem.read8(0x6020);
  m.step(0x0944, 13);
  mem.write8(regs.de, regs.a);
  m.step(0x0945, 7); // ld (de),a
  regs.e = regs.inc8(regs.e);
  m.step(0x0946, 4); // inc e
  regs.hl = 0x095e;
  m.step(0x0949, 10);
  regs.bc = 0x0007;
  m.step(0x094c, 10);
  m.ldir(0x094e);

  regs.de = 0x0100; // <-- 0x0100, NOT 0x0101
  m.step(0x0951, 10);
  m.push16(0x0954);
  m.step(0x309f, 17);
  m.call(0x309f);

  regs.xor(regs.a); // A = 0
  m.step(0x0955, 4);
  mem.write8(0x600a, regs.a); // reset THIS dispatcher's selector
  m.step(0x0958, 13);
  regs.a = 0x03;
  m.step(0x095a, 7);
  mem.write8(0x6005, regs.a); // ADVANCE THE GAME STATE
  m.step(0x095d, 13);
  m.ret();
}
