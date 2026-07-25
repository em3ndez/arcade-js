// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3069  (ROM 0x3069–0x306E) — 6 bytes, 4 instructions.
 *
 *   3069  df           rst  0x18            ; caller-skip vector
 *   306a  2a c0 63     ld   hl,(0x63c0)     ; INDIRECT: HL = the WORD AT 0x63C0
 *   306d  34           inc  (hl)
 *   306e  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: reached only via a dw jump table (2 refs), all
 * in untranslated code.
 *
 * Increments the byte POINTED AT by 0x63C0 -- `ld hl,(nn)` is the indirect load
 * (0x2A), so HL is the word stored at 0x63C0, NOT the address 0x63C0 itself. The
 * pointer cell is untouched; only the target byte moves.
 *
 * rst 0x18 POLARITY (the third one -- do not read it as rst 08/10): sub_0018 is
 * `ld hl,0x6009 / dec (hl) / ret z / inc sp / inc sp / ret`, so the BODY RUNS
 * WHEN THE COUNTER EXPIRES (reaches zero) and is SKIPPED while it is still
 * counting down. Reading it the other way inverts the routine.
 *
 * Returns TRUE on both paths, and never FALSE, because it CANNOT skip its
 * caller: sub_0018's skip arm discards the rst's own return and rets to
 * loc_3069's return address -- exactly where our `ret` would have gone -- so it
 * cuts THIS body short and the caller continues either way (the entry_06b8
 * scope-error lesson). TRUE rather than void so a future erroneous
 * `if (!m.call(0x3069)) return;` is INERT rather than a live defect.
 *
 * `ld hl,(nn)` has 10 precedents in the ROM. Not a novel form.
 *
 * REGISTER CONTRACT: sub_0018 sets HL = 0x6009 as a side effect. Harmless here
 * because 0x306A overwrites HL immediately -- but it is a side effect, not a
 * pure predicate, so do not "simplify" the vector into a boolean-only helper.
 */
export function loc_3069(m) {
  const { regs, mem } = m;

  m.push16(0x306a);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return true; // counter still counting -- body cut short, caller continues

  regs.hl = mem.read16(0x63c0); // INDIRECT -- the word AT 0x63C0, not 0x63C0
  m.step(0x306d, 16); // ld hl,(0x63c0)
  regs.incMem8(mem, regs.hl); // inc (hl) -- flag-correct RMW
  m.step(0x306e, 11); // inc (hl)

  m.ret(); // 306e
  return true;
}
