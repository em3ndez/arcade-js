// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm6 — frog-animation render arm 6  ·  ROM 0x10f8  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   One of the eleven render arms of the frog-animation pipeline. An "arm" repaints a single lane of
 *   moving sprite objects by stamping a strip of tile-columns into VRAM and, as a side effect, rewriting
 *   that lane's on-screen sprite X-positions. Arm 6 owns lane nibble 9: it draws into VRAM and, crucially,
 *   repopulates the lane object list LANE_OBJLIST_8136 (0x8136) — the very list the frog-vs-lane move
 *   resolver scans a moment later for collisions.
 *
 * WHERE IT SITS
 *   dispatchFrogAnimationArm (0x0faf) reads the animation-index cell (0x8000) every frame and jumps to the
 *   arm named by that index; arm 6 is one of its eleven targets. Every arm is a thin front end that loads
 *   its own parameters and then dives into the ONE shared tile-column loop, renderFrogAnimTileColumns
 *   (0x0ff1), which does the actual VRAM stamping and sprite plotting. Arm 6 is the sibling of arms 0 and
 *   1; unlike arm 1 it has no guarded pre-blit, so it goes straight to the loop.
 *
 *   The cross-link is what makes the pipeline matter: arm 6's plot-cursor base IS the lane object list the
 *   collision resolver reads back. Rendering the lane and seeding its collision scan are two ends of one
 *   data structure, so arm 6 must run on every scene render to keep lane 9's sprite X-positions current.
 *
 * LIVE-OUT
 *   Memory only. It writes two shared scratch cells, then the render loop it tail-calls stamps VRAM and
 *   the sprite cursors. It returns nothing the caller reads.
 */
import { FROG_ANIM_ARM6_SPRITE_CODE, FROG_ANIM_ARM6_ROW_COUNT, FROG_ANIM_ARM6_PASS_COUNT, FROG_ANIM_ARM6_DEST_PTR, FROG_ANIM_ARM6_SRC_BASE, LANE_OBJLIST_8136, SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR } from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm6(m) {
  const { mem8, mem16 } = m;

  // ── Load arm 6's parameter triple + its VRAM destination ────────────────────────────────
  // Every arm draws from a three-byte "triple" that tunes its blit. The eleven triples are packed
  // contiguously in ACTIVE_LANE_PARAM_BLOCK (0x8270) and refreshed each life from the active player's
  // per-board difficulty table, so board difficulty scales every arm's row and column counts. Arm 6's
  // triple sits at +18..+20, aliased here as three separately-named cells:
  //   • FROG_ANIM_ARM6_SPRITE_CODE (0x8282) — the triple's sprite/stride byte; becomes the amount the
  //                                           render loop advances the destination between columns.
  //   • FROG_ANIM_ARM6_ROW_COUNT   (0x8283) — rows copied per column (the render loop's B).
  //   • FROG_ANIM_ARM6_PASS_COUNT  (0x8284) — number of columns to draw (the render loop's C; 0 => 256).
  // The VRAM base does not live in RAM: it is a ROM pointer-table entry at 0x13ed + 2·arm. Arm 6's slot is
  // the ROM word FROG_ANIM_ARM6_DEST_PTR (0x13f9), dereferenced here into the destination address.
  const spriteCode = mem8[FROG_ANIM_ARM6_SPRITE_CODE];
  const rowCount = mem8[FROG_ANIM_ARM6_ROW_COUNT];
  const passCount = mem8[FROG_ANIM_ARM6_PASS_COUNT];
  const destPtr = mem16[FROG_ANIM_ARM6_DEST_PTR];

  // ── Publish the stride + tile source where the shared loop rereads them ─────────────────
  // renderFrogAnimTileColumns does not keep the stride and the source in registers across its per-column
  // iterations — it reloads both from two fixed scratch cells at the top of each column. So the arm must
  // stage them before entering:
  //   • SCROLL_COPY_COLUMN_STRIDE (0x81b1) ← the triple's stride byte (spriteCode), the destination step
  //     between columns.
  //   • SCROLL_COPY_SRC_PTR (0x8001) ← the arm-6 tile-source base FROG_ANIM_ARM6_SRC_BASE (0x149f). This
  //     is a ROM address written as an immediate (not a memory read), which the loop reloads to restart
  //     each column at the top of the same source block.
  mem8[SCROLL_COPY_COLUMN_STRIDE] = spriteCode;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM6_SRC_BASE;

  // ── Enter the shared tile-column render loop ────────────────────────────────────────────
  // Hand the loop arm 6's parameters directly: rowCount rows per column, passCount columns, destPtr as the
  // VRAM base, FROG_ANIM_ARM6_SRC_BASE (0x149f) as the initial tile source, and LANE_OBJLIST_8136 (0x8136)
  // as BOTH plot cursors — the IX cursor it stamps negated sprite X-positions into and the IY cursor it
  // bumps. Passing the lane list as the cursor is the cross-link described above: the loop rewrites the
  // exact object list the collision resolver will scan. The final `borrow` argument is left unpassed so it
  // defaults to the live carry flag (m.regs.fC), matching the ROM's fall-through into the loop. This is a
  // tail call, so the loop's memory-only result is arm 6's result.
  return renderFrogAnimTileColumns(m, rowCount, passCount, destPtr, FROG_ANIM_ARM6_SRC_BASE, LANE_OBJLIST_8136, LANE_OBJLIST_8136);
}
