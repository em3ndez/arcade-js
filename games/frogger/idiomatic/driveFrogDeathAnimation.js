// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFrogDeathAnimation  —  ROM 0x16f8  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The frog's death / hold-frame animation driver. When a frog has been killed (or a home-bay landing
 *   put it in the "held" state), the frog stops taking input and this routine plays out the death: it
 *   steps a short sequence of death-sprite frames, dwelling 16 vblanks on each, and — when the sequence
 *   finishes — re-activates the frog for the next life (or resets the attract demo). It runs once per
 *   vblank while the hold flag is up, and is a no-op on every other frame.
 *
 *   There are TWO death sequences, chosen by SECOND_BANK (0x829c). That cell is raised by the shared
 *   frog-kill tail (killFrogAtLane, 0x12d0) ONLY when the frog dies in the mid-river band
 *   (0x30 <= FROG_Y < 0x80) — i.e. a drowning. So SECOND_BANK set = the shorter mid-river DROWN sequence;
 *   SECOND_BANK clear = the longer road/land SQUASH sequence.
 *
 * WHERE IT SITS
 *   Called once per frame from the in-play cascade (alongside advanceScrollLaneObjects,
 *   dispatchFrogMoveAgainstLanes, driveSpriteObjectCluster, …). The hold flag HOLD_FLAG (0x8004) is its
 *   gate: an idle, living frog hits the very first `return` and this routine does nothing. Only once
 *   something has raised HOLD_FLAG (a kill, or a home-bay hold) does the body run. The next-life handoff
 *   it arms (LIFE_RESTART_FLAG, 0x83ce) is read downstream by beginNextLifeOrIntro.
 *
 * LIVE-OUT
 *   Memory only. It stamps sprite/state cells, queues sound, and toggles flags; it returns nothing and
 *   leaves no register the caller reads.
 */
import { HOLD_FLAG, FIGURE_ANIM_STEP_GATE, FROG_ANIM_BLIT_TRIGGER, HOME_BAY_SLOT_CURSOR_MIRROR, PENDING_HOME_BAY_SLOT, FROG_SPRITE_CODE, FROG_FURTHEST_ROW, FROG_HOP_DOWN_ACTIVE, FROG_HOP_LEFT_ANIM_COUNTER, GAME_MODE, PLAY_FLAG, TWO_PLAYER_START_FLAG, IN_PLAY_BOARD_STATE_BYTE, COUNTDOWN_EXPIRY_FLAG, SCROLL_STAMP_PHASE, SCROLL_EDGE_FLAG, SCROLL_STAMP_ROWCOUNT, SCROLL_BAND_ROWSPAN, HOP_FRAME_COUNTER, LIFE_RESTART_FLAG, SECOND_BANK, FROG_OBJ_ATTR, DEATH_PHASE, ATTRACT_HOP_DWELL, SOUND_SEQUENCE_COUNTDOWN } from "./names.js";
import { stampHomeBaySlot } from "./stampHomeBaySlot.js";
import { activateFrogObject } from "./activateFrogObject.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearTwoPlayerFrameCells } from "./clearTwoPlayerFrameCells.js";
import { clearLatchedCollision } from "./clearLatchedCollision.js";

// The death sequence dwells this many vblanks on each sprite frame: HOP_FRAME_COUNTER (0x8247) ticks once
// per call and only when it reaches 0x10 (16) does the phase advance to the next frame. So each death
// sprite is shown for 16 frames.
const FRAMES_PER_DEATH_PHASE = 0x10;

