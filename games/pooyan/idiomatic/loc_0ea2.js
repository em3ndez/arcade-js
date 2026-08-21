// SPDX-License-Identifier: GPL-3.0-only
import { GAME_ACTIVE_FLAG, PLAY_MODE_LATCH, SOUND_RING_WRITE_PTR, TEXT_RING_PENDING_BYTE } from "./names.js";
/**
 * loc_0ea2 — append one byte into the command ring (page 0x8a).
 *
 * The incoming byte is stashed first, then the append runs only while a game is active
 * or the play-mode latch is set. On append it writes the byte into the ring page at the
 * current cursor, then steps the cursor one slot, wrapping the last slot to the first.
 *
 * LIVE-OUT: A = the advanced cursor (left in A on exit — the AF pair is not restored across the call,
 * unlike BC/DE/HL — and callers read it); on the gates-closed early return A = 0. Set via return-assignment.
 */

const RING_FIRST = 0x43; // first ring slot (cursor low byte)
const RING_LAST = 0x5e; // last ring slot before wrap
const PAGE_MASK = 0xff << 8; // high-byte mask: selects the ring page base from the cursor cell

export function loc_0ea2(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[TEXT_RING_PENDING_BYTE] = a;
  // Both gates closed -> exits with A reloaded from PLAY_MODE_LATCH (0 on this path).
  if (mem8[GAME_ACTIVE_FLAG] === 0 && mem8[PLAY_MODE_LATCH] === 0) return (m.regs.a = 0);

  const byte = mem8[TEXT_RING_PENDING_BYTE];
  const cursor = mem8[SOUND_RING_WRITE_PTR];
  mem8[(SOUND_RING_WRITE_PTR & PAGE_MASK) + cursor] = byte;
  const next = cursor === RING_LAST ? RING_FIRST : (cursor + 1) & 0xff;
  mem8[SOUND_RING_WRITE_PTR] = next;
  return (m.regs.a = next); // A live-out: the advanced cursor
}
