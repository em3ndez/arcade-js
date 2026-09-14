// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, MODE_DELAY_TIMER, STATUS_FLAGS, PHASE_COUNTER, HEARTBEAT_ACCUM_LO, HEARTBEAT_ACCUM_OVERFLOW, ACTIVE_SLOT_COUNT,
  INPUT_EDGE_FLAGS, SPINNER_ACCUM, loc_100, SPIKED_SEGMENT_COUNT, COORD_ACC_LO, COORD_ACC_HI,
} from "./names.js";

// From a two-bit gate in one flag byte and a >=2 test on a counter, derive a
// step of 0..2 and subtract it from the counter. When the gate is clear, maybe
// seed four intro cells; when the step is nonzero, set two status bits, zero
// three cells, bump a 16-bit tally, and clamp a value to 0x63.
//
// Live-out: exit X/Y (a deferred caller threads both to a sound/insert stash).
// Y = ldy #0 at entry, bumped only in the seed loops -> equals `step` (0 on the
// early returns, 1..2 on the main path). X is never loaded until c853, so every
// return before the status block leaves entry X untouched (the `xIn` live-in);
// on the main path X = $3e (step-1) then ldx #3 if nonzero. Returns [x, y].
export function advanceLevelCounter(m, xIn = m.regs.x) {
  const { mem8 } = m;
  const gate = mem8[INPUT_EDGE_FLAGS] & 0x60;
  const counterGE2 = mem8[PHASE_COUNTER] >= 2;
  mem8[INPUT_EDGE_FLAGS] = 0x00;

  if (gate === 0) {
    if (mem8[SPINNER_ACCUM] !== 0 && (mem8[STATUS_FLAGS] & 0x80) === 0) {
      mem8[MODE_DISPATCH_SEL] = 0x10;
      mem8[MODE_DELAY_TIMER] = 0x20;
      mem8[GAME_MODE] = 0x0a;
      mem8[GAME_MODE_PENDING] = 0x14;
      mem8[SPINNER_ACCUM] = 0x00;
      mem8[SPIKED_SEGMENT_COUNT] = 0x00;
    }
    return [xIn, 0x00]; // X = entry X (never loaded); Y = ldy #0 (untouched)
  }

  let step = 0;
  if (counterGE2) {
    step = 1;
    mem8[PHASE_COUNTER] = (mem8[PHASE_COUNTER] - 1);
    if ((gate & 0x40) !== 0) {
      step = 2;
      mem8[PHASE_COUNTER] = (mem8[PHASE_COUNTER] - 1);
    }
  } else if ((gate & 0x20) !== 0) {
    step = 1;
    mem8[PHASE_COUNTER] = (mem8[PHASE_COUNTER] - 1);
  }

  mem8[ACTIVE_SLOT_COUNT] = step;
  if (step === 0) return [xIn, step]; // X = entry X (still not loaded); Y = 0

  mem8[STATUS_FLAGS] = mem8[STATUS_FLAGS] | 0xc0;
  mem8[HEARTBEAT_ACCUM_LO] = 0x00;
  mem8[HEARTBEAT_ACCUM_OVERFLOW] = 0x00;
  mem8[GAME_MODE] = 0x00;

  mem8[ACTIVE_SLOT_COUNT] = (mem8[ACTIVE_SLOT_COUNT] - 1);
  let x = mem8[ACTIVE_SLOT_COUNT];
  if (x !== 0) x = 0x03;

  const lo = (mem8[u16(COORD_ACC_LO + x)] + 1) & 0xff;
  mem8[u16(COORD_ACC_LO + x)] = lo;
  if (lo === 0) mem8[u16(COORD_ACC_HI + x)] = (mem8[u16(COORD_ACC_HI + x)] + 1);

  let sum = (mem8[loc_100] + mem8[ACTIVE_SLOT_COUNT] + 1) & 0xff;
  if (sum >= 0x63) sum = 0x63;
  mem8[loc_100] = sum;

  return [x, step]; // X = c853 result (step-1 or ldx #3); Y = step (1..2)
}
