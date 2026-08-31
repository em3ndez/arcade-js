// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  WAVE_NUMBER,
  SHARED_FRAME_DELAY_TIMER,
  WOLF_LAUNCH_VARIANT_INDEX,
  WOLF_LAUNCH_VARIANT_TABLE,
  LAUNCH_FRAME_DELAY_TABLE,
  ACTOR_ANIM_TABLE_5657,
  ANIM_PARAM_76D4,
  ANIM_PARAM_76DD,
} from "./names.js";
/**
 * launchWolfIntoSlot — try to release one wolf into a free enemy slot.
 *
 * WHAT IT IS
 * A wave of wolves is armed all at once, but its members must trickle onto the screen one at a
 * time instead of appearing in a clump. The wave's enemies live in eight paired record slots; once
 * per elapsed release-delay the enemy-spawner driver walks those eight slots and offers each, in
 * turn, to this helper. This helper is the per-record launch ATTEMPT: it inspects a single slot,
 * declines it if it is already occupied (letting the sweep move on to the next slot), and fills it
 * in — bringing one wolf to life — if it is free, then stops the sweep so that exactly one wolf is
 * released per elapsed delay.
 *
 * ROLE IN THE MACHINE
 * This is the innermost step of a wave's enemy-release pipeline. Two parallel 0x18-byte record
 * tables describe each wolf: an ENEMY-ACTOR record (position, state, animation — addressed by ix,
 * the ENEMY_ACTOR_TABLE at 0x8ae0) and a paired SPRITE-OBJECT record (the second on-screen sprite
 * the wolf is drawn with — addressed by iy, the SPRITE_OBJECT_TABLE at 0x8b70). A launch stamps the
 * enemy-actor record live, and from wave two on the paired sprite-object record too — seeding its
 * coordinates, drawing an animation variant for it, and pointing it at the matching animation
 * script. It then reseeds the shared inter-release delay so the next wolf waits its turn, advances
 * the wave counter, and arms the launched wolf's own launch animation.
 *
 * ROM 0x7595-0x7617.  Grounding: [seen].
 *
 * LIVE-OUT
 * A boolean: true = the slot is already occupied, keep sweeping; false = a wolf is launched,
 * abort the rest of the sweep. Everything else lands in memory: the enemy-actor record and (from
 * wave two) the paired sprite-object record, the rotating launch-variant cursor
 * WOLF_LAUNCH_VARIANT_INDEX (0x8922), the wave counter WAVE_NUMBER (0x892d), and the shared
 * frame-delay SHARED_FRAME_DELAY_TIMER (0x8929).
 *
 * ONE RELEASE PER ELAPSED DELAY
 * On a launch the routine returns false; the driver above treats false as "stop" and abandons the
 * remaining slots for this pass. Paired with the frame-delay it reseeds here, that spaces the
 * wolves out — one new wolf each time the delay expires — instead of dumping a whole wave in a
 * single frame. An already-occupied slot returns true so the driver keeps scanning for a free one.
 */

