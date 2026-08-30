// SPDX-License-Identifier: GPL-3.0-only
import { GAME_ACTIVE_FLAG, PLAY_MODE_LATCH, SOUND_RING_WRITE_PTR, SOUND_RING_PENDING_BYTE } from "./names.js";
/**
 * appendSoundCommandGated — the shared tail of every sound emitter: drop one command byte into the
 * sound-command ring buffer, but only while play is live.
 *
 * ROM 0x0ea2-0x0ece. [seen].
 *
 * The sound system is fed through a small ring buffer that lives in the 0x8a00 page. A crowd of thin
 * emitters (queueSoundCommand01/06/0A/0D/0E/0F/11, ...) each load a fixed command byte and funnel
 * through here to enqueue it. The ring is addressed by a one-byte write cursor (SOUND_RING_WRITE_PTR,
 * 0x8a40) that walks the slots 0x43..0x5e and wraps the last slot back to the first; a separate read
 * cursor (not touched here) drains the ring on the consuming side.
 *
 * The append is GATED: sound is only enqueued while a game is actually running — either the in-play
 * gate GAME_ACTIVE_FLAG (0x8806) is set, or the play-state latch PLAY_MODE_LATCH (0x8f50) is nonzero.
 * With both clear (attract / between lives) the byte is dropped and nothing is enqueued. The incoming
 * byte is stashed at SOUND_RING_PENDING_BYTE (0x8d20) before the gate is tested, so it survives the
 * decision and is re-read on the append path.
 *
 * A leaf: it writes only the pending-byte cell, one ring slot, and the write cursor, and calls nothing.
 *
 * LIVE-OUT: A = the advanced cursor (left in A on exit — the AF pair is not restored across the call,
 * unlike BC/DE/HL — and callers read it); on the gates-closed early return A = 0. Set via return-assignment.
 */

const RING_FIRST = 0x43; // first ring slot (cursor low byte)
const RING_LAST = 0x5e; // last ring slot before wrap
const PAGE_MASK = 0xff << 8; // high-byte mask: derives the ring page base (0x8a00) from the cursor cell address

export function appendSoundCommandGated(m, a = m.regs.a) {
  const { mem8 } = m;

  // Stash the incoming command byte first, so it survives the gate test below and can be re-read on
  // the append path regardless of which branch we take.
  mem8[SOUND_RING_PENDING_BYTE] = a;

  // Gate: enqueue only while play is live — the in-play flag set OR the play-state latch nonzero.
  // With both clear (attract, or between lives) drop the byte and return with A = 0.
  if (mem8[GAME_ACTIVE_FLAG] === 0 && mem8[PLAY_MODE_LATCH] === 0) return (m.regs.a = 0);

  // Write the stashed byte into the ring slot the cursor points at. The cursor holds only the low
  // byte; the ring page base (0x8a00) is recovered from the cursor CELL's own high byte via PAGE_MASK.
  const byte = mem8[SOUND_RING_PENDING_BYTE];
  const cursor = mem8[SOUND_RING_WRITE_PTR];
  mem8[(SOUND_RING_WRITE_PTR & PAGE_MASK) + cursor] = byte;

  // Advance the cursor one slot, wrapping the last slot (0x5e) back to the first (0x43), and store
  // it back for the next append. The advanced cursor is also the value handed back to the caller.
  const next = cursor === RING_LAST ? RING_FIRST : (cursor + 1) & 0xff;
  mem8[SOUND_RING_WRITE_PTR] = next;
  return (m.regs.a = next); // A live-out: the advanced cursor
}
