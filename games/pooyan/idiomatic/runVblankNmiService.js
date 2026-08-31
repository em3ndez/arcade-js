// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { copySpriteAttrAndPositionRun } from "./copySpriteAttrAndPositionRun.js";
import { serviceCoinCreditAndCountersUnlessFreePlay } from "./serviceCoinCreditAndCountersUnlessFreePlay.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";
import { blankFillRowThenFinishAttractSetup } from "./blankFillRowThenFinishAttractSetup.js";
import { dispatchAttractSubstate } from "./dispatchAttractSubstate.js";
import { dispatchBoardBuildSubstate } from "./dispatchBoardBuildSubstate.js";
import { runPlayStateFrame } from "./runPlayStateFrame.js";
import { noopStateHandler } from "./noopStateHandler.js";
import {
  MAIN_GAME_STATE,
  PLAY_STATE_INDEX,
  NMI_ENABLE_LATCH,
  DSW1_PORT,
  FLIP_SCREEN_LATCH,
  FLIP_SCREEN_FLAG,
  INPUT_PORT0,
  WORKER_CONTROL_BYTE,
  FRAME_COUNTER,
  IN0_PORT,
  IN1_PORT,
  IN2_PORT,
  SPRITE0_CLEAR_BASE,
  SPRITE1_CLEAR_BASE,
  SPRITE_DISPLAY_LIST,
  SPRITE_TARGET_SLOTS,
  ENEMY_SCAN_BOX_TABLE,
  FORMATION_COORD_SLOTS,
} from "./names.js";

/**
 * runVblankNmiService — the vblank NMI service routine, the machine's sole per-frame heartbeat.
 *
 * WHAT IT IS: the handler the video hardware vectors to (through 0x0066) once per vertical blank,
 * roughly sixty times a second. ROM 0x066d. Grounding: [seen].
 *
 * ROLE IN THE MACHINE: the foreground main loop does almost nothing on its own — it only drains the
 * display-command ring. ALL the heavy per-frame work lives here: this routine rebuilds the two
 * hardware sprite banks, samples the controls, ticks the master frame clocks, services coins and
 * sound, and then runs exactly one top-level game-state handler. A completed beat is the true frame
 * boundary of the whole game.
 *
 * On the real machine the routine brackets its work by stacking the full register file on entry and
 * unstacking it on exit, so the foreground loop it interrupted resumes with its registers
 * undisturbed; that save/restore is pure bookkeeping — it holds no game state and carries no machine
 * meaning — so it is not represented here.
 *
 * LIVE-OUT: memory only. It leaves behind the two rebuilt hardware sprite banks (0x9010 / 0x9410),
 * the freshly-sampled input edge-detect ring (0x8810..0x8816), the two decremented frame counters
 * (0x883f / 0x8a5f), and whatever the dispatched state handler wrote; plus three hardware control
 * latches poked in passing — the NMI-enable line (0xa180), the watchdog (0xa000), and the
 * flip-screen line (0xa187).
 *
 * ONE BEAT, IN ORDER: mask the NMI so it cannot re-enter; rebuild the sprite banks and kick the
 * watchdog; shift the input edge-detect ring and re-sample the three ports; tick the two frame
 * counters; service coins and drain the sound ring; dispatch on the top-level game state; latch
 * flip-screen and re-arm the NMI.
 */
