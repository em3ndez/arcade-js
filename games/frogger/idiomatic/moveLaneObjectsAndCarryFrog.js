// SPDX-License-Identifier: GPL-3.0-only
/**
 * moveLaneObjectsAndCarryFrog — move every lane object one frame and carry a riding frog.
 *
 * Walks the eleven lane objects in fixed order. Each object shifts its sprite run and lead sprite
 * by its lane's speed — rightward or leftward — unless a per-object phase countdown is running, in
 * which case the countdown ticks and the object holds until it drains, giving lanes that step at a
 * sub-frame rate. When the frog sits in a moving object's row and column the shift is applied to the
 * frog too, so it rides along, and the frog is flagged lost if the ride pushes it off either edge.
 * The sixth object is a spacer that only advances the walk. The walk index lives in a work cell and
 * wraps back to zero at the end, so the next frame starts over from the first object.
 * LIVE-OUT: memory-only.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import { FROG_X, FROG_Y, HOLD_FLAG, LANE_OBJECT_INDEX } from "./names.js";

// Per-object parameters: the lane control byte, the sprite run (count byte then sprite Xs), the lead
// sprite cell, the phase-countdown cell, and which mover to run. The sixth object (index 5) has no
// mover — it is the shortcut that advances the walk without moving anything.
const LANE_OBJECTS = [
  { move: moverRight, control: 0x819b, run: 0x8100, lead: 0x800c, phase: 0x81a6 },
  { move: moverLeft, control: 0x819c, run: 0x8109, lead: 0x8010, phase: 0x81a7 },
  { move: moverRight, control: 0x819d, run: 0x8112, lead: 0x8014, phase: 0x81a8 },
  { move: moverRight, control: 0x819e, run: 0x811b, lead: 0x8018, phase: 0x81a9 },
  { move: moverLeft, control: 0x819f, run: 0x8124, lead: 0x801c, phase: 0x81aa },
  { move: null }, // index 5 — spacer, advance only
  { move: moverLeft, control: 0x81a1, run: 0x8136, lead: 0x8024, phase: 0x81ac },
  { move: moverRight, control: 0x81a2, run: 0x813f, lead: 0x8028, phase: 0x81ad },
  { move: moverLeft, control: 0x81a3, run: 0x8148, lead: 0x802c, phase: 0x81ae },
  { move: moverRight, control: 0x81a4, run: 0x8151, lead: 0x8030, phase: 0x81af },
  { move: moverLeft, control: 0x81a5, run: 0x815a, lead: 0x8034, phase: 0x81b0 },
];

const OBJECT_COUNT = 0x0b; // eleven objects, then the index wraps

export function moveLaneObjectsAndCarryFrog(m) {
  const mem = m.mem8;
  for (;;) {
    const i = mem[LANE_OBJECT_INDEX];
    if (i > 10) {
      throw new NotImplemented(
        `moveLaneObjectsAndCarryFrog: lane-object index ${i} is past the eleven-object table`,
      );
    }
    const o = LANE_OBJECTS[i];
    if (o.move) o.move(m, o.control, o.run, o.lead, o.phase);

    // Advance the walk. The mover never touches the index cell, so it still reads i here.
    const next = (mem[LANE_OBJECT_INDEX] + 1) & 0xff;
    mem[LANE_OBJECT_INDEX] = next;
    if (next < OBJECT_COUNT) continue;
    mem[LANE_OBJECT_INDEX] = 0;
    return;
  }
}

// Swap the two nibbles of a byte (a four-place rotate).
function swapNibbles(v) {
  return ((v >> 4) | (v << 4)) & 0xff;
}

// Rightward mover. A running phase countdown, or a freshly-set phase bit in the control byte, hands
// off to the phase tail; otherwise the shift amount is the control byte's low nibble.
function moverRight(m, control, run, lead, phase) {
  const mem = m.mem8;
  const ph = mem[phase];
  if (ph !== 0) return rightPhaseTail(m, control, run, lead, phase, ph);
  const b = mem[control];
  const c = b & 0x0f;
  if (b & 0x10) return rightPhaseTail(m, control, run, lead, phase, c);
  return rightShift(m, control, run, lead, phase, c);
}

// On the final tick force a one-pixel move; otherwise tick the countdown down and hold this frame.
function rightPhaseTail(m, control, run, lead, phase, c) {
  if ((c & 0xff) !== 1) {
    m.mem8[phase] = (c - 1) & 0xff;
    return;
  }
  return rightShift(m, control, run, lead, phase, 1);
}

// Shift the object's run and lead sprite right by c, then, when the frog is in this lane's row band,
// carry it along.
function rightShift(m, control, run, lead, phase, c) {
  const mem = m.mem8;
  let de = run;
  let n = mem[de]; // run length; a zero count means a full 256-byte run
  do {
    de = (de + 1) & 0xffff;
    mem[de] = (mem[de] + c) & 0xff;
    n = (n - 1) & 0xff;
  } while (n !== 0);
  const x = (mem[lead] + c) & 0xff;
  mem[lead] = x;
  mem[(lead + 2)] = x;

  const row = mem[FROG_Y];
  if (row < 0x30 || row >= 0x73) return clearPhase(m, phase);
  const col = row & 0x0f;
  if (col < 0x03) return rightCarryLow(m, phase, c, row);
  if (col >= 0x0c) return rightCarryHigh(m, phase, c, row);
  return clearPhase(m, phase);
}

// Frog near the low edge of a cell: carry it right and lose it if it runs off an edge.
function rightCarryLow(m, phase, c, row) {
  const mem = m.mem8;
  const cellCol = swapNibbles(((row & 0xf0) - 0x30) & 0xff);
  if (mem[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  if (mem[FROG_Y] < 0x30) return clearPhase(m, phase);
  const fx = (mem[FROG_X] + c) & 0xff;
  mem[FROG_X] = fx;
  if (fx < 0x08) return loseFrog(m, phase);
  if (fx < 0xe7) return clearPhase(m, phase);
  return loseFrog(m, phase);
}

// Frog near the high edge of a cell: carry it right into the next column with no edge test.
function rightCarryHigh(m, phase, c, row) {
  const mem = m.mem8;
  const cellCol = swapNibbles(((((row & 0xf0) + 0x10) & 0xff) - 0x30) & 0xff);
  if (mem[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  mem[FROG_X] = (mem[FROG_X] + c) & 0xff;
  return clearPhase(m, phase);
}

// Leftward mover — mirror of the rightward one, subtracting c, with a single row-band bound.
function moverLeft(m, control, run, lead, phase) {
  const mem = m.mem8;
  const ph = mem[phase];
  if (ph !== 0) return leftPhaseTail(m, control, run, lead, phase, ph);
  const b = mem[control];
  const c = b & 0x0f;
  if (b & 0x10) return leftPhaseTail(m, control, run, lead, phase, c);
  return leftShift(m, control, run, lead, phase, c);
}

function leftPhaseTail(m, control, run, lead, phase, c) {
  if ((c & 0xff) !== 1) {
    m.mem8[phase] = (c - 1) & 0xff;
    return;
  }
  return leftShift(m, control, run, lead, phase, 1);
}

function leftShift(m, control, run, lead, phase, c) {
  const mem = m.mem8;
  let de = run;
  let n = mem[de];
  do {
    de = (de + 1) & 0xffff;
    mem[de] = (mem[de] - c) & 0xff;
    n = (n - 1) & 0xff;
  } while (n !== 0);
  const x = (mem[lead] - c) & 0xff;
  mem[lead] = x;
  mem[(lead + 2)] = x;

  const row = mem[FROG_Y];
  if (row >= 0x73) return clearPhase(m, phase);
  const col = row & 0x0f;
  if (col < 0x03) return leftCarryLow(m, phase, c, row);
  if (col >= 0x0c) return leftCarryHigh(m, phase, c, row);
  return clearPhase(m, phase);
}

function leftCarryLow(m, phase, c, row) {
  const mem = m.mem8;
  const cellCol = swapNibbles(((row & 0xf0) - 0x30) & 0xff);
  if (mem[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  const fx = (mem[FROG_X] - c) & 0xff;
  mem[FROG_X] = fx;
  if (fx < 0x08) return loseFrog(m, phase);
  if (fx < 0xe7) return clearPhase(m, phase);
  return loseFrog(m, phase);
}

function leftCarryHigh(m, phase, c, row) {
  const mem = m.mem8;
  const cellCol = swapNibbles(((((row & 0xf0) + 0x10) & 0xff) - 0x30) & 0xff);
  if (mem[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  mem[FROG_X] = (mem[FROG_X] - c) & 0xff;
  return clearPhase(m, phase);
}

// Clear the object's phase so it moves freely again next frame.
function clearPhase(m, phase) {
  m.mem8[phase] = 0;
}

// Flag the frog lost, then clear the phase.
function loseFrog(m, phase) {
  m.mem8[HOLD_FLAG] = 0x01;
  return clearPhase(m, phase);
}
