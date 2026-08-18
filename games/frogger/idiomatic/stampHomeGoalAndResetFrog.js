// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeGoalAndResetFrog — the shared home-goal fill and frog reset, reached once the frog is
 * awarded a home bay. When a collision is latched it first adds the bonus score and clears the
 * sprite block; it stamps the 2x2 home tiles at the caller's slot HL, adds the home bonus, and
 * refreshes the score display. In play mode it also queues the arrival jingle and, on this player's
 * fourth home, clears the player work RAM and a board strip, else selects the next fanfare pointer.
 * Finally it reseeds the frog object (X/sprite/attr cleared, Y parked off-screen) and the up-hop and
 * countdown state so the next frog starts fresh. LIVE-OUT: memory-only.
 */
import { COLLISION_SUBFLAG, PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SLOT, PLAYER2_SLOT, HOME_COLUMN_STATE, FLY_SPRITE_X, FROG_X, FROG_SPRITE_CODE, FROG_Y, FROG_HOP_UP_ARRIVAL, FROG_HOP_UP_ACTIVE, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_INPUT_TIMER, GATED_COUNTDOWN_COUNTER, GATED_COUNTDOWN_ENABLE_FLAG, FROG_STATE_DEMO_FLAG, INTRO_COUNTER_829B, BOARD_LAYOUT_GATE, FROG_OBJ_ATTR, FANFARE_TABLE, FANFARE_INDEX, SOUND_SEQUENCE_COUNTDOWN, OBJRAM_FLY_SPRITE_BASE } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { clearCollisionSpriteBlock } from "./clearCollisionSpriteBlock.js";
import { armScoreBonusStrip } from "./driveScoreDisplayCountdown.js";
import { u16 } from "../../../core/int.js";

const BONUS_DELTA = 0x20, HOME_DELTA = 0x05;

export function stampHomeGoalAndResetFrog(m, hl = m.regs.hl) {
  const { mem8, mem16 } = m;

  if (mem8[COLLISION_SUBFLAG] !== 0) {
    addScoreAndAwardExtraLife(m, BONUS_DELTA);
    clearCollisionSpriteBlock(m);
    hl = u16(FLY_SPRITE_X + 3); // the clear walks HL to the block's last cell; the stamp reads it here
  }

  mem8[hl] = 0x6c;
  hl = u16(hl + 1);
  mem8[hl] = 0x6d;
  hl = u16(hl + 0x1f);
  mem8[hl] = 0x6e;
  hl = u16(hl + 1);
  mem8[hl] = 0x6f;

  addScoreAndAwardExtraLife(m, HOME_DELTA);
  armScoreBonusStrip(m);

  if (mem8[PLAY_FLAG] !== 0) {
    mem16[SOUND_SEQUENCE_COUNTDOWN] = 0;
    enqueueSoundCommand(m, 0x00);
    enqueueSoundCommand(m, 0xf0);

    const countCell = mem8[ACTIVE_PLAYER] === 1 ? PLAYER1_SLOT : PLAYER2_SLOT;
    if (mem8[countCell] === 0x04) {
      mem8[HOME_COLUMN_STATE] = mem8[countCell];
      clearActivePlayerWorkRam(m);
      for (let i = 0; i < 0x18; i++) mem8[(OBJRAM_FLY_SPRITE_BASE + i)] = 0;
      clearCollisionSpriteBlock(m);
    } else {
      enqueueSoundCommand(m, 0x08);
      enqueueSoundCommand(m, 0x0e);
      let idx = (mem8[FANFARE_INDEX] - 1) & 0xff;
      if (idx === 0) idx = 0x14;
      mem8[FANFARE_INDEX] = idx;
      let l = (0x87 + 2 * idx) & 0xff;
      const lo = mem8[(FANFARE_TABLE & ~0xff) | l];
      l = (l + 1) & 0xff;
      const hi = mem8[(FANFARE_TABLE & ~0xff) | l];
      mem16[SOUND_SEQUENCE_COUNTDOWN] = lo | (hi << 8);
    }
  }

  mem8[GATED_COUNTDOWN_COUNTER] = 0x20;
  enqueueSoundCommand(m, 0x80);
  mem8[FROG_X] = 0;
  mem8[FROG_SPRITE_CODE] = 0;
  mem8[FROG_OBJ_ATTR] = 0;
  mem8[FROG_Y] = 0xf0;
  mem8[INTRO_COUNTER_829B] = 0;
  mem8[BOARD_LAYOUT_GATE] = 0;
  mem8[FROG_HOP_UP_ARRIVAL] = 0;
  mem8[FROG_HOP_UP_ACTIVE] = 0;
  mem8[FROG_HOP_UP_ANIM_COUNTER] = 0;
  mem8[GATED_COUNTDOWN_ENABLE_FLAG] = 1;
  mem8[FROG_STATE_DEMO_FLAG] = 1;
  mem8[FROG_HOP_INPUT_TIMER] = 0x10;
}
