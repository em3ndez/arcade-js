// SPDX-License-Identifier: GPL-3.0-only

// loc_03e9  (ROM 0x03e9-0x0428) -- attract-mode dispatch index 2: paint the HUD/score panels.
// (1) 11x call 0x05b2 (field renderer) with selectors A = 0x1a..0x24; A/BC are saved across
// each call so the loop counter and selector survive the callee. (2) 10-row score render: for
// each row 0x0429 splits a 0x8a00 byte into two BCD nibbles written 0x20 apart, and the third
// nibble is leading-zero suppressed (jr z skips the store). DE flips 0x0020 -> 0xff62 to re-base
// each row. (3) tail-calls 0x0439 then 0x0460, then returns. Calls 0x05b2 (translated) and
// 0x0429/0x0439/0x0460 (this batch).
export function loc_03e9(m) {
  const { regs, mem } = m;

  regs.a = 0x1a;  m.step(0x03eb, 7);
  regs.b = 0x0b;  m.step(0x03ed, 7);

  for (;;) { // 0x03ed: render 11 fields; A (selector) preserved across 0x05b2
    m.push16(regs.af);           m.step(0x03ee, 11);
    m.push16(regs.bc);           m.step(0x03ef, 11);
    m.push16(0x03f2);            m.step(0x05b2, 17); m.call(0x05b2);
    regs.bc = m.pop16();         m.step(0x03f3, 10);
    regs.af = m.pop16();         m.step(0x03f4, 10);
    regs.a = regs.inc8(regs.a);  m.step(0x03f5, 4);
    regs.b = (regs.b - 1) & 0xff; // djnz
    if (regs.b !== 0) { m.step(0x03ed, 13); continue; }
    m.step(0x03f7, 8); break;
  }

  regs.hl = 0x85c7;  m.step(0x03fa, 10);
  regs.de = 0x0020;  m.step(0x03fd, 10);
  regs.b = 0x0a;     m.step(0x03ff, 7);
  regs.ix = 0x8a00;  m.step(0x0403, 14);

  for (;;) { // 0x0403: 10 score rows, three BCD nibble-pairs per row
    m.push16(0x0406);                  m.step(0x0429, 17); m.call(0x0429);
    mem.write8(regs.hl, regs.a);       m.step(0x0407, 7);  // 1st high nibble
    regs.addHl(regs.de);               m.step(0x0408, 11);
    regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x040a, 10);
    m.push16(0x040d);                  m.step(0x0429, 17); m.call(0x0429);
    mem.write8(regs.hl, regs.a);       m.step(0x040e, 7);  // 2nd high nibble
    regs.addHl(regs.de);               m.step(0x040f, 11);
    regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x0411, 10);
    m.push16(0x0414);                  m.step(0x0429, 17); m.call(0x0429);
    if (regs.fZ) {
      m.step(0x0417, 12); // jr z: leading-zero suppress -- skip the store
    } else {
      m.step(0x0416, 7);
      mem.write8(regs.hl, regs.a);     m.step(0x0417, 7);  // 3rd high nibble
    }
    regs.de = 0xff62;                  m.step(0x041a, 10);
    regs.addHl(regs.de);               m.step(0x041b, 11);
    regs.de = 0x0020;                  m.step(0x041e, 10);
    regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x0420, 10);
    regs.b = (regs.b - 1) & 0xff; // djnz
    if (regs.b !== 0) { m.step(0x0403, 13); continue; }
    m.step(0x0422, 8); break;
  }

  m.push16(0x0425);  m.step(0x0439, 17); m.call(0x0439);
  m.push16(0x0428);  m.step(0x0460, 17); m.call(0x0460);
  m.ret(10);
}
