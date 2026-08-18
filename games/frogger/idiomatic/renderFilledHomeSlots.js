// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFilledHomeSlots  —  ROM 0x09DB (0x09DB–0x0A15)  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame redraw of the frog-home bays that have already been won. Frogger has five home bays
 *   along the top edge; once the frog reaches one, that bay must keep showing the resting frog for the
 *   rest of the board even while the still-empty bays animate crocodiles and flies through themselves.
 *   This routine is what keeps the won bays painted: every frame it walks the five occupancy gates and
 *   re-stamps the frog-in-home graphic into each bay that is filled.
 *
 * WHERE IT SITS
 *   Called once per frame from the scene core renderFrogSceneAndTickTimer (0x0942), which passes in HL
 *   the base of the ACTIVE player's five-byte occupancy bank — primary 0x825E.. for player 1, alt
 *   0x8263.. for player 2, selected upstream by ACTIVE_PLAYER (0x83FD). Those occupancy gates are the
 *   very win-flags the goal handler (awardHomeBayGoal) sets when a bay is reached; here they double as
 *   the redraw list, so a bay is redrawn if and only if it has already been won.
 *
 * LIVE-OUT
 *   Memory only. It writes up to four VRAM tilemap cells per filled bay and nothing else — no register
 *   the caller reads, no return value. HL is consumed as the list pointer.
 *
 * NOTE ON THE ROM SHAPE
 *   The ROM factors the four-cell stamp into one shared tail helper at 0x0A05–0x0A15: bays 1–4 reach it
 *   via `call nz,0x0A05` (taken only when the gate byte is non-zero) and bay 5 falls through into it
 *   (`ret z` when empty), so the helper's single `ret` returns to our caller. The rewrite collapses that
 *   shared-tail shape into a plain loop over the five bays.
 */
import { HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM } from "./names.js";

// The five home-bay VRAM bases, indexed by bay number (index 0 = bay 1 … index 4 = bay 5) so the array
// index lines up with the occupancy-list byte for the same bay. Note the bases DESCEND in address as the
// bay index rises — bay 1 sits highest at 0xAB64, bay 5 lowest at 0xA864 — so the array is ordered by
// bay, not by address; each 2×2 stamp writes base, base+1 (top row) and base+32, base+33 (row below).
const SLOT_BASES = [HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM];

// First tile of the 2×2 "frog resting in home" quad, tiles 108..111 (0x6C..0x6F): 108,109 on the top row
// over 110,111 on the row below. These are the same tiles stampHomeGoalAndResetFrog paints when a bay is
// first won, which is why an already-won bay looks unchanged from one frame to the next.
const HOME_TILE = 108;

// One tilemap row is 32 cells wide, so adding 32 to a cell address steps straight down to the cell below.
const ROW_STRIDE = 32;

export function renderFilledHomeSlots(m, list = m.regs.hl) {
  const { mem8 } = m;

  // Walk the five occupancy gates in bay order. Each byte is a win-flag for its bay (0 = empty, non-zero
  // = won); the caller aimed `list` at the active player's bank, so `list + i` is bay (i+1)'s gate byte.
  for (let i = 0; i < SLOT_BASES.length; i++) {
    // Empty bay → nothing to redraw. (In the ROM the zero gate makes the shared stamp's `call nz` fall
    // through, or for the last bay makes `ret z` return early.)
    if (mem8[list + i] === 0) continue;

    // Filled bay → stamp the 2×2 frog-in-home quad into this bay's fixed VRAM base: tiles 108,109 across
    // the top row (base, base+1) and 110,111 one screen row below (base+32, base+33). This four-cell
    // write is the routine's entire visible effect.
    const base = SLOT_BASES[i];
    mem8[base] = HOME_TILE;
    mem8[base + 1] = HOME_TILE + 1;
    mem8[base + ROW_STRIDE] = HOME_TILE + 2;
    mem8[base + ROW_STRIDE + 1] = HOME_TILE + 3;
  }
}
