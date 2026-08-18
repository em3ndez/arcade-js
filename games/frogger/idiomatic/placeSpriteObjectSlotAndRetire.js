// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeSpriteObjectSlotAndRetire  —  ROM 0x2af3  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The slot-staging and retirement arm for a dispatcher-A sprite object — one of Frogger's
 *   free-drifting, two-tile river creatures (the logs/turtles-family hazards that another arm has
 *   already spawned and moved this frame). "Staging" means: take the object's abstract record and
 *   write the four hardware-sprite bytes that make it appear on screen. This routine also owns the
 *   object's death: when the object has drifted off the far edge of the lane it wipes the record so a
 *   fresh object can respawn in its place.
 *
 * WHERE IT SITS
 *   The fourth of the five arms dispatchSpriteObjectArmsA (ROM 0x29b9) runs per frame against one
 *   object record (IX) and its paired hardware slot (IY): spawn -> animate-frame -> move -> THIS ->
 *   hit-test. By the time we run, the spawn/move arms have already updated the record's position; our
 *   job is purely to render that position into the slot and to retire the object if it has run its
 *   course. A dispatcher-A record is 16 bytes at e.g. SPRITE_OBJECT_RECORD_A_P1 (0x8440); its slot is
 *   8 bytes at SPRITE_OBJECT_SLOT_A (0x8048), holding TWO stacked 4-byte hardware sprite entries
 *   ([X, tile, color, Y] each) so the creature is drawn 16px wide as a tile pair.
 *
 * LIVE-OUT
 *   Memory only. On an active object it writes the sprite slot; on the fold-wrap-plus-retire path it
 *   additionally zeroes the whole record and slot and reseeds the respawn timer. It returns nothing
 *   and leaves no register the caller reads. Most fields it touches are named inline by their record
 *   offset (see mechanisms.md "Object records and hardware slots").
 */
import { FREE_RUNNING_POS_COUNTER } from "./names.js";
import { raiseSpriteArmOneShotAndQueueSound } from "./raiseSpriteArmOneShotAndQueueSound.js";

export function placeSpriteObjectSlotAndRetire(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  // ── Gate: skip an idle object ────────────────────────────────────────────────────────
  // Record byte +6 is the active/state byte: 0 = idle. Every arm early-returns on an idle record, so a
  // record with no live object costs nothing. Only when +6 is non-zero (armed, or mid-animation) is
  // there anything to stage.
  if (mem8[ix + 6] === 0) return; // inactive object

  // ── Shared per-turn spawn-sound one-shot ─────────────────────────────────────────────
  // Fire the arm's shared tail (ROM 0x2ae6). It latches PER_TURN_SCRATCH (0x8371) once per turn and, on
  // that first latch, queues spawn sound command 0x90; on every later call in the same turn it returns
  // untouched. It writes only memory, so it belongs to our live-out (the equivalence oracle runs it too).
  raiseSpriteArmOneShotAndQueueSound(m);

  // `record` is the object's 16-byte state (IX base); `slot` is the 8-byte hardware sprite pair (IY base).
  const record = ix;
  const slot = iy;

  // ── Derive the object's on-screen X ──────────────────────────────────────────────────
  // Record byte +4 is the row/category attribute. It doubles as the object's on-screen row (Y), and its
  // magnitude selects the kind: >= 0x60 means "parked / fixed", below means "moving".
  //   • Parked/fixed object: its X is simply its own stored byte +3 (the vertical/parked byte, reused
  //     here as a fixed X for this family).
  //   • Moving object: its X drifts against FREE_RUNNING_POS_COUNTER (0x8014) — a counter that rises
  //     +1/frame independent of the frog — minus the object's own position accumulator +2. (This is the
  //     free-running counter, NOT the frog X; an earlier reading mistook it for the frog and grounding
  //     overturned that.) The & 0xff keeps it an 8-bit screen coordinate.
  const attr = mem8[record + 4];
  let onScreenX;
  if (attr >= 0x60) {
    onScreenX = mem8[record + 3];
  } else {
    onScreenX = (mem8[FREE_RUNNING_POS_COUNTER] - mem8[record + 2]) & 0xff; // drift toward the free-running counter
  }

  // ── Stage the first hardware sprite entry ────────────────────────────────────────────
  // Slot is laid out as [X, tile, color, Y] per entry. Write the computed X to slot+0, and copy the
  // attribute byte as the Y of BOTH stacked entries (slot+3 and slot+7) so the two-tile creature sits on
  // one row. (The tile/color bytes were staged by the animate-frame arm; we only own X and Y here.)
  mem8[slot] = onScreenX;
  mem8[slot + 3] = attr;
  mem8[slot + 7] = attr;

  // ── Stage the second entry's X and detect the fold-wrap ──────────────────────────────
  // The second sprite entry sits 15px from the first; whether it leads or trails depends on the object's
  // facing, held in record byte +5 (the direction / horizontal-flip bit, 0x00 or 0x80). The offset also
  // sets which screen edge is this object's "fold" — the point at which it has fully traversed the lane
  // and may be retired:
  //   • Facing bit set  (+5 != 0): second entry trails 15px LEFT (onScreenX - 15, i.e. + 0xf1 mod 256).
  //     The object has folded when its on-screen X has walked all the way down to the left edge, 0.
  //   • Facing bit clear (+5 == 0): second entry leads 15px RIGHT (onScreenX + 15). The object has
  //     folded when that biased X wraps past the right edge (0xff -> 0x00), i.e. biased + 1 == 0.
  let reachedFold;
  if (mem8[record + 5] !== 0) {
    mem8[slot + 4] = 0xf1 + onScreenX; // -15; Uint8Array store truncates to 8 bits
    reachedFold = onScreenX === 0;
  } else {
    const biased = (0x0f + onScreenX) & 0xff; // +15
    mem8[slot + 4] = biased;
    reachedFold = ((biased + 1) & 0xff) === 0;
  }

  // Still mid-lane: nothing more to do this frame (the object stays live and drawn).
  if (!reachedFold) return;

  // ── Retire the object ────────────────────────────────────────────────────────────────
  // Reaching the fold only recycles an object that is actually eligible. Record byte +7 is the
  // "has-moved / eligible-to-retire" flag, set by the motion arm once the object has actually travelled;
  // a folded-but-never-moved record is left alone.
  if (mem8[record + 7] === 0) return;

  // Wipe the whole 16-byte record and the whole 8-byte slot so the object vanishes and its record reads
  // idle (+6 == 0) for every arm next frame...
  for (let i = 0; i < 16; i++) mem8[record + i] = 0;
  for (let i = 0; i < 8; i++) mem8[slot + i] = 0;
  // ...then reseed the respawn timer (record +0x0a, the dispatcher-A spawn/respawn countdown) to 0x20, so
  // a fresh object reappears in this slot after roughly 0x20 frames.
  mem8[record + 10] = 0x20;
}
