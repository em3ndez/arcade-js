// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueFixedSoundCommandRun — enqueue one fixed burst of four command bytes into the sound-command ring.
 *
 * WHAT IT IS
 *   ROM 0x0fc1-0x0fd4. [seen]. A tiny "sound cue" emitter: it queues the fixed run of four command
 *   bytes 0x29, 0x15, 0x16, 0x17, in that order, as a single scripted burst.
 *
 * ROLE IN THE MACHINE
 *   The audio side of the cabinet is driven by a small ring buffer of one-byte commands living in the
 *   0x8a00 page: the ring slots run 0x8a43..0x8a5e, addressed by a one-byte write cursor
 *   (SOUND_RING_WRITE_PTR, 0x8a40). A crowd of thin emitters each load a fixed command byte and funnel
 *   it into the ring through the shared gated append (appendSoundCommandGated). Once per frame the main
 *   loop drains one queued byte off the read cursor and hands it to the audio processor to play.
 *
 *   Most emitters queue a single byte. This one is a compound cue: it presses four bytes into the ring
 *   back-to-back, so the audio side plays them out as a set. Because each append is GATED (bytes are
 *   only accepted while a game is live — see appendSoundCommandGated), the whole burst is silently
 *   dropped during attract / between lives.
 *
 * LIVE-OUT
 *   Memory only — the four command bytes appended to the sound-command ring, and the ring write cursor
 *   advanced four slots (wrapping the last slot back to the first as needed). Each append also leaves
 *   the advanced write cursor in A; the value of this routine is the last append's, produced as a tail
 *   append (its return goes straight back to this routine's caller). Nothing else is touched — no game
 *   state, no video RAM, no player record.
 */
const SOUND_CMDS = [0x29, 0x15, 0x16, 0x17]; // the fixed four-byte cue, emitted in this order

export function queueFixedSoundCommandRun(m) {
  // Press each command byte into the ring one at a time. appendSoundCommandGated stashes the byte,
  // checks the play-live gate, and (when open) writes it at the write cursor then advances/wraps the
  // cursor. Four separate appends, so the burst occupies four consecutive ring slots.
  appendSoundCommandGated(m, SOUND_CMDS[0]); // first cue byte
  appendSoundCommandGated(m, SOUND_CMDS[1]); // second cue byte
  appendSoundCommandGated(m, SOUND_CMDS[2]); // third cue byte
  // Fourth and final byte: emitted as a tail append, so its result is this routine's result and its
  // return delivers control directly to whoever asked for the cue.
  return appendSoundCommandGated(m, SOUND_CMDS[3]); // fourth (last) cue byte, tail append
}
