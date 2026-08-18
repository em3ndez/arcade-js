// SPDX-License-Identifier: GPL-3.0-only
/**
 * moveLaneObjectsAndCarryFrog  —  ROM 0x14b7  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame lane-object mover. This is the routine that slides every moving hazard and
 *   vehicle in Frogger's road and river one step across the screen each frame — the cars, the
 *   logs, the turtles — and, when the frog is standing on one of them, carries the frog along
 *   for the ride. It walks eleven "lane objects" in a fixed order and shifts each one's on-screen
 *   sprite run left or right by its lane's speed.
 *
 * WHERE IT SITS
 *   Run once per in-play frame from the vblank service. Over a single frog's life it fires in two
 *   contexts: during the FROG_TIMER_A hold at the start of a life it is the *only* world step
 *   (this mover plus advanceAnimationFrameBuffer), and once the timer drains it runs again inside
 *   the full in-play cascade alongside the scroll driver and the death-animation driver. It owns
 *   only the sprite geometry of the lanes and the frog's ride; the safe/blocked/drown collision
 *   verdict is a separate routine (dispatchFrogMoveAgainstLanes, ROM 0x11bf) that reads the same
 *   lane data this one lays down.
 *
 * THE ELEVEN LANES
 *   Each lane object i is described by four records at a fixed stride off its own base:
 *     · control byte  — ANIM_FRAME_BUFFER (0x819b) + i  : low nibble = pixel speed, bit4 = sub-rate flag
 *     · sprite run    — SPRITE_BLOCK2_BASE (0x8100) + 9i : [length, x0, x1, …] — the run of sprite Xs to shift
 *     · lead sprite   — LIVE_OBJECT_PAGE  (0x800c) + 4i  : the object's lead X, mirrored at +0 and +2
 *     · phase count   — LANE_OBJECT_PHASE_TABLE (0x81a6) + i : a sub-frame countdown that can hold the lane
 *   Objects 0/2/3/7/9 travel rightward, 1/4/6/8/10 travel leftward, and object 5 is a spacer with no
 *   mover at all (it only advances the walk). The walk index lives in LANE_OBJECT_INDEX (0x80ff).
 *
 * LIVE-OUT
 *   Memory only. It rewrites each shifted sprite run and lead sprite, the walk index, the phase
 *   table, and — on a carry — the frog X (FROG_X 0x8044) and the lost-frog flag (HOLD_FLAG 0x8004).
 *   It returns nothing and leaves no register the caller reads.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import {
  FROG_X, FROG_Y, HOLD_FLAG, LANE_OBJECT_INDEX,
  LIVE_OBJECT_PAGE, SPRITE_BLOCK2_BASE, ANIM_FRAME_BUFFER, LANE_OBJECT_PHASE_TABLE,
} from "./names.js";

// The mover that runs for each of the eleven lane objects, indexed by walk position. Objects
// 0/2/3/7/9 scroll rightward and 1/4/6/8/10 scroll leftward — the fixed direction pattern of
// Frogger's board. Index 5 is `null`: a spacer lane with nothing to move, so its turn in the
// walk just advances the index and draws nothing.
const LANE_MOVERS = [
  moverRight, moverLeft, moverRight, moverRight, moverLeft,
  null,
  moverLeft, moverRight, moverLeft, moverRight, moverLeft,
];

// Per-object record strides. Off each object's base cell, the sprite run sits 9 bytes apart
// (SPRITE_BLOCK2_BASE + 9i) and the lead sprite 4 bytes apart (LIVE_OBJECT_PAGE + 4i). The
// control byte and phase countdown are 1 byte apart, applied inline as `+ i`.
const RUN_STRIDE = 9;
const LEAD_STRIDE = 4;

// Eleven lane objects (indices 0..10); the walk index wraps back to 0 after object 10.
const OBJECT_COUNT = 0x0b;

export function moveLaneObjectsAndCarryFrog(m) {
  const { mem8 } = m;
  for (;;) {
    // ── Read the current walk position ────────────────────────────────────────────────────
    // LANE_OBJECT_INDEX (0x80ff) is the 0..10 walk cursor. It persists in RAM between frames
    // (it also leads the per-player object work page), so a frame always resumes at whatever
    // index the previous frame left — which, after the wrap below, is 0.
    const i = mem8[LANE_OBJECT_INDEX];
    if (i > 10) {
      throw new NotImplemented(
        `moveLaneObjectsAndCarryFrog: lane-object index ${i} is past the eleven-object table`,
      );
    }

    // ── Move this object (unless it is the spacer) ────────────────────────────────────────
    // Pick object i's mover and hand it the four fixed-stride record addresses. Object 5's
    // slot is `null` (the spacer), so it falls straight through to the walk advance without
    // touching any sprite.
    const move = LANE_MOVERS[i];
    if (move) {
      move(
        m,
        ANIM_FRAME_BUFFER + i,            // control byte: speed nibble + sub-rate bit
        SPRITE_BLOCK2_BASE + i * RUN_STRIDE, // sprite run: [length, x0, x1, …]
        LIVE_OBJECT_PAGE + i * LEAD_STRIDE,  // lead sprite: X mirrored at +0 / +2
        LANE_OBJECT_PHASE_TABLE + i,     // per-object sub-frame phase countdown
      );
    }

    // ── Advance the walk, wrapping at the end ─────────────────────────────────────────────
    // The mover never writes the index cell, so re-reading it here still yields i. Bump it by
    // one (byte-wrapped); while the next index is still inside the eleven objects, loop on to
    // it. Once it reaches OBJECT_COUNT the sweep is done: reset the index to 0 so the next
    // frame starts over from object 0, and return.
    const next = (mem8[LANE_OBJECT_INDEX] + 1) & 0xff;
    mem8[LANE_OBJECT_INDEX] = next;
    if (next < OBJECT_COUNT) continue;
    mem8[LANE_OBJECT_INDEX] = 0;
    return;
  }
}

// Swap a byte's two nibbles (a four-place rotate: high<->low). Used to turn a row's high-nibble
// band offset into the low-nibble object-column index that the carry test compares.
function swapNibbles(v) {
  return ((v >> 4) | (v << 4)) & 0xff;
}

// ── Rightward mover ─────────────────────────────────────────────────────────────────────────
// Decide whether this rightward object steps this frame, and by how much. Two things can make it
// hold rather than move at full speed, giving lanes that advance at a sub-frame rate:
//   · a phase countdown already running (phase cell != 0) — hand to the phase tail with that count;
//   · the control byte's bit4 set — the "sub-rate" flag: hand to the phase tail with a fresh count
//     equal to the low-nibble speed, seeding the countdown.
// Otherwise it is a plain full-speed step by the control byte's low nibble.
function moverRight(m, control, run, lead, phase) {
  const { mem8 } = m;
  const ph = mem8[phase];
  if (ph !== 0) return rightPhaseTail(m, control, run, lead, phase, ph);
  const b = mem8[control];
  const c = b & 0x0f; // pixel speed = control byte low nibble
  if (b & 0x10) return rightPhaseTail(m, control, run, lead, phase, c);
  return rightShift(m, control, run, lead, phase, c);
}

// The sub-frame throttle. On every frame but the last of the countdown, just decrement it and
// hold the object still (no shift this frame). On the final tick (count == 1) release: force a
// single one-pixel move so the lane still creeps forward at its slow rate.
function rightPhaseTail(m, control, run, lead, phase, c) {
  if ((c & 0xff) !== 1) {
    m.mem8[phase] = c - 1;
    return;
  }
  return rightShift(m, control, run, lead, phase, 1);
}

// Perform the actual rightward shift of object's on-screen geometry, then try to carry the frog.
function rightShift(m, control, run, lead, phase, c) {
  const { mem8 } = m;

  // Shift the whole sprite run right by c. The run is [length, x0, x1, …] at `run`; a length
  // byte of 0 means a full 256-byte run (the Z80 djnz wrap), which the do/while reproduces by
  // ticking the count with & 0xff. Each following byte is a sprite X, nudged +c.
  let cursor = run;
  let n = mem8[cursor]; // run length; a zero count means a full 256-byte run
  do {
    cursor = cursor + 1;
    mem8[cursor] = mem8[cursor] + c;
    n = (n - 1) & 0xff;
  } while (n !== 0);

  // Shift the lead sprite's X too, in both of its mirror cells (+0 and +2 off `lead`).
  const x = (mem8[lead] + c) & 0xff;
  mem8[lead] = x;
  mem8[lead + 2] = x;

  // Carry the frog only if it is in this mover's lane band. FROG_Y (0x8047) is the frog's row;
  // the rightward mover carries the full lane band [0x30, 0x73). Outside it there is nothing to
  // ride, so clear the phase and stop.
  const row = mem8[FROG_Y];
  if (row < 0x30 || row >= 0x73) return clearPhase(m, phase);

  // Within the band, the row's low nibble locates the frog against the cell edges: below 0x03 is
  // the low-edge carry (with an off-screen edge test), 0x0c or above is the high-edge carry (into
  // the next column), and anything between sits mid-cell with nothing to carry.
  const col = row & 0x0f;
  if (col < 0x03) return rightCarryLow(m, phase, c, row);
  if (col >= 0x0c) return rightCarryHigh(m, phase, c, row);
  return clearPhase(m, phase);
}

// Low-edge rightward carry: the frog rides this object right and is lost if it runs off an edge.
function rightCarryLow(m, phase, c, row) {
  const { mem8 } = m;
  // The frog only rides THIS object if its row maps to this object's column. The band offset
  // (row's high nibble minus 0x30) swap-nibbled becomes the object index to match against the
  // walk index LANE_OBJECT_INDEX (0x80ff, = the object currently being moved).
  const cellCol = swapNibbles(((row & 0xf0) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  // Faithful ROM re-check of the band floor (FROG_Y still < 0x30 → not really on the object).
  // Redundant given rightShift's [0x30,0x73) gate above, but transcribed as the ROM has it.
  if (mem8[FROG_Y] < 0x30) return clearPhase(m, phase);
  // Ride: shift the frog's X by the same c. If the new X runs off the left edge (< 0x08) or the
  // right edge (>= 0xe7) the frog has been carried off-screen and is lost.
  const fx = (mem8[FROG_X] + c) & 0xff;
  mem8[FROG_X] = fx;
  if (fx < 0x08) return loseFrog(m, phase);
  if (fx < 0xe7) return clearPhase(m, phase);
  return loseFrog(m, phase);
}

// High-edge rightward carry: the frog rides into the next column, with no off-screen edge test.
function rightCarryHigh(m, phase, c, row) {
  const { mem8 } = m;
  // High-edge maps to the NEXT column down: add 0x10 to the high nibble before deriving the index.
  const cellCol = swapNibbles(((((row & 0xf0) + 0x10) & 0xff) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  mem8[FROG_X] = mem8[FROG_X] + c;
  return clearPhase(m, phase);
}

// ── Leftward mover ──────────────────────────────────────────────────────────────────────────
// Mirror of moverRight: same hold/sub-rate logic, but the shift subtracts c and the row band has
// only the upper bound (row < 0x73) — the ROM omits the 0x30 floor here, a faithful asymmetry.
function moverLeft(m, control, run, lead, phase) {
  const { mem8 } = m;
  const ph = mem8[phase];
  if (ph !== 0) return leftPhaseTail(m, control, run, lead, phase, ph);
  const b = mem8[control];
  const c = b & 0x0f; // pixel speed = control byte low nibble
  if (b & 0x10) return leftPhaseTail(m, control, run, lead, phase, c);
  return leftShift(m, control, run, lead, phase, c);
}

// Sub-frame throttle for the leftward lanes (see rightPhaseTail): tick down and hold until the
// final tick, then release a single one-pixel step.
function leftPhaseTail(m, control, run, lead, phase, c) {
  if ((c & 0xff) !== 1) {
    m.mem8[phase] = c - 1;
    return;
  }
  return leftShift(m, control, run, lead, phase, 1);
}

// Perform the leftward shift, then try to carry the frog.
function leftShift(m, control, run, lead, phase, c) {
  const { mem8 } = m;

  // Shift the whole sprite run left by c (same run/length/256-wrap shape as rightShift).
  let cursor = run;
  let n = mem8[cursor];
  do {
    cursor = cursor + 1;
    mem8[cursor] = mem8[cursor] - c;
    n = (n - 1) & 0xff;
  } while (n !== 0);

  // Shift the lead sprite's X too, in both mirror cells (+0 and +2).
  const x = (mem8[lead] - c) & 0xff;
  mem8[lead] = x;
  mem8[lead + 2] = x;

  // Carry gate: the leftward mover enforces ONLY the upper bound of the lane band (row < 0x73),
  // omitting the 0x30 floor its rightward twin has. This asymmetry is transcribed from the ROM.
  const row = mem8[FROG_Y];
  if (row >= 0x73) return clearPhase(m, phase);
  const col = row & 0x0f;
  if (col < 0x03) return leftCarryLow(m, phase, c, row);
  if (col >= 0x0c) return leftCarryHigh(m, phase, c, row);
  return clearPhase(m, phase);
}

// Low-edge leftward carry: ride the frog left, lost if it runs off an edge. (Mirror of
// rightCarryLow, but without that routine's extra band-floor re-check.)
function leftCarryLow(m, phase, c, row) {
  const { mem8 } = m;
  const cellCol = swapNibbles(((row & 0xf0) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  const fx = (mem8[FROG_X] - c) & 0xff;
  mem8[FROG_X] = fx;
  if (fx < 0x08) return loseFrog(m, phase);
  if (fx < 0xe7) return clearPhase(m, phase);
  return loseFrog(m, phase);
}

// High-edge leftward carry: ride the frog into the next column, no edge test. (Mirror of
// rightCarryHigh.)
function leftCarryHigh(m, phase, c, row) {
  const { mem8 } = m;
  const cellCol = swapNibbles(((((row & 0xf0) + 0x10) & 0xff) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  mem8[FROG_X] = mem8[FROG_X] - c;
  return clearPhase(m, phase);
}

// Clear this object's phase countdown (LANE_OBJECT_PHASE_TABLE cell) so it is free to move at
// full speed again next frame. Every non-carrying and post-carry path ends here.
function clearPhase(m, phase) {
  m.mem8[phase] = 0;
}

// Flag the frog lost: raise HOLD_FLAG (0x8004) = 1, the shared hold/hit latch the rest of the
// machine reads as "this frog is finished" — then clear the phase like every other exit.
function loseFrog(m, phase) {
  m.mem8[HOLD_FLAG] = 0x01;
  return clearPhase(m, phase);
}
