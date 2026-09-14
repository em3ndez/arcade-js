// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SOUND_SLOT_SENTINEL, SOUND_VOICE_VALUE, SOUND_VOICE_LEVEL, SOUND_FAST_TIMER, SOUND_SLOW_TIMER,
  VOICE_ENV_FRAME_A, VOICE_ENV_FASTTIMER, VOICE_ENV_LEVEL, VOICE_ENV_FRAME_B,
  VOICE_ENV_FRAME_A_HI, VOICE_ENV_FASTTIMER_HI, VOICE_ENV_LEVEL_HI, VOICE_ENV_FRAME_B_HI,
  POKEY1_AUDF1, POKEY1_AUDCTL,
} from "./names.js";

/**
 * stepSoundVoices — the per-frame Tempest sound engine. ROM 0xcd0a.
 *
 * Role in the machine: Tempest builds every sound effect as an envelope that steps through a small
 * animation table over time. This routine is the driver, run once per frame: it walks the 16 sound
 * slots, ages each active slot's two timers, and when a slot's timers expire it advances that slot's
 * envelope one frame (or several, walking the table to the next real frame) and writes the resulting
 * level out to a POKEY audio register. The POKEY chips are the actual sound hardware; the value written
 * to a slot's register is the current amplitude/frequency the chip will play.
 *
 * Behavior: for each slot x from 0x0f down to 0, skip it when the envelope pointer SOUND_VOICE_VALUE,x
 * is 0 (idle) or when x is the reserved slot SOUND_SLOT_SENTINEL. Otherwise decrement the fast timer
 * SOUND_FAST_TIMER,x; while it is still running, do nothing more this frame. When it hits zero, also
 * decrement the slow timer SOUND_SLOW_TIMER,x. Two outcomes:
 *   - slow timer still running -> take ONE table step: shift the envelope byte (its top bit selects the
 *     hi/lo table half), reload the fast timer and a level increment from that table entry, add the
 *     increment into the running level SOUND_VOICE_LEVEL,x (odd slots preserve the prior high nibble).
 *   - both timers expired -> WALK the envelope: bump the pointer by two repeatedly, loading frame /
 *     slow-timer / fast-timer bytes from the table each step, until a nonzero fast-timer frame lands
 *     (or the walk falls through its zero terminators), settling on the next real animation frame.
 * Finally publish the slot's level SOUND_VOICE_LEVEL,x to its POKEY register: slots < 8 to the first
 * chip (POKEY1_AUDF1 + x), the upper slots to the second bank (POKEY1_AUDCTL + x).
 *
 * Live-out: the two per-slot timers, the envelope pointer and level for each stepped slot, and the
 * POKEY audio registers that voice them. Grounding: [seen].
 */
export function stepSoundVoices(m) {
  const { mem8 } = m;
  for (let x = 0x0f; x >= 0; x--) {
    let a = mem8[u8(SOUND_VOICE_VALUE + x)];
    if (a === 0) continue;                 // slot idle
    if (x === mem8[SOUND_SLOT_SENTINEL]) continue;      // slot is the reserved one
    const eDec = u8(mem8[u8(SOUND_FAST_TIMER + x)] - 1); // age the fast timer
    mem8[u8(SOUND_FAST_TIMER + x)] = eDec;
    if (eDec !== 0) continue;              // fast timer still running
    const fDec = u8(mem8[u8(SOUND_SLOW_TIMER + x)] - 1); // fast expired -> age the slow timer too
    mem8[u8(SOUND_SLOW_TIMER + x)] = fDec;
    let y;
    if (fDec !== 0) {
      // Fast timer expired, slow timer running: one table step.
      const carry = (a & 0x80) !== 0;      // top bit of the pointer selects the hi table half
      y = u8(a << 1);                       // table index (word-stride entries)
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
