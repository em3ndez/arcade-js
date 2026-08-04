// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupBoardMode90 — stow the 0x90 board-mode byte, then rebuild the screen for that board.  ROM 0x4b40.
 *
 * The 0x90 door of a three-way setup fan-in: three sibling entries each pick a
 * different board-mode / entry-select byte (this one 0x90, the others 0x00 and
 * 0xC0) and run one shared display-setup body. The body stows the chosen byte at
 * BOARD_MODE and then rebuilds the whole screen for the new board:
 *   - clears the sprites and per-column scroll (a blank display surface),
 *   - repaints every tilemap cell to the fixed background tile,
 *   - flat-fills the entire colour RAM using this very byte as the screen-wide
 *     colour, and
 *   - wipes the sprite-record staging block.
 * So the byte is both a board-mode selector that later code reads AND, in this
 * immediate setup, the colour every cell is painted.
 *
 * Each rebuild step is one of the already-decompiled setup helpers, called
 * directly. Reads nothing on entry (the byte is hardwired 0x90), so it always
 * drives the same setup.
 *
 * Name kept neutral: the action — pick the 0x90 variant and rebuild the screen —
 * is clear, but which game situation the 0x90 board mode corresponds to (versus
 * its 0x00 / 0xC0 siblings) is not confirmed to the naming bar, so it earns no
 * specific English name yet (its 0xC0 sibling setupBoardModeC0 stayed neutral for the
 * same reason).
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b40.test.js.
 * GATE:     crafted-entry — the 0x90 door is never dispatched in attract (the demo
 *           only reaches the 0x00 and 0xC0 doors), so the gate runs it from a REAL
 *           captured sibling entry: blankScreen (the 0x00 door) IS reached in attract
 *           and shares the identical call convention and body, so its entry is a
 *           faithful state for the 0x90 door too. setupBoardMode90 never calls blankScreen, so
 *           cloning that entry adds no recursion. The one input that shapes the
 *           output — the board-mode byte — is fixed 0x90 here. Teeth: a wrong
 *           board-mode twin (caught at BOARD_MODE and the colour RAM it fills) and a
 *           dropped-tilemap-fill twin (caught in the tilemap on a sentinel entry).
 * LIVE-OUT: memory-only — BOARD_MODE set to 0x90, the cleared sprite/attribute RAM,
 *           the repainted tilemap and flat-filled colour RAM, the wiped staging
 *           block, plus the single return to the caller. No register or flag is live
 *           out — the caller's next act reloads everything. The return is carried by
 *           the sprite/attribute-clear step, whose idiomatic form still models its
 *           own return; the oracle's three calls and closing tail-jump net exactly
 *           one return to the caller, and that is what is reproduced here.
 * NAMES:    BOARD_MODE (0x8057) from names.js — the byte this door stows and the
 *           colour fill reuses. The display regions cleared/filled live inside the
 *           imported setup helpers. The 0x90 selector stays a literal: it is a
 *           board-mode / colour byte, so its bit layout is the point.
 *
 * PURPOSE [guess]: which game situation mode 0x90 means; "90" is the HEX selector byte (bit layout is the point; sibling "C0" anchors it as hex).
 */
import { BOARD_MODE } from "./names.js";
import { clearSpriteAndAttributeRam } from "./clearSpriteAndAttributeRam.js";
import { fillVideoRam } from "./fillVideoRam.js";
import { fillColorRam } from "./fillColorRam.js";
import { clearSpriteStagingBuffer } from "./clearSpriteStagingBuffer.js";

export function setupBoardMode90(m) {
  const { mem8 } = m;

  // This door's board mode: 0x90 (siblings pick 0x00 and 0xC0). It selects the
  // board variant later code reads, and is reused right below as the screen-wide
  // colour the whole colour RAM is flat-filled with.
  mem8[BOARD_MODE] = 0x90;

  // Rebuild the screen for the new board. The sprite/attribute clear still models
  // its own return, which is this routine's single return to its caller; the three
  // remaining fills only write memory, so the observable result — board mode set,
  // screen cleared and repainted, staging wiped, caller resumed — matches the
  // oracle's three setup calls plus closing tail-jump.
  clearSpriteAndAttributeRam(m); // blank the sprites + per-column scroll
  fillVideoRam(m); // repaint every tilemap cell to the background tile
  fillColorRam(m); // flat-fill colour RAM with the board-mode byte (0x90)
  clearSpriteStagingBuffer(m); // wipe the sprite-record staging block
}
