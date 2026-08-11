// SPDX-License-Identifier: GPL-3.0-only
/** sendOldestQueuedSoundCommand — send the byte at the head of the pending-sound queue, then close the gap it left.
 * A count cell says how many bytes are waiting and the bytes follow it; a count of zero is left
 * untouched and nothing goes out. Otherwise the count comes down by one, the head byte is sent,
 * and every byte still waiting slides one place down so the head slot always holds the next one.
 * The send happens whether or not anything is left to slide, so emptying the queue costs no
 * slide. Nothing bounds the count, so a large one slides bytes from past the queue's own cells.
 * LIVE-OUT: the count and the bytes behind it, plus whatever the send leaves on the hardware. */

import { u8, u16 } from "../../../core/int.js";
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SOUND_QUEUE_COUNT, SOUND_QUEUE_HEAD } from "./names.js";


export function sendOldestQueuedSoundCommand(m) {
  const { mem8 } = m;
  const pending = mem8[SOUND_QUEUE_COUNT];
  if (pending === 0) return;

  const remaining = u8(pending - 1);
  mem8[SOUND_QUEUE_COUNT] = remaining;
  sendSoundCommand(m, mem8[SOUND_QUEUE_HEAD]);
  if (remaining === 0) return;

  for (let slot = 0; slot < remaining; slot++) {
    mem8[u16(SOUND_QUEUE_HEAD + slot)] = mem8[u16(SOUND_QUEUE_HEAD + slot + 1)];
  }
}
