// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSoundRun26 — queue the four-byte sound-command run that opens with command byte 0x26.
 *
 * WHAT IT IS
 *   A one-line selector in the sound subsystem. A caller that wants "the run led by 0x26" enters
 *   here; this routine's entire job is to name that single leading command byte and hand it to the
 *   shared run emitter (appendSoundCommandRun). It holds no logic of its own beyond the choice of
 *   which byte leads the run — it is one member of a family of such selectors, each fixing a
 *   different leading byte for the same framed-run shape.
 *
 * ITS ROLE IN THE MACHINE
 *   Sounds are not latched the instant a game event asks for one. Instead command bytes are pushed
 *   into a small circular buffer — the 28-slot sound-command ring in page 0x8a (SOUND_RING_BUFFER
 *   0x8a43..0x8a5e, its write cursor at SOUND_RING_WRITE_PTR 0x8a40) — and the frame service pays
 *   them out one per frame to the separate audio processor. Most producers queue a single command
 *   byte; a "run" producer like this one queues a short framed sequence: the leading byte 0x26
 *   immediately followed by the fixed three-byte trailer 0x15, 0x16, 0x17. That trailer is the
 *   framing/terminator that closes a multi-byte run in the stream the sound processor reads —
 *   it tells the far side the run is complete. appendSoundCommandRun supplies that fixed trailer;
 *   this routine supplies only the head. Every byte of the run is appended through the same
 *   play-live gate (GAME_ACTIVE_FLAG 0x8806 or PLAY_MODE_LATCH 0x8f50 set), so while the machine
 *   is idle (attract / between lives) the whole run is dropped together and the sound processor
 *   never sees a truncated, un-terminated run.
 *
 * ROM 0x0fad-0x0fb1. Grounding tag: [seen].
 *
 * LIVE-OUT: A = the advanced ring write-cursor the emitter leaves after its final append (0 when
 *   the play-live gate is closed and the bytes were dropped). This routine jumps straight into the
 *   emitter so the emitter's return carries back to our own caller, and the AF pair is not restored
 *   across that jump — the caller reads the emitter's A as this routine's result.
 */

// The leading command byte of this run: 0x26. appendSoundCommandRun appends this first, then the
// fixed 0x15 / 0x16 / 0x17 trailer, forming the complete four-byte framed run.
const LEAD_TILE = 0x26;

export function queueSoundRun26(m) {
  // Hand the leading byte 0x26 to the shared four-byte run emitter and jump into it: the emitter
  // appends this head plus the fixed trailer through the play-live gate, and on return control
  // passes back to our caller with A holding the advanced ring cursor (or 0 if the run was gated
  // off and every byte dropped).
  return appendSoundCommandRun(m, LEAD_TILE);
}