export function driveFrogDeathAnimation(m) {
  const { mem8 } = m;

  // ── Gate: only a held/dead frog animates ─────────────────────────────────────────────
  // HOLD_FLAG (0x8004) is the object-frog hit / hold flag. It is 0 for a living frog under player
  // control, and raised to 1 by a kill (killFrogAtLane) or a home-bay hold. If it is clear there is no
  // death to drive — return at once. This early-out is why the routine costs nothing on ordinary frames.
  if (mem8[HOLD_FLAG] === 0) return;

  // ── Keep the frog-anim blit in step with the two-pair figure ──────────────────────────
  // FIGURE_ANIM_STEP_GATE (0x8150) bit0 is raised by animateTwoPairFigure while a river diver figure is
  // mid-animation. When it is set, forward that as a one-shot to FROG_ANIM_BLIT_TRIGGER (0x8118), which
  // tells blitFrogAnimColumnOnTrigger to blit the frog's animation tile pair this frame (it self-clears
  // after blitting). This keeps the frog's column redrawn in lock-step with the figure.
  if (mem8[FIGURE_ANIM_STEP_GATE] & 0x01) mem8[FROG_ANIM_BLIT_TRIGGER] = 1;

  // ── Keep the empty-bay creature animation ticking ─────────────────────────────────────
  // The home bays animate a creature (fly/gator) while the frog is held. HOME_BAY_SLOT_CURSOR_MIRROR
  // (0x8120) names the bay a gator is currently surfacing in (0 = none). If it names a bay, republish it
  // into PENDING_HOME_BAY_SLOT (0x8121) so the stampHomeBaySlot call below erases the creature from the
  // right bay. (This mirrors what stampHomeBayGatorFull does during normal play.)
  if (mem8[HOME_BAY_SLOT_CURSOR_MIRROR] !== 0) mem8[PENDING_HOME_BAY_SLOT] = mem8[HOME_BAY_SLOT_CURSOR_MIRROR];

  // Erase the creature tile from the bay named by PENDING_HOME_BAY_SLOT (skips a bay whose occupancy gate
  // is already filled; leaves the selector pending while HOLD_FLAG is set), then reset any latched
  // collision left over from the kill (clearLatchedCollision is a no-op unless a collision is latched).
  stampHomeBaySlot(m);
  clearLatchedCollision(m);

  // ── Dwell on the current death frame ──────────────────────────────────────────────────
  // Tick the per-frame death counter HOP_FRAME_COUNTER (0x8247, mod 256). Until it reaches the 16-frame
  // dwell we are still holding on the current death sprite, so return without advancing the phase.
  const nextHopFrame = (mem8[HOP_FRAME_COUNTER] + 1) & 0xff;
  mem8[HOP_FRAME_COUNTER] = nextHopFrame;
  if (nextHopFrame !== FRAMES_PER_DEATH_PHASE) return;

  // ── The dwell elapsed: advance to the next death phase ────────────────────────────────
  // Reload the dwell counter to 0, re-assert the frog object's attribute byte FROG_OBJ_ATTR (0x8046) = 7
  // (kept set as the death advances), and bump the death-phase index DEATH_PHASE (0x81b2).
  mem8[HOP_FRAME_COUNTER] = 0;
  mem8[FROG_OBJ_ATTR] = 0x07;
  const phase = (mem8[DEATH_PHASE] + 1) & 0xff;
  mem8[DEATH_PHASE] = phase;

  // Dispatch on the new phase, keyed by which death sequence we are in (SECOND_BANK, 0x829c):
  //   - mid-river DROWN (bank set):   phases 1..4 stamp sprites, phase 5 is the terminal reset.
  //   - road/land SQUASH (bank clear): phases 1..5 stamp sprites, phase 6 is the terminal reset.
  // The drown sequence is one frame shorter than the squash.
  if (mem8[SECOND_BANK] !== 0) {
    if (phase === 0x05) return advanceBoardAndReset(m);
    return stampDeathTile(m, phase);
  }
  if (phase === 0x06) return advanceBoardAndReset(m);
  return stampDeathTile(m, phase);
}

/**
 * Terminal phase: the death animation is over — bring the frog back for the next life and wipe the
 * death/hop state. In the attract demo (no real player) this instead recycles the scripted board.
 */
function advanceBoardAndReset(m) {
  const { mem8 } = m;

  // Re-activate the frog object (marks it active and clears its sprite code + Y), then clear every cell
  // the death carried: the phase index DEATH_PHASE (0x81b2), the hold flag HOLD_FLAG (0x8004) so the frog
  // takes input again, the dwell counter HOP_FRAME_COUNTER (0x8247), the row-progress high-water mark
  // FROG_FURTHEST_ROW (0x8269), and the mid-river death cell SECOND_BANK (0x829c).
  activateFrogObject(m);
  mem8[DEATH_PHASE] = 0;
  mem8[HOLD_FLAG] = 0;
  mem8[HOP_FRAME_COUNTER] = 0;
  mem8[FROG_FURTHEST_ROW] = 0;
  mem8[SECOND_BANK] = 0;

  // Zero the whole contiguous hop-direction state block, FROG_HOP_DOWN_ACTIVE (0x8248) through
  // FROG_HOP_LEFT_ANIM_COUNTER (0x8253): all four directions' active flags, arrival latches, and anim
  // counters, so the next life starts every hop direction from rest.
  for (let addr = FROG_HOP_DOWN_ACTIVE; addr <= FROG_HOP_LEFT_ANIM_COUNTER; addr++) mem8[addr] = 0;

  // Arm the next-life handoff: LIFE_RESTART_FLAG (0x83ce) is read by beginNextLifeOrIntro, which resumes
  // play (or rolls to game-over) once it sees this set.
  mem8[LIFE_RESTART_FLAG] = 1;

  // Attract-demo tail only: GAME_MODE (0x83d6) == 1 with PLAY_FLAG (0x83fe) == 0 (0 = attract, no coined
  // game). The auto-piloted attract frog just "finished", so drop back to attract mode 0 and reset the
  // demo's board-state cells — the hop-dwell ATTRACT_HOP_DWELL (0x8299), the board-state byte
  // IN_PLAY_BOARD_STATE_BYTE (0x829a), and the 2-player start flag TWO_PLAYER_START_FLAG (0x825b) — so the
  // scripted demo restarts clean. A real game (PLAY_FLAG 1/2) skips this and just begins the next life.
  if (mem8[GAME_MODE] === 1 && mem8[PLAY_FLAG] === 0) {
    mem8[GAME_MODE] = 0;
    mem8[ATTRACT_HOP_DWELL] = 0;
    mem8[IN_PLAY_BOARD_STATE_BYTE] = 0;
    mem8[TWO_PLAYER_START_FLAG] = 0;
  }
}

