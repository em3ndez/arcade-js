// SPDX-License-Identifier: GPL-3.0-only
import { loc_00, loc_53 } from "./names.js";
import { loc_cd95 } from "./loc_cd95.js";
import { loc_c7bd } from "./loc_c7bd.js";
import { loc_c891 } from "./loc_c891.js";
import { loc_b1b6 } from "./loc_b1b6.js";

// The main frame loop. After a one-time setup it free-runs forever, pacing itself off the interrupt-driven
// frame counter loc_53 (the ~246Hz IRQ increments it): each pass waits until nine interrupts have
// accumulated, clears the counter, and runs the three per-update passes. Expressed as a generator so the
// wait IS the frame boundary — the clock-free engine resumes it once the interrupts it fires bring loc_53
// up to nine, so the busy-wait collapses to a single yield per game update (~26.5Hz). Non-terminating:
// validated by the whole-game boot/convergence, not an isolated equivalence test.
export function* loc_c7a0(m) {
  const { mem8 } = m;
  loc_cd95(m);
  mem8[loc_00] = 0;
  for (;;) {
    while (mem8[loc_53] < 9) yield;
    mem8[loc_53] = 0;
    loc_c7bd(m);
    loc_c891(m);
    loc_b1b6(m);
  }
}