export function runVblankNmiService(m) {
  const { mem8 } = m;
  const P = INPUT_PORT0; // ring head: INPUT_PORT0 = 0x8810, the base of the input edge-detect ring

  // ── Mask the interrupt against itself. ──────────────────────────────────────────────────────
  // The LS259 control latch at 0xa180 is the vblank-NMI enable line (only the written value's low
  // bit lands). Clearing it to 0 means a second vblank raised while this beat is still in flight
  // cannot re-enter and corrupt a half-updated frame; it is re-armed in the epilogue once the
  // beat's work is complete. (ROM 0x067c)
  mem8[NMI_ENABLE_LATCH] = 0; // LS259 b0 <- 0: block a re-entrant NMI while we run

  // ── Render: rebuild the two hardware sprite banks from the staged display list. ──────────────
  // The program never pokes the sprite hardware directly during play; instead it stages a sprite
  // display list in work RAM and copies it into the banks here, once per beat. Each sprite record
  // has two halves at the same offset in two banks: the attribute/colour + inverted-Y half is
  // written from attr, starting at SPRITE1_CLEAR_BASE (0x9410), and the X + tile-code half from
  // pos, starting at SPRITE0_CLEAR_BASE (0x9010). Those two cursors are threaded through the copies
  // below so successive source groups pack contiguously into the banks. `a` carries the last byte
  // copied and is reused just below as the watchdog value.
  //
  // The shape of the copy depends on the in-play sub-state PLAY_STATE_INDEX (0x880a): in state 4 —
  // the busiest playfield — four separate source groups are stitched together; every other state
  // copies a single 0x18-record group straight from the display-list base. (ROM 0x0682-0x06b1)
  let a, attr = SPRITE1_CLEAR_BASE, pos = SPRITE0_CLEAR_BASE;
  if (mem8[PLAY_STATE_INDEX] === 0x04) {
    [a, pos, attr] = copySpriteAttrAndPositionRun(m, SPRITE_DISPLAY_LIST, attr, pos, 0x04);   // group 1: 4 display-list records
    [a, pos, attr] = copySpriteAttrAndPositionRun(m, SPRITE_TARGET_SLOTS, attr, pos, 0x03);   // group 2: 3 target/collision slots
    [a, pos, attr] = copySpriteAttrAndPositionRun(m, ENEMY_SCAN_BOX_TABLE, attr, pos, 0x0b);  // group 3: 11 enemy scan-box entries
    [a, pos, attr] = copySpriteAttrAndPositionRun(m, FORMATION_COORD_SLOTS, attr, pos, 0x06); // group 4: 6 formation coordinate slots
  } else {
    [a, pos, attr] = copySpriteAttrAndPositionRun(m, SPRITE_DISPLAY_LIST, attr, pos, 0x18);   // one 0x18-record group from the display list
  }
  // Kick the watchdog. Address 0xa000 reads as DIP bank DSW1, but its WRITE side pets the hardware
  // watchdog timer. The value written is immaterial — the last byte copied above is reused purely
  // for convenience — only the periodic write matters: skip it for too long and the watchdog resets
  // the board. Doing it here, inside the once-per-frame beat, guarantees a regular kick. (ROM 0x06b1)
  mem8[DSW1_PORT] = a; // watchdog kick: the write side of DSW1_PORT, fed the last byte copied

  // ── Input: shift the edge-detect ring, then re-sample the three ports. ───────────────────────
  // The ring is headed at P = 0x8810. Its head cells hold this frame's samples — 0x8810 = IN0
  // (coin / start / service), 0x8811 = IN1 (P1 controls), 0x8812 = IN2 (P2 controls) — and the
  // tail cells 0x8813..0x8816 keep a short history of prior frames. First the previous head values
  // are shifted up into the history cells; then the three ports are re-sampled into the head.
  // Downstream input consumers compare the fresh head against the history to detect a RISING EDGE —
  // a control that is newly pressed this frame rather than merely held — which is how coin, start,
  // and other one-shot presses are recognized instead of firing every frame the button is down.
  // The ports are hardware-read active-low (an idle port reads 0xff, a pressed control clears its
  // bit), so each sample is complemented (~) on the way in. (ROM 0x06b4-0x06da)
  mem8[P + 6] = mem8[P + 5];          // 0x8816 <- 0x8815: deepen the stored IN0 history
  mem8[P + 5] = mem8[P + 3];          // 0x8815 <- 0x8813: slide last frame's IN0 down the chain
  mem8[P + 3] = mem8[P + 0];          // 0x8813 <- 0x8810: last frame's IN0 becomes history
  mem8[P + 4] = mem8[P + 1];          // 0x8814 <- 0x8811: last frame's IN1 becomes history
  mem8[P + 2] = u8(~mem8[IN2_PORT]);  // 0x8812 <- ~IN2 (0xa0c0): this frame's P2 controls
  mem8[P + 1] = u8(~mem8[IN1_PORT]);  // 0x8811 <- ~IN1 (0xa0a0): this frame's P1 controls
  mem8[P + 0] = u8(~mem8[IN0_PORT]);  // 0x8810 <- ~IN0 (0xa080): this frame's coin/start/service

  // ── Tick the two independent per-frame counters. ────────────────────────────────────────────
  // WORKER_CONTROL_BYTE (0x883f) paces the foreground scroll worker — its low bits govern how often
  // the scroll columns are repainted. FRAME_COUNTER (0x8a5f) is the master per-frame clock: its low
  // bits phase animations across the whole game, and its zero-crossings gate the periodic ROM /
  // signature integrity checks. Both simply count down one per beat (u8() wraps 0x00 back to 0xff,
  // matching the 8-bit register). (ROM 0x06dd, 0x06e1)
  mem8[WORKER_CONTROL_BYTE] = u8(mem8[WORKER_CONTROL_BYTE] - 1);
  mem8[FRAME_COUNTER] = u8(mem8[FRAME_COUNTER] - 1);

  // ── Service coins and drain the sound ring. ─────────────────────────────────────────────────
  // Poll the debounced coin/credit inputs, award or consume credits, and step the two physical coin
  // counters — skipped entirely when free-play is configured. Then hand any sound commands that
  // were queued anywhere during this frame to the audio processor, exactly once per beat so the
  // audio side sees a steady cadence. (ROM 0x06e5, 0x06e8)
  serviceCoinCreditAndCountersUnlessFreePlay(m);
  drainSoundCommandRing(m);

  // ── Dispatch on the top-level game state. ───────────────────────────────────────────────────
  // MAIN_GAME_STATE (0x8805) is the selector that decides what the machine is DOING this frame. The
  // machine indexes a five-entry handler table (ROM 0x06f0) on it and runs exactly one handler per
  // beat; each advances its own portion of the game and returns here. This branch is the boundary
  // between the heartbeat and every other subsystem. (ROM 0x06ef)
  switch (mem8[MAIN_GAME_STATE]) {
    case 0: blankFillRowThenFinishAttractSetup(m); break; // attract-setup / idle entry
    case 1: dispatchAttractSubstate(m); break;            // attract / demo sub-state machine
    case 2: dispatchBoardBuildSubstate(m); break;         // board-build / level-intro sub-state machine
    case 3: runPlayStateFrame(m); break;                  // one frame of live gameplay
    case 4: noopStateHandler(m); break;                   // present state with no per-frame work
  }

  // ── Epilogue: latch flip-screen, then re-arm the interrupt. ─────────────────────────────────
  // Copy the screen-orientation flag FLIP_SCREEN_FLAG (0x881f) out to LS259 bit 7 (0xa187), the
  // hardware flip-screen line. That line is inverted, so a stored 0 flips the display (cocktail)
  // and 1 leaves it upright; refreshing it every beat keeps the orientation honoring the flag.
  // (ROM 0x06fa)
  mem8[FLIP_SCREEN_LATCH] = mem8[FLIP_SCREEN_FLAG]; // LS259 b7: flip-screen (inverted)
  // Re-arm the vblank NMI by writing 1 back to LS259 bit 0 (0xa180) — undoing the mask set at the
  // top — so the next vertical blank raises the next beat. (ROM 0x070f)
  mem8[NMI_ENABLE_LATCH] = 1; // LS259 b0 <- 1: re-arm NMI for the next frame
}
