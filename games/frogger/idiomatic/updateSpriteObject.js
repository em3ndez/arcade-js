// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateSpriteObject  —  ROM 0x2B83  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   "Dispatcher B" of Frogger's sprite-object engine. A sprite object is a 16-byte record in work RAM
 *   (the IX base) that the machine advances one step per frame and stages into a 4-byte hardware sprite
 *   slot (the IY base). This routine advances ONE such object by one frame, by running its five per-object
 *   arms in a fixed order. Dispatcher B drives the single-tile creature that STEERS toward a fixed lane
 *   target and can be RIDDEN by the frog — as opposed to dispatcher A (dispatchSpriteObjectArmsA, 0x29b9),
 *   which drives the free-drifting two-tile creatures that bounce between band edges.
 *
 * WHERE IT SITS
 *   Called once per frame from the cluster driver driveSpriteObjectCluster (0x2970). Dispatcher B is the
 *   one object the cluster ALWAYS runs (dispatcher A only kicks in from level 3, a second copy from
 *   level 6). The driver enters with IX = the dispatcher-B record base for the active player —
 *   SPRITE_OBJECT_RECORD_B_P1 (0x8480) or _P2 (0x8490) — and IY = the shared sprite slot
 *   SPRITE_OBJECT_SLOT_B (0x8058).
 *
 *   In the Z80 the record/slot bases arrive in the IX/IY index registers; the idiomatic rewrite makes
 *   them explicit parameters that DEFAULT to those registers, so a caller that already has the values
 *   passes them (as driveSpriteObjectCluster does) and the equivalence harness can call updateSpriteObject(m)
 *   bare and still pick them up from m.regs.
 *
 *   The five arms are order-dependent, and this is the same order the ROM runs them:
 *     1. spawnSpriteObject                — create/arm the object if the slot is idle and the level allows
 *     2. steerSpriteObjectTowardTarget    — move it one step (and despawn it on arrival)
 *     3. writeSpriteObjectSlotX           — stage this frame's on-screen X/Y from the (just-moved) position
 *     4. flagSpriteObjectFrogHitAhead     — frog proximity test; may bump the object's state byte
 *     5. writeSpriteObjectSlotAttr        — stage the sprite tile/colour from the (just-updated) state
 *   Order matters: arm 3 reads the position arm 2 may have just advanced, and arm 5 reads the state byte
 *   arm 4 may have just advanced — so spawn/move happen before staging, and the hit test happens before
 *   the attribute is committed.
 *
 * LIVE-OUT
 *   Memory only. The arms mutate the 16-byte object record, the 4-byte sprite slot (which the vblank DMA
 *   mirrors into hardware OBJRAM, so writing the slot IS drawing the object next frame), the shared
 *   HOLD_FLAG (0x8004), and the spawn PRNG ring. Nothing meaningful is returned: the `return` on the last
 *   arm is a plain tail-call to keep the machine's control flow identical to the ROM; the cluster driver
 *   does not read a value back.
 */
import { spawnSpriteObject } from "./spawnSpriteObject.js";
import { steerSpriteObjectTowardTarget } from "./steerSpriteObjectTowardTarget.js";
import { writeSpriteObjectSlotX } from "./writeSpriteObjectSlotX.js";
import { flagSpriteObjectFrogHitAhead } from "./flagSpriteObjectFrogHitAhead.js";
import { writeSpriteObjectSlotAttr } from "./writeSpriteObjectSlotAttr.js";

export function updateSpriteObject(m, ix = m.regs.ix, iy = m.regs.iy) {
  // ── Arm 1: spawn ─────────────────────────────────────────────────────────────────────
  // spawnSpriteObject (0x2c13) runs only when the level count LIVES_COUNT (0x83b7) >= 3 AND this record is
  // idle (record+6 == 0). It rolls the spawn PRNG (nextSpawnRandomByte) to density-gate the frame and pick
  // a variant (0..4), then derives the tile/attribute (record+4 = variant*16+48), the lane index
  // (record+0x0b), the band/position bytes (record+0/1/2) and a launch direction from the spawn tables
  // SPAWN_VARIANT_TABLE (0x2ce6) / SPAWN_POINTER_TABLE (0x2cdc) and the lane table loc_8000 (0x8000), and
  // arms the record (record+6 = 1, record+9 = 8). On an already-active or level-gated frame it is inert.
  spawnSpriteObject(m, ix, iy);

  // ── Arm 2: steer / move ──────────────────────────────────────────────────────────────
  // steerSpriteObjectTowardTarget (0x2bab) is dispatcher B's motion arm. It acts only while the object is
  // active (record+6 != 0) and its move timer (record+9, reload 8) expires this frame; on expiry it reads
  // the object's per-object target — the page-0x80 lane cell at loc_8000 (0x8000) | record+0x0b — and drifts
  // the position accumulator (record+2) one step toward it along the band edges (record+0/+1) by facing
  // (record+5). On REACHING the target it despawns the object (zeroing the 16-byte record and the 4-byte
  // slot SPRITE_OBJECT_SLOT_B, 0x8058) UNLESS HOLD_FLAG (0x8004) is set — a frog riding the object holds it
  // alive rather than letting it run to its target and vanish out from under the frog.
  steerSpriteObjectTowardTarget(m, ix, iy);

  // ── Arm 3: stage the slot X/Y ────────────────────────────────────────────────────────
  // writeSpriteObjectSlotX (0x2b93) commits this frame's on-screen position. For an active record
  // (record+6 != 0) it reads the same lane cell (loc_8000 (0x8000) | record+0x0b) and writes the on-screen
  // X = laneByte - record+2 into slot+0, and copies the row byte record+4 into slot+3 (the sprite Y). It
  // runs AFTER the steer arm so it stages the position the frog will actually see this frame.
  writeSpriteObjectSlotX(m, ix, iy);

  // ── Arm 4: frog proximity hit-test ───────────────────────────────────────────────────
  // flagSpriteObjectFrogHitAhead (0x2ca8) fires when the object is active and its row byte record+4 equals
  // the frog row FROG_Y (0x8047) exactly. It projects the staged slot X (slot+0) forward by +20 (direction
  // bit record+5 clear) or -4 (set); if that projected point lands in a 16px window at or ahead of the frog
  // X FROG_X (0x8044) it raises HOLD_FLAG (0x8004) and advances the object to state 2 (record+6 = 2). This
  // is the "frog reached / mounted the object" path: HOLD_FLAG then blocks arm 2's despawn on a later frame,
  // and the new state byte is what arm 5 turns into the mounted look below.
  flagSpriteObjectFrogHitAhead(m, ix, iy);

  // ── Arm 5: stage the slot attribute (tail) ───────────────────────────────────────────
  // writeSpriteObjectSlotAttr (0x2bfb) gives the object its look. For an active record it indexes the
  // object-state attribute table OBJECT_STATE_ATTR_TABLE (0x2cd9) by the state byte record+6 (which arm 4
  // may have just bumped to 2), ORs in the flip bits record+5, writes the result to slot+1 (the sprite tile
  // code), and writes colour 2 to slot+2 — so a dispatcher-B object's appearance is a direct function of
  // its current state, not a cycling animation frame. This is the last arm; the `return` is a bare tail-call
  // preserving the ROM's flow, and its value is not consumed (live-out is memory only).
  return writeSpriteObjectSlotAttr(m, ix, iy);
}
