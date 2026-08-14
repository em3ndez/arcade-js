// SPDX-License-Identifier: GPL-3.0-only

// loc_0066  (ROM 0x0066-0x0291) — the vblank NMI handler. Saves all registers, acks the
// NMI (0xB808 D0=0), scans coins (0x2CF0), blits sprites to OBJRAM with the rrca x4
// nibble-swap (m_frogger_adjust), decrements the coin-counter pulse timers, then runs the
// per-frame game logic — a dispatch tree on the play/mode flags (0x83FE/0x83D6/0x83FD)
// that drives the attract sequencer (0x0E7A), object updaters and sound — before restoring
// registers, re-enabling the NMI (0xB808 D0=1), and `retn`. Interior labels are modelled as
// hoisted block functions; each `jp`/`jr`/fall-through into one is `return b_<addr>()`.
export function loc_0066(m) {
  const { regs, mem } = m;

  m.push16(regs.af);
  m.step(0x0067, 11);
  m.push16(regs.hl);
  m.step(0x0068, 11);
  m.push16(regs.de);
  m.step(0x0069, 11);
  m.push16(regs.bc);
  m.step(0x006a, 11);
  m.push16(regs.ix);
  m.step(0x006c, 15);
  m.push16(regs.iy);
  m.step(0x006e, 15);
  regs.a = mem.read8(0x8800);
  m.step(0x0071, 13); // ld a,(0x8800) -- pet the watchdog
  regs.xor(regs.a);
  m.step(0x0072, 4);
  mem.write8(0xb808, regs.a, 10);
  m.step(0x0075, 13); // ld (0xb808),a -- irq_enable D0=0 (ack, block re-entry)
  m.push16(0x0078);
  m.step(0x2cf0, 17); // call 0x2cf0 -- coin/credit scan
  m.call(0x2cf0);
  regs.hl = 0x8007;
  m.step(0x007b, 10);
  regs.de = 0xb007;
  m.step(0x007e, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x007f, 7);
  mem.write8(regs.de, regs.a);
  m.step(0x0080, 7);
  regs.l = regs.inc8(regs.l);
  m.step(0x0081, 4);
  regs.e = regs.inc8(regs.e);
  m.step(0x0082, 4);
  regs.b = 0x1c;
  m.step(0x0084, 7);

  for (;;) {
    // loc_0084: copy a sprite pair, nibble-swapping the first byte (m_frogger_adjust)
    regs.a = mem.read8(regs.hl);
    m.step(0x0085, 7);
    regs.rrca();
    m.step(0x0086, 4);
    regs.rrca();
    m.step(0x0087, 4);
    regs.rrca();
    m.step(0x0088, 4);
    regs.rrca();
    m.step(0x0089, 4);
    mem.write8(regs.de, regs.a);
    m.step(0x008a, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x008b, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x008c, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x008d, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x008e, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x008f, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x0090, 4);
    if (m.regs.djnz() !== 0) {
      m.step(0x0084, 13);
      continue;
    }
    m.step(0x0092, 8);
    break;
  }

  regs.c = 0x08;
  m.step(0x0094, 7);
  regs.a = mem.read8(0x842f);
  m.step(0x0097, 13);
  regs.or(regs.a);
  m.step(0x0098, 4);
  if (regs.fZ) {
    m.step(0x009f, 12);
  } else {
    m.step(0x009a, 7);
    regs.c = 0x06;
    m.step(0x009c, 7);
    regs.e = 0x48;
    m.step(0x009e, 7);
    regs.l = regs.e;
    m.step(0x009f, 4);
  }

  for (;;) {
    // loc_009f: C outer passes of one nibble-swapped byte + 3 straight bytes
    regs.a = mem.read8(regs.hl);
    m.step(0x00a0, 7);
    regs.rrca();
    m.step(0x00a1, 4);
    regs.rrca();
    m.step(0x00a2, 4);
    regs.rrca();
    m.step(0x00a3, 4);
    regs.rrca();
    m.step(0x00a4, 4);
    mem.write8(regs.de, regs.a);
    m.step(0x00a5, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x00a6, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x00a7, 4);
    regs.b = 0x03;
    m.step(0x00a9, 7);
    for (;;) {
      // loc_00a9
      regs.a = mem.read8(regs.hl);
      m.step(0x00aa, 7);
      mem.write8(regs.de, regs.a);
      m.step(0x00ab, 7);
      regs.l = regs.inc8(regs.l);
      m.step(0x00ac, 4);
      regs.e = regs.inc8(regs.e);
      m.step(0x00ad, 4);
      if (m.regs.djnz() !== 0) {
        m.step(0x00a9, 13);
        continue;
      }
      m.step(0x00af, 8);
      break;
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x00b0, 4);
    if (regs.fNZ) {
      m.step(0x009f, 12);
      continue;
    }
    m.step(0x00b2, 7);
    break;
  }

  regs.hl = 0x837f;
  m.step(0x00b5, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x00b6, 7);
  regs.or(regs.a);
  m.step(0x00b7, 4);
  if (regs.fZ) {
    m.step(0x00c0, 12);
    return b_00c0();
  }
  m.step(0x00b9, 7);
  regs.decMem8(mem, regs.hl);
  m.step(0x00ba, 11);
  if (regs.fNZ) {
    m.step(0x00c0, 12);
    return b_00c0();
  }
  m.step(0x00bc, 7);
  regs.xor(regs.a);
  m.step(0x00bd, 4);
  mem.write8(0xb81c, regs.a, 10);
  m.step(0x00c0, 13); // ld (0xb81c),a -- clear the coin-counter pulse
  return b_00c0();

  function b_00c0() {
    regs.hl = 0x837e;
    m.step(0x00c3, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x00c4, 7);
    regs.or(regs.a);
    m.step(0x00c5, 4);
    if (regs.fZ) {
      m.step(0x00ce, 12);
      return b_00ce();
    }
    m.step(0x00c7, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x00c8, 11);
    if (regs.fNZ) {
      m.step(0x00ce, 12);
      return b_00ce();
    }
    m.step(0x00ca, 7);
    regs.xor(regs.a);
    m.step(0x00cb, 4);
    mem.write8(0xb818, regs.a, 10);
    m.step(0x00ce, 13); // ld (0xb818),a -- clear the coin-counter pulse
    return b_00ce();
  }

  function b_00ce() {
    regs.a = mem.read8(0xe004);
    m.step(0x00d1, 13); // ld a,(0xe004) -- IN2
    regs.and(0x08);
    m.step(0x00d3, 7);
    if (regs.fZ) {
      m.step(0x00fc, 10);
      return b_00fc();
    }
    m.step(0x00d6, 10);
    regs.a = mem.read8(0x83fe);
    m.step(0x00d9, 13);
    regs.and(regs.a);
    m.step(0x00da, 4);
    if (regs.fZ) {
      m.step(0x00fc, 10);
      return b_00fc();
    }
    m.step(0x00dd, 10);
    regs.a = mem.read8(0x83fd);
    m.step(0x00e0, 13);
    regs.and(regs.a);
    m.step(0x00e1, 4);
    if (regs.fZ) {
      m.step(0x00fc, 12);
      return b_00fc();
    }
    m.step(0x00e3, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x00e4, 4);
    if (regs.fZ) {
      m.step(0x00fc, 12);
      return b_00fc();
    }
    m.step(0x00e6, 7);
    regs.c = 0x02;
    m.step(0x00e8, 7);
    regs.hl = 0x8043;
    m.step(0x00eb, 10);
    regs.de = 0xb043;
    m.step(0x00ee, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x00ef, 7);
    regs.add(regs.c);
    m.step(0x00f0, 4);
    mem.write8(regs.de, regs.a);
    m.step(0x00f1, 7);
    regs.c = 0x02;
    m.step(0x00f3, 7);
    regs.hl = 0x8047;
    m.step(0x00f6, 10);
    regs.de = 0xb047;
    m.step(0x00f9, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x00fa, 7);
    regs.add(regs.c);
    m.step(0x00fb, 4);
    mem.write8(regs.de, regs.a);
    m.step(0x00fc, 7);
    return b_00fc();
  }

  function b_00fc() {
    regs.a = mem.read8(0x83fe);
    m.step(0x00ff, 13);
    regs.or(regs.a);
    m.step(0x0100, 4);
    if (regs.fZ) {
      m.step(0x0122, 10);
      return b_0122();
    }
    m.step(0x0103, 10);
    m.push16(0x0106);
    m.step(0x07ac, 17);
    m.call(0x07ac);
    regs.a = mem.read8(0x83ea);
    m.step(0x0109, 13);
    regs.or(regs.a);
    m.step(0x010a, 4);
    if (regs.fZ) {
      m.step(0x0245, 10);
      return epilogue();
    }
    m.step(0x010d, 10);
    regs.hl = mem.read16(0x83d2);
    m.step(0x0110, 16);
    regs.a = regs.h;
    m.step(0x0111, 4);
    regs.or(regs.l);
    m.step(0x0112, 4);
    if (regs.fZ) {
      m.step(0x0171, 10);
      return b_0171();
    }
    m.step(0x0115, 10);
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0116, 6);
    mem.write16(0x83d2, regs.hl);
    m.step(0x0119, 16);
    m.push16(0x011c);
    m.step(0x14b7, 17);
    m.call(0x14b7);
    m.push16(0x011f);
    m.step(0x1802, 17);
    m.call(0x1802);
    m.step(0x0245, 10);
    return epilogue();
  }

  function b_0122() {
    regs.a = mem.read8(0x83d6);
    m.step(0x0125, 13);
    regs.cp(0x02);
    m.step(0x0127, 7);
    if (regs.fNC) {
      m.step(0x0158, 10);
      return b_0158();
    }
    m.step(0x012a, 10);
    regs.or(regs.a);
    m.step(0x012b, 4);
    if (regs.fZ) {
      m.push16(0x012e);
      m.step(0x0e7a, 17); // call z,0x0e7a (taken) -- attract-mode sequencer
      m.call(0x0e7a);
    } else {
      m.step(0x012e, 10);
    }
    m.push16(0x0131);
    m.step(0x2341, 17);
    m.call(0x2341);
    regs.xor(regs.a);
    m.step(0x0132, 4);
    mem.write8(0x83cd, regs.a);
    m.step(0x0135, 13);
    mem.write8(0x83cf, regs.a);
    m.step(0x0138, 13);
    mem.write8(0x83b5, regs.a);
    m.step(0x013b, 13);
    regs.h = regs.a;
    m.step(0x013c, 4);
    regs.l = regs.a;
    m.step(0x013d, 4);
    mem.write16(0x8293, regs.hl);
    m.step(0x0140, 16);
    regs.hl = 0x825c;
    m.step(0x0143, 10);
    regs.de = 0x825d;
    m.step(0x0146, 10);
    regs.bc = 0x000b;
    m.step(0x0149, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x014a, 7);
    m.ldirAt(0x014a, 0x014c); // ldir -- clear 0x825c-0x8266
    regs.hl = 0x83af;
    m.step(0x014f, 10);
    mem.write8(regs.hl, 0x80);
    m.step(0x0151, 10);
    regs.l = regs.inc8(regs.l);
    m.step(0x0152, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x0153, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0154, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x0155, 7);
    m.step(0x0245, 10);
    return epilogue();
  }

  function b_0158() {
    regs.hl = 0x83d8;
    m.step(0x015b, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x015c, 7);
    regs.or(regs.a);
    m.step(0x015d, 4);
    if (regs.fZ) {
      m.step(0x0245, 10);
      return epilogue();
    }
    m.step(0x0160, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x0161, 11);
    if (regs.fNZ) {
      m.step(0x0245, 10);
      return epilogue();
    }
    m.step(0x0164, 10);
    regs.l = regs.dec8(regs.l);
    m.step(0x0165, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x0166, 7);
    regs.or(regs.a);
    m.step(0x0167, 4);
    if (regs.fNZ) {
      m.step(0x0245, 10);
      return epilogue();
    }
    m.step(0x016a, 10);
    regs.hl = 0x83d6;
    m.step(0x016d, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x016e, 11);
    m.step(0x0245, 10);
    return epilogue();
  }

  function b_0171() {
    regs.hl = mem.read16(0x8382);
    m.step(0x0174, 16);
    regs.a = regs.h;
    m.step(0x0175, 4);
    regs.or(regs.l);
    m.step(0x0176, 4);
    if (regs.fZ) {
      m.step(0x018a, 12);
      return b_018a();
    }
    m.step(0x0178, 7);
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0179, 6);
    mem.write16(0x8382, regs.hl);
    m.step(0x017c, 16);
    regs.a = regs.h;
    m.step(0x017d, 4);
    regs.or(regs.l);
    m.step(0x017e, 4);
    if (regs.fNZ) {
      m.step(0x018a, 12);
      return b_018a();
    }
    m.step(0x0180, 7);
    regs.a = 0x0f;
    m.step(0x0182, 7);
    m.push16(0x0183);
    m.step(0x0018, 11); // rst 0x18 -- enqueue sound command 0x0f
    m.call(0x0018);
    regs.a = 0xb0;
    m.step(0x0185, 7);
    m.push16(0x0186);
    m.step(0x0018, 11); // rst 0x18 -- enqueue sound command 0xb0
    m.call(0x0018);
    regs.xor(regs.a);
    m.step(0x0187, 4);
    mem.write8(0x8371, regs.a);
    m.step(0x018a, 13);
    return b_018a();
  }

  function b_018a() {
    regs.a = mem.read8(0x83fd);
    m.step(0x018d, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x018e, 4);
    if (regs.fNZ) {
      m.step(0x0274, 10);
      return b_0274();
    }
    m.step(0x0191, 10);
    regs.a = mem.read8(0x825c);
    m.step(0x0194, 13);
    regs.cp(0x05);
    m.step(0x0196, 7);
    if (regs.fZ) {
      m.step(0x025e, 10);
      return b_025e();
    }
    m.step(0x0199, 10);
    return b_0199();
  }

  function b_0199() {
    regs.a = mem.read8(0x8298);
    m.step(0x019c, 13);
    regs.and(regs.a);
    m.step(0x019d, 4);
    if (regs.fZ) {
      m.step(0x01a6, 12);
      return b_01a6();
    }
    m.step(0x019f, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x01a0, 4);
    mem.write8(0x8298, regs.a);
    m.step(0x01a3, 13);
    m.step(0x01e2, 10);
    return b_01e2();
  }

  function b_01a6() {
    regs.a = mem.read8(0x8297);
    m.step(0x01a9, 13);
    regs.and(regs.a);
    m.step(0x01aa, 4);
    if (regs.fNZ) {
      m.step(0x0257, 10);
      return b_0257();
    }
    m.step(0x01ad, 10);
    regs.hl = mem.read16(0x829d);
    m.step(0x01b0, 16);
    regs.a = regs.h;
    m.step(0x01b1, 4);
    regs.or(regs.l);
    m.step(0x01b2, 4);
    if (regs.fNZ) {
      m.step(0x01e2, 12);
      return b_01e2();
    }
    m.step(0x01b4, 7);
    m.push16(0x01b7);
    m.step(0x0870, 17);
    m.call(0x0870);
    m.push16(0x01ba);
    m.step(0x1a55, 17);
    m.call(0x1a55);
    regs.a = mem.read8(0x83b5);
    m.step(0x01bd, 13);
    regs.or(regs.a);
    m.step(0x01be, 4);
    if (regs.fNZ) {
      m.step(0x01e2, 12);
      return b_01e2();
    }
    m.step(0x01c0, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x01c1, 4);
    mem.write8(0x83b5, regs.a);
    m.step(0x01c4, 13);
    regs.a = 0xff;
    m.step(0x01c6, 7);
    mem.write8(0x8384, regs.a);
    m.step(0x01c9, 13);
    regs.a = mem.read8(0x8380);
    m.step(0x01cc, 13);
    regs.or(regs.a);
    m.step(0x01cd, 4);
    if (regs.fZ) {
      m.step(0x01e2, 12);
      return b_01e2();
    }
    m.step(0x01cf, 7);
    regs.xor(regs.a);
    m.step(0x01d0, 4);
    mem.write8(0x8380, regs.a);
    m.step(0x01d3, 13);
    regs.hl = 0x0040;
    m.step(0x01d6, 10);
    mem.write16(0x8382, regs.hl);
    m.step(0x01d9, 16);
    regs.de = 0x2f7b;
    m.step(0x01dc, 10);
    regs.hl = 0xaa51;
    m.step(0x01df, 10);
    regs.b = 0x07;
    m.step(0x01e1, 7);
    m.push16(0x01e2);
    m.step(0x0028, 11); // rst 0x28 -- blit 0x07 tiles up a column
    m.call(0x0028);
    return b_01e2();
  }

  function b_01e2() {
    regs.a = mem.read8(0x8384);
    m.step(0x01e5, 13);
    regs.or(regs.a);
    m.step(0x01e6, 4);
    if (regs.fZ) {
      m.step(0x01f2, 12);
      return b_01f2();
    }
    m.step(0x01e8, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x01e9, 4);
    mem.write8(0x8384, regs.a);
    m.step(0x01ec, 13);
    regs.hl = 0xa850;
    m.step(0x01ef, 10);
    if (regs.fZ) {
      m.push16(0x01f2);
      m.step(0x19e2, 17);
      m.call(0x19e2);
    } else {
      m.step(0x01f2, 10);
    }
    return b_01f2();
  }

  function b_01f2() {
    m.push16(0x01f5);
    m.step(0x2005, 17);
    m.call(0x2005);
    m.push16(0x01f8);
    m.step(0x1802, 17);
    m.call(0x1802);
    regs.a = mem.read8(0x8107);
    m.step(0x01fb, 13);
    regs.and(regs.a);
    m.step(0x01fc, 4);
    if (regs.fZ) {
      m.step(0x0205, 12);
      return b_0205();
    }
    m.step(0x01fe, 7);
    regs.a = mem.read8(0x8109);
    m.step(0x0201, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x0202, 4);
    mem.write8(0x8109, regs.a);
    m.step(0x0205, 13);
    return b_0205();
  }

  function b_0205() {
    regs.a = mem.read8(0x8108);
    m.step(0x0208, 13);
    regs.and(regs.a);
    m.step(0x0209, 4);
    if (regs.fZ) {
      m.step(0x0212, 12);
      return b_0212();
    }
    m.step(0x020b, 7);
    regs.a = mem.read8(0x8124);
    m.step(0x020e, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x020f, 4);
    mem.write8(0x8124, regs.a);
    m.step(0x0212, 13);
    return b_0212();
  }

  function b_0212() {
    m.push16(0x0215);
    m.step(0x11bf, 17);
    m.call(0x11bf);
    regs.a = mem.read8(0x8107);
    m.step(0x0218, 13);
    regs.and(regs.a);
    m.step(0x0219, 4);
    if (regs.fZ) {
      m.step(0x0222, 12);
      return b_0222();
    }
    m.step(0x021b, 7);
    regs.a = mem.read8(0x8109);
    m.step(0x021e, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x021f, 4);
    mem.write8(0x8109, regs.a);
    m.step(0x0222, 13);
    return b_0222();
  }

  function b_0222() {
    regs.a = mem.read8(0x8108);
    m.step(0x0225, 13);
    regs.and(regs.a);
    m.step(0x0226, 4);
    if (regs.fZ) {
      m.step(0x022f, 12);
      return b_022f();
    }
    m.step(0x0228, 7);
    regs.a = mem.read8(0x8124);
    m.step(0x022b, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x022c, 4);
    mem.write8(0x8124, regs.a);
    m.step(0x022f, 13);
    return b_022f();
  }

  function b_022f() {
    m.push16(0x0232);
    m.step(0x16f8, 17);
    m.call(0x16f8);
    m.push16(0x0235);
    m.step(0x14b7, 17);
    m.call(0x14b7);
    m.push16(0x0238);
    m.step(0x2970, 17);
    m.call(0x2970);
    m.push16(0x023b);
    m.step(0x1fc7, 17);
    m.call(0x1fc7);
    m.push16(0x023e);
    m.step(0x0292, 17);
    m.call(0x0292);
    regs.a = mem.read8(0x8297);
    m.step(0x0241, 13);
    regs.and(regs.a);
    m.step(0x0242, 4);
    if (regs.fNZ) {
      m.push16(0x0245);
      m.step(0x06a2, 17);
      m.call(0x06a2);
    } else {
      m.step(0x0245, 10);
    }
    return epilogue();
  }

  function epilogue() {
    // loc_0245
    regs.a = mem.read8(0x8800);
    m.step(0x0248, 13); // ld a,(0x8800) -- pet the watchdog
    regs.iy = m.pop16();
    m.step(0x024a, 14);
    regs.ix = m.pop16();
    m.step(0x024c, 14);
    regs.bc = m.pop16();
    m.step(0x024d, 10);
    regs.de = m.pop16();
    m.step(0x024e, 10);
    regs.hl = m.pop16();
    m.step(0x024f, 10);
    regs.a = 0x01;
    m.step(0x0251, 7);
    mem.write8(0xb808, regs.a, 10);
    m.step(0x0254, 13); // ld (0xb808),a -- irq_enable D0=1 (NMI back on)
    regs.af = m.pop16();
    m.step(0x0255, 10);
    m.ret(14);
  }

  function b_0257() {
    regs.a = regs.dec8(regs.a);
    m.step(0x0258, 4);
    mem.write8(0x8297, regs.a);
    m.step(0x025b, 13);
    m.step(0x01e2, 10);
    return b_01e2();
  }

  function b_025e() {
    regs.hl = 0x825e;
    m.step(0x0261, 10);
    regs.de = 0x825f;
    m.step(0x0264, 10);
    regs.bc = 0x0004;
    m.step(0x0267, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x0268, 7);
    m.ldirAt(0x0268, 0x026a); // ldir -- clear 0x825e-0x8262
    regs.xor(regs.a);
    m.step(0x026b, 4);
    mem.write8(0x825c, regs.a);
    m.step(0x026e, 13);
    m.push16(0x0271);
    m.step(0x05d3, 17);
    m.call(0x05d3);
    m.step(0x0245, 10);
    return epilogue();
  }

  function b_0274() {
    regs.a = mem.read8(0x825d);
    m.step(0x0277, 13);
    regs.cp(0x05);
    m.step(0x0279, 7);
    if (regs.fNZ) {
      m.step(0x0199, 10);
      return b_0199();
    }
    m.step(0x027c, 10);
    regs.hl = 0x8263;
    m.step(0x027f, 10);
    regs.de = 0x8264;
    m.step(0x0282, 10);
    regs.bc = 0x0004;
    m.step(0x0285, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x0286, 7);
    m.ldirAt(0x0286, 0x0288); // ldir -- clear 0x8263-0x8267
    regs.xor(regs.a);
    m.step(0x0289, 4);
    mem.write8(0x825d, regs.a);
    m.step(0x028c, 13);
    m.push16(0x028f);
    m.step(0x05d3, 17);
    m.call(0x05d3);
    m.step(0x0245, 10);
    return epilogue();
  }
}
