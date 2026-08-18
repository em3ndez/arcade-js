// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampAttractDemoCell  —  ROM 0x0de0  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-cell assembler for the attract-mode "board demo" — the little river scene the cabinet
 *   plays to itself between games. The demo river is drawn as SEVEN separate 2x2 tile cells, and this
 *   routine places exactly ONE of them per call, paced by a dwell counter so the seven appear one at a
 *   time rather than all at once. Each call it (1) re-asserts the two demo scroll registers, (2) ticks
 *   the dwell counter and bails while it is still counting, and only when the dwell expires (3) stamps
 *   this phase's 2x2 tile corner into VRAM and wipes that cell's stale object block. When the seventh
 *   and last cell has been placed it resets the whole attract sequencer and parks at the idle screen.
 *
 * WHERE IT SITS
 *   Tail-called from the attract sequencer driveAttractDemoSequencer (0x0e7a) on its higher phases —
 *   the sequencer seeds the field and animates the scroll on phases 0/1/2, then hands off to this
 *   routine to lay down the demo graphics cell by cell. Runs only in attract mode (no credits, no
 *   game in progress); nothing calls it during play.
 *
 * LIVE-OUT
 *   Memory only. It writes the two scroll registers, the dwell/phase counters, four VRAM tile cells
 *   and a four-byte object block per placement, and (on the last cell) the sequencer reset cells. It
 *   returns nothing and leaves no register the caller reads.
 */
import { OBJECT_ANIM_STATE_800D, DEMO_SCROLL_REGISTER, ATTRACT_DEMO_DWELL, ATTRACT_DEMO_PHASE_COUNTER, ATTRACT_SEQUENCER_PHASE, ATTRACT_PHASE_COMPANION, FLY_SPRITE_X, ATTRACT_DEMO_CORNER_VRAM } from "./names.js";
import { setAttractIdleMode } from "./setAttractIdleMode.js";

// Value the dwell counter (0x83bc) is reloaded to after each placement: 32 frames of pause before the
// next cell appears, so the seven cells reveal at a steady visible pace.
const DWELL_RELOAD = 32;

// The demo board is exactly seven cells. This is both the phase-counter reload and the total used to
// map the descending phase index onto the ascending object block below.
const PHASE_COUNT = 7;

// Distance in VRAM between one phase cell's 2x2 corner and the next: successive cells are laid 96 tile
// cells apart, so cell N's corner is ATTRACT_DEMO_CORNER_VRAM (0xa8c6) + 96*(N-1).
const CELL_VRAM_STRIDE = 96;

// One demo object cell is a contiguous four-byte block. That single size serves two roles: it is the
// stride between successive cells' object blocks, AND the number of bytes cleared per placement.
const OBJ_CELL_BYTES = 4;

// One tilemap row is 32 tile cells wide, so +32 from a corner steps straight down to the next screen row.
const ROW = 32;

// Base tile per phase 1..7 (index 0 unused — phase is always 1-based here). Several phases repeat a
// value (244 and 216 each appear twice), so it must be a literal table rather than a formula.
const BASE_TILE = [0, 216, 248, 244, 244, 220, 216, 212];