/**
 * Non-terminal phase: stamp this phase's death sprite into FROG_SPRITE_CODE (0x8045). The sprite codes
 * differ per bank (drown vs squash), the first frame of each also fires the death jingle, and the final
 * sprite frame (the phase just before the terminal reset) additionally clears play-state cells and seeds
 * the post-death dwell.
 */
function stampDeathTile(m, phase) {
  const { mem8, mem16 } = m;

  // ── Mid-river DROWN sequence (SECOND_BANK set) ────────────────────────────────────────
  if (mem8[SECOND_BANK] !== 0) {
    if (phase === 1) {
      // First drown frame: sprite 0x22, plus the drown jingle. Zero the 16-bit sound-sequence countdown
      // SOUND_SEQUENCE_COUNTDOWN (0x8382) first, then queue sound command 0 followed by the drown id 0x02.
      mem8[FROG_SPRITE_CODE] = 0x22;
      mem16[SOUND_SEQUENCE_COUNTDOWN] = 0;
      enqueueSoundCommand(m, 0);
      enqueueSoundCommand(m, 0x02);
      return;
    }
    if (phase === 2) { mem8[FROG_SPRITE_CODE] = 0x23; return; } // intermediate drown frame
    if (phase === 3) { mem8[FROG_SPRITE_CODE] = 0x24; return; } // intermediate drown frame

    // Final drown frame (phase 4): common end sprite 0x3c, then clear the play-state / scroll cells and
    // seed the post-death dwell. The drown path resets more scroll cells than the squash path below —
    // COUNTDOWN_EXPIRY_FLAG (0x83ae), SCROLL_STAMP_PHASE (0x8110), SCROLL_EDGE_FLAG (0x8107),
    // SCROLL_STAMP_ROWCOUNT (0x811a), SCROLL_BAND_ROWSPAN (0x8119) — clears the two-player frame cells, and
    // reloads SOUND_SEQUENCE_COUNTDOWN (0x8382) to 0xd8 to time the pause before the next life.
    mem8[FROG_SPRITE_CODE] = 0x3c;
    mem8[COUNTDOWN_EXPIRY_FLAG] = 0;
    mem8[SCROLL_STAMP_PHASE] = 0;
    mem8[SCROLL_EDGE_FLAG] = 0;
    mem8[SCROLL_STAMP_ROWCOUNT] = 0;
    mem8[SCROLL_BAND_ROWSPAN] = 0;
    clearTwoPlayerFrameCells(m);
    mem16[SOUND_SEQUENCE_COUNTDOWN] = 0xd8;
    return;
  }

  // ── Road/land SQUASH sequence (SECOND_BANK clear) ─────────────────────────────────────
  if (phase === 1) {
    // First squash frame: sprite 0x39, plus the squash jingle. Zero SOUND_SEQUENCE_COUNTDOWN (0x8382),
    // then queue sound command 0 followed by the road-death id 0x03.
    mem8[FROG_SPRITE_CODE] = 0x39;
    mem16[SOUND_SEQUENCE_COUNTDOWN] = 0;
    enqueueSoundCommand(m, 0);
    enqueueSoundCommand(m, 0x03);
    return;
  }
  if (phase === 2) { mem8[FROG_SPRITE_CODE] = 0x39; return; } // intermediate squash frame
  if (phase === 3) { mem8[FROG_SPRITE_CODE] = 0x3a; return; } // intermediate squash frame
  if (phase === 4) { mem8[FROG_SPRITE_CODE] = 0x3b; return; } // intermediate squash frame

  // Final squash frame (phase 5): common end sprite 0x3c, clear COUNTDOWN_EXPIRY_FLAG (0x83ae) and the
  // two-player frame cells, and reload SOUND_SEQUENCE_COUNTDOWN (0x8382) to 0xd8 for the pre-next-life
  // pause.
  mem8[FROG_SPRITE_CODE] = 0x3c;
  mem8[COUNTDOWN_EXPIRY_FLAG] = 0;
  clearTwoPlayerFrameCells(m);
  mem16[SOUND_SEQUENCE_COUNTDOWN] = 0xd8;
}
