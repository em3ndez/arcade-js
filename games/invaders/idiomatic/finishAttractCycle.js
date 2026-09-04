// SPDX-License-Identifier: GPL-3.0-only
import { waitShortDelay } from "./waitShortDelay.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { runAttractAnimTask } from "./runAttractAnimTask.js";
import { loc_1988 } from "./loc_1988.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { drawSpriteList } from "./drawSpriteList.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { fetchNextDrawRecord } from "./fetchNextDrawRecord.js";
import { loadDrawSequenceBlock } from "./loadDrawSequenceBlock.js";
import { typeDrawScriptRecord } from "./typeDrawScriptRecord.js";
import { typeDrawScript } from "./typeDrawScript.js";
import { runHandshakedAttractAnim } from "./runHandshakedAttractAnim.js";
import { enterAttractCycle } from "./enterAttractCycle.js";
import { u8 } from "../../../core/int.js";
import {
  SCREEN_MODE_TOGGLE, TASK_FLAGS, loc_3311, INSERT_COIN_SCREEN_ADDR, INSERT_COIN_TEXT, ATTRACT_INFO_DRAW_RECORD, ATTRACT_EXTRA_DRAW_SCRIPT, ATTRACT_REVEAL_ANIM_SEQ,
} from "./names.js";

/**
 * finishAttractCycle — the attract loop's teardown/next-screen stage.
 *
 * WHAT IT IS
 *   Space Invaders' attract mode runs a repeating cycle: seed a demo, let it play, then tear it down and
 *   show a between-demos information screen before starting over. This is that teardown-and-info stage. It
 *   clears the field, paints a sprite-list panel plus a typed (character-by-character) attract script,
 *   optionally runs the interrupt-handshaked reveal animation, flips a two-state screen alternator so the
 *   NEXT pass shows the other information screen, and loops back to the top of the attract cycle.
 *
 * ROLE IN THE MACHINE
 *   The attract loop is the join bootInit -> enterAttractCycle (0x18df) -> runAttractCycle (0x0aea, the
 *   free-running demo) -> finishAttractCycle -> back to enterAttractCycle. This routine is fallen into
 *   from runAttractCycle when the demo ends (and re-entered by `jmp 0x0b89` from 0x16e3), and it exits by
 *   tail-jumping to enterAttractCycle (0x18df). SCREEN_MODE_TOGGLE (0x20ec) is the alternator it flips
 *   each pass, so successive teardowns show alternating attract screens (the reveal animation only runs on
 *   the toggle==0 pass). TASK_FLAGS (0x20c1) is zeroed up front so no per-frame drawing task is owed
 *   while the teardown paces itself on the vblank busy-wait delays. The typed scripts and sprite lists
 *   are ROM data at the loc_1f.. addresses; the reveal step drives object handler 0x050e through the
 *   ISR handshake in runHandshakedAttractAnim.
 *
 * ROM 0x0b89-0x0be7.  Grounding: [seen].  Generator (busy-wait paces yield); touches memory + IO.
 */
export function* finishAttractCycle(m) {
  // Clear the per-frame drawing-task bitfield: nothing is queued for the ISR to draw during teardown.
  m.mem8[TASK_FLAGS] = 0x00;

  // Short (0x40-frame) settle delay, paced on the vblank frame counter.
  yield* waitShortDelay(m);

  // Blank the play-field framebuffer (the between-demos screen is drawn fresh below).
  loc_1988(m);

  // Paint the fixed 0x0c-glyph sprite-list panel (ids from INSERT_COIN_TEXT) at its screen slot INSERT_COIN_SCREEN_ADDR.
  drawSpriteList(m, INSERT_COIN_TEXT, 0x0c, INSERT_COIN_SCREEN_ADDR);

  // On the toggle==0 pass only, add one extra 8x8 glyph (sprite id 0x02) at loc_3311.
  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    drawSprite8x8(m, 0x02, loc_3311);
  }

  // Fetch one draw record from the table at ATTRACT_INFO_DRAW_RECORD, then type it out character-by-character. The record
  // unpacks a destination screen address and a source glyph pointer.
  const rec = fetchNextDrawRecord(m, ATTRACT_INFO_DRAW_RECORD); // rec[0] = dest, rec[1] = source
  yield* typeDrawScriptRecord(m, rec[1], rec[0]);

  // Gated on input port 2 bit 7 (the select bit that decides whether the second attract script shows):
  // when it is clear, type the additional draw script at ATTRACT_EXTRA_DRAW_SCRIPT.
  if ((m.io.portIn(0x02) & 0x80) === 0) { // second-input select bit
    yield* typeDrawScript(m, ATTRACT_EXTRA_DRAW_SCRIPT);
  }

  // Long (0x80-frame) hold so the typed screen stays up to be read.
  yield* waitLongDelay(m);

  // Reveal animation, only on the toggle==0 pass: load its 12-byte draw/animation sequence into the work
  // slot, arm the ISR anim task and wait for it to finish, then run the interrupt-handshaked reveal.
  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    loadDrawSequenceBlock(m, ATTRACT_REVEAL_ANIM_SEQ);
    yield* runAttractAnimTask(m);
    yield* runHandshakedAttractAnim(m);
  }

  // Flip the screen alternator 0<->1 so the next teardown pass shows the other information screen.
  m.mem8[SCREEN_MODE_TOGGLE] = u8(m.mem8[SCREEN_MODE_TOGGLE] + 1) & 0x01;

  // Wipe the play field and rejoin the top of the attract cycle (tail to enterAttractCycle).
  clearPlayfield(m);
  yield* enterAttractCycle(m);
}
