// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FRAME_COUNTER, loc_39, POKEY1_AUDF1, POKEY1_AUDC1, ATTRACT_SND_SLOTA, ATTRACT_SND_SLOTB, ATTRACT_SND_VALUE } from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";

/**
 * stepVectorPhaseAnimation — drive one phase of the attract-mode POKEY sound + vector flourish. ROM 0xdb9a.
 *
 * Role in the machine: during Tempest's attract/idle loop this steps a small 8-phase sequencer that both
 * animates a vector header and plays a marching POKEY tone. Phase counter loc_39 ($0039) advances once
 * every 64 frames (gated on the low 6 bits of FRAME_COUNTER $0003 being zero, so it stays slow), and its
 * low 3 bits index three parallel ROM sequencer rows -- ATTRACT_SND_SLOTA ($dbd5), ATTRACT_SND_SLOTB
 * ($dbd6) and ATTRACT_SND_VALUE ($dfdc). SLOTA picks a POKEY1 voice to silence, SLOTB picks a voice to
 * (re)fire with the phase's value byte, so the eight phases sweep a repeating sound pattern.
 *
 * Behavior: conditionally bump loc_39, mask it to 0..7 for the row index. Read slotA and clear that voice's
 * control register (POKEY1_AUDC1 $60c1 + slotA = 0x00). Read slotB, write the phase value into its
 * frequency register (POKEY1_AUDF1 $60c0 + slotB) and 0xa8 into its control register (volume + distortion
 * on). Then emit three display-list header words: a coord word (0x34,0x56), a tag-70 word carrying the low
 * 7 bits of the frame counter (so the flourish scrolls with time), and a closing coord word (0x34,0xaa),
 * whose emit result is returned.
 *
 * Live-out: loc_39 (advanced phase), two POKEY1 voice register triples (one silenced, one refired), and
 * three words appended to the current vector display list. Grounding: [seen].
 */
export function stepVectorPhaseAnimation(m) {
  const { mem8 } = m;
  if ((mem8[FRAME_COUNTER] & 0x3f) === 0) mem8[loc_39] = mem8[loc_39] + 1; // advance ~once per 64 frames
  const idx = mem8[loc_39] & 0x07; // 8-phase sequencer row index
  const slotA = mem8[u16(ATTRACT_SND_SLOTA + idx)];
  mem8[u16(POKEY1_AUDC1 + slotA)] = 0x00; // silence the phase's "off" voice
  const slotB = mem8[u16(ATTRACT_SND_SLOTB + idx)];
  mem8[u16(POKEY1_AUDF1 + slotB)] = mem8[u16(ATTRACT_SND_VALUE + idx)]; // set the "on" voice frequency
  mem8[u16(POKEY1_AUDC1 + slotB)] = 0xa8; // fire it at fixed volume/distortion
  emitCoordinateVectorWord(m, 0x34, 0x56); // header coord word
  emitVectorWordTag70(m, 0x01, mem8[FRAME_COUNTER] & 0x7f); // time-varying tag-70 word
  return emitCoordinateVectorWord(m, 0x34, 0xaa); // closing coord word (its emit result is returned)
}
