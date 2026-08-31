// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand14 — one of the game's thin "emit a sound" stubs. It names a single fixed
 * sound-command code (0x14) and funnels it into the shared, gated sound-command ring; it does no
 * work of its own beyond choosing that byte.
 *
 * WHAT IT IS / ROLE IN THE MACHINE
 * The main CPU never synthesizes audio. A sound is requested by dropping a one-byte command code
 * into a small circular buffer — the sound-command ring — from which a separate audio processor is
 * fed one byte per frame. Game logic never writes that ring directly; every event that wants a
 * sound calls one of a family of small emitters, each of which hard-codes the command code for its
 * effect and hands it to the common append routine. This is the emitter for command 0x14, the cue
 * raised while the marker/rope column plays its retract animation — its sole producer is
 * renderMarkerColumnExtendOrRetract, which calls here once as the column is drawn back in.
 *
 * ROM 0x0f49-0x0f4d. [seen].
 *
 * The ring itself: twenty-eight one-byte slots at SOUND_RING_BUFFER (0x8a43..0x8a5e), addressed by
 * a one-byte write cursor SOUND_RING_WRITE_PTR (0x8a40); a matching read cursor drains it on the
 * consuming side. The append is GATED — the byte is enqueued only while a game is live (the in-play
 * flag GAME_ACTIVE_FLAG (0x8806) set, or the play-mode latch PLAY_MODE_LATCH (0x8f50) nonzero); with
 * both clear (attract, or between lives) the command is silently dropped and never reaches the ring.
 *
 * LIVE-OUT: A = the advanced ring write cursor the append leaves behind, or 0 when the gate is
 * closed and nothing was enqueued — the same value any append site reads back after queuing a sound.
 */

// The fixed sound-command code this emitter stands for: 0x14, the marker/rope-column retract cue.
const CMD = 0x14;

export function queueSoundCommand14(m) {
  // Load the fixed command byte and hand it to the shared gated append: it stashes the byte, tests
  // the play-live gate, and (when open) writes it into the slot named by SOUND_RING_WRITE_PTR
  // (0x8a40) and advances that cursor. Control returns from the append straight back to this stub's
  // caller, with A left holding the append's result — the advanced cursor, or 0 if the gate dropped
  // the byte.
  return appendSoundCommandGated(m, CMD);
}