export function launchWolfIntoSlot(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  // SLOT-OCCUPIED GUARD. The two-byte record header (+0x00 | +0x01) doubles as the liveness flag:
  // bit 0 set means the slot already holds a live actor. Leave an occupied slot untouched and
  // report true so the spawner driver keeps sweeping toward the first free slot.
  if (((mem8[ix] | mem8[ix + 1]) & 0x01) !== 0) return true; // slot occupied -> keep sweeping

  // STAMP THE ENEMY-ACTOR (WOLF) RECORD. Mark the slot live (+0x00 = 1), clear its sub-fields
  // (+0x03 and the sub-position +0x05), and seed its fixed spawn coordinates: Y at +0x04 = 0x15 and
  // the row/position field at +0x06 = 0x1e. Every wolf enters the arena at the same fixed spot.
  mem8[ix + 0x00] = 0x01; // mark active
  mem8[ix + 0x03] = 0x00;
  mem8[ix + 0x05] = 0x00;
  mem8[ix + 0x04] = 0x15;
  mem8[ix + 0x06] = 0x1e;

  // FROM WAVE TWO ON, ALSO STAMP THE PAIRED SPRITE-OBJECT RECORD. Early waves (WAVE_NUMBER 0/1) run
  // a single sprite per wolf and skip this block; from wave two the wolf gets a second, paired
  // sprite whose look is drawn from a rotating variant table.
  if (mem8[WAVE_NUMBER] >= 0x02) {
    // Seed the paired record's sub-fields and fixed coordinates, mirroring the enemy-actor stamp:
    // clear +0x03 and the sub-position +0x05, Y at +0x04 = 0x14, row/position at +0x06 = 0x1e.
    mem8[iy + 0x03] = 0x00;
    mem8[iy + 0x05] = 0x00;
    mem8[iy + 0x04] = 0x14;
    mem8[iy + 0x06] = 0x1e;
    // Draw this wolf's animation variant. The launch-variant cursor WOLF_LAUNCH_VARIANT_INDEX
    // (0x8922) indexes the variant table WOLF_LAUNCH_VARIANT_TABLE (0x7618); the byte it yields is
    // both stored on the record (+0x17) and used as the index for the animation-script lookup below.
    const variantIndex = mem8[WOLF_LAUNCH_VARIANT_INDEX];
    const [variant] = fetchByteFromTableIndex(m, WOLF_LAUNCH_VARIANT_TABLE, variantIndex);
    mem8[iy + 0x17] = variant;
    // Point the paired record at its animation script: the variant byte indexes the word table
    // ACTOR_ANIM_TABLE_5657 (0x5657), whose entry is the little-endian animation-stream pointer
    // written to +0x0c/+0x0d — the per-record cursor the animator steps.
    const sequence = fetchWordFromTableIndex(m, variant, ACTOR_ANIM_TABLE_5657);
    mem8[iy + 0x0c] = sequence; //      low byte of the stream pointer (byte store truncates to 8 bits)
    mem8[iy + 0x0d] = sequence >> 8; // high byte of the stream pointer
    // Seed the paired record's facing byte (+0x09 = 0x18), then mark the slot live (+0x00 = 1) and
    // advance the variant cursor so the next wolf in this wave draws the following variant.
    mem8[iy + 0x09] = 0x18;
    mem8[iy + 0x00] = 0x01; // activate the paired record
    mem8[WOLF_LAUNCH_VARIANT_INDEX] = variantIndex + 1;
  }

  // Seed the enemy-actor record's facing byte (+0x09 = 0x18), matching the paired record above.
  mem8[ix + 0x09] = 0x18;

  // RESEED THE SHARED INTER-RELEASE DELAY. Look the next delay up in LAUNCH_FRAME_DELAY_TABLE
  // (0x761e, three entries) keyed by the CURRENT wave (clamped to two, so waves 2..7 all reuse the
  // last entry) and store it in SHARED_FRAME_DELAY_TIMER (0x8929). The driver counts this down
  // before it sweeps for the next wolf, so this sets the gap until the next release.
  const wave = mem8[WAVE_NUMBER];
  const [delay] = fetchByteFromTableIndex(m, LAUNCH_FRAME_DELAY_TABLE, wave < 0x02 ? wave : 0x02);
  mem8[SHARED_FRAME_DELAY_TIMER] = delay;

  // ADVANCE THE WAVE AND ARM THE WOLF'S LAUNCH ANIMATION. Bump WAVE_NUMBER (0x892d) — counting this
  // release — then point the enemy-actor record at its launch animation: waves 3 and up use the
  // alternate script ANIM_PARAM_76DD (0x76dd), earlier ones ANIM_PARAM_76D4 (0x76d4).
  mem8[WAVE_NUMBER] = mem8[WAVE_NUMBER] + 1; // wraps at 256 (byte store truncates to 8 bits)
  const nextWave = mem8[WAVE_NUMBER];
  setActorAnimation(m, ix, nextWave >= 0x03 ? ANIM_PARAM_76DD : ANIM_PARAM_76D4);

  // Pace the paired record: its frame-delay field (+0x11) is set to four times the new wave number,
  // so later waves hold each frame longer.
  mem8[iy + 0x11] = nextWave << 2; // hold field = wave * 4 (byte store truncates to 8 bits)

  // A wolf has launched. Report false so the driver stops sweeping this pass — exactly one release
  // per elapsed delay.
  return false; // launched -> caller aborts its record sweep (caller-skip)
}
