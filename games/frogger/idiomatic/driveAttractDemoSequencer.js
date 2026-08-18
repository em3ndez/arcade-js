// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveAttractDemoSequencer  —  ROM 0x0e7a  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The attract-mode "board demo" sequencer — the little self-playing river scene the cabinet shows
 *   between games while it waits for a coin. It is a four-stage state machine that, over many frames,
 *   (0) seeds a fake gameplay field and lays out seven decorative river cells, (1) scrolls those cells
 *   in from the right one at a time, (2) rewinds/retracts them, and (3) hands off to the per-cell demo
 *   stamp that paints the board graphics. Exactly ONE stage runs per call; the stage is chosen by the
 *   phase byte ATTRACT_SEQUENCER_PHASE (0x83bf), which each stage advances when its work is done.
 *
 * WHERE IT SITS
 *   Called once per displayed frame from the vblank NMI's attract path (GAME_MODE == 0), but only while
 *   the cabinet has no money queued. The very first thing it does is check the credit total: the instant
 *   a coin is banked it abandons the demo and parks the machine at the attract-idle screen instead, so a
 *   player can start. Nothing here runs during actual play.
 *
 *   The four stages chain through each other across frames: phase 0 seeds and advances to phase 1; phase
 *   1's scroll animator drains its cell counter then advances to phase 2; phase 2's rewind drains its
 *   step counter then re-seeds the animator (which advances to phase 3); phase 3+ tails to
 *   stampAttractDemoCell, which paints the board cell by cell and finally resets the phase byte to 0 and
 *   parks at attract-idle — closing the loop.
 *
 * LIVE-OUT
 *   Memory only. It writes the phase/dwell/counter cells, the seven four-byte river-cell records based at
 *   FLY_SPRITE_X (0x8040), and the attract frame-timer word ATTRACT_FRAME_TIMER (0x83bd); it also drives
 *   the field-fill / object-clear primitives and tail-returns into the shared attract tails. It returns
 *   nothing and leaves no register the caller reads. On the frame-clock's not-elapsed branch it simply
 *   returns without touching the cell, matching the ROM's caller-skip.
 */
import { CREDIT_BCD, ATTRACT_SEQUENCER_PHASE, ATTRACT_DEMO_PHASE_COUNTER, ATTRACT_DEMO_DWELL, FLY_SPRITE_X, ATTRACT_FRAME_TIMER } from "./names.js";
import { NotImplemented } from "../../../boards/frogger/io.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { setAttractIdleMode } from "./setAttractIdleMode.js";
import { stampAttractDemoCell } from "./stampAttractDemoCell.js";
import { tickAttractCellFrameClock, attractCellFrameTile } from "./tickAttractCellFrameClock.js";

// The seven decorative river cells are stored as consecutive four-byte object records starting at
// FLY_SPRITE_X (0x8040) — the same block the fly/goal sprite uses during play, reused here in attract.
// Each record is [+0 = X position, +1 = animation tile, +2 = attr (fixed 3), +3 = a second position byte].
const CELL_BASE = FLY_SPRITE_X;

// Phase-1 arm table: the animator's active-cell counter (1..7, held in ATTRACT_DEMO_PHASE_COUNTER 0x83d7)
// selects which cell to scroll this frame and the X floor it stops at. In the ROM this is a jump table
// indexed by 2*counter; the counter is always 1..7 on this path (anything else throws below), so we key
// on it directly. Counter 7 drives the first cell (record +0, stops at 0x31) and the value walks down to
// counter 1 driving the last cell (record +0x18, stops at 0xc1): the cell record address steps 0x04 per
// counter (one 4-byte sprite record), while the X floor it scrolls to steps 0x18 — which is what
// staggers where the seven cells come to rest across the screen.
const ANIM_ARMS = {
  1: [FLY_SPRITE_X + 0x18, 0xc1], 2: [FLY_SPRITE_X + 0x14, 0xa9],
  3: [FLY_SPRITE_X + 0x10, 0x91], 4: [FLY_SPRITE_X + 0x0c, 0x79],
  5: [FLY_SPRITE_X + 0x08, 0x61], 6: [FLY_SPRITE_X + 0x04, 0x49],
  7: [FLY_SPRITE_X, 0x31],
};

