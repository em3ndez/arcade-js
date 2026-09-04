// SPDX-License-Identifier: GPL-3.0-only
import { FLEET_SOUND_STEP, FLEET_SOUND_PERIOD, SFX_OFF_TIMER, FLEET_RATE_THRESHOLDS, FLEET_RATE_TABLE, SOUND_PORT5_SHADOW, ALIEN_COUNT } from "./names.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

// On the trigger, pick a fleet-rate byte for the alien count and step the port-5 pitch nibble; tick the
// SFX-off timer and mask its port-5 bit off on wrap.
export function advanceFleetMarchSound(m) {
  if (m.mem8[FLEET_SOUND_STEP] !== 0) {
    const alive = m.mem8[ALIEN_COUNT];
    let i = 0;
    while (alive < m.mem8[FLEET_RATE_THRESHOLDS + i]) i++;
    m.mem8[FLEET_SOUND_PERIOD] = m.mem8[FLEET_RATE_TABLE + i];
    const shadow = m.mem8[SOUND_PORT5_SHADOW];
    const stepped = (shadow & 0x0f) << 1;
    m.mem8[SOUND_PORT5_SHADOW] = (shadow & 0x30) | (stepped === 0x10 ? 0x01 : stepped);
    m.mem8[FLEET_SOUND_STEP] = 0;
  }
  m.mem8[SFX_OFF_TIMER] = m.mem8[SFX_OFF_TIMER] - 1;
  if (m.mem8[SFX_OFF_TIMER] !== 0) return (m.regs.a = 0);
  return clearSoundPort3Bit(m, 0xef);
}
