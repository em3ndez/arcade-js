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
import {
  FROG_X, FROG_Y, HOLD_FLAG, LANE_OBJECT_INDEX,
  LIVE_OBJECT_PAGE, SPRITE_BLOCK2_BASE, ANIM_FRAME_BUFFER, LANE_OBJECT_PHASE_TABLE,
} from "./names.js";

// Which mover runs for each of the eleven lane objects, in fixed order. The sixth (index 5) is a
// spacer with no mover — the shortcut that advances the walk without moving anything.
const LANE_MOVERS = [
  moverRight, moverLeft, moverRight, moverRight, moverLeft,
  null,
  moverLeft, moverRight, moverLeft, moverRight, moverLeft,
];

// Each object's control byte, sprite run, and lead sprite cell sit at a fixed stride off its base.
const RUN_STRIDE = 9;
const LEAD_STRIDE = 4;

const OBJECT_COUNT = 0x0b; // eleven objects, then the index wraps

export function moveLaneObjectsAndCarryFrog(m) {
  const { mem8 } = m;
  for (;;) {
    const i = mem8[LANE_OBJECT_INDEX];
    if (i > 10) {
      throw new NotImplemented(
        `moveLaneObjectsAndCarryFrog: lane-object index ${i} is past the eleven-object table`,
      );
    }
    const move = LANE_MOVERS[i];
    if (move) {
      move(
        m,
        ANIM_FRAME_BUFFER + i,
        SPRITE_BLOCK2_BASE + i * RUN_STRIDE,
        LIVE_OBJECT_PAGE + i * LEAD_STRIDE,
        LANE_OBJECT_PHASE_TABLE + i,
      );
    }

    // Advance the walk. The mover never touches the index cell, so it still reads i here.
    const next = (mem8[LANE_OBJECT_INDEX] + 1) & 0xff;
    mem8[LANE_OBJECT_INDEX] = next;
    if (next < OBJECT_COUNT) continue;
    mem8[LANE_OBJECT_INDEX] = 0;
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
  const { mem8 } = m;
  const ph = mem8[phase];
  if (ph !== 0) return rightPhaseTail(m, control, run, lead, phase, ph);
  const b = mem8[control];
  const c = b & 0x0f;
  if (b & 0x10) return rightPhaseTail(m, control, run, lead, phase, c);
  return rightShift(m, control, run, lead, phase, c);
}

// On the final tick force a one-pixel move; otherwise tick the countdown down and hold this frame.
function rightPhaseTail(m, control, run, lead, phase, c) {
  if ((c & 0xff) !== 1) {
    m.mem8[phase] = c - 1;
    return;
  }
  return rightShift(m, control, run, lead, phase, 1);
}

// Shift the object's run and lead sprite right by c, then, when the frog is in this lane's row band,
// carry it along.
function rightShift(m, control, run, lead, phase, c) {
  const { mem8 } = m;
  let de = run;
  let n = mem8[de]; // run length; a zero count means a full 256-byte run
  do {
    de = de + 1;
    mem8[de] = mem8[de] + c;
    n = (n - 1) & 0xff;
  } while (n !== 0);
  const x = (mem8[lead] + c) & 0xff;
  mem8[lead] = x;
  mem8[(lead + 2)] = x;

  const row = mem8[FROG_Y];
  if (row < 0x30 || row >= 0x73) return clearPhase(m, phase);
  const col = row & 0x0f;
  if (col < 0x03) return rightCarryLow(m, phase, c, row);
  if (col >= 0x0c) return rightCarryHigh(m, phase, c, row);
  return clearPhase(m, phase);
}

// Frog near the low edge of a cell: carry it right and lose it if it runs off an edge.
function rightCarryLow(m, phase, c, row) {
  const { mem8 } = m;
  const cellCol = swapNibbles(((row & 0xf0) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  if (mem8[FROG_Y] < 0x30) return clearPhase(m, phase);
  const fx = (mem8[FROG_X] + c) & 0xff;
  mem8[FROG_X] = fx;
  if (fx < 0x08) return loseFrog(m, phase);
  if (fx < 0xe7) return clearPhase(m, phase);
  return loseFrog(m, phase);
}

// Frog near the high edge of a cell: carry it right into the next column with no edge test.
function rightCarryHigh(m, phase, c, row) {
  const { mem8 } = m;
  const cellCol = swapNibbles(((((row & 0xf0) + 0x10) & 0xff) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  mem8[FROG_X] = mem8[FROG_X] + c;
  return clearPhase(m, phase);
}

// Leftward mover — mirror of the rightward one, subtracting c, with a single row-band bound.
function moverLeft(m, control, run, lead, phase) {
  const { mem8 } = m;
  const ph = mem8[phase];
  if (ph !== 0) return leftPhaseTail(m, control, run, lead, phase, ph);
  const b = mem8[control];
  const c = b & 0x0f;
  if (b & 0x10) return leftPhaseTail(m, control, run, lead, phase, c);
  return leftShift(m, control, run, lead, phase, c);
}

function leftPhaseTail(m, control, run, lead, phase, c) {
  if ((c & 0xff) !== 1) {
    m.mem8[phase] = c - 1;
    return;
  }
  return leftShift(m, control, run, lead, phase, 1);
}

function leftShift(m, control, run, lead, phase, c) {
  const { mem8 } = m;
  let de = run;
  let n = mem8[de];
  do {
    de = de + 1;
    mem8[de] = mem8[de] - c;
    n = (n - 1) & 0xff;
  } while (n !== 0);
  const x = (mem8[lead] - c) & 0xff;
  mem8[lead] = x;
  mem8[(lead + 2)] = x;

  const row = mem8[FROG_Y];
  if (row >= 0x73) return clearPhase(m, phase);
  const col = row & 0x0f;
  if (col < 0x03) return leftCarryLow(m, phase, c, row);
  if (col >= 0x0c) return leftCarryHigh(m, phase, c, row);
  return clearPhase(m, phase);
}

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

function leftCarryHigh(m, phase, c, row) {
  const { mem8 } = m;
  const cellCol = swapNibbles(((((row & 0xf0) + 0x10) & 0xff) - 0x30) & 0xff);
  if (mem8[LANE_OBJECT_INDEX] !== cellCol) return clearPhase(m, phase);
  mem8[FROG_X] = mem8[FROG_X] - c;
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
