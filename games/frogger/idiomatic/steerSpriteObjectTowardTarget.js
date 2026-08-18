// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerSpriteObjectTowardTarget — ROM 0x2bab · grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The motion arm for dispatcher B's sprite object — the single-tile, *rideable* creature that
 *   steers toward a fixed lane target (unlike dispatcher A's free-drifting two-tile creatures, which
 *   just bounce between band edges on their own cycle). Once per move-timer expiry it nudges the
 *   object's position accumulator one step toward the object's lane target; when that accumulator
 *   reaches the target band edge it retires the object — unless the frog is riding it, in which case
 *   the object is kept alive so it does not vanish out from under the frog mid-ride.
 *
 * WHERE IT SITS
 *   Second of dispatcher B's five arms — updateSpriteObject (0x2b83) runs them in fixed order:
 *   spawn → STEER → write-slot-X → hit-test-ahead → write-slot-attr. That dispatcher is itself run
 *   once per frame by the cluster driver driveSpriteObjectCluster (0x2970) on the dispatcher-B record
 *   (0x8480 / 0x8490 by player) with slot SPRITE_OBJECT_SLOT_B (0x8058). Because STEER runs *before*
 *   write-slot-X, the slot X byte it reads (IY+0) is *last* frame's staged on-screen X. The arm is
 *   inert on most frames: it early-returns while the object is idle or its move timer has not expired.
 *
 * THE 16-BYTE RECORD (IX) FIELDS THIS ARM TOUCHES  (see mechanisms.md "The sprite-object engine")
 *   +0     far band-boundary X limit   — the accumulator's goal when facing "up"   (+5 set)
 *   +1     near band-boundary X limit  — the accumulator's goal when facing "down" (+5 clear)
 *   +2     position accumulator — nudged ±1 per step; write-slot-X later stages slot X = target − (+2)
 *   +5     direction / horizontal sprite-flip bit (0x00 or 0x80) — picks the drift sign and goal edge
 *   +6     active/state byte — 0 = idle (every dispatcher-B arm early-returns on it)
 *   +9     move timer (reload 8) — gates one motion step every 8 frames
 *   +0x0b  lane index — low byte into the page-0x80 lane table loc_8000 (0x8000) for this object's target
 *
 * LIVE-OUT
 *   Memory only. It rewrites the +9 move timer, nudges the +2 accumulator, and on arrival either keeps
 *   the record (frog riding) or zeroes the whole 16-byte record plus the 4-byte shared slot block. It
 *   returns nothing and leaves no register the caller reads.
 */
import { loc_8000, HOLD_FLAG, SPRITE_OBJECT_SLOT_B } from "./names.js";

const MOVE_RELOAD = 8;         // (IX+9) reload — one motion step every 8 frames
const STRUCT_BYTES = 16;       // full sprite-object record length, cleared on retire
const SHARED_BLOCK_BYTES = 4;  // dispatcher-B slot block (SPRITE_OBJECT_SLOT_B) length, cleared on retire

export function steerSpriteObjectTowardTarget(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  // ── Idle gate ─────────────────────────────────────────────────────────────────────────
  // (IX+6) is the object's active/state byte: 0 means the slot is empty, so there is nothing to
  // steer. Every dispatcher-B arm early-returns on an idle record; spawnSpriteObject (0x2c13) is what
  // flips it to 1 (armed) when it seeds an object into this record.
  if (mem8[(obj + 0x06)] === 0) return; // inactive

  // ── Move-timer gate: one step every MOVE_RELOAD (8) frames ─────────────────────────────
  // (IX+9) counts down once per frame. The object only takes a motion step when it hits 0, so the
  // creature glides at one accumulator step per 8 frames rather than every frame. On a non-expiry
  // frame we store the decremented timer back and stop; on expiry we reload it and fall through to
  // move. The & 0xff keeps the decrement in the Z80's 8-bit modular space.
  const timer = (mem8[(obj + 0x09)] - 1) & 0xff;
  mem8[(obj + 0x09)] = timer;
  if (timer !== 0) return; // move timer still running
  mem8[(obj + 0x09)] = MOVE_RELOAD;

  // ── Read this object's lane target and its current on-screen X ─────────────────────────
  // target — the object's destination coordinate for its lane, held in the page-0x80 lane table:
  //   cell loc_8000 (0x8000) | (IX+0x0b), where (IX+0x0b) is this object's lane index. This is the
  //   "frog-independent position source" the object homes on (the lane scrolls it around).
  // slotX  — the object's current on-screen X: byte 0 of its hardware slot (IY+0). write-slot-X
  //   (0x2b93) stamped it last frame as target − (IX+2), so reading it here gives the modular
  //   reference the arrival test compares against.
  const target = mem8[loc_8000 | mem8[(obj + 0x0b)]];
  const slotX = mem8[(spr + 0x00)];

  // ── Drift the accumulator toward the target along the facing edge ─────────────────────
  // (IX+5) — the direction / sprite-flip bit — selects both the goal band edge and the nudge sign:
  //
  //   facing set (0x80):   goal is the FAR edge (IX+0); drift the accumulator (IX+2) UP by +1.
  //     Arrival when (target − farEdge) & 0xff >= slotX — the accumulator has grown out to the far
  //     band boundary. On arrival, despawn; otherwise step (IX+2) += 1 and wait for the next tick.
  //
  //   facing clear (0x00): goal is the NEAR edge (IX+1); drift the accumulator (IX+2) DOWN by −1.
  //     Arrival when (target − nearEdge) & 0xff < slotX — the accumulator has shrunk in to the near
  //     band boundary. On arrival, despawn; otherwise step (IX+2) −= 1.
  //
  // Every subtraction is masked to 8 bits to match the ROM's byte-wraparound comparisons.
  if (mem8[(obj + 0x05)] !== 0) {
    if (((target - mem8[(obj + 0x00)]) & 0xff) >= slotX) return despawn();
    mem8[(obj + 0x02)] = mem8[(obj + 0x02)] + 1;
    return;
  }
  if (((target - mem8[(obj + 0x01)]) & 0xff) < slotX) return despawn();
  mem8[(obj + 0x02)] = mem8[(obj + 0x02)] - 1;

  // ── Retire the object on arrival — unless the frog is riding it ───────────────────────
  // Reaching the target normally frees the slot: zero the whole 16-byte record so spawnSpriteObject
  // can recycle it, and zero the 4-byte shared slot block SPRITE_OBJECT_SLOT_B (0x8058) so the object
  // disappears from hardware next frame. But if HOLD_FLAG (0x8004) is set, the frog has mounted this
  // object (flagSpriteObjectFrogHitAhead, 0x2ca8, raises it), so we keep the record intact — otherwise
  // the creature would despawn out from under the frog in the middle of a ride.
  function despawn() {
    if (mem8[HOLD_FLAG] !== 0) return; // held: frog is riding, keep the struct
    for (let i = 0; i < STRUCT_BYTES; i++) mem8[(obj + i)] = 0;
    for (let i = 0; i < SHARED_BLOCK_BYTES; i++) mem8[(SPRITE_OBJECT_SLOT_B + i)] = 0;
  }
}
