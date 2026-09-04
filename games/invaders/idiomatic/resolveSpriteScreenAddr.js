// SPDX-License-Identifier: GPL-3.0-only
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { coordToScreenAddr } from "./coordToScreenAddr.js";
import { loc_2087 } from "./names.js";

/**
 * resolveSpriteScreenAddr — decode the saucer sprite record into a ready-to-blit screen address.
 *
 * WHAT IT IS
 *   Two steps back to back: decode the five-byte sprite descriptor at the saucer sprite record, then fold
 *   the resulting packed coordinate through the pixel-to-video-RAM mapping, so it returns with HL holding
 *   a video-RAM address and DE holding the graphics pointer — everything a column blit needs.
 *
 * ROLE IN THE MACHINE
 *   loc_2087 (0x2087) is the saucer / mystery-ship sprite record (its precise naming is still open, hence
 *   the loc_ placeholder). loadSpriteDescriptor (0x1a3b) reads its five bytes, setting DE to the graphics
 *   pointer and returning HL = the packed C:A coordinate word; coordToScreenAddr (0x1a47) then divides by
 *   eight and clamps the high byte into the video window to yield the byte address. Called from
 *   awardSaucerScore (0x070c) before drawing the score glyphs, from drawSaucerSprite (0x073c), and from
 *   the saucer handler (0x0682).
 *
 * ROM 0x0742-0x074a.  Grounding: [seen].
 *
 * LIVE-OUT: HL = screen address, DE = graphics pointer (from the descriptor).
 */
export function resolveSpriteScreenAddr(m) {
  // Decode the saucer sprite record; the returned HL is the packed coordinate, DE the graphics pointer.
  const [hl] = loadSpriteDescriptor(m, loc_2087);

  // Fold that packed coordinate into a video-RAM byte address (>> 3, high byte clamped into 0x2000-0x3fff).
  return coordToScreenAddr(m, hl);
}
