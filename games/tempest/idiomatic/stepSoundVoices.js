// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SOUND_SLOT_SENTINEL, SOUND_VOICE_VALUE, SOUND_VOICE_LEVEL, SOUND_FAST_TIMER, SOUND_SLOW_TIMER,
  VOICE_ENV_FRAME_A, VOICE_ENV_FASTTIMER, VOICE_ENV_LEVEL, VOICE_ENV_FRAME_B,
  VOICE_ENV_FRAME_A_HI, VOICE_ENV_FASTTIMER_HI, VOICE_ENV_LEVEL_HI, VOICE_ENV_FRAME_B_HI,
  POKEY1_AUDF1, POKEY1_AUDCTL,
} from "./names.js";

// Advance each of 16 per-slot timers: count down two timers, and when both expire step
// the slot through an animation table (single step, or a walk until a nonzero frame),
// then publish the slot's level to a POKEY register chosen by which half the slot is in.
export function stepSoundVoices(m) {
  const { mem8 } = m;
  for (let x = 0x0f; x >= 0; x--) {
    let a = mem8[u8(SOUND_VOICE_VALUE + x)];
    if (a === 0) continue;                 // slot idle
    if (x === mem8[SOUND_SLOT_SENTINEL]) continue;      // slot is the reserved one
    const eDec = u8(mem8[u8(SOUND_FAST_TIMER + x)] - 1);
    mem8[u8(SOUND_FAST_TIMER + x)] = eDec;
    if (eDec !== 0) continue;              // fast timer still running
    const fDec = u8(mem8[u8(SOUND_SLOW_TIMER + x)] - 1);
    mem8[u8(SOUND_SLOW_TIMER + x)] = fDec;
    let y;
    if (fDec !== 0) {
      // Fast timer expired, slow timer running: one table step.
      const carry = (a & 0x80) !== 0;
      y = u8(a << 1);
      if (carry) {
        mem8[u8(SOUND_FAST_TIMER + x)] = mem8[u16(VOICE_ENV_FASTTIMER_HI + y)];
        a = mem8[u16(VOICE_ENV_LEVEL_HI + y)];
      } else {
        mem8[u8(SOUND_FAST_TIMER + x)] = mem8[u16(VOICE_ENV_FASTTIMER + y)];
        a = mem8[u16(VOICE_ENV_LEVEL + y)];
      }
      const prevD = mem8[u8(SOUND_VOICE_LEVEL + x)];
      a = u8(a + prevD);
      mem8[u8(SOUND_VOICE_LEVEL + x)] = a;
      // Odd slots keep the prior high nibble of the level byte.
      if ((x & 1) !== 0) {
        const d = mem8[u8(SOUND_VOICE_LEVEL + x)];
        mem8[u8(SOUND_VOICE_LEVEL + x)] = ((((prevD ^ d) & 0xf0) ^ d));
      }
    } else {
      // Both timers expired: walk the table until a nonzero frame lands.
      while (true) {
        mem8[u8(SOUND_VOICE_VALUE + x)] = u8(mem8[u8(SOUND_VOICE_VALUE + x)] + 1);
        mem8[u8(SOUND_VOICE_VALUE + x)] = u8(mem8[u8(SOUND_VOICE_VALUE + x)] + 1);
        a = mem8[u8(SOUND_VOICE_VALUE + x)];
        const carry = (a & 0x80) !== 0;
        y = u8(a << 1);
        if (carry) {
          mem8[u8(SOUND_VOICE_LEVEL + x)] = mem8[u16(VOICE_ENV_FRAME_A_HI + y)];
          mem8[u8(SOUND_SLOW_TIMER + x)] = mem8[u16(VOICE_ENV_FRAME_B_HI + y)];
          a = mem8[u16(VOICE_ENV_FASTTIMER_HI + y)];
        } else {
          mem8[u8(SOUND_VOICE_LEVEL + x)] = mem8[u16(VOICE_ENV_FRAME_A + y)];
          mem8[u8(SOUND_SLOW_TIMER + x)] = mem8[u16(VOICE_ENV_FRAME_B + y)];
          a = mem8[u16(VOICE_ENV_FASTTIMER + y)];
        }
        mem8[u8(SOUND_FAST_TIMER + x)] = a;
        if (a !== 0) break;
        mem8[u8(SOUND_VOICE_VALUE + x)] = a;
        a = mem8[u8(SOUND_VOICE_LEVEL + x)];
        if (a === 0) break;
        mem8[u8(SOUND_VOICE_VALUE + x)] = a;
      }
    }
    // Publish this slot's level byte to its POKEY register.
    a = mem8[u8(SOUND_VOICE_LEVEL + x)];
    if (x < 0x08) mem8[u16(POKEY1_AUDF1 + x)] = a;
    else mem8[u16(POKEY1_AUDCTL + x)] = a;
  }
}
