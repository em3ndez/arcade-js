// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { u8 } from "../../../core/int.js";
import {
  SPAWN_LATCH,
  FRAME_COUNTER,
  FORMATION_TABLE,
  SPAWN_FIELD_TABLE,
  TURN_COLUMN_LIMIT,
  ANIM_SCRIPT_4203,
  ROUND_COUNTER,
  SPAWN_SPEED_INDEX,
  SPAWN_SPEED_TABLE,
  SPAWN_SPEED_VALUE,
} from "./names.js";
/**
 * initFormationRecordAndDeriveSpawnSpeed — WHAT IT IS
 * ===================================================
 * The one-shot birth of the formation object: the routine that brings the first record of the
 * FORMATION_TABLE actor array to life and hands the game the speed at which it should move.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * A "formation" is a scripted group of moving objects the game marches across the playfield. Each
 * member is tracked by an ACTOR RECORD — a fixed-layout block of bytes in work RAM whose fields say
 * whether the record is live, what state/phase it is in, which way and how fast it moves, and what
 * animation it is drawing. The formation objects live in a four-slot, 0x18-stride array based at
 * FORMATION_TABLE (0x8c30); this routine seeds slot 0, the lead record.
 *
 * Because the whole formation should be born exactly once per opportunity, the routine is triple-
 * gated: the caller must present a non-zero descriptor index, the one-shot SPAWN_LATCH must still be
 * clear (so a formation already alive is not reborn), and the free-running FRAME_COUNTER must be at
 * its zero crossing (so the birth is pinned to one specific frame in the animation clock). Only when
 * all three hold does it commit — it raises the latch, fills the record's opening fields, arms its
 * turn animation, and then derives the movement speed for this round.
 *
 * ROM ADDRESS: 0x53b0.  GROUNDING: [seen].
 *
 * LIVE-OUT: none in registers — every value this routine leaves for the outside world it writes to
 * memory. It seeds the formation lead record (FORMATION_TABLE fields +0x00..+0x0e), raises the
 * SPAWN_LATCH, sets the TURN_COLUMN_LIMIT threshold, and publishes the derived SPAWN_SPEED_INDEX /
 * SPAWN_SPEED_VALUE pair. The caller reloads its own accumulator on return.
 */

const SPEED_INDEX_CLAMP = 0x06; // the derived speed index saturates here
const SPEED_INDEX_CAP = 0x07; //  values at or past this clamp down

export function initFormationRecordAndDeriveSpawnSpeed(m, spawnIndex = m.regs.a) {
  const { mem8 } = m;

  // GATE 1 — a descriptor must be present. The caller passes the formation's descriptor index in
  // the accumulator; a zero index means "nothing to spawn", so bail before touching any state.
  if (spawnIndex === 0) return; //          no descriptor
  // GATE 2 — the one-shot latch. SPAWN_LATCH (0x8d59) is raised the first time a formation is born
  // and gates every re-entry until the formation is torn down; a non-zero latch means one is already
  // alive, so do nothing.
  if (mem8[SPAWN_LATCH] !== 0) return; //   already spawned
  // GATE 3 — the frame-clock zero crossing. FRAME_COUNTER (0x8a5f) free-runs down every vblank; its
  // low bits phase animation and its zero-crossings gate periodic events. Pinning the birth to the
  // frame the counter reads zero keeps the whole formation in lockstep with that clock.
  if (mem8[FRAME_COUNTER] !== 0) return; // only on the frame-counter zero crossing

  // COMMIT — raise the one-shot latch so no second formation can be born until this one is retired,
  // then take the base of the lead formation record we are about to fill.
  mem8[SPAWN_LATCH] = 1;
  const rec = FORMATION_TABLE;

  // MOTION FIELDS — pull the record's facing/velocity byte from SPAWN_FIELD_TABLE (0x5902), reading
  // entry [1]. That byte goes into the record's +0x09 field, and its two's-complement negation into
  // +0x0a, so the record carries the value and its mirror image (the paired +/- form the engine's
  // movement steps read for the two travel directions).
  const [field] = fetchByteFromTableIndex(m, SPAWN_FIELD_TABLE, 1);
  mem8[rec + 0x09] = field;
  mem8[rec + 0x0a] = u8(-field); // its two's-complement negation
  // OPENING STATE — stamp the record's fixed initial state/phase/velocity bytes. +0x00 = 0x01 marks
  // the record live (state 1); +0x02 = 0x0b seats its opening phase; +0x03/+0x05/+0x06 clear to
  // zero; +0x04 = 0x04 seats a fixed sub-field. +0x06, cleared here, is the tile-column tracker the
  // turn logic later compares against TURN_COLUMN_LIMIT.
  mem8[rec + 0x00] = 0x01;
  mem8[rec + 0x02] = 0x0b;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x04] = 0x04;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x06] = 0x00;
  // TURN THRESHOLD — set TURN_COLUMN_LIMIT (0x8d4b) to 0xff, the complement of zero. This is the
  // tile-column threshold at which a moving object begins its turn animation; 0xff arms the record
  // so the turn logic does not fire yet.
  mem8[TURN_COLUMN_LIMIT] = 0xff; // complement of zero
  // ANIMATION — point the lead record at the turn-animation script ANIM_SCRIPT_4203 (0x4203) and
  // restart it at frame 0, so the newborn formation object begins drawing its opening sequence.
  setActorAnimation(m, rec, ANIM_SCRIPT_4203);

  // SPEED DERIVATION — the formation's movement speed scales with progress. Halve ROUND_COUNTER
  // (0x8907) and add one to form a speed index: later rounds yield larger indices, hence faster
  // motion.
  let index = (mem8[ROUND_COUNTER] >> 1) + 1;
  // CLAMP — the speed table has a finite length; any index that reaches the cap (0x07) is pinned to
  // the top valid entry (0x06) so the lookup can never run off the end of the table.
  if (index >= SPEED_INDEX_CAP) index = SPEED_INDEX_CLAMP;
  mem8[SPAWN_SPEED_INDEX] = index;
  // LOOKUP + PUBLISH — read the movement speed for this round from SPAWN_SPEED_TABLE (0x5407) at the
  // clamped index and store it at SPAWN_SPEED_VALUE (0x8d5d), where the per-frame formation mover
  // reads it back.
  const [speed] = fetchByteFromTableIndex(m, SPAWN_SPEED_TABLE, index);
  mem8[SPAWN_SPEED_VALUE] = speed;
}
