// SPDX-License-Identifier: GPL-3.0-only
/**
 * idiomaticVblankNmi -- the vblank interrupt body: a direct-JS engine-seam leaf the clock-free engine
 * fires once per generator yield (the mid body first, then this). Memory + IO only, no interrupt stack.
 * Per frame: stamp the draw-phase flag to the vblank half; decrement FRAME_DELAY_TIMER (the counter every
 * busy-wait delay generator spins on); run the frozen tilt/panic check; bank a BCD credit on a coin-switch
 * press edge. Then, only while GAME_ACTIVE: in-game (GAME_IN_PROGRESS) runs the fleet-march beat +
 * pending-alien draw + the object walker + the saucer timer; the attract demo takes the credit-screen or
 * ISR-task sub-arm. The object walker is now the idiomatic direct call; the attract sub-arms stay frozen
 * fallbacks until later steps. The attract boot exercises the demo sub-arm (GAME_ACTIVE set,
 * GAME_IN_PROGRESS clear), covered by the frame-stepped gate and the attract-state convergence.
 */
import {
  DRAW_PHASE_FLAG, FRAME_DELAY_TIMER, GAME_ACTIVE, GAME_IN_PROGRESS, CREDIT_COUNT, COIN_INPUT_LATCH,
  loc_2032, loc_2080, CREDIT_SCREEN_SHOWN,
  TILT_HANDLER, ATTRACT_CREDIT_SCREEN, ATTRACT_TASK_DISPATCH,
} from "./names.js";
import { callFrozenLeaf } from "./callFrozenLeaf.js";
import { loc_0248 } from "./loc_0248.js";
import { drawCreditCount } from "./drawCreditCount.js";
import { stepFleetMarchSound } from "./stepFleetMarchSound.js";
import { drawPendingAlien } from "./drawPendingAlien.js";
import { loc_0913 } from "./loc_0913.js";

const DRAW_PHASE_VBLANK = 0x80; // DRAW_PHASE_FLAG value for the vblank raster half (mid half = 0)
const CREDIT_CAP = 0x99;        // credit tally saturates at BCD 99

// 8080 `adi 1; daa`: BCD +1, carrying a low nibble at 9 into the high nibble (input is < 0x99, valid BCD).
function bcdInc(v) {
  return ((v & 0x0f) === 0x09 ? v + 0x07 : v + 0x01) & 0xff;
}

// IN1 bit0 is the (active-low) COIN switch -- 1 idle, 0 while a coin is in. Arm the
// latch each idle frame; on the idle->pressed edge (latch still armed) bank one BCD credit and repaint it.
function armCreditOnCoinPress(m) {
  if ((m.io.portIn(0x01) & 0x01) !== 0) { m.mem8[COIN_INPUT_LATCH] = 1; return; } // idle: (re)arm the edge
  if (m.mem8[COIN_INPUT_LATCH] === 0) return;                                       // no armed edge -> nothing
  if (m.mem8[CREDIT_COUNT] !== CREDIT_CAP) {
    m.mem8[CREDIT_COUNT] = bcdInc(m.mem8[CREDIT_COUNT]);
    drawCreditCount(m);
  }
  m.mem8[COIN_INPUT_LATCH] = 0; // consume the edge
}

export function idiomaticVblankNmi(m) {
  m.mem8[DRAW_PHASE_FLAG] = DRAW_PHASE_VBLANK;
  m.mem8[FRAME_DELAY_TIMER] = m.mem8[FRAME_DELAY_TIMER] - 1; // mem8 write truncates to a byte
  callFrozenLeaf(m, TILT_HANDLER);
  armCreditOnCoinPress(m);

  if (m.mem8[GAME_ACTIVE] === 0) return; // attract title/score screens: the ISR ends here

  if (m.mem8[GAME_IN_PROGRESS] !== 0) {
    // in-game vblank tail
    stepFleetMarchSound(m);
    m.mem8[loc_2080] = m.mem8[loc_2032];
    drawPendingAlien(m);
    loc_0248(m); // walk the vblank object-record table
    if (m.nextMain) return; // a handler armed a warm restart: SP is reseated into the main flow, so the rest of this tail (the saucer timer) does not run this frame
    loc_0913(m);
    return;
  }

  // attract demo (GAME_ACTIVE, not in-game): the credit-screen or ISR-task sub-arm
  if (m.mem8[CREDIT_COUNT] !== 0) {
    if (m.mem8[CREDIT_SCREEN_SHOWN] === 0) callFrozenLeaf(m, ATTRACT_CREDIT_SCREEN);
    return;
  }
  callFrozenLeaf(m, ATTRACT_TASK_DISPATCH);
}
