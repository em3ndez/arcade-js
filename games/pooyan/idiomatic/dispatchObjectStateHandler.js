// SPDX-License-Identifier: GPL-3.0-only

// The seventeen state handlers this dispatcher can route to. Each is one state of an object's
// own per-frame state machine; the dispatcher hands a single record to exactly one of them per
// frame. Several table slots share a handler (the no-op stubs cover the currently-unused states),
// so ten distinct handlers cover the seventeen table entries.
import { advanceObjectPhaseThenAuditChecksum } from "./advanceObjectPhaseThenAuditChecksum.js";
import { descendObjectToLanding } from "./descendObjectToLanding.js";
import { advanceObjectDwellThenBlankBand } from "./advanceObjectDwellThenBlankBand.js";
import { noopLowStateHandler } from "./noopLowStateHandler.js";
import { armObjectAnimationAndSeedCountdown } from "./armObjectAnimationAndSeedCountdown.js";
import { advanceObjectCountdownAndEmitDisplayCommand } from "./advanceObjectCountdownAndEmitDisplayCommand.js";
import { moveFormationAndSpawnObject } from "./moveFormationAndSpawnObject.js";
import { countdownThenRearmTurnAnimationByFlag } from "./countdownThenRearmTurnAnimationByFlag.js";
import { advanceObjectFallStepThenBlankBandOnLand } from "./advanceObjectFallStepThenBlankBandOnLand.js";
import { noopHighStateHandler } from "./noopHighStateHandler.js";

/**
 * dispatchObjectStateHandler — per-object state dispatcher for one object record.
 *
 * WHAT IT IS
 *   Every animated "object" on the playfield — the formation objects and the descending /
 *   spawned objects they produce — carries its whole per-frame state inside one fixed-size
 *   0x18-byte record. The record's state byte at offset +2 names which state of that object's
 *   own little state machine it is currently in. This routine takes one record and advances it
 *   by exactly one frame: it validates the record, reads its state, and transfers control to the
 *   one handler that implements that state.
 *
 * ROLE IN THE MACHINE
 *   This is the object/formation counterpart of the enemy-actor per-record dispatcher: same
 *   two-guard shape, but a different jump table and a different family of handlers. Its caller,
 *   dispatchFormationObjectStates (ROM 0x40bd), walks the four formation records at
 *   FORMATION_TABLE with a 0x18 stride and hands each record here in turn, so across one worker
 *   frame every live formation object gets one state step.
 *
 * ROM 0x40d0-0x40e0, with the inline 17-entry jump table it dispatches through sitting directly
 * after it at ROM 0x40e1 (states 0..0x10).
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. The chosen handler mutates the object's record (and whatever display
 * or sound state that state entails) and returns straight to this dispatcher's own caller; no
 * register value is handed back for the caller to read.
 *
 * @param {object} m    machine state (mem8 = the 64K address space as bytes)
 * @param {number} rec  base address of the 0x18-byte object record to step
 */
export function dispatchObjectStateHandler(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Guard 1 — liveness. The two header bytes at record +0 and +1 together encode presence: the
  // record is live only when bit 0 of their OR is set. A record whose combined header has bit 0
  // clear is dormant (empty slot / not yet spawned), so it gets no state step this frame.
  // (ROM: ld a,(ix+0); or (ix+1); rrca; ret nc — rrca drops bit 0 into carry, ret nc leaves when
  // that bit was clear.)
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return; // inactive record

  // Read the state selector. The state byte lives at record +2; masking to the low five bits
  // (0..0x1f) discards the high flag bits packed into the same byte and leaves the actor's
  // position in its own state machine. (ROM 0x40db: ld a,(ix+2); and 0x1f.)
  const state = mem8[rec + 0x02] & 0x1f;

  // Guard 2 — range. The jump table has entries for states 0 through 0x10 only; any masked value
  // of 0x11 or higher is out of range and the record is skipped rather than dispatched to a
  // garbage target. (ROM 0x40dd: cp 0x11; ret nc — carry is set only while state < 0x11, so
  // ret nc leaves for anything >= 0x11.)
  if (state >= 0x11) return; // state index out of range (cp 0x11 -> ret nc)

  // Dispatch. The masked state indexes the inline 17-entry jump table at ROM 0x40e1 and control
  // transfers to the handler for that state; the handler returns directly to this dispatcher's
  // caller, so one record advances by one frame per visit. The switch below mirrors that table
  // slot-for-slot (0x40e1: 4103 4137 416f 4179 4179 4179 4179 4179 417a 418d 4179 4221 4350 4364
  // 4378 4378 4378).
  switch (state) {
    // State 0 (ROM 0x4103) — animate the object, count down its dwell at +0x11, and on expiry
    // bump its phase, clear +0x13, and fold a frame-zero-crossing signature into the tamper check.
    case 0: return advanceObjectPhaseThenAuditChecksum(m, rec);
    // State 1 (ROM 0x4137) — descent step: animate, then advance the position at +3 by the signed
    // step at +0x0a, borrowing from the sub-position at +4 as the object falls toward its landing.
    case 1: return descendObjectToLanding(m, rec);
    // State 2 (ROM 0x416f) — dwell step: animate, count the dwell timer down, and on expiry tail
    // into the next state's band-blank handler.
    case 2: return advanceObjectDwellThenBlankBand(m, rec);
    // States 3-7 (ROM 0x4179) — currently unused states; the table points them at a bare-return
    // stub so a record parked in one of them simply holds with no effect this frame.
    case 3: case 4: case 5: case 6: case 7: return noopLowStateHandler(m);
    // State 8 (ROM 0x417a) — (re)arm the object's animation, then fall through into its countdown.
    case 8: return armObjectAnimationAndSeedCountdown(m, rec);
    // State 9 (ROM 0x418d) — countdown step: on the +0x11 timer expiring, enqueue a display
    // command, reseat +0x11 / +0x13 / +0x02, then tail into the dwell-then-dispatch handler.
    case 9: return advanceObjectCountdownAndEmitDisplayCommand(m, rec);
    // State 10 (ROM 0x4179) — another currently-unused state routed to the same bare-return stub.
    case 10: return noopLowStateHandler(m);
    // State 11 (ROM 0x4221) — the formation driver step: tick the animation, then on +8 bit 0 arm
    // a turn-animation script or drop into the shared move/spawn bookkeeping tail.
    case 11: return moveFormationAndSpawnObject(m, rec);
    // State 12 (ROM 0x4350) — animate, count the +0x11 phase timer down, and on lapse step +0x02
    // and re-arm the turn animation (bit 0 of +0x08 picks which turn-arm variant).
    case 12: return countdownThenRearmTurnAnimationByFlag(m, rec);
    // State 13 (ROM 0x4364) — count the +0x11 phase timer down; once zero, step the animation,
    // advance a fall step, and blank the actor's sprite band on landing.
    case 13: return advanceObjectFallStepThenBlankBandOnLand(m, rec);
    // States 14-16 (ROM 0x4378) — the high unused states, routed to their own bare-return stub.
    case 14: case 15: case 16: return noopHighStateHandler(m);
  }
}
