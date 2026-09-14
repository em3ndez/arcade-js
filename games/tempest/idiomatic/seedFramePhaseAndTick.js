// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  GAME_MODE, MODE_DISPATCH_SEL, FRAME_COUNTER, STATUS_FLAGS, PHASE_COUNTER, DSW1_SNAPSHOT, DSW2_SNAPSHOT, SOUND_STEP_GATE, loc_a2, INPUT_EDGE_FLAGS, IN0_PORT,
} from "./names.js";
import { advanceLevelCounter } from "./advanceLevelCounter.js";
import { stepEaromTransfer } from "./stepEaromTransfer.js";
import { loc_ccfa } from "./loc_ccfa.js";

// Per-frame dispatcher. A short setup decides the speed/mode cells (GAME_MODE/MODE_DISPATCH_SEL/loc_a2) from the
// coin input, the mode flag STATUS_FLAGS, and the phase counters DSW2_SNAPSHOT/PHASE_COUNTER, then a common tail advances
// the frame counter FRAME_COUNTER and fires the periodic sub-steps. The slot index rides X and Y from one
// sub-step to the next (the setup step and the odd-frame step each leave a fresh pair) and into the
// sound-register call, so both are threaded as locals rather than through the register file.
export function seedFramePhaseAndTick(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;

  let toC81b = false, toTail = false;
  if ((mem8[IN0_PORT] & 0x10) === 0) {           // coin input bit4 clear
    mem8[GAME_MODE] = 0x22;
    toTail = true;
  } else if ((mem8[STATUS_FLAGS] & 0x40) !== 0) {      // mode flag bit6 set
    toTail = true;
  } else if ((mem8[DSW2_SNAPSHOT] & 0x01) === 0) {      // even phase
    toC81b = true;
  } else {
    y = mem8[PHASE_COUNTER];
    if (y === 0) mem8[loc_a2] = 0x80;
    if ((mem8[loc_a2] & 0x80) === 0) {          // gate bit7 clear
      toC81b = true;
    } else if (y >= 2) {
      mem8[GAME_MODE] = 0x14;
      mem8[loc_a2] = 0x00;
      toC81b = true;
    } else if (y !== 0) {                        // y === 1
      mem8[MODE_DISPATCH_SEL] = 0x16;
      mem8[GAME_MODE] = 0x0a;
    }
  }

  if (!toTail) {
    if (toC81b && mem8[PHASE_COUNTER] !== 0) [x, y] = advanceLevelCounter(m, x);
    if ((mem8[DSW1_SNAPSHOT] & 0x03) === 0) mem8[PHASE_COUNTER] = 0x02;  // every fourth frame reseed
  }

  // Common tail.
  mem8[FRAME_COUNTER] = u8(mem8[FRAME_COUNTER] + 1);
  if ((mem8[FRAME_COUNTER] & 0x01) !== 0) [x, y] = stepEaromTransfer(m, x, y);  // odd frames
  if (mem8[SOUND_STEP_GATE] !== 0) loc_ccfa(m, x, y);                    // live -> register the sound
  // (The decimal-mode arm here -- SED gated on DECIMAL_MODE_FLAG != 0 && loc_9f > 0x13 -- is dead: DECIMAL_MODE_FLAG holds a
  // fixed checksum that is always 0, so the gate never opens. Verified statically and by observation of the
  // running game, where DECIMAL_MODE_FLAG is written 0 every time.)
  if ((mem8[INPUT_EDGE_FLAGS] & 0x80) !== 0) mem8[INPUT_EDGE_FLAGS] = 0x00;
}
