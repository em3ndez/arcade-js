// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearFlagBlockAndReseedObjectShadow -- attract-sequence state handler that tears down the formation
 * bitmap and rebuilds the object shadow before the field is redrawn.
 *
 * WHAT IT IS
 *   One of the per-state handlers dispatched by runAttractSequenceAndAdvanceOnCredit off SEQUENCE_STATE
 *   (this is state index 12). It runs once per frame while the sequence sits in that state and performs a
 *   reset-and-hand-off: wipe the standing-formation flag block, zero two status cells, arm the mid-tier
 *   dwell timer, then step the sequence state and reseed the ROM-backed object shadow.
 *
 * ROLE IN THE MACHINE
 *   FLAG_BITS_BASE (0x4100) is the 128-byte one-byte-per-cell bitmap of live formation aliens; zeroing it
 *   empties the standing block so the next state can rebuild it. The reseed always rides a sequence
 *   boundary -- clearing the flags here pairs with advanceSequenceStateAndReseedObjectShadow restoring the
 *   sprite-code (odd/"shadow") lane of OBJRAM from a ROM template, so the field's glyphs come back fresh
 *   while its live coordinates are left to be repainted by the sway and the object stagers.
 *
 * ROM 0x02e8.  Grounding: [seen].
 *
 * LIVE-OUT: FLAG_BITS_BASE[0..127]:=0, FRAME_COUNTER:=0, OBJECT_DRAW_SUPPRESS:=0, loc_4009:=64, plus
 *   SEQUENCE_STATE advanced and the object shadow reseeded by the tail call.
 */
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { advanceSequenceStateAndReseedObjectShadow } from "./advanceSequenceStateAndReseedObjectShadow.js";
import { FLAG_BITS_BASE, FRAME_COUNTER, OBJECT_DRAW_SUPPRESS, loc_4009 } from "./names.js";

// The formation bitmap is a fixed 128 cells; a full frame's dwell for this state is 64 mid-tier ticks.
const FLAG_BLOCK_SIZE = 128;
const DWELL_RELOAD = 64;

export function clearFlagBlockAndReseedObjectShadow(m) {
  const { mem8 } = m;

  // Empty the standing formation: broadcast 0 across all 128 flag cells at FLAG_BITS_BASE (0x4100),
  // so no cell is marked as holding a live alien when the block is rebuilt.
  fillMemoryBlock(m, FLAG_BITS_BASE, 0, FLAG_BLOCK_SIZE);
  // Reset the free-running per-frame counter (0x425f) so the object-grid draw phase restarts from 0.
  mem8[FRAME_COUNTER] = 0;
  // Clear the object-figure draw-suppress bit (0x4238): with it 0 the object grid draws again.
  mem8[OBJECT_DRAW_SUPPRESS] = 0;
  // Arm the mid-tier dwell timer (0x4009) to 64 so the following sequence state holds for its span.
  mem8[loc_4009] = DWELL_RELOAD;

  // Hand off: the pointer arrives on loc_4009, so stepping to the next in-page byte bumps SEQUENCE_STATE
  // (0x400a); the tail then reseeds the stride-2 object shadow from its ROM template.
  advanceSequenceStateAndReseedObjectShadow(m, loc_4009);
}
