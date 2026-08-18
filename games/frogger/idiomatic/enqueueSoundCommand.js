// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueSoundCommand  —  ROM 0x0018 (the `rst 0x18` restart vector)  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The single gate every sound effect passes through. On the Z80 this lives at the `rst 0x18`
 *   restart vector: a one-byte call that appends the command byte held in register A onto the game's
 *   sound-command ring. Nothing is *played* here — the byte is only queued. Later, one command per
 *   in-play frame, the sound CPU is handed the front of the ring and turns it into an actual noise or
 *   tile update.
 *
 * WHERE IT SITS
 *   The producer end of the sound ring, called from all over gameplay: the hop sound (command 0x04),
 *   the fly-eat (0x18), the sprite-spawn one-shot (0x90), the start/arrival jingles, the score-display
 *   tile update (0x07), the lane-scroll-synced edge blit (0xd0), and more. Its consumer is
 *   dequeueSoundCommand (0x07ac), which each in-play frame pops the front command (slot 0x8301) and
 *   hands it to issueSoundCommand (0x0794) — the actual hardware port write. clearSoundQueue (0x07d9)
 *   wipes the whole ring at game start.
 *
 *   The ring itself is a plain FIFO in work RAM: SOUND_QUEUE_COUNT (0x8300) holds the number of
 *   commands pending, and the 47 bytes above it (slots 0x8301..0x832f) hold the queued command bytes,
 *   the i-th queued command living in slot i. This routine writes; dequeue reads slot 1 and shifts the
 *   rest down.
 *
 * LIVE-OUT
 *   Memory only. On the drop path it writes nothing; on the enqueue path it writes exactly two cells —
 *   the count byte and one queue slot. It returns nothing and leaves no register the caller reads.
 */
import { PLAY_FLAG, SOUND_QUEUE_COUNT } from "./names.js";

// The command byte is passed in register A on hardware (rst 0x18 is invoked with A preloaded). The
// idiomatic signature lets a caller pass it explicitly, defaulting to the live A register so translated
// callers behave exactly like the ROM.
export function enqueueSoundCommand(m, cmd = m.regs.a) {
  const { mem8 } = m;

  // ── Drop-when-not-playing gate ───────────────────────────────────────────────────────
  // PLAY_FLAG (0x83fe) is 0 outside a live game (boot, attract, game-over). The ring only accepts
  // commands during play, so a sound requested here is silently discarded — this is why effects
  // queued from attract-mode code make no noise. Note the discard is local to the ring: upstream
  // one-shot latches (e.g. raiseSpriteArmOneShotAndQueueSound) still fire, they just find their
  // command dropped on the floor here.
  if (mem8[PLAY_FLAG] === 0) return;

  // ── Bump the ring's write index ──────────────────────────────────────────────────────
  // Faithful 8-bit increment of the pending count in SOUND_QUEUE_COUNT (0x8300). The `& 0xff` mirrors
  // the Z80 INC's byte wrap; there is no bounds check against the 47-slot ring, matching the ROM — the
  // count is trusted to stay small because dequeue drains one slot every in-play frame. The bumped
  // value serves double duty: it is both the new pending count AND the 1-based slot index of the
  // command we are about to store.
  const newCount = (mem8[SOUND_QUEUE_COUNT] + 1) & 0xff;

  // ── Publish the new count ────────────────────────────────────────────────────────────
  // Write the incremented count back so dequeueSoundCommand sees one more command pending.
  mem8[SOUND_QUEUE_COUNT] = newCount;

  // ── Store the command at the freshly-claimed slot ────────────────────────────────────
  // Absolute address SOUND_QUEUE_COUNT + newCount = 0x8300 + newCount. So the i-th queued command lands
  // in slot i (0x8301 for the first, 0x8302 for the second, …), exactly the layout dequeue expects when
  // it reads the front from slot 0x8301 and shifts the rest down.
  mem8[SOUND_QUEUE_COUNT + newCount] = cmd;
}
