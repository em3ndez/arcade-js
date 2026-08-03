// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20b5 — send an object off at exactly one pixel per frame to the LEFT, unless its horizontal
 * step already has a whole-pixel part, in which case the mirror arm sends it right instead; then
 * hand the record on to the shared launch tail.  ROM 0x20B5.
 *
 * The two bytes this arm writes are the record's per-frame horizontal step: the whole-pixel half
 * at +16 and the 1/256-pixel fraction at +17, one big-endian signed 16-bit value. 255,0 is
 * −256/256 = −1.0 px/frame, leftward. That reading is fixed from OUTSIDE this body — two stores
 * say nothing on their own:
 *   - The CONSUMER is decompiled and gated. stepBallisticMotion (ROM 0x239C) reads +16:+17 as one
 *     big-endian 16-bit quantity and adds it, every airborne frame, to the coordinate whose whole
 *     half is OBJ_X (+3) and whose fraction is +4 — so the pair is that coordinate's per-frame step
 *     and nothing else. Had it turned out to read the pair as a timer or a table index, the reading
 *     here would have died there.
 *   - The SIGN convention comes from Mario, whose airborne record has the same shape: ram.js
 *     records MARIO_AIR_VX_HI:MARIO_AIR_VX_LO (0x6210:0x6211) holding 0x0080 for a rightward jump
 *     and 0xFF80 for a leftward one, so a whole-pixel byte of 255 is leftward.
 *
 * THE BRANCH IS A ZERO TEST ON THE WHOLE-PIXEL BYTE, NOT A SIGN TEST, and the difference is real:
 * the byte is zero exactly when the existing step is rightward and smaller than one whole pixel per
 * frame (0 ≤ step < 1.0). Those records get the leftward whole pixel written here; EVERY other
 * step — all leftward ones, and rightward ones of a whole pixel or more — goes instead to the
 * mirror arm at ROM 0x20E1, which stamps 1,0 (+1.0 px/frame, rightward). Over what attract
 * actually produces the two arms ARE a direction flip, because attract delivers only the two
 * whole-pixel bytes 0 and 255: measured, 23 dispatches in a 4000-frame attract run, 12 with 0 (this
 * body's own arm) and 11 with 255 (the mirror). NOT CLAIMED: that the pair behaves as a flip for a
 * rightward step of a whole pixel or more. Nothing observed here reaches that case, and on it the
 * two arms are not mirrors — the object keeps its direction and merely loses speed.
 *
 * WHAT PUTS A RECORD HERE IS THE CALLER'S BUSINESS. There is exactly one caller in the whole lift,
 * ROM 0x20A2, and it reaches this routine two ways — a jump at ROM 0x20A6 when the record's byte
 * +21 is nonzero, and otherwise by falling off the end of its own body when the object's OBJ_Y less
 * 22 compares below MARIO_Y. Control never comes back to it either way. What game event that
 * corresponds to was not derived here, and neither was what kind of object these records hold — so
 * the routine keeps its loc_ name.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register rather than becoming a
 * named argument, because BOTH continuations are still frozen and both re-read that register to
 * reach the rest of the same record. A caller passing a different record would be obeyed by the two
 * stores here and ignored one call later. It becomes an honest parameter when ROM 0x20C3 and ROM
 * 0x20E1 are decompiled, not before.
 *
 * Memory-equivalent to the frozen oracle — equivalence-20b5.test.js.
 * GATE:     captured + crafted + live; ATTRACT only. EVERY real dispatch is replayed, inline at the
 *           dispatch rather than sampled — 23 of 23 in a 4000-frame attract run, spanning both arms
 *           and all 7 record bases attract presents. The comparison is stronger than the usual
 *           contract because both sides run the identical frozen continuation: the FULL state dump
 *           WITH STACK_SCRATCH included (this routine keeps the oracle's stack shape exactly — the
 *           oracle's two exits are a jump and a fall-through, so neither side opens a bracket), the
 *           whole ordered write sequence, the entire exit register file, pc, SP and the propagated
 *           return. Crafted on real captures: all 256 whole-pixel bytes crossed with four
 *           fractions (1024 entries) and all ten OBJ_ARRAY_67 record bases — that is the only way
 *           the whole-pixel bytes 1..254 are reached at all. Also wired live at 0x20B5 for a
 *           4000-frame attract run, byte-identical to the all-oracle baseline. Teeth: seven broken
 *           twins, of which two are pinned to the one half of the contract that can see them — a
 *           swapped store ORDER, which leaves the state, the registers and the return all identical
 *           and is caught by the write sequence alone, and a twin that only misreads a whole-pixel
 *           byte attract never delivers, which every real dispatch misses and only the crafted
 *           sweep catches. NOT covered: gameplay, and boards other than 25m — but the walk this
 *           hangs off returns immediately unless BOARD is 1, so there is no other board to be
 *           missing.
 * LIVE-OUT: memory, plus the propagated return value — which is `undefined` on every entry the gate
 *           reaches, so that assertion is weak on its own and the state comparison is what carries
 *           the gate. NOTHING IS DROPPED and there is no dead-register claim to defend: the two
 *           continuations run on both sides, so the whole register file, the flags, pc and SP at
 *           exit are theirs, and the gate asserts them outright instead of excluding them.
 *           DERIVED for the accumulator and flags this body does set but the rewrite does not: the
 *           oracle leaves the whole-pixel byte in the accumulator and the flags of testing it. The
 *           first thing either arm runs that touches either is ROM 0x2407 — the mirror arm's two
 *           stores in between take immediates and read neither — and it loads the accumulator
 *           afresh, while the first flag reader anywhere on the path is that same routine's
 *           subtract, whose carry-in the mask at ROM 0x2413 has already cleared. So neither
 *           survives to a reader. MEASURED: over all 23 captured dispatches and all 1034
 *           crafted entries the exit register file (flags and shadow set included) is identical to
 *           the oracle's anyway, and a 4000-frame attract run with this routine wired live is
 *           byte-identical to the all-oracle baseline, STACK_SCRATCH included. That live comparison
 *           is sensitive, not lenient: without the oracle's skipped T-states charged back the same
 *           run forks at frame 967 on SPIN_COUNT, which the gate carries as a case.
 * NAMES:    none imported. The record's +16/+17 have no ram.js name of their own — the named cells
 *           are Mario's copies of them — so they stay in-record offsets here, as they do in
 *           stepBallisticMotion and in the mirror arm. Both continuations, ROM 0x20E1 and ROM
 *           0x20C3, have no idiomatic file yet and are reached through the registry; they belong to
 *           the same mutually-recursive object-walk cluster as this routine and are being
 *           decompiled alongside it, so dissolving those two into direct calls is a later
 *           coordinated step.
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
