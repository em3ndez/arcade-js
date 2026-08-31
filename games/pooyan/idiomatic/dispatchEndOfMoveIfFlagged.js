// SPDX-License-Identifier: GPL-3.0-only
import { finishActorOrArmTurnaround } from "./finishActorOrArmTurnaround.js";
/**
 * dispatchEndOfMoveIfFlagged — actor end-of-move guard.
 *
 * WHAT IT IS
 *   ROM 0x361d-0x3624. Grounding: [seen].
 *
 *   Every moving thing on the board — the enemy hunters walking a girder, the objects they carry,
 *   and so on — lives as a fixed-stride ACTOR RECORD in work RAM (base 0x8ae0, stride 0x18). Each
 *   frame the per-actor state dispatcher branches on the actor's phase byte at rec+6; the low-phase
 *   branch (phase < 7) is where a horizontal-move actor is serviced, and it arrives HERE. This
 *   routine is a small gate in front of the end-of-move dispatch: it fires that dispatch only when
 *   the actor has flagged that its move step is complete, and otherwise leaves the record untouched.
 *
 *   The decision hangs on one record field: the animation / end-of-move flag byte at rec+8. Bit 0
 *   of that byte is the "end-of-move pending" flag — the per-actor X advance sets it once a move
 *   step has landed. When the bit is clear the actor is still mid-step and nothing is due, so this
 *   routine returns immediately. When it is set the actor's step has completed and control is handed
 *   to finishActorOrArmTurnaround, the end-of-move dispatch that either retires the actor (board
 *   finish phase) or flips it into a turn-around animation at the end of a pass.
 *
 * ROLE IN THE MACHINE
 *   The low-phase entry of the per-actor state dispatch. It is the single guard that keeps the
 *   end-of-move dispatch from running on an actor that has not yet reached the end of a move step,
 *   forwarding only flagged records into finishActorOrArmTurnaround and passing that dispatch's
 *   result straight back out as its own.
 *
 * LIVE-OUT: none — the caller reloads A and reads no register back. The record pointer (IX) passes
 * straight through unchanged; the only observable effects are those the end-of-move dispatch makes
 * when the flag is set (a blanked sprite band on the finish path, or a cleared latch plus a
 * retargeted turn-around animation), and on the clear path there are none at all.
 */

const REC_FLAG_BYTE = 0x08; // rec+8: the actor's animation / end-of-move flag byte; bit 0 signals a completed move step and gates the end-of-move dispatch
const FLAG_DISPATCH = 0x01; // bit 0 of the flag byte — the "end-of-move pending" flag set by the per-actor X advance

export function dispatchEndOfMoveIfFlagged(m, rec = m.regs.ix) {
  const { mem8 } = m;
  // Test bit 0 of the actor's flag byte at rec+8. Clear means the move step is still in progress —
  // the actor has nothing to close out this frame, so return with the record left exactly as it is.
  if ((mem8[rec + REC_FLAG_BYTE] & FLAG_DISPATCH) === 0) return; // bit 0 clear: no effect
  // Bit 0 set: the actor's move step has landed. Hand the same record to the end-of-move dispatch,
  // which retires the actor in the board's finish phase or arms its turn-around animation otherwise,
  // and let that dispatch's result become this routine's result.
  return finishActorOrArmTurnaround(m, rec); // bit 0 set: hand off to the end-of-move dispatch
}
