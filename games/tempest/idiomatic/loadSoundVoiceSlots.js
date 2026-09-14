// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_31, loc_32, SOUND_SLOT_SENTINEL, SOUND_VOICE_VALUE, SOUND_FAST_TIMER, SOUND_SLOW_TIMER, SOUND_VOICE_TABLE } from "./names.js";

/**
 * loadSoundVoiceSlots — register a sound effect across the voice-slot bank. ROM 0xccc7.
 *
 * Role in the machine: Tempest's sound engine holds a bank of 16 voice slots, each able to
 * play one value with a fast and a slow timer. A sound is described as a row of bytes in the
 * voice table ($cb01); to start a sound the engine walks that row and, for every nonzero
 * byte, claims a slot and loads the byte plus its two timers. Zero bytes are gaps -- slots
 * that sound leaves untouched -- so a single sound can light up any subset of the 16 voices.
 *
 * Behavior: first stash the caller's X/Y into $31/$32 (scratch preserved for the caller).
 * The sound id arrives in a; walk slots 0x0f..0 descending, decrementing the table id in
 * lockstep so each slot reads its own table byte at $cb01+id. A zero byte means skip. A
 * nonzero byte claims the slot: write the slot number into the sentinel cell $bf (a
 * "busy/claiming" marker), store the byte to the voice-value array $c0,slot, set the fast
 * ($e0,slot) and slow ($f0,slot) timer flags to 1, then restore the 0xff idle sentinel to
 * $bf. Loops until all 16 slots are visited.
 *
 * Live-out: for each claimed slot, SOUND_VOICE_VALUE/$c0, SOUND_FAST_TIMER/$e0 and
 * SOUND_SLOW_TIMER/$f0; the sentinel $bf back at 0xff; scratch $31/$32 hold the saved X/Y.
 * Grounding: [seen].
 */
export function loadSoundVoiceSlots(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_31] = x;                          // stash caller X/Y so this routine can reuse them
  mem8[loc_32] = y;
  let id = a & 0xff;                         // sound id -> starting index into the voice table row
  for (let slot = 0x0f; slot >= 0; slot--, id = u8(id - 1)) {
    const b = mem8[u16(SOUND_VOICE_TABLE + id)];  // this slot's table byte
    if (b === 0) continue;                   // zero = gap, leave the slot alone
    mem8[SOUND_SLOT_SENTINEL] = slot;        // mark the slot being claimed
    mem8[u8(SOUND_VOICE_VALUE + slot)] = b;  // load the voice value
    mem8[u8(SOUND_FAST_TIMER + slot)] = 0x01;  // arm fast timer
    mem8[u8(SOUND_SLOW_TIMER + slot)] = 0x01;  // arm slow timer
    mem8[SOUND_SLOT_SENTINEL] = 0xff;        // restore idle sentinel
  }
}
