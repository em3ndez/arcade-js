// SPDX-License-Identifier: GPL-3.0-only
/** sendOldestQueuedSoundCommand — send the byte at the head of the pending-sound queue, then close the gap it left.
 * A count cell says how many bytes are waiting and the bytes follow it; a count of zero is left
 * untouched and nothing goes out. Otherwise the count comes down by one, the head byte is sent,
 * and every byte still waiting slides one place down so the head slot always holds the next one.
 * The send happens whether or not anything is left to slide, so emptying the queue costs no
 * slide. Nothing bounds the count, so a large one slides bytes from past the queue's own cells.
 * LIVE-OUT: the count and the bytes behind it, plus whatever the send leaves on the hardware.
 *
 * ROM 0x55D4-0x55EC (frozen lift translated/loc_55d4.js). Grounding: [seen] (names.js ROUTINES
 * 0x55d4). Role in the machine: the drain end of the low-level sound FIFO (distinct from the
 * high-level command ring). appendSoundCommandToQueue adds bytes at the TAIL — 0xAC43 plus the
 * bumped count — while this takes the HEAD at 0xAC44, so the byte sent is the one that has
 * waited longest (names.js). The byte then reaches the sound board's second Z80 through
 * sendSoundCommand.
 */

import { u8, u16 } from "../../../core/int.js";
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SOUND_QUEUE_COUNT, SOUND_QUEUE_HEAD } from "./names.js";


export function sendOldestQueuedSoundCommand(m) {
  const { mem8 } = m;
  /* Empty queue: `ld hl,0xac43 / ld a,(hl) / and a / ret z` — SOUND_QUEUE_COUNT [seen] at 0
   * means nothing is waiting, and nothing is written. */
  const pending = mem8[SOUND_QUEUE_COUNT];
  if (pending === 0) return;

  /* Take one. `dec (hl)` lowers the count, and `inc hl / ld a,(hl) / call 0x55f8` sends the byte
   * at SOUND_QUEUE_HEAD [seen]. sendSoundCommand [seen] writes it into the sound-data latch the
   * audio processor reads and pulses that processor's attention line. The ROM saves the flags of
   * the `dec` across the call (`push af` / `pop af`) so it can test afterwards whether that was
   * the last byte; `ret z` returns without a slide when nothing is left. */
  const remaining = u8(pending - 1);
  mem8[SOUND_QUEUE_COUNT] = remaining;
  sendSoundCommand(m, mem8[SOUND_QUEUE_HEAD]);
  if (remaining === 0) return;

  /* Close the gap: the ROM's `ldir` with BC = remaining, DE = the head slot and HL = the slot
   * after it copies each waiting byte one place toward the head, lowest address first, so the
   * next byte to send is always at 0xAC44. The count is not checked against the queue's size. */
  for (let slot = 0; slot < remaining; slot++) {
    mem8[u16(SOUND_QUEUE_HEAD + slot)] = mem8[u16(SOUND_QUEUE_HEAD + slot + 1)];
  }
}
