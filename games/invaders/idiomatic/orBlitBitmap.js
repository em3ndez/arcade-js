// SPDX-License-Identifier: GPL-3.0-only

// OR-merge C source bytes into each of B destination rows, one screen row apart; source runs straight through.
export function orBlitBitmap(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b, c = m.regs.c) {
  let dst = hl, src = de, rows = b;
  do {
    const rowStart = dst;
    let n = c;
    do {
      m.mem8[dst] = m.mem8[src] | m.mem8[dst];
      src = src + 1;
      dst = dst + 1;
      n = (n - 1) & 0xff;
    } while (n !== 0);
    dst = rowStart + 0x20;
    rows = (rows - 1) & 0xff;
  } while (rows !== 0);
  return [(m.regs.hl = dst), (m.regs.de = src)];
}
