// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSpriteObjectCluster  —  ROM 0x2970  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The once-per-frame entry point of Frogger's sprite-object engine. Frogger's moving hazards and
 *   rideable creatures are each a 16-byte record in work RAM that the machine advances one step per
 *   frame and stages into a hardware sprite slot. This routine is the small scheduler that decides HOW
 *   MANY of those objects run this frame and drives each of them through its per-object dispatcher.
 *   It holds no object logic of its own — it only chooses the record/slot pairs and calls the dispatchers.
 *
 * WHERE IT SITS
 *   Called once per frame from the in-play world-step cascade (see mechanisms.md, "In-play cascade"),
 *   after the lanes have scrolled and the frog has been resolved against them. Two dispatchers do the
 *   real work, both lifted and called inline here:
 *     - dispatcher A (dispatchSpriteObjectArmsA, ROM 0x29b9) drives the free-drifting two-tile creatures
 *       that sweep a lane and bounce between band edges;
 *     - dispatcher B (updateSpriteObject, ROM 0x2b83) drives the single-tile object that steers toward a
 *       fixed lane target and can be RIDDEN by the frog.
 *   Each call advances exactly one object (one record/slot pair) by one frame.
 *
 * HOW MANY OBJECTS RUN
 *   The population scales with the life/level count LIVES_COUNT (0x83b7): dispatcher B always runs (one
 *   ever-present object); dispatcher A joins from level 3; a SECOND dispatcher-A object joins from level 6.
 *   So higher levels put more hazards on screen. The active player number ACTIVE_PLAYER (0x83fd) selects
 *   which of the two per-player record banks the objects live in, keeping the two players' objects apart.
 *
 * LIVE-OUT
 *   Memory only — the dispatchers write the object records and the sprite slots, which the sprite-DMA
 *   blit later mirrors to hardware OBJRAM. The value returned here is dispatcher B's return, forwarded
 *   only because the ROM ends by falling through into it (a tail call); no caller reads it.
 */
import { updateSpriteObject } from "./updateSpriteObject.js";
import { dispatchSpriteObjectArmsA } from "./dispatchSpriteObjectArmsA.js";
import {
  LIVES_COUNT, ACTIVE_PLAYER, SPRITE_OBJECT_SLOT_B, SPRITE_OBJECT_SLOT_A,
  SPRITE_OBJECT_RECORD_A_P1, SPRITE_OBJECT_RECORD_A_P2, SPRITE_OBJECT_SLOT_A_SECOND,
  SPRITE_OBJECT_RECORD_B_P1, SPRITE_OBJECT_RECORD_B_P2,
} from "./names.js";

// Level thresholds gating the dispatcher-A workload against the life/level count LIVES_COUNT (0x83b7).
// Below DISPATCH_A_MIN_LEVEL the cluster runs dispatcher B only; from DISPATCH_A_MIN_LEVEL one
// dispatcher-A object runs; from SECOND_OBJECT_MIN_LEVEL a second, distinct dispatcher-A object appears.
const DISPATCH_A_MIN_LEVEL = 3, SECOND_OBJECT_MIN_LEVEL = 6;

// Stride between adjacent sprite-object records: each record is 16 (0x10) bytes, so adding this walks the
// record base from the first dispatcher-A object to the next one (e.g. 0x8440 -> 0x8450).
const RECORD_STRIDE = 0x10;

export function driveSpriteObjectCluster(m) {
  const { mem8 } = m;

  // ── Dispatcher A: the level-gated free-drifting creatures ─────────────────────────────
  // Only run dispatcher A once the life/level count LIVES_COUNT (0x83b7) has reached level 3. Below that
  // the game has no dispatcher-A objects at all and this whole block is skipped, leaving only dispatcher
  // B below.
  if (mem8[LIVES_COUNT] >= DISPATCH_A_MIN_LEVEL) {
    // Pick the first dispatcher-A object's record/slot. The record bank is per-player — player 1 uses
    // SPRITE_OBJECT_RECORD_A_P1 (0x8440), player 2 uses SPRITE_OBJECT_RECORD_A_P2 (0x8460), selected by
    // ACTIVE_PLAYER (0x83fd) — while the hardware sprite slot SPRITE_OBJECT_SLOT_A (0x8048) is shared.
    let recordA = mem8[ACTIVE_PLAYER] === 1 ? SPRITE_OBJECT_RECORD_A_P1 : SPRITE_OBJECT_RECORD_A_P2;
    let slotA = SPRITE_OBJECT_SLOT_A;

    // First dispatcher-A pass: advance that object one frame (spawn / animate / move / stage / hit-test).
    dispatchSpriteObjectArmsA(m, recordA, slotA);

    // From level 6 the cluster runs a SECOND, distinct dispatcher-A object: advance the record base by one
    // 16-byte record (0x8440 -> 0x8450) and switch to the second sprite slot SPRITE_OBJECT_SLOT_A_SECOND
    // (0x8050). Below level 6 recordA/slotA are left unchanged, so the second pass simply re-runs the
    // arms on the SAME object — that is the ROM's behaviour, not a redundant call.
    if (mem8[LIVES_COUNT] >= SECOND_OBJECT_MIN_LEVEL) {
      recordA = recordA + RECORD_STRIDE;
      slotA = SPRITE_OBJECT_SLOT_A_SECOND;
    }

    // Second dispatcher-A pass — on the fresh object at level 6+, or on the first object again below it.
    dispatchSpriteObjectArmsA(m, recordA, slotA);
  }

  // ── Dispatcher B: the always-present rideable object ──────────────────────────────────
  // Dispatcher B runs on EVERY frame regardless of level. Its record is likewise per-player —
  // SPRITE_OBJECT_RECORD_B_P1 (0x8480) for player 1, SPRITE_OBJECT_RECORD_B_P2 (0x8490) for player 2 —
  // and it stages into the shared single-tile slot SPRITE_OBJECT_SLOT_B (0x8058). This is the object the
  // frog can mount and ride. Returned as a tail call (see LIVE-OUT); the value is not used by the caller.
  const recordB = mem8[ACTIVE_PLAYER] === 1 ? SPRITE_OBJECT_RECORD_B_P1 : SPRITE_OBJECT_RECORD_B_P2;
  return updateSpriteObject(m, recordB, SPRITE_OBJECT_SLOT_B);
}
