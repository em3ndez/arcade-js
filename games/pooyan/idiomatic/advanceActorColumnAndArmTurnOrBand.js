// SPDX-License-Identifier: GPL-3.0-only
import { despawnActorAndRenderStageCountdown } from "./despawnActorAndRenderStageCountdown.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import {
  TURN_COLUMN_LIMIT,
  PLAY_STATE_INDEX,
  ANIM_ARMED_LATCH,
  SPAWN_PHASE_SNAPSHOT,
  ANIM_TABLE_3838,
  ANIM_TABLE_3418,
  SPRITE_BAND_86E3,
} from "./names.js";
/**
 * advanceActorColumnAndArmTurnOrBand — horizontal-movement step for one actor-arena record.
 *
 * WHAT IT IS
 *   Every moving thing on the playfield lives as a 0x18-byte record in the actor arena, and the
 *   per-frame state machine hands a record to this handler as its horizontal-movement step. The
 *   record is addressed by `rec` (the actor's base offset in work RAM). The handler slides the
 *   actor one frame's worth along its row, and — when the actor reaches the column where the row
 *   is meant to turn — decides between three outcomes: keep going, spin the actor around, or (once
 *   per pass across the whole subsystem) build the two-by-two interior sprite band and re-seed the
 *   turn column for the next wave.
 *
 * ROLE IN THE MACHINE
 *   This is one of the object horizontal-movement handlers reached from the actor-arena per-record
 *   state dispatch. Its two decisions are shared, machine-wide, through three work-RAM cells:
 *   TURN_COLUMN_LIMIT (the column at which a moving object begins its turn), ANIM_ARMED_LATCH (a
 *   one-shot flag saying the interior band has already been built this pass), and
 *   SPAWN_PHASE_SNAPSHOT (the spawn-phase counter that indexes the next turn-column value). It
 *   tails into two shared routines: setActorAnimation (point a record at an animation sequence and
 *   restart it) for the turn-around, and despawnActorAndRenderStageCountdown (the shared
 *   despawn/movement tail) for the interior-entry and limit-zero paths.
 *
 * ROM 0x343e-0x34af.
 * Grounding: [seen]
 *
 * LIVE-OUT: none — the caller reloads A from memory right after the call and reads no other
 * register back; every effect is in memory (record fields, the limit/latch, the band).
 */
const COLUMN_MASK = 0x1f; //     one tilemap page is 32 columns; the coarse column wraps within it
const PLAY_STATE_ARM = 0x04; //  play sub-state that permits the band arm
const PHASE_TAIL_AT = 0x07; //   phase at/above which the arm short-circuits into the despawn tail
const PHASE_CAP = 0x0a; //       phase inc is guarded below this (phase is always < 7 here)
const BAND_ROW = 0x20; //        one tilemap row between the band's two tile pairs
const BAND_TILES = [0xd8, 0xd9, 0xda, 0xdb]; // the four interior-band tile codes

