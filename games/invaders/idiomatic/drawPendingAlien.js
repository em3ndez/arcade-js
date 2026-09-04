// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { PLAYER_SHOT_HIT, ACTIVE_PLAYER_PAGE, loc_2004, ALIEN_MARCH_FRAME_TOGGLE, ALIEN_DRAW_INDEX, ALIEN_SPRITE_TABLE, ALIEN_DRAW_ADDR, ALIEN_DRAW_PENDING } from "./names.js";
import { tickAlienExplosionDespawn } from "./tickAlienExplosionDespawn.js";
import { selectAlternateSpriteFrame } from "./selectAlternateSpriteFrame.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";

/**
 * drawPendingAlien — paint the one marching alien queued for this frame.
 *
 * WHAT IT IS
 *   The alien-field draw pass. The march is animated one alien at a time: a selector
 *   (pickNextMarchingAlien) picks the next live alien, stows its screen address in ALIEN_DRAW_ADDR
 *   (0x200b), and raises ALIEN_DRAW_PENDING (0x2000); this routine renders it and clears the flag,
 *   so exactly one alien is repainted per pass — which is what makes the fleet ripple rather than jump.
 *
 * ROLE IN THE MACHINE
 *   Runs from the per-frame vblank object service (serviceVblankObjects). It reads several pieces of
 *   the queued draw: ALIEN_DRAW_INDEX (0x2006, the alien's 0..54 grid index), the active grid page
 *   ACTIVE_PLAYER_PAGE (0x2067), the sprite-id/frame state bytes loc_2004 (sprite id) and ALIEN_MARCH_FRAME_TOGGLE
 *   (alternate-frame flag), and the screen address ALIEN_DRAW_ADDR. PLAYER_SHOT_HIT (0x2002) doubles
 *   as the "an alien is currently exploding" latch: while it is set, the frame's work is spent ticking
 *   that explosion's despawn timer instead of drawing a marcher. Every non-explosion path clears
 *   ALIEN_DRAW_PENDING so the selector is free to queue the next alien next frame. Sprites reach VRAM
 *   through blitShiftedSprite (a hardware-shifted 16-row overwrite blit).
 *
 * ROM 0x0100-...  Grounding: [seen].  (loc_2004 keeps a placeholder name — the pixel-axis
 *   convention is not confidently read from the code.)
 *
 * LIVE-OUT: memory (VRAM + ALIEN_DRAW_PENDING); HL/DE from the blit on the draw path.
 */
export function drawPendingAlien(m) {
  // An alien is mid-explosion (PLAYER_SHOT_HIT set): spend this frame ticking that despawn countdown
  // instead of drawing a marcher, and do nothing else. tickAlienExplosionDespawn wipes the burst and
  // retires the shot when its timer expires.
  if (m.mem8[PLAYER_SHOT_HIT] !== 0) return tickAlienExplosionDespawn(m);
  // Address the queued alien's liveness byte: page number (ACTIVE_PLAYER_PAGE << 8) plus the grid
  // index cursor in ALIEN_DRAW_INDEX. A nonzero byte means that alien is still alive and worth drawing.
  const objAddr = (m.mem8[ACTIVE_PLAYER_PAGE] << 8) | m.mem8[ALIEN_DRAW_INDEX];
  if (m.mem8[objAddr] !== 0) {
    // Build the sprite source pointer. loc_2004 holds the alien's sprite id; clearing bit 0 selects the
    // base pose, and rotate-left-3 (the *8 below) turns the id into a byte offset into the sprite table
    // ALIEN_SPRITE_TABLE (0x1c00). Because bit 0 is cleared first (ids step by two), the *8 spaces
    // consecutive sprites 16 bytes apart — each alien sprite is 16 bytes (the 16-row blit below).
    const even = m.mem8[loc_2004] & 0xfe;
    let sprite = ALIEN_SPRITE_TABLE + u8((even << 3) | (even >>> 5)); // sprite id -> rotate-left-3 -> table offset
    // Two-frame walk cycle: when the alternate-frame flag ALIEN_MARCH_FRAME_TOGGLE is set, advance the pointer to the
    // second sprite bank (+0x30) so the alien shows its other pose this step.
    if (m.mem8[ALIEN_MARCH_FRAME_TOGGLE] !== 0) sprite = selectAlternateSpriteFrame(m, sprite);
    // Clear the pending flag before the blit (the draw itself touches disjoint state, so clearing here
    // is safe) — this frees the selector to queue the next alien on the following pass.
    m.mem8[ALIEN_DRAW_PENDING] = 0;
    // Load the queued screen address into HL and shift-blit the 16-row alien sprite there.
    return ((m.regs.hl = m.mem16[ALIEN_DRAW_ADDR]), blitShiftedSprite(m, sprite, 0x10));
  }
  // The queued alien is dead (already cleared from the grid): draw nothing, just release the flag.
  m.mem8[ALIEN_DRAW_PENDING] = 0;
}
