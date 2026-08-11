// SPDX-License-Identifier: GPL-3.0-only
/** flyDemoShipByScript — the demo pilot's auto-steer. A countdown byte carries a dwell in its low six bits and
 *  a two-bit turn command in its top two. Each pass ticks the dwell and keeps the byte; when it is
 *  spent (zero or one) the pass steps a script pointer, reloads from the next entry and looks again,
 *  so a run of spent entries is skipped at once. The surviving command nudges the heading one way,
 *  the other, or not at all, then hands off to the world-scroll mover. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { scrollWorldAtTheEraPace } from "./scrollWorldAtTheEraPace.js";
import { DEMO_SCRIPT_DWELL, DEMO_SCRIPT_POINTER_LO } from "./names.js";

const HEADING = 0xa802;
const DWELL_BITS = 0x3f;
const TURN_STEP = 3;

export function flyDemoShipByScript(m) {
  const { regs, mem8, mem16 } = m;

  let command;
  for (;;) {
    const countByte = mem8[DEMO_SCRIPT_DWELL];
    if ((countByte & DWELL_BITS) > 1) {
      command = u8(countByte - 1);
      mem8[DEMO_SCRIPT_DWELL] = command;
      break;
    }
    const next = u16(mem16[DEMO_SCRIPT_POINTER_LO] + 1);
    mem16[DEMO_SCRIPT_POINTER_LO] = next;
    mem8[DEMO_SCRIPT_DWELL] = u8(mem8[next] + 1);
  }

  const turn = (command >> 6) & 3;
  if (turn === 1) mem8[HEADING] = u8(mem8[HEADING] - TURN_STEP);
  else if (turn !== 0) mem8[HEADING] = u8(mem8[HEADING] + TURN_STEP);

  regs.exx(); // the mover runs on the alternate register bank; this pass never swaps back
  return scrollWorldAtTheEraPace(m);
}