export function advanceActorColumnAndArmTurnOrBand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 — slide the actor one frame along its row.
  // rec+0x05 is the actor's fractional sub-position (the low byte of its horizontal position);
  // rec+0x09 is this actor's per-frame movement delta (its facing byte, seeded at spawn). Adding
  // them can overflow past 0xff, which is a carry into the coarse tile column at rec+0x06 — one
  // whole column crossed this frame. The low byte of the sum is written back as the new
  // sub-position, and kept in `advanced` for the delta comparison further down.
  const sum = mem8[rec + 0x05] + mem8[rec + 0x09];
  if (sum > 0xff) mem8[rec + 0x06] = mem8[rec + 0x06] + 1; // column carry
  mem8[rec + 0x05] = sum;
  const advanced = sum & 0xff; // the stored sub-position, reused as the delta gate below

  // STEP 2 — has the actor reached the column where the row turns?
  // TURN_COLUMN_LIMIT (0x8d4b) is the tile column at which a moving object begins its turn; every
  // mover on this row shares it. The actor's coarse column at rec+0x06 is masked to the 32-column
  // page before the compare. Below the limit the actor is still travelling — nothing more to do.
  const limit = mem8[TURN_COLUMN_LIMIT];
  const maskedColumn = mem8[rec + 0x06] & COLUMN_MASK;
  if (maskedColumn < limit) return; //                     not yet at the turn column

  // STEP 3 — carried past the turn column: spin the actor around.
  // Overshooting the limit means the actor is now beyond the turn point. rec+0x08 is its
  // turn-around armed flag; setting it and pointing the record at ANIM_TABLE_3838 (0x3838, the
  // turn-around animation) makes the actor reverse and play the turn sequence from its start.
  if (maskedColumn > limit) { //                           past the turn column: arm the turn-around
    mem8[rec + 0x08] = 0x01;
    return setActorAnimation(m, rec, ANIM_TABLE_3838);
  }

  // STEP 4 — landed exactly on the turn column: qualify the interior-band arm.
  // A turn-column limit of 0 has no interior to build, so the actor goes straight to the shared
  // despawn/movement tail. Otherwise the band only arms during play sub-state PLAY_STATE_ARM
  // (0x04) read from PLAY_STATE_INDEX (0x880a); any other sub-state returns. Finally the arm is
  // only taken on the frame the actor's delta (rec+0x09) has caught up to the sub-position it just
  // advanced to — a delta below `advanced` means it is not yet on the exact arm frame.
  // maskedColumn === limit
  if (maskedColumn === 0) return despawnActorAndRenderStageCountdown(m, rec); //      limit 0: straight to the despawn tail
  if (mem8[PLAY_STATE_INDEX] !== PLAY_STATE_ARM) return;
  if (mem8[rec + 0x09] < advanced) return; //              delta below the advanced position

  // STEP 5 — band already built this pass: just mark the record and leave.
  // ANIM_ARMED_LATCH (0x8f63) is the one-shot flag that the interior/rope sprite band has already
  // been built. When it is set, the band and turn column are already in place, so this actor only
  // stamps its presence byte rec+0x01 = 1 (marking the record live) and returns without rebuilding.
  if (mem8[ANIM_ARMED_LATCH] !== 0) { //                   band already built: just latch the record
    mem8[rec + 0x01] = 0x01;
    return;
  }

  // STEP 6 — first arm of the pass: advance the phase, re-seed the turn column, build the band.
  // This actor is the first to reach the turn column with the band un-built, so it does the
  // one-shot work. rec+0x01 is cleared to 0 first. SPAWN_PHASE_SNAPSHOT (0x8d43) is the spawn-phase
  // counter: at or above PHASE_TAIL_AT (0x07) the wave is spent, so the actor drops into the
  // despawn tail instead of building a band; below PHASE_CAP (0x0a) the phase steps up by one (it
  // is always < 7 on this path, so it always steps). The bumped phase is then re-read.
  // First arm: bump the capped phase, look up the new limit, stamp the band, set the latch.
  mem8[rec + 0x01] = 0x00;
  let phase = mem8[SPAWN_PHASE_SNAPSHOT];
  if (phase >= PHASE_TAIL_AT) return despawnActorAndRenderStageCountdown(m, rec);
  if (phase < PHASE_CAP) mem8[SPAWN_PHASE_SNAPSHOT] = phase + 1; // always fires (phase < 7)
  phase = mem8[SPAWN_PHASE_SNAPSHOT];

  // Re-seed the turn column for the next wave: ANIM_TABLE_3418 (0x3418) is a byte table indexed by
  // the bumped spawn-phase, and its entry is the new value written into TURN_COLUMN_LIMIT (0x8d4b).
  const [newLimit] = fetchByteFromTableIndex(m, ANIM_TABLE_3418, phase); // table lookup indexed by phase
  mem8[TURN_COLUMN_LIMIT] = newLimit;

  // Stamp the 2x2 interior sprite band into video RAM at SPRITE_BAND_86E3 (0x86e3): tiles
  // 0xd8/0xd9 side by side at +0/+1, and 0xda/0xdb one tilemap row (BAND_ROW = 0x20) below at
  // +0x20/+0x21 — the four-tile block that fills the row's interior once the wave turns.
  mem8[SPRITE_BAND_86E3 + 0x00] = BAND_TILES[0];
  mem8[SPRITE_BAND_86E3 + 0x01] = BAND_TILES[1];
  mem8[SPRITE_BAND_86E3 + BAND_ROW + 0x00] = BAND_TILES[2];
  mem8[SPRITE_BAND_86E3 + BAND_ROW + 0x01] = BAND_TILES[3];
  // Raise the one-shot latch so later movers this pass take the STEP 5 fast path instead of
  // rebuilding the band.
  mem8[ANIM_ARMED_LATCH] = 0x01;

  // Interior-entry arm done — fall into the shared despawn/movement tail.
  return despawnActorAndRenderStageCountdown(m, rec);
}
