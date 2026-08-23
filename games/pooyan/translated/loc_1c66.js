// SPDX-License-Identifier: GPL-3.0-only

// loc_1c66  (ROM 0x1c66-0x1ce6) -- 0x15a8-table dispatch handler (round-clear / game-over /
// player-swap / teardown master). Ticks the (0x8808) phase timer; when (0x8e2a) is armed and the
// timer expires it runs a 0x82bc checksum (byte sum C must equal 0xaa) that gates a re-init, then
// branches on the (0x880e)/(0x880d)/(0x8948) flags to one of the SPLIT-OUT tails: loc_1d15 (full
// clear), loc_1cf6 (reseed the other player), or -- reseeding a player in place -- falls through
// into loc_1ce7 (sprite-slot tail). Unarmed / not-yet-expired path runs loc_7e94, maybe steps 0x89ff.
export function loc_1c66(m) {
  const { regs, mem } = m;

  regs.hl = 0x8808;             m.step(0x1c69, 10);
  regs.decMem8(mem, regs.hl);   m.step(0x1c6a, 11); // dec (0x8808) -- phase timer
  regs.a = mem.read8(0x8e2a);   m.step(0x1c6d, 13);
  regs.and(regs.a);             m.step(0x1c6e, 4);

  block1c9c: {
    if (regs.fZ) {
      m.step(0x1c74, 12);                             // jr z,0x1c74 -- (0x8e2a) not armed
    } else {
      m.step(0x1c70, 7);
      regs.a = mem.read8(regs.hl);  m.step(0x1c71, 7);
      regs.and(regs.a);             m.step(0x1c72, 4);
      if (regs.fZ) { m.step(0x1c9c, 12); break block1c9c; } // jr z,0x1c9c -- timer expired
      m.step(0x1c74, 7);
    }
    // 0x1c74: not re-initialising this tick -> loc_7e94, then maybe advance the 0x89ff step
    m.push16(0x1c77); m.step(0x7e94, 17); m.call(0x7e94);
    regs.a = mem.read8(0x89fc);   m.step(0x1c7a, 13);
    regs.and(regs.a);             m.step(0x1c7b, 4);
    if (regs.fZ) { return m.ret(11); }               // ret z -- (0x89fc) clear
    m.step(0x1c7c, 5);
    regs.a = mem.read8(0x8808);   m.step(0x1c7f, 13);
    regs.and(0x07);               m.step(0x1c81, 7);
    if (regs.fNZ) { return m.ret(11); }              // ret nz -- only every 8th tick
    m.step(0x1c82, 5);
    regs.a = mem.read8(0x89ff);   m.step(0x1c85, 13);
    regs.hl = mem.read16(0x89fd); m.step(0x1c88, 16); // ld hl,(0x89fd)
    regs.de = 0x0020;             m.step(0x1c8b, 10);
    regs.b = 0x1c;                m.step(0x1c8d, 7);
    for (;;) {                                        // fill 0x1c cells (stride +0x20) with (0x89ff)
      mem.write8(regs.hl, regs.a);  m.step(0x1c8e, 7);
      regs.addHl(regs.de);          m.step(0x1c8f, 11);
      if (regs.djnz() !== 0) { m.step(0x1c8d, 13); continue; }
      m.step(0x1c91, 8);
      break;
    }
    regs.a = regs.inc8(regs.a);   m.step(0x1c92, 4);
    regs.cp(0x10);                m.step(0x1c94, 7);
    if (regs.fC) { m.step(0x1c98, 12); }             // jr c,0x1c98
    else { m.step(0x1c96, 7); regs.a = 0x06; m.step(0x1c98, 7); } // clamp the step to 0x06
    mem.write8(0x89ff, regs.a);   m.step(0x1c9b, 13);
    return m.ret();
  }

  // 0x1c9c: timer expired -> write 0x10 to 8 cells at 0x855f, then checksum 0x82bc (0x0a bytes)
  regs.hl = 0x855f;            m.step(0x1c9f, 10);
  regs.de = 0xffe0;            m.step(0x1ca2, 10);
  regs.b = 0x08;               m.step(0x1ca4, 7);
  for (;;) {
    regs.a = 0x10;             m.step(0x1ca6, 7);
    mem.write8(regs.hl, regs.a);  m.step(0x1ca7, 7);
    regs.addHl(regs.de);          m.step(0x1ca8, 11); // stride -0x20
    if (regs.djnz() !== 0) { m.step(0x1ca4, 13); continue; }
    m.step(0x1caa, 8);
    break;
  }
  regs.hl = 0x82bc;            m.step(0x1cad, 10);
  regs.de = 0xffe0;            m.step(0x1cb0, 10);
  regs.bc = 0x0a00;            m.step(0x1cb3, 10);   // B=0x0a count, C=0 accumulator
  for (;;) {                                         // C = sum of the 0x0a bytes (stride -0x20)
    regs.a = mem.read8(regs.hl);  m.step(0x1cb4, 7);
    regs.add(regs.c);             m.step(0x1cb5, 4);
    regs.c = regs.a;              m.step(0x1cb6, 4);
    regs.addHl(regs.de);          m.step(0x1cb7, 11);
    if (regs.djnz() !== 0) { m.step(0x1cb3, 13); continue; }
    m.step(0x1cb9, 8);
    break;
  }
  regs.a = regs.c;             m.step(0x1cba, 4);
  regs.cp(0xaa);               m.step(0x1cbc, 7);
  if (regs.fNZ) { return m.ret(11); }                // ret nz -- checksum mismatch, abort re-init
  m.step(0x1cbd, 5);
  regs.xor(regs.a);            m.step(0x1cbe, 4);
  mem.write8(0x8e2a, regs.a);  m.step(0x1cc1, 13);   // disarm (0x8e2a)

  regs.a = mem.read8(0x880e);  m.step(0x1cc4, 13);
  regs.and(regs.a);            m.step(0x1cc5, 4);
  if (regs.fZ) { m.step(0x1d15, 12); return m.call(0x1d15); } // jr z,0x1d15 -- (0x880e) clear
  m.step(0x1cc7, 7);
  regs.a = mem.read8(0x880d);  m.step(0x1cca, 13);
  regs.and(regs.a);            m.step(0x1ccb, 4);
  if (regs.fZ) { m.step(0x1cf6, 12); return m.call(0x1cf6); } // jr z,0x1cf6 -- (0x880d) clear
  m.step(0x1ccd, 7);
  regs.a = mem.read8(0x8948);  m.step(0x1cd0, 13);
  regs.and(regs.a);            m.step(0x1cd1, 4);
  if (regs.fZ) { m.step(0x1d15, 12); return m.call(0x1d15); } // jr z,0x1d15 -- (0x8948) clear
  m.step(0x1cd3, 7);
  regs.xor(regs.a);            m.step(0x1cd4, 4);
  mem.write8(0x880d, regs.a);  m.step(0x1cd7, 13);
  mem.write8(0x880a, regs.a);  m.step(0x1cda, 13);
  regs.hl = 0x8980;            m.step(0x1cdd, 10);
  regs.b = 0x3f;               m.step(0x1cdf, 7);
  m.push16(0x1ce0); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 -- fill 0x8980.. (B=0x3f)
  regs.a = regs.inc8(regs.a);  m.step(0x1ce1, 4);
  mem.write8(0x881f, regs.a);  m.step(0x1ce4, 13);
  m.push16(0x1ce7); m.step(0x02e3, 17); m.call(0x02e3);
  return m.call(0x1ce7);       // fall into loc_1ce7 (sprite-slot tail) -- its ret returns to caller
}
