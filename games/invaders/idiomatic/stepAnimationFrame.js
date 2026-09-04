// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceRecordTotals } from "./advanceRecordTotals.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";
import { ANIM_FRAME_COUNTER, ANIM_COORD_STEP_LO, ANIM_SPRITE_COORD, ANIM_SPRITE_SRC, ANIM_END_COORD, ANIM_DONE_FLAG, ANIM_BASE_SPRITE_SRC } from "./names.js";

// stepAnimationFrame — advance one frame of a scripted sprite animation and draw it.
//
// WHAT IT IS
//   Once per call it bumps the animation's frame counter, glides the sprite's screen coordinate forward
//   by the script's step, and checks whether the run has reached its end point. If it has, it latches the
//   done flag and stops. Otherwise it picks this frame's sprite graphic (alternating between two poses as
//   it moves) and shift-blits the sprite at its new coordinate. This is the attract-screen "sprite walks
//   across the display" animation (e.g. the demo alien/saucer glide).
//
// ROLE IN THE MACHINE
//   State lives in a small block of work RAM. ANIM_FRAME_COUNTER (0x20c2) is the frame counter. advanceRecordTotals
//   folds the step byte at ANIM_COORD_STEP_LO (0x20c3) into the two-byte coordinate accumulator whose low
//   byte is ANIM_SPRITE_COORD (0x20c5): it adds the step into 0x20c5 and the record's delta byte into the
//   high byte 0x20c6, returning that high total. When that total equals ANIM_END_COORD (0x20ca) the glide
//   has arrived, so ANIM_DONE_FLAG (0x20cb) is raised — the handshake runAttractAnimTask waits on. The
//   frame's graphic is taken from the base pointer ANIM_BASE_SPRITE_SRC (0x20cc); adding 0x30 while bit 2
//   of the counter is clear flips between the two sprite poses every four steps. That pointer is stored
//   into ANIM_SPRITE_SRC (0x20c7), which together with the coordinate word forms the five-byte descriptor
//   loadSpriteDescriptor decodes. The frame is drawn through the hardware bit shifter (blitShiftedSprite).
//
// ROM 0x1868.  Grounding: [seen].
//
// LIVE-OUT: on the done path A = 1 (the "finished" signal). On the draw path HL/DE/B are left by the
// blit tail (base screen address / advanced source / 0).
export function stepAnimationFrame(m) {
  // Advance the frame counter. Its bit 2 (below) is what times the two-pose alternation, so it is stepped
  // every frame whether or not the animation is finished.
  m.mem8[ANIM_FRAME_COUNTER] = u8(m.mem8[ANIM_FRAME_COUNTER] + 1);
  // Glide the coordinate: advanceRecordTotals adds the step byte (passed as C, read from 0x20c3) into the
  // coordinate's low byte at ANIM_SPRITE_COORD (0x20c5) and the record delta into the high byte (0x20c6),
  // returning that high total — the progress measure this animation runs on.
  const total = advanceRecordTotals(m, ANIM_COORD_STEP_LO, m.mem8[ANIM_COORD_STEP_LO]);
  // End test: when the progress total reaches the scripted end coordinate, latch the done flag (the
  // handshake the foreground waits on), report A=1, and draw nothing more this frame.
  if (m.mem8[ANIM_END_COORD] === total) {
    m.mem8[ANIM_DONE_FLAG] = 1;
    return (m.regs.a = 1);
  }
  // Pick this frame's graphic: start from the base sprite source, and while counter bit 2 is clear add
  // 0x30 to reach the alternate-pose bank — so the sprite flips between its two frames every four steps.
  let dst = m.mem16[ANIM_BASE_SPRITE_SRC];
  if ((m.mem8[ANIM_FRAME_COUNTER] & 0x04) === 0) dst = u16(dst + 0x30);
  // Publish the chosen source pointer into the descriptor's source field so the decode below reads it.
  m.mem16[ANIM_SPRITE_SRC] = dst;
  // Decode the five-byte descriptor at ANIM_SPRITE_COORD: descHl is the sprite SOURCE pointer (the C:A
  // word, i.e. ANIM_SPRITE_SRC just written) and descDe is the screen COORDINATE (the D:E word). Seat the
  // coordinate in HL (what blitShiftedSprite's position seat reads) and pass the source as its argument,
  // then shift-blit the frame through the hardware bit shifter.
  const [descHl, descDe] = loadSpriteDescriptor(m, ANIM_SPRITE_COORD);
  return ((m.regs.hl = descDe), blitShiftedSprite(m, descHl));
}
