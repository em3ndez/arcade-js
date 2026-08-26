// SPDX-License-Identifier: GPL-3.0-only

// loc_3423  (ROM 0x3423-0x343d) -- enemy actor state-1 entry prologue. Advances the animation
// frame (call loc_4006), then on bit0 of (ix+0x01): when clear it gates on 0x8f63 and, if that is
// zero, clears (ix+0x01) and defers to loc_3473; when set it dispatches on (ix+0x08), tailing to
// loc_34f2 if non-zero. Otherwise it delegates into loc_343e (the routine ends at 0x343d).
export function loc_3423(m) {
  const { regs, mem } = m;

  m.push16(0x3426); m.step(0x4006, 17); m.call(0x4006); // call loc_4006
  regs.bit(0, mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x342a, 20); // bit 0,(ix+0x01)
  if (regs.fZ) {
    m.step(0x3437, 12);                              // jr z,0x3437
    regs.a = mem.read8((regs.ix + 0x08) & 0xffff);   m.step(0x343a, 19);
    regs.and(regs.a);                                m.step(0x343b, 4);  // and a
    if (regs.fNZ) { m.step(0x34f2, 10); return m.call(0x34f2); } // jp nz,0x34f2 (TAIL)
    m.step(0x343e, 10);                              // jp nz not taken -> fall into loc_343e
    return m.call(0x343e);                           // DELEGATE loc_343e
  }
  m.step(0x342c, 7);                                 // jr z not taken
  regs.a = mem.read8(0x8f63);                        m.step(0x342f, 13);
  regs.and(regs.a);                                  m.step(0x3430, 4);  // and a
  if (regs.fNZ) { return m.ret(11); }                // ret nz
  m.step(0x3431, 5);
  mem.write8((regs.ix + 0x01) & 0xffff, 0x00);       m.step(0x3435, 19); // ld (ix+0x01),0x00
  m.step(0x3473, 12); return m.call(0x3473);         // jr 0x3473 (TAIL)
}
