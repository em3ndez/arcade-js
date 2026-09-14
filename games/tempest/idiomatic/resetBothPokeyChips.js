// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SOUND_VOICE_VALUE, SOUND_VOICE_LEVEL, loc_720,
  POKEY1_AUDF1, POKEY1_AUDCTL, POKEY1_RANDOM, POKEY1_SKCTL,
  POKEY2_AUDF1, POKEY2_AUDCTL, POKEY2_RANDOM, POKEY2_SKCTL,
} from "./names.js";

// Clear two control cells and a flag, sample two counters across five polls and latch
// the flag with the first sample when either counter changes, then set the controls
// to 7 and zero the paired 8-entry arrays.
export function resetBothPokeyChips(m) {
  const { mem8 } = m;
  mem8[POKEY1_SKCTL] = 0;
  mem8[POKEY2_SKCTL] = 0;
  mem8[loc_720] = 0;

  const a = mem8[POKEY1_RANDOM];
  const y = mem8[POKEY2_RANDOM];
  for (let x = 4; x >= 0; x--) {
    if (a !== mem8[POKEY1_RANDOM] || y !== mem8[POKEY2_RANDOM]) {
      mem8[loc_720] = a;
      break;
    }
  }

  mem8[POKEY1_SKCTL] = 7;
  mem8[POKEY2_SKCTL] = 7;
  for (let x = 7; x >= 0; x--) {
    mem8[u16(POKEY1_AUDF1 + x)] = 0;
    mem8[u16(POKEY2_AUDF1 + x)] = 0;
    mem8[u8(SOUND_VOICE_VALUE + x)] = 0;
    mem8[u8(SOUND_VOICE_LEVEL + x)] = 0;
  }
  mem8[POKEY1_AUDCTL] = 0;
  mem8[POKEY2_AUDCTL] = 0;
}
