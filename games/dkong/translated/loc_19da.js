// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_19da  (ROM 0x19DA–0x19EC) — 3-entry table search (stride 4) over 0x6A0C.
 * ONE caller: 0x19AD.
 * Compares X (0x6203) against table[i]; a match jp-jumps to entry_19ed (0x19ED-0x1A06,
 * EXTERNAL undrafted routine -- NOT the spine finale at 0x1977) -> NotImplemented frontier.
 * No match -> ret.
 */
export function loc_19da(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6203); // X
  m.step(0x19dd, 13); // ld a,(0x6203)
  regs.b = 0x03;
  m.step(0x19df, 7); // ld b,0x03
  regs.hl = 0x6a0c;
  m.step(0x19e2, 10); // ld hl,0x6a0c
  do {
    // -- loc_19e2 --
    regs.cp(mem.read8(regs.hl));
    m.step(0x19e3, 7); // cp (hl)
    if (regs.fZ) {
      m.step(0x19ed, 10); // jp z,0x19ed -- X-match; TAIL-jump (entry_19ed's ret returns to our caller)
      return m.call(0x19ed);
    }
    m.step(0x19e6, 10); // jp z not taken
    regs.l = regs.inc8(regs.l);
    m.step(0x19e7, 4); // inc l
    regs.l = regs.inc8(regs.l);
    m.step(0x19e8, 4); // inc l
    regs.l = regs.inc8(regs.l);
    m.step(0x19e9, 4); // inc l
    regs.l = regs.inc8(regs.l);
    m.step(0x19ea, 4); // inc l -- stride 4
    regs.djnz();
    m.step(regs.b !== 0 ? 0x19e2 : 0x19ec, regs.b !== 0 ? 13 : 8); // djnz 0x19e2
  } while (regs.b !== 0);
  m.ret(); // 0x19EC -- no match
}
