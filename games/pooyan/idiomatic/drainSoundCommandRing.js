// SPDX-License-Identifier: GPL-3.0-only
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SOUND_RING_READ_PTR, HIGH_SCORE_TABLE, DEMO_SOUNDS_DSW, GAME_ACTIVE_FLAG } from "./names.js";
/**
 * drainSoundCommandRing — drain one entry from the sound-command ring buffer. Reads the head slot and
 * returns when it is empty; otherwise the queued byte is dispatched to the audio CPU when
 * demo sounds are enabled (bit 0) or a game is active (silent only when both are clear).
 * The slot is then freed and the head index advanced, wrapping the last slot to the first.
 *
 * LIVE-OUT: memory only (freed slot + advanced head index); callers drop the registers.
 */

const RING_HEAD_LAST = 0x5e; //  last slot index; the head wraps back to the first
const RING_HEAD_FIRST = 0x43;
const SLOT_EMPTY = 0xff; //      empty-slot marker (also written to free a slot)
const DEMO_SOUNDS_BIT = 0x01; // bit 0 of DEMO_SOUNDS_DSW enables attract-mode sound

export function drainSoundCommandRing(m) {
  const { mem8 } = m;

  const head = mem8[SOUND_RING_READ_PTR];
  const slot = HIGH_SCORE_TABLE + head;
  const entry = mem8[slot];
  if (entry === SLOT_EMPTY) return; // nothing queued

  const silent = (mem8[DEMO_SOUNDS_DSW] & DEMO_SOUNDS_BIT) === 0 && mem8[GAME_ACTIVE_FLAG] === 0;
  if (!silent) sendSoundCommand(m, entry); // hand the byte to the audio CPU

  mem8[slot] = SLOT_EMPTY; // free the consumed slot
  mem8[SOUND_RING_READ_PTR] = head === RING_HEAD_LAST ? RING_HEAD_FIRST : head + 1;
}
