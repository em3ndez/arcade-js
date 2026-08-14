// SPDX-License-Identifier: GPL-3.0-only

// loc_0fd4  (ROM 0x0FD4-0x0FF0) — frog-anim dispatcher ARM0. Loads count B / index C from 0x8270,
// dest HL from (0x13ED), source DE = 0x1403, IX = IY = 0x8100, saves (0x81B1) = A / (0x8001) = DE,
// then falls into the shared render loop loc_0ff1.
export function loc_0fd4(m) {
  const { regs, mem } = m;

  regs.hl = 0x8270;
  m.step(0x0fd7, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x0fd8, 7); // A = (0x8270)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0fd9, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x0fda, 7); // B = (0x8271) row count
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0fdb, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x0fdc, 7); // C = (0x8272) column index
  regs.hl = mem.read16(0x13ed);
  m.step(0x0fdf, 16); // HL = (0x13ed) VRAM dest base
  regs.de = 0x1403;
  m.step(0x0fe2, 10); // DE = tile source
  regs.ix = 0x8100;
  m.step(0x0fe6, 14);
  regs.iy = 0x8100;
  m.step(0x0fea, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x0fed, 13); // (0x81b1) = A row-advance
  mem.write16(0x8001, regs.de);
  m.step(0x0ff1, 20); // (0x8001) = DE source
  return m.call(0x0ff1); // fall through to loc_0ff1
}

// loc_0ff1  (ROM 0x0FF1-0x1046) — shared render loop entry (mid-entry: arms loc_1058/loc_10f8 jp here).
// Each outer pass computes the coord via loc_1198, optionally stores -C at (ix+1), then copies B tile
// rows (stride 0x20) into VRAM; C outer passes, re-entered from 0x103C. Falls into loc_1029 when done.
export function loc_0ff1(m) {
  const { regs, mem } = m;

  for (;;) {
    // loc_0ff1:
    m.push16(regs.hl);
    m.step(0x0ff2, 11);
    m.push16(regs.bc);
    m.step(0x0ff3, 11);
    m.push16(regs.de);
    m.step(0x0ff4, 11);
    m.push16(0x0ff7);
    m.step(0x1198, 17); // call 0x1198 coord/offset compute
    m.call(0x1198);
    regs.a = mem.read8(0x825b);
    m.step(0x0ffa, 13); // A = (0x825b) plot-suppress flag
    regs.and(regs.a);
    m.step(0x0ffb, 4);
    if (regs.fNZ) {
      m.step(0x1008, 12); // jr nz,0x1008 -- skip the (ix+1) store
    } else {
      m.step(0x0ffd, 7);
      regs.a = regs.c;
      m.step(0x0ffe, 4);
      regs.cpl();
      m.step(0x0fff, 4);
      regs.a = regs.inc8(regs.a);
      m.step(0x1000, 4); // A = -C
      mem.write8((regs.ix + 0x01) & 0xffff, regs.a);
      m.step(0x1003, 19); // (ix+1) = -C
      regs.ix = (regs.ix + 1) & 0xffff;
      m.step(0x1005, 10);
      regs.incMem8(mem, (regs.iy + 0x00) & 0xffff);
      m.step(0x1008, 23);
    }
    // loc_1008:
    regs.de = m.pop16();
    m.step(0x1009, 10);
    regs.bc = m.pop16();
    m.step(0x100a, 10);
    regs.hl = m.pop16();
    m.step(0x100b, 10);
    regs.a = regs.b;
    m.step(0x100c, 4);
    mem.write8(0x8003, regs.a);
    m.step(0x100f, 13); // (0x8003) = B row count

    // loc_100f: copy B rows, two bytes each, stride 0x20
    for (;;) {
      regs.a = mem.read8(regs.de);
      m.step(0x1010, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x1011, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x1012, 6);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x1013, 6);
      regs.a = mem.read8(regs.de);
      m.step(0x1014, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x1015, 7);
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x1016, 6);
      m.push16(regs.de);
      m.step(0x1017, 11);
      regs.de = 0x0020; // row stride
      m.step(0x101a, 10);
      regs.addHl(regs.de);
      m.step(0x101b, 11);
      regs.de = m.pop16();
      m.step(0x101c, 10);
      if (regs.djnz() !== 0) {
        m.step(0x1038, 13); // djnz 0x1038
        // loc_1038:
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x1039, 6);
        m.step(0x100f, 10);
        continue;
      }
      m.step(0x101e, 8);
      regs.a = mem.read8(0x81b1);
      m.step(0x1021, 13); // A = (0x81b1) row advance
      regs.e = regs.a;
      m.step(0x1022, 4);
      regs.d = 0x00;
      m.step(0x1024, 7);
      regs.addHl(regs.de);
      m.step(0x1025, 11);
      regs.c = regs.dec8(regs.c);
      m.step(0x1026, 4); // one outer pass done
      if (regs.fNZ) {
        m.step(0x103c, 10); // jp nz,0x103c
        // loc_103c:
        regs.de = mem.read16(0x8001);
        m.step(0x1040, 20); // reload source DE
        regs.a = mem.read8(0x8003);
        m.step(0x1043, 13);
        regs.b = regs.a;
        m.step(0x1044, 4); // reload row count B
        m.step(0x0ff1, 10);
        break;
      }
      m.step(0x1029, 10);
      return m.call(0x1029); // fall through to loc_1029
    }
  }
}

// loc_1029  (ROM 0x1029-0x1037, + the 0x1047 ret) — advance frog-anim index (0x8000); while < 0x0B
// re-dispatch via loc_0faf, else wrap it to 0 and return (mid-entry: arm loc_1058 jp here).
export function loc_1029(m) {
  const { regs, mem } = m;

  regs.hl = 0x8000;
  m.step(0x102c, 10);
  regs.incMem8(mem, regs.hl);
  m.step(0x102d, 11); // (0x8000) += 1
  regs.a = mem.read8(regs.hl);
  m.step(0x102e, 7);
  regs.cp(0x0b);
  m.step(0x1030, 7);
  if (regs.fC) {
    m.step(0x0faf, 10); // jp c,0x0faf -- index < 0x0b
    return m.call(0x0faf);
  }
  m.step(0x1033, 10);
  regs.xor(regs.a);
  m.step(0x1034, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x1035, 7); // (0x8000) = 0 wrap
  m.step(0x1047, 10); // jp 0x1047
  // loc_1047:
  m.ret(10);
}
