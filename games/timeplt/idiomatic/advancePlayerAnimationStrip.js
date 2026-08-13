// SPDX-License-Identifier: GPL-3.0-only
/** advancePlayerAnimationStrip — advance a multi-frame tile animation driven by a phase byte in the record. On the
 * opening frame (phase at or past the cap) the phase is clamped, the paired entry is flagged, and
 * sound cues are requested — one burst always, one extra only past the second level — unless two
 * game-state cells divert the frame into the heading snap instead. Otherwise the phase is stepped
 * down and, when it lands on one of seven keyframe values, a shape strip is blitted tile-by-tile
 * into video and colour memory a row at a time; a phase between keyframes draws nothing.
 * LIVE-OUT: the phase and paired-entry cells, the drawn strip, or whatever the divert leaves. */

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
const COLOUR_RAM_BIT = 2; // clearing this bit of H maps video into colour memory

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

export function advancePlayerAnimationStrip(m) {
  const { regs, mem, mem8 } = m;

  regs.a = mem8[(regs.ix + PHASE) & 0xffff];
  regs.cp(FIRST_FRAME);
  if (!regs.fC) {
    mem8[(regs.ix + PHASE) & 0xffff] = FIRST_FRAME;
    mem8[(regs.iy + PAIR_FLAG) & 0xffff] = PAIR_MARK;
    regs.a = mem8[ERA_INDEX];
    regs.cp(EXTRA_CUE_LEVEL);
    if (!regs.fC) requestLateEraProgressSound(m);
    requestRoundIntroSoundBurst(m);

    regs.a = mem8[TAMPER_GLYPH_STRIP];
    regs.cp(RUNNING);
    if (regs.fNZ) return loc_1f2e(m);

    regs.de = TAMPER_COLOUR_STRIP;
    regs.a = mem8[regs.de];
    regs.cp(STATE_DRAW_A);
    if (regs.fNZ) {
      regs.cp(STATE_DRAW_B);
      if (regs.fNZ) return loc_1f2e(m);
    }
  }

  regs.decMem8(mem, (regs.ix + PHASE) & 0xffff);
  regs.a = mem8[(regs.ix + PHASE) & 0xffff];

  let base = null;
  for (const [frame, table] of FRAME_ARMS) {
    regs.cp(frame);
    if (regs.fZ) { base = table; break; }
  }
  if (base === null) return; // phase between keyframes

  regs.de = base;
  regs.hl = PLAYER_ANIM_VRAM_BASE;
  regs.b = COLOUR_BIAS;
  regs.a = mem8[ERA_INDEX];
  regs.add(regs.b);
  regs.c = regs.a;
  regs.exx();
  regs.a = mem8[PLAYER_ANIM_ROW_COUNT];
  regs.b = regs.a;
  do {
    regs.exx();
    regs.a = mem8[PLAYER_ANIM_COL_COUNT];
    regs.b = regs.a;
    do {
      regs.a = mem8[regs.de];
      mem8[regs.hl] = regs.a;
      regs.h = regs.res(COLOUR_RAM_BIT, regs.h);
      mem8[regs.hl] = regs.c;
      regs.h = regs.set(COLOUR_RAM_BIT, regs.h);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
    } while (regs.djnz() !== 0);
    regs.a = ROW_ADVANCE;
    offsetAddress(m);
    regs.exx();
  } while (regs.djnz() !== 0);
}
