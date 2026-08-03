// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1977 — issue the attract demo's scripted input for this frame, then run the shared
 * per-frame update cascade.  ROM 0x1977.
 *
 * Two steps and nothing else, in that order. advanceAttractDemoInput writes this frame's
 * canned control word over the cooked player input; the cascade at 0x197A — still the
 * frozen oracle — then runs the same per-frame update the played game runs, reading that
 * control word as if a joystick had produced it. The cascade carries a dispatch entry of
 * its own, which is how the played game reaches it without the demo-input step.
 *
 * WHAT THIS DOES NOT CLAIM. "The attract demo" is measured rather than assumed: a
 * 2000-frame attract run dispatches this 1416 times, every one at GAME_STATE 1 /
 * GAME_SUBSTATE 3, while a coin+start tape that reaches GAME_STATE 3 dispatches it zero
 * times in 1600 frames (both in equivalence-1977.test.js). What was NOT established is
 * whether GAME_STATE 1 / GAME_SUBSTATE 3 can be entered outside attract — a continue or
 * two-player path, say. Only attract and that one tape were driven.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1977.test.js.
 * GATE:     real captures + live-wire. EVERY dispatch a 2000-frame attract run produces is
 *           replayed oracle-vs-rewrite, with no sampling (the test asserts replayed ==
 *           dispatched); the rewrite is then wired live for a 1200-frame run whose whole
 *           frame trace must match the all-oracle baseline on RAM − STACK_SCRATCH. There is
 *           no crafted arm because the routine is branch-free — it has no unreached arm to
 *           craft. Teeth: dropping the demo-input step, taking it twice, and taking it after
 *           the cascade instead of before.
 * LIVE-OUT: memory-only, plus the control-flow return itself. The only call site in the whole
 *           frozen layer is the shared rst-0x28 dispatcher, and the one table carrying this
 *           address is the game-state-1 sub-state table at ROM 0x0748, whose dispatch is a
 *           tail — it drops the returned value. That table is itself reached as a tail from
 *           the NMI game-state dispatch, whose epilogue at ROM 0x00D2 pops AF, BC, DE, HL, IX
 *           and IY straight back off the stack. So nothing reads a register or flag this
 *           leaves. Measured as well: across all 1416 dispatches the whole register file, SP
 *           and the returned value are identical to the oracle anyway, because the shared
 *           0x197A tail overwrites everything the replaced call left behind.
 * NAMES:    none imported — this routine names no memory of its own. Callees:
 *           advanceAttractDemoInput (ROM 0x21EE, idiomatic); ROM 0x197A is still frozen and
 *           so stays an m.call.
 */

import { advanceAttractDemoInput } from "./advanceAttractDemoInput.js";

export function loc_1977(m) {
  // The demo's input for this frame has to land before the cascade reads it.
  advanceAttractDemoInput(m);

  // The shared per-frame update cascade at 0x197A — still the frozen oracle.
  return m.call(0x197a);
}
