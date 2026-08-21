// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blit2x2TileBlock — copy four source bytes into a 2x2 video-RAM square anchored at `dest`, in the
 * order top-left, top-right (+0x01), bottom-right (+0x21), bottom-left (+0x20). Source bytes are read
 * consecutively (src+0..src+3); 0x20 is the video-RAM row stride.
 *
 * LIVE-OUT: returns the dest pointer advanced to the bottom-left cell (dest + 0x20); the two-tile
 * animators read it to step one row up before the next blit, so wiring must write HL back. The four
 * VRAM cells are the memory effect. DE/A are left as plumbing — callers restore or ignore them.
 */
export function blit2x2TileBlock(m, dest = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  mem8[dest + 0x00] = mem8[src + 0x00];
  mem8[dest + 0x01] = mem8[src + 0x01];
  mem8[dest + 0x21] = mem8[src + 0x02];
  mem8[dest + 0x20] = mem8[src + 0x03];

  return (m.regs.hl = u16(dest + 0x20)); // HL live-out: sets HL for the animators, returns it
}
