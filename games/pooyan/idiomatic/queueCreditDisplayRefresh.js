// SPDX-License-Identifier: GPL-3.0-only
import { CREDIT_DISPLAY_COMMAND } from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
/**
 * queueCreditDisplayRefresh — request a repaint of the on-screen credit count.
 *
 * WHAT IT IS: the tiny common tail of the credit-accrual machinery. Once a coin (or a
 * service-credit) pulse has been debounced and accepted, and the credit count
 * CREDIT_COUNT (0x8802) has been bumped and clamped to its maximum of 0x63 (99 decimal)
 * by the shared accumulate tail addCreditsAndQueueDisplay, control drops into here to
 * announce that the credit number shown on screen is now stale and must be redrawn.
 *
 * ROLE IN THE MACHINE: the credit HUD is not painted every frame — it is refreshed only
 * on demand, when the count actually moves. This routine is that demand signal. Every
 * event that changes the credit total funnels through the same accrual chain and ends
 * here: inserting a coin, awarding a service credit, and consuming credits on a
 * one-player (1 credit) or two-player (2 credit) start. It performs no arithmetic and
 * touches no HUD tile itself — it merely posts the "redraw credits" request.
 *
 * ROM 0x5a97-0x5a9b. Grounding: [seen].
 *
 * THE COMMAND: CREDIT_DISPLAY_COMMAND (0x0701) is a fixed two-byte display-command word —
 * a command-class byte (0x07) and an argument byte (0x01) — that selects the credit-render
 * handler when the command is later acted on. This routine only enqueues the word; it does
 * not interpret it.
 *
 * LIVE-OUT: memory only — the two command bytes appended to the display-command ring on
 * RAM page 0x88 plus that ring's advanced write pointer. Nothing appears on screen here;
 * the two credit digits are repainted later, when the main loop drains the ring.
 */

export function queueCreditDisplayRefresh(m) {
  // Post the credit-refresh request into the display-command ring. The fixed command word
  // travels in the DE register — the register the ring producer reads its command from —
  // and is handed to the producer through the Z80 rst 0x38 restart vector, the machine's
  // single entry point for appending a display command. The producer stores the word and
  // returns immediately; the credit digits are not redrawn until the main loop drains the
  // ring on a later pass.
  enqueueDisplayCommand(m, CREDIT_DISPLAY_COMMAND); // enqueue the display-command word via rst-0x38
}
