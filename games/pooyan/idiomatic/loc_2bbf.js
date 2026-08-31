// SPDX-License-Identifier: GPL-3.0-only
import { paintReadySpriteSquareIfAbsent } from "./paintReadySpriteSquareIfAbsent.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { FORMATION_READY_TILE_VRAM, READY_SPRITE_SRC } from "./names.js";
/**
 * loc_2bbf — the formation "ready-sprite" staging helper (boolean caller-skip).
 *
 * WHAT IT IS
 *   A tiny screen-staging helper run at the very top of the formation-spawn tick. Before a
 *   new wave of formation objects can start streaming in, the play field has to show the
 *   little "ready" marker(s) that announce the wave. This routine makes sure the right
 *   marker artwork is on screen, and — crucially — tells its caller whether the wave has
 *   ALREADY been fully staged so the caller can skip the rest of the tick.
 *
 *   It is driven by one input, `a`, the per-stage arrival count WAVE_ARRIVAL_COUNTER
 *   (0x8903): how many enemies have arrived so far this stage. Its caller only reaches here
 *   when that count is below 2 — i.e. `a` is 0 or 1 — which is the window at the very start
 *   of a wave where the ready markers still need attention. Two cases:
 *     • a == 1 : the formation indicator has already been staged elsewhere for this wave, so
 *       there is nothing to build here beyond the ready-sprite square itself — stamp it and
 *       report "normal".
 *     • a == 0 : this is the fresh case. Peek at the formation indicator cell; if the marker
 *       is already up (the wave is fully staged) report "skip" so the caller abandons the
 *       tick; otherwise paint the indicator tile AND the ready-sprite square and report
 *       "normal".
 *
 * ROLE IN THE MACHINE
 *   Formation objects are the birds/enemies that arrive in the play field wave after wave.
 *   The formation-spawn tick (its caller) paces those arrivals and scans for a free slot to
 *   launch the next object into. This helper is the pre-flight step of that tick: it keeps
 *   the on-screen "ready" indication in sync with the wave, and its boolean lets the caller
 *   short-circuit the whole tick on frames where the wave is already staged and nothing more
 *   needs doing.
 *
 * ROM ADDRESS: 0x2bbf–0x2bd1.
 *
 * GROUNDING: [seen] throughout. Every cell and helper it touches is [seen]: the formation
 *   indicator cell FORMATION_READY_TILE_VRAM (0x877b) and the shared 4-byte tile source
 *   READY_SPRITE_SRC (0x2be1), the ready-sprite square painter paintReadySpriteSquareIfAbsent
 *   (0x2bd3) and the 2x2 block-stamp primitive blit2x2TileBlock (0x3325); its caller,
 *   tickFormationSpawnAndScanSlots (0x2b9a), and the arrival count it is fed,
 *   WAVE_ARRIVAL_COUNTER (0x8903), are [seen] as well.
 *
 * LIVE-OUT (memory only — the caller reads back no register):
 *   • a == 1 : the ready-sprite square (a 2x2 block anchored at 0x87bb) is left painted.
 *   • a == 0, indicator already up : nothing is written.
 *   • a == 0, indicator absent : the formation indicator square (2x2 anchored at 0x877b) AND
 *     the ready-sprite square (0x87bb) are left painted.
 *
 * CALLER-SKIP SIGNAL: the boolean return steers the formation-spawn tick.
 *   true  = normal — the caller continues into the spawn-countdown / slot-scan.
 *   false = skip — the indicator is already present, so the caller abandons this tick.
 */

// Value of the arrival count meaning the formation indicator has already been staged for
// this wave elsewhere, so only the ready-sprite square still needs stamping here.
const READY = 0x01; // wave count that means the indicator is already staged elsewhere
// Sentinel tile code that sits in the formation indicator's anchor cell (0x877b) whenever the
// indicator square is currently painted. It is both the top-left tile of the artwork and the
// "already present" marker this routine tests to decide whether the wave is fully staged.
const PAINTED_MARKER = 0xba; // indicator cell value once the square is present

export function loc_2bbf(m, a = m.regs.a) {
  const { mem8 } = m;

  // Case a == 1: the formation indicator is already staged for this wave, so there is
  // nothing to build here except the ready-sprite square. Stamp it (idempotently — the
  // painter no-ops if the square is already on screen) and report the normal path so the
  // caller carries on with the rest of the tick.
  if (a === READY) {
    paintReadySpriteSquareIfAbsent(m); // stamp the ready-sprite square
    return true;
  }

  // Case a == 0: fresh start of the wave. Peek at the formation indicator's anchor cell in
  // video RAM (FORMATION_READY_TILE_VRAM, 0x877b). If it already holds the painted marker
  // (0xba), the indicator square is up and the wave is fully staged — report "skip" so the
  // caller abandons the whole formation-spawn tick this frame.
  if (mem8[FORMATION_READY_TILE_VRAM] === PAINTED_MARKER) return false; // already present -> caller skips

  // Indicator not on screen: build it. Copy the fixed 4-byte ROM tile block (READY_SPRITE_SRC,
  // 0x2be1) into the 2x2 character square anchored at the indicator cell (0x877b). The stamp
  // writes 0xba into the anchor cell as its top-left tile, which is exactly the sentinel the
  // presence check above will find on later frames.
  blit2x2TileBlock(m, FORMATION_READY_TILE_VRAM, READY_SPRITE_SRC); // paint the indicator tile
  // Then also stamp the ready-sprite square (anchored at its own cell 0x87bb, painted idempotently).
  paintReadySpriteSquareIfAbsent(m); // then stamp the ready-sprite square
  // Both markers are now up; report the normal path so the caller continues the tick.
  return true;
}
