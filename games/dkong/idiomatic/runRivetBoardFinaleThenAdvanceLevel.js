// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetBoardFinaleThenAdvanceLevel — run one frame of the rivet board's end-of-board finale
 * and, when the finale runs out, step the board order on and increment LEVEL.
 *
 * One dispatch is one frame of that screen. Every dispatch first decrements FINALE_PACE_COUNTER,
 * then forks three ways:
 *
 *   - THE WRAP (the counter comes back to 0): the finale is over. Walk BOARD_SEQ_PTR to its next
 *     entry — on the table terminator, restart at the group that repeats forever — copy that entry
 *     into BOARD, increment LEVEL, post a deferred task, clear HOW_HIGH_INDEX and
 *     BOARD_ADVANCE_STEP, then arm SUBSTATE_TIMER and hand the game to GAME_SUBSTATE 8.
 *     THE LEVEL INCREMENT IS THIS ROUTINE'S OWN: the ordinary board advance steps the same pointer
 *     without it, so a finale that ran this arm twice would count two levels.
 *   - THE EVERY-8th HOLD — on the seven frames in eight where the decremented counter is not a
 *     multiple of 8, the tick is the whole of the frame's work.
 *   - EVERY 8th TICK: step the screen's two blink flags — toggle the high bit of
 *     FINALE_BLINK_FLAG, and rewrite FINALE_ANIM_FLAG's bit 5 from a selector fed that flag with
 *     the bit already cleared. Then branch on the counter's exact value, and on nothing else:
 *       * STAGE_AT — seed the transition screen's sprite record. Which of two position/code pairs
 *         it takes depends on which half of the screen MARIO_X is in.
 *       * SOUND_AT — write the sound cue (the priority byte is picked on LEVEL's parity) and a
 *         four-byte object record, whose first byte is patched again on the left half of the
 *         screen.
 *       * any other value — nothing further.
 *
 * NOT A LEAF: the every-8th arm runs the shared bit-field selector (a pure function of its two
 * inputs, touching no memory), and the wrap arm posts its task through the task-ring callee.
 *
 * LIVE-OUT: memory only. This is a dispatch-table entry and its caller reads no register or flag
 * it leaves behind; it models no stack, so the guest pc and SP are left where they were entered.
 */

import {
  MARIO_X,
  LEVEL,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  BOARD,
  BOARD_SEQ_PTR,
  HOW_HIGH_INDEX,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
  BOARD_ADVANCE_STEP,
} from "./names.js";
import { nextAnimationStep } from "./nextAnimationStep.js"; // pure bit-field selector
import { enqueueTask } from "./enqueueTask.js"; // post a task on the ring

/** The finale's own down-counter: one step per dispatch, and the whole of its clock. */
const FINALE_PACE_COUNTER = 0x62af;

/** The two blink flags this screen steps, one bit each. Neither carries a shared name. */
const FINALE_BLINK_FLAG = 0x6a25; // the high bit is toggled every 8th tick
const FINALE_ANIM_FLAG = 0x6919; // bit 5 is rewritten from the selector every 8th tick
const FINALE_BLINK_BIT = 0x80;
const FINALE_ANIM_BIT = 0x20;

/**
 * The transition screen's sprite record. The shared registry does give this address a Mario name,
 * and it is deliberately NOT used here: what this arm stages is the cutscene's own figure, so
 * calling the fields "Mario" would assert something this routine does not do.
 */
const CUTSCENE_SPRITE_X = 0x694c;
const CUTSCENE_SPRITE_CODE = 0x694d;
const CUTSCENE_SPRITE_Y = 0x694f;

/** The four-byte object record the sound arm writes, and the byte it patches on the left half. */
const FINALE_OBJECT_RECORD = 0x6a20;
const FINALE_OBJECT_BYTE0_LEFT = 0x6f;

/** The two counter values the every-8th arm does extra work on. */
const STAGE_AT = 0xe0;
const SOUND_AT = 0xc0;

/** Half the screen width: the split MARIO_X is graded against on both arms. */
const SCREEN_MIDPOINT = 0x80;

/** The board table's end marker, and the entry the walk restarts at when it is reached. */
const BOARD_TABLE_TERMINATOR = 0x7f;
const BOARD_TABLE_REPEAT_GROUP = 0x3a73;

export function runRivetBoardFinaleThenAdvanceLevel(m) {
  const { mem } = m;

  // Tick the finale's clock. On its 0-crossing the finale is over.
  const counter = (mem.read8(FINALE_PACE_COUNTER) - 1) & 0xff;
  mem.write8(FINALE_PACE_COUNTER, counter);
  if (counter === 0) {
    advanceBoardSequence(m);
    return;
  }

  // Every-8th gate: most frames just tick and return.
  if ((counter & 0x07) !== 0) return;

  // Proceed (once every 8 ticks): step the two blink flags.
  mem.write8(FINALE_BLINK_FLAG, mem.read8(FINALE_BLINK_FLAG) ^ FINALE_BLINK_BIT);
  const animInput = mem.read8(FINALE_ANIM_FLAG) & ~FINALE_ANIM_BIT & 0xff; // clear the bit first
  const sel = nextAnimationStep(0x00, animInput); // pure selector: value in, value out
  mem.write8(FINALE_ANIM_FLAG, (sel.a | FINALE_ANIM_BIT) & 0xff);

  // Branch on the counter's exact value.
  if (counter === STAGE_AT) {
    // Seed the transition screen's sprite record; the pair depends on Mario's half of the screen.
    mem.write8(CUTSCENE_SPRITE_Y, 0x50);
    if (mem.read8(MARIO_X) < SCREEN_MIDPOINT) {
      mem.write8(CUTSCENE_SPRITE_CODE, 0x80);
      mem.write8(CUTSCENE_SPRITE_X, 0x5f);
    } else {
      mem.write8(CUTSCENE_SPRITE_CODE, 0x00);
      mem.write8(CUTSCENE_SPRITE_X, 0x9f);
    }
    return;
  }
  if (counter !== SOUND_AT) return;

  // The sound cue, plus the four-byte object record that goes with it.
  mem.write8(SND_PRIORITY, mem.read8(LEVEL) & 0x01 ? 0x0c : 0x05); // odd LEVEL -> 0x0C, even -> 0x05
  mem.write8(SND_PRIORITY_FRAMES, 0x03);
  mem.write8(FINALE_OBJECT_RECORD + 0, 0x8f);
  mem.write8(FINALE_OBJECT_RECORD + 1, 0x76);
  mem.write8(FINALE_OBJECT_RECORD + 2, 0x09);
  mem.write8(FINALE_OBJECT_RECORD + 3, 0x40);
  // Left half of the screen: the record's first byte is patched over.
  if (mem.read8(MARIO_X) < SCREEN_MIDPOINT) {
    mem.write8(FINALE_OBJECT_RECORD, FINALE_OBJECT_BYTE0_LEFT);
  }
}

/**
 * The counter's 0-crossing tail: step the board order on to the next board, count the level, and
 * hand the game to the interlude sub-state.
 */
function advanceBoardSequence(m) {
  const { regs, mem } = m;

  // Walk BOARD_SEQ_PTR to the next entry; on the terminator, restart the repeating group.
  let ptr = (mem.read16(BOARD_SEQ_PTR) + 1) & 0xffff;
  let nextBoard = mem.read8(ptr);
  if (nextBoard === BOARD_TABLE_TERMINATOR) {
    ptr = BOARD_TABLE_REPEAT_GROUP;
    nextBoard = mem.read8(ptr);
  }
  mem.write16(BOARD_SEQ_PTR, ptr);
  mem.write8(BOARD, nextBoard);
  mem.write8(LEVEL, (mem.read8(LEVEL) + 1) & 0xff); // one completed level

  // Post the deferred task [opcode 0x05, arg 0x00] onto the task ring.
  regs.de = 0x0500;
  enqueueTask(m);

  // Reset the interlude bookkeeping and hand off to sub-state 8.
  mem.write8(HOW_HIGH_INDEX, 0x00);
  mem.write8(BOARD_ADVANCE_STEP, 0x00); // reset the board-advance / interlude sequence step
  mem.write8(SUBSTATE_TIMER, 0xe0); // wait this many frames…
  mem.write8(GAME_SUBSTATE, 0x08); // …then advance to sub-state 8
}
