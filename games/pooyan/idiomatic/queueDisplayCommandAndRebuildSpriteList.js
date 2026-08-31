// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * queueDisplayCommandAndRebuildSpriteList — post one display command, then rebuild the sprite list.
 *
 * ROM 0x6bae (0x6bae-0x6bb1). Grounding: [seen].
 *
 * WHAT IT IS
 *   A two-instruction tail the machine falls through at the very end of a frame's work: it hands
 *   one more two-byte word to the display-command ring, then rebuilds the sprite display list for
 *   this frame. In the original code it is literally `rst 0x38` (enqueue the command word in DE)
 *   followed by `jp 0x02ef` (the sprite-list rebuild) — an unconditional tail-jump, so control
 *   leaves through the rebuild and never comes back to this address.
 *
 * ROLE IN THE MACHINE
 *   Several callers finish their per-frame housekeeping by queueing a final paint job and then
 *   restaging the sprites, and this address is the shared join where those two acts happen once.
 *   It is reached two ways: as a fixed jump target, and as the fall-through tail of the help-clear
 *   sequence in commitPromotedObjectsAndClearHelpScreenOnCountdown (0x6bb2) — which loads a run of
 *   help-screen-clear command words into DE and enqueues them one after another, the last of that
 *   run (0x06af) being the very word this tail flushes before it rebuilds the list. So the command
 *   posted here is not a fixed constant; it is whatever 16-bit word the caller left in DE.
 *
 *   The display-command ring is a 64-byte circular buffer of two-byte commands in RAM page 0x88
 *   (DISPLAY_CMD_RING_BUFFER, 0x88c0-0x88ff). Producers all over the game append words to it; the
 *   main loop drains it each frame and acts on each command — repainting playfield tiles, redrawing
 *   the score and credit panels, running the high-score-corruption check, and so on. Posting the
 *   command here defers that paint work to the drain; it does not paint anything itself.
 *
 *   The sprite display list (SPRITE_DISPLAY_LIST, 0x8840) is the 24-entry, stride-4 staging area
 *   that mirrors the hardware sprite layout. Rebuilding it re-gathers the frame's moving objects
 *   (the lead actors, the hunter/target pair, the general moving objects, and the arrow group) out
 *   of their scattered game-logic records into that one contiguous list, which a later step copies
 *   into the hardware sprite banks. Doing the rebuild here, after the command is queued, is what
 *   makes this the true end-of-frame tail for its callers.
 *
 * LIVE-OUT: memory only — the two command bytes just appended to the ring and the whole rebuilt
 *   sprite display list. Control tail-jumps out through the rebuild and never returns to this
 *   address, so no register value is forced as an output; the command word to post is simply the
 *   16-bit word already sitting in the DE register pair.
 */

export function queueDisplayCommandAndRebuildSpriteList(m, cmd = m.regs.de) {
  // Step 1 — post the command. Append the two-byte word in DE to the display-command ring at
  // DISPLAY_CMD_RING_BUFFER (0x88c0) via the producer at ROM 0x0038: it writes the high byte into
  // the slot the write pointer (DISPLAY_CMD_RING_WRITE_PTR, 0x88a0) names and the low byte into the
  // next slot, advances the pointer past the pair, and drops the command if the ring is full. This
  // only queues the paint job; the main loop drains and executes it later in the frame.
  enqueueDisplayCommand(m, cmd);
  // Step 2 — rebuild the sprite display list. Tail into the per-frame rebuild at ROM 0x02ef, which
  // re-gathers every moving object into the 24-entry list at SPRITE_DISPLAY_LIST (0x8840), nudges
  // the arrow group's Y bytes up one pixel, and vertically mirrors the whole list when the cabinet
  // is flip-screened, leaving the list ready for the copy-out to the hardware sprite banks.
  rebuildSpriteDisplayList(m);
}
