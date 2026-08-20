// SPDX-License-Identifier: GPL-3.0-only

// loc_0439  (ROM 0x0439-0x045f) -- render 10 rows of the 0x89c0 table into the 0x8467 panel.
// Per row: 0x0429 splits a byte into two BCD nibbles (low + high, 0x20 apart) with a fixed
// 0x51 tile wedged between the pairs, then a second 0x0429 whose high nibble is leading-zero
// suppressed (jr z skips the write). DE flips 0x0020 -> 0xff82 to re-base to the next column.
// Calls 0x0429 (this batch).
export function loc_0439(m) {
  const { regs, mem } = m;

  regs.ix = 0x89c0;  m.step(0x043d, 14);
  regs.hl = 0x8467;  m.step(0x0440, 10);
  regs.b = 0x0a;     m.step(0x0442, 7);

  for (;;) { // 0x0442
    regs.de = 0x0020;                  m.step(0x0445, 10);
    regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x0447, 10);
    m.push16(0x044a);                  m.step(0x0429, 17); m.call(0x0429);
    mem.write8(regs.hl, regs.a);       m.step(0x044b, 7);  // low nibble
    regs.addHl(regs.de);               m.step(0x044c, 11);
    mem.write8(regs.hl, 0x51);         m.step(0x044e, 10); // fixed separator tile
    regs.addHl(regs.de);               m.step(0x044f, 11);
    regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x0451, 10);
    m.push16(0x0454);                  m.step(0x0429, 17); m.call(0x0429);
    if (regs.fZ) {
      m.step(0x0457, 12); // jr z: leading-zero suppress
    } else {
      m.step(0x0456, 7);
      mem.write8(regs.hl, regs.a);     m.step(0x0457, 7);  // high nibble
    }
    regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x0459, 10);
    regs.de = 0xff82;                  m.step(0x045c, 10);
    regs.addHl(regs.de);               m.step(0x045d, 11);
    regs.b = (regs.b - 1) & 0xff; // djnz
    if (regs.b !== 0) { m.step(0x0442, 13); continue; }
    m.step(0x045f, 8); break;
  }

  m.ret(10);
}
