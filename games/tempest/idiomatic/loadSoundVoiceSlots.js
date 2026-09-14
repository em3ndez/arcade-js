// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_31, loc_32, SOUND_SLOT_SENTINEL, SOUND_VOICE_VALUE, SOUND_FAST_TIMER, SOUND_SLOW_TIMER, SOUND_VOICE_TABLE } from "./names.js";

// Register a sound: for each of 16 slots read the sound's next table byte; a nonzero
// byte claims that slot, stamping its value and two live flags. Preserves caller X/Y.
export function loadSoundVoiceSlots(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_31] = x;
  mem8[loc_32] = y;
  let id = a & 0xff;
  for (let slot = 0x0f; slot >= 0; slot--, id = u8(id - 1)) {
    const b = mem8[u16(SOUND_VOICE_TABLE + id)];
    if (b === 0) continue;
    mem8[SOUND_SLOT_SENTINEL] = slot;
    mem8[u8(SOUND_VOICE_VALUE + slot)] = b;
    mem8[u8(SOUND_FAST_TIMER + slot)] = 0x01;
    mem8[u8(SOUND_SLOW_TIMER + slot)] = 0x01;
    mem8[SOUND_SLOT_SENTINEL] = 0xff;
  }
}
