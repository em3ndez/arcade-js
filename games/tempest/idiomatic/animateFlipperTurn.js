// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_PHASE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, ENEMY_SLOT_DIR, FIRE_GATE, ENEMY_DEPTH, PLAYER_SHOT_DEPTH, SCRIPT_BRANCH_FLAG } from "./names.js";
import { lookupRingHeading } from "./lookupRingHeading.js";
import { flipEnemyLaneTowardTarget } from "./flipEnemyLaneTowardTarget.js";

/**
 * animateFlipperTurn -- step one flipper's flip-across-a-lane animation. ROM 0x9d82.
 *
 * Role in the machine: a flipper doesn't slide between tube lanes, it tumbles across the rim
 * one hinge-step at a time. This routine drives that tumble for enemy slot x: it advances the
 * slot's phase counter, and depending on the slot's animation state either re-aims the flipper
 * at its target lane and walks it one coordinate step when the phase lines up, or -- in the
 * settling state -- completes the flip by rotating to the next lane, reseeding the phase,
 * flipping the turn direction, and (when clear to attack) deciding whether to lunge at the
 * player. It is what makes flippers appear to cartwheel around the tube toward the player's rim.
 *
 * Behavior: phase counter -- step ENEMY_PHASE+x down or up by the state byte's bit6
 * (ENEMY_SLOT_FLAGS+x & 0x40), keep the low nibble, force bit7. Then branch on the low 3 bits
 * of the state byte. If state != 4 (not settling): re-derive the target heading with
 * lookupRingHeading of (state ^ 0x40) against ENEMY_SEGMENT+x, and only when it matches the
 * phase drop bit7 of the state byte and reseed -- if bit6 was set, ENEMY_PHASE+x =
 * (ENEMY_SEGMENT+x + 1) & 0x0f; else copy the segment into the phase and step the segment down
 * one lane. If state == 4 (settling) and the phase has reached a step boundary (low 3 bits 0):
 * when phase bit3 is set rotate ENEMY_SEGMENT+x up one lane, clear the state byte's bit7, reseed
 * the phase to 0x20, and toggle bit7 of ENEMY_SLOT_DIR+x (the turn sign). While FIRE_GATE is 0,
 * if the flipper's depth ENEMY_DEPTH+x equals the player's floor PLAYER_SHOT_DEPTH it lunges via
 * flipEnemyLaneTowardTarget; otherwise ENEMY_SLOT_DIR+x is masked down to just its sign bit.
 * Every exit copies the state byte's bit7 into the shared branch flag SCRIPT_BRANCH_FLAG.
 *
 * Live-out: ENEMY_PHASE+x (advanced/reseeded), ENEMY_SEGMENT+x (rotated on settle/step),
 * ENEMY_SLOT_FLAGS+x (bit7 possibly dropped), ENEMY_SLOT_DIR+x (sign toggled/masked),
 * SCRIPT_BRANCH_FLAG (state bit7), and the lane flip queued by flipEnemyLaneTowardTarget.
 *
 * Grounding: [seen].
 */
export function animateFlipperTurn(m, x = m.regs.x) {
  const { mem8 } = m;

  // Phase counter: step one increment by the state's bit6, keep a nibble, force bit7.
  const stepDown = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x40;
  const phase = (stepDown ? mem8[u16(ENEMY_PHASE + x)] - 1 : mem8[u16(ENEMY_PHASE + x)] + 1) & 0xff;
  mem8[u16(ENEMY_PHASE + x)] = (phase & 0x0f) | 0x80;

  if ((mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x07) !== 0x04) {
    // Not settling: re-derive the target direction; act only when it matches the phase.
    const dir = lookupRingHeading(m, mem8[u16(ENEMY_SLOT_FLAGS + x)] ^ 0x40, mem8[u16(ENEMY_SEGMENT + x)]);
    if (dir === mem8[u16(ENEMY_PHASE + x)]) {
      const flag = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x7f; // drop bit7
      mem8[u16(ENEMY_SLOT_FLAGS + x)] = flag;
      if (flag & 0x40) {
        mem8[u16(ENEMY_PHASE + x)] = (mem8[u16(ENEMY_SEGMENT + x)] + 1) & 0x0f;
      } else {
        const coord = mem8[u16(ENEMY_SEGMENT + x)];
        mem8[u16(ENEMY_PHASE + x)] = coord;
        mem8[u16(ENEMY_SEGMENT + x)] = (coord - 1) & 0x0f;
      }
    }
  } else if ((mem8[u16(ENEMY_PHASE + x)] & 0x07) === 0) {
    // Settling and the phase reached a step boundary: rotate, reseed, flip sign.
    if (mem8[u16(ENEMY_PHASE + x)] & 0x08) {
      mem8[u16(ENEMY_SEGMENT + x)] = (mem8[u16(ENEMY_SEGMENT + x)] + 1) & 0x0f;
    }
    mem8[u16(ENEMY_SLOT_FLAGS + x)] &= 0x7f;
    mem8[u16(ENEMY_PHASE + x)] = 0x20;
    mem8[u16(ENEMY_SLOT_DIR + x)] ^= 0x80;
    if (mem8[FIRE_GATE] === 0) {
      if (mem8[u16(ENEMY_DEPTH + x)] === mem8[PLAYER_SHOT_DEPTH]) {
        flipEnemyLaneTowardTarget(m, x);
      } else {
        mem8[u16(ENEMY_SLOT_DIR + x)] &= 0x80; // isolate the sign bit
      }
    }
  }

  mem8[SCRIPT_BRANCH_FLAG] = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80;
}
