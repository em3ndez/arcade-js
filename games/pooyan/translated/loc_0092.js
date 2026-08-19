// SPDX-License-Identifier: GPL-3.0-only
// loc_0092  (ROM 0x0092-0x01d2) -- BOOT ENTRY, reached by `jp 0x0092` at the reset vector.
// Decoded FRESH from 0x0092: dk.asm mis-aligned this as loc_0083 (via the never-run `jp 0x0083`
// at 0x2049), phantom-decoding 0x0092 as the tail of a `jp z,0x0032`; from 0x0095 the two re-sync.
// Every boundary + T-state cross-checked vs scratchpad/pooyan-execpcs.txt and the ROM bytes.
// Each `m.step(next, T)` carries the landing address, so the flow is traceable without per-line
// comments. rst 0x10 (fill helper 0x0010) and rst 0x20 (table lookup 0x0020) and the calls = m.call.
export function loc_0092(m) {
  const { regs, mem } = m;

  mem.write8(0xa000, regs.a); m.step(0x0095, 13); // watchdog
  regs.sp = 0x9000; m.step(0x0098, 10);
  mem.write8(0x8800, regs.a); m.step(0x009b, 13);
  regs.b = 0x08; m.step(0x009d, 7);
  m.push16(regs.bc); m.step(0x009e, 11);
  regs.hl = 0x0000; m.step(0x00a1, 10);
  regs.ix = 0x0079; m.step(0x00a5, 14);

  // ROM self-test: sum 8 x 4K banks; each bank's (E,D,C) checksum is compared to the 3-byte
  // table entry at IX (base 0x0079), and a match bumps the pass tally at 0x8fff.
  for (;;) {
    regs.de = 0x0000; m.step(0x00a8, 10);
    regs.c = regs.d; m.step(0x00a9, 4);

    // inner accumulate over one bank: 16-bit sum in DE, carry count in C
    for (;;) {
      regs.a = regs.e; m.step(0x00aa, 4);
      regs.add(mem.read8(regs.hl)); m.step(0x00ab, 7);
      regs.e = regs.a; m.step(0x00ac, 4);
      if (regs.fNC) {
        m.step(0x00b2, 12);
      } else {
        m.step(0x00ae, 7);
        regs.d = regs.inc8(regs.d); m.step(0x00af, 4);
        if (regs.fNZ) {
          m.step(0x00b2, 12);
        } else {
          m.step(0x00b1, 7);
          regs.c = regs.inc8(regs.c); m.step(0x00b2, 4);
        }
      }
      regs.l = regs.inc8(regs.l); m.step(0x00b3, 4);
      if (regs.fNZ) { m.step(0x00a9, 12); continue; }
      m.step(0x00b5, 7);
      regs.h = regs.inc8(regs.h); m.step(0x00b6, 4);
      regs.a = regs.h; m.step(0x00b7, 4);
      regs.and(0x0f); m.step(0x00b9, 7);
      if (regs.fNZ) { m.step(0x00a9, 12); continue; } // (H & 0x0f) != 0 -> bank not done
      m.step(0x00bb, 7);
      break;
    }

    mem.write8(0xa000, regs.a); m.step(0x00be, 13); // watchdog
    regs.a = regs.e; m.step(0x00bf, 4);
    regs.cp(mem.read8(regs.ix & 0xffff)); m.step(0x00c2, 19);
    let pass = false;
    if (regs.fNZ) {
      m.step(0x00d0, 12);
    } else {
      m.step(0x00c4, 7);
      regs.a = regs.d; m.step(0x00c5, 4);
      regs.cp(mem.read8((regs.ix + 1) & 0xffff)); m.step(0x00c8, 19);
      if (regs.fNZ) {
        m.step(0x00d0, 12);
      } else {
        m.step(0x00ca, 7);
        regs.a = regs.c; m.step(0x00cb, 4);
        regs.cp(mem.read8((regs.ix + 2) & 0xffff)); m.step(0x00ce, 19);
        if (regs.fZ) { m.step(0x00d2, 12); pass = true; }
        else { m.step(0x00d0, 7); }
      }
    }
    if (pass) {
      m.push16(regs.hl); m.step(0x00d3, 11);
      regs.hl = 0x8fff; m.step(0x00d6, 10);
      regs.incMem8(mem, regs.hl); m.step(0x00d7, 11); // 0x8fff pass tally
      regs.hl = m.pop16(); m.step(0x00d8, 10);
    } else {
      m.step(0x00d8, 12); // loc_00d0: jr 0x00d8
    }
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x00da, 10);
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x00dc, 10);
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x00de, 10);
    regs.b = (regs.b - 1) & 0xff; // djnz: dec b, no flags
    if (regs.b !== 0) { m.step(0x00a5, 13); continue; }
    m.step(0x00e0, 8); break;
  }

  regs.a = mem.read8(0xa0e0); m.step(0x00e3, 13); // DSW0
  regs.and(0x0f); m.step(0x00e5, 7);
  regs.hl = 0x0069; m.step(0x00e8, 10);
  m.push16(0x00e9); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 table lookup
  regs.a = mem.read8(regs.hl); m.step(0x00ea, 7);
  regs.or(regs.a); m.step(0x00eb, 4);
  m.step(0x0103, 12); // jr 0x0103, skipping the unreached 0x00ed-0x0102 span

  // loc_0103: clear work RAM, seed HUD tiles + attributes
  mem.write8(0xa000, regs.a); m.step(0x0106, 13); // watchdog
  regs.hl = 0x8800; m.step(0x0109, 10);
  regs.de = 0x8801; m.step(0x010c, 10);
  regs.bc = 0x07fd; m.step(0x010f, 10);
  mem.write8(0x8800, 0x00); m.step(0x0111, 10);
  m.ldirAt(0x0111, 0x0113); // clear 0x8800-0x8ffd
  regs.a = 0x08; m.step(0x0115, 7);
  mem.write8(0x8a42, regs.a); m.step(0x0118, 13);
  regs.hl = 0x88c0; m.step(0x011b, 10);
  regs.b = 0x40; m.step(0x011d, 7);
  regs.a = 0xff; m.step(0x011f, 7);
  m.push16(0x0120); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill = 0xff
  regs.hl = 0x8a43; m.step(0x0123, 10);
  regs.b = 0x1c; m.step(0x0125, 7);
  m.push16(0x0126); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill = 0xff
  regs.hl = 0x4343; m.step(0x0129, 10);
  mem.write16(0x8a40, regs.hl); m.step(0x012c, 16);
  mem.write8(0xa000, regs.a); m.step(0x012f, 13); // watchdog
  regs.a = 0x01; m.step(0x0131, 7);
  mem.write8(0xa187, regs.a); m.step(0x0134, 13); // LS259 b7
  mem.write8(0x881f, regs.a); m.step(0x0137, 13);
  regs.hl = 0xc0c0; m.step(0x013a, 10);
  mem.write16(0x88a0, regs.hl); m.step(0x013d, 16);
  regs.hl = 0x8000; m.step(0x0140, 10);
  regs.de = 0x8001; m.step(0x0143, 10);
  mem.write8(0x8000, 0x10); m.step(0x0145, 10);
  regs.bc = 0x0400; m.step(0x0148, 10);
  m.ldirAt(0x0148, 0x014a); // fill colour RAM = 0x10
  m.push16(0x014d); m.step(0x02e6, 17); m.call(0x02e6);
  mem.write8(0xa000, regs.a); m.step(0x0150, 13); // watchdog

  // DSW1 -> cabinet/service control bits (0x880f/0x8800/0x8820/0x8821) then the 0x8807 branch
  regs.a = mem.read8(0xa000); m.step(0x0153, 13); // DSW1
  regs.cpl(); m.step(0x0154, 4);
  regs.rrca(); m.step(0x0155, 4);
  regs.rrca(); m.step(0x0156, 4);
  regs.b = regs.a; m.step(0x0157, 4);
  regs.and(0x01); m.step(0x0159, 7);
  mem.write8(0x880f, regs.a); m.step(0x015c, 13);
  regs.a = regs.b; m.step(0x015d, 4);
  regs.rrca(); m.step(0x015e, 4);
  regs.b = regs.a; m.step(0x015f, 4);
  regs.and(0x01); m.step(0x0161, 7);
  mem.write8(0x8800, regs.a); m.step(0x0164, 13);
  regs.a = regs.b; m.step(0x0165, 4);
  regs.rrca(); m.step(0x0166, 4);
  regs.b = regs.a; m.step(0x0167, 4);
  regs.and(0x07); m.step(0x0169, 7);
  mem.write8(0x8820, regs.a); m.step(0x016c, 13);
  regs.a = regs.b; m.step(0x016d, 4);
  regs.rrca(); m.step(0x016e, 4);
  regs.rrca(); m.step(0x016f, 4);
  regs.rrca(); m.step(0x0170, 4);
  regs.b = regs.a; m.step(0x0171, 4);
  regs.and(0x01); m.step(0x0173, 7);
  mem.write8(0x8821, regs.a); m.step(0x0176, 13);
  regs.a = mem.read8(0xa000); m.step(0x0179, 13); // DSW1
  regs.cpl(); m.step(0x017a, 4);
  regs.and(0x03); m.step(0x017c, 7);
  regs.cp(0x03); m.step(0x017e, 7);
  if (regs.fZ) {
    m.step(0x0184, 12);
    regs.a = 0xff; m.step(0x0186, 7);
  } else {
    m.step(0x0180, 7);
    regs.add(0x03); m.step(0x0182, 7);
    m.step(0x0186, 12);
  }
  mem.write8(0x8807, regs.a); m.step(0x0189, 13);

  // DSW0 -> coinage nibbles via table 0x0053 (rst 0x20), stored at 0x882f / 0x882c
  regs.a = mem.read8(0xa0e0); m.step(0x018c, 13); // DSW0
  regs.b = regs.a; m.step(0x018d, 4);
  regs.and(0xf0); m.step(0x018f, 7);
  regs.rrca(); m.step(0x0190, 4);
  regs.rrca(); m.step(0x0191, 4);
  regs.rrca(); m.step(0x0192, 4);
  regs.rrca(); m.step(0x0193, 4);
  regs.hl = 0x0053; m.step(0x0196, 10);
  m.push16(0x0197); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 table lookup
  mem.write8(0x882f, regs.a); m.step(0x019a, 13);
  regs.a = regs.b; m.step(0x019b, 4);
  regs.and(0x0f); m.step(0x019d, 7);
  regs.hl = 0x0053; m.step(0x01a0, 10);
  m.push16(0x01a1); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 table lookup
  mem.write8(0x882c, regs.a); m.step(0x01a4, 13);
  mem.write8(0xa000, regs.a); m.step(0x01a7, 13); // watchdog
  m.push16(0x01aa); m.step(0x01ea, 17); m.call(0x01ea);
  regs.xor(regs.a); m.step(0x01ab, 4);
  m.push16(0x01ae); m.step(0x0e8f, 17); m.call(0x0e8f);
  regs.a = 0x01; m.step(0x01b0, 7);
  mem.write8(0xa180, regs.a); m.step(0x01b3, 13); // LS259 b0 -> vblank NMI enable
  regs.hl = 0x8a00; m.step(0x01b6, 10);
  regs.b = 0x0a; m.step(0x01b8, 7);

  // loc_01b8: seed 10 x (0,0,1) triples at 0x8a00-0x8a1d
  for (;;) {
    mem.write8(regs.hl, 0x00); m.step(0x01ba, 10);
    regs.l = regs.inc8(regs.l); m.step(0x01bb, 4);
    mem.write8(regs.hl, 0x00); m.step(0x01bd, 10);
    regs.l = regs.inc8(regs.l); m.step(0x01be, 4);
    mem.write8(regs.hl, 0x01); m.step(0x01c0, 10);
    regs.l = regs.inc8(regs.l); m.step(0x01c1, 4);
    regs.b = (regs.b - 1) & 0xff; // djnz: dec b, no flags
    if (regs.b !== 0) { m.step(0x01b8, 13); continue; }
    m.step(0x01c3, 8); break;
  }

  regs.hl = 0x88aa; m.step(0x01c6, 10);
  mem.write8(regs.hl, 0x01); m.step(0x01c8, 10);
  mem.write8(0xa000, regs.a); m.step(0x01cb, 13); // watchdog
  regs.hl = 0x89c0; m.step(0x01ce, 10);
  regs.xor(regs.a); m.step(0x01cf, 4);
  regs.b = 0x1e; m.step(0x01d1, 7);
  m.push16(0x01d2); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill = 0
  m.step(0x020f, 10); // jp 0x020f -> main loop
  return m.call(0x020f);
}
