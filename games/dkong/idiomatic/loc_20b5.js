// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20b5 — send an object off at exactly one pixel per frame to the LEFT, unless its horizontal
 * step already has a whole-pixel part, in which case the mirror arm sends it right instead; then
 * hand the record on to the shared launch tail.
 *
 * The two bytes this arm writes are the record's per-frame horizontal step: the whole-pixel half
 * at +16 and the 1/256-pixel fraction at +17, one big-endian signed 16-bit value. 255,0 is
 * −256/256 = −1.0 px/frame, leftward. That reading is fixed from OUTSIDE this body — two stores
 * say nothing on their own:
 *   - The CONSUMER settles it. The ballistic integrator reads +16:+17 as one big-endian 16-bit
 *     quantity and adds it, every airborne frame, to the coordinate whose whole half is OBJ_X (+3)
 *     and whose fraction is +4 — so the pair is that coordinate's per-frame step and nothing else.
 *     Had it turned out to read the pair as a timer or a table index, the reading here would have
 *     died there.
 *   - The SIGN convention comes from Mario, whose airborne record has the same shape: his
 *     horizontal-velocity pair holds +128 for a rightward jump and −128 for a leftward one, so a
 *     whole-pixel byte of 255 is leftward.
 *
 * THE BRANCH IS A ZERO TEST ON THE WHOLE-PIXEL BYTE, NOT A SIGN TEST, and the difference is real:
 * the byte is zero exactly when the existing step is rightward and smaller than one whole pixel per
 * frame (0 ≤ step < 1.0). Those records get the leftward whole pixel written here; EVERY other
 * step — all leftward ones, and rightward ones of a whole pixel or more — goes instead to the
 * mirror arm, which stamps 1,0 (+1.0 px/frame, rightward). Over the steps the running game actually
 * presents here the two arms ARE a direction flip, because only the two whole-pixel bytes 0 and 255
 * ever turn up. NOT CLAIMED: that the pair behaves as a flip for a rightward step of a whole pixel
 * or more. Nothing observed reaches that case, and on it the two arms are not mirrors — the object
 * keeps its direction and merely loses speed.
 *
 * WHAT PUTS A RECORD HERE IS THE CALLER'S BUSINESS, and control never comes back to it either way.
 * What game event that corresponds to was not derived here, and neither was what kind of object
 * these records hold — so the routine keeps its neutral name.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register rather than becoming a
 * named argument, because both continuations re-read that register to reach the rest of the same
 * record. A caller passing a different record would be obeyed by the two stores here and ignored
 * one call later.
 *
 * LIVE-OUT: memory, plus the propagated return value. Nothing is dropped and there is no
 * dead-register claim to defend: both continuations run on past this body, so the register file,
 * the flags and the stack at exit belong to them, not to this routine.
 */

// The record's per-frame horizontal step: whole pixels first, then the 1/256-pixel fraction.
const STEP_WHOLE = 16;
const STEP_FRACTION = 17;

// What this arm writes: one whole pixel per frame, no fraction, leftward. 255 is the whole-pixel
// half of −1.0 in the record's signed big-endian form.
const LEFTWARD_ONE_PIXEL_WHOLE = 255;
const LEFTWARD_ONE_PIXEL_FRACTION = 0;

export function loc_20b5(m) {
  const { mem8 } = m;
  const at = (offset) => (m.regs.ix + offset) & 0xffff;

  // Anything but a sub-pixel rightward step is answered by the mirror arm, which stamps the
  // rightward whole pixel instead.
  if (mem8[at(STEP_WHOLE)] !== 0) return m.call(0x20e1);

  mem8[at(STEP_FRACTION)] = LEFTWARD_ONE_PIXEL_FRACTION;
  mem8[at(STEP_WHOLE)] = LEFTWARD_ONE_PIXEL_WHOLE;

  // On into the shared tail, which rebuilds the vertical half of the launch from the same record.
  return m.call(0x20c3);
}
