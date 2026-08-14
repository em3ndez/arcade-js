// SPDX-License-Identifier: GPL-3.0-only

// loc_20cc  (ROM 0x20BF-0x20FA) — shared scroll copy engine, two entry prologues into one loop.
// loc_20cc (0x20CC) takes the destination base from (0x13EF); loc_20bf (0x20BF) is the 2nd entry,
// same body but destination base from (0x13F5). Each saves DE=source and B=row-count into (0x8001)/
// (0x8003), then block_20d7 copies C column-pairs: an inner DJNZ loop stamps B row-pairs (2 bytes,
// row pitch 0x20), then the tail advances HL by (0x81B1), reloads B/DE, and repeats until C hits 0.
export function loc_20bf(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x13f5);
  m.step(0x20c2, 16); // ld hl,(0x13f5) -- destination base
  mem.write16(0x8001, regs.de);
  m.step(0x20c6, 20); // (0x8001) = DE source pointer
  regs.a = regs.b;
  m.step(0x20c7, 4);
  mem.write8(0x8003, regs.a);
  m.step(0x20ca, 13); // (0x8003) = B row count
  m.step(0x20d7, 12); // jr 0x20d7
  return block_20d7(m);
}

export function loc_20cc(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x13ef);
  m.step(0x20cf, 16); // ld hl,(0x13ef) -- destination base
  mem.write16(0x8001, regs.de);
  m.step(0x20d3, 20); // (0x8001) = DE source pointer
  regs.a = regs.b;
  m.step(0x20d4, 4);
  mem.write8(0x8003, regs.a);
  m.step(0x20d7, 13); // (0x8003) = B row count -- fall into block_20d7
  return block_20d7(m);
}

function block_20d7(m) {
  const { regs, mem } = m;

  outer: for (;;) {
    for (;;) {
      // loc_20d7: copy this column pair (2 bytes, then step down one 0x20 row)
      regs.a = mem.read8(regs.de);
      m.step(0x20d8, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x20d9, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x20da, 6);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x20db, 6);
      regs.a = mem.read8(regs.de);
      m.step(0x20dc, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x20dd, 7);
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x20de, 6);
      m.push16(regs.de);
      m.step(0x20df, 11);
      regs.de = 0x0020;
      m.step(0x20e2, 10);
      regs.addHl(regs.de);
      m.step(0x20e3, 11); // HL += 0x20 -- next row down
      regs.de = m.pop16();
      m.step(0x20e4, 10);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x20e5, 6);
      if (m.regs.djnz() !== 0) {
        m.step(0x20d7, 13);
        continue;
      }
      m.step(0x20e7, 8);
      break;
    }

    regs.a = mem.read8(0x81b1);
    m.step(0x20ea, 13);
    regs.e = regs.a;
    m.step(0x20eb, 4);
    regs.d = 0x00;
    m.step(0x20ed, 7);
    regs.addHl(regs.de);
    m.step(0x20ee, 11); // HL += (0x81b1) -- next column base
    regs.a = mem.read8(0x8003);
    m.step(0x20f1, 13);
    regs.b = regs.a;
    m.step(0x20f2, 4); // reload B row count
    regs.de = mem.read16(0x8001);
    m.step(0x20f6, 20); // reload DE source
    regs.c = regs.dec8(regs.c);
    m.step(0x20f7, 4);
    if (regs.fNZ) {
      m.step(0x20d7, 10);
      continue outer;
    }
    m.step(0x20fa, 10);
    m.ret(10);
    return;
  }
}
