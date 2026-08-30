// SPDX-License-Identifier: GPL-3.0-only

// loc_1d9c  (ROM 0x1d9c-0x1dca) -- per-frame gate keyed on (0x8907) bit 1.
//   bit 1 CLEAR: tail-call the main-loop sub-state dispatcher (loc_0fd5) and ret.
//   bit 1 SET:   call loc_6da6, then scan a fixed cell and count matching bits.
// The scan sets HL = 0x5a28 (0x584c -> l-=0x24 -> 0x28; h += 2 -> 0x5a) and loops B=0x20 times.
// NB: the loop body reads the SAME cell (HL) every iteration -- there is no `inc hl` between djnz
// and the top (bytes 1db7..1dc2), so each of the 0x20 passes tests bit0/bit3 of (0x5a28). Faithful
// to the disasm. A += (bit0 set) + (bit3 clear) per pass; if the total != C (=0x20) it latches
// (0x89e7)=1, else ret z with nothing written.
export function loc_1d9c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);      m.step(0x1d9f, 13);
  regs.bit(1, regs.a);             m.step(0x1da1, 8);
  if (regs.fNZ) {
    m.step(0x1da7, 12);
  } else {
    m.step(0x1da3, 7);
    m.push16(0x1da6); m.step(0x0fd5, 17); m.call(0x0fd5);
    return m.ret(10);
  }

  // loc_1da7
  m.push16(0x1daa); m.step(0x6da6, 17); m.call(0x6da6);
  regs.hl = 0x584c;                m.step(0x1dad, 10);
  regs.a = regs.l;                 m.step(0x1dae, 4);
  regs.sub(0x24);                  m.step(0x1db0, 7);
  regs.l = regs.a;                 m.step(0x1db1, 4);
  regs.h = regs.inc8(regs.h);      m.step(0x1db2, 4);
  regs.h = regs.inc8(regs.h);      m.step(0x1db3, 4);
  regs.bc = 0x2020;                m.step(0x1db6, 10);
  regs.xor(regs.a);                m.step(0x1db7, 4);

  for (;;) { // loc_1db7 -- B passes over the fixed cell (HL)
    regs.bit(0, mem.read8(regs.hl)); m.step(0x1db9, 12);
    if (regs.fZ) {
      m.step(0x1dbc, 12);
    } else {
      m.step(0x1dbb, 7);
      regs.a = regs.inc8(regs.a);  m.step(0x1dbc, 4);
    }
    // loc_1dbc
    regs.bit(3, mem.read8(regs.hl)); m.step(0x1dbe, 12);
    if (regs.fNZ) {
      m.step(0x1dc1, 12);
    } else {
      m.step(0x1dc0, 7);
      regs.a = regs.inc8(regs.a);  m.step(0x1dc1, 4);
    }
    // loc_1dc1
    if (regs.djnz()) { m.step(0x1db7, 13); } else { m.step(0x1dc3, 8); break; }
  }

  regs.cp(regs.c);                 m.step(0x1dc4, 4);
  if (regs.fZ) { return m.ret(11); }
  m.step(0x1dc5, 5);
  regs.a = 0x01;                   m.step(0x1dc7, 7);
  mem.write8(0x89e7, regs.a);      m.step(0x1dca, 13);
  return m.ret(10);
}
