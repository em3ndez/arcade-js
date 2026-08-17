// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueSoundCommand — the rst 0x18 primitive: push the sound command in A onto the ring, dropping it
 * while not playing (PLAY_FLAG clear), else bumping the head and storing at the new slot. Memory-only.
 */
import { PLAY_FLAG, SOUND_QUEUE_COUNT } from "./names.js";

export function enqueueSoundCommand(m, cmd = m.regs.a) {
  const { mem8 } = m;
  if (mem8[PLAY_FLAG] === 0) return; // not playing: drop the command
  const head = (mem8[SOUND_QUEUE_COUNT] + 1) & 0xff;
  mem8[SOUND_QUEUE_COUNT] = head;
  mem8[SOUND_QUEUE_COUNT + head] = cmd;
}
