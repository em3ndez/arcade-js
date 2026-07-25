// SPDX-License-Identifier: GPL-3.0-only

/**
 * handler_1977  (ROM 0x1977–0x19D9) — THE FINALE. Task-table entry dw 0x1977 @0x074E.
 * (game state 1 sub-state, reached via the 0x0748 rst-28 dispatch).
 *
 *  1977 cd ee 21 call 0x21ee ; sub_21ee -- PLAIN call (NOT skip-capable)
 *                                  ; then FALLS THROUGH into loc_197a
 *
 * = `call sub_21ee` (the animation-counter tick) then the shared loc_197a per-frame
 * update cascade. loc_197a is the SAME cascade WITHOUT the 0x21ee call (its own task
 * entry dw 0x197a @0x071A) -- TWO task entries sharing a tail, integrated as two
 * functions. This is THE reach-mover: wiring it live runs the whole engine cascade
 * (including the spine: entry_1ac3, sub_1f72, entry_30ed, ...).
 */
export function handler_1977(m) {
  m.push16(0x197a);
  m.step(0x21ee, 17); // call 0x21ee
  m.call(0x21ee); // PLAIN call -- returns to 0x197A, NO guard
  return m.call(0x197a); // fall through into the shared cascade
}
