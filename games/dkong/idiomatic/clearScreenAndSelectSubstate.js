// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndSelectSubstate — wipe the whole display, then jump the in-game
 * sub-state index to a computed target.  ROM 0x196b.
 *
 * Arm 23 (0x17) of the in-game sub-state table (ROM 0x0702), dispatched by
 * dispatchInGameSubstate (ROM 0x06fe) on GAME_SUBSTATE (0x600A). It is a phase
 * hand-off step — blank the previous scene, then re-point the sub-state machine into
 * a later phase group. Two actions, and it reads exactly one input byte:
 *
 *   1. CLEAR. clearTilemapAndSprites (ROM 0x0852) blanks every tilemap cell
 *      (0x7400-0x77FF -> 0x10) and zeroes the 384-byte sprite shadow buffer
 *      (0x6900-0x6A7F) — the same full-screen wipe arm 0 of this table
 *      (configureFlipScreenAndSelectSubstate, ROM 0x0986) opens with.
 *   2. SELECT. Store GAME_SUBSTATE (0x600A) = (byte at 0x600E) + 0x12, an 8-bit add
 *      (`ld a,(0x600e) / add a,0x12 / ld (0x600a),a`). 0x600E is the low byte of the
 *      game-start join value loc_08f8 wrote (0 for a 1-player start) — the very byte
 *      arm 0 reads as its start-up selector — and 0x12 is the base index of the phase
 *      group jumped into. The base is NOT folded into a single constant: the target
 *      sub-state is genuinely computed from 0x600E.
 *
 * Every other effect is on fixed memory; it reads no register.
 *
 * Memory-equivalent to the frozen oracle — equivalence-196b.test.js.
 * GATE:     crafted-entry; 0x196b is UNREACHED in attract (0 dispatches / 3000 frames)
 *           and in a coin+start driven run (0 / 4000) — its dispatch needs deep in-game
 *           progression to sub-state 23 — so it is gated by crafted entries sweeping its
 *           ONLY input, the 0x600E byte, across ALL 256 values on a real in-game base
 *           (captured at ROM 0x0986), with the clear footprint painted to a sentinel on
 *           BOTH sides to pin the exact wipe extent. The routine reads nothing else, so
 *           the 256-value sweep is exhaustive over its input space. Teeth = wrong add
 *           offset, skipped clear, and a one-cell-short tilemap fill.
 * LIVE-OUT: memory-only — the tilemap + sprite-buffer bytes (owned by
 *           clearTilemapAndSprites) and GAME_SUBSTATE (0x600A). No live registers or
 *           flags: the exit successor is the rst-0x28 sub-state dispatcher (ROM 0x06fe),
 *           which returns up the NMI path and consumes none of them, so the oracle's
 *           terminal A/B/C/HL/F are dead ABI (the whole-machine gate backstops that).
 *           SP/PC are not compared — the idiomatic layer drops the oracle's push16 /
 *           call / ret stack + PC bookkeeping (the JS call stack replaces it).
 * NAMES:    GAME_SUBSTATE (0x600A) from ram.js. The cleared tilemap / sprite-buffer
 *           addresses are owned by clearTilemapAndSprites (ROM 0x0852). 0x600E — the
 *           game-start join low byte used here as the phase selector — is not evidenced
 *           in ram.js and stays a local hex constant, as in
 *           configureFlipScreenAndSelectSubstate (ROM 0x0986).
 */

import { GAME_SUBSTATE } from "./ram.js";
import { clearTilemapAndSprites } from "./clearTilemapAndSprites.js"; // ROM 0x0852

// Low byte of the 16-bit join value loc_08f8 stored at game start; read here as the
// selector whose +0x12 gives the next sub-state. Not evidenced in ram.js, so it stays
// hex (named JOIN_VALUE_LO in configureFlipScreenAndSelectSubstate, ROM 0x0986).
const PHASE_SELECTOR = 0x600e;

// Base index of the phase group this arm jumps into; added to the selector to form the
// next sub-state. Kept explicit (not folded) — the oracle computes it live.
const PHASE_GROUP_BASE = 0x12;

export function clearScreenAndSelectSubstate(m) {
  const { mem } = m;

  // 1. Blank the whole display (tilemap + sprite shadow buffer) for the next phase.
  clearTilemapAndSprites(m); // ROM 0x0852

  // 2. Select the next sub-state: base + the selector byte, 8-bit wrap.
  mem.write8(GAME_SUBSTATE, (mem.read8(PHASE_SELECTOR) + PHASE_GROUP_BASE) & 0xff);
}
