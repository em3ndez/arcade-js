// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, MODE_DELAY_TIMER, STATUS_FLAGS, PHASE_COUNTER, HEARTBEAT_ACCUM_LO, HEARTBEAT_ACCUM_OVERFLOW, ACTIVE_SLOT_COUNT,
  INPUT_EDGE_FLAGS, SPINNER_ACCUM, loc_100, SPIKED_SEGMENT_COUNT, COORD_ACC_LO, COORD_ACC_HI,
} from "./names.js";

/**
 * advanceLevelCounter — the level-advance setup step. ROM 0xc81b (drain the phase counter by a gate-derived 0..2 step and bump the level cell).
 *
 * Role in the machine: this is Tempest's between-waves bookkeeper, run by the frame driver
 * (seedFramePhaseAndTick, 0xc891) at the moment the tube advances. It reads a two-bit request
 * gate the input layer left in INPUT_EDGE_FLAGS ($4e) — the pending-advance flags — against the
 * PHASE_COUNTER ($6) that meters how many phases are still owed, and works out how many levels to
 * step this frame (0, 1, or 2). Each step it drains one from the phase counter and, on a real
 * advance, pushes the on-screen level cell ($100) forward. When no advance is pending it instead
 * watches for a queued attract/intro trigger and, if armed, kicks the game into the intro mode.
 *
 * Behavior: mask $4e to bits 6..5 (the gate) and snapshot whether $6 >= 2, then clear $4e so the
 * request is consumed once. Gate clear -> if a spinner-motion value is latched (SPINNER_ACCUM $50
 * nonzero) and STATUS_FLAGS ($5) bit7 is clear, seed the intro/mode cells ($1=0x10, $4=0x20,
 * $0=0x0a, $2=0x14) and clear SPINNER_ACCUM and SPIKED_SEGMENT_COUNT ($16-region spike tally);
 * return with no step. Gate set -> derive step: if $6 >= 2 take 1 (and 2 more when gate bit6 is
 * set, draining $6 twice), else if only gate bit5 is set take 1; each 1 drains one from $6. Stash
 * step in ACTIVE_SLOT_COUNT; a zero step returns early. On a nonzero step set STATUS_FLAGS |= 0xc0,
 * zero the heartbeat accumulator ($16 lo / $18 overflow) and GAME_MODE ($0), then index a 16-bit
 * tally at COORD_ACC_LO/HI ($40c/$40d) by (step==1 ? 0 : 3), increment it with carry, and advance
 * the level cell $100 by step+1 clamped to 0x63.
 *
 * Live-out: PHASE_COUNTER $6 drained; ACTIVE_SLOT_COUNT $15 = step (then step-1 on the main path);
 * on a real advance STATUS_FLAGS $5, cells $16/$18/$0, the $40c/$40d tally and the level cell $100;
 * on the intro path the mode cells $0/$1/$2/$4 and cleared $50/spike tally. The [x, y] return is
 * threaded by a deferred caller to a sound/insert stash: Y = ldy #0 at entry, bumped only in the
 * step derivation -> equals `step` (0 on the early returns, 1..2 on the main path); X is never
 * loaded until c853, so every return before the status block leaves entry X untouched (the `xIn`
 * live-in), and on the main path X = $3e (step-1) then ldx #3 if nonzero. Grounding: [seen].
 */
export function advanceLevelCounter(m, xIn = m.regs.x) {
  const { mem8 } = m;
  const gate = mem8[INPUT_EDGE_FLAGS] & 0x60;     // pending-advance request bits 6..5 of $4e
  const counterGE2 = mem8[PHASE_COUNTER] >= 2;    // are at least two phases still owed?
  mem8[INPUT_EDGE_FLAGS] = 0x00;                  // consume the request once, whatever we do below

  if (gate === 0) {
    // No advance pending: watch for a queued intro/attract trigger. A latched spinner value with
    // STATUS_FLAGS bit7 clear means "arm the intro" -- seed the mode/timer cells and disarm.
    if (mem8[SPINNER_ACCUM] !== 0 && (mem8[STATUS_FLAGS] & 0x80) === 0) {
      mem8[MODE_DISPATCH_SEL] = 0x10;             // select the intro dispatch
      mem8[MODE_DELAY_TIMER] = 0x20;              // mode-delay countdown
      mem8[GAME_MODE] = 0x0a;                     // enter mode 0x0a
      mem8[GAME_MODE_PENDING] = 0x14;             // queue the next mode
      mem8[SPINNER_ACCUM] = 0x00;                 // disarm: clear the latched spinner value
      mem8[SPIKED_SEGMENT_COUNT] = 0x00;          // reset the spike tally
    }
    return [xIn, 0x00]; // X = entry X (never loaded); Y = ldy #0 (untouched)
  }

  // Derive the 0..2 level step from the gate and the phase counter, draining $6 as we go.
  let step = 0;
  if (counterGE2) {
    step = 1;
    mem8[PHASE_COUNTER] = (mem8[PHASE_COUNTER] - 1);   // one phase consumed
    if ((gate & 0x40) !== 0) {
      step = 2;
      mem8[PHASE_COUNTER] = (mem8[PHASE_COUNTER] - 1); // gate bit6 -> a double step
    }
  } else if ((gate & 0x20) !== 0) {
    step = 1;
    mem8[PHASE_COUNTER] = (mem8[PHASE_COUNTER] - 1);   // only bit5 set, and just one phase owed
  }

  mem8[ACTIVE_SLOT_COUNT] = step;                 // stash the step in $15
  if (step === 0) return [xIn, step]; // X = entry X (still not loaded); Y = 0

  // A real advance happened. Latch the advance in STATUS_FLAGS and reset the heartbeat/mode cells.
  mem8[STATUS_FLAGS] = mem8[STATUS_FLAGS] | 0xc0; // set the two top status bits
  mem8[HEARTBEAT_ACCUM_LO] = 0x00;                // clear heartbeat accumulator low
  mem8[HEARTBEAT_ACCUM_OVERFLOW] = 0x00;          // clear its overflow byte
  mem8[GAME_MODE] = 0x00;                          // back to mode 0

  // Index the 16-bit tally by step: 1 -> offset 0, 2 -> offset 3.
  mem8[ACTIVE_SLOT_COUNT] = (mem8[ACTIVE_SLOT_COUNT] - 1);
  let x = mem8[ACTIVE_SLOT_COUNT];
  if (x !== 0) x = 0x03;

  // Increment the little-endian 16-bit tally at $40c/$40d+x, carrying into the high byte on wrap.
  const lo = (mem8[u16(COORD_ACC_LO + x)] + 1) & 0xff;
  mem8[u16(COORD_ACC_LO + x)] = lo;
  if (lo === 0) mem8[u16(COORD_ACC_HI + x)] = (mem8[u16(COORD_ACC_HI + x)] + 1);

  // Advance the on-screen level cell by step+1, clamped so it never exceeds 0x63.
  let sum = (mem8[loc_100] + mem8[ACTIVE_SLOT_COUNT] + 1) & 0xff;
  if (sum >= 0x63) sum = 0x63;
  mem8[loc_100] = sum;

  return [x, step]; // X = c853 result (step-1 or ldx #3); Y = step (1..2)
}
