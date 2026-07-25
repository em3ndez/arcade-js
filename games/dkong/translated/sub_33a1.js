// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_33a1  (ROM 0x33A1–0x33AC) — 12 bytes, 8 instructions.
 *
 *   33a1  3e 07        ld   a,0x07
 *   33a3  f7           rst  0x30            ; CALLER-SKIP GATE
 *   33a4  dd 7e 0f     ld   a,(ix+0x0f)
 *   33a7  fe 59        cp   0x59
 *   33a9  d0           ret  nc              ; normal return when (ix+0x0f) >= 0x59
 *   33aa  33           inc  sp              ; STACK SPLICE
 *   33ab  33           inc  sp
 *   33ac  c9           ret                  ; -> the caller's CALLER
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x334A (entry_333d, untranslated).
 * IX live-in.
 *
 * TWELVE BYTES WITH TWO DIFFERENT CALLER-SKIPS, AND THEY ARE NOT THE SAME SKIP.
 * Per the ROM-wide rst doctrine (rst 08/10/18/20/30 are one-byte "abort my
 * caller" guard clauses; 28 and 38 are NOT):
 *
 *   1. `rst 0x30` (0x33A3) aborts THIS routine. sub_0030 rotates A (=0x07) right
 *      by the count at 0x6227 and, when the selected bit is clear, discards the
 *      rst's return address and rets -- so control lands back in entry_333d at
 *      the instruction after `call 0x33a1`. From entry_333d's point of view that
 *      is a NORMAL (just early) return, which is why this path returns TRUE.
 *   2. `inc sp / inc sp / ret` (0x33AA) discards sub_33a1's OWN return address,
 *      so the ret goes to entry_333d's CALLER -- entry_333d is SKIPPED. That
 *      path returns FALSE, and entry_333d must `if (!m.call(0x33a1)) return;`.
 *
 * So the boolean here means "was entry_333d returned to normally?", NOT "did the
 * gate fire". Conflating the two would make the rst path look like a skip and
 * strand entry_333d's continuation. Modelled on the settled convention
 * (sub_0008, mainloop.js:172-183 -- the identical ret-nc/inc-sp/inc-sp/ret
 * shape) rather than a new one.
 *
 * `ret nc` is the UNSIGNED test: `cp 0x59` sets carry when (ix+0x0f) < 0x59, so
 * the splice fires BELOW 0x59 and the normal return is at-or-above it.
 */
export function sub_33a1(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = 0x07;
  m.step(0x33a3, 7); // ld a,0x07

  m.push16(0x33a4);
  m.step(0x0030, 11); // rst 0x30 -- caller-skip gate
  if (!m.call(0x0030)) return true; // gate fired: entry_333d WAS returned to (early)

  regs.a = mem.read8(R(0x0f));
  m.step(0x33a7, 19); // ld a,(ix+0x0f)
  regs.cp(0x59);
  m.step(0x33a9, 7); // cp 0x59
  if (regs.fNC) {
    m.ret(11); // ret nc -- normal return, (ix+0x0f) >= 0x59
    return true;
  }
  m.step(0x33aa, 5); // ret nc NOT taken -- (ix+0x0f) < 0x59

  // STACK SPLICE: drop our own return address so the ret below lands in
  // entry_333d's CALLER. entry_333d is skipped entirely.
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x33ab, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x33ac, 6); // inc sp
  m.ret(); // 33ac -- returns to the caller's CALLER
  return false; // entry_333d must return immediately
}
