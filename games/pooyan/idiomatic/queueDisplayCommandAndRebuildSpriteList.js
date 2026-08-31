// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * queueDisplayCommandAndRebuildSpriteList — enqueue one display command, then rebuild the sprite display list.
 *
 * Enqueues the two-byte command held in DE into the page-0x88 command ring, then tails into the
 * per-frame sprite-display-list rebuild. It is the shared tail reached after a run of command
 * enqueues, and also a fixed jump target.
 *
 * REGISTER BRIDGE: cmd = m.regs.de. LIVE-OUT: memory only — the enqueued ring bytes and the
 * rebuilt display list; control tails out and never returns, so no register output is forced.
 */

export function queueDisplayCommandAndRebuildSpriteList(m, cmd = m.regs.de) {
  enqueueDisplayCommand(m, cmd);
  rebuildSpriteDisplayList(m);
}
