// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_1e8c  (ROM 0x1E8C–0x1E93) — caller-skip head; 0x197D calls it.
 *
 *   1e8c  3a 50 63     ld   a,(0x6350)
 *   1e8f  a7           and  a
 *   1e90  c8           ret  z            ; (0x6350)==0 -> normal return
 *   1e91  cd 96 1e     call 0x1e96       ; UNTRANSLATED -> NotImplemented
 *
 * On the non-zero path, control would fall into entry_1e94 after 0x1e96 returns.
 */
export function entry_1e8c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6350);
  m.step(0x1e8f, 13); // ld a,(0x6350)
  regs.and(regs.a);
  m.step(0x1e90, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z TAKEN -- normal return to the caller (11 T)
    return true;
  }
  m.step(0x1e91, 5); // ret z NOT taken (5 T), falls through

  m.push16(0x1e94); // call 0x1e96 pushes the return address 0x1E94
  m.step(0x1e96, 17);
  m.call(0x1e96);
  m.call(0x1e94); // skip tail: pop hl (discard loc_197a's 0x1980) + ret to loc_197a's caller
  return false; // CALLER-SKIP: loc_197a must NOT continue past 0x1980
}