export function stampAttractDemoCell(m) {
  const { mem8 } = m;

  // ── Re-assert the demo scroll registers every frame ──────────────────────────────────
  // OBJECT_ANIM_STATE_800D (0x800d) and DEMO_SCROLL_REGISTER (0x800f) are the two scroll-state cells the
  // background animator reads. Writing 3 to both on every call (not just on a placement) keeps the demo
  // river scrolling steadily while the dwell counter is still ticking between cells.
  mem8[OBJECT_ANIM_STATE_800D] = 3;
  mem8[DEMO_SCROLL_REGISTER] = 3;

  // ── Dwell gate: pace the seven placements ─────────────────────────────────────────────
  // ATTRACT_DEMO_DWELL (0x83bc) counts down one per frame. mem8 is a byte store, so when it is already 0
  // the decrement wraps 0 -> 0xFF (matching the ROM), which is still nonzero — the demo keeps dwelling.
  // Until it reaches exactly 0 there is nothing to place this frame, so fall straight through.
  mem8[ATTRACT_DEMO_DWELL] = mem8[ATTRACT_DEMO_DWELL] - 1;
  if (mem8[ATTRACT_DEMO_DWELL] !== 0) return; // still dwelling — no cell placed this frame

  // Dwell expired: rearm it for the pause before the next cell, then place this phase's cell below.
  mem8[ATTRACT_DEMO_DWELL] = DWELL_RELOAD;

  // ── Locate this phase's VRAM corner and object block ──────────────────────────────────
  // ATTRACT_DEMO_PHASE_COUNTER (0x83d7) runs 7 down to 1 and selects which cell to place. The VRAM corner
  // ascends with the phase index (cell 1 at the base, cell 7 furthest along), while the object block runs
  // the OPPOSITE way — 4*(7-phase) — so the first cell placed (phase 7) clears the lowest object block.
  const phase = mem8[ATTRACT_DEMO_PHASE_COUNTER];
  const cornerVram = ATTRACT_DEMO_CORNER_VRAM + CELL_VRAM_STRIDE * (phase - 1);
  const objBlock = FLY_SPRITE_X + OBJ_CELL_BYTES * (PHASE_COUNT - phase);
  const baseTile = BASE_TILE[phase];

  // ── Stamp the 2x2 tile corner ─────────────────────────────────────────────────────────
  // Draw the cell's four tiles as a 2x2 quad: baseTile / baseTile+1 across the top row, baseTile+2 /
  // baseTile+3 on the row directly below (one tilemap row = +ROW = +32). This is the visible demo graphic.
  mem8[cornerVram] = baseTile;
  mem8[cornerVram + 1] = baseTile + 1;
  mem8[cornerVram + ROW] = baseTile + 2;
  mem8[cornerVram + ROW + 1] = baseTile + 3;

  // ── Wipe this cell's stale object block ───────────────────────────────────────────────
  // The four-byte object block at FLY_SPRITE_X (0x8040) + 4*(7-phase) held this cell's animated-scroll
  // sprite during the earlier animator phase; zero it now that the static tile graphic has taken over,
  // so no leftover sprite lingers over the placed cell.
  for (let i = 0; i < OBJ_CELL_BYTES; i++) mem8[objBlock + i] = 0;

  // ── Advance the phase; more cells still to place? ─────────────────────────────────────
  // Step ATTRACT_DEMO_PHASE_COUNTER (0x83d7) down one. While it is nonzero there are cells left, so return
  // and let the next expiry place the next one.
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = mem8[ATTRACT_DEMO_PHASE_COUNTER] - 1;
  if (mem8[ATTRACT_DEMO_PHASE_COUNTER] !== 0) return; // cells remain — place the rest on later frames

  // ── Last cell placed → reset the sequencer and idle ───────────────────────────────────
  // All seven cells are down. Reload the phase counter to 7 for the next demo run, and clear both
  // sequencer cells — ATTRACT_SEQUENCER_PHASE (0x83bf), the phase byte driveAttractDemoSequencer runs its
  // state machine on, and its companion ATTRACT_PHASE_COMPANION (0x83bb), which is cleared to 0 alongside
  // it (write-only-to-0, holds no live state). Then tail into setAttractIdleMode (0x0e74), which forces
  // GAME_MODE (0x83d6) = 5 to park the machine at the attract-idle screen until the demo runs again.
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = PHASE_COUNT;
  mem8[ATTRACT_SEQUENCER_PHASE] = 0;
  mem8[ATTRACT_PHASE_COMPANION] = 0;
  setAttractIdleMode(m); // tail into the demo-complete / credits-present attract-idle tail
}
