// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveInPlayFrameUpdate  —  ROM 0x2341  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The in-play per-frame update dispatcher: the single routine that advances one displayed frame of an
 *   ACTIVE game. It does no work of its own — it is a fixed running order that hands the frame, in turn,
 *   to eleven sub-engines (attract-hop, collision/input, render+timer, score countdown, scroll, sprite
 *   animation, lane resolver, death animation, gated countdown, lane mover). Everything that actually
 *   moves the game forward this frame happens inside those eleven calls.
 *
 * WHERE IT SITS
 *   Called once per displayed frame by the vblank NMI (serviceVblankNmi 0x0066), the machine's frame
 *   clock and sole per-frame accumulator. The NMI calls this routine on BOTH its in-play and its
 *   attract/intro arms — which is exactly why the two guards below matter: outside active play the call
 *   must fall straight through as a bare return, doing nothing, so attract frames step their own
 *   sequencer instead. When a game IS live, this is the whole gameplay cascade for the frame.
 *
 * LIVE-OUT
 *   Memory only. Every effect is a RAM/VRAM write made by one of the eleven sub-engines; this dispatcher
 *   writes nothing itself and returns nothing the caller reads. (The final call is a plain tail return —
 *   its value is discarded; the caller only cares that the frame was stepped.)
 */
import { GAME_MODE, INTRO_COUNTER_829B } from "./names.js";
import { driveAttractDemoFrogHop } from "./driveAttractDemoFrogHop.js";
import { orchestrateCollisionsAndFrogInput } from "./orchestrateCollisionsAndFrogInput.js";
import { advanceAttractDemoFrogHop } from "./advanceAttractDemoFrogHop.js";
import { renderFrogSceneAndTickTimer } from "./renderFrogSceneAndTickTimer.js";
import { driveScoreDisplayCountdown } from "./driveScoreDisplayCountdown.js";
import { advanceScrollLaneObjects } from "./advanceScrollLaneObjects.js";
import { advanceAnimationFrameBuffer } from "./advanceAnimationFrameBuffer.js";
import { dispatchFrogMoveAgainstLanes } from "./dispatchFrogMoveAgainstLanes.js";
import { driveFrogDeathAnimation } from "./driveFrogDeathAnimation.js";
import { tickGatedCountdown } from "./tickGatedCountdown.js";
import { moveLaneObjectsAndCarryFrog } from "./moveLaneObjectsAndCarryFrog.js";

// INTRO_COUNTER_829B (0x829b) is the "board is laid out" run flag when read here. It is zeroed during the
// mode-2 intro setup (renderMode2IntroScreen 0x2d88) and raised to 1 by the once-per-life board layout
// setUpPlayStartOnce (0x230f) only after that layout has fully run. Aliasing it as RUN_FLAG names the role
// it plays in THIS routine's gate; the underlying cell is unchanged.
const RUN_FLAG = INTRO_COUNTER_829B;

export function driveInPlayFrameUpdate(m) {
  const { mem8 } = m;

  // ── Gate 1: are we in an active game? ────────────────────────────────────────────────
  // GAME_MODE (0x83d6) is the top-level mode byte; mode 1 is active play (modes >= 2 are intro/attract/
  // point-table screens, mode 0 is the attract demo). The NMI calls this routine on its attract arm too,
  // so anything but mode 1 must bare-return — otherwise the gameplay cascade would run over a screen that
  // has no live board.
  if (mem8[GAME_MODE] !== 1) return;

  // ── Gate 2: has the board finished laying out? ───────────────────────────────────────
  // Even in mode 1, the first frames of a life run while setUpPlayStartOnce (0x230f) is still building the
  // board; it sets RUN_FLAG (INTRO_COUNTER_829B, 0x829b) = 1 only once that layout is complete. Until then
  // the flag is 0 and we return, so the cascade never steps a half-built board.
  if (mem8[RUN_FLAG] === 0) return;

  // ── The fixed per-frame sub-engine sequence ──────────────────────────────────────────
  // From here every line is a plain direct call, run in this exact order every in-play frame. The order is
  // load-bearing: input/collision is resolved before the world scrolls, and the lane mover runs last so it
  // carries the frog on top of this frame's already-resolved state.

  // Attract-demo hop driver (0x236d): begins one scripted directional hop of the auto-frog. It self-gates
  // to the attract demo (GAME_MODE==1 && PLAY_FLAG 0x83fe == 0), so in a real game it is effectively inert;
  // it stays in the sequence because the demo reuses this very cascade to animate its ghost frog.
  driveAttractDemoFrogHop(m);

  // Master collision + input orchestrator (0x1a55): reads the player's joystick, moves/kills the frog,
  // and awards home-bay goals — the heart of the frame. Its goal-award path still tail-transfers into
  // translated home-bay handlers, so this one call remains oracle-served at the seam.
  orchestrateCollisionsAndFrogInput(m);

  // Attract-demo hop continuation (0x23b7): steps any hop begun by 0x236d one frame further, or clears the
  // per-direction arrival mirrors. Paired 1:1 with the hop-begin driver above; likewise attract-only in
  // effect during real play.
  advanceAttractDemoFrogHop(m);

  // Frog-scene render + timer tick (0x0942): ticks the active player's time-remaining counter
  // (TIME_REMAINING_P1 0x83e5 / _P2 0x83e6), draws the frog + object banner and status row, and stamps
  // occupied home slots. This is where the on-screen scene for the frame is composed.
  renderFrogSceneAndTickTimer(m);

  // Score-display countdown (0x0870): advances the score/bonus display state machine one step.
  driveScoreDisplayCountdown(m);

  // Scroll driver (0x2005): steps the two background scroll objects and the master phase counter, redrawing
  // the river/road bands incrementally. Runs after render so the scroll advances off this frame's scene.
  advanceScrollLaneObjects(m);

  // Sprite frame-animation buffer (0x1802): ticks ANIM_FRAME_TIMER (0x81b4) and, when it drains, advances
  // the frame index and copies the next 11-byte animation frame into the sprite frame buffer.
  advanceAnimationFrameBuffer(m);

  // Frog-vs-lane resolver (0x11bf): resolves the frog against the lane object lists — which log/turtle it
  // is standing on, whether it drowned, whether it is carried. Runs after the scroll step has updated the
  // lane geometry for this frame.
  dispatchFrogMoveAgainstLanes(m);

  // Frog death animation (0x16f8): if the frog is dying, steps its death animation one frame.
  driveFrogDeathAnimation(m);

  // Gated countdown tick (0x1fc7): while GATED_COUNTDOWN_ENABLE_FLAG (0x826c) is set, decrements
  // GATED_COUNTDOWN_COUNTER (0x826a) and disarms the flag at 0 — the generic "hold everything for N frames"
  // timer used around board transitions.
  tickGatedCountdown(m);

  // Lane-object mover (0x14b7): shifts every lane object's sprite run for this frame and carries a riding
  // frog along with its log/turtle. It runs LAST so it moves the world on top of the fully resolved frame.
  // Returned as a plain tail call: the value is discarded, this is just the final step of the sequence.
  return moveLaneObjectsAndCarryFrog(m);
}
