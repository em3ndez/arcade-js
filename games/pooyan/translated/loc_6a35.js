// SPDX-License-Identifier: GPL-3.0-only

// loc_6a35  (ROM 0x6a35-0x6a7e) -- per-record spawn/init reached by loc_6a0f's 18-record sweep. Skips
// an already-active record ((ix+0)|(ix+1) bit0 SET -> ret c). Spawns into an empty one: activates the ix record, seeds its
// fields, arms the (0x892a) delay to 0x10, then reads-and-bumps the (0x892c) phase and picks the spawn
// data pointer DE by that phase: 0->0x76d4, 1->0x76d4 (and re-arms (0x892a) to 0x1c), 2->0x68ef,
// >=3->0x6b0a. Hands DE to loc_381e, then the shared pop-af/ret returns to the caller's caller.
export function loc_6a35(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x6a38, 19);
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x6a3b, 19);
  regs.rrca();                                   m.step(0x6a3c, 4);
  if (regs.fC) { return m.ret(11); }             // ret c -- record already active, skip
  m.step(0x6a3d, 5);

  regs.xor(regs.a);                              m.step(0x6a3e, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x6a41, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x6a44, 19);
  regs.a = regs.inc8(regs.a);                    m.step(0x6a45, 4);  // -> 1, activate
  mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x6a48, 19); // activate ix record
  mem.write8((regs.ix + 0x02) & 0xffff, regs.a); m.step(0x6a4b, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, 0x15);   m.step(0x6a4f, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, 0x1e);   m.step(0x6a53, 19);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x28);   m.step(0x6a57, 19);
  regs.hl = 0x892a;                              m.step(0x6a5a, 10);
  mem.write8(regs.hl, 0x10);                     m.step(0x6a5c, 10); // (0x892a) := delay
  regs.l = 0x2c;                                 m.step(0x6a5e, 7);  // hl -> 0x892c
  regs.a = mem.read8(regs.hl);                   m.step(0x6a5f, 7);  // phase (pre-bump)
  regs.incMem8(mem, regs.hl);                    m.step(0x6a60, 11); // (0x892c)++
  regs.cp(0x02);                                 m.step(0x6a62, 7);
  if (regs.fZ) {                                 // phase == 2
    m.step(0x6a72, 12);                          // jr z taken
    regs.de = 0x68ef;                            m.step(0x6a75, 10);
    m.step(0x6a7a, 12);                          // jr 0x6a7a
  } else {
    m.step(0x6a64, 7);                           // jr z not taken
    if (regs.fNC) {                              // phase > 2
      m.step(0x6a77, 12);                        // jr nc taken
      regs.de = 0x6b0a;                          m.step(0x6a7a, 10); // ld de,0x6b0a -> falls to 0x6a7a
    } else {                                     // phase < 2 (0 or 1)
      m.step(0x6a66, 7);                         // jr nc not taken
      regs.and(regs.a);                          m.step(0x6a67, 4);
      if (regs.fNZ) {                            // phase == 1
        m.step(0x6a69, 7);                       // jr z not taken
        regs.l = 0x2a;                           m.step(0x6a6b, 7);  // hl -> 0x892a
        mem.write8(regs.hl, 0x1c);               m.step(0x6a6d, 10); // (0x892a) := 0x1c
        regs.de = 0x76d4;                        m.step(0x6a70, 10);
        m.step(0x6a7a, 12);                      // jr 0x6a7a
      } else {                                   // phase == 0
        m.step(0x6a6d, 12);                      // jr z taken
        regs.de = 0x76d4;                        m.step(0x6a70, 10);
        m.step(0x6a7a, 12);                      // jr 0x6a7a
      }
    }
  }

  m.push16(0x6a7d); m.step(0x381e, 17); m.call(0x381e); // call 0x381e
  regs.af = m.pop16();                           m.step(0x6a7e, 10); // pop af -- drop caller return
  return m.ret();                                // ret -- to caller's caller
}
