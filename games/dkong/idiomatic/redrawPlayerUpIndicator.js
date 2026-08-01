// SPDX-License-Identifier: GPL-3.0-only
/**
 * redrawPlayerUpIndicator — blink the on-screen "player up" indicator column,
 * every 16th frame.  ROM 0x0315.
 *
 * Called from the per-frame housekeeping. It only does work on a multiple-of-16
 * frame (FRAME's low nibble zero); every other frame it returns at once. On the
 * frames it does run it repaints one player-indicator column of the tilemap,
 * three cells tall, stepping one screen row back (−32 columns) between cells.
 *
 * FRAME bit 4 selects the blink phase, so the indicator toggles every 16 frames:
 *   • bit 4 CLEAR — paint the CURRENT player's column with its glyphs: the
 *     player-number tile (player index + 1) at the base cell, then two fixed
 *     tiles (0x25, 0x20) one row back each.
 *   • bit 4 SET   — first blank the current player's column (three blank 0x10
 *     tiles). Then, ONLY in a two-player game, paint the OTHER player's column
 *     (current index XOR 1) with its glyphs the same way — so the inactive
 *     player's marker shows while the active one is blanked. In a one-player game
 *     this phase just blanks and stops.
 *
 * The current-player index feeds loc_0347, which maps 0 → the player-1 column
 * base (0x7740) and anything else → the player-2 column base (0x74e0). The glyph
 * value written at the base cell is that same selector plus one (player 1 → tile
 * 1, player 2 → tile 2).
 *
 * A `rst 0x08` caller-skip guard sits right after the frame test: during attract
 * (no credited game) the whole repaint is skipped. Expressed as the boolean
 * early-return idiom `if (!gameActiveGuard(m)) return;`.
 *
 * Nothing consumes a return value — the caller discards it — so this is void.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0315.test.js.
 * GATE:     captured + crafted. 0x0315 is dispatched every main-loop pass, so real
 *           captured dispatches cover the frame-skip early-out, the attract
 *           guard-skip, AND (in the brief ATTRACT-clear boot/start windows) the
 *           paint body; each must match the oracle over RAM − STACK_SCRATCH + pc +
 *           SP. Crafted entries then pin BOTH guard arms, BOTH FRAME blink phases,
 *           BOTH player selectors, and the one- vs two-player split deterministically.
 *           Teeth: a wrong row step and a wrong player-number glyph.
 * LIVE-OUT: memory-only — the per-frame caller discards the result and reloads its
 *           registers; the oracle's residual A/HL/flags and the two-level `rst 0x08`
 *           return are dead ABI (the whole-machine gate backstops that). The three
 *           writes land in video RAM (the two indicator columns), not work RAM.
 * NAMES:    FRAME (0x601A), CURRENT_PLAYER (0x600D), TWO_PLAYER_GAME (0x600F),
 *           ATTRACT (0x6007 via gameActiveGuard) — all from ram.js. The two column
 *           bases 0x7740/0x74e0 are VIDEO RAM (returned by loc_0347), not work RAM,
 *           so they carry no ram.js name and stay hex.
 */

import { FRAME, CURRENT_PLAYER, TWO_PLAYER_GAME } from "./ram.js";
import { gameActiveGuard } from "./gameActiveGuard.js"; // ROM 0x0008
import { loc_0347 } from "./loc_0347.js"; // ROM 0x0347 — column-base selector

// Video-RAM step between the three stacked indicator cells: −32 columns = one
// screen row back in the 32-wide tilemap (the oracle's DE = 0xFFE0).
const ROW_BACK = 0xffe0;

export function redrawPlayerUpIndicator(m) {
  const { mem } = m;

  // Only repaint on a multiple-of-16 frame; skip all other frames.
  const frame = mem.read8(FRAME);
  if ((frame & 0x0f) !== 0) return;

  // rst 0x08 caller-skip guard — no repaint while in attract (no credited game).
  if (!gameActiveGuard(m)) return;

  // The current player's column base + the glyph value for its number tile.
  let selector = mem.read8(CURRENT_PLAYER);
  let colBase = loc_0347(selector);

  if ((frame & 0x10) !== 0) {
    // Blink OFF phase: blank the current player's three cells.
    let addr = colBase;
    mem.write8(addr, 0x10);
    addr = (addr + ROW_BACK) & 0xffff;
    mem.write8(addr, 0x10);
    addr = (addr + ROW_BACK) & 0xffff;
    mem.write8(addr, 0x10);

    // One-player game: nothing else to paint this phase.
    if (mem.read8(TWO_PLAYER_GAME) === 0) return;

    // Two-player: repaint the OTHER player's column with its glyphs below.
    selector = mem.read8(CURRENT_PLAYER) ^ 0x01;
    colBase = loc_0347(selector);
  }

  // Paint the selected column's glyphs: the player-number tile (index + 1) at the
  // base cell, then two fixed tiles one row back each.
  let addr = colBase;
  mem.write8(addr, (selector + 1) & 0xff);
  addr = (addr + ROW_BACK) & 0xffff;
  mem.write8(addr, 0x25);
  addr = (addr + ROW_BACK) & 0xffff;
  mem.write8(addr, 0x20);
}
