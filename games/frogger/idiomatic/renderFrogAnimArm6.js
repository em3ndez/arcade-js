// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm6 — frog-animation arm 6: arm the shared render loop for this sprite, then enter it.
 * Reads the arm's triple, points the cursors and pattern pointer, stashes code and source where the
 * render loop rereads them, then runs it. LIVE-OUT: memory-only.
 */
import { FROG_ANIM_ARM6_SPRITE_CODE, FROG_ANIM_ARM6_ROW_COUNT, FROG_ANIM_ARM6_PASS_COUNT, FROG_ANIM_ARM6_DEST_PTR, FROG_ANIM_ARM6_SRC_BASE, LANE_OBJLIST_8136, SCROLL_COPY_COLUMN_STRIDE, SCROLL_COPY_SRC_PTR } from "./names.js";
import { renderFrogAnimTileColumns } from "./renderFrogAnimTileColumns.js";

export function renderFrogAnimArm6(m) {
  const { mem8, mem16 } = m;

  const spriteCode = mem8[FROG_ANIM_ARM6_SPRITE_CODE];
  const rowCount = mem8[FROG_ANIM_ARM6_ROW_COUNT];
  const passCount = mem8[FROG_ANIM_ARM6_PASS_COUNT];
  const dest = mem16[FROG_ANIM_ARM6_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = spriteCode;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM6_SRC_BASE;

  return renderFrogAnimTileColumns(m, rowCount, passCount, dest, FROG_ANIM_ARM6_SRC_BASE, LANE_OBJLIST_8136, LANE_OBJLIST_8136);
}
