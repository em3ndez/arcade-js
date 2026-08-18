// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFlyPatrol  —  ROM 0x272f  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame mover for the bonus FLY — the little insect that paces back and forth across a
 *   river lane during play and can be eaten by the frog for bonus points. Each frame it does three
 *   jobs for the fly: it runs the fly's tongue/attack dwell timer, chooses the fly's sprite image
 *   (and which way it faces), and walks the fly's screen-X along a fixed ROM path table so it
 *   patrols left and right.
 *
 * WHERE IT SITS
 *   Driven each vblank by animateFlyEatCollision (ROM 0x26a6) while the fly's tongue is out
 *   (COLLISION_LATCH 0x8135 set). That routine arms the fly and box-tests it against the frog; it
 *   leans on this one to actually move the fly and flip its sprite. The two together are the whole
 *   fly behaviour. The fly only exists for part of a level, so this runs in bursts, not every frame.
 *
 * THE PATH TABLE
 *   FLY_PATH_OFFSET_TABLE (ROM 0x279f) is a list of one-byte X offsets that trace the fly's route.
 *   FLY_TRAVEL_DIR_STEP (0x833d) is the walker over that list: its low 7 bits are the current index
 *   into the table, and bit 7 is the travel direction — which is ALSO the sprite's horizontal-flip
 *   bit, so the fly always faces the way it is moving. A table entry carries three meanings:
 *       0  →  end of the route: reverse direction, restart the timer, show the turning sprite
 *       1  →  pause here: just restart the timer, don't move
 *      ≥2  →  an X offset: the fly's screen X for this waypoint (added to the drifting lane base)
 *
 * LIVE-OUT
 *   Memory only. It writes the fly's timer, sprite code and X cell (and steps the path index); it
 *   returns nothing and leaves no register the caller reads.
 */
import { FLY_TRAVEL_DIR_STEP, FLY_ATTACK_TIMER, FLY_SPRITE_X, FLY_SPRITE_CODE, FLY_DRIFT_COUNTER, FLY_PATH_OFFSET_TABLE } from "./names.js";

// The dwell/attack timer FLY_ATTACK_TIMER (0x833e) is reloaded to 60 frames — about one second at
// 60 Hz — each time the fly reaches a waypoint or is told to hold.
const TIMER_RELOAD = 60;

// Halfway through that dwell the fly's sprite image is (re)set. Doing the flip at the midpoint, rather
// than at the moment of the step, is what gives the fly a steady in-flight look between turns.
const MID_TIME = TIMER_RELOAD / 2; // = 30

// Sprite tile codes written into FLY_SPRITE_CODE (0x8041): 33 is the flying pose (steady patrol), 30
// is the turning pose shown for one leg when the fly reverses at a route endpoint.
const TURN_SPRITE = 30;
const FLY_SPRITE = 33;

// Bit 7 is the hardware's horizontal-flip bit in a sprite code, AND the travel-direction bit in
// FLY_TRAVEL_DIR_STEP (0x833d) — the same bit position in both. So OR-ing the direction into the
// sprite code makes the fly face its heading, and XOR-ing it into the step reverses both at once.
const FLIP = 0x80;

// The low 7 bits of FLY_TRAVEL_DIR_STEP are the path-table index; mask off bit 7 (the direction/flip
// bit) to read it.
const STEP_MASK = 0x7f;

