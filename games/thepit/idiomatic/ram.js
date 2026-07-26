// SPDX-License-Identifier: GPL-3.0-only

/**
 * The Pit work-RAM constants for the idiomatic layer.
 *
 * Maps The Pit work RAM (0x8000-0x87FF) to meaningful names. The addresses stay
 * hex in `../translated/` on purpose — that layer is the oracle; this file is a
 * naming convenience for the idiomatic rewrite and is NEVER the source of truth
 * for behaviour.
 *
 * ★ PROVENANCE / CONFIDENCE (be honest — a wrong name is the sprite-record trap,
 * worse than a neutral hex address): every name here was PROPOSED from
 * cross-routine corroboration observed during translation — the same address
 * used with a consistent role across N independent routines. That is real
 * evidence, but it has NOT yet had the proposer≠confirmer adversarial
 * re-derivation the DK names got. Names are tagged:
 *   (strong) — consistent role across 10+ routines, or an unambiguous use.
 *   (fair)   — consistent across a few routines; role clear but not cross-checked.
 *   (weak)   — a single plausible reading; treat as a hint, verify before trusting.
 * A verification pass (control-poke / adversarial re-derivation) should confirm
 * these; until then the idiomatic layer may cite them but the pixel gate, not the
 * name, is the correctness authority.
 */

// ── Object / tile geometry (the probe + collision + tile-cell system) ─────────

/** Tracked-object X (column) coordinate — the probe point the collision/tile code reads and writes.
 *  Used across 21 routines (movement, collision loc_03e8, tile-classify, spawns). (strong) */
export const OBJ_X = 0x8068;

/** Tracked-object Y (row) coordinate — paired with OBJ_X as the probe point. Used across 17 routines
 *  ("column"/"reload column" in the movers loc_1a40/loc_1a21). (strong) */
export const OBJ_Y = 0x806b;

/** Tile-cell COLUMN byte fed to the (row,col)→tilemap-offset calc (loc_3dae-style). Paired with
 *  TILE_ROW; both written by the fill/stamp setup (loc_4e1b/loc_4e55). (fair) */
export const TILE_COL = 0x8058;

/** Tile-cell ROW byte fed to the tilemap-offset calc; paired with TILE_COL (loc_4e20/loc_4e5a). (fair) */
export const TILE_ROW = 0x8059;

/** 16-bit pointer to the actor's current video-RAM display cell (loaded into IX via `ld ix,(0x806e)`
 *  by the draw/dispatch code loc_174f/loc_1a66). (strong) */
export const ACTOR_CELL_PTR = 0x806e;

// ── Sprite / animation ────────────────────────────────────────────────────────

/** Current sprite/animation frame code for the actor being drawn (`ld (0x8069),a` with 0x34/0xb4/…;
 *  "default sprite code" / "arm 0x35 event"). Used across 19 routines. (strong) */
export const SPRITE_CODE = 0x8069;

// ── Game mode / round state ───────────────────────────────────────────────────

/** Game mode / player-count cell — read as "player count" (loc_475d) and as the round/mode gate
 *  (`cp 3` in loc_02fd, decremented per-player in the teardown loc_0371). Used across 17 routines.
 *  (fair — the player-count vs mode-index dual use isn't fully pinned). */
export const GAME_MODE = 0x8001;

/** Secondary game-state byte armed to 1 or 2 alongside GAME_MODE (loc_038b/loc_03b2 `(0x8002)=1/2`).
 *  Gates the 2P/second-record path (loc_3a13's 0x8078 sibling). (fair) */
export const GAME_STATE2 = 0x8002;

/** Board/entry-select mode byte — the value the multi-door entry family stows before the shared body
 *  (loc_4b40/4b44/4b46 "entry-selected byte", "mode/variant"). Used across 17 routines. (fair) */
export const BOARD_MODE = 0x8057;

/** Variant selector read at round setup (loc_0391/loc_03a5) and by the fill dispatch (loc_4e2e
 *  "variant selector"). (weak) */
export const VARIANT = 0x8048;

// ── Player dig / movement ─────────────────────────────────────────────────────

/** 4-way blocked-direction bitmask the player movement reads to decide which way it may dig/move —
 *  written by the per-frame maze-wall collision classifier loc_03e8. (strong — single clear author). */
export const DIG_DIRS = 0x801b;

/** Climb / vertical-move gate the actor dispatch tests before the vertical branch (loc_1a02
 *  "climb/vertical gate"). (weak) */
export const CLIMB_GATE = 0x8080;

// ── Actor records: primary + its "twin" (shadow/second sprite) ───────────────
// The spawn/init code (loc_37cf/38c8/3984) seeds a primary block at 0x810a.. and a mirrored twin
// at 0x811b..; the movers (loc_3968) advance both. Fields corroborated by the "primary"/"twin",
// "X/coord", "tile", "Y" annotations across 6-7 routines each.

export const ACTOR_X = 0x810a; // primary actor X / coord (fair)
export const ACTOR_TILE = 0x810b; // primary actor tile field (fair)
export const ACTOR_Y = 0x810d; // primary actor Y (fair)
export const TWIN_X = 0x811b; // twin (shadow) X / coord (fair)
export const TWIN_TILE = 0x811c; // twin tile field (fair)
export const TWIN_CLEAR = 0x811e; // twin mirror clear byte (weak)

/** Spawn/alt-phase flag — set 0xff to mark "spawned", tested to gate the alt-phase spawn (loc_37cf
 *  "alt-phase byte", loc_37e4 "mark", loc_3776 "mark spawned (0xff)"). Used across 6-9 routines. (fair) */
export const SPAWN_PHASE = 0x807b;

/** Actor cadence timer — reloaded and counted down to pace the actor/enemy (loc_3800/loc_38f6
 *  "timer", loc_3786). (fair) */
export const ACTOR_TIMER = 0x8112;

/** Actor state/timer + sprite-code byte re-armed by the mover epilogue (loc_34fa "re-arm the
 *  state/timer byte", loc_34cf "store sprite code"). (weak) */
export const ACTOR_STATE = 0x8084;

// ── Free-running counters ─────────────────────────────────────────────────────

/** Per-frame animation/random counter (loc_3490 reads it as "frame counter"; loc_34f5 stores a
 *  "masked random byte" — an LFSR-seeded per-actor field). (weak — dual reading). */
export const ANIM_RAND = 0x808b;

/** Frame counter cleared at reset/round init (loc_4dfa "clear frame counter", read by loc_03e8's
 *  30-frame gate and loc_374f). (fair) */
export const FRAME_COUNTER = 0x8010;

// ── Sound ─────────────────────────────────────────────────────────────────────

/** Sound-command ring HEAD index (mod 8) — advanced by the shared enqueue tail loc_4ca5
 *  (`ld a,(0x801e) / inc / and 7 / ld (0x801e),a`). (strong). */
export const SOUND_HEAD = 0x801e;

/** Sound-command ring BUFFER base (8 slots) — the enqueue writes `(code|0x80)` at 0x8020+head. (strong). */
export const SOUND_RING = 0x8020;

// ── Tile-classifier scratch (0x80a2-0x80a9 — the tile-under-object block) ─────
export const CUR_TILE = 0x80a5; // saved current tile under the object (loc_1840 "saved current tile") (fair)
export const NEXT_TILE = 0x80a8; // next-tile slot, pre-cleared before classify (loc_1706) (fair)
