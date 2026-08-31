// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { advanceTileAnimForwardOnOdd } from "./advanceTileAnimForwardOnOdd.js";
import { tickStatusRenderRingAndRedrawOnWrap } from "./tickStatusRenderRingAndRedrawOnWrap.js";
import { TILE_ANIM_CURSOR, TAMPER_STRIKES_SIG, loc_8083, loc_8343 } from "./names.js";
/**
 * movePlayerDownAndTickStatusRender -- the descent ("move down") half of the
 * player actor's direction-split motion handler.
 *
 * WHAT IT IS
 * The player is slot 0 of the actor arena, and its record carries an aim/direction
 * byte at (IX+7). A pair of sibling handlers split on that byte: one drives the
 * actor up, this one drives it down. This half runs only while aim bit 3 -- the
 * "descend" request -- is set. On each such frame it nudges the actor's vertical
 * position (IX+4) one step toward the floor, clamps it at the low-screen limit
 * 0xc0, and rebuilds the three stacked sprite rows that draw the player as one
 * rigid vertical column. It then carries the frame into the game's shared
 * per-frame render tail: the marching tile-strip animator and the status-panel
 * redraw ring.
 *
 * ROLE IN THE MACHINE
 * Two jobs in one entry point -- the descent branch of player movement, and the
 * hand-off into the shared status render. That render tail is gated: while the
 * tile-strip animation cursor sits anywhere but its end marker the tail always
 * runs, but once the strip reaches its end the redraw continues only while an
 * anti-tamper strike is on record or a colour-RAM parity is nonzero. With nothing
 * armed the handler holds and the on-screen animation freezes in place.
 *
 * ROM: 0x236a-0x23a0.
 * Grounding: [seen]
 * LIVE-OUT: none -- a void handler; the caller reads nothing back. Its work lands
 *   in the mutated player record (the position byte at IX+4 and the three derived
 *   sprite-Y cells) and in whatever the shared render tail paints to video RAM.
 */
// Field offsets into the actor record (base = IX), the descent floor, the
// tile-strip end marker, the tamper-block length and the parity mask -- the
// magic numbers of the ROM handler, named.
const OFF_POS_Y = 0x04; //     (IX+4) actor vertical position
const OFF_AIM_FLAGS = 0x07; // (IX+7) aim/direction flags
const ACTIVE_BIT = 0x08; //    aim bit 3: descent runs only while set
const POS_FLOOR = 0xc0; //     high clamp for the descent position
const CURSOR_END = 0xf6; //    cursor low byte marking the script's end
const TAMPER_SIG_LEN = 3; //   tamper-strike cells scanned before the tail
const PARITY_MASK = 0x0f; //   low nibble of the colour-parity sum

export function movePlayerDownAndTickStatusRender(m, actor = m.regs.ix) {
  const { mem8 } = m;

  // GATE ON THE DESCEND BIT.
  // The aim/direction byte at (IX+7) bit 3 is the "move down" request. This half
  // of the split handler is inert unless the bit is set, so the up-handler and
  // this down-handler never both move the actor in the same frame.
  if ((mem8[actor + OFF_AIM_FLAGS] & ACTIVE_BIT) === 0) return; // inactive -> hold

  // STEP THE ACTOR DOWN ONE UNIT, THEN CLAMP AT THE FLOOR.
  // (IX+4) is the actor's vertical position. Add one (u8-wrapped) to move a single
  // step toward the bottom of the screen; if that reaches or passes the low-screen
  // limit 0xc0, pin it there so the player cannot descend past the floor line.
  const y = u8(mem8[actor + OFF_POS_Y] + 1);
  mem8[actor + OFF_POS_Y] = y;
  if (y >= POS_FLOOR) mem8[actor + OFF_POS_Y] = POS_FLOOR; // clamp at the floor

  // REBUILD THE PLAYER SPRITE STACK.
  // The player draws as three sprite rows stacked into one column. Rederive their
  // Y coordinates from the single position byte just written, so the whole column
  // tracks the new height in lock-step.
  deriveStackedSpriteYs(m);

  // GATE THE SHARED RENDER TAIL AT THE TILE-STRIP END MARKER.
  // TILE_ANIM_CURSOR (0x88be) low byte marches a strip of video-RAM tiles forward
  // and back. Anywhere but its end marker 0xf6 the render tail below always runs;
  // only once the strip reaches 0xf6 does the tail turn conditional on something
  // being "armed".
  if (mem8[TILE_ANIM_CURSOR] === CURSOR_END) {
    // (a) An anti-tamper strike: scan the three signature-checksum strike cells at
    //     TAMPER_STRIKES_SIG (0x8a38..0x8a3a); any nonzero cell arms the tail.
    let armed = false;
    for (let i = 0; i < TAMPER_SIG_LEN; i++) {
      if (mem8[TAMPER_STRIKES_SIG + i] !== 0) { armed = true; break; }
    }
    if (!armed) {
      // (b) A colour-RAM parity: sum two colour-RAM cells (loc_8343 + loc_8083) and
      //     keep the low nibble. A nonzero nibble arms the tail; zero holds it.
      const parity = (mem8[loc_8343] + mem8[loc_8083]) & PARITY_MASK;
      if (parity === 0) return; // nothing armed -> hold, no render
    }
  }

  // RUN THE SHARED PER-FRAME RENDER TAIL.
  // Advance the marching tile-strip animator (it acts only on odd-parity frames),
  // then tick the status-render ring: it decrements a mod-8 counter and, on wrap,
  // borrows one from the mod-4 render phase and repaints the status-panel tile
  // blocks.
  advanceTileAnimForwardOnOdd(m); // advance the tile-anim script
  return tickStatusRenderRingAndRedrawOnWrap(m); //            shared render tail
}
