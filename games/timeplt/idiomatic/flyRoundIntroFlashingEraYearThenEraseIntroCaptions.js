// SPDX-License-Identifier: GPL-3.0-only
/** flyRoundIntroFlashingEraYearThenEraseIntroCaptions — one frame of a sequence sub-step that flies the ship over the scenery on a timer.
 * It first folds a 256-byte program-image block into SEQUENCE_PHASE (a subtract-fold, then a fixed
 * xor, which nets out on a genuine image), then runs the player frame and the scenery between the
 * sprite fixup passes and closes with the full multiplex pass. On odd frames SEQUENCE_DELAY counts
 * down; when it expires three commands are posted, ROUND_ARMED is cleared, the delay is re-armed and
 * the sub-step advances. Otherwise, while ROUND_ARMED holds, the frame tick's low nibble picks one of
 * three commands (or none), posted with an argument keyed on the era.
 * LIVE-OUT: memory. The one continuation reloads every register it reads. */

import { u8 } from "../../../core/int.js";
import { multiplexSpriteSlotsSkipping } from "./multiplexSpriteSlotsSkipping.js";
import { dispatchPlayerFrameByState } from "./dispatchPlayerFrameByState.js";
import { runSceneryForEra } from "./runSceneryForEra.js";
import { multiplexSpriteSlots } from "./multiplexSpriteSlots.js";
import { postCommand } from "./postCommand.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { ERA_INDEX, FRAME_TICK, ROUND_ARMED, SEQUENCE_DELAY, SEQUENCE_PHASE, loc_4d9f } from "./names.js";

const FOLD_BYTES = 256;
const FOLD_KEY = 0xa2;

const EXPIRY_COMMAND = 0x03;
const EXPIRY_ARGUMENTS = [0x09, 0x0e, 0x1a];
const DELAY_REARM = 0x2a;

const ERA_ARGUMENT_BASE = 0x1a;
// Frame-tick low nibble -> command posted while the round is armed; any other nibble posts nothing.
const TICK_COMMANDS = new Map([[0x00, 0x02], [0x05, 0x0a], [0x0a, 0x0b]]);

/** The fixup pass returns through a stack word, so one is supplied as a real call would; the
 *  seat is restored by that return, so the value is a filler. */
function spriteFixup(m) {
  m.push16(0);
  multiplexSpriteSlotsSkipping(m);
}

export function flyRoundIntroFlashingEraYearThenEraseIntroCaptions(m) {
  const { mem8 } = m;

  let fold = mem8[SEQUENCE_PHASE];
  for (let i = 0; i < FOLD_BYTES; i++) fold = u8(fold - mem8[loc_4d9f + i]);
  mem8[SEQUENCE_PHASE] = fold ^ FOLD_KEY;

  spriteFixup(m);
  dispatchPlayerFrameByState(m);
  spriteFixup(m);
  runSceneryForEra(m);
  multiplexSpriteSlots(m);

  const tick = mem8[FRAME_TICK];
  if (tick & 1) {
    const delay = u8(mem8[SEQUENCE_DELAY] - 1);
    mem8[SEQUENCE_DELAY] = delay;
    if (delay === 0) {
      for (const argument of EXPIRY_ARGUMENTS) postCommand(m, EXPIRY_COMMAND, argument);
      mem8[ROUND_ARMED] = 0;
      mem8[SEQUENCE_DELAY] = DELAY_REARM;
      return advanceSequenceSubStep(m);
    }
  }

  if (mem8[ROUND_ARMED] === 0) return;
  const command = TICK_COMMANDS.get(tick & 0x0f);
  if (command === undefined) return;
  postCommand(m, command, u8(mem8[ERA_INDEX] + ERA_ARGUMENT_BASE));
}
