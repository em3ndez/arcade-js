// SPDX-License-Identifier: GPL-3.0-only
/** advancePlayerAnimationStrip — advance a multi-frame tile animation driven by a phase byte in the record. On the
 * opening frame (phase at or past the cap) the phase is clamped, the paired entry is flagged, and
 * sound cues are requested — one burst always, one extra only past the second level — unless two
 * game-state cells divert the frame into the heading snap instead. Otherwise the phase is stepped
 * down and, when it lands on one of seven keyframe values, a shape strip is blitted tile-by-tile
 * into video and colour memory a row at a time; a phase between keyframes draws nothing.
 * LIVE-OUT: memory. The routine is a pure painter — its sole caller (dispatchPlayerFrameByState)
 * tail-returns and reads no register it leaves, so every register it touches is dead-after-return
 * scratch and lives here as a JS local. The two heading-snap diverts hand the compared byte to
 * the divert target in `a` (which folds it with the sound routines' leftover `b`), so that one boundary
 * write rides the return. */

import { u8, u16 } from "../../../core/int.js";
import { loc_1f2e } from "./loc_1f2e.js";
import { requestLateEraProgressSound } from "./requestLateEraProgressSound.js";
import { requestRoundIntroSoundBurst } from "./requestRoundIntroSoundBurst.js";
import { offsetAddress } from "./offsetAddress.js";
import {
  TAMPER_COLOUR_STRIP,
  TAMPER_GLYPH_STRIP,
  ERA_INDEX,
  PLAYER_ANIM_ROW_COUNT,
  PLAYER_ANIM_COL_COUNT,
  PLAYER_ANIM_VRAM_BASE,
  PLAYER_ANIM_STRIP_0,
  PLAYER_ANIM_STRIP_1,
  PLAYER_ANIM_STRIP_2,
  PLAYER_ANIM_STRIP_3,
  PLAYER_ANIM_STRIP_4,
} from "./names.js";

const PHASE = 0x00; // record byte holding the animation phase
const PAIR_FLAG = 0x01; // paired-entry byte flagged on the opening frame
const FIRST_FRAME = 0xb4; // phases at or above this are the opening frame; clamp to it
const PAIR_MARK = 0xff;
const EXTRA_CUE_LEVEL = 0x02;
const RUNNING = 0xa5;
const STATE_DRAW_A = 0x05;
const STATE_DRAW_B = 0x10;
const COLOUR_BIAS = 0xc1; // added to the level to pick the strip's colour attribute
const ROW_ADVANCE = 0x1b; // step from the last tile of a row to the first of the next
const COLOUR_RAM_BIT = 2; // clearing this bit of the high address byte maps video into colour memory
const VRAM_TO_COLOUR = 1 << (8 + COLOUR_RAM_BIT); // clear from a video address to reach colour RAM

// phase after the decrement -> base of the strip's shape data, in keyframe order
const FRAME_ARMS = [
  [0xb3, PLAYER_ANIM_STRIP_0],
  [0xab, PLAYER_ANIM_STRIP_1],
  [0xa3, PLAYER_ANIM_STRIP_2],
  [0x9b, PLAYER_ANIM_STRIP_3],
  [0x93, PLAYER_ANIM_STRIP_3],
  [0x8b, PLAYER_ANIM_STRIP_2],
  [0x83, PLAYER_ANIM_STRIP_4],
];

export function advancePlayerAnimationStrip(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  if (mem8[X(PHASE)] >= FIRST_FRAME) {
    // opening frame: clamp the phase, flag the paired entry, request the round-intro cues
    mem8[X(PHASE)] = FIRST_FRAME;
    mem8[Y(PAIR_FLAG)] = PAIR_MARK;
    if (mem8[ERA_INDEX] >= EXTRA_CUE_LEVEL) requestLateEraProgressSound(m);
    requestRoundIntroSoundBurst(m);

    // two game-state cells can divert the frame into the heading snap; each hands the divert target the
    // compared byte in `a` (its `b` is the sound routines' leftover, untouched here)
    const glyph = mem8[TAMPER_GLYPH_STRIP];
    if (glyph !== RUNNING) return (m.regs.a = glyph, loc_1f2e(m));
    const drawState = mem8[TAMPER_COLOUR_STRIP];
    if (drawState !== STATE_DRAW_A && drawState !== STATE_DRAW_B) return (m.regs.a = drawState, loc_1f2e(m));
  }

  // step the phase down; a strip draws only when it lands on one of seven keyframes
  const phaseAddr = X(PHASE);
  mem8[phaseAddr] = u8(mem8[phaseAddr] - 1);
  const phase = mem8[phaseAddr];
  let base = null;
  for (const [frame, table] of FRAME_ARMS) {
    if (phase === frame) { base = table; break; }
  }
  if (base === null) return; // phase between keyframes draws nothing

  // blit the shape strip tile-by-tile into video memory, mirroring each tile's colour attribute
  // into the colour plane VRAM_TO_COLOUR below; ROW_COUNT rows of COL_COUNT tiles, ROW_ADVANCE
  // between rows. The colour byte is the same for every tile: the level biased by COLOUR_BIAS.
  let src = base;
  let dst = PLAYER_ANIM_VRAM_BASE;
  const colour = u8(mem8[ERA_INDEX] + COLOUR_BIAS);
  let rows = mem8[PLAYER_ANIM_ROW_COUNT];
  do {
    let cols = mem8[PLAYER_ANIM_COL_COUNT];
    do {
      mem8[dst] = mem8[src];
      mem8[dst & ~VRAM_TO_COLOUR] = colour;
      dst = u16(dst + 1);
      src = u16(src + 1);
      cols = u8(cols - 1);
    } while (cols !== 0);
    dst = offsetAddress(m, dst, ROW_ADVANCE);
    rows = u8(rows - 1);
  } while (rows !== 0);
}
