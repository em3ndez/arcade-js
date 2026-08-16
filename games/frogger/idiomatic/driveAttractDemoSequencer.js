// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";
/**
 * driveAttractDemoSequencer — the attract-demo sequencer, run each vblank while the credit count is
 * zero. Credits present tails to the attract-idle setter; otherwise a state machine on the phase byte:
 * 0 seeds the demo and arms the animator, 1 runs the scroll animator (a computed jump picks the cell
 * and its scroll floor, then the shared tail scrolls it left four pixels through the frame clock), 2
 * rewinds the seven cells, higher tails to the per-cell demo stamp. The frame clock is a caller-skip:
 * on its not-elapsed branch it returns straight to our caller, so we just return and the seam reads the
 * two-byte delta it leaves. LIVE-OUT: memory-only.
 */
import { CREDIT_BCD, loc_83bf, loc_83d7, ATTRACT_DEMO_DWELL, FLY_SPRITE_X } from "./names.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { setAttractIdleMode } from "./setAttractIdleMode.js";
import { stampAttractDemoCell } from "./stampAttractDemoCell.js";

const ATTRACT_FRAME_TIMER = 0x83bd; // frame timer byte; the next byte is the frame index
const CELL_BASE = FLY_SPRITE_X;     // the seven four-byte attract cells
const FRAME_CLOCK = 0x0f3e;         // caller-skip: keep it dispatched by address

// Animator phase 1..7 -> [cell base, scroll floor], indexed by the computed jump slot.
const ANIM_ARMS = {
  0x0ec3: [0x8058, 0xc1], 0x0ec5: [0x8054, 0xa9], 0x0ec7: [0x8050, 0x91], 0x0ec9: [0x804c, 0x79],
  0x0ecb: [0x8048, 0x61], 0x0ecd: [0x8044, 0x49], 0x0ecf: [0x8040, 0x31],
};

export function driveAttractDemoSequencer(m) {
  const { mem8 } = m;

  if (mem8[CREDIT_BCD] !== 0) return setAttractIdleMode(m);

  const phase = mem8[loc_83bf];
  if (phase !== 0) return dispatchPhase(m, phase);

  // phase 0: seed the demo, laying out 7 cells (+0=0, +2=3, +3=0x81)
  fillTilemapBlock28x32(m);
  clearObjectBlocksAndMirrorToObjRam(m);
  let p = CELL_BASE;
  for (let i = 0; i < 7; i++) {
    mem8[p] = 0x00;
    mem8[(p + 2) & 0xffff] = 0x03;
    mem8[(p + 3) & 0xffff] = 0x81;
    p = (p + 4) & 0xffff;
  }
  mem8[ATTRACT_FRAME_TIMER] = 0x04;
  mem8[(ATTRACT_FRAME_TIMER + 1) & 0xffff] = 0x05;
  return seedAnimator(m);
}

// Arm the animator: phase counter 7 (boot enters the last cell), dwell 0x20, then advance the phase.
function seedAnimator(m) {
  const mem8 = m.mem8;
  mem8[loc_83d7] = 0x07;
  mem8[ATTRACT_DEMO_DWELL] = 0x20;
  return advancePhase(m);
}

function advancePhase(m) {
  m.mem8[loc_83bf] = (m.mem8[loc_83bf] + 1) & 0xff;
}

function dispatchPhase(m, phase) {
  const a = (phase - 1) & 0xff;
  if (a !== 0) return dispatchPhase2Plus(m, a);

  // phase 1: the scroll animator; a computed jump on the phase counter picks the arm
  const p = m.mem8[loc_83d7];
  const hl = (0x0ec1 + ((p + p) & 0xff)) & 0xffff;
  const arm = ANIM_ARMS[hl];
  if (!arm) {
    throw new NotImplemented(
      `driveAttractDemoSequencer computed jump: slot 0x${hl.toString(16)} outside the arm table`,
    );
  }
  return animatorTail(m, arm[0], arm[1]);
}

// Run the frame clock (caller-skip), scroll this cell left four pixels, clamp and advance at the floor.
function animatorTail(m, cellBase, limit) {
  const mem8 = m.mem8;
  m.push16(0x0f01);
  if (!m.call(FRAME_CLOCK)) return;
  const tile = m.regs.a;

  const scrolled = (mem8[cellBase] - 4) & 0xff;
  mem8[cellBase] = scrolled;
  mem8[(cellBase + 1) & 0xffff] = tile;
  if (scrolled >= limit) return;

  mem8[(cellBase + 1) & 0xffff] = 0x1e;
  const left = (mem8[loc_83d7] - 1) & 0xff;
  mem8[loc_83d7] = left;
  if (left !== 0) return;
  mem8[loc_83d7] = 0x14;
  return advancePhase(m);
}

function dispatchPhase2Plus(m, a) {
  const mem8 = m.mem8;
  if (((a - 1) & 0xff) !== 0) return stampAttractDemoCell(m);

  // phase 2: rewind the seven cells
  m.push16(0x0f1d);
  if (!m.call(FRAME_CLOCK)) return;
  const c = (m.regs.a - 0x03) & 0xff;

  const d7 = mem8[loc_83d7];
  if (d7 === 0) return seedAnimator(m);

  let hi = 0x8043;
  for (let i = 0; i < 7; i++) {
    mem8[hi] = (mem8[hi] - 4) & 0xff;
    mem8[(hi - 2) & 0xffff] = c;
    hi = (hi + 4) & 0xffff;
  }
  mem8[loc_83d7] = (d7 - 1) & 0xff;
}
