// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0B — one of the crowd of tiny "sound selector" routines. Its whole job is to name
 * a single fixed sound-effect command byte, 0x0b, and drop it into the machine's sound-command ring
 * so the audio processor will play it. It is the sound half of the bonus-award tally: each time the
 * active player's running score crosses the next queued bonus threshold, the award logic bumps the
 * HUD phase gauge and calls here to voice the tally beep.
 *
 * ROLE IN THE MACHINE. The main CPU never synthesizes sound itself — it owns a single write port to a
 * separate audio processor and speaks to it only through queued command bytes. Rather than latch a
 * sound the instant a game event asks for it, the code accumulates commands in a small circular
 * buffer, the sound-command ring (SOUND_RING_BUFFER, twenty-eight one-byte slots 0x8a43..0x8a5e on
 * page 0x8a, filled at the tail cursor SOUND_RING_WRITE_PTR 0x8a40), and the per-frame service pays
 * out one queued command per frame to the audio side. Roughly two dozen selectors like this one each
 * hard-code their own fixed command byte and funnel through the same gated append, so the ring carries
 * a single interleaved stream regardless of which selector produced a given byte.
 *
 * ROM 0x0f0d-0x0f10. [seen].
 *
 * The append is GATED downstream: the byte reaches the ring only while a game is live — either the
 * in-play flag GAME_ACTIVE_FLAG (0x8806) is set, or the play-state latch PLAY_MODE_LATCH (0x8f50) is
 * nonzero. With both clear (attract, or between lives) the byte is dropped and nothing is enqueued.
 * This selector does not test the gate itself; it simply supplies its byte to the shared helper that
 * does, so the 0x0b tally beep is naturally silenced whenever it is not gameplay-time.
 *
 * LIVE-OUT: A = the advanced ring cursor the append helper leaves in the accumulator (0 on the
 * gates-closed path, where the byte is dropped); callers read it, propagated as this wrapper's
 * return value.
 */

// The fixed sound-effect command byte this selector voices: 0x0b, the bonus-award tally beep. Every
// selector in the family pins exactly one such byte; the audio processor maps the code to a sound.
const COMMAND_BYTE = 0x0b;

export function queueSoundCommand0B(m) {
  // Hand the fixed command byte 0x0b to the shared gated ring-append helper. That helper first stashes
  // the byte at SOUND_RING_PENDING_BYTE (0x8d20), then checks the play gate (GAME_ACTIVE_FLAG 0x8806 /
  // PLAY_MODE_LATCH 0x8f50); on the open path it writes the byte into the slot the tail cursor
  // SOUND_RING_WRITE_PTR (0x8a40) points at and advances that cursor, wrapping the last ring slot
  // (0x5e) back to the first (0x43). The value it hands back — the advanced cursor, or 0 when the gate
  // is closed and the byte dropped — becomes this wrapper's result.
  return appendSoundCommandGated(m, COMMAND_BYTE);
}
