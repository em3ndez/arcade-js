// SPDX-License-Identifier: GPL-3.0-only
import { seedFourRecordsAndCopyDisplayTiles } from "./seedFourRecordsAndCopyDisplayTiles.js";
import { SCORE_DRIP_ACCUM, PLAY_STATE_INDEX, TAMPER_STRIKES_HUD_GUARD } from "./names.js";

// HOLD_FIELD (0x11) is the frame-delay byte inside a single actor record. Every moving thing on
// screen owns a fixed 0x18-byte record in the actor arena based at 0x8a80, and offset +0x11 is the
// per-record countdown the lead-actor handlers use to pace their transitions. This handler ticks it
// down one per frame and only acts on the frame it reaches zero, so the record lingers in its state
// for a fixed number of frames before the game moves on. In the machine this is the `(ix+0x11)`
// operand of `dec (ix+0x11)` at 0x24fb.
const HOLD_FIELD = 0x11; //  per-record frame-delay countdown

// SHAPE_FLAG (0x07) is the value stamped once the dwell expires. Written into the in-play sub-state
// index PLAY_STATE_INDEX (0x880a) it selects phase 7 of that sub-state machine -- the phase this
// handler advances the game into, and the source of the "phase 7" in its name. In the machine it is
// the immediate of `ld (hl),0x07` at 0x2508.
const SHAPE_FLAG = 0x07; //  value stamped into the selected shape-state cell

/**
 * advancePlayStateToPhase7OnActorDelay — lead-actor state-5 handler.  ROM 0x24fb-0x250e.  Grounding: [seen].
 *
 * WHAT IT IS
 *   One handler in the lead actor's own state machine. The lead-actor record's state index (offset
 *   +0x02) picks which handler runs for it each frame; this is the handler dispatched for state 5.
 *   Its job is to sit on a short per-record countdown and, when that countdown runs out, push a
 *   *separate* state machine -- the global in-play sub-state -- forward to phase 7.
 *
 * ROLE IN THE MACHINE
 *   The in-play sub-state index PLAY_STATE_INDEX (0x880a) steps the round through a fixed set of phase
 *   values (1, 2, 3, 4, 7, 10, ...), each dispatched to its own handler. While the lead-actor record
 *   holds state 5 this handler burns down the record's +0x11 frame delay so the phase change lands a
 *   fixed number of frames later rather than instantly. On the frame the delay hits zero it stamps
 *   0x07 -- phase 7 -- and returns, so on a following frame the sub-state dispatch runs the phase-7
 *   handler instead. A degraded tail (the fall-through below) exists but is entered only when the
 *   anti-tamper guard has already been tripped.
 *
 * LIVE-OUT
 *   On the early paths the only effect is in memory: the record's +0x11 delay is one lower, and (on
 *   expiry) 0x07 has been stamped into PLAY_STATE_INDEX (0x880a) -- or, when the score-drip
 *   accumulator SCORE_DRIP_ACCUM (0x882b) held a non-zero value, into that cell instead. The
 *   fall-through tail leaves memory the same way and then tail-inherits the shape loader's register
 *   live-out (IX/HL/B/A) through the return.
 */
export function advancePlayStateToPhase7OnActorDelay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 -- burn one frame off this record's dwell.  `dec (ix+0x11)` then `ret nz` (0x24fb-0x24fe):
  // decrement the record's frame-delay byte and, while it is still non-zero, do nothing else this
  // frame. The record stays in state 5 and this handler runs again next frame; the delay is simply
  // how many frames the game lingers here before advancing the phase.
  mem8[rec + HOLD_FIELD] = mem8[rec + HOLD_FIELD] - 1;
  if (mem8[rec + HOLD_FIELD] !== 0) return; // dwell not yet expired -- keep holding this frame

  // Step 2 -- choose which cell to advance.  `ld hl,0x882b` / `ld a,(hl)` / `and a` / `jr nz` /
  // `ld l,0x0a` (0x24ff-0x2508): the destination is normally PLAY_STATE_INDEX (0x880a), the in-play
  // sub-state index. But if the score-drip accumulator SCORE_DRIP_ACCUM (0x882b) currently holds a
  // non-zero value, the write is redirected there instead and the sub-state is left untouched.
  const shapePtr = mem8[SCORE_DRIP_ACCUM] !== 0 ? SCORE_DRIP_ACCUM : PLAY_STATE_INDEX;

  // Step 3 -- advance to phase 7.  `ld (hl),0x07` (0x2508): stamp 0x07 into the cell chosen above. On
  // the ordinary path this sets PLAY_STATE_INDEX (0x880a) to phase 7, so on a following frame the
  // in-play sub-state dispatch enters the phase-7 handler.
  mem8[shapePtr] = SHAPE_FLAG;

  // Step 4 -- the anti-tamper gate.  `ld a,(0x8a3c)` / `and a` / `ret z` (0x250a-0x250e): read the
  // tamper-strike guard TAMPER_STRIKES_HUD_GUARD (0x8a3c), a counter that a credit-draw checksum
  // tripwire bumps only when the program image has been altered. On a sound image it is zero, so the
  // handler returns here -- this `ret z` is the normal end of the state-5 handler.
  if (mem8[TAMPER_STRIKES_HUD_GUARD] === 0) return; // guard clear -- ordinary exit after the stamp

  // Step 5 -- the degraded fall-through.  Fall into the shape loader (0x250f) only when the tamper
  // guard is set. The pointer just written (0x882b or 0x880a) is handed in as the shape-table source,
  // so the loader repaints four actor records from bytes read at a work-RAM cell rather than a real
  // ROM shape table -- corrupting the actors' on-screen shapes as part of the tamper-degrade response.
  return seedFourRecordsAndCopyDisplayTiles(m, shapePtr, rec); // reload a shape from the pointer just written
}
