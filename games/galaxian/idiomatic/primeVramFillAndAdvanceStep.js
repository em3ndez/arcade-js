// SPDX-License-Identifier: GPL-3.0-only
/**
 * primeVramFillAndAdvanceStep -- the setup step of the attract sequence that clears working RAM,
 * rewinds the VRAM fill cursor, arms the dwell timer, and hands the sequence on to the next step.
 *
 * WHAT IT IS
 *   The attract/play sequence runs a screen-blanking march that fills the tilemap 32 bytes per frame.
 *   Before that march can run, this step primes it: it wipes the standing-formation flag block and two
 *   status bytes, points the fill cursor at the top of the tile grid, seeds the per-frame page counter,
 *   and advances SEQUENCE_STATE so the following frames run the fill sub-state.
 *
 * ROLE IN THE MACHINE
 *   Dispatched by SEQUENCE_STATE (0x400a). FLAG_BITS_BASE (0x4100) is the packed live-alien bitmap
 *   block; clearing 128 bytes there zeroes the formation. FRAME_COUNTER (0x425f) and loc_4224 are
 *   status bytes reset for the new pass. VRAM_WRITE_PTR (0x400b) is the 16-bit fill write cursor, seeded
 *   two cells into VRAM_BASE (0x5000) so the fill march starts just past the corner. loc_4009 is the
 *   dwell tier reused here as the fill page counter (32 pages of 32 bytes).
 *
 * ROM 0x01c6.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: memory only -- the flag block and status bytes cleared, VRAM_WRITE_PTR reseeded, loc_4009
 *   armed, SEQUENCE_STATE incremented. No register result the caller reads.
 */
import { VRAM_WRITE_PTR, VRAM_BASE, SEQUENCE_STATE, loc_4009, FLAG_BITS_BASE, FRAME_COUNTER, loc_4224 } from "./names.js";

const BLOCK_LENGTH = 128;
const PAGE_COUNT = 32;

export function primeVramFillAndAdvanceStep(m) {
  const { mem8, mem16 } = m;

  // Clear the 128-byte flag-bits block (the standing-formation live-alien bitmap) and the two status
  // bytes FRAME_COUNTER and loc_4224, so the fill march begins from a fully-zeroed state.
  for (let i = 0; i < BLOCK_LENGTH; i++) mem8[FLAG_BITS_BASE + i] = 0;
  mem8[FRAME_COUNTER] = 0;
  mem8[loc_4224] = 0;

  // Seed the 16-bit VRAM write cursor two cells into the tile grid (VRAM_BASE + 2), arm the page
  // counter in loc_4009 (32 pages), and advance the sequence so the next frames run the fill sub-state.
  mem16[VRAM_WRITE_PTR] = VRAM_BASE + 2;
  mem8[loc_4009] = PAGE_COUNT;
  mem8[SEQUENCE_STATE]++;
}
