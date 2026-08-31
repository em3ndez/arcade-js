// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SUBPHASE_TICK,
  FORMATION_SLOT_TABLE,
  HUD_INTEGRITY_STRIP_A,
  HUD_INTEGRITY_STRIP_B,
  SELFTEST_DISPATCH_STATE,
} from "./names.js";
import { paintDisplayListRunToVram } from "./paintDisplayListRunToVram.js";
import { queueSoundCommands27And15 } from "./queueSoundCommands27And15.js";
/**
 * runDisplayListAndAdvanceToGameplay — attract/self-test dispatch state 1.
 * ROM 0x7517.  Grounding: [seen].
 *
 * WHAT IT IS
 *   One of the three handlers of the attract/self-test state machine. A selector byte,
 *   SELFTEST_DISPATCH_STATE (0x8921), is masked to its low two bits and used to pick a
 *   handler: state 0 runs the boot/ROM-check init, state 1 is THIS routine (paint the
 *   screen and verify the HUD is intact), and state 2 is the live gameplay driver. This
 *   handler is the gate between "screen has been drawn" and "let the game run": it keeps
 *   repainting the attract screen, waits out a two-stage delay, then makes one integrity
 *   check on what it drew — and only if that check passes does it hand the machine to the
 *   gameplay driver.
 *
 * ROLE IN THE MACHINE
 *   Called once per frame while the selector sits at state 1. Most frames it does nothing
 *   but repaint and count. When its two nested delays have both elapsed it column-sums two
 *   fixed strips of the on-screen HUD and demands their combined total be a single exact
 *   value; a clean total means the picture on screen is the one the program laid down, so
 *   it is safe to advance the selector to state 2 (gameplay) and cue the start-of-game
 *   audio. Any other total means the video memory has been tampered with or corrupted, and
 *   the machine is stopped dead — an anti-tamper reflex characteristic of this ROM.
 *
 * LIVE-OUT
 *   None — the state dispatcher reads no result register. Its lasting effects are entirely
 *   in memory: it advances SUBPHASE_TICK (0x88b7) and the sub-phase one-shot at
 *   FORMATION_SLOT_TABLE (0x8920), and on the frame it completes it advances
 *   SELFTEST_DISPATCH_STATE (0x8921) from state 1 to state 2 and appends two sound commands
 *   to the sound-command ring.
 */

// The frame-tick counter SUBPHASE_TICK (0x88b7) wraps every 0x1c frames; each wrap is one
// "beat" of the outer delay.
const TICK_PERIOD = 0x1c;
// Each HUD integrity strip is a vertical run of 0x0e (14) tiles.
const STRIP_TILES = 0x0e;
// One screen row is 0x20 (32) cells apart in video RAM, so stepping one tile UP a column
// subtracts 0x20 from the address.
const ROW_STRIDE = 0x20;
// The two strips of an intact HUD sum to exactly 0x014f: low byte 0x4f, high byte 0x01.
const SUM_LOW = 0x4f;
const SUM_HIGH = 0x01;

export function runDisplayListAndAdvanceToGameplay(m) {
  const { mem8 } = m;

  // STEP 1 — Repaint the attract screen.
  // Run the display-list interpreter, which copies the current source stream into video RAM
  // (0x8400-0x87ff), advancing its chosen source/destination pointer pair. This is what keeps
  // the attract picture drawn on every frame this handler runs.
  paintDisplayListRunToVram(m);

  // STEP 2 — Outer delay: throttle to one beat every 0x1c frames.
  // Bump the frame-tick counter SUBPHASE_TICK (0x88b7). Until it climbs to its period 0x1c
  // this handler has nothing more to do this frame, so bail out. This spaces the setup out
  // over time so the attract screen is visible before the machine moves on.
  mem8[SUBPHASE_TICK] = mem8[SUBPHASE_TICK] + 1;
  if (mem8[SUBPHASE_TICK] !== TICK_PERIOD) return;

  // STEP 3 — Inner delay: a two-hit one-shot at the sub-phase counter.
  // We only get here on the wrap frame. Read the sub-phase one-shot at the base of
  // FORMATION_SLOT_TABLE (0x8920) BEFORE bumping it, step it, and re-seed the frame-tick
  // counter with that pre-increment value so the next beat is primed. On the very first wrap
  // the pre-increment value is 0, so we return and skip the integrity check — the check only
  // fires on the second wrap, giving the freshly painted screen a full beat to settle.
  const preInc = mem8[FORMATION_SLOT_TABLE];
  mem8[FORMATION_SLOT_TABLE] = mem8[FORMATION_SLOT_TABLE] + 1;
  mem8[SUBPHASE_TICK] = preInc;
  if (preInc === 0) return; // first pass: skip the strip check

  // STEP 4 — HUD integrity check: column-sum two fixed strips of the drawn screen.
  // Walk two vertical 14-tile strips of the just-painted HUD from their bases upward, one row
  // (0x20 cells) at a time: HUD_INTEGRITY_STRIP_A (0x82bc, in the colour plane) and
  // HUD_INTEGRITY_STRIP_B (0x86bc, in the tile-code plane). Accumulate every cell into a
  // single 16-bit total. An intact, program-drawn HUD always yields the same total.
  let sum = 0;
  for (const base of [HUD_INTEGRITY_STRIP_A, HUD_INTEGRITY_STRIP_B]) {
    let cell = base;
    for (let i = 0; i < STRIP_TILES; i++) {
      sum = u16(sum + mem8[cell]);
      cell = u16(cell - ROW_STRIDE);
    }
  }

  // STEP 5 — Anti-tamper trap: the total must be exactly 0x014f.
  // The low byte must be 0x4f and the high byte 0x01. Any other value means the picture on
  // screen is not the one the program laid down (corrupted or tampered video RAM), and the
  // machine halts here rather than proceed — this branch is unreachable with an intact screen.
  if ((sum & 0xff) !== SUM_LOW) throw new Error("runDisplayListAndAdvanceToGameplay: HUD strip integrity trap (unreachable with an intact screen)");
  if ((sum >> 8) !== SUM_HIGH) throw new Error("runDisplayListAndAdvanceToGameplay: HUD strip integrity trap (unreachable with an intact screen)");

  // STEP 6 — Advance to gameplay and cue the start audio.
  // The screen checked out. Advance the dispatch selector SELFTEST_DISPATCH_STATE (0x8921)
  // from state 1 to state 2, so from the next frame the dispatcher runs the gameplay driver
  // instead of this handler. Then enqueue the start-of-game sound commands (0x27 then 0x15)
  // onto the sound-command ring.
  mem8[SELFTEST_DISPATCH_STATE] = mem8[SELFTEST_DISPATCH_STATE] + 1;
  queueSoundCommands27And15(m);
}
