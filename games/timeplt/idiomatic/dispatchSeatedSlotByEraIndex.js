// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSeatedSlotByEraIndex — run the per-slot handler the low three bits of the era index select out of a word
 * table laid down inline just behind this entry, on the object record the caller seated. Each case is
 * the slot's literal target, called directly with that record, and nothing here runs after it. Three
 * bits admit eight slots: the first five are the five eras' slot services; the sixth and seventh hold
 * words that address no program at all, so reaching one is a fault and it is raised, not assumed
 * away; the eighth holds the word of the intro-animation step, and that is what it runs. The seated
 * record is the one value handed on, so each handler is entered directly, with no table word carried
 * in on a register pair. LIVE-OUT: memory, and the handler's. */

import { NotImplemented } from "../../../boards/timeplt/io.js";
import { ERA_INDEX } from "./names.js";
import { serviceEra0EnemyCraftSlot } from "./serviceEra0EnemyCraftSlot.js";
import { serviceEra1EnemyCraftSlot } from "./serviceEra1EnemyCraftSlot.js";
import { serviceEra2EnemyCraftSlot } from "./serviceEra2EnemyCraftSlot.js";
import { serviceEra3EnemyCraftSlot } from "./serviceEra3EnemyCraftSlot.js";
import { serviceEra4EnemyCraftSlot } from "./serviceEra4EnemyCraftSlot.js";
import { stepRoundStartIntroAnimation } from "./stepRoundStartIntroAnimation.js";

const ARM_MASK = 0x07;

export function dispatchSeatedSlotByEraIndex(m, record = m.regs.ix) {
  const slot = m.mem8[ERA_INDEX] & ARM_MASK;
  switch (slot) {
    case 0: return serviceEra0EnemyCraftSlot(m, record);
    case 1: return serviceEra1EnemyCraftSlot(m, record);
    case 2: return serviceEra2EnemyCraftSlot(m, record);
    case 3: return serviceEra3EnemyCraftSlot(m, record);
    case 4: return serviceEra4EnemyCraftSlot(m, record);
    case 7: return stepRoundStartIntroAnimation(m);
    // The two remaining words point past the program image into unmapped space, where the inline
    // dispatch would jump and fault; surface the same fault here.
    default:
      throw new NotImplemented(`dispatchSeatedSlotByEraIndex: era slot ${slot} addresses no transcribed routine`);
  }
}
