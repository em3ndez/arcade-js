// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0D — one of the thin "sound selector" entry points.
 *
 * WHAT IT IS
 * ----------
 * This is a single-purpose selector whose entire job is to ask for one specific sound: it names the
 * fixed command byte 0x0d and hands it to the shared gated-append helper. Game logic calls a routine
 * like this whenever a particular event should be heard; the routine itself carries no logic beyond
 * "the sound I stand for is 0x0d — queue it."
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The main processor never makes sound directly. It keeps a small circular buffer of pending sound
 * commands in the 0x8a page and pays exactly one of them out to the separate audio processor each
 * frame. Producers — a whole family of selectors like this one, each pinned to its own command
 * code — drop bytes into that ring; a per-frame drain forwards them, one at a time, to the audio
 * hardware. queueSoundCommand0D is the producer for command 0x0d specifically: it loads that byte
 * and funnels through the common append tail, which is where the actual ring write and the "only
 * while a game is live" gate live. Keeping the ring write in one shared place means every selector
 * feeds a single interleaved command stream no matter which event triggered it.
 *
 * ROM ADDRESS
 * -----------
 * 0x0f15-0x0f18. The routine loads the immediate 0x0d, then falls straight through into the shared
 * append helper at 0x0ea2, so the helper's return goes back to this routine's own caller.
 *
 * GROUNDING
 * ---------
 * [seen] — see the routine's cert tag in names.js (ROUTINES 0x0f15).
 *
 * LIVE-OUT
 * --------
 * A = whatever the append helper leaves behind: the advanced ring write cursor when the byte is
 * enqueued, or 0 when the gate is closed and the byte is dropped. The helper does not restore A, and
 * callers read that value back, so this routine forwards it unchanged.
 */

// The fixed sound-command code this selector stands for. Command 0x0d is one entry in the sound
// processor's command vocabulary (roughly 0x00..0x14 of single-effect codes); this selector exists
// purely to name it and queue it, so the byte is a constant, never computed.
const RING_COMMAND = 0x0d;

export function queueSoundCommand0D(m) {
  // Hand the fixed command byte to the shared gated-append tail. That helper stashes the byte, tests
  // the play-live gate (the in-play flag 0x8806 set, OR the play-mode latch 0x8f50 nonzero), and —
  // only if the gate is open — writes the byte into the ring slot named by the write cursor (0x8a40)
  // and advances that cursor (wrapping the last slot 0x5e back to the first 0x43). Its result — the
  // advanced cursor, or 0 on the dropped-byte path — is this routine's result too.
  return appendSoundCommandGated(m, RING_COMMAND);
}
