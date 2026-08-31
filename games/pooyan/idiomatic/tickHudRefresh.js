// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { runPlayStateFrame } from "./runPlayStateFrame.js";
import { HUD_REFRESH_TICK, TAMPER_STRIKES_ROM } from "./names.js";
/**
 * tickHudRefresh — per-frame HUD-refresh tick with a tamper-gated gameplay dispatch.
 *
 * WHAT IT IS
 *   A small per-frame housekeeping routine that keeps the HUD (the score/panel and its
 *   counters) repainting on a steady cadence. It owns one free-running counter,
 *   HUD_REFRESH_TICK (0x8f4d), which it bumps every frame; on every sixteenth frame it
 *   posts a single display-refresh command into the paint queue. Bolted onto the tail is
 *   an anti-piracy booby-trap: an extra run of the live-play frame that fires only when
 *   the ROM has been tampered with.
 *
 * ROLE IN THE MACHINE
 *   All screen painting is deferred through a 32-slot display-command ring buffer
 *   (DISPLAY_CMD_RING_BUFFER, 0x88c0-0x88ff); the main loop drains one command per vblank
 *   and routes it to a panel / score / counter handler. This routine is one of the ring's
 *   producers — the heartbeat that keeps the HUD from going stale by re-queuing a refresh
 *   command roughly four times a second (once per 16 frames at 60Hz). Fifteen of every
 *   sixteen frames it does nothing but advance its counter.
 *
 * ROM 0x1583-0x159a.
 * Grounding: [seen].
 * LIVE-OUT: none (memory only) — the observable effects are the HUD_REFRESH_TICK bump and,
 *   on a boundary frame, the queued display command; nothing is returned to the caller.
 */

// The queued word is high byte : low byte. CMD_HIGH (0x06) is the fixed high byte of the
// HUD display-refresh command; the low byte is the variant. BOUNDARY_MASK isolates the
// counter's low nibble to detect a 16-frame boundary, and VARIANT_BIT is bit 4 of that same
// counter, which flips the low-byte variant (0xb5 vs 0x35) once every 16 frames.
const CMD_HIGH = 0x06;
const BOUNDARY_MASK = 0x0f;
const VARIANT_BIT = 0x10;

export function tickHudRefresh(m) {
  const { mem8 } = m;
  // Advance the free-running HUD cadence counter (HUD_REFRESH_TICK, 0x8f4d) once per frame,
  // then read the new value back to test the cadence and choose the command variant.
  mem8[HUD_REFRESH_TICK]++;
  const counter = mem8[HUD_REFRESH_TICK];
  // Cadence gate: act only on a 16-frame boundary. Fifteen frames out of sixteen the low
  // nibble is nonzero, so the routine has already done its per-frame work (the bump above)
  // and returns without touching the paint queue.
  if ((counter & BOUNDARY_MASK) !== 0) return; // not a 16-frame boundary
  // Boundary frame: enqueue one HUD display-refresh command (0x06b5 or 0x0635) so the main
  // loop repaints the panel/counters. Counter bit 4 (VARIANT_BIT) alternates the low byte
  // between 0xb5 and 0x35 every 16 frames, toggling the refresh variant.
  enqueueDisplayCommand(m, (CMD_HIGH << 8) | (counter & VARIANT_BIT ? 0xb5 : 0x35));
  // Anti-piracy gate. TAMPER_STRIKES_ROM (0x89ef) is a strike counter that stays zero on an
  // intact ROM; it is only bumped when the 0x64be ROM-checksum guard finds its sentinel
  // wrong. On a genuine board it is always zero, so the routine returns here and the extra
  // dispatch below never runs.
  if (mem8[TAMPER_STRIKES_ROM] === 0) return; // dispatch gated on the strike counter
  // Reached only on a tampered ROM: run a second, full pass of the state-3 live-play frame
  // (runPlayStateFrame) within this same tick. Because that frame has already run once this
  // vblank, the extra pass double-steps its timers and sub-state dispatch, quietly corrupting
  // gameplay timing on a modified board — a booby-trap that is dormant on an intact ROM.
  return runPlayStateFrame(m); // fall through into the state-3 dispatch + continuation
}
