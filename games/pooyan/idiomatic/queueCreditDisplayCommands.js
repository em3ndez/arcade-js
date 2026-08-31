// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { COINAGE_CONFIG } from "./names.js";
/**
 * queueCreditDisplayCommands — queue the display commands that repaint the credit region of the HUD.
 *
 * WHAT IT IS: the small routine that, during the pre-play credit screen, hands the frame's
 * display-command consumer the work of refreshing the credit area. It always queues one primary
 * credit-display command; on a free-play cabinet it queues a second command as well, so the HUD
 * shows the FREE PLAY legend in place of a numeric credit count.
 *
 * ROLE IN THE MACHINE: it is the "surrounding commands" half of the credit HUD. The credit
 * *number* itself is drawn elsewhere (the credit-count render clamps the counter to 99 and paints
 * two BCD digit tiles); this routine only enqueues the commands that tell the per-frame display
 * driver which credit-region layout to repaint. It runs as part of the pre-play setup performed
 * when a game is starting, and again whenever the credit display needs a refresh.
 *
 * A display command is a two-byte hi:lo word: the high byte names a command class and the low byte
 * is its argument. Words are appended to the display-command ring (a circular buffer inside RAM
 * page 0x88); a consumer drains that ring every frame and dispatches each word's class to the
 * handler that performs the actual VRAM paint. This routine never touches VRAM directly — it only
 * posts the two words and lets the consumer act on them.
 *
 * ROM address: 0x0e54-0x0e63. Grounding: [seen].
 * LIVE-OUT: none (memory only) — up to two words appended to the display-command ring; the credit
 * region is repainted later when the consumer drains the ring.
 */
// The primary credit-display command word, hi:lo = 0x07:0x01. This one is always queued and
// drives the standard credit-region repaint.
const PRIMARY_DISPLAY_CMD = (0x07 << 8) | 0x01;
// The extra command word, hi:lo = 0x06:0x06, queued only on a free-play machine so the credit
// region shows the FREE PLAY legend instead of a credit count.
const FREE_PLAY_DISPLAY_CMD = (0x06 << 8) | 0x06;
// The free-play sentinel value of the coinage descriptor. Each coinage nibble is decoded at boot
// into a packed descriptor whose value 0x0f means "free play"; much of the credit machinery keys
// off this sentinel directly.
const FREE_PLAY_COINAGE = 0x0f;

export function queueCreditDisplayCommands(m) {
  const { mem8 } = m;
  // Always post the primary credit-display command. The consumer will pick it off the ring next
  // drain and repaint the standard credit region of the HUD.
  enqueueDisplayCommand(m, PRIMARY_DISPLAY_CMD);
  // Free-play branch: COINAGE_CONFIG (0x882c) [seen] is coin slot 1's coinage descriptor, decoded
  // at boot from DSW0's low nibble via the coinage lookup table. When it holds the free-play
  // sentinel (0x0f), post the extra command as well so the credit region shows FREE PLAY rather
  // than a numeric count. On a paying machine this second command is skipped and only the count
  // is shown.
  if (mem8[COINAGE_CONFIG] === FREE_PLAY_COINAGE) enqueueDisplayCommand(m, FREE_PLAY_DISPLAY_CMD);
}
