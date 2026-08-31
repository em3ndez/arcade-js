// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { advanceTileAnimForwardOnOdd } from "./advanceTileAnimForwardOnOdd.js";
import { tickStatusRenderRingAndRedrawOnWrap } from "./tickStatusRenderRingAndRedrawOnWrap.js";
import { seedFourRecordsAndCopyDisplayTiles } from "./seedFourRecordsAndCopyDisplayTiles.js";
import { clearActorArenaAndCounters } from "./clearActorArenaAndCounters.js";
import { tickFormationSpawnAndScanSlots } from "./tickFormationSpawnAndScanSlots.js";
import { queueRoundVariantSoundRun } from "./queueRoundVariantSoundRun.js";
import {
  TILE_ANIM_CURSOR,
  SHAPE_TABLE_2D59,
  FIELD_ATTRIB_SRC_C,
  FIELD_ATTRIB_REF_2980,
} from "./names.js";
/**
 * advanceLeadActorDescentToLanding — ROM 0x2901.
 *
 * WHAT IT IS
 * The state-0 handler of the lead actor's per-frame state machine. Every actor in the game owns a
 * 0x18-byte record in the actor arena; the lead actor is slot 0 (the record based at IX). Byte +0x02
 * of that record is the actor's position in its own state machine, and a jump table hands each frame
 * to the handler for the current state. This is the handler for state 0: the "descending, not yet
 * landed" phase. It runs once per frame while the lead actor is falling, nudging it one step lower,
 * and — when it finally touches the floor — swaps in the landing shape, kicks the actor to its next
 * state, and hands the frame off to the round-select follow-up.
 *
 * ROLE IN THE MACHINE
 * While the actor is still above the floor line, the handler drives the vertical drop and keeps the
 * on-screen animation ticking. On the frame the actor reaches the floor it performs the one-time
 * landing transition: load the landing shape into the record, advance the state index so this
 * handler never runs again for this descent, and clean up the record's scratch counters. Bolted onto
 * that landing frame are two program-image integrity self-checks over a fixed source block in the
 * program ROM (part of this ROM's anti-tamper lattice): each check, on failure, diverts the frame
 * into a different fallback handler instead of the normal completion, so a corrupted image quietly
 * takes a different code path rather than proceeding cleanly.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none in registers — every effect is written into the lead actor's record and into shared
 * RAM (the shape bytes, the bumped state index, the cleared counters). The state machine reads the
 * record back on the next frame; nothing is handed back to the caller in a register.
 */

const FLOOR_Y = 0xdc;     // base-Y value at/after which the actor is considered landed
const SCRIPT_HOLD = 0xf9; // sentinel in the tile-anim cursor that freezes script advance for this frame
const CHECK_LEN = 0x20;   // 32 bytes covered by each integrity pass
const CHECK_SUM = 0x63;   // expected 8-bit sum of the field-attribute source block

export function advanceLeadActorDescentToLanding(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Re-arm the frame-delay/hold byte (record +0x11) that the lead-actor handlers use to pace their
  // transitions, then step the actor's Y coordinate (record +0x04) one pixel further down. This
  // single increment per frame is the descent.
  mem8[rec + 0x11] = 0x01; // reset the frame hold
  mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // advance the base Y downward

  // Still airborne: the new Y has not yet reached the floor line (0xdc). Keep the sprite drawn at
  // its new height and keep its animation running, then leave — the landing transition below is skipped.
  if (mem8[rec + 0x04] < FLOOR_Y) {
    // The lead actor is drawn as three stacked sprite rows derived from the single base-Y at +0x04;
    // recompute those three row coordinates so the sprite follows the descent this frame.
    deriveStackedSpriteYs(m); // refresh the three derived sprite Ys
    // The shared tile-animation cursor (0x88be) carries a hold sentinel (0xf9) some frames; while it
    // is held, the animation script does not advance and the handler returns without a render tail.
    if (mem8[TILE_ANIM_CURSOR] === SCRIPT_HOLD) return; // script held
    // Otherwise step the actor's tile/attribute animation script forward (it only actually advances
    // on odd parity ticks), then tail into the shared render phase tick that drives the mod-8 /
    // mod-4 render ring and repaints on wrap.
    advanceTileAnimForwardOnOdd(m); // advance the script pointer
    return tickStatusRenderRingAndRedrawOnWrap(m); // phase render tail
  }

  // reached the floor: load the landing shape, then reseed the record
  // Copy the landing shape/display-tile set from ROM table 0x2d59 into the four actor records so the
  // lead actor is drawn in its landed pose.
  seedFourRecordsAndCopyDisplayTiles(m, SHAPE_TABLE_2D59, rec);
  // Reseat the frame-delay byte (+0x11) to 0x0c so the next state gets a full delay window.
  mem8[rec + 0x11] = 0x0c;
  // Advance the state index (+0x02): the state machine moves off state 0, so this descent handler
  // will not be selected again for this actor.
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance the actor state
  // Back the landed Y (+0x04) off by 3 pixels to seat the actor exactly on the floor line.
  mem8[rec + 0x04] = mem8[rec + 0x04] - 0x03;
  // Clear two secondary per-record scratch counters (+0x1c, +0x1e) so the next state starts clean.
  mem8[rec + 0x1c] = 0;
  mem8[rec + 0x1e] = 0;

  // integrity pass A: the source block's 8-bit sum must match
  // Sum 0x20 bytes of the field-attribute source block at 0x0859 into an 8-bit accumulator. In an
  // untampered program image this totals exactly 0x63; any other total means the ROM has been
  // altered, and the frame is diverted into the arena-teardown handler (which zero-fills the actor
  // arena and resets the spawn/wave counters) instead of completing normally.
  let sum = 0;
  for (let i = 0; i < CHECK_LEN; i++) sum = u8(sum + mem8[FIELD_ATTRIB_SRC_C + i]);
  if (sum !== CHECK_SUM) return clearActorArenaAndCounters(m);

  // integrity pass B: the second half must match the reversed reference block
  // Compare the next 0x20 bytes of the source block (0x0859+0x20 onward) against the reference block
  // ending at 0x2980, read backwards byte-for-byte. A single mismatch is another tamper signature,
  // and the frame is diverted into the formation-spawn tick instead of completing.
  for (let i = 0; i < CHECK_LEN; i++) {
    if (mem8[FIELD_ATTRIB_REF_2980 - 1 - i] !== mem8[FIELD_ATTRIB_SRC_C + CHECK_LEN + i]) {
      return tickFormationSpawnAndScanSlots(m);
    }
  }

  // Both integrity passes clean: run the normal completion, which picks one of four sound-command
  // bytes from the round counter and appends that sound run to the command ring.
  queueRoundVariantSoundRun(m); // emit the round-select tile run
}