export function driveAttractDemoSequencer(m) {
  const { mem8 } = m;

  // ── Money gate: a coin waiting means abandon the demo ─────────────────────────────────
  // CREDIT_BCD (0x83e1) is the on-screen credit total in packed BCD. Any nonzero value means a coin has
  // been banked, so we stop looping the demo and tail to setAttractIdleMode (forces GAME_MODE 0x83d6 = 5,
  // the "insert coin / press start" idle screen) so the player can begin. This is checked first, every
  // frame, before any demo work.
  if (mem8[CREDIT_BCD] !== 0) return setAttractIdleMode(m);

  // ── Stage select on the phase byte ────────────────────────────────────────────────────
  // ATTRACT_SEQUENCER_PHASE (0x83bf) is the demo's stage number. Only phase 0 falls through here (the
  // seed stage); every other phase is dispatched by the state machine below.
  const phase = mem8[ATTRACT_SEQUENCER_PHASE];
  if (phase !== 0) return dispatchPhase(m, phase);

  // ── Phase 0: seed the demo field and the seven river cells ────────────────────────────
  // Paint the fake gameplay backdrop (fillTilemapBlock28x32) and wipe any stale sprite/object blocks
  // (clearObjectBlocksAndMirrorToObjRam) so the demo starts on a clean slate.
  fillTilemapBlock28x32(m);
  clearObjectBlocksAndMirrorToObjRam(m);

  // Lay out the seven four-byte cell records at CELL_BASE (FLY_SPRITE_X 0x8040): each cell gets +0 = 0x00
  // (X position, later scrolled in phase 1), +2 = 0x03 (the fixed object attribute), +3 = 0x81 (the
  // second position byte, later retracted in phase 2). Byte +1 (the tile) is left as-is until the
  // animator writes each frame's tile.
  let cellPtr = CELL_BASE;
  for (let i = 0; i < 7; i++) {
    mem8[cellPtr] = 0x00;
    mem8[cellPtr + 2] = 0x03;
    mem8[cellPtr + 3] = 0x81;
    cellPtr = cellPtr + 4;
  }

  // Seed the attract frame-timer word: ATTRACT_FRAME_TIMER (0x83bd) = 4 counts down the very first
  // animation frame, and its neighbour ATTRACT_FRAME_INDEX (0x83be) = 5 is the initial frame cursor that
  // the shared frame clock (tickAttractCellFrameClock) walks. Then hand off to the animator seed.
  mem8[ATTRACT_FRAME_TIMER] = 0x04;
  mem8[ATTRACT_FRAME_TIMER + 1] = 0x05;
  return seedAnimator(m);
}

// Arm the phase-1 scroll animator. Sets the active-cell counter ATTRACT_DEMO_PHASE_COUNTER (0x83d7) = 7
// (the animator walks it down 7→1, one cell per cell-completion) and the dwell ATTRACT_DEMO_DWELL
// (0x83bc) = 0x20 (32 frames, the later phase-3 stamp's per-cell pause), then advances the phase byte.
// Reached both from phase 0's seed and from phase 2 once its rewind drains — either way, "start the
// scroll fresh".
function seedAnimator(m) {
  const { mem8 } = m;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0x07;
  mem8[ATTRACT_DEMO_DWELL] = 0x20;
  return advancePhase(m);
}

// Step the demo to its next stage: bump ATTRACT_SEQUENCER_PHASE (0x83bf) by one. Every stage calls this
// once its per-frame work is complete, driving the 0→1→2→3 progression.
function advancePhase(m) {
  m.mem8[ATTRACT_SEQUENCER_PHASE] = m.mem8[ATTRACT_SEQUENCER_PHASE] + 1;
}

// The state machine's non-zero-phase dispatcher. The ROM tests phases with a chain of `dec a; jr z`, so
// we peel one phase per comparison: `phase - 1 == 0` is phase 1 (the scroll animator); anything else
// falls through to dispatchPhase2Plus, which peels off phase 2 next.
function dispatchPhase(m, phase) {
  const phaseMinusOne = (phase - 1) & 0xff;
  if (phaseMinusOne !== 0) return dispatchPhase2Plus(m, phaseMinusOne);

  // ── Phase 1: the scroll animator ──────────────────────────────────────────────────────
  // The active-cell counter ATTRACT_DEMO_PHASE_COUNTER (0x83d7), always 1..7 on this path, selects which
  // cell to scroll and its X floor from the arm table. A value outside 1..7 means the machine reached a
  // state the port never modelled, so surface it loudly rather than scroll a bogus cell.
  const phaseCounter = m.mem8[ATTRACT_DEMO_PHASE_COUNTER];
  const arm = ANIM_ARMS[phaseCounter];
  if (!arm) {
    throw new NotImplemented(
      `driveAttractDemoSequencer: phase counter ${phaseCounter} outside the arm table (1..7)`,
    );
  }
  return animatorTail(m, arm[0], arm[1]);
}

