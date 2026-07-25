// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_1ac3  (ROM 0x1AC3–0x1AE3) — PLAYER movement / climb / jump state machine.
 * ROM 0x1AC3-0x1D02 (576 bytes, ~130 insns). Called ONCE from loc_197a @ 0x1980
 *  (handler_1977's cascade).
 *
 * ONE UNIT: every interior label (loc_1ae6 .. loc_1cf2) is reached
 * only from within this span -- extent PROVEN by forward reachability trace, so
 * the interior labels are module-local helpers, not separate entries.
 *
 * Not yet wired into the live dispatcher: its only caller loc_197a is untranslated (the
 * handler_1977 spine); nothing in translated src invokes entry_1ac3. Goes
 * live only at the finale (step 4).
 *
 * THREE LOAD-BEARING FACTS:
 *  (1) call 0x236e @ 0x1B13 (loc_1afe) is a HIDDEN EXIT -- on a miss it unwinds
 *      past entry_1ac3 to loc_197a and aborts this routine. Boolean-guarded:
 *      `if (!m.call(0x236e)) return;`. Its found-path A is carried across a
 *      flag-clobbering region by a push af / pop af bracket (0x1B16-0x1B2D) --
 *      modelled as regs.af save/restore; dropping it corrupts the 0x1B2D branch.
 *  (2) 0x1C23-0x1C32 is LIVE CODE the listing hides as `defb UNREACHED` (the
 *      tracer stopped after call 0x2853, which returns normally). Transcribed live.
 *  (3) loc_1bb2 sets IX=0x6200 itself and uses a LOCAL X-helper; the loc_1afe
 *      spine uses the caller's IX via R. Two distinct IX regimes -- kept separate.
 *
 * Dispatches on 0x6216/0x621e/0x6217/0x6215 (state) + 0x6010 (input), then moves
 * the player or hands to the 0x1Dxx cluster (mostly jp 0x1da6). External tail
 * targets return <ext>(m). call z 0x1d95 (0x1C70) is a non-executing frontier
 * (0x1D95 not integrated). Object/state fields not interpreted.
 */
export function entry_1ac3(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  // ---- HEAD DISPATCH (0x1AC3-0x1AE5): five state/input tests, all fall-through ----
  regs.a = mem.read8(0x6216); // PRIMARY movement state
  m.step(0x1ac6, 13); // ld a,(0x6216)
  regs.a = regs.dec8(regs.a);
  m.step(0x1ac7, 4); // dec a
  if (regs.fZ) { m.step(0x1bb2, 10); return m.call(0x1bb2); } // jp z -- state 1 (airborne)
  m.step(0x1aca, 10);

  regs.a = mem.read8(0x621e); // lock/freeze countdown
  m.step(0x1acd, 13); // ld a,(0x621e)
  regs.and(regs.a);
  m.step(0x1ace, 4); // and a
  if (regs.fNZ) { m.step(0x1b55, 10); return m.call(0x1b55); } // jp nz -- lock ticking
  m.step(0x1ad1, 10);

  regs.a = mem.read8(0x6217); // climb sub-state
  m.step(0x1ad4, 13); // ld a,(0x6217)
  regs.a = regs.dec8(regs.a);
  m.step(0x1ad5, 4); // dec a
  if (regs.fZ) { m.step(0x1ae6, 10); return m.call(0x1ae6, R); } // jp z -- climb path
  m.step(0x1ad8, 10);

  regs.a = mem.read8(0x6215);
  m.step(0x1adb, 13); // ld a,(0x6215)
  regs.a = regs.dec8(regs.a);
  m.step(0x1adc, 4); // dec a
  if (regs.fZ) { m.step(0x1b38, 10); return m.call(0x1b38); } // jp z
  m.step(0x1adf, 10);

  regs.a = mem.read8(0x6010); // PLAYER INPUT
  m.step(0x1ae2, 13); // ld a,(0x6010)
  regs.rla(); // bit 7 (button) -> carry
  m.step(0x1ae3, 4); // rla
  if (regs.fC) { m.step(0x1b6e, 10); return m.call(0x1b6e); } // jp c -- start jump
  m.step(0x1ae6, 5); // falls through to loc_1ae6
  return m.call(0x1ae6, R);
}
