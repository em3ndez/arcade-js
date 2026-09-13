// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_00, loc_1, loc_b4, loc_c00, loc_2000,
  loc_60c0, loc_60cf, loc_60d0, loc_60df, loc_60e0,
} from "./names.js";
import { loc_de11 } from "./loc_de11.js";
import { loc_abac } from "./loc_abac.js";
import { loc_c16e } from "./loc_c16e.js";
import { loc_c7a0 } from "./loc_c7a0.js";

// loc_c00 bit 4 is the operator self-test switch: idle HIGH boots the game, clear runs diagnostics. [code]
const SELF_TEST = 0x10;

// loc_d93f — the power-on reset entry, a generator. Wipes work/vector RAM, seeds the small control block,
// then forks on the self-test switch: idle boots (device-init chain, then becomes the main-loop spine via
// yield*); held diverts to the diagnostic spin. Validated by the whole-machine boot, not an isolated test.
// The reset's stack seat, interrupt-disable, decimal-clear and watchdog/AVG strobes have no engine effect
// (the engine retires the stack pointer and gates interrupts itself) and are dropped.
export function* loc_d93f(m) {
  const { mem8 } = m;

  // Wipe the two mapped RAM windows before anything reads them: the low work/stack/video pages and the
  // vector/display pages; the unmapped gap between them is left untouched.
  for (let a = 0; a < 2048; a++) mem8[loc_00 + a] = 0;
  for (let a = 0; a < 4096; a++) mem8[loc_2000 + a] = 0;

  // Seed the small control block the wipe does not cover: a pair of cells to their power-on 7, two more
  // to 0, and two short runs zeroed. Initialised only here, on reset.
  mem8[loc_1] = 0;
  mem8[loc_60e0] = 0;
  mem8[loc_60cf] = 7;
  mem8[loc_60df] = 7;
  for (let i = 8; i >= 0; i--) {
    mem8[loc_60c0 + i] = 0;
    mem8[loc_60d0 + i] = 0;
  }

  // Fork on the self-test switch. Bit 4 of IN0 idles high, so a set bit is an ordinary power-on.
  if ((mem8[loc_c00] & SELF_TEST) !== 0) {
    // Normal boot: seed the mode flag, run the device-init chain, then become the main loop (the original's
    // power-on settle delay is net-zero on RAM and dropped). yield* never returns.
    mem8[loc_b4] = 0x10;
    loc_de11(m);
    loc_abac(m);
    loc_c16e(m);
    yield* loc_c7a0(m);
    return;
  }

  // Self-test switch held: divert into the operator diagnostic (reached only when a technician holds the
  // switch, never in normal play; [code], represented as a faithful non-terminating spin).
  yield* spinSelfTest(m);
}

// Operator self-test spin: yields forever (the original's diagnostic runs until power-cycled), reproducing
// no diagnostic RAM effects since that path is [code] / rarely-entered.
function* spinSelfTest(m) {
  for (;;) yield;
}
