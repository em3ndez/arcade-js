// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickAttractCellFrameClock  —  ROM 0x0F3E  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The per-cell animation clock for the attract-mode "board demo" river. While no coins are queued,
 *   Frogger's attract loop assembles a fake gameplay screen and scrolls a row of seven decorative cells
 *   (logs, turtles, etc.) leftward across it; each cell also cycles through a short four-frame tile
 *   animation. This routine is that animation's heartbeat: every call it ticks a shared countdown timer,
 *   and ONLY on the frame the timer runs out does it advance the shared frame cursor to the next tile.
 *
 * WHERE IT SITS
 *   Called once per animated cell per frame from the attract-demo sequencer (driveAttractDemoSequencer):
 *   its phase-1 scroll animator (animatorTail) and its phase-2 cell rewind both gate their per-cell work
 *   on this clock. In the ROM it is a "double caller-skip": on the not-elapsed path the routine pops its
 *   caller's return address so control resumes ABOVE the caller, skipping the scroll-and-draw entirely.
 *   The idiomatic module dissolves that stack trick into a plain boolean — false = "tick not elapsed,
 *   skip the rest of this cell", true = "tick elapsed, a fresh frame tile is ready" — which every caller
 *   reads as `if (!tickAttractCellFrameClock(m)) return;`.
 *
 * LIVE-OUT
 *   Memory: the frame timer ATTRACT_FRAME_TIMER (0x83bd) on every call, and — only on the tick — the
 *   frame cursor ATTRACT_FRAME_INDEX (0x83be). On the true (elapsed) return it additionally leaves the
 *   current frame's tile in the accumulator A, matching the oracle whose caller reads A; the idiomatic
 *   caller instead re-reads that tile register-free via attractCellFrameTile. The return value itself is
 *   a boolean, not a tile.
 */
import { u8 } from "../../../core/int.js";
import { ATTRACT_FRAME_TIMER, ATTRACT_FRAME_INDEX, ATTRACT_TILE_TABLE } from "./names.js";

// Dwell per animation frame. Once the clock ticks, the next frame is held for 8 more ticks (frames)
// before it advances again. The sequencer's phase-0 setup seeds the timer to 4 for the very first frame;
// from then on every tick reloads it to this value.
const TIMER_RELOAD = 8;

// The frame cursor counts DOWN and wraps back to 4 when it would reach 0, so the animation cycles through
// cursor values 4, 3, 2, 1 forever (four frames). 0 is never a resting value — it is caught and reloaded
// on the same tick it appears.
const INDEX_WRAP = 4;

/**
 * attractCellFrameTile — the tile for the attract cell's CURRENT animation frame: ATTRACT_TILE_TABLE[cursor].
 *
 * Reads the frame cursor ATTRACT_FRAME_INDEX (0x83be) and indexes the tile table ATTRACT_TILE_TABLE
 * (0x2e1b) by it. The address arithmetic reproduces the Z80's 8-bit table lookup exactly: the ROM keeps
 * the table base in HL and adds the index to L ALONE — no carry into H — so the read can never leave the
 * table's own 256-byte page. Hence `(base & ~0xff)` pins the page (0x2e00) while `u8((base & 0xff) + index)`
 * wraps the low byte at 256. tickAttractCellFrameClock leaves this same value in A on its elapsed exit;
 * idiomatic callers instead call this helper directly, right after the clock has advanced the cursor.
 */
export function attractCellFrameTile(m) {
  const { mem8 } = m;
  const index = mem8[ATTRACT_FRAME_INDEX];
  return mem8[(ATTRACT_TILE_TABLE & ~0xff) | u8((ATTRACT_TILE_TABLE & 0xff) + index)];
}

export function tickAttractCellFrameClock(m) {
  const { mem8 } = m;

  // ── Tick the shared frame timer ──────────────────────────────────────────────────────
  // ATTRACT_FRAME_TIMER (0x83bd) counts down one per call. Decrement it (8-bit wrap via u8) and store it
  // back. While it has not yet reached 0 the current animation frame is still being held, so tell the
  // caller to skip this cell's scroll-and-draw for the frame by returning false. This false return is the
  // dissolved form of the ROM's caller-skip — where the oracle would discard its caller's return address.
  const timer = u8(mem8[ATTRACT_FRAME_TIMER] - 1);
  mem8[ATTRACT_FRAME_TIMER] = timer;
  if (timer !== 0) return false;

  // ── The clock ticked: reload the dwell ───────────────────────────────────────────────
  // Reset the timer so the next frame is held for TIMER_RELOAD (8) ticks before it advances.
  mem8[ATTRACT_FRAME_TIMER] = TIMER_RELOAD;

  // ── Advance the frame cursor, wrapping 0 → 4 ─────────────────────────────────────────
  // ATTRACT_FRAME_INDEX (0x83be) walks DOWN through the tile table. Decrement it; if it lands on 0, wrap
  // back to INDEX_WRAP (4) so the four-frame cycle repeats (4, 3, 2, 1). Store the new cursor.
  let index = u8(mem8[ATTRACT_FRAME_INDEX] - 1);
  if (index === 0) index = INDEX_WRAP;
  mem8[ATTRACT_FRAME_INDEX] = index;

  // ── Publish the new frame's tile and report the tick ─────────────────────────────────
  // Look up the tile for the freshly-advanced cursor via ATTRACT_TILE_TABLE (0x2e1b) and leave it in A,
  // matching the oracle (whose caller reads A). Return true so the caller goes on to scroll this cell and
  // draw the tile.
  const tile = attractCellFrameTile(m);
  return (m.regs.a = tile, true);
}
