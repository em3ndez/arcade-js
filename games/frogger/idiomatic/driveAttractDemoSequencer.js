// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";
/**
 * driveAttractDemoSequencer — the attract-demo sequencer, run each vblank while the credit count is
 * zero. Credits present tails to the attract-idle setter; otherwise a state machine on the phase byte:
 * 0 seeds the demo and arms the animator, 1 runs the scroll animator (a computed jump picks the cell
 * and its scroll floor, then the shared tail scrolls it left four pixels through the frame clock), 2
 * rewinds the seven cells, higher tails to the per-cell demo stamp. The frame clock returns false on
 * its not-elapsed branch, so we just return. LIVE-OUT: memory-only.
 */
import { CREDIT_BCD, ATTRACT_SEQUENCER_PHASE, ATTRACT_DEMO_PHASE_COUNTER, ATTRACT_DEMO_DWELL, FLY_SPRITE_X, ATTRACT_FRAME_TIMER } from "./names.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { setAttractIdleMode } from "./setAttractIdleMode.js";
import { stampAttractDemoCell } from "./stampAttractDemoCell.js";
import { tickAttractCellFrameClock, attractCellFrameTile } from "./tickAttractCellFrameClock.js";

const CELL_BASE = FLY_SPRITE_X;     // the seven four-byte attract cells

// Phase counter 1..7 -> [cell base, scroll floor]. The ROM indexes a jump table by 2*counter; the
// counter is always 1..7 on this path (higher values throw), so we key on it directly.
const ANIM_ARMS = {
  1: [FLY_SPRITE_X + 0x18, 0xc1], 2: [FLY_SPRITE_X + 0x14, 0xa9],
  3: [FLY_SPRITE_X + 0x10, 0x91], 4: [FLY_SPRITE_X + 0x0c, 0x79],
  5: [FLY_SPRITE_X + 0x08, 0x61], 6: [FLY_SPRITE_X + 0x04, 0x49],
  7: [FLY_SPRITE_X, 0x31],
};

export function driveAttractDemoSequencer(m) {
  const { mem8 } = m;

  if (mem8[CREDIT_BCD] !== 0) return setAttractIdleMode(m);

  const phase = mem8[ATTRACT_SEQUENCER_PHASE];
  if (phase !== 0) return dispatchPhase(m, phase);

  // phase 0: seed the demo, laying out 7 cells (+0=0, +2=3, +3=0x81)
  fillTilemapBlock28x32(m);
  clearObjectBlocksAndMirrorToObjRam(m);
  let p = CELL_BASE;
  for (let i = 0; i < 7; i++) {
    mem8[p] = 0x00;
    mem8[(p + 2)] = 0x03;
    mem8[(p + 3)] = 0x81;
    p = p + 4;
  }
  mem8[ATTRACT_FRAME_TIMER] = 0x04;
  mem8[(ATTRACT_FRAME_TIMER + 1)] = 0x05;
  return seedAnimator(m);
}

// Arm the animator: phase counter 7 (boot enters the last cell), dwell 0x20, then advance the phase.
function seedAnimator(m) {
  const mem8 = m.mem8;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0x07;
  mem8[ATTRACT_DEMO_DWELL] = 0x20;
  return advancePhase(m);
}

function advancePhase(m) {
  m.mem8[ATTRACT_SEQUENCER_PHASE] = m.mem8[ATTRACT_SEQUENCER_PHASE] + 1;
}

function dispatchPhase(m, phase) {
  const a = (phase - 1) & 0xff;
  if (a !== 0) return dispatchPhase2Plus(m, a);

  // phase 1: the scroll animator; the phase counter (1..7) picks the arm
  const p = m.mem8[ATTRACT_DEMO_PHASE_COUNTER];
  const arm = ANIM_ARMS[p];
  if (!arm) {
    throw new NotImplemented(
      `driveAttractDemoSequencer: phase counter ${p} outside the arm table (1..7)`,
    );
  }
  return animatorTail(m, arm[0], arm[1]);
}

// Run the frame clock (caller-skip), scroll this cell left four pixels, clamp and advance at the floor.
function animatorTail(m, cellBase, limit) {
  const mem8 = m.mem8;
  if (!tickAttractCellFrameClock(m)) return;
  const tile = attractCellFrameTile(m);

  const scrolled = (mem8[cellBase] - 4) & 0xff;
  mem8[cellBase] = scrolled;
  mem8[(cellBase + 1)] = tile;
  if (scrolled >= limit) return;

  mem8[(cellBase + 1)] = 0x1e;
  const left = (mem8[ATTRACT_DEMO_PHASE_COUNTER] - 1) & 0xff;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = left;
  if (left !== 0) return;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0x14;
  return advancePhase(m);
}

function dispatchPhase2Plus(m, a) {
  const mem8 = m.mem8;
  if (((a - 1) & 0xff) !== 0) return stampAttractDemoCell(m);

  // phase 2: rewind the seven cells
  if (!tickAttractCellFrameClock(m)) return;
  const c = (attractCellFrameTile(m) - 0x03) & 0xff;

  const d7 = mem8[ATTRACT_DEMO_PHASE_COUNTER];
  if (d7 === 0) return seedAnimator(m);

  let hi = FLY_SPRITE_X + 3;
  for (let i = 0; i < 7; i++) {
    mem8[hi] = mem8[hi] - 4;
    mem8[(hi - 2)] = c;
    hi = hi + 4;
  }
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = d7 - 1;
}
