// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { RECORD_ANIM_SEQ_2CA7, HUNTER_MOVE_SCRIPT } from "./names.js";

// ---------------------------------------------------------------------------
// Actor-record field offsets.
//
// Every hunter (and enemy actor) on screen is tracked by an ACTOR RECORD: a
// fixed-layout block of bytes in work RAM, addressed from its base. The record
// carries the actor's state, its animation, and — for hunters — a MOVEMENT
// SCRIPT cursor. The constants below name the fields this helper touches, as
// signed byte offsets from the record base.
// ---------------------------------------------------------------------------
const STATE_FIELD = 0x02; // +0x02: the record's state byte, walked each frame by the per-record state dispatcher
const STATE_TRIGGER = 0x11; // the one state in which this helper fires — the record's "arm me" state
const STATE_NEXT = 0x12; // the state written on the transition — the record's "walking my move script" state
const SCRIPT_LO = 0x16; // +0x16: low byte of the record's 16-bit movement-script cursor
const SCRIPT_HI = 0x17; // +0x17: high byte of that cursor (SCRIPT_LO/SCRIPT_HI are little-endian)
const SCRIPT_STEP = 0x15; // +0x15: the script's step index / latched-repeat cell, walked alongside the cursor

/**
 * advanceRecordStateAndSeedMoveScript — arm a hunter record to start walking its movement script.
 * [seen]  ROM 0x2c85-0x2ca2
 *
 * WHAT IT IS
 * A per-record transition helper, applied to one actor record at a time during
 * a sweep over the hunter records. It is a conditional promotion: only a record
 * that is currently sitting in the trigger state (STATE_FIELD == STATE_TRIGGER,
 * 0x11) is acted on. Records in any other state are left completely untouched,
 * so the same sweep can be run over every record and only the ones waiting to
 * be armed will move.
 *
 * ROLE IN THE MACHINE
 * A hunter that has just been placed does nothing on its own — it needs both a
 * look and a path. This routine hands it both in one step: it advances the
 * record's state to STATE_NEXT (0x12), points the record at an animation
 * sequence (RECORD_ANIM_SEQ_2CA7, ROM 0x2ca7) so it starts drawing the right
 * frames, and seeds the record's movement-script cursor at the head of
 * HUNTER_MOVE_SCRIPT (ROM 0x2d00) with its step index cleared.
 *
 * HUNTER_MOVE_SCRIPT (ROM 0x2d00) is the byte stream the record's cursor
 * (SCRIPT_LO/SCRIPT_HI) then walks, one opcode at a time: a 0xff byte latches
 * the step cell at SCRIPT_STEP, an 0x88 byte advances the record's state, and
 * any other byte is a signed X-delta that nudges the hunter horizontally. This
 * routine only installs the head of that script and resets the step counter;
 * the walking happens later, frame by frame, driven off the cursor it seeds here.
 *
 * LIVE-OUT: memory only — the record's state byte (STATE_FIELD), its animation
 * fields (written through setActorAnimation), and its movement-script cursor and
 * step index (SCRIPT_LO/SCRIPT_HI/SCRIPT_STEP).
 */
export function advanceRecordStateAndSeedMoveScript(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // GUARD — fire only on a record waiting to be armed. Read the record's state
  // byte (+0x02) and bail out unless it is exactly the trigger state 0x11. This
  // is what makes the helper safe to apply blindly across every hunter record:
  // anything not sitting in state 0x11 is passed over without a single write.
  if (mem8[rec + STATE_FIELD] !== STATE_TRIGGER) return;

  // ADVANCE THE STATE — promote the record from the trigger state 0x11 to
  // STATE_NEXT (0x12). From the next frame the per-record dispatcher will route
  // this record through its 0x12 handler, i.e. the one that walks the movement
  // script seeded below.
  mem8[rec + STATE_FIELD] = STATE_NEXT;

  // ARM THE ANIMATION — point the record at RECORD_ANIM_SEQ_2CA7 (ROM 0x2ca7)
  // and restart it, so the hunter begins drawing that sequence from its first
  // frame. This sets the WHAT the actor looks like; the script seeded next sets
  // WHERE it moves.
  setActorAnimation(m, rec, RECORD_ANIM_SEQ_2CA7);

  // SEED THE SCRIPT CURSOR — install the address of HUNTER_MOVE_SCRIPT
  // (ROM 0x2d00) into the record's 16-bit movement-script cursor at +0x16/+0x17,
  // little-endian: the low byte first (the store keeps only the low 8 bits), the
  // high byte second. The cursor then points at the head of the move-script the
  // record will walk each frame.
  mem8[rec + SCRIPT_LO] = HUNTER_MOVE_SCRIPT; // low byte (store truncates)
  mem8[rec + SCRIPT_HI] = HUNTER_MOVE_SCRIPT >> 8;

  // CLEAR THE STEP INDEX — zero the step cell at +0x15 so the record starts the
  // script from the top with no latched repeat carried over from a prior life.
  mem8[rec + SCRIPT_STEP] = 0x00;
}
