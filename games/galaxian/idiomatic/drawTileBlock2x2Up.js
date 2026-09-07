// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawTileBlock2x2Up (ROM 0x2593) -- draw a 2x2 tile block that grows UPWARD from the pointer.
 *
 * WHAT IT IS
 *   One of Galaxian's tile-stamp primitives. A 2x2 block is four consecutive tile codes laid out as a
 *   square in the tilemap. This routine is the upward-growing mirror of drawTileBlock2x2 (0x2585): it
 *   stamps a top pair (tile, tile+1) at the incoming pointer, then a bottom pair one tilemap row ABOVE,
 *   seeded four codes lower so the four codes read tile-1..tile+1 in the expected square order once the
 *   negative row step is applied. Every block writer in the kit is just stampTilePair chained with a
 *   different stride; here the stride is negative so the second pair lands a row up instead of down.
 *
 * ROLE IN THE MACHINE
 *   A leaf of the figure-draw stack (mechanisms.md "The stamp primitives"). drawFixedTileBlock2x2Up
 *   (0x2591) wraps it with the fixed decorative seed 46 to blank unused marker-row slots for drawMarkerRow.
 *   Delegates both halves to stampTilePair (0x25a0), which writes (HL)=code and (HL+1)=code+1, then steps
 *   the pointer HL by the supplied stride and the tile code by two.
 *
 * Grounding: [seen] (names.js cert for 0x2593).
 *
 * LIVE-OUT: returns the second stampTilePair result -- the advanced tile code (A) and pointer (HL) after
 *   the bottom pair. DE is left unchanged (stampTilePair does not touch it).
 */
import { stampTilePair } from "./stampTilePair.js";

// -33 net step for HL between the two pairs. stampTilePair already advances HL by +1 across its own pair,
// so a -33 stride nets -32 from where the pair began -- exactly one tilemap row (32 cells) UP the column.
const UP_ROW_STRIDE = 65503; // -33 as an unsigned 16-bit step: after the pair's built-in +1, one row up

export function drawTileBlock2x2Up(m, tile = m.regs.a, dst = m.regs.hl) {
  // Top pair: stamp (tile, tile+1) at the destination, then walk HL one row up ready for the bottom pair.
  const top = stampTilePair(m, tile, dst, UP_ROW_STRIDE);
  // Seed the bottom (upper-row) pair four codes below where stampTilePair left the code. stampTilePair
  // advanced the code by +2 for the top pair, so backing off four re-aligns the square's code sequence.
  const bottomTile = (top.a - 4) & 0xff; // step the code back four before the upper pair
  // Bottom pair one row up, from the pointer the first pair advanced to. Its result is this call's return.
  return stampTilePair(m, bottomTile, top.hl, UP_ROW_STRIDE);
}