export function driveFlyPatrol(m) {
  const { mem8 } = m;

  // ── Dwell expired? Advance to the next waypoint ──────────────────────────────────────
  // When FLY_ATTACK_TIMER (0x833e) reaches 0 the fly has finished its stay at the current waypoint, so
  // hand off to advance() to step the path index and pick the next one. (advance() always reloads the
  // timer, so it is non-zero again on the following frame.)
  const timer = mem8[FLY_ATTACK_TIMER];
  if (timer === 0) return advance(m);

  // ── Otherwise: count the dwell down by one frame ─────────────────────────────────────
  // The store into FLY_ATTACK_TIMER truncates to 8 bits (mem8[] write), matching the Z80's 8-bit DEC.
  const nextTimer = (timer - 1) & 0xff;
  mem8[FLY_ATTACK_TIMER] = nextTimer;

  // ── At the midpoint: set the fly's sprite image ──────────────────────────────────────
  // Exactly halfway through the dwell, stamp the flying pose (33) into FLY_SPRITE_CODE (0x8041), OR-ing
  // in the current direction bit so the sprite faces the way it travels (33 forward, 0xA1 flipped).
  if (nextTimer === MID_TIME) {
    mem8[FLY_SPRITE_CODE] = FLY_SPRITE | (mem8[FLY_TRAVEL_DIR_STEP] & FLIP);
    return;
  }

  // ── Every other countdown frame: re-render the fly's X ───────────────────────────────
  // Read the X offset one slot past the current step index (low 7 bits of FLY_TRAVEL_DIR_STEP, + 1) in
  // the path table FLY_PATH_OFFSET_TABLE (0x279f), and push it through writeX — which adds the drifting
  // lane base so the whole patrol slides along with FLY_DRIFT_COUNTER (0x811c).
  const index = (mem8[FLY_TRAVEL_DIR_STEP] & STEP_MASK) + 1;
  writeX(m, mem8[FLY_PATH_OFFSET_TABLE + index]);
}

// Reached when the dwell timer runs out: commit one step along the path and act on the entry there.
function advance(m) {
  const { mem8 } = m;

  // ── Step the path index by ±1 ────────────────────────────────────────────────────────
  // The ROM expresses "index += direction" as a conditional double-decrement followed by an
  // unconditional increment. Travelling FORWARD (bit7 clear) the two decrements are skipped and the
  // lone +1 steps forward; travelling BACKWARD (bit7 set) both decrements run and the +1 nets −1.
  // That is why the two −1s sit apart from the shared +1 — it mirrors the original's DEC/DEC/INC.
  if (mem8[FLY_TRAVEL_DIR_STEP] & FLIP) { // bit7 set → travelling backward
    mem8[FLY_TRAVEL_DIR_STEP] -= 1;
    mem8[FLY_TRAVEL_DIR_STEP] -= 1;
  }
  mem8[FLY_TRAVEL_DIR_STEP] += 1;

  // ── Read the path entry at the new step and act on it ────────────────────────────────
  // Look up FLY_PATH_OFFSET_TABLE (0x279f) at the new low-7-bit index.
  const entry = mem8[FLY_PATH_OFFSET_TABLE + (mem8[FLY_TRAVEL_DIR_STEP] & STEP_MASK)];

  // Entry 0 → end of the route. XOR-ing FLIP into FLY_TRAVEL_DIR_STEP reverses the travel direction and
  // the sprite flip in one write; then reload the dwell timer and show the turning sprite (30).
  if (entry === 0) {
    mem8[FLY_TRAVEL_DIR_STEP] ^= FLIP;
    mem8[FLY_ATTACK_TIMER] = TIMER_RELOAD;
    mem8[FLY_SPRITE_CODE] = TURN_SPRITE;
    return;
  }

  // Entry 1 → hold at this waypoint: reload the dwell timer and leave X where it is.
  if (entry === 1) {
    mem8[FLY_ATTACK_TIMER] = TIMER_RELOAD;
    return;
  }

  // Entry ≥2 → an ordinary waypoint: render the fly's X from this offset.
  writeX(m, entry);
}

// Convert a path-table X offset into the fly's on-screen X and store it.
function writeX(m, offset) {
  const { mem8 } = m;
  // Screen X = path offset + FLY_DRIFT_COUNTER (0x811c), the slowly-drifting base the fly shares with
  // its own spawn logic. Adding it here means the whole back-and-forth patrol rides that drift, so the
  // fly's lane creeps across the screen over its lifetime instead of pacing a fixed span. The store
  // into FLY_SPRITE_X (0x8040) truncates to 8 bits (mem8[] write), matching the Z80's 8-bit ADD.
  mem8[FLY_SPRITE_X] = offset + mem8[FLY_DRIFT_COUNTER];
}
