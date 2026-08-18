// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29f9  —  ROM 0x29f9 (0x29f9–0x2a69)  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The motion arm for one dispatcher-A sprite object — a free-drifting, two-tile river creature carried
 *   on Frogger's sprite-object engine (IX = the object's 16-byte record, IY = its hardware sprite slot).
 *   Once per frame it advances that single object one step: on a low screen row it nudges the object's
 *   vertical byte; higher up it drifts the object sideways across its lane and bounces it off the band
 *   edges, mirroring the sprite to face the new direction at each turn.
 *
 * WHERE IT SITS
 *   The third of five per-object arms run by dispatchSpriteObjectArmsA (0x29b9), in fixed ROM order:
 *   spawn → animate-frame → MOTION (here) → place-slot-and-retire → hit-test. Its drift reference is the
 *   free-running position counter FREE_RUNNING_POS_COUNTER (0x8014) — NOT the frog (grounding overturned
 *   an earlier "frog X" reading) — so each object sweeps its lane on the machine's own clock, wherever the
 *   frog happens to be. It runs only while the object is live and the global sprite-object hit gate
 *   loc_842c (0x842c) is clear, so the frame the frog is caught (which raises that gate) freezes all
 *   dispatcher-A motion.
 *
 * LIVE-OUT
 *   Memory only. It mutates the object record (the move timer, the has-moved flag, and either the vertical
 *   byte or the drift/direction bytes) and, at a turn, three sprite-slot bytes. It returns nothing and
 *   leaves no register the caller reads; IX/IY are preserved.
 */
import { loc_842c, FREE_RUNNING_POS_COUNTER } from "./names.js";

// The move timer (record byte +9) is reloaded to 8 every time it expires: the object takes one motion
// step per 8 frames, throttling the drift to a visible creep rather than a per-frame jump.
const MOVE_RELOAD = 8;

// Sprite on-screen row (slot byte +3, the sprite Y) that splits the two motion modes. At/below this row
// the object is in the lower screen region and takes the simple +/-2 vertical step; above it, it does the
// sideways counter-drift. 96 == 0x60, the ROM's `cp 0x60`.
const ROW_THRESHOLD = 96;

// Shared bit for the two direction/flip fields: record byte +5 (facing/direction) and slot byte +1 (the
// sprite tile-code's horizontal-flip high bit). XOR-toggling 0x80 reverses travel and mirrors the sprite
// together, so a creature that turns around also faces the way it now moves.
const FLIP_BIT = 0x80;

export function loc_29f9(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  // ── Gate 1: is this object slot live? ────────────────────────────────────────────────
  // Record byte +6 is the active flag: spawnSpriteObjectArmA (0x2a6a) sets it to 1 when it places an
  // object, and the retire path clears it. A zeroed record has nothing to move, so bail.
  if (mem8[(obj + 0x06)] === 0) return;

  // ── Gate 2: is dispatcher-A motion frozen? ───────────────────────────────────────────
  // loc_842c (0x842c) is the global sprite-object hit gate. flagSpriteObjectFrogHit (0x2b58) raises it the
  // frame the frog is caught by one of these objects; while it is set EVERY dispatcher-A object holds
  // still, so the caught frog and the creatures freeze together. Non-zero → skip motion this frame.
  if (mem8[loc_842c] !== 0) return;

  // ── Move-timer countdown ─────────────────────────────────────────────────────────────
  // Record byte +9 counts down once per frame; the object only steps on the frame it reaches 0. Wrap the
  // decrement to 8 bits (the ROM's `dec (ix+9)`), store it back, and if it has not hit 0 there is nothing
  // more to do this frame.
  const timer = (mem8[(obj + 0x09)] - 1) & 0xff;
  mem8[(obj + 0x09)] = timer;
  if (timer !== 0) return;

  // Expired: reload the timer for the next 8-frame interval and commit to a motion step this frame.
  mem8[(obj + 0x09)] = MOVE_RELOAD;

  // Record byte +5 is the object's facing (0 one way, 0x80 the other); both modes branch on it, so read it
  // once. Record byte +7 is the "has-moved / eligible-to-retire" flag that the downstream
  // place-slot-and-retire arm (0x2af3) requires before it may recycle the object — this arm raises it on
  // every step it takes. Both ROM paths set it, so it is hoisted here as an unconditional write.
  const facing = mem8[(obj + 0x05)];
  mem8[(obj + 0x07)] = 1;

  // ── Mode A: low sprite row → step the vertical byte ──────────────────────────────────
  // If the object's hardware sprite sits at/below screen row 96 (slot byte +3), it moves by a straight
  // signed step on record byte +3 (its vertical/parked byte): -2 when facing 0, +2 otherwise. The sum
  // wraps to 8 bits on write into mem8 (matching the ROM's `add a,(ix+3)`).
  if (mem8[(spr + 0x03)] >= ROW_THRESHOLD) {
    const step = facing === 0 ? -2 : 2;
    mem8[(obj + 0x03)] = mem8[(obj + 0x03)] + step;
    return;
  }

  // ── Mode B: high sprite row → drift sideways across the lane ──────────────────────────
  // The object's on-screen X is derived downstream as (free-running counter − record byte +2), so nudging
  // +2 slides it horizontally. Progress is measured as how far the free-running counter has advanced past
  // a per-facing band edge (record byte +0 for facing 0, +1 for facing 1); slot byte +0 holds the lane's
  // travel span — how far the object may drift before it must turn.
  const freePos = mem8[FREE_RUNNING_POS_COUNTER];
  if (facing === 0) {
    const anchor = mem8[(obj + 0x00)];
    // Counter has not yet reached this edge (the ROM's `sub (ix+0)` borrows): hold, no step this frame.
    if (freePos < anchor) return;
    // Reached/passed the far edge (distance ≥ travel span): bounce and reverse instead of stepping.
    if (((freePos - anchor) & 0xff) >= mem8[(spr + 0x00)]) return turn();
    // Still inside the span: creep one pixel toward the edge.
    mem8[(obj + 0x02)] = mem8[(obj + 0x02)] + 1;
  } else {
    const anchor = mem8[(obj + 0x01)];
    // Travelling the other way, the span is exhausted when the distance drops BELOW the travel span. The
    // ROM has no borrow guard on this leg — the 8-bit wrap of `counter − edge` is compared directly.
    if (((freePos - anchor) & 0xff) < mem8[(spr + 0x00)]) return turn();
    // Otherwise creep one pixel the opposite way.
    mem8[(obj + 0x02)] = mem8[(obj + 0x02)] - 1;
  }

  // ── The turn: reverse direction and mirror the sprite ────────────────────────────────
  // Reached a band edge. Flip the object's facing (record byte +5) and the sprite tile's horizontal-flip
  // bit (slot byte +1) together via 0x80, so the creature both reverses and faces its new direction, and
  // reload the travel span (slot byte +0) from the stored second-entry X (slot byte +4) so the return leg
  // measures against a fresh span.
  function turn() {
    mem8[(obj + 0x05)] = mem8[(obj + 0x05)] ^ FLIP_BIT; // reverse facing / direction
    mem8[(spr + 0x00)] = mem8[(spr + 0x04)];            // reload the travel span from the second-entry X
    mem8[(spr + 0x01)] = mem8[(spr + 0x01)] ^ FLIP_BIT; // mirror the sprite tile to face the new way
  }
}
