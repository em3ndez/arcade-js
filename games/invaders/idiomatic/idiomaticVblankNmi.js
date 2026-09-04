// SPDX-License-Identifier: GPL-3.0-only
/**
 * idiomaticVblankNmi -- the vblank (RST2) interrupt body, run once per frame.
 *
 * WHAT IT IS
 *   The top-of-frame heartbeat. The clock-free engine fires this once per generator yield (the mid-screen
 *   body first, then this one). It is a direct-JS engine-seam leaf: memory + IO only, with no interrupt
 *   stack -- the ROM's push/pop of PSW/BC/DE/HL and the shared epilogue loc_0082 (`pop.../ei/ret`) have no
 *   analogue here, so a ROM `call`/`jmp 0x0082` simply becomes a `return`. Each frame it stamps the raster
 *   draw-phase flag to the vblank half, ticks the busy-wait frame counter, runs the tilt/panic check, and
 *   banks a coin; then, only while a game or demo is live, it dispatches the frame's real work.
 *
 * ROLE IN THE MACHINE
 *   Mirrors ROM loc_0010. It sets DRAW_PHASE_FLAG (0x2072) = 0x80 (the mid body clears it to 0, so this one
 *   byte names which raster half is live and the object dispatchers gate on it); decrements
 *   FRAME_DELAY_TIMER (0x20c0), the counter every busy-wait delay spins on; calls checkTiltInput (ROM
 *   0x17cd), which on a tilt press arms a warm restart and, by returning truthy, abandons the rest of this
 *   frame; and banks one BCD credit into CREDIT_COUNT (0x20eb) on a coin-switch press edge (via
 *   COIN_INPUT_LATCH, 0x20ea). GAME_ACTIVE (0x20e9) is the master gate: clear -> the ISR ends here (attract
 *   title/score screens). Set and GAME_IN_PROGRESS (0x20ef) nonzero -> the in-game tail (stepFleetMarchSound
 *   then the shared serviceVblankObjects). Set but not in-game (the attract demo) -> the credit-screen
 *   sub-arm (arm creditScreen as the next main flow, shown once via CREDIT_SCREEN_SHOWN 0x2093) or, with no
 *   credit pending, the attract task dispatcher dispatchAttractTask.
 *
 * ROM 0x0010-0x0071.  Grounding: [code] (the ISR body is tagged [code] in mechanisms.md; the frame cells it
 * touches -- DRAW_PHASE_FLAG, FRAME_DELAY_TIMER, GAME_ACTIVE, COIN_INPUT_LATCH, CREDIT_COUNT,
 * CREDIT_SCREEN_SHOWN, GAME_IN_PROGRESS -- are all [seen]).
 *
 * LIVE-OUT: memory + IO + m.nextMain (armed on a tilt reset or the credit-screen hand-off). No register
 * result; the engine loop consumes m.nextMain to swap the main flow.
 */
import {
  DRAW_PHASE_FLAG, FRAME_DELAY_TIMER, GAME_ACTIVE, GAME_IN_PROGRESS, CREDIT_COUNT, COIN_INPUT_LATCH,
  CREDIT_SCREEN_SHOWN,
} from "./names.js";
import { creditScreen } from "./creditScreen.js";
import { checkTiltInput } from "./checkTiltInput.js";
import { serviceVblankObjects } from "./serviceVblankObjects.js";
import { dispatchAttractTask } from "./dispatchAttractTask.js";
import { drawCreditCount } from "./drawCreditCount.js";
import { stepFleetMarchSound } from "./stepFleetMarchSound.js";

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
  // Stamp the draw-phase flag to the vblank half (0x80). The mid body stamps 0x00, so this single byte
  // tells the object dispatchers which raster half is live and keeps sprites from tearing across the beam.
  m.mem8[DRAW_PHASE_FLAG] = DRAW_PHASE_VBLANK;
  // Tick the busy-wait frame counter down one; every attract/round delay generator spins waiting for it.
  m.mem8[FRAME_DELAY_TIMER] = m.mem8[FRAME_DELAY_TIMER] - 1; // mem8 write truncates to a byte
  // Tilt/panic check (the one unconditional per-frame call): on a tilt press it arms a warm restart.
  if (checkTiltInput(m)) return; // tilt tripped: the armed warm restart abandons the rest of this frame's service
  // Coin service: re-arm the coin latch each idle frame and bank one BCD credit on the idle->pressed edge.
  armCreditOnCoinPress(m);

  // Master gate: with no game or demo live the interrupt has nothing more to do this frame.
  if (m.mem8[GAME_ACTIVE] === 0) return; // attract title/score screens: the ISR ends here

  // In-game: sound the fleet-march beat, then run the shared per-frame object tail.
  if (m.mem8[GAME_IN_PROGRESS] !== 0) {
    // in-game vblank tail: the fleet-march beat, then the shared record tail (which returns early on a
    // warm restart armed during the object walk)
    stepFleetMarchSound(m);
    serviceVblankObjects(m);
    return;
  }

  // Attract demo (GAME_ACTIVE set, not in-game): either bring up the credit/start screen or run one demo task.
  // attract demo (GAME_ACTIVE, not in-game): the credit-screen or ISR-task sub-arm
  if (m.mem8[CREDIT_COUNT] !== 0) {
    // A credit is banked: arm the credit/start screen as the next main flow, but only the first time
    // (CREDIT_SCREEN_SHOWN latches it). Once it has been shown, do nothing further this frame.
    if (m.mem8[CREDIT_SCREEN_SHOWN] === 0) { m.nextMain = () => creditScreen(m); return; }
    return;
  }
  // No credit pending: run the attract task dispatcher, which does exactly one TASK_FLAGS-selected job.
  dispatchAttractTask(m);
}