// Scroll one river cell left four pixels this frame, then clamp and hand off to the next cell once it
// reaches its floor. `cellBase` is the cell's +0 (X) byte; `scrollFloor` is the X it stops at.
function animatorTail(m, cellBase, scrollFloor) {
  const { mem8 } = m;

  // Gate the whole cell on the shared per-cell animation clock (tickAttractCellFrameClock, ROM 0x0f3e).
  // It ticks the frame timer and returns false while the current animation frame is still being held —
  // the dissolved form of the ROM's caller-skip — so on a not-elapsed frame we do nothing this call.
  if (!tickAttractCellFrameClock(m)) return;

  // The clock elapsed: read the tile for the freshly-advanced animation frame (attractCellFrameTile
  // re-reads it register-free from ATTRACT_TILE_TABLE via the frame cursor 0x83be).
  const tile = attractCellFrameTile(m);

  // Scroll the cell left four pixels (8-bit wrap) and write both the new X and this frame's tile into the
  // cell record (+0 = X, +1 = tile). While the cell is still to the right of its floor, that is all —
  // it keeps scrolling on later frames.
  const scrolledX = (mem8[cellBase] - 4) & 0xff;
  mem8[cellBase] = scrolledX;
  mem8[cellBase + 1] = tile;
  if (scrolledX >= scrollFloor) return;

  // The cell has reached its floor. Clamp its tile to the resting tile 0x1e, then retire this cell by
  // decrementing the active-cell counter ATTRACT_DEMO_PHASE_COUNTER (0x83d7). While cells remain, the
  // next frame animates the next cell (the lower counter selects the next arm).
  mem8[cellBase + 1] = 0x1e;
  const cellsLeft = (mem8[ATTRACT_DEMO_PHASE_COUNTER] - 1) & 0xff;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = cellsLeft;
  if (cellsLeft !== 0) return;

  // All seven cells have scrolled in. Reload the counter to 0x14 (20) — phase 2 will use it as its
  // rewind step count — and advance to phase 2.
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0x14;
  return advancePhase(m);
}

// Phases 2 and up. `phaseMinusOne` is `phase - 1`; peel one more with `dec a; jr z`: `phaseMinusOne - 1
// == 0` is phase 2 (the rewind); anything higher tails to stampAttractDemoCell, the per-cell board-demo
// painter for phases 3+.
function dispatchPhase2Plus(m, phaseMinusOne) {
  const { mem8 } = m;
  if (((phaseMinusOne - 1) & 0xff) !== 0) return stampAttractDemoCell(m);

  // ── Phase 2: rewind the seven cells ───────────────────────────────────────────────────
  // Same per-frame clock gate as phase 1 (tickAttractCellFrameClock, ROM 0x0f3e): do nothing on a
  // not-elapsed frame.
  if (!tickAttractCellFrameClock(m)) return;

  // The rewind tile is this frame's animation tile stepped back three (8-bit wrap), giving the retract a
  // reversed-looking frame.
  const rewindTile = (attractCellFrameTile(m) - 0x03) & 0xff;

  // ATTRACT_DEMO_PHASE_COUNTER (0x83d7) now holds the rewind step count (seeded to 0x14 at the end of
  // phase 1). When it drains to 0 the rewind is finished: re-arm the scroll animator (which reloads the
  // counter to 7 and advances the phase), looping the demo's motion.
  const phaseCounter = mem8[ATTRACT_DEMO_PHASE_COUNTER];
  if (phaseCounter === 0) return seedAnimator(m);

  // Retract all seven cells one step: for each cell walk its +3 (second position) byte back four and
  // rewrite its +1 (tile) byte with the rewind tile. cellByte3 starts at the first cell's +3 byte
  // (FLY_SPRITE_X 0x8040 + 3) and strides +4 per cell; cellByte3 - 2 is that cell's +1 tile byte.
  let cellByte3 = FLY_SPRITE_X + 3;
  for (let i = 0; i < 7; i++) {
    mem8[cellByte3] = mem8[cellByte3] - 4;
    mem8[cellByte3 - 2] = rewindTile;
    cellByte3 = cellByte3 + 4;
  }

  // Count off one rewind step. When this reaches 0 on a later frame, the check above re-seeds the animator.
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = phaseCounter - 1;
}
