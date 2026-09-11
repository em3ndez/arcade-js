// SPDX-License-Identifier: GPL-3.0-only
// loc_d93f  (ROM 0xd93f-0xdb0e) -- RESET entry: SEI, watchdog strobe, stack init, RAM clear
// (pages $00-$07 + $20-$2f), EAROM/POKEY register clear, then per the self-test DIP ($0c00 bit4):
//   bit4 SET  -> power-on delay, jsr $de11/$abac/$c16e, CLI, JMP $c7a0 (normal game start; terminates).
//   bit4 CLEAR-> self-test: page-1 stack-RAM walk, zero-page march, ROM checksum, POKEY debounce,
//                copy $daf9 table -> $0800, then the vblank-synced MAIN LOOP ($da8d, never returns).
// NOTE: the beq at $d988 lands at $d9a9 MID one of the disassembler's instructions (bytes a0 a2 at
// $d9a8 disassemble as `ldy #$a2`, but real execution enters at $d9a9 = `ldx #$11`); translated from
// the true instruction stream. The self-test path is non-terminating (hardware-driven main loop +
// $0c00 vblank/watchdog polls) -- see needs_attention; only the normal-boot fall-through returns.
export function loc_d93f(m) {
  const { regs, mem } = m;
  regs.sei(); m.step(0xd940, 2);
  mem.write8(0x5000, regs.a); m.step(0xd943, 4);
  mem.write8(0x5800, regs.a); m.step(0xd946, 4);
  regs.x = 0xff; regs.setNZ(0xff); m.step(0xd948, 2);
  regs.s = regs.x; m.step(0xd949, 2);
  regs.cld(); m.step(0xd94a, 2);
  regs.x = regs.inc8(regs.x); m.step(0xd94b, 2);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xd94c, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd94d, 2);
  // ----- RAM clear outer loop (d94d..d964): clears pages $00-$07 then $20-$2f -----
  do {
    mem.write8(0x00, regs.y); m.step(0xd94f, 3);
    mem.write8(0x01, regs.x); m.step(0xd951, 3);
    regs.y = 0x00; regs.setNZ(0x00); m.step(0xd953, 2);
    do {
      { const ptr = mem.read8(0x00) | (mem.read8(0x01) << 8);
        mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xd955, 6); }
      regs.y = regs.inc8(regs.y); m.step(0xd956, 2);
      if (regs.fNZ) { m.step(0xd953, 3); } else { m.step(0xd958, 2); break; }
    } while (true);
    regs.x = regs.inc8(regs.x); m.step(0xd959, 2);
    regs.cpx(0x08); m.step(0xd95b, 2);
    if (regs.fNZ) { m.step(0xd95f, 3); } else {
      m.step(0xd95d, 2);
      regs.x = 0x20; regs.setNZ(0x20); m.step(0xd95f, 2);
    }
    regs.cpx(0x30); m.step(0xd961, 2);
    mem.write8(0x5000, regs.a); m.step(0xd964, 4);
    if (regs.fNC) { m.step(0xd94d, 3); } else { m.step(0xd966, 2); break; }
  } while (true);
  mem.write8(0x01, regs.a); m.step(0xd968, 3);
  mem.write8(0x60e0, regs.a); m.step(0xd96b, 4);
  mem.write8(0x60cf, regs.a); m.step(0xd96e, 4);
  mem.write8(0x60df, regs.a); m.step(0xd971, 4);
  regs.x = 0x07; regs.setNZ(0x07); m.step(0xd973, 2);
  mem.write8(0x60cf, regs.x); m.step(0xd976, 4);
  mem.write8(0x60df, regs.x); m.step(0xd979, 4);
  regs.x = regs.inc8(regs.x); m.step(0xd97a, 2);
  do {
    mem.write8((0x60c0 + regs.x) & 0xffff, regs.a); m.step(0xd97d, 5);
    mem.write8((0x60d0 + regs.x) & 0xffff, regs.a); m.step(0xd980, 5);
    regs.x = regs.dec8(regs.x); m.step(0xd981, 2);
    if (regs.fPl) { m.step(0xd97a, 3); } else { m.step(0xd983, 2); break; }
  } while (true);
  regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xd986, 4);
  regs.and(0x10); m.step(0xd988, 2);
  if (regs.fZ) {
    m.step(0xd9a9, 3);
    // ============ SELF-TEST PATH (d9a9..daf7); overlapping-code entry, see header ============
    regs.x = 0x11; regs.setNZ(0x11); m.step(0xd9ab, 2);
    do {
      regs.s = regs.x; m.step(0xd9ac, 2);
      regs.y = 0x00; regs.setNZ(0x00); m.step(0xd9ae, 2);
      do {
        regs.x = regs.s; regs.setNZ(regs.x); m.step(0xd9af, 2);
        mem.write8((0x00 + regs.y) & 0xff, regs.x); m.step(0xd9b1, 4);
        regs.x = 0x01; regs.setNZ(0x01); m.step(0xd9b3, 2);
        do {
          regs.y = regs.inc8(regs.y); m.step(0xd9b4, 2);
          { const base = 0x0000; const addr = (base + regs.y) & 0xffff;
            const cross = (base & 0xff00) !== (addr & 0xff00);
            regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xd9b7, 4 + (cross ? 1 : 0)); }
          if (regs.fZ) { m.step(0xd9bc, 3); } else {
            m.step(0xd9b9, 2);
            m.step(0xd8ca, 3); return m.call(0xd8ca);
          }
          regs.x = regs.inc8(regs.x); m.step(0xd9bd, 2);
          if (regs.fNZ) { m.step(0xd9b3, 3); } else { m.step(0xd9bf, 2); break; }
        } while (true);
        regs.x = regs.s; regs.setNZ(regs.x); m.step(0xd9c0, 2);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0xd9c1, 2);
        mem.write8(0x5000, regs.a); m.step(0xd9c4, 4);
        regs.y = regs.inc8(regs.y); m.step(0xd9c5, 2);
        { const base = 0x0000; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00);
          regs.eor(mem.read8(addr)); m.step(0xd9c8, 4 + (cross ? 1 : 0)); }
        if (regs.fNZ) {
          m.step(0xd9b9, 3);
          m.step(0xd8ca, 3); return m.call(0xd8ca);
        }
        m.step(0xd9ca, 2);
        mem.write8((0x0000 + regs.y) & 0xffff, regs.a); m.step(0xd9cd, 5);
        regs.y = regs.inc8(regs.y); m.step(0xd9ce, 2);
        if (regs.fNZ) { m.step(0xd9ae, 3); } else { m.step(0xd9d0, 2); break; }
      } while (true);
      regs.x = regs.s; regs.setNZ(regs.x); m.step(0xd9d1, 2);
      regs.a = regs.x; regs.setNZ(regs.a); m.step(0xd9d2, 2);
      regs.a = regs.asl(regs.a); m.step(0xd9d3, 2);
      regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd9d4, 2);
      if (regs.fNC) { m.step(0xd9ab, 3); } else { m.step(0xd9d6, 2); break; }
    } while (true);
    regs.y = 0x00; regs.setNZ(0x00); m.step(0xd9d8, 2);
    regs.x = 0x01; regs.setNZ(0x01); m.step(0xd9da, 2);
    do {
      mem.write8(0x00, regs.y); m.step(0xd9dc, 3);
      mem.write8(0x01, regs.x); m.step(0xd9de, 3);
      regs.y = 0x00; regs.setNZ(0x00); m.step(0xd9e0, 2);
      do {
        { const ptr = mem.read8(0x00) | (mem.read8(0x01) << 8);
          const addr = (ptr + regs.y) & 0xffff;
          const cross = (ptr & 0xff00) !== (addr & 0xff00);
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xd9e2, 5 + (cross ? 1 : 0)); }
        if (regs.fZ) { m.step(0xd9e7, 3); } else {
          m.step(0xd9e4, 2);
          m.step(0xd931, 3); return m.call(0xd931);
        }
        regs.a = 0x11; regs.setNZ(0x11); m.step(0xd9e9, 2);
        do {
          { const ptr = mem.read8(0x00) | (mem.read8(0x01) << 8);
            mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xd9eb, 6); }
          { const ptr = mem.read8(0x00) | (mem.read8(0x01) << 8);
            const addr = (ptr + regs.y) & 0xffff;
            const cross = (ptr & 0xff00) !== (addr & 0xff00);
            regs.cmp(mem.read8(addr)); m.step(0xd9ed, 5 + (cross ? 1 : 0)); }
          if (regs.fZ) { m.step(0xd9f2, 3); } else {
            m.step(0xd9ef, 2);
            m.step(0xd92f, 3); return m.call(0xd92f);
          }
          regs.a = regs.asl(regs.a); m.step(0xd9f3, 2);
          if (regs.fNC) { m.step(0xd9e9, 3); } else { m.step(0xd9f5, 2); break; }
        } while (true);
        regs.a = 0x00; regs.setNZ(0x00); m.step(0xd9f7, 2);
        { const ptr = mem.read8(0x00) | (mem.read8(0x01) << 8);
          mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xd9f9, 6); }
        regs.y = regs.inc8(regs.y); m.step(0xd9fa, 2);
        if (regs.fNZ) { m.step(0xd9e0, 3); } else { m.step(0xd9fc, 2); break; }
      } while (true);
      mem.write8(0x5000, regs.a); m.step(0xd9ff, 4);
      regs.x = regs.inc8(regs.x); m.step(0xda00, 2);
      regs.cpx(0x08); m.step(0xda02, 2);
      if (regs.fNZ) { m.step(0xda06, 3); } else {
        m.step(0xda04, 2);
        regs.x = 0x20; regs.setNZ(0x20); m.step(0xda06, 2);
      }
      regs.cpx(0x30); m.step(0xda08, 2);
      if (regs.fNC) { m.step(0xd9da, 3); } else { m.step(0xda0a, 2); break; }
    } while (true);
    regs.a = 0x00; regs.setNZ(0x00); m.step(0xda0c, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xda0d, 2);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xda0e, 2);
    mem.write8(0x3b, regs.a); m.step(0xda10, 3);
    regs.a = 0x30; regs.setNZ(0x30); m.step(0xda12, 2);
    mem.write8(0x3c, regs.a); m.step(0xda14, 3);
    do {
      regs.a = 0x08; regs.setNZ(0x08); m.step(0xda16, 2);
      mem.write8(0x38, regs.a); m.step(0xda18, 3);
      regs.a = regs.x; regs.setNZ(regs.a); m.step(0xda19, 2);
      do {
        do {
          { const ptr = mem.read8(0x3b) | (mem.read8(0x3c) << 8);
            const addr = (ptr + regs.y) & 0xffff;
            const cross = (ptr & 0xff00) !== (addr & 0xff00);
            regs.eor(mem.read8(addr)); m.step(0xda1b, 5 + (cross ? 1 : 0)); }
          regs.y = regs.inc8(regs.y); m.step(0xda1c, 2);
          if (regs.fNZ) { m.step(0xda19, 3); } else { m.step(0xda1e, 2); break; }
        } while (true);
        mem.write8(0x3c, regs.inc8(mem.read8(0x3c))); m.step(0xda20, 5);
        mem.write8(0x5000, regs.a); m.step(0xda23, 4);
        mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xda25, 5);
        if (regs.fNZ) { m.step(0xda19, 3); } else { m.step(0xda27, 2); break; }
      } while (true);
      mem.write8((0x7d + regs.x) & 0xff, regs.a); m.step(0xda29, 4);
      regs.x = regs.inc8(regs.x); m.step(0xda2a, 2);
      regs.cpx(0x02); m.step(0xda2c, 2);
      if (regs.fNZ) { m.step(0xda32, 3); } else {
        m.step(0xda2e, 2);
        regs.a = 0x90; regs.setNZ(0x90); m.step(0xda30, 2);
        mem.write8(0x3c, regs.a); m.step(0xda32, 3);
      }
      regs.cpx(0x0c); m.step(0xda34, 2);
      if (regs.fNC) { m.step(0xda14, 3); } else { m.step(0xda36, 2); break; }
    } while (true);
    regs.a = mem.read8(0x7d); regs.setNZ(regs.a); m.step(0xda38, 3);
    if (regs.fZ) { m.step(0xda44, 3); } else {
      m.step(0xda3a, 2);
      regs.a = 0x40; regs.setNZ(0x40); m.step(0xda3c, 2);
      regs.x = 0xa4; regs.setNZ(0xa4); m.step(0xda3e, 2);
      mem.write8(0x60c4, regs.a); m.step(0xda41, 4);
      mem.write8(0x60c5, regs.x); m.step(0xda44, 4);
    }
    regs.x = 0x05; regs.setNZ(0x05); m.step(0xda46, 2);
    regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xda49, 4);
    let stable1 = true;
    do {
      regs.cmp(mem.read8(0x60ca)); m.step(0xda4c, 4);
      if (regs.fNZ) { m.step(0xda53, 3); stable1 = false; break; }
      m.step(0xda4e, 2);
      regs.x = regs.dec8(regs.x); m.step(0xda4f, 2);
      if (regs.fPl) { m.step(0xda49, 3); } else { m.step(0xda51, 2); break; }
    } while (true);
    if (stable1) { mem.write8(0x7a, regs.a); m.step(0xda53, 3); }
    regs.x = 0x05; regs.setNZ(0x05); m.step(0xda55, 2);
    regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xda58, 4);
    let stable2 = true;
    do {
      regs.cmp(mem.read8(0x60da)); m.step(0xda5b, 4);
      if (regs.fNZ) { m.step(0xda62, 3); stable2 = false; break; }
      m.step(0xda5d, 2);
      regs.x = regs.dec8(regs.x); m.step(0xda5e, 2);
      if (regs.fPl) { m.step(0xda58, 3); } else { m.step(0xda60, 2); break; }
    } while (true);
    if (stable2) { mem.write8(0x7b, regs.a); m.step(0xda62, 3); }
    m.push16(0xda64); m.step(0xda65, 6); m.call(0xde11);
    regs.y = 0x02; regs.setNZ(0x02); m.step(0xda67, 2);
    regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xda6a, 4);
    if (regs.fZ) { m.step(0xda76, 3); } else {
      m.step(0xda6c, 2);
      mem.write8(0x7c, regs.a); m.step(0xda6e, 3);
      m.push16(0xda70); m.step(0xda71, 6); m.call(0xddf1);
      regs.y = 0x00; regs.setNZ(0x00); m.step(0xda73, 2);
      mem.write8(0x01c9, regs.y); m.step(0xda76, 4);
    }
    mem.write8(0x00, regs.y); m.step(0xda78, 3);
    regs.x = 0x07; regs.setNZ(0x07); m.step(0xda7a, 2);
    do {
      { const base = 0xdaf9; const addr = (base + regs.x) & 0xffff;
        const cross = (base & 0xff00) !== (addr & 0xff00);
        regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xda7d, 4 + (cross ? 1 : 0)); }
      mem.write8((0x0800 + regs.x) & 0xffff, regs.a); m.step(0xda80, 5);
      regs.x = regs.dec8(regs.x); m.step(0xda81, 2);
      if (regs.fPl) { m.step(0xda7a, 3); } else { m.step(0xda83, 2); break; }
    } while (true);
    regs.a = 0x00; regs.setNZ(0x00); m.step(0xda85, 2);
    mem.write8(0x60e0, regs.a); m.step(0xda88, 4);
    regs.a = 0x10; regs.setNZ(0x10); m.step(0xda8a, 2);
    mem.write8(0x4000, regs.a); m.step(0xda8d, 4);
    // ============ MAIN LOOP (da8d) -- non-terminating; seam drives $0c00 vblank ============
    while (true) {
      regs.y = 0x04; regs.setNZ(0x04); m.step(0xda8f, 2);
      do {
        regs.x = 0x14; regs.setNZ(0x14); m.step(0xda91, 2);
        do {
          do {
            regs.bit(mem.read8(0x0c00)); m.step(0xda94, 4);
            if (regs.fPl) { m.step(0xda91, 3); } else { m.step(0xda96, 2); break; }
          } while (true);
          do {
            regs.bit(mem.read8(0x0c00)); m.step(0xda99, 4);
            if (regs.fN) { m.step(0xda96, 3); } else { m.step(0xda9b, 2); break; }
          } while (true);
          regs.x = regs.dec8(regs.x); m.step(0xda9c, 2);
          if (regs.fPl) { m.step(0xda91, 3); } else { m.step(0xda9e, 2); break; }
        } while (true);
        regs.y = regs.dec8(regs.y); m.step(0xda9f, 2);
        if (regs.fN) { m.step(0xdaa9, 3); break; }
        m.step(0xdaa1, 2);
        mem.write8(0x5000, regs.a); m.step(0xdaa4, 4);
        regs.bit(mem.read8(0x0c00)); m.step(0xdaa7, 4);
        if (regs.fNV) { m.step(0xda8f, 3); } else { m.step(0xdaa9, 2); break; }
      } while (true);
      mem.write8(0x5800, regs.a); m.step(0xdaac, 4);
      regs.a = 0x00; regs.setNZ(0x00); m.step(0xdaae, 2);
      mem.write8(0x74, regs.a); m.step(0xdab0, 3);
      regs.a = 0x20; regs.setNZ(0x20); m.step(0xdab2, 2);
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
        regs.a = 0x20; regs.setNZ(0x20); m.step(0xdada, 2);
        mem.write8(0x4c, regs.a); m.step(0xdadc, 3);
      } else {
        m.step(0xdacd, 2);
        mem.write8(0x4c, regs.asl(mem.read8(0x4c))); m.step(0xdacf, 5);
        if (regs.fNC) { m.step(0xdad5, 3); } else {
          m.step(0xdad1, 2);
          mem.write8(0x00, regs.inc8(mem.read8(0x00))); m.step(0xdad3, 5);
          mem.write8(0x00, regs.inc8(mem.read8(0x00))); m.step(0xdad5, 5);
        }
        regs.clv(); m.step(0xdad6, 2);
        m.step(0xdadc, 3);
      }
      m.push16(0xdade); m.step(0xdadf, 6); m.call(0xdb0f);
      m.push16(0xdae1); m.step(0xdae2, 6); m.call(0xdf0d);
      mem.write8(0x4800, regs.a); m.step(0xdae5, 4);
      mem.write8(0x03, regs.inc8(mem.read8(0x03))); m.step(0xdae7, 5);
      regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xdae9, 3);
      regs.and(0x03); m.step(0xdaeb, 2);
      if (regs.fNZ) { m.step(0xdaf0, 3); } else {
        m.step(0xdaed, 2);
        m.push16(0xdaef); m.step(0xdaf0, 6); m.call(0xde1b);
      }
      regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xdaf3, 4);
      regs.and(0x10); m.step(0xdaf5, 2);
      if (regs.fZ) { m.step(0xda8d, 3); continue; }
      m.step(0xdaf7, 2);
      do { m.step(0xdaf7, 3); } while (true);
    }
  }
  // ---- normal boot fall-through ($0c00 bit4 set): power-on delay, init, JMP $c7a0 ----
  m.step(0xd98a, 2);
  do {
    do {
      mem.write8(0x5000, regs.a); m.step(0xd98d, 4);
      mem.write8(0x0100, regs.dec8(mem.read8(0x0100))); m.step(0xd990, 6);
      if (regs.fNZ) { m.step(0xd98a, 3); } else { m.step(0xd992, 2); break; }
    } while (true);
    mem.write8(0x0101, regs.dec8(mem.read8(0x0101))); m.step(0xd995, 6);
    if (regs.fNZ) { m.step(0xd98a, 3); } else { m.step(0xd997, 2); break; }
  } while (true);
  regs.a = 0x10; regs.setNZ(0x10); m.step(0xd999, 2);
  mem.write8(0xb4, regs.a); m.step(0xd99b, 3);
  m.push16(0xd99d); m.step(0xd99e, 6); m.call(0xde11);
  m.push16(0xd9a0); m.step(0xd9a1, 6); m.call(0xabac);
  m.push16(0xd9a3); m.step(0xd9a4, 6); m.call(0xc16e);
  regs.cli(); m.step(0xd9a5, 2);
  m.step(0xc7a0, 3); return m.call(0xc7a0);
}
