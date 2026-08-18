// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearObjectBlocksAndMirrorToObjRam  —  ROM 0x064b  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-board object-RAM reset. When a board is (re)set up this routine wipes the live object page
 *   clean, pushes that freshly-zeroed image straight into the OBJRAM hardware mirror so the video chip
 *   stops drawing the previous board's objects, and then wipes the sprite-actor scratch that the next
 *   board's lane objects will be assembled into. It leaves three RAM regions blank and ready to be
 *   repopulated by the rest of board setup.
 *
 * WHERE IT SITS
 *   Board-setup teardown, NOT a per-frame routine. It is called from initInPlayBoardOnce (the one-shot
 *   in-play board init), from advanceBoardForeground (when a board is cleared and the next is
 *   assembled), and from the attract demo's phase-0 seeding. Every later step of board setup —
 *   lane params, the frog object, the lane object lists — writes the real data on top of the blank
 *   slate this routine leaves, so its whole job is to guarantee a clean start.
 *
 * LIVE-OUT
 *   Memory only. It zeroes two work-RAM blocks and one OBJRAM block; it reads nothing back, returns
 *   nothing, and leaves no register the caller uses.
 */
import { LIVE_OBJECT_PAGE, OBJRAM_OBJECT_MIRROR_BASE, SPRITE_BLOCK2_BASE } from "./names.js";

// Byte counts of the three regions this routine touches. The object block is cleared to 44 bytes but
// only its 43-byte head is mirrored — see Step 2 for that one-byte asymmetry.
const OBJECT_BLOCK_BYTES = 44; // work-RAM object page span cleared at LIVE_OBJECT_PAGE (0x800c)
const MIRROR_BYTES = 43;       // head of that page copied into the OBJRAM mirror (0xb00c)
const SPRITE_BLOCK_BYTES = 99; // sprite-actor scratch span cleared at SPRITE_BLOCK2_BASE (0x8100)

export function clearObjectBlocksAndMirrorToObjRam(m) {
  const { mem8 } = m;

  // ── Step 1: wipe the live object page ────────────────────────────────────────────────
  // LIVE_OBJECT_PAGE (0x800c) is the work-RAM object page: each lane object owns a 4-byte lead record
  // here (its X mirrored at +0 and +2) at stride 4. Zero all 44 bytes so every object slot is blank
  // before the board rebuilds them. This page also lives inside the per-vblank sprite-shadow DMA window
  // (0x8008..0x803f), so whatever sits here is exactly what the sprite hardware draws.
  for (let i = 0; i < OBJECT_BLOCK_BYTES; i++) mem8[LIVE_OBJECT_PAGE + i] = 0;

  // ── Step 2: push the now-zero head into the OBJRAM mirror ─────────────────────────────
  // OBJRAM_OBJECT_MIRROR_BASE (0xb00c) is the hardware OBJRAM copy of the 0x800c object page. The
  // normal sprite-shadow DMA blit only refreshes OBJRAM once per vblank, so to make the video chip stop
  // drawing the old objects THIS instant we copy the just-zeroed head (43 bytes, 0x800c..0x8036)
  // directly into OBJRAM. Every source byte is already 0 from Step 1, so this blanks the on-screen
  // objects immediately. Note the 44/43 asymmetry: byte 43 (0x8037) was cleared in work RAM above but
  // is not part of the OBJRAM mirror, so it is intentionally not copied here.
  for (let i = 0; i < MIRROR_BYTES; i++) mem8[OBJRAM_OBJECT_MIRROR_BASE + i] = mem8[LIVE_OBJECT_PAGE + i];

  // ── Step 3: wipe the sprite-actor scratch ────────────────────────────────────────────
  // SPRITE_BLOCK2_BASE (0x8100) is the second work-RAM sprite block — the per-lane object lists, one
  // length-prefixed sprite run per lane at stride 9. Zero all 99 bytes (0x8100..0x8162) so the next
  // board's lane setup starts from an empty run table with no stale sprite positions carried over.
  for (let i = 0; i < SPRITE_BLOCK_BYTES; i++) mem8[SPRITE_BLOCK2_BASE + i] = 0;
}
