// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetFrogObject  —  ROM 0x09aa  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The frog "spawn" routine. It parks a fresh frog at its home starting square and wipes the
 *   per-frog progress/state so the next life (or the demo frog) begins from a clean slate. It writes
 *   the four bytes of the frog's object block, clears four scattered state cells, and raises the
 *   frog-ready flag.
 *
 * WHERE IT SITS
 *   Called from two places: the once-per-life start-of-play layout (setUpPlayStartOnce, 0x1e-guarded)
 *   lays the board and then spawns the frog here; and the per-frame frog-scene core
 *   (renderFrogSceneAndTickTimer, ROM 0x0942) re-spawns the frog on the demo/attract path. It is a
 *   plain leaf — no gates, no branches: every call writes all six cells and returns.
 *
 * LIVE-OUT
 *   Memory (the six cells below) plus A. In the ROM the routine returns with A = 1 — the same
 *   frog-ready value it just stored into FROG_READY_FLAG. renderFrogSceneAndTickTimer passes that A
 *   straight up to the board-setup caller, which latches it into BOARD_LAYOUT_GATE (0x83ea). So the
 *   `return (m.regs.a = 1)` below is load-bearing: dropping it would leave the board-layout gate unset.
 */
import { FROG_X, FROG_STATE_DEMO_FLAG, loc_842d, loc_842c, FROG_FURTHEST_ROW, FROG_READY_FLAG } from "./names.js";

// The four bytes of the frog object block, written in address order starting at FROG_X (0x8044):
//   [0] FROG_X          (0x8044) = 128 (0x80)  — home starting column, mid-field
//   [1] FROG_SPRITE_CODE(0x8045) =  30 (0x1e)  — the UP-facing rest sprite (a frog at rest, facing up)
//   [2] FROG_OBJ_ATTR   (0x8046) =   3         — object colour/attribute byte for a live frog
//                                                (the death animation later drives this to 7)
//   [3] FROG_Y          (0x8047) = 224 (0xe0)  — home starting row; 0xe0 is the bottom of the field
//                                                (Y counts down 0xe0=bottom -> 0x40=top as it climbs)
const FROG_OBJECT_INIT = [128, 30, 3, 224];

export function resetFrogObject(m) {
  const { mem8 } = m;

  // ── Spawn: seed the frog's object block ───────────────────────────────────────────────
  // Stamp the four object bytes into the FROG_X (0x8044) block so the frog appears at its home
  // square, upright and alive. The move dispatcher and the hop/animation code all read this block,
  // so this is what actually places the new frog on screen.
  for (let i = 0; i < FROG_OBJECT_INIT.length; i++) mem8[FROG_X + i] = FROG_OBJECT_INIT[i];

  // ── Take the frog out of the demo/frozen state ────────────────────────────────────────
  // FROG_STATE_DEMO_FLAG (0x83cd) is the demo/frozen gate: the board-completion re-arm (loc_05d3)
  // and the attract demo set it to 1, and while it is set the move dispatcher returns early and the
  // per-frame timer stops ticking. Clearing it here makes the freshly spawned frog live and
  // interactive again.
  mem8[FROG_STATE_DEMO_FLAG] = 0;

  // ── Re-arm the one-shot display-field layout ──────────────────────────────────────────
  // loc_842d (0x842d) is a frog-state cell that elsewhere guards the once-per-board display-field
  // layout (initDisplayFieldOnce sets it and then early-returns while it is set). Clearing it back
  // to 0 re-arms that one-shot so the field can lay out again for the new frog.
  mem8[loc_842d] = 0;

  // ── Release the global object-motion gate ─────────────────────────────────────────────
  // loc_842c (0x842c) is a frog-state cell that elsewhere acts as the global sprite-object motion
  // gate: the sprite-object mover (0x29f9) only runs while it is 0, and the frog-hit test
  // (flagSpriteObjectFrogHit) raises it on a collision to halt motion. Clearing it lets the lane
  // objects move again around the new frog.
  mem8[loc_842c] = 0;

  // ── Reset the row-progress high-water mark ────────────────────────────────────────────
  // FROG_FURTHEST_ROW (0x8269) records the nearest-to-top row the frog has reached; scoreFrogRowProgress
  // awards a point only when the frog beats this mark. Zeroing it means the new frog scores fresh from
  // the bottom rather than inheriting the previous frog's progress.
  mem8[FROG_FURTHEST_ROW] = 0;

  // ── Raise the frog-ready flag ─────────────────────────────────────────────────────────
  // FROG_READY_FLAG (0x83c3) signals that the frog object is now fully spawned and ready. This is the
  // last write, and its value (1) is also what the routine hands back in A.
  mem8[FROG_READY_FLAG] = 1;

  // Return the ready value in A. The render caller (renderFrogSceneAndTickTimer) relays it up to be
  // stored into BOARD_LAYOUT_GATE (0x83ea) — see LIVE-OUT above.
  return (m.regs.a = 1);
}
