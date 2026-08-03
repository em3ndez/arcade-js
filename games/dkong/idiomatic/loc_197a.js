// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_197a — the per-frame gameplay update cascade: run the frame's subsystem updates in a
 * fixed order, then, if Mario stopped being active during them, hand the game over to the
 * death sub-state.  ROM 0x197A.
 *
 * Twenty-four updates run in sequence with no data passed between them — every one of them
 * reads and writes work RAM and returns nothing this routine looks at. What loc_197a itself
 * contributes is the ORDER, three gates that can abandon the rest of the frame, and the death
 * hand-off at the end (which adds two more callees, on that arm only). Twenty-five of the
 * twenty-six are already idiomatic and are direct calls; ROM 0x1F72 is the one that is not.
 *
 * The three gates, each a callee whose `false` means "this frame's remaining gameplay update is
 * off": the effect-latch gate (an effect is playing, so the frame belongs to it), the board-won
 * check (the board was won and the win path already committed the advance), and the
 * bonus-expired step machine (its last step takes the death exit once Mario is grounded). All
 * three resume exactly where an ordinary return resumes — in the oracle they unwind by
 * discarding this routine's saved return address, which lands control at this routine's caller —
 * so all three are a plain `return` here and this routine is NOT itself caller-skip-capable.
 *
 * THE TAIL IS THE DEATH HAND-OFF. Mario can be alive at entry and dead by the time the cascade
 * finishes — the object-collision and hazard updates above are what kill him. So the last act
 * reads MARIO_ACTIVE: still active, and the frame is simply over; zero, and the routine silences
 * every sound output, fires sound trigger 2, and steps the sub-state. Corroborated outside this
 * body: the sub-state dispatch tables in ROM make the next index the death-animation router on
 * BOTH paths that reach here — in-game (ROM 0x0702) index 0x0C is this cascade and 0x0D is
 * ROM 0x127C, and in attract (ROM 0x0748) index 3 is this cascade and 4 is the same ROM 0x127C.
 * The sound bit is bit 2 of the ls259.6h latch, which games/dkong/audio/README.md maps from
 * MAME's driver to the discrete "boom"/stomp circuit.
 *
 * Reads MARIO_ACTIVE; writes sound trigger 2. Every other cell it affects, it affects through a
 * callee.
 *
 * Memory-equivalent to the frozen oracle — equivalence-197a.test.js.
 * GATE:     ATTRACT ONLY for the real dispatches, plus crafted arms on top of real captures.
 *           MEASURED: 3826 natural dispatches in 8000 attract frames, first at frame 586, and
 *           ALL 3826 entered through the attract task's tail (ROM 0x1977) — none through the
 *           in-game dispatch (ROM 0x00CA's game-state-3 arm), because attract never enters that
 *           state. THE IN-GAME ENTRY PATH IS THEREFORE NOT COVERED; both counts are asserted in
 *           the gate rather than only stated here. EVERY one of the 3826 is replayed inline,
 *           oracle against this file on byte-identical clones, compared on RAM − STACK_SCRATCH
 *           and the return value. Attract reaches three of the five arms — the ordinary
 *           end-of-frame return (3239), the effect-latch abandon (584), and the death hand-off
 *           (3). The board-won and bonus-expired abandons it never reaches, so those are driven
 *           by poking one or two bytes onto REAL captured entries, identically on both sides,
 *           with the gate asserting from the oracle's own call sequence that the poke armed the
 *           intended arm (120/120, 83/120, and 119/120 for a crafted death hand-off). Teeth:
 *           five broken twins, each asserted to be caught by the arm that is supposed to catch
 *           it and, for two of them, to ESCAPE the arms that are not.
 * LIVE-OUT: memory-only; returns undefined on every arm. The two callers (ROM 0x1977's tail and
 *           ROM 0x00CA's game-state-3 dispatch, the only two call sites of this address in the
 *           tree) both discard the value, and both return straight into the task dispatcher,
 *           whose next act reloads its own state. DERIVED that way and MEASURED as well — but
 *           note WHAT the measurement is against, because an all-oracle baseline would be the
 *           wrong control for a routine that direct-calls twenty-five idiomatic callees: this
 *           routine is wired live on top of the SHIPPING configuration (every one of the 389
 *           routines in ROUTINES wired), against that same configuration with this address left
 *           frozen. 844 dispatches over 3000 frames, every live cell identical, and the guest
 *           stack pinned at 0x6C00 at every vblank yield on both sides. The dead stack scratch
 *           is NOT identical there and is not expected to be — twenty-five dissolved call
 *           brackets no longer write their return words — so that region is excluded from the
 *           byte comparison and covered by the SP assertion instead.
 * NAMES:    MARIO_ACTIVE (0x6200) and SND_TRIGGER (0x6080, an 8-entry array — this writes
 *           entry 2) from ram.js. ROM 0x1F72 is the one callee with no idiomatic file yet, so it
 *           stays an addressed call with the return bracket its oracle's `ret` pops.
 */

import { MARIO_ACTIVE, SND_TRIGGER } from "./ram.js";

import { dispatchEffectState } from "./dispatchEffectState.js"; // ROM 0x1DBD
import { loc_1e8c } from "./loc_1e8c.js"; // ROM 0x1E8C
import { dispatchMarioMovement } from "./dispatchMarioMovement.js"; // ROM 0x1AC3
import { loc_2c8f } from "./loc_2c8f.js"; // ROM 0x2C8F
import { scheduleBarrelRelease } from "./scheduleBarrelRelease.js"; // ROM 0x2C03
import { loc_30ed } from "./loc_30ed.js"; // ROM 0x30ED
import { update75mActorObjects } from "./update75mActorObjects.js"; // ROM 0x2E04
import { update50mMovingObjects } from "./update50mMovingObjects.js"; // ROM 0x24EA
import { raisePeriodicObjectSpawnRequests } from "./raisePeriodicObjectSpawnRequests.js"; // ROM 0x2DDB
import { driveHammerSprite } from "./driveHammerSprite.js"; // ROM 0x2ED4
import { dispatch50mObjectState } from "./dispatch50mObjectState.js"; // ROM 0x2207
import { collectEdgeRivet } from "./collectEdgeRivet.js"; // ROM 0x1A33
import { loc_2a85 } from "./loc_2a85.js"; // ROM 0x2A85
import { beginMarioFall } from "./beginMarioFall.js"; // ROM 0x1F46
import { loc_26fa } from "./loc_26fa.js"; // ROM 0x26FA
import { update50mConveyorObjects } from "./update50mConveyorObjects.js"; // ROM 0x25F2
import { scanObjectsAtMarioX } from "./scanObjectsAtMarioX.js"; // ROM 0x19DA
import { loc_03fb } from "./loc_03fb.js"; // ROM 0x03FB
import { killMarioOnObjectCollision } from "./killMarioOnObjectCollision.js"; // ROM 0x2808
import { recordHammerHitOnObject } from "./recordHammerHitOnObject.js"; // ROM 0x281D
import { checkBoardWonByType } from "./checkBoardWonByType.js"; // ROM 0x1E57
import { dispatchBonusExpiredStep } from "./dispatchBonusExpiredStep.js"; // ROM 0x1A07
import { tickTimedBoardBonus } from "./tickTimedBoardBonus.js"; // ROM 0x2FCB
import { silenceSound } from "./silenceSound.js"; // ROM 0x011C
import { advanceSubstateAndArmTimer } from "./advanceSubstateAndArmTimer.js"; // ROM 0x19D2

/** The address ROM 0x1F72's frozen oracle returns to — the return bracket its own `ret` pops. */
const RESUME_AFTER_OBJECT_DISPATCH = 0x1986;

/** Sound trigger 2, held asserted for three frames — the count every writer of this array uses. */
const DEATH_SOUND_TRIGGER = SND_TRIGGER + 2;
const TRIGGER_FRAMES = 3;

/**
 * @param {object} m  the machine. No register live-in: both entries reach here from a
 *   sub-state dispatch, and every callee loads its own state.
 * @returns {void}  on every arm — a boolean here would make the translated→idiomatic seam
 *   treat this routine as caller-skip-capable and discard a stack word it does not owe.
 */
export function loc_197a(m) {
  const { mem8 } = m;

  dispatchEffectState(m);

  // An effect is playing: this frame belongs to it and the rest of the update is off.
  if (!loc_1e8c(m)) return;

  dispatchMarioMovement(m);

  // oracle-boundary call: ROM 0x1F72 (the object-slot dispatch and its shared sprite tail) is
  // still frozen, so it is dispatched by address and still needs the return bracket its `ret`
  // pops. Delete both lines for a direct call once 0x1F72 has an idiomatic twin.
  m.push16(RESUME_AFTER_OBJECT_DISPATCH);
  m.call(0x1f72);

  loc_2c8f(m);
  scheduleBarrelRelease(m);
  loc_30ed(m);
  update75mActorObjects(m);
  update50mMovingObjects(m);
  raisePeriodicObjectSpawnRequests(m);
  driveHammerSprite(m);
  dispatch50mObjectState(m);
  collectEdgeRivet(m);
  loc_2a85(m);
  beginMarioFall(m);
  loc_26fa(m);
  update50mConveyorObjects(m);
  scanObjectsAtMarioX(m);
  loc_03fb(m);
  killMarioOnObjectCollision(m);
  recordHammerHitOnObject(m);

  // The board was won: the win path has already stamped it and committed the board advance,
  // so nothing after this point should run for this frame.
  if (!checkBoardWonByType(m)) return;

  // The bonus-expired machine took its death exit (it only can once Mario is grounded), which
  // has already stepped the sub-state.
  if (!dispatchBonusExpiredStep(m)) return;

  tickTimedBoardBonus(m);

  // (ROM 0x19C2-0x19C4 is three 0x00 bytes here. They change no state, so nothing corresponds to
  // them; why they are there is not established.)

  // Still active — the frame is simply over. Mario can have died anywhere above.
  if (mem8[MARIO_ACTIVE] !== 0) return;

  // He did not survive the frame: cut every sound off, fire the death trigger, and step the
  // sub-state on to the death-animation router.
  silenceSound(m);
  mem8[DEATH_SOUND_TRIGGER] = TRIGGER_FRAMES;
  return advanceSubstateAndArmTimer(m);
}
