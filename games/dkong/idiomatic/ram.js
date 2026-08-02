// SPDX-License-Identifier: GPL-3.0-only

/**
 * Donkey Kong work-RAM constants for the idiomatic layer.
 *
 * Maps Donkey Kong work RAM (0x6000-0x6BFF) to meaningful names for the
 * idiomatic layer. Every constant here was proposed by a drafter and then
 * independently re-derived by a SEPARATE verifier — each holds on either a
 * reproduced control-poke or an unambiguous ROM cite, never on the drafter's
 * word alone.
 *
 * The addresses stay hex in `../translated/` on purpose: that layer is the
 * oracle. This file is a naming convenience for the idiomatic layer and must
 * never be treated as the source of truth for behaviour.
 *
 * The full evidence trail — the drafters' proposals and the verifiers'
 * adversarial re-derivations — lives in `ram-findings-player.md`,
 * `ram-findings-world.md`, `ram-verify-player.md`, and `ram-verify-world.md`
 * beside this file.
 *
 * TWO BYTES WERE NAMED BY BOTH VERIFIERS (their halves overlapped on the live
 * player-context block) — independent corroboration, not a conflict. Each keeps
 * ONE canonical name; the other verifier's name is preserved in the findings
 * files and noted inline where it aids a code search:
 *   0x6228  LIVES               (player findings also called it PLAYER_LIVES)
 *   0x622D  BONUS_LIFE_AWARDED  (player findings also called it EXTRA_LIFE_AWARDED)
 */

// ── Sprite / display buffer ──────────────────────────────────────────────────
// Sprite-record field offsets (into any 4-byte record in SPRITE_BUFFER). Source: names-confirmed-DE.md;
// video.js drawSprites transcribed from MAME 0.288 dkong_v.cpp. See SPRITE_BUFFER's 90° note.
/** [seen] Sprite-record field: X (+0). Grounded byte-exact vs MAME (== MARIO_X, 1819 attract frames);
 *  raster reads it rotated as the y-coord. */
export const SPRITE_X = 0x00;
/** [code] Sprite-record field: tile code (+1); bit7 = horizontal flip. */
export const SPRITE_CODE = 0x01;
/** [code] Sprite-record field: colour/attribute (+2). */
export const SPRITE_ATTR = 0x02;
/** [seen] Sprite-record field: Y (+3). Grounded byte-exact vs MAME (== MARIO_Y, 1819 attract frames);
 *  raster reads it rotated as the x-coord. */
export const SPRITE_Y = 0x03;
/** Sprite shadow buffer: 96 hardware sprite records × 4 bytes at 0x6900-0x6A7F. The CPU fills it and
 *  the i8257 DMA blits it to sprite RAM 0x7000 on the rising DRQ edge every vblank (sub_0141, ROM
 *  0x0141: ch0 src 0x6900, ch1 dst 0x7000, count 0x180 = 96×4). Boot/board-setup clears the 384-byte
 *  span (sub_0874). MARIO_SPRITE_RECORD (0x694C) lives inside it.
 *  RECORD LAYOUT (game frame): +0 X (SPRITE_X), +1 code (SPRITE_CODE, bit7 = flip), +2 attr
 *  (SPRITE_ATTR), +3 Y (SPRITE_Y). [seen]: +0 == MARIO_X and +3 == MARIO_Y observed byte-exact on the
 *  real ROM under MAME across 1819 attract frames. 90° NOTE: the video hardware reads each record
 *  ROTATED (raster +0 = y, +3 = x) — the +0-X/+3-Y (game) vs +0-y/+3-x (raster) disagreement is the
 *  portrait rotation, NOT a bug; do NOT "fix" the X/Y naming. Named sub-bases inside the buffer:
 *  ACTOR_SPRITES, TOP_SPRITES, OBJECT_COLLISION_SPRITES, POPUP_SPRITE (below).
 *  HOW WE KNOW: the DMA descriptor names 0x6900 as ch0 SOURCE and 0x7000 as ch1 DEST — an unambiguous
 *  ROM + i8257-hardware cite. */
export const SPRITE_BUFFER = 0x6900;
/** [seen] (own byte: 82 vals 0..151, 258 transitions, RUN-2P) A 10-record (40-byte) sprite-object group at SPRITE_BUFFER+8 (0x6908-0x692F). sub_004e (ROM 0x004E
 *  `ld de,0x6908 / ld bc,0x28 / ldir`) block-copies a ROM template into it; the record fields are then
 *  positioned by rst-0x38 stride-4 add-loops. CONTENT is scene-dependent (board decor, cutscene
 *  props) but the STRUCTURE — 10 records inside SPRITE_BUFFER — is fixed. HOW WE KNOW: sub_004e
 *  hard-wires DE=0x6908/BC=0x28 (one unambiguous role) + 11 optimized routines target it identically. */
export const SPRITE_OBJ_BLOCK = 0x6908;
/** [seen] (own byte, the record's +0 X: 168 vals 0..227, 1241 transitions, RUN-A; == MARIO_X) Mario's 4-byte hardware sprite record: +0 X (0x6203), +1 code (0x6207), +2 attr (0x6208), +3 Y
 *  (0x6205), copied in that deliberate order by entry_1da6 (ROM 0x1DA6) and DMA'd to sprite RAM
 *  0x704C. Observed byte-identical to the source tuple; the hammer overrides +1 via loc_2f43.
 *  (Inside SPRITE_BUFFER, above.) */
export const MARIO_SPRITE_RECORD = 0x694C;
/** [code] 10 sprite records (stride 4) inside SPRITE_BUFFER (0x6980-0x69A7); entry_2e04 mirrors the
 *  0x6500 object array's X/Y here. */
export const ACTOR_SPRITES = 0x6980;
/** [seen] The OBJ_ARRAY_65A0 (50m moving-object) hardware sprite group: 6 records x 4 bytes inside
 *  SPRITE_BUFFER (0x69B8-0x69CF). update50mMovingObjects refreshes it record-for-record from
 *  OBJ_ARRAY_65A0; advance50mObjectRow blanks culled records; the sprite DMA blits it with the rest
 *  of SPRITE_BUFFER. Grounded live vs MAME on poke-to-50m (pass 11): 1500/1500 active-record frames
 *  mirror OBJ_ARRAY_65A0 X/code/attr/Y exactly (obj X swept 244 distinct values, genuinely moving),
 *  and each sprite +0 blanks to 0 the instant its record is culled. */
export const OBJ_65A0_SPRITES = 0x69b8;
/** [code] 3 sprite records (stride 4) inside SPRITE_BUFFER; initBoardState seeds them on every board
 *  except 100m. */
export const TOP_SPRITES = 0x6a00;
/** [code] 3 collision sprite records (stride 4) inside SPRITE_BUFFER; scanObjectsAtMarioX/confirmObjectHit
 *  read +0 X / +3 Y / +1 flag vs Mario (cleared as a 5-record group by clearSpriteColumns). */
export const OBJECT_COLLISION_SPRITES = 0x6a0c;
/** [code] Effect sprite record (4 bytes at 0x6A2C inside SPRITE_BUFFER, immediately before
 *  POPUP_SPRITE): +0 Y, +1 SPRITE_CODE, +2 SPRITE_ATTR, +3 X. entry_1ea0 builds it and stores its
 *  base into EFFECT_PARAM_PTR (0x6343); loc_1f09 flips bit0 of its code byte (0x60↔0x61) each effect
 *  beat, loc_1f23 steps it. Its +1 code field (0x6A2D) IS grounded [seen] live (flips 0x60↔0x61, 41
 *  transitions, tied to EFFECT_SEQ_STATE) — reach 0x6A2D as EFFECT_SPRITE + SPRITE_CODE. [code] because
 *  grounding grounded the +1 field, not the base cell's own byte (same rating as sibling POPUP_SPRITE). */
export const EFFECT_SPRITE = 0x6a2c;
/** [code] Score-popup sprite record inside SPRITE_BUFFER; awardScorePopup writes +0=MarioX, +1=glyph,
 *  +2=attr 7, +3=MarioY+0x14. */
export const POPUP_SPRITE = 0x6a30;

// ── Object-record arrays & shared fields ─────────────────────────────────────
/** [seen] Object-record field: active flag (+0); bit0 = active (the 0x6700 array also uses bit1 =
 *  occupied). Grounded live in real MAME 25m attract: 0x6400+0 took {0,1} (3 transitions), 0x6700+0
 *  took {0,1,2} (13 transitions) — its own byte, a live active-flag enum. */
export const OBJ_ACTIVE = 0x00;
/** [seen] Object-record field: X (+3). Grounded live in real MAME 25m attract: 0x6403 swept 227 distinct
 *  values 0..240, 0x6703 223 distinct — its own byte, a live horizontal sweep (stronger than the earlier
 *  transitive sprite-X grounding: gatherSpriteRecords obj+3 -> sprite+0 = X). */
export const OBJ_X = 0x03;
/** [seen] Object-record field: Y (+5). Grounded live in real MAME 25m attract: 0x6405 took 22 distinct,
 *  0x6705 158 distinct (77..243) — its own byte, a live vertical sweep (stronger than the earlier
 *  transitive sprite-Y grounding: gatherSpriteRecords obj+5 -> sprite+3 = Y). */
export const OBJ_Y = 0x05;
/** [seen] Object-record field: sprite tile code (+7); gatherSpriteRecords copies to sprite +1. Grounded
 *  live in real MAME 25m attract: 0x6407 cycled {61,62,189,190}, 0x6707 11 distinct animation frames. */
export const OBJ_SPRITE_CODE = 0x07;
/** [code] Object-record field: sprite attribute (+8); gatherSpriteRecords copies to sprite +2. */
export const OBJ_SPRITE_ATTR = 0x08;
/** [code] Object-record field: per-object collision half-extent on the X axis (+0x09) — the extra span
 *  added to the caller's base tolerance in the bounding-box overlap test. findCollidingObject and
 *  countObjectOverlaps read it paired with OBJ_X (+3); writers (service50mObjectSpawnRequest,
 *  driveHammerSprite, buildPendingHammerSprite, ...) stamp small span constants. Verified by the axis
 *  pairing against the [seen]-grounded findCollidingObject; no non-collision reader. Live spot-check on
 *  poke-to-50m (pass 11): +0x09 held 8 / +0x0a held 3 on active records — fixed span constants, so
 *  [code] (grounded-by-reference), not a swept-byte [seen]. */
export const OBJ_HIT_EXTENT_X = 0x09;
/** [code] Object-record field: per-object collision half-extent on the Y axis (+0x0a), paired with
 *  OBJ_Y (+5) in the bounding-box overlap test. Mirror of OBJ_HIT_EXTENT_X. */
export const OBJ_HIT_EXTENT_Y = 0x0a;
/** [seen] Object-record field: per-object state-machine selector (+0x0d). Grounded live: 0x640d took
 *  meaningful small-enum values across 23 transitions over the object lifecycle in real MAME 25m attract
 *  (its own byte — a state field, not a coordinate/pointer/timer/count). Every site READS-and-dispatches
 *  or WRITES-a-next-state on it. Enums differ per array: 0x6500 array (obj_2e12: state 4 -> loc_2e84);
 *  0x6400 stride-0x20 array (entry_333d movement/collision state machine; entry_333d's code writes 0/4/8.
 *  RECONCILED (pass-5 50m real-ROM run, credited board 2): the 0x6400-array records take the FULL
 *  {0,1,2,4,8} enum live, with substantial dwell — e.g. 0x6400+0d {0:1310,1:1513,2:587,4:267,8:317},
 *  0x6420+0d {..4:372,8:1019}, and 2081 gameplay frames showed state {4,8} on some 0x6400 record. The
 *  earlier 25m-attract {0,1,2} was just the demo never running the movement/collision arm that reaches
 *  {4,8} — the entry_333d {0,4,8} write set is real; value-set now grounded [seen]);
 *  0x6600 array (sub_27da spawn -> 8, sub_2797 bit3 land -> 4, seed75mBoardObjects inits 8).
 *  Offset < 0x10, so it stays IN-record for the stride-0x10 arrays too — no cross-record aliasing.
 *  Directly analogous to the shared OBJ_ACTIVE. */
export const OBJ_STATE = 0x0d;
/** [seen] Object-record field: low/high byte of a saved 16-bit table-walk pointer (+0x1a/+0x1b)
 *  into a ROM path table near 0x3A70. Walker chain: sub_342c/sub_3478 reload it, loc_3445
 *  advances+saves it and zeroes it on the 0xAA terminator. Grounded live vs MAME: contiguous
 *  16-bit pointer stepping +1/frame, high byte constant 0x3A, rewinds to 0 when idle; live at
 *  records 0/1. Mechanism (saved walk pointer) grounded; which path it walks is not.
 *  OFFSET >= 0x10 -> in-record ONLY for the stride-0x20 arrays (OBJ_ARRAY_64 / OBJ_ARRAY_67);
 *  aliases the next record on the stride-0x10 arrays. */
export const OBJ_WALK_PTR_LO = 0x1a;
export const OBJ_WALK_PTR_HI = 0x1b;
/** [code] Saved iterator pointer (word) walking the 0x6400 stride-0x20 array; entry_31b1 seeds/advances
 *  it, entry_3202 / sub_298c re-load it (pointer passed through memory). */
export const OBJ_ITER_PTR = 0x63c8;
/** [seen] Object array, stride 0x20, 5 records swept together (the page holds up to 7 on 100m);
 *  sub_2880 / entry_31b1. Grounded live (record-0 only): record-0's fields all took live values in real
 *  MAME 25m attract (records 1,2 stayed 0) — the base is exercised; honest record-0-only [seen]. */
export const OBJ_ARRAY_64 = 0x6400;
/** [code] Object ("actor") array, stride 0x10, 10 records (0x6500-0x659F); entry_2e04, mirrored to
 *  ACTOR_SPRITES. */
export const OBJ_ARRAY_65 = 0x6500;
/** [seen] Object array, stride 0x10, 6 records; sub_2591. GROUNDED (pass-5 50m real-ROM run, credited
 *  board 2): records 0-2 (0x65A0/B0/C0) live on 50m — active {0,1}, X sweeps the full 0..249 with 1704
 *  frame-to-frame transitions (the horizontally-moving 50m objects the M50 step shadows drive), Y
 *  row-fixed. Base exercised on the board it belongs to; honest — records 3-5 not separately checked. */
export const OBJ_ARRAY_65A0 = 0x65a0;
/** [code] Object array, stride 0x10, 6 records; sub_2797 (land/deactivate on +0d bit3). */
export const OBJ_ARRAY_66 = 0x6600;
/** [code] Object pair, stride 0x10, 2 records (0x6680 / 0x6690); seedSpriteObjectPair, gathered to 0x6A18. */
export const OBJ_PAIR_6680 = 0x6680;
/** [code] Single object record; sub_2880 sweep3 (count 1), loc_11fa scatters a ROM template into it. */
export const OBJ_RECORD_66A0 = 0x66a0;
/** [seen] Object array, stride 0x20, 10 records spanning page 0x68 (0x6700-0x6840);
 *  sub_2880 / entry_2c8f / sub_1f72. Grounded live (record-0 only): record-0's fields all took live
 *  values (full-playfield barrel) in real MAME 25m attract — honest record-0-only [seen]. */
export const OBJ_ARRAY_67 = 0x6700;

// ── Coins & DIPs ─────────────────────────────────────────────────────────────
/** [seen] (own byte took 1,2,3 as coins inserted, TAP-B1 write-tap / 0->1 at coin in RUN-1P) Credit count, BCD, capped at 0x90 (ROM 0x01AC). Consumed by the start handlers; while non-zero
 *  the attract handler advances GAME_STATE. Observed 0→1 at coin, →0 at start. */
export const CREDITS = 0x6001;
/** [seen] (own byte {0,1}: took 0x01 on a coin then reset; caught by write-tap 0x6002 @f400 TAP-B1, invisible to per-frame sampling) Coins accumulated toward the next credit; reset to 0 when it reaches DIP_COINS_PER_CREDIT
 *  (ROM 0x01A0). Coin test 3C/1C: 1,2 coins → 1,2; the 3rd rolls a credit and resets it to 0. */
export const COINS_PARTIAL = 0x6002;
/** [seen] (own byte {0,1}: cleared on a coin then re-armed, 3 transitions, RUN-1P) Edge latch for the coin line (IN2 bit 7). Held 1 while no coin present; a coin counts only when
 *  it finds the latch set, then clears it — so holding the coin line does not repeat-credit
 *  (ROM 0x017B). Proven by the coin test: each pulse counted exactly once. */
export const COIN_EDGE = 0x6003;
/** [seen] (own byte swept 3/4/5 across the Lives DSW settings, DSW sweep; =3 default held live in every run) Lives per game, 3-6, from DSW0 (ROM 0x020E `and 0x03 / add a,0x03`). Copied into LIVES at game
 *  start. DIP sweep: 0x80/81/82/83 → 3/4/5/6. */
export const DIP_LIVES = 0x6020;
/** [seen] (own byte swept 7/16/21 = 7000/10000/15000 pts across the Bonus-Life DSW settings, DSW sweep; =7 default held live) Extra-life threshold in BCD thousands: 0x07/0x10/0x15/0x20 = 7000/10000/15000/20000. Derived
 *  from DSW0 bits 2-3 at ROM 0x0214; compared against the score's thousands pair at ROM 0x036E. */
export const DIP_BONUS_LIFE = 0x6021;
/** [code] (own byte held constant 1 across every run and the DSW sweep -- NO live variation, though its coinage siblings 0x6023/0x6025 did vary; the DSW-decode/display role is ROM-cited @0x07AD) Coins needed for a 1-player game — DISPLAY value only, written to VRAM 0x756C by ROM 0x07AD. */
export const DIP_COINS_FOR_1P = 0x6022;
/** [seen] (own byte took {1,2} across DSW settings, DSW sweep) Coins needed for a 2-player game — DISPLAY value only, written to VRAM 0x756E by ROM 0x07B1
 *  (with a tens-digit split for "10"). */
export const DIP_COINS_FOR_2P = 0x6023;
/** [code] (own byte held constant 1 across the DSW sweep -- NO live variation, though the coinage nibble varies at sibling DIP_CREDITS_PER_COIN; DSW-decode role ROM-cited @0x01A2) Coins the mechanism must swallow per credit group (ROM 0x01A2). Coin test: 3 coins at 3C/1C →
 *  1 credit, partial resets. */
export const DIP_COINS_PER_CREDIT = 0x6024;
/** [seen] (own byte swept {1,2,3} across the Coinage DSW settings, DSW sweep) Credits awarded per completed coin group (ROM 0x01A9). Coin test: 1 coin at 1C/2C → 2 credits. */
export const DIP_CREDITS_PER_COIN = 0x6025;
/** [seen] (own byte took {0,1} across the Cabinet DSW settings, DSW sweep) Cabinet: 1 = upright, 0 = cocktail (DSW0 bit 7, ROM 0x024F). Selects whether P2 reads IN1 in the
 *  NMI (`jp nz,0x0098` @0x0087); mirrored to the flip-screen latch 0x7D82. Sweep: 0x80→1, 0x00→0. */
export const DIP_UPRIGHT = 0x6026;

// ── Game state & NMI dispatch ────────────────────────────────────────────────
/** [seen] (own byte reached the full enum {0,1,2,3}, 4 transitions, RUN-1P) Top-level game state: 0 power-on, 1 attract, 2 credited, 3 in-game. NMI dispatches through the
 *  4-entry rst 0x28 table at ROM 0x00CA on this value. Observed: →1@f5, →2 at the coin frame, →3 at
 *  the start frame. */
export const GAME_STATE = 0x6005;
/** [seen] (own byte {0,1}, 3 transitions, RUN-1P) Non-zero while no credited game is in progress (attract). Gates the NMI joystick read
 *  (`jp nz` @ROM 0x0080), the sound driver (`ret nz` @0x00EA), and rst 0x08. 1 from power-on, 0 the
 *  frame a credit is accepted (@ROM 0x08BE), 1 again at game over. */
export const ATTRACT = 0x6007;
/** [seen] (own byte: 256 vals 0..255, 2574 transitions, RUN-A) Prescaler paired with SUBSTATE_TIMER: rst 0x20 (ROM 0x0020) decrements this and, on underflow,
 *  falls into rst 0x18 to tick 0x6009. Low/fast half of the two-byte sub-state timer. */
export const SUBSTATE_TIMER_LO = 0x6008;
/** [seen] (own byte: 193 vals 0..192, 4154 transitions, RUN-2P) Frames remaining before the current sub-state may proceed; counts down 1/frame. rst 0x18
 *  (ROM 0x0018) decrements it and, unless it hit 0, discards the caller's remainder. The
 *  "wait N then go to sub-state M" idiom writes N here and M into 0x600A (the next byte). */
export const SUBSTATE_TIMER = 0x6009;
/** [seen] (own byte: 19 vals 0..23, 78 transitions, RUN-2P) Sub-state dispatch index WITHIN the current GAME_STATE. In-game (state 3) the handler at
 *  ROM 0x06FE does `ld a,(0x600a) / rst 0x28` through the 29-entry table at 0x0702:
 *  7=opening Kong-climb cutscene (NOT a rescue), 8=how-high, 10=board setup, 13=gameplay,
 *  14=P1 death, 0x16=board-cleared/advance. Board-complete writes 0x16 (ROM 0x1E80 rivet-zero;
 *  girder/rescue boards likewise). NOTE: this is a corrected name — arcade2 commit 14da179 called
 *  this address a "rescue flag" after seeing 7 at a board transition; 7 is the NEXT board's intro.
 *  Board-to-board progression and the level loop are real and validated-by-play regardless of this
 *  byte's name. Proven: poking 7 mid-board replays the intro and freezes BOARD/LEVEL/SEQPTR;
 *  poking 0x16 advances 25m->100m. */
export const GAME_SUBSTATE = 0x600A;
/** [seen] (own byte toggled {0,1} 5x as play alternated P1/P2, RUN-2P) Player currently up: 0 = P1, non-zero = P2. sub_055f (ROM 0x055F) selects the score slot from it
 *  (`ret z` → 0x60B2 P1, else 0x60B5 P2); sub_0350 reads it for the extra-life context. Toggled on
 *  the player switch (loc_13aa sets 1, loc_13bb clears 0). HOW WE KNOW: CONTROL — with 0x600D=1 an
 *  injected score award landed in P2_SCORE (0x60B6) not P1 (0x60B3), plus the unambiguous sub_055f
 *  cite. Mined from the optimization sweep + confirmed by a separate verifier. */
export const CURRENT_PLAYER = 0x600D;
/** [code] Active-player index; value-lockstep mirror of CURRENT_PLAYER (loc_141e/144f/13aa/13bb write
 *  both in step). Distinct discriminating readers (cocktail P2-select, +0x12 substate, 2P double-inc)
 *  are all unexercised in attract, so the solid basis is the lockstep with the grounded CURRENT_PLAYER —
 *  ground on a 2P/cocktail run before a downstream decompile trusts the readers. */
export const ACTIVE_PLAYER_INDEX = 0x600e;
/** [seen] (own byte set to 1 at 2-player start, {0,1}, RUN-2P) 1 = two-player game, 0 = one-player. Written EXACTLY ONCE at game start, as the high byte of
 *  loc_08f8's `ld (0x600E),hl` (ROM 0x0938; HL=0x0100 on the 2P-start arm, 0x0000 on 1P). Every
 *  reader branches on it as "2-player": loc_09ab arms the alternation screen, loc_12f2 takes the 2P
 *  game-over path, handler_0779 draws the extra 2P glyphs (ROM 0x079B `cp 0x01 / call z`). HOW WE
 *  KNOW: single writer with values {0,1} + four consistent readers (ROM cite + cross-routine). */
export const TWO_PLAYER_GAME = 0x600F;
/** [code] Player-slot records: base 0x611C, stride 0x22, 5 records; field[0] = owner tag (1 = P1,
 *  3 = P2). loc_141e is ground-truth (compares field[0] vs 1 then 3); runBonusItemValueDisplay/sub_1486
 *  key it with 2*(0x600E)+1. Base + stride + owner-tag solid; full per-record layout inferred. */
export const PLAYER_SLOT_RECORDS = 0x611c;
/** [seen] (own byte walked 1->7 over the opening cutscene at real game start, RUN-1P) Step index of the opening Kong-climb cutscene; ROM 0x0A76 does `ld a,(0x6385) / rst 0x28` on it
 *  against the 8-entry table at 0x0A7A. Walks 1→7 over the cutscene (roar audio 0x608A=0x0F at
 *  step 7). Reached only while GAME_SUBSTATE (0x600A) == 7. */
export const INTRO_STEP = 0x6385;
/** [code] Board-advance / "how high" render-sequence step index — the machine step for the
 *  GAME_SUBSTATE (0x600A) == 0x16 board-advance state. loc_1615/loc_1641/loc_1644 dispatch
 *  `ld a,(0x6388) / rst 0x28` through their board-parity tables on it; each step's routine renders
 *  one stage then `inc`s it to advance (a write of 0 resets/restarts the sequence). Step 0 is the
 *  how-high screen (loc_17b6). Pass-2 confirmer: a single step-index role across every reader+writer,
 *  both layers. */
export const BOARD_ADVANCE_STEP = 0x6388;
/** [seen] (own byte {0,8}, RUN-attract) Saved copy of SND_BGM taken when a hammer is
 *  grabbed (buildPendingHammerSprite / ROM 0x2FB4), so updateActiveHammer can restore the
 *  pre-hammer tune to SND_BGM at hammer expiry (ROM 0x2F79). Observed 0x08 (25m theme) saved
 *  at the grab, held through the ~876-frame active hammer while SND_BGM plays the hammer tune
 *  0x04, then read back to restore SND_BGM at expiry. Not cleared on restore (goes stale until
 *  the next grab / attract-cycle reset). */
export const HAMMER_SAVED_BGM = 0x6389;

// ── Player & motion ──────────────────────────────────────────────────────────
/** [seen] (own byte: 14 vals 0..209, 407 transitions, RUN-1P) Cooked control word the movement code reads: bit0 Right, bit1 Left, bit2 Up, bit3 Down (held),
 *  bit7 = jump press-edge (set exactly one frame per press). Built and stored by readControls (ROM
 *  0x00AC `ld (0x6010),hl`) and consumed by entry_1ac3. */
export const P1_INPUT = 0x6010;
/** [seen] (own byte swept {0..22} on a real button press, 390 transitions, RUN-1P/2P; stays 0 in attract) Raw IN0/IN1 port byte for this frame (bit4 = jump button), kept so the next frame's edge detector
 *  (`cpl / and b`) can tell newly-pressed from still-held. Stored as the high half of readControls'
 *  `ld (0x6010),hl`. Steady 0x10 while jump held. */
export const P1_INPUT_RAW = 0x6011;
/** [seen] (own byte {0,1}, 10 transitions, RUN-2P) Player-alive flag: 1 = alive and processed, 0 = dead/inert. Set on landing to
 *  (0x6220) XOR 1 by entry_1c4f (ROM 0x1C57). Poking 0 mid-play freezes Mario and
 *  runs the death -> life-decrement -> respawn cycle, which restores it to 1. */
export const MARIO_ACTIVE = 0x6200;
/** [seen] (own byte {0,1,2,4}, 565 transitions, RUN-A attract) Walk-cycle animation index (values {0,1,2,4}); its low 2 bits feed the sprite code
 *  0x6207 every frame. Written ONLY by the two walk routines (loc_1c8f/loc_1cab, ROM
 *  0x1CA4/0x1CC0) and cleared on freeze-expiry (loc_1b55, 0x1B6B). NOT facing: Right and
 *  Left produce the same value set in reversed order. */
export const MARIO_WALK_ANIM = 0x6202;
/** [seen] (own byte: 168 vals 0..227, 1240 transitions, RUN-A) Mario's X position, in screen pixels. The movement code read-modify-writes it
 *  (advanceMarioWalkX, ROM 0x1CD5 `add a,b`); a poked value persists and later walking is relative
 *  to it, and prize collision compares it exactly against each item's stored X. */
export const MARIO_X = 0x6203;
/** [seen] (own byte {0,128}, 3184 transitions, RUN-B4) Low byte of the 16.8 fixed-point X (0x6203:0x6204, big-endian). Per airborne frame,
 *  delta(X*256 + this) equals the signed velocity 0x6210:0x6211 exactly. Cleared at jump
 *  init (loc_1b8a, ROM 0x1B99). */
export const MARIO_X_FRAC = 0x6204;
/** [seen] (own byte: 52 vals 0..240, 347 transitions, RUN-A) Mario's Y position, in screen pixels (larger = lower on screen). Read-modify-written by
 *  the climb/slope code (loc_1d11, ROM 0x1D14 `add a,(hl)`); a poked value persists and
 *  motion is relative to it; follows the girder slope while walking. */
export const MARIO_Y = 0x6205;
/** [seen] (own byte: 20 vals 0..240, 380 transitions, RUN-A) Low byte of the 16.8 fixed-point Y (0x6205:0x6206, big-endian) -- the value the ballistic
 *  integrator updates. Per-frame delta(Y*256 + this) = -(V + 8 - 16n) with V = 0x6212:0x6213
 *  and n = 0x6214 (verified 0 mismatches over 142 airborne frames). Cleared at jump init. */
export const MARIO_Y_FRAC = 0x6206;
/** [seen] (own byte: 16 vals 0..143, 614 transitions, RUN-A) Mario's sprite tile code in bits 0-6; bit 7 = horizontal flip / facing (1 = facing right).
 *  Copied to sprite-record byte +1 (0x694D) by entry_1da6. Every writer preserves bit 7 and
 *  ORs a state code (0x0E jump / 0x0F land / 0x06 ladder-top / walk-anim&3 walk / 03-05 climb). */
export const MARIO_SPRITE_CODE = 0x6207;
/** [code] (own byte = constant 2 -- the colour/attr field -- whenever Mario active; the {0,2} 7 transitions are just board-boundary clears, NOT attr variation; no live attr value observed, LOW confidence. RUN-2P) Colour/attribute byte of Mario's sprite record (byte +2), copied to 0x694E by entry_1da6
 *  (ROM 0x1DB2); the video model decodes byte +2 as colour|bank|flip. Constant 2 in every
 *  observed frame -- named for the hardware field; LOW confidence (never varied, not pokeable). */
export const MARIO_SPRITE_ATTR = 0x6208;
/** [seen] (own byte: 79 vals 0..198, 1137 transitions, RUN-1P) Snapshot of X (0x6203) taken at the head of each airborne frame, before that frame's motion.
 *  Written by loc_1bb2 (ROM 0x1BBC `ld (ix+0x0b),a`); observed to lag 0x6203 by exactly one
 *  frame through a jump, untouched while walking. */
export const MARIO_AIR_PREV_X = 0x620B;
/** [seen] (own byte: 49 vals 0..240, 260 transitions, RUN-A) Snapshot of Y (0x6205) taken at the head of each airborne frame, before gravity. Written by
 *  loc_1bb2 (ROM 0x1BC2); lags 0x6205 by one frame; read by collision code at 0x29D6/0x29EE/0x2BE1. */
export const MARIO_AIR_PREV_Y = 0x620C;
/** [seen] (own byte {0,204,208,210,213,240}, 12 transitions, RUN-A) Y at the instant Mario left the ground. The fall-height test computes (curY - 0x0F) cp this
 *  (entry_1c76, ROM 0x1C7F); not-below makes the fall fatal (sets 0x6220). Written at jump init
 *  (0x1BAC) and fall init (0x1F6E). */
export const MARIO_AIR_START_Y = 0x620E;
/** [seen] (own byte {0..4}, 1865 transitions, RUN-A) Ground walk/climb sub-step timer. While nonzero the move code shifts Mario 1px and decrements
 *  it (loc_1c8f/loc_1cab, ROM 0x1C94/0x1CB0); at zero it advances the walk animation and reloads
 *  (2 walk / 3-4 climb). Poking 20 gives 20 frames of 1px/frame. NOT "jump phase" -- a jump never
 *  touches it. */
export const MARIO_MOVE_STEP_TIMER = 0x620F;
/** [seen] (own bytes live: HI 0x6210 {0,255} 75 transitions RUN-B4, LO 0x6211 {0,128} 9 transitions RUN-2P) Signed 16-bit horizontal velocity while airborne, big-endian (hi at 0x6210), 1/256 px/frame.
 *  Jump init loads +0x0080 (Right) / 0xFF80 (Left) / 0x0000 (loc_1b8a, ROM 0x1B8C). Each airborne
 *  frame delta(X16) equals this; poking the lo byte to 0x80 moves a vertical jump 0.5px/frame. */
export const MARIO_AIR_VX_HI = 0x6210;
export const MARIO_AIR_VX_LO = 0x6211; // [seen] lo byte of the airborne X velocity above (own byte {0,128}, 9 transitions RUN-2P)
/** [seen] (own bytes live, RUN-2P: HI 0x6212 {0,1} 9 transitions, LO 0x6213 {0,72} 9 transitions) Signed 16-bit INITIAL vertical velocity of the current jump/fall, big-endian (hi at 0x6212),
 *  1/256 px/frame; constant across the whole arc. Jump init sets 0x0148, a fall sets 0 (loc_1b8a,
 *  ROM 0x1B91/94). Gravity is derived from it and frame counter 0x6214: ΔY16 = -(V + 8 - 16n),
 *  verified exact including after poking V (0 mismatches / 142 frames). */
export const MARIO_AIR_VY_HI = 0x6212;
export const MARIO_AIR_VY_LO = 0x6213; // [seen] lo byte of the airborne Y velocity above (own byte {0,72}, 9 transitions RUN-2P)
/** [seen] (own byte: 44 vals 0..43, 2402 transitions, RUN-1P) Frames elapsed since Mario became airborne; drives the ballistic term. At exactly 0x14 the
 *  airborne handler arms the landing/fall check (0x621F := 1; entry_1c05, ROM 0x1C16). Poking to
 *  0x13 makes 0x621F flip one frame later. Zeroed at jump/fall init. */
export const MARIO_AIR_FRAMES = 0x6214;
/** [seen] (own byte {0,1}, 6 transitions, RUN-A) 1 = Mario is on a ladder / mid-climb; enables the Up/Down climb branch (gated at ROM 0x1ADB and
 *  0x1B43). Set per climb step (loc_1d49, 0x1D4B), cleared on reaching a ladder end (loc_1d67,
 *  0x1D73). Poking 1 (held) + Up makes Mario climb in mid-air with the ladder-centring X snap. */
export const MARIO_ON_LADDER = 0x6215;
/** [seen] (own byte {0,1}, 151 transitions, RUN-B4) Primary movement state: 0 = grounded, 1 = airborne (jumping or falling). First test in the
 *  movement machine (entry_1ac3, ROM 0x1AC6). Set by jump init (0x1B73) and fall init (0x1F68),
 *  cleared on landing (0x1C52). Poking 1 while standing triggers the airborne handler immediately. */
export const MARIO_AIRBORNE = 0x6216;
/** [seen] (own byte {0,1}, 2 transitions, RUN-A) 1 = a hammer is in Mario's hands. Makes the input handler skip the jump-button test (entry_1ac3,
 *  ROM 0x1AD4 -> 0x1AE6) and entry_2ed4 swap in the hammer sprite + BGM (0x6089 := 4). Poking 1
 *  turns on hammer BGM + sprite (0x694D = 0x88) + the duration counter 0x6394; a real grab holds it
 *  511 frames until 0x6394:0x6395 wraps past 512. */
export const MARIO_HAMMER_ACTIVE = 0x6217;
/** [seen] (own byte {0,1}, 2 transitions, RUN-A) A touched-but-not-yet-held hammer, latched during the airborne frames by the object search
 *  (entry_2954, ROM 0x295A) and transferred into 0x6217 when the post-landing freeze expires
 *  (loc_1b55, ROM 0x1B5D `ld a,(0x6218); ld (0x6217),a`). NB entry_2954 also clears it each time it
 *  runs, so an isolated poke does not always persist -- the transfer, not the poke, is the evidence. */
export const MARIO_HAMMER_PENDING = 0x6218;
/** [seen] (own bytes live, 5 transitions each, RUN-A: 0x621B {0,219}, 0x621C {0,243}) One of the two ladder-extent limits for the current climb, in (Y+8) units. The climb stepper
 *  stops and clears MARIO_ON_LADDER when (newY+8) equals EITHER 0x621B or 0x621C (loc_1d11, ROM
 *  0x1D28/0x1D2E). On 25m 0x621B was the smaller (top). CAUTION: the two writer paths (loc_1afe vs
 *  entry_1b4e) store the pair in OPPOSITE order, so top/bottom is not settled -- treat as a pair. */
export const MARIO_CLIMB_LIMIT_A = 0x621B;
export const MARIO_CLIMB_LIMIT_B = 0x621C; // [seen] second climb-extent limit above (own byte {0,243}, 5 transitions RUN-A)
/** [seen] (own byte {0..4}, 375 transitions, RUN-B4) Post-landing freeze countdown; while nonzero the movement machine only decrements it (loc_1b55,
 *  ROM 0x1B59) and Mario is unresponsive. Landing loads 4 (entry_1c4f, 0x1C65); on expiry it applies
 *  0x6218 -> 0x6217, strips the sprite low nibble and clears MARIO_WALK_ANIM. Poking 40 freezes Mario
 *  for exactly 40 frames. */
export const MARIO_FREEZE_TIMER = 0x621E;
/** [seen] (own byte {0,1}, 151 transitions, RUN-B4) Airborne sub-phase: while 1 the handler runs the fall-height test each frame (entry_1c05, ROM
 *  0x1C0F -> entry_1c76). Set at airborne-frame 0x14 of a jump (near apex) OR immediately for a
 *  ledge/slope fall; cleared on landing. Observed 0 for jump frames 1-19, 1 from 20; 1 from frame 1
 *  of a fall (so not "descending"). */
export const MARIO_AIR_LANDCHECK = 0x621F;
/** [seen] (own byte {0,1}, 2 transitions, RUN-A) "This fall will kill him." Set by the fall-height test when Mario is >0x0F px below his take-off
 *  Y (entry_1c76, ROM 0x1C87); consumed on landing as MARIO_ACTIVE = (this) XOR 1 (entry_1c4f,
 *  0x1C55). Poking 1 mid-jump makes the landing kill Mario. */
export const MARIO_FATAL_FALL = 0x6220;
/** [seen] (own byte written 0x01 @f1492 on 75m only -- BOARD==3, TAP-SF-B3 write-tap; never fires on 25m/attract, girders continuous) One-shot "the ground went away -- start falling" trigger. Set by the slope/ledge contact check
 *  (entry_2acd, ROM 0x2ACF); the player-state reset sub_1f46 (0x1F49) consumes + clears it and puts
 *  Mario airborne with zero initial velocity. Poking 1 for one frame does exactly that next frame. */
export const MARIO_START_FALL = 0x6221;
/** [seen] (own byte {0,1}, 18 transitions, RUN-A) Toggles 0/1 across climb half-steps; the footstep sound (0x6080 := 3 via sub_1d8f) fires only on
 *  the 0 phase. Its only ROM sites are inside loc_1d51 (0x1D5C `xor 0x01` then `call z,0x1d8f`). It
 *  gates the sound but nothing else reads it -- low confidence. */
export const MARIO_CLIMB_SOUND_TOGGLE = 0x6224;
/** [seen] (own bytes live, RUN-A: LO 0x6394 256 vals 0..255 over 512 transitions, HI 0x6395 {0,1} 2 transitions) 16-bit up-counter for how long the current hammer has been active (loc_2f43, ROM 0x2F4C `inc (hl)`);
 *  the hammer ends when the high byte reaches 2 (~512 frames), clearing 0x6217 and restoring the BGM.
 *  Bit 3 of the low byte drives the 8-frame swing animation. */
export const HAMMER_TIMER_LO = 0x6394;
export const HAMMER_TIMER_HI = 0x6395; // [seen] hi byte of the hammer up-counter above (own byte {0,1}, 2 transitions RUN-A)

// ── Frame-sync & PRNG ────────────────────────────────────────────────────────
/** [seen] (own byte: 256 vals 0..255, 7828 transitions, RUN-2P) Pseudo-random accumulator: sub_0057 (ROM 0x0057, called each vblank) does
 *  0x6018 += FRAME + SPIN_COUNT — a decrementing counter plus a jittery one. Read as entropy at
 *  ROM 0x2186 etc. Measured: 2576 changes over 2600 frames, full byte range. */
export const RANDOM = 0x6018;
/** [seen] (own byte: 256 vals 0..255, 7863 transitions, RUN-1P) Spin counter: incremented once per main-loop pass, ~140×/frame (NOT a frame counter). Its jitter
 *  with per-frame workload is the point — it feeds the PRNG. Measured +138..+142 in gameplay, never
 *  +1 (ROM 0x02CD). */
export const SPIN_COUNT = 0x6019;
/** [seen] (own byte: 256 vals 0..255, 7863 transitions, RUN-1P) Frame counter: DECREMENTED once per vblank NMI (ROM 0x00B5). Everything periodic keys off it
 *  (`and 0x0F`, `and 0x1F`, rst 0x30 guards). Measured: exactly -1 every frame. */
export const FRAME = 0x601A;
/** [seen] (own byte {0,1,4,5}, 4 transitions, RUN-B4) Difficulty ramp = min(LEVEL + (DIFFICULTY_CLOCK >> 3), 5) — rises with level AND time on board
 *  (ROM 0x038F). Consumed by barrel/enemy behaviour (ROM 0x2186 etc). =1 on level 1. */
export const DIFFICULTY = 0x6380;
/** [seen] (own byte: 17 vals 0..16, 23 transitions, RUN-B4) Increments every 256 frames; every 8th increment recomputes DIFFICULTY (ROM 0x0386). Reset at
 *  board start. Measured: 257-frame cadence, resets when the board is built. */
export const DIFFICULTY_CLOCK = 0x6381;
/** [seen] (own byte: 256 vals 0..255, 7866 transitions, RUN-1P) The main loop's latched copy of the last FRAME it serviced; the loop spins on
 *  `ld a,(0x601A) / cp (hl) / jr z` (ROM 0x02D1) — the wait-for-vblank. Byte-identical to FRAME at
 *  the frame boundary except on overrun frames. */
export const FRAME_SEEN = 0x6383;
/** [seen] (own byte: 256 vals 0..255, 7866 transitions, RUN-1P) Increments once per serviced frame; sub_037f (ROM 0x037F) returns unless it wrapped, so the block
 *  below runs every 256 frames. Measured +1/frame. */
export const DIFFICULTY_PRESCALER = 0x6384;

// ── Board / level / sequence ─────────────────────────────────────────────────
/** [seen] (base byte = the saved LIVES field, took {1,2,3} as P1 died, RUN-1P/2P) Player 1's saved 8-byte context (LIVES,LEVEL,SEQPTR_lo,SEQPTR_hi,PLAY_INTRO,BONUS_LIFE,
 *  HOW_HIGH_INDEX,HOW_HIGH_LAST_SEQ). `ldir`'d to the live block 0x6228 on restore (ROM 0x09AB) and
 *  from it on death (ROM 0x12FE). */
export const P1_CONTEXT = 0x6040;
/** [seen] (base byte = P2's saved LIVES field, took {1,2,3} in the 2P game, RUN-2P) Player 2's saved 8-byte context, same field order. Restore ldir at ROM 0x09FE (0x6048→0x6228),
 *  save at ROM 0x1350. NOTE: 0x6049/0x604A/0x604B are P2's saved LEVEL/SEQPTR — NOT board registers;
 *  move_suite pokes them so this ldir doesn't clobber the live poke on the next restore. */
export const P2_CONTEXT = 0x6048;
/** [seen] (own byte = 1/25m natively in RUN-A, 4/100m via poke-to-advance in RUN-B4) Current board type: 1=25m girders, 2=50m conveyors, 3=75m elevators, 4=100m rivets. Re-derived
 *  from *BOARD_SEQ_PTR on every context restore (ROM 0x09B6/0x0A09). Per-board setup dispatch at
 *  ROM 0x0FCB. Proven: poking 1..4 selects the four boards; the sequence table pins the mapping. */
export const BOARD = 0x6227;
/** [seen] (own byte = 3 at start, decremented to 2/1 on deaths, 6-10 transitions, RUN-1P/2P) Lives remaining for the player currently up; offset 0 of the live context (0x6228-0x622F).
 *  Init from DIP_LIVES; `dec (hl)` on death (ROM 0x12FC), `inc` on bonus-life award; the on-screen
 *  lives indicator is redrawn from it (entry_06b8, ROM 0x06C7). Both verifiers confirmed it
 *  independently — poking 5 then dying reads 4 and draws 4 markers, and 3@f463 → 2@f1957 one frame
 *  into the death sub-state. (Player findings named it PLAYER_LIVES.) */
export const LIVES = 0x6228;
/** [seen] (own byte = 1 natively in RUN-A, 4 via poked level in RUN-B4) Level number, 1-based binary, clamped to 99 (`cp 0x64` @ROM 0x06E4). Bonus = min(10*LEVEL+40,80).
 *  Incremented once per completed level at ROM 0x1951 (`ld hl,0x6229 / inc (hl)`) when the board
 *  sequence hits its 0x7F terminator. */
export const LEVEL = 0x6229;
/** [seen] (own low byte observed = 0x65 -> init 0x3A65 at game start, RUN-1P; single meaningful value) 16-bit ROM pointer (lo,hi) into the board-order table; init 0x3A65. Board-complete does
 *  `inc hl / ld a,(hl) / cp 0x7f`; on the 0x7F terminator it reloads 0x3A73 (start of the L5+ group),
 *  so levels 5+ repeat forever. The byte it points at is copied to BOARD. */
export const BOARD_SEQ_PTR = 0x622A; // +1 = high byte
/** [seen] (own byte {0,1}; 1 seen at game start, RUN-1P) 1 = still play the opening cutscene for this player. Template value 1; zeroed by BOTH death
 *  handlers (ROM 0x12F6 `xor a / ld (0x622c),a`). ROM 0x0A71 reads it: non-zero advances 0x600A to
 *  sub-state 7 (cutscene), zero advances to 8 (how-high) — which is why post-death boards skip the
 *  intro. */
export const PLAY_INTRO = 0x622C;
/** [seen] (own byte {0,1}, 2 transitions, RUN-1P) Latch so the score-threshold extra life is granted once per player. sub_0350 (ROM 0x0350)
 *  early-outs on it (`ret nz`) and sets it to 1 (ROM 0x0375) immediately before `inc (LIVES)`.
 *  ROM-unambiguous, and the award path IS reached in attract: DIP_BONUS_LIFE (0x6021) is 0 at early
 *  boot, so the threshold is 0 and sub_0350 awards immediately — the go-live oracle shows LIVES → 1 in
 *  attract. Set to 1 once that award fires; 0 again at each new player's board start.
 *  (Player findings named it EXTRA_LIFE_AWARDED.) */
export const BONUS_LIFE_AWARDED = 0x622D;
/** [seen] (own byte {0,1} stepped at the HOW-HIGH interlude, RUN-1P/B4) Height index for the "HOW HIGH CAN YOU GET?" interlude, clamped to 5. Stepped when BOARD_SEQ_PTR
 *  differs from the copy in 0x622F; reset to 0 on level increment (ROM 0x195C). */
export const HOW_HIGH_INDEX = 0x622E;
/** [seen] (own byte observed = 0x65, copy of BOARD_SEQ_PTR low, at game start, RUN-1P; single meaningful value) Copy of BOARD_SEQ_PTR's low byte, used only to detect the pointer moved (ROM 0x0C11). */
export const HOW_HIGH_LAST_SEQ = 0x622F;
/** [code] (own byte only seen as constant init 8 on 100m -- BOARD==4, RUN-B4; no live decrement caught. Rivet-subsystem liveness is the NEIGHBOR EDGE_RIVET_ARMED, 154 toggles + ROM `dec (hl)` @0x1A86; on 25m the byte is unrelated shared scratch) Rivets still in place on 100m; init 8 from ROM template 0x3DAC. `dec (hl)` per rivet removed
 *  (ROM 0x1A86); at 0 the board-complete test at ROM 0x1E80 forces GAME_SUBSTATE = 0x16. */
export const RIVETS_LEFT = 0x6290;
/** [seen] (own byte toggled {0,1} 154 transitions on 100m -- BOARD==4, RUN-B4 -- as Mario crossed rivet-edge columns; only 5 -- shared scratch -- on 25m) Edge-triggered one-shot armed latch in the rivet-removal subsystem. arm_1a4b SETs it to 1
 *  (ROM 0x1A4D) when the player reaches a rivet-board screen-edge column (MARIO_X 0x4B/0xB3);
 *  sub_1a33's READ+`dec a` gate (ROM 0x1A43) proceeds only if it was 1, and ROM 0x1A51 DISARMs
 *  it back to 0. Rivet-scoped one-shot: sits just below RIVET_PRESENT but is NOT part of the
 *  rivet array. */
export const EDGE_RIVET_ARMED = 0x6291;
/** [code] (base byte only seen as constant init 1/present on 100m -- BOARD==4, RUN-B4/2P; no per-rivet 1->0 clear caught on the base, the array/ROM cite @0x1A7B carries it; on 25m unrelated scratch) 8 per-rivet present flags (1 = still there) at 0x6292-0x6299; ROM 0x1A7B indexes 0x6292+b,
 *  tests+clears it, then decrements RIVETS_LEFT. (0x6291 = EDGE_RIVET_ARMED sits just below and
 *  is NOT part of the array.) */
export const RIVET_PRESENT = 0x6292; // [8]

// ── Collision-search result cells ─────────────────────────────────────────────
/** [seen] (own byte {0,1} live — nonzero only in SUB=3 attract; PLAY {0:6268,1:2823}, 20
 *  transitions, heavier when Mario is among barrels; no >1 seen this run) Board collision-search
 *  overlap counter. entry_3e99 clears it, runs entry_3ec3 (per-overlap `inc (0x6060)`) over both
 *  object groups (0x6700 ×10, 0x6400 ×5), then reads it back as the overlap severity code
 *  (0/1/2+/3+ → 0/1/3/7). Only these two routines touch it — transient within one
 *  dispatchBoardOverlapSearch dispatch, but single-meaning. */
export const OVERLAP_COUNT = 0x6060;
/** [seen] (16-bit WORD; recorded on every hit = 0x6700 or 0x6400 = OBJ_ARRAY_67/64 base exactly.
 *  The observable is the WORD: the low byte 0x6351 reads a constant page-aligned 0x00; the high
 *  byte 0x6352 is the array classifier — entry_1ea0 `cp 0x65` on it tells which array was hit.)
 *  Base address of the hazard-object array that contained the collision hit. loc_281d writes it
 *  (write16 IX from dispatchBoardCollision); entry_1ea0 reads `ix,(0x6351)` to walk to the hit
 *  record. Only loc_281d/entry_1ea0 touch it. */
export const COLLIDED_OBJECT_BASE = 0x6351; // 16-bit; 0x6352 is its high byte, do not name separately
/** [seen] (= 0x20 on every hit = OBJ_ARRAY_67/64 record stride exactly) Low byte of the hit array's
 *  per-record stride. loc_281d writes E; entry_1ea0 reads it into E and uses DE=0x00:stride as the
 *  per-record IX increment while walking to the hit record. Only these two touch it. */
export const COLLIDED_OBJECT_STRIDE = 0x6353;
/** [seen] (small index set {0,2,3,4,7} live — the record's position in the swept array) Index of
 *  the hit object within its array (= OBJ_SEARCH_COUNT − B, the records already scanned). loc_281d
 *  writes it; entry_1ea0 reads it as the loop count that walks base+index*stride to the hit record
 *  ((0x6354)==0 → skip). Only these two touch it. */
export const COLLIDED_OBJECT_INDEX = 0x6354;
/** [seen] (own low byte observed = 0x85 -> points at 0x6385 INTRO_STEP during the cutscene, RUN-1P; single meaningful value) 16-bit INDIRECT pointer (lo,hi): the ADDRESS of the counter the gated tick helper loc_3069
 *  advances. loc_3069 (ROM 0x306A `ld hl,(0x63c0) / inc (hl)`) loads the WORD stored here and
 *  increments the byte it points at, but only once the 0x6009 gate expires. Setup routines re-point
 *  it — loc_0ae8/loc_0b06 seed 0x6385 (INTRO_STEP) for the cutscene, loc_17b6 seeds 0x6388 for the
 *  how-high render. HOW WE KNOW: the `ld hl,(nn)` indirect load is an unambiguous ROM cite + three
 *  consistent writers. */
export const SEQ_ADVANCE_PTR = 0x63C0;

// ── Sound scheduler ──────────────────────────────────────────────────────────
/** [seen] (base byte {0,1,2,3}, 63 transitions, RUN-2P) 8 per-latch-bit sound trigger counters at 0x6080-0x6087 (ls259.6h). sub_00e0 (ROM 0x00E0, per
 *  NMI) walks them with 0x7D00-0x7D07: non-zero → decrement and assert the bit, zero → deassert.
 *  Game code stores 3 (a 3-frame assert). Per-bit sound names are audio/README.md's, not re-derived. */
export const SND_TRIGGER = 0x6080; // [8]
/** [seen] (own byte {0,1,2,3}, 20 transitions, RUN-2P) Same countdown shape, driving the I8035 sound-CPU interrupt line at 0x7D80 (ROM 0x010E). */
export const SND_IRQ_TRIGGER = 0x6088;
/** [seen] (own byte {0,4,8}, 9 transitions, RUN-1P) Background tune index → 0x7C00 while SND_PRIORITY_FRAMES is 0; held, so the tune loops
 *  (ROM 0x0102). Observed 0x08 (25m theme) from f1395 on board 1. */
export const SND_BGM = 0x6089;
/** [seen] (own byte {0,1,2,6,15}, 9 transitions, RUN-1P) Priority tune index → 0x7C00 while SND_PRIORITY_FRAMES != 0, overriding SND_BGM (ROM 0x0108).
 *  Observed 0x01 (intro) then 0x0F (roar) during the cutscene, 0x02 at level start. */
export const SND_PRIORITY = 0x608A;
/** [seen] (own byte {0,1,2,3}, 40 transitions, RUN-2P) Countdown for SND_PRIORITY; game code stores 3, so a priority tune is a 3-frame pulse
 *  (ROM 0x00FA). Observed writes are 3 then 2,1,0 on consecutive frames. */
export const SND_PRIORITY_FRAMES = 0x608B;

// ── Task scheduler ───────────────────────────────────────────────────────────
/** [seen] (own byte: 33 vals 0..254, 332 transitions, RUN-A) Enqueue pointer — low byte of an address in page 0x60. sub_309f writes [D,E] at 0x6000+TAIL and
 *  advances by 2, wrapping 0xFE→0xC0 (ROM 0x30A3); a full slot silently drops the request. Init 0xC0. */
export const TASK_TAIL = 0x60B0;
/** [seen] (own byte: 33 vals 0..254, 335 transitions, RUN-A) Dequeue pointer, same encoding. The main loop reads (0x6000+HEAD); 0xFF opcode = "no task".
 *  Advances by 2 after dispatch (ROM 0x02BF). Proven: 0xC4→0xC6 the frame after a task ran. */
export const TASK_HEAD = 0x60B1;
/** [seen] (base ring slot's own byte took task opcodes {0xFF free,3,4,5} live, up to 4 active slots; write-tap 0x60C0 + PROBE-SR ring scan) Task ring: 32 slots × 2 bytes [opcode, argument] at 0x60C0-0x60FF. 0xFF opcode = free (boot fills
 *  all 64 bytes 0xFF, ROM 0x0298; the dispatcher writes 0xFF back on consume). Opcode 0 = add-to-
 *  score. Proven by injecting (0,5) and watching P1_SCORE = 000500. */
export const TASK_RING = 0x60C0;

// ── Score & bonus ────────────────────────────────────────────────────────────
/** [code] (base = the low BCD pair, structurally ALWAYS 0x00 -- DK scores are x100; write-tap 0x60B2 wrote only 0x00. The live score is the NEIGHBOR middle byte 0x60B3 {0x00,0x01,0x37}=100/3700 pts, PROBE-SR -- so the base's own byte was never seen taking a meaningful live value) Player 1 score: 3-byte LITTLE-endian packed BCD (0x60B4 = most-significant pair). Award opcode 0
 *  adds a 3-byte entry from the table at ROM 0x3529 (arg = index). Slot selected by sub_055f
 *  (ROM 0x055F) on 0x600D. Proven: award 5 (+500) landed in 0x60B3, the middle byte. */
export const P1_SCORE = 0x60B2;
/** [code] (base = low BCD pair, structurally 0x00 for real scores; own byte only {0xAA attract placeholder, then 0x00 at 2P start} -- neither a live score. The live P2 score is the NEIGHBOR 0x60B6 {0x01}=+100 @f7242, TAP-2P) Player 2 score, same 3-byte little-endian BCD format. sub_055f returns 0x60B5 when 0x600D != 0.
 *  Attract-mode placeholder is AA AA AA (ROM template 0x01BA). */
export const P2_SCORE = 0x60B5;
/** [seen] (own byte took the meaningful low-BCD-pair value 0x50 = the '50' of the 007650 default, {0,0x50} RUN-A -- a real nonzero value on this base, UNLIKE the two score bases; format also control-proven: forcing 990500 -> 00 05 99) High score, same format; default 007650 from ROM template 0x01BA. Updated by the downward
 *  MSB-pair-first compare at ROM 0x0540; on a new high, 3 bytes are copied here. Proven: forcing
 *  P1 to 990500 overwrote this with 00 05 99. */
export const HIGH_SCORE = 0x60B8;
/** [seen] (own byte {0,50}, 9 transitions, RUN-2P) The board's starting bonus, held constant for the whole board (denominator for barrel-release
 *  pacing at ROM 0x2C12/0x2C33 and the end-of-board tally). Written only at ROM 0x0F8E. */
export const BONUS_START = 0x62B0;
/** [seen] (own byte: 62 vals 0..80, 61 transitions, RUN-B4) Bonus counter in units of 100 points (on-screen value = BONUS*100). Set at board start to
 *  min(10*LEVEL+40, 80); reaching 0 sets 0x6386=1. Ticks down via two mechanisms: the timed
 *  decrementer (boards 2/3/4, ROM 0x2FCB) or the barrel-release routine (board 1, ROM 0x2CB8). */
export const BONUS = 0x62B1;
/** [seen] (own byte {0,34,42,50}, 13 transitions, RUN-1P) Next BONUS value at which the board's periodic spawn event fires; init to BONUS_START, stepped
 *  down by 8 on each match. ROM 0x2C57 `cp c / sub 0x08 / ld (0x62b2),a`. */
export const BONUS_EVENT_MARK = 0x62B2;
/** [seen] (own byte {0,120}, 9 transitions, RUN-2P) Frames between bonus ticks = max(0xDC - 2*bonus, 0x28); reload value for BONUS_TICK. Computed at
 *  ROM 0x0F97. Measured: L2→100, L3→80, L4→60 frames (metronomic on boards 2/3/4). */
export const BONUS_PERIOD = 0x62B3;
/** [seen] (own byte: 61 vals 0..60, 3636 transitions, RUN-B4) Countdown to the next bonus tick; reloaded from BONUS_PERIOD. ROM 0x2FCE `dec (hl) / ret nz`. */
export const BONUS_TICK = 0x62B4;
/** [seen] (own byte walked the full 0->1->2->3 machine after BONUS reached 0, TAP-BEXP write-tap, boards 2/4) Small state machine (0-3) run by `ld a,(0x6386) / rst 0x28` at ROM 0x1A07; set to 1 by both
 *  bonus-decrement sites the moment BONUS hits 0. */
export const BONUS_EXPIRED_STEP = 0x6386;
/** [seen] (own byte counted the full 0xFF..0x01 in state-2 of the bonus-expired sequence, TAP-BEXP write-tap, boards 2 & 4) Countdown-delay timer of the bonus-expired sequence. CLEARED to 0 by loc_1a15's INIT step
 *  (ROM 0x1A16); state 2 (loc_1a1f) counts it down `dec (hl) / ret nz` (ROM 0x1A22) and advances
 *  BONUS_EXPIRED_STEP to 3 on underflow. */
export const BONUS_EXPIRED_DELAY = 0x6387;

// ── Prize / item collection ──────────────────────────────────────────────────
/** [code] 1 = a prize/item was just collected; set at pickup (edge / airborne collision / rivet),
 *  consumed at landing (entry_1c4f -> loc_1d95 clears it + queues the pickup tune off 25m). Lifecycle
 *  solid; item IDENTITY inferred (alt PRIZE_COLLECTED). */
export const ITEM_COLLECTED = 0x6225;

// ── Object spawn, movement & init scratch ────────────────────────────────────
/** [code] Base of a heterogeneous board-object scratch region (0x6280+); initBoardState ldirs a
 *  0x40-byte ROM template here per board and sub_2207 reads 8-byte records from it. A BASE, not a
 *  uniform table — RIVETS_LEFT/BONUS and other cells are carved from the span. */
export const BOARD_OBJ_SCRATCH = 0x6280;
/** [seen] 50m: object-1 reversal timer; loc_2602 decs on even frames, reloads 0x80 + reverses the step
 *  on underflow. Board-2 only. GROUNDED (pass-5 50m real-ROM run, credited board 2, substate 0x0C):
 *  live range 1..128, reload 0x80 (=128) and the dir1 sign-flip both proven on the underflow frame. */
export const M50_OBJ1_REVERSE_TIMER = 0x62a0;
/** [seen] 50m: object-1 signed step-direction latch; only the SIGN is published (to M50_OBJ1_STEP). Board-2 only.
 *  GROUNDED (pass-5 50m run): live signed values {1,2,254,255}; sign flips on the timer underflow. */
export const M50_OBJ1_STEP_DIR = 0x62a1;
/** [seen] 50m: object-2 reversal timer (sub_262f); even-frame `dec`, reload 0xC0 + reverses
 *  M50_OBJ2_STEP_DIR on underflow. Structural sibling of M50_OBJ1_REVERSE_TIMER. Board-2 only.
 *  GROUNDED (pass-5 50m run): live range 1..192, reload 0xC0 (=192) confirmed by the observed max. */
export const M50_OBJ2_REVERSE_TIMER = 0x62a2;
/** [seen] 50m: object-2 signed step-direction latch (sub_262f); published to M50_OBJ2_STEP_POS. Board-2 only.
 *  GROUNDED (pass-5 50m run): live signed values {1,2,254,255}. */
export const M50_OBJ2_STEP_DIR = 0x62a3;
/** [seen] 50m: object-3 reversal timer (sub_2679); even-frame `dec`, reload 0xFF + reverses
 *  M50_OBJ3_STEP_DIR on underflow. Board-2 only. GROUNDED (pass-5 50m run): live range 1..255,
 *  reload 0xFF (=255) confirmed by the observed max. */
export const M50_OBJ3_REVERSE_TIMER = 0x62a5;
/** [seen] 50m: object-3 signed step-direction latch (sub_2679); published to M50_OBJ3_STEP. Board-2 only.
 *  GROUNDED (pass-5 50m run): live signed values {1,2,254,255}. */
export const M50_OBJ3_STEP_DIR = 0x62a6;
/** [code] Spawn-cadence timer; at 0 sub_27da claims a free 0x6600 slot, seeds it, reloads 0x34; always
 *  decrements. */
export const SPAWN_TIMER = 0x62a7;
/** [code] Base of the per-board type-0 object-init table (stride 5); loadBoardObjectRecords de-interleaves
 *  type-0 records here, sub_2441/sub_236e consume it. Exact record layout inferred. */
export const OBJ_PARAM_TABLE0 = 0x6300;
/** [code] Base of the per-board type-1 object-init table (parallel to TABLE0, IY-indexed). */
export const OBJ_PARAM_TABLE1 = 0x6310;
/** [code] Spawn request; sub_2fcb stores 3 each bonus period, loc_2ea7 tests bit0 -> activates the
 *  object (+0:=1, position/appearance seeded) and clears it to 0. */
export const SPAWN_REQUEST = 0x6396;
/** [code] One-shot "Mario Y just repositioned" flag; sub_29af sets 1 right after writing MARIO_Y, read
 *  as a gate by sub_2a85/sub_2745, cleared by the edge-reset routines. */
export const EDGE_REPOSITION_FLAG = 0x6398;
// Periodic object event-request latches raised by loc_2ddb (board-gated, difficulty-scaled)
// and consumed one-per-frame by their inserters. Two distinct request/consumer chains.
/** [seen] ({0,1}, board-gated) Object-SPAWN request into OBJ_ARRAY_65A0 (the 50m moving
 *  objects), consumed by sub_2523: when 1 and OBJ_SPAWN_TIMER (0x639B) has drained, sub_2523
 *  scans OBJ_ARRAY_65A0 for a free slot, spawns an object, clears this, reloads the timer to
 *  0x7C. Producer: loc_2ddb. Grounded live vs MAME on 50m: {0,1}, 128-frame rise period,
 *  each rise coincident with the timer at 0. Single producer + single consumer. */
export const OBJ_SPAWN_REQ = 0x639a;
/** [seen] (free-runs 0x7C->0) Reload/cooldown timer gating OBJ_SPAWN_REQ: sub_2523 decrements
 *  it and returns while nonzero, services the spawn only when it hits 0, reloads it to 0x7C
 *  after a spawn. Grounded live vs MAME on 50m (free-runs 0x7C->0, 1455 transitions); pinned 0
 *  on 100m where the request stays stuck. */
export const OBJ_SPAWN_TIMER = 0x639b;
/** [seen] ({0,1}, board-gated) Object-INSERT event-request latch consumed by entry_313c:
 *  when 1 (and a free slot exists in OBJ_ARRAY_64 on 50m) entry_313c activates a slot and
 *  clears it (consume-and-clear); also cleared on board reset (handler_0763). TWO producers
 *  raise it := 1 — loc_2ddb's difficulty-scaled periodic trigger (50m/100m) and loc_03a2's
 *  ARM_COUNTER-underflow re-arm (loc_03a2 does not read it back — one reader only). Grounded
 *  live vs MAME: {0,1}, 100m 128-frame rise period, consumed within a frame or two. Reverses
 *  the earlier "0x63xx engine scratch" rejection — single reader, one coherent request role. */
export const EVENT_REQ_313C = 0x63a0;
// 50m published per-object ±step shadows: each dir-latch above is reduced to a signed unit step by
// sub_26e9 (odd frame ±1 / even frame 0) and stored here for the 50m platform/object mover to read.
/** [seen] 50m: object-1's published signed X-step, from sub_26e9 of M50_OBJ1_STEP_DIR (0x62A1). Board-2 only.
 *  GROUNDED (pass-5 50m run): live {0,1,255} — 0 on even frames, ±1 on odd frames (sign follows the dir latch). */
export const M50_OBJ1_STEP = 0x63a3;
/** [seen] 50m: object-2's published -step shadow (negation of M50_OBJ2_STEP_POS, same publisher 0x62A3);
 *  the mover reads this arm when the field/Mario X < 0x80. Board-2 only. GROUNDED (pass-5 50m run):
 *  live {0,1,255}, proven the exact negation of M50_OBJ2_STEP_POS. */
export const M50_OBJ2_STEP_NEG = 0x63a4;
/** [seen] 50m: object-2's published +step shadow, from sub_26e9 of M50_OBJ2_STEP_DIR (0x62A3); the mover
 *  reads this arm when the field/Mario X >= 0x80. Board-2 only. GROUNDED (pass-5 50m run): live {0,1,255},
 *  EXACT byte-for-byte negation of M50_OBJ2_STEP_NEG (pos=255<->neg=1, pos=1<->neg=255, both 0 together). */
export const M50_OBJ2_STEP_POS = 0x63a5;
/** [seen] 50m: object-3's published signed X-step, from sub_26e9 of M50_OBJ3_STEP_DIR (0x62A6). Board-2 only.
 *  GROUNDED (pass-5 50m run): live {0,1,255} — 0 even / ±1 odd. */
export const M50_OBJ3_STEP = 0x63a6;
/** [seen] 50m sprite-object row X-shift delta. On the BOARD==2 arm, entry_03fb/entry_0400 compute
 *  (0x6910)-0x3b (a sprite-object X byte less 0x3b) and store it here; shiftEvenBoardSpriteColumn
 *  (ROM 0x0478) then reads it on the 50m arm and adds it into the X column of the sprite-object block
 *  (SPRITE_OBJ_BLOCK base). An X-shift, NOT a colour delta (the colour repaint is a separate
 *  fall-through after). GROUNDED (pass-5 50m real-ROM run, credited board 2): live on the board-2 arm,
 *  full 0..255 range with 1996 frame-to-frame transitions over the 3994-frame gameplay window. */
export const M50_OBJ_ROW_SHIFT = 0x63b7;

// ── String / object renderer ─────────────────────────────────────────────────
/** [code] Source char-string pointer (word); walked to a 0x7F terminator, stored back each step. */
export const RENDER_STR_PTR = 0x62a8;
/** [code] Object-record pointer (word) the renderer reads/writes (sprite fields +7/+8). */
export const RENDER_OBJ_PTR = 0x62aa;
/** [code] Destination pointer (word); the renderer writes the 4-byte record here (a slot inside
 *  SPRITE_BUFFER, 0x6980+(10-B)*4). */
export const RENDER_DST_PTR = 0x62ac;

// ── Effect subsystem ─────────────────────────────────────────────────────────
/** [code] Effect state / 4-way rst-0x28 router (sub_1dbd); pickup/hit sites raise it to 1. */
export const EFFECT_STATE = 0x6340;
/** [code] Effect display-hold countdown; armed 0x40, decremented in place, blanks POPUP_SPRITE on expiry. */
export const EFFECT_TIMER = 0x6341;
/** [code] Effect select/mode byte; loc_1dc9 rra-walks its low bits to pick the setter (bit0/1/2). */
export const EFFECT_SELECT = 0x6342;
/** [code] Effect param pointer (word); indirect base of the hit record, deref'd by loc_1e15. */
export const EFFECT_PARAM_PTR = 0x6343;
/** [code] Effect-sequence state / 3-way rst-0x28 router (sub_1e96); re-arms EFFECT_STATE on completion. */
export const EFFECT_SEQ_STATE = 0x6345;
/** [code] Effect-sequence INNER countdown; decremented first each tick, steps the outer when it drains. */
export const EFFECT_SEQ_INNER = 0x6346;
/** [code] Effect-sequence OUTER countdown; decremented when the inner hits 0, advances EFFECT_SEQ_STATE on 0. */
export const EFFECT_SEQ_OUTER = 0x6347;

// ── Intro cutscene & blink animation ─────────────────────────────────────────
/** [code] Intro cutscene band count; loc_0b06 seeds 5, loc_0b68 decs per band, (count-1)*16 indexes the
 *  band table (0x38DC). Cutscene-only. */
export const CUTSCENE_BAND_COUNT = 0x638d;
/** [code] Intro Kong-climb scroll index; runIntroClimbStep seeds 0x1F, walked down as the displaced
 *  video-copy offset (loop while != 0x0A). */
export const INTRO_SCROLL_INDEX = 0x638e;
/** [code] Blink animation phase / 4-way rst-0x28 router (entry_127f); drives the blinkSpritePairOn/Off
 *  toggle. WHAT blinks is inferential. */
export const BLINK_ANIM_PHASE = 0x639d;
/** [code] Blink repeat count; primed 0x0D, decremented each gate tick while toggling the pair, advances
 *  BLINK_ANIM_PHASE at 0. */
export const BLINK_COUNT = 0x639e;
/** [code] Intro walk pointer A (word); setupIntroCutsceneStep seeds 0x38B4, loc_0b06 advances it to a
 *  0x7F terminator. */
export const INTRO_WALK_PTR_A = 0x63c2;
/** [code] Intro walk pointer B (word); setupIntroCutsceneStep seeds 0x38CB, loc_0b68 consumes it. */
export const INTRO_WALK_PTR_B = 0x63c4;

// ── State-0 colour cycle ─────────────────────────────────────────────────────
/** [seen] (own byte {0,1}, 30 transitions, RUN-1P) 1 = the colour-cycle frame-counter sweep is currently running. While set, loc_0426 advances the
 *  sweep counter 0x6390 every frame; loc_0413 sets it to 1 at each FRAME wrap (0x601A==0, ROM 0x0423),
 *  and loc_0464 clears it to 0 when the counter finishes its sweep at 0x80 (ROM 0x0468). Its only live
 *  writers are those two colour-cycle sites (+ boot clear) — unshared. CONTROL: forcing 0 mid-sweep
 *  freezes 0x6390; forcing 1 during an idle window starts 0x6390 advancing immediately. (The counter
 *  0x6390 stays hex — it is SHARED with the how-high interlude animation stepper, so a colour-specific
 *  name there would mislead.) */
export const COLOUR_CYCLE_ACTIVE = 0x6391;

// ── Board render — line segments ─────────────────────────────────────────────
/** [code] First endpoint tile address (word) = sub_2ff0(y,x); column start. */
export const SEG_ADDR1 = 0x63ab;
/** [code] Second endpoint tile address (word) = sub_2ff0(y2,x2); end-cap write ptr. */
export const SEG_ADDR2 = 0x63ad;
/** [code] First endpoint x&7 (sub-tile X). */
export const SEG_SUBTILE1 = 0x63af;
/** [code] Second endpoint x2&7 (sub-tile X). */
export const SEG_SUBTILE2 = 0x63b0;
/** [code] Segment height |y2-y|; paid down 8px/row by the column drawers. */
export const SEG_HEIGHT = 0x63b1;
/** [code] Segment run x2-x; its sign gives the ladder/girder slant. */
export const SEG_RUN = 0x63b2;
/** [code] Record kind / 0xAA terminator / girder-vs-ladder drawer selector. */
export const SEG_KIND = 0x63b3;
/** [code] First endpoint y&7 (sub-tile Y). */
export const SEG_SUBTILE_Y1 = 0x63b4;
/** [code] Current stamped tile code; drawLadder/fillTileColumn step it for slant/fill. */
export const SEG_TILE = 0x63b5;

// ── Engine / object scratch (mined from the optimization sweep) ───────────────
/** [seen] (own byte {0,1,5,10}, 20 transitions, RUN-1P) Record count of the object-list sweep currently being searched, staged for the bounding-box
 *  search entry_2913. Every per-board collision handler stores its sweep length here just before the
 *  search (sub_2880/28b0/28e0/2901, e.g. ROM 0x2884 `ld (0x63b9),a`); on a hit the found-handler
 *  reads it back and recovers the matched record's index as count − B (loc_281d, ROM 0x2846). HOW WE
 *  KNOW: 9 writers all storing a sweep count + one index-recovery reader. */
export const OBJ_SEARCH_COUNT = 0x63B9;

// ── Attract-demo input player ────────────────────────────────────────────────
/** [seen] Attract-demo script step index — sole r/w advanceAttractDemoInput. Walks 0 -> 18 then resets to 0 each demo
 *  cycle (observed 3 cycles live), and each advance coincides with a new P1_INPUT. */
export const DEMO_SCRIPT_INDEX = 0x63cc;
/** [seen] Attract-demo per-step countdown — sole r/w advanceAttractDemoInput. Reloaded to a fresh duration at every
 *  DEMO_SCRIPT_INDEX advance, decremented ~every frame (wraps 0..255). */
export const DEMO_SCRIPT_COUNTDOWN = 0x63cd;

// ── ROUTINES ─────────────────────────────────────────────────────────────────
// Every named ROM routine, keyed by entry address (address order). `name` mirrors the
// idiomatic/<name>.js filename (source of truth); `role` is one line on what it does;
// `cert` is the evidence class (code = understood from code, seen = observed under MAME,
// guess = unconfirmed). Metadata for tooling + the external disassembly — not imported by
// the running code (routines call each other directly by name). See docs/names-registry.md.
export const ROUTINES = {
  0x0000: { name: "boot", role: "reset/cold-boot entry — runs boot init (0x0000-0x02BC) via bootOnly, then delegates to the mainLoop generator (the coroutine go-live spine)", cert: "code" },
  0x0008: { name: "gameActiveGuard", role: "caller-skip guard: proceed only while a credited game is in play", cert: "code" },
  0x0010: { name: "marioActiveGuard", role: "caller-skip guard: proceed only while Mario is alive", cert: "code" },
  0x0018: { name: "tickSubstateTimer", role: "tick the sub-state countdown, report expiry", cert: "code" },
  0x0020: { name: "tickSubstatePrescaler", role: "tick the low half of the sub-state timer; on its underflow chain into the high half", cert: "code" },
  0x0028: { name: "dispatchInlineJumpTable", role: "the `rst 0x28` inline-jump-table trampoline", cert: "code" },
  0x0030: { name: "boardBitGate", role: "the `rst 0x30` vector: a per-board skip gate", cert: "code" },
  0x0038: { name: "addToSpriteObjectColumn", role: "the `rst 0x38` vector: add the delta C into one field across all ten sprite-object records", cert: "code" },
  0x003d: { name: "addStrided", role: "add the 8-bit constant C to each of B bytes at HL, stride DE", cert: "code" },
  0x004e: { name: "loadSpriteObjectBlock", role: "copy the 40-byte sprite-object block from the caller's source pointer into 0x6908", cert: "code" },
  0x0057: { name: "stirRandomSeed", role: "mix the pseudo-random seed once per vblank", cert: "code" },
  0x0066: { name: "serviceVblankNmi", role: "the vblank NMI handler: one frame of interrupt service", cert: "code" },
  0x0087: { name: "readControls", role: "select the active joystick port and edge-debounce it into the cooked control word the movement code reads", cert: "code" },
  0x00b5: { name: "perFrame", role: "the per-frame service + game-state dispatch tail of the vblank NMI", cert: "code" },
  0x00e0: { name: "soundDriverTick", role: "push the queued sound state to the audio hardware, once per vblank NMI", cert: "code" },
  0x011c: { name: "silenceSound", role: "zero every sound output and its work-RAM shadow", cert: "code" },
  0x0141: { name: "blitSpritesViaDma", role: "program the i8257 and blit the sprite shadow buffer to sprite RAM", cert: "code" },
  0x017b: { name: "serviceCoinInput", role: "debounce the coin line, tally pulses, and award BCD credits", cert: "code" },
  0x01c3: { name: "powerOnInit", role: "game state 0: the one-time power-on initialization", cert: "code" },
  0x0207: { name: "decodeDipSwitches", role: "unpack DSW0 into the settings block, then load the ROM option table", cert: "code" },
  0x0266: { name: "clearRamAndInitHardware", role: "power-on setup: wipe all RAM, seed the task queue, set the display hardware bits, silence the sound, and hand the game its stack", cert: "code" },
  0x02bd: { name: "mainLoop", role: "the task-scheduler main loop — walk the page-0x60 task table (pointer at 0x60B1), dispatch each task, run the per-frame work, and advance the frame counter (the coroutine go-live spine)", cert: "code" },
  0x0315: { name: "redrawPlayerUpIndicator", role: "blink the on-screen 'player up' indicator column, every 16th frame", cert: "code" },
  0x0347: { name: "selectPlayerIndicatorColumnBase", role: "pick one of two video-RAM column-base addresses from a player selector", cert: "code" },
  0x0350: { name: "awardBonusLifeAtThreshold", role: "grant the once-per-player bonus life the first time the running score reaches the operator-set threshold, then refresh the HUD", cert: "code" },
  0x037f: { name: "rampDifficulty", role: "raise the difficulty value with level and time on the board", cert: "code" },
  0x03a2: { name: "loc_03a2", role: "a periodic event, serviced only when three gates in a row pass", cert: "code" },
  0x03f2: { name: "loc_03f2", role: "store a byte at a caller-given address, then bump-and-restore it on a spin coin-flip", cert: "code" },
  0x03fb: { name: "loc_03fb", role: "the per-frame colour-cycle driver entry, with a 50m-only sprite-object row X-shift preamble in front of it", cert: "code" },
  0x0400: { name: "loc_0400", role: "the colour-cycle driver entered mid-body at 0x0400: on the 50m arm, stage the sprite-object row's X-shift, then hand off to the per-frame colour-cycle service", cert: "code" },
  0x0413: { name: "serviceColorCycle", role: "the per-frame entry to the state-0 colour cycle: advance a running sweep, or re-arm a fresh one at the frame-counter wrap, else just repaint", cert: "seen" },
  0x0426: { name: "advanceColorCycleSweep", role: "advance the colour-cycle sweep counter one step per frame and dispatch this frame's colour work", cert: "code" },
  0x0450: { name: "dispatchColorCascadeByBoard", role: "the per-frame colour-cascade dispatcher: route by the current board into one of the colour-cycle arms", cert: "code" },
  0x0464: { name: "resetColorCycleSweep", role: "reset (end) the colour-cycle sweep when its counter tops out, then continue the frame's colour work", cert: "code" },
  0x0478: { name: "shiftEvenBoardSpriteColumn", role: "shift the sprite-object block's X column by a board-specific delta, then run the per-frame colour-cycle repaint", cert: "code" },
  0x0486: { name: "dispatchColorCyclePaint", role: "the per-frame colour-cycle repaint router: read the sweep counter, then route the colour-column repaint by board and sweep phase", cert: "code" },
  0x04a1: { name: "paintColorColumnWithLowCode", role: "the colour-cycle blink driver's LOW-CODE arm: preset the fill code to 0x10, then paint the 3-cell colour column and hold the sprite blink", cert: "code" },
  0x04a3: { name: "paintColorColumnAndHoldBlink", role: "the colour-cycle blink driver's 'leave-as-is' arm: repaint sprite record #1's colour-RAM column, then commit its sprite code unchanged", cert: "code" },
  0x04ac: { name: "storeBlinkSpriteCode", role: "commit sprite record #1's tile-code byte, the shared tail of the attract/how-high blink driver", cert: "code" },
  0x04be: { name: "runRivetColorCycleBlink", role: "the 100m rivet-board branch of the per-frame colour-cycle blink driver: repaint two decorative colour columns, then blink a pair of sprites by the sweep phase and Mario's", cert: "code" },
  0x04e1: { name: "blinkSpritePairOn", role: "the colour-cycle blink driver's 'blink ON' arm: raise the blink bit (bit 7) on BOTH decorative blink sprites, then commit via the shared store tail", cert: "code" },
  0x04f1: { name: "paintColorColumnAndBlinkOff", role: "the rivet-board colour-cycle arm: preset the fill code to 0xEF, paint the 3-cell descending colour column at 0x7583, then blink the decorative sprite pair OFF", cert: "code" },
  0x04f9: { name: "blinkSpritePairOff", role: "the 'blink OFF' arm of the colour-cycle blink driver: force the blink bit off on the pair of decorative sprites", cert: "code" },
  0x0509: { name: "blinkSpritePairByX", role: "pick the decorative-sprite-pair blink phase by the player's X; the bit-6-clear arm of the rivet-board colour-cycle blink block", cert: "code" },
  0x0514: { name: "fillDescendingColumn", role: "write a 3-cell descending run into memory at a caller stride", cert: "code" },
  0x051c: { name: "addToScoreTask", role: "the 'add to a score' task: bump the player-up's score by a table amount, redraw it, and promote it to the high score if it now leads", cert: "code" },
  0x055f: { name: "selectCurrentPlayerScoreCounter", role: "select the score-counter address for the player currently up", cert: "code" },
  0x056b: { name: "loc_056b", role: "pick one of two destination columns from a zero/nonzero selector, then render a 3-byte packed-BCD counter up that column", cert: "code" },
  0x0578: { name: "renderBcdColumnFixedCell", role: "draw a packed 3-byte BCD counter as six digits up a fixed video column", cert: "code" },
  0x057c: { name: "renderBcdColumn", role: "draw a packed 3-byte BCD value as six digits up a video column", cert: "code" },
  0x0583: { name: "expandBcdDigits", role: "unpack a run of packed BCD/hex bytes into two digit cells each", cert: "code" },
  0x0593: { name: "storeDigitAndAdvance", role: "write one BCD/hex digit to the destination cell, then step the cursor", cert: "code" },
  0x059b: { name: "resetScoreCounter", role: "zero one of the three score counters, then repaint it via the score-draw task", cert: "code" },
  0x05c6: { name: "drawScoreTask", role: "the score-counter draw task: repaint one of the three on-screen score readouts, chosen by the task payload", cert: "code" },
  0x05da: { name: "drawHighScore", role: "repaint the on-screen high-score readout from the HIGH_SCORE counter", cert: "code" },
  0x05e9: { name: "drawStringVertical", role: "draw a doubly-indirected string down a tilemap column", cert: "code" },
  0x0611: { name: "drawCreditLineInAttract", role: "repaint the 'CREDIT nn' line, but only while no credited game is in progress (attract)", cert: "code" },
  0x0616: { name: "drawCreditDisplay", role: "paint the 'CREDIT nn' line: the label plus the credit count", cert: "code" },
  0x066a: { name: "loc_066a", role: "render a packed two-digit BCD byte into its on-screen field, suppressing a leading zero", cert: "code" },
  0x0689: { name: "stampTwoDigitField", role: "stamp a two-digit number's tile pair into its on-screen field: the high-digit tile into one cell, the low-digit tile into the cell one column over", cert: "code" },
  0x0691: { name: "loc_0691", role: "award two table-selected BCD score amounts from the packed digit byte 0x638C (loc_066a's twin: low nibble, then high nibble + 0x0A, as add-to-score payloads)", cert: "code" },
  0x06a8: { name: "loc_06a8", role: "decrement the packed two-digit BCD counter by one, latch a 'reached zero' marker when it rolls from 01 to 00, store it back, and render it", cert: "code" },
  0x06b8: { name: "drawLivesAndLevel", role: "redraw the reserve-lives indicator and the level-number digits", cert: "code" },
  0x06fe: { name: "dispatchInGameSubstate", role: "vector the credited game to its current sub-state handler", cert: "code" },
  0x073c: { name: "runAttractState", role: "service the attract game-state (GAME_STATE == 1) once per NMI", cert: "code" },
  0x0763: { name: "loc_0763", role: "on the timed sub-state advance, reset the live player context to a fresh 25m / level-1 / single-life start and (re)build the board", cert: "code" },
  0x0779: { name: "composeAttractTitleScreen", role: "build the attract title/score screen (GAME_STATE 1, sub-state 0) and hand off to the next attract step", cert: "code" },
  0x07ad: { name: "writeDigitPairWithCarry", role: "stamp two digit tiles side by side, carrying a value of 10 into a fixed tens cell", cert: "code" },
  0x07c3: { name: "clearScreenAndAdvanceSubstate", role: "wipe the screen, then step to the next sub-state of the current game state", cert: "code" },
  0x07cb: { name: "loc_07cb", role: "a timed animation sub-state step: run a per-frame screen animation while a countdown timer ticks, then advance the game sub-state", cert: "code" },
  0x084b: { name: "clearSubstateWhenTimerExpires", role: "park on a timed sub-state, then clear the sub-state index once the two-level countdown expires", cert: "code" },
  0x0852: { name: "clearTilemapAndSprites", role: "blank the ENTIRE tilemap and zero the sprite shadow buffer, a blunt full-screen wipe for a mode/phase transition", cert: "code" },
  0x0874: { name: "clearPlayfieldAndSprites", role: "blank the tilemap playfield and zero the sprite shadow buffer for board / power-on setup", cert: "code" },
  0x08b2: { name: "dispatchCreditedSubstate", role: "vector the credited game (game-state 2) to its sub-state handler", cert: "code" },
  0x08ba: { name: "enterCreditScreen", role: "accept the inserted credit and set up the credit / start-select screen, then advance to the wait-for-start sub-state", cert: "code" },
  0x08d5: { name: "readStartButtonSelector", role: "read which allowed start button is pressed on the credit screen, and once every 8 frames redraw the start prompt", cert: "code" },
  0x08f8: { name: "commitGameStart", role: "commit a credited game start: spend the credit(s), seed the player context records, wipe the screen, and advance into gameplay", cert: "code" },
  0x0965: { name: "enqueueTaskBatch", role: "post a fixed, hard-coded batch of messages onto the task ring", cert: "code" },
  0x0977: { name: "spendCredit", role: "deduct one credit and post the credit-display refresh task", cert: "code" },
  0x0986: { name: "configureFlipScreenAndSelectSubstate", role: "the first in-game NMI's start-up step: wipe the display and sound, set the flip-screen latch for the cabinet, and pick the sub-state the game runs next", cert: "code" },
  0x09ab: { name: "restorePlayer1Context", role: "restore player 1's saved context, re-derive the board, and arm the next sub-state", cert: "code" },
  0x09d6: { name: "armTwoPlayerBoardSetup", role: "the 2-player arm of the board-setup sub-state step: clear two board control latches, post two draw tasks, advance the game sub-state, then paint the shared 3-cell column", cert: "code" },
  0x09ee: { name: "draw2UpLabel", role: "stamp the three fixed video-RAM cells of player 2's '2UP' score marker", cert: "code" },
  0x09fe: { name: "restorePlayer2Context", role: "reinstate Player 2's saved game context and arm the start-of-turn wait", cert: "code" },
  0x0a1b: { name: "loc_0a1b", role: "one step of the two-player board-setup chain", cert: "code" },
  0x0a37: { name: "composeScreenAndAdvanceSubstate", role: "post this intro step's draw tasks and the '1UP' score marker, then step to the next in-game sub-state", cert: "code" },
  0x0a53: { name: "draw1UpLabel", role: "stamp the three fixed video-RAM cells of player 1's '1UP' score marker", cert: "code" },
  0x0a63: { name: "clearScreenAndSelectIntro", role: "clear the screen and route the board-start sequence into the opening intro cutscene, or skip past it", cert: "code" },
  0x0a76: { name: "dispatchIntroCutsceneStep", role: "vector the opening Kong-climb cutscene to its current step handler", cert: "code" },
  0x0a8a: { name: "setupIntroCutsceneStep", role: "step 0 of the opening Kong-climb cutscene: draw the cutscene playfield and seed its animation state", cert: "code" },
  0x0abf: { name: "runIntroClimbStep", role: "stage one climb phase of the opening Kong-climb cutscene", cert: "code" },
  0x0ae8: { name: "animateIntroClimbStep", role: "step 2 of the opening Kong-climb cutscene: animate the climb each frame and, once the climber reaches the top, hand the cutscene to its next phase", cert: "code" },
  0x0b06: { name: "loc_0b06", role: "one step of the opening Kong-climb cutscene's display-list build", cert: "code" },
  0x0b68: { name: "loc_0b68", role: "step 6 of the opening Kong-climb cutscene: scroll the sprite-object block diagonally each frame and, every time the scroll path repeats, stamp the next board band; advanc", cert: "code" },
  0x0bb3: { name: "runIntroRoarStep", role: "the roar/finish step of the opening Kong-climb cutscene", cert: "code" },
  0x0bda: { name: "buildHowHighScreen", role: "build the 'HOW HIGH CAN YOU GET?' interlude screen, then step the in-game sub-state forward", cert: "code" },
  0x0c91: { name: "buildBoardWhenTimerExpires", role: "gated board (re)build: tick the sub-state countdown and build the board only on the frame the countdown expires", cert: "code" },
  0x0c92: { name: "buildBoard", role: "build a board: wipe the playfield, arm the palette bank and the opening task, then dispatch to the per-board setup arm selected by BOARD", cert: "code" },
  0x0cc6: { name: "loc_0cc6", role: "the shared tail every board-setup dispatch arm converges on", cert: "code" },
  0x0cd4: { name: "setup25mGirderBoard", role: "the 25m (board 1) board-setup arm: select the 25m girder layout table, queue the 25m background tune, then hand off to the shared board-setup tail", cert: "code" },
  0x0cdf: { name: "setup50mConveyorBoard", role: "the 50m (board 2, conveyors) board-setup arm", cert: "code" },
  0x0cf2: { name: "setUp75mBoard", role: "the 75m (board 3, elevators) board-setup arm", cert: "code" },
  0x0d00: { name: "stampRivetBoardTiles", role: "stamp a fixed 2-tile motif into eight video-RAM cells during 100m-rivet (board 4) setup", cert: "code" },
  0x0d27: { name: "stamp75mBoardTiles", role: "during 75m (board 3, elevators) setup, stamp two fixed two-row tile motifs into the background tilemap", cert: "code" },
  0x0d30: { name: "fillTileRowPair", role: "stamp a fixed two-row tile motif into the tilemap from HL: 17 cells of 0xFD along one row, then 17 cells of 0xFC on the row directly below", cert: "code" },
  0x0d43: { name: "stampRivetBoardBands", role: "stamp the two-band tile motif into two fixed tilemap rows during 100m-rivet (board 4) setup", cert: "code" },
  0x0d4c: { name: "stampTwoTileBands", role: "stamp two 4-cell tile bands (0xFD then 0xFC) into a video-RAM row, given the row-base pointer", cert: "code" },
  0x0d5f: { name: "loc_0d5f", role: "board-setup continuation: run the common per-board init, scatter the object records, arm the setup dwell timer and advance the sub-state, stage the sprite-object block, t", cert: "code" },
  0x0da7: { name: "drawBoardLayout", role: "walk the board-layout segment table and draw each segment", cert: "code" },
  0x0dd3: { name: "loc_0dd3", role: "convert a segment record's second endpoint, compute its run deltas, and draw the segment (girder span + end caps, or ladder)", cert: "code" },
  0x0e19: { name: "drawGirderSpan", role: "fill a layout segment's body run with the girder tile 0xC0, then draw its end cap", cert: "code" },
  0x0e2a: { name: "drawSegmentEndCap", role: "stamp a layout segment's endpoint tiles, then advance the table cursor and re-enter the walk", cert: "code" },
  0x0e4f: { name: "drawLadder", role: "stamp a kind-2 ladder run DOWN the tilemap for a board-layout record", cert: "code" },
  0x0ee8: { name: "drawCappedTileColumn", role: "stamp a capped vertical tile run (top cap, body, bottom cap) down the tilemap for a kind-3 board-layout record", cert: "code" },
  0x0f1b: { name: "fillTileColumn", role: "fill a tilemap column with a kind-selected tile (board records 4/5/6)", cert: "code" },
  0x0f35: { name: "fillColumnAndContinueWalk", role: "fill a tilemap column from the current cursor, then resume the board-layout walk", cert: "code" },
  0x0f56: { name: "initBoardState", role: "reset the per-board work RAM, compute the board's bonus/timer values, seed the shared top sprites, then dispatch to the board's object setup", cert: "code" },
  0x0fd7: { name: "seed25mBoardObjects", role: "build the 25m board's initial object records and their sprite shadows from ROM templates", cert: "code" },
  0x101f: { name: "seed50mBoardObjects", role: "build the 50m board's object + hardware-sprite records", cert: "code" },
  0x1087: { name: "seed75mBoardObjects", role: "build the 75m board's object records and their hardware sprite mirror from ROM templates", cert: "code" },
  0x1131: { name: "seed100mBoardObjects", role: "build the 100m (rivet) board's sprite-object records and their hardware sprite mirror from ROM templates", cert: "code" },
  0x1186: { name: "seedObjectBlockSprites", role: "seed a 10-record object block's shared sprite field from a ROM template, then build the block's 10 hardware sprite records", cert: "code" },
  0x11a6: { name: "seedSpriteObjectPair", role: "place a pair of sprite objects at two caller-given positions and emit their hardware sprite records", cert: "code" },
  0x11d3: { name: "gatherSpriteRecords", role: "build a run of hardware sprite records by gathering four permuted fields out of each object record", cert: "code" },
  0x11ec: { name: "copyBytePairsStrided", role: "scatter B consecutive source byte-pairs into strided records", cert: "code" },
  0x11fa: { name: "loc_11fa", role: "scatter a 6-byte source record into a fixed IX record + a 4-byte array", cert: "code" },
  0x122a: { name: "replicateGroupStrided", role: "copy ONE 4-byte source group into B strided destination slots", cert: "code" },
  0x123c: { name: "seedMarioActorRecord", role: "spawn Mario's actor record at a board-dependent start, advance the sub-state, and post the follow-up task", cert: "code" },
  0x127c: { name: "loc_127c", role: "attract sub-state 4: service the effect-sprite state machine, then run the blink-animation dispatch", cert: "code" },
  0x127f: { name: "loc_127f", role: "vector a short animation sequence to its current-step handler", cert: "code" },
  0x128b: { name: "loc_128b", role: "phase-0 (seed) arm of the 0x639D animation sequence: turn the two-cell blinker on, prime the blink repeat-count, clear its sprite runs, fire a sound, then advance the pha", cert: "code" },
  0x12ac: { name: "loc_12ac", role: "phase-1 arm of the BLINK_ANIM_PHASE (0x639D) animation sequence: on each gate tick toggle the two-cell blinker, and when its repeat-count runs out advance the phase", cert: "code" },
  0x12de: { name: "loc_12de", role: "on sub-state-timer expiry, tear down the finished sub-state's sprite scratch, advance GAME_SUBSTATE, and re-arm the timer to fire immediately", cert: "code" },
  0x12f2: { name: "losePlayer1Life", role: "spend one of player 1's lives, snapshot their context, then route to the resume interlude or the game-over sequence", cert: "code" },
  0x1344: { name: "loc_1344", role: "idx-15 in-game sub-state handler: decrement the current player's lives, save the live context to player 2's slot, then branch on lives-left", cert: "code" },
  0x138f: { name: "loc_138f", role: "timed in-game sub-state transition, branched on player 2's saved context", cert: "code" },
  0x13a1: { name: "loc_13a1", role: "timer-gated 0x0702 sub-state handler (table idx 0x17)", cert: "code" },
  0x13aa: { name: "loc_13aa", role: "small in-game state reset: mirror the cabinet DIP into the flip-screen latch, clear the sub-state, and set the player-context word to 1", cert: "code" },
  0x13bb: { name: "selectPlayer1Context", role: "reset the live player/display context to player 1, single-player, sub-state 0, with the flip-screen latch forced ON", cert: "code" },
  0x13ca: { name: "loc_13ca", role: "format a packed-BCD score into display digits, then bubble a 3-byte-keyed record up a descending table", cert: "code" },
  0x141e: { name: "selectPlayerScreenOrAttract", role: "the sub-state-0x14 handler: hold the game-over screen, then bring up the active player's screen or fall back to attract", cert: "code" },
  0x144f: { name: "selectPlayer2AndComposeScreen", role: "make player 2 the current player, then compose this player's screen", cert: "code" },
  0x1459: { name: "configureFlipScreenAndComposeScreen", role: "orient the display for the player who is up, step to the next in-game sub-state, and post this screen's draw tasks", cert: "code" },
  0x1475: { name: "enterAttractMode", role: "reset the machine into attract mode", cert: "code" },
  0x1486: { name: "runBonusItemValueDisplay", role: "drive the on-board bonus item: its position walk, its animated sprite, and the countdown value shown beside it", cert: "code" },
  0x15fa: { name: "positionBonusItemSprite", role: "place the on-board bonus-item sprite at its current grid cell", cert: "code" },
  0x1615: { name: "loc_1615", role: "top dispatcher for the board-advance state, keyed on the board type", cert: "code" },
  0x1641: { name: "loc_1641", role: "run the effect-sprite state machine, then dispatch the board-render sequence step", cert: "code" },
  0x1644: { name: "loc_1644", role: "vector the board-advance render sequence to its current-step handler", cert: "code" },
  0x1654: { name: "loc_1654", role: "step 0 of the board-advance render sequence: run the intro/board spawn init, stage the first sprite-object animation frame, arm the pose-hold timer, then the shared tail", cert: "code" },
  0x1662: { name: "loc_1662", role: "bump the board-advance sequence step, then (only on the 25m board) subtract 4 from field 3 of every sprite-object record", cert: "code" },
  0x1670: { name: "loc_1670", role: "one timer-gated step of the board-advance render sequence", cert: "code" },
  0x168a: { name: "loc_168a", role: "one timer-gated step of the board-advance render sequence: re-init the sprite-object block from a ROM template, then tail into the shared advance tail", cert: "code" },
  0x16a3: { name: "loc_16a3", role: "sequence step 0: spawn init, stamp the fixed ten-record figure over the sprite-object block re-anchored to its previous X, then advance the 0x6388 step", cert: "code" },
  0x16bb: { name: "loc_16bb", role: "every frame, clear object #1's reversal flag, then route the moving sprite group to bounce/slide/hand-off by its position and travel direction", cert: "code" },
  0x16d0: { name: "loc_16d0", role: "arm object #1's countdown to expire next even frame (reverse), then slide the group", cert: "code" },
  0x16d5: { name: "loc_16d5", role: "drive sub_25f2's object #1, then slide its 10-sprite group one step along X", cert: "code" },
  0x16e1: { name: "loc_16e1", role: "once the moving sprite group reaches its rail region, either reinitialize it or bounce/slide it by its current step sign", cert: "code" },
  0x16ee: { name: "reloadObjectBlockAndAdvanceStep", role: "reload the board's sprite-object block from its ROM template, patch three record fields, and advance the board-advance step index", cert: "code" },
  0x1708: { name: "loc_1708", role: "board/intro spawn init: silence sound, seed a fixed 4-byte sprite record plus the blink-sprite code, paint a 3-cell descending colour column, then set the sound-priority ", cert: "code" },
  0x1732: { name: "loc_1732", role: "one animation-gated step of the board-advance render sequence", cert: "code" },
  0x1757: { name: "advanceBoardStepWhenSpritesCleared", role: "one arm of the board-advance sequence: sweep the sprite-object block toward the top and, once it is fully empty, arm the wait timer and step to the next arm of the sequen", cert: "code" },
  0x176c: { name: "cullSpriteObjectsAtTop", role: "clear the X of any sprite-object that has risen to the top of the screen", cert: "code" },
  0x1783: { name: "allSlotsClear", role: "is a strided table of ten object slots fully cleared?", cert: "code" },
  0x178e: { name: "advanceToNextBoard", role: "step the board-order pointer to the next board and enter the 'HOW HIGH CAN YOU GET?' interlude", cert: "code" },
  0x17b6: { name: "loc_17b6", role: "idx 0 of the 0x6388 render sequence: draw the initial how-high screen (four girder/ladder items + a sprite-object row), set the priority tune, then arm and repoint the au", cert: "code" },
  0x1826: { name: "fillTileBlock", role: "stamp a fixed 5-wide × 14-tall block of tile 0x10 into the tilemap at the caller's address", cert: "code" },
  0x1839: { name: "stepSpriteAnimationSequence", role: "advance one step of the 0x6388-driven sprite animation sequence: a throttled two-frame flap whose 256-tick sub-counter, on wrap, restamps the base figure and hands off to", cert: "code" },
  0x186f: { name: "loc_186f", role: "one timer-gated step of the board-advance render sequence: stage a sprite-object frame, pulse a sound latch, advance the step", cert: "code" },
  0x1880: { name: "loc_1880", role: "one step of the board-advance / 'how high' interlude render sequence: descend the sprite-object block, then on arrival build the next scene and advance", cert: "code" },
  0x18c6: { name: "loc_18c6", role: "per-frame pacer for the board-advance / 'how high' transition, driven by the 0x62AF down-counter", cert: "code" },
  0x196b: { name: "clearScreenAndSelectSubstate", role: "wipe the whole display, then jump the in-game sub-state index to a computed target", cert: "code" },
  0x19d2: { name: "advanceSubstateAndArmTimer", role: "step to the next in-state sub-state and hold it for 0x40 frames", cert: "code" },
  0x19da: { name: "scanObjectsAtMarioX", role: "broad-phase X test of the per-frame object-collision scan", cert: "code" },
  0x19ed: { name: "confirmObjectHit", role: "confirm an X-matched object slot is also Y-aligned and still eligible, and if so register the hit for the object-interaction state machine", cert: "code" },
  0x1a07: { name: "dispatchBonusExpiredStep", role: "run the bonus-expired state machine's current step", cert: "code" },
  0x1a15: { name: "startBonusExpiredDelay", role: "arm the DELAY phase of the bonus-expired death sequence", cert: "code" },
  0x1a1e: { name: "bonusExpiredIdle", role: "the idle (do-nothing) arm of the bonus-expired state machine", cert: "code" },
  0x1a1f: { name: "advanceBonusExpiredStepWhenDelayExpires", role: "the DELAY step of the bonus-expired sequence: hold, then advance once a countdown elapses", cert: "code" },
  0x1a2a: { name: "advanceSubstateWhenGrounded", role: "hold this sub-state until Mario has landed, then advance to the next sub-state and abort the rest of the frame", cert: "code" },
  0x1a33: { name: "collectEdgeRivet", role: "the 100m edge-rivet pickup handler: arm at a rivet edge, then on a later frame remove the rivet the player just stepped off", cert: "code" },
  0x1a4b: { name: "armEdgeRivetPickup", role: "raise the edge-item pickup latch (EDGE_RIVET_ARMED := 1)", cert: "code" },
  0x1afe: { name: "loc_1afe", role: "hammer-climb collision: look Mario's grid cell up in the object-parameter table and, on a hit, commit this frame's climb-limit pair and drive the climb", cert: "code" },
  0x1b38: { name: "climbDownWhileHeld", role: "the Down half of the ladder-climb input dispatch: drive Mario's downward climb when Down is held, otherwise hand the frame to the up-climb path", cert: "code" },
  0x1b45: { name: "climbUpWhileHeld", role: "when the player is holding UP, drive Mario's upward climb this frame", cert: "code" },
  0x1b4e: { name: "loc_1b4e", role: "commit this frame's ladder-extent limits, then drive the Up-climb", cert: "code" },
  0x1b55: { name: "tickPostLandingFreeze", role: "count down Mario's post-landing freeze; unfreeze on expiry", cert: "code" },
  0x1b6e: { name: "initMarioJump", role: "begin Mario's jump: flag him airborne and pick the horizontal launch velocity from the held direction, then commit the arc", cert: "code" },
  0x1b8a: { name: "launchMarioJump", role: "commit Mario's ballistic jump: write the airborne motion record, set the jump pose, snapshot the take-off height, fire the jump sound", cert: "code" },
  0x1c3a: { name: "loc_1c3a", role: "tick the airborne object-counter; on the tick that reaches zero settle the landing, otherwise arm the land-check phase and reset the ballistic state", cert: "code" },
  0x1c4f: { name: "settleMarioOnLanding", role: "settle Mario's state the instant he lands from a jump or fall, commit any pending item pickup, then refresh his hardware sprite record", cert: "code" },
  0x1c76: { name: "markFatalFallByHeight", role: "condemn the current fall as lethal once Mario has dropped far enough below where he took off, then refresh his sprite record", cert: "code" },
  0x1cc2: { name: "beginWalkStep", role: "start a new walk-animation step for Mario", cert: "code" },
  0x1cd2: { name: "advanceMarioWalkX", role: "advance Mario one pixel along a horizontal walk step", cert: "code" },
  0x1ceb: { name: "continueWalkStep", role: "carry an in-progress walk step one frame further", cert: "code" },
  0x1cf2: { name: "climbMarioDown", role: "per-frame driver for Mario's DOWNWARD ladder climb", cert: "code" },
  0x1d03: { name: "climbMarioUp", role: "drive Mario's upward climb one animation step per frame, paced by the move-step timer", cert: "code" },
  0x1d11: { name: "advanceClimbStep", role: "advance one climb-animation step for Mario", cert: "seen" },
  0x1d3f: { name: "setClimbSpriteFrame", role: "stamp Mario's climb-animation sprite for one climb step, then flag him on the ladder and refresh his sprite record", cert: "code" },
  0x1d49: { name: "markOnLadderAndCommitSprite", role: "flag Mario as on a ladder, then refresh his sprite record", cert: "code" },
  0x1d51: { name: "centerMarioAndCommitClimbStep", role: "the ladder-centering phase of a climb step: snap Mario onto the ladder column, tick the alternating climb footstep, then commit his sprite", cert: "code" },
  0x1d67: { name: "endClimbAtLadderLimit", role: "finish a ladder climb that has reached a ladder end", cert: "code" },
  0x1d76: { name: "loc_1d76", role: "the 'sub-step timer still running' branch of the walk/climb animation stepper; conditionally ticks the timer down", cert: "code" },
  0x1d8a: { name: "tickMoveStepTimer", role: "decrement the player's walk/climb sub-step timer", cert: "code" },
  0x1d8f: { name: "triggerWalkSound", role: "request Mario's footstep ('walk') sound for 3 frames", cert: "code" },
  0x1d95: { name: "loc_1d95", role: "commit A into the 0x6225 collection flag, then (off 25m) queue a 3-frame priority sound", cert: "code" },
  0x1da6: { name: "writeMarioSpriteRecord", role: "refresh Mario's 4-byte hardware sprite record from his live position/sprite state", cert: "code" },
  0x1dbd: { name: "loc_1dbd", role: "the router for the effect-sprite state machine held in EFFECT_STATE (0x6340)", cert: "code" },
  0x1dc9: { name: "loc_1dc9", role: "sub_1dbd's state-1 handler: arm the state-2 countdown, advance the state 1 -> 2, then dispatch to the effect-sprite setter selected by EFFECT_SELECT's (0x6342) low bits (", cert: "code" },
  0x1df5: { name: "loc_1df5", role: "pick one of three effect-sprite setters from two bits of RANDOM", cert: "code" },
  0x1e00: { name: "loc_1e00", role: "load this effect-sprite's (code, task-message) params and hand off to the shared continuation loc_1e15", cert: "code" },
  0x1e08: { name: "loc_1e08", role: "stage this effect's (sprite-code, deferred-task) constants, then run the shared effect handler", cert: "code" },
  0x1e10: { name: "loc_1e10", role: "effect-sprite setter: load (B, DE) then hand off to the feeder loc_1e15", cert: "code" },
  0x1e15: { name: "loc_1e15", role: "post the queued task, fetch the effect sprite's X/Y from an indirect parameter block, then hand off to the record-stamp tail", cert: "code" },
  0x1e28: { name: "awardScorePopup", role: "award points and stage the floating score glyph over Mario", cert: "code" },
  0x1e36: { name: "loc_1e36", role: "stamp a 4-byte sprite record, then cue a board-gated sound", cert: "code" },
  0x1e49: { name: "loc_1e49", role: "the idle (do-nothing) arm of sub_1dbd's EFFECT_STATE (0x6340) router", cert: "code" },
  0x1e4a: { name: "tickDispatcherCountdown", role: "tick sub_1dbd's state-2 hold timer; reset the dispatcher on expiry", cert: "code" },
  0x1e57: { name: "checkBoardWonByType", role: "Mario's per-frame board-won position check: decide whether the current board has been won, dispatched by board type, and hand off to the arm that completes it", cert: "code" },
  0x1e6d: { name: "loc_1e6d", role: "stamp Mario's sprite facing on the board-won path, then commit the board-advance and unwind out of the movement cascade", cert: "code" },
  0x1e7a: { name: "loc_1e7a", role: "the girder-board rescue-row test inside Mario's per-frame position check (sub_1e57)", cert: "code" },
  0x1e80: { name: "completeRivetBoardWhenCleared", role: "on a rivet (100m) board, complete the board the frame its last rivet is gone", cert: "code" },
  0x1e85: { name: "enterBoardAdvanceAndUnwind", role: "commit 'this board is complete': set the board-advance sub-state, then unwind out of the movement cascade", cert: "code" },
  0x1e94: { name: "loc_1e94", role: "unconditional caller-skip: make the call return past its caller", cert: "code" },
  0x1ea0: { name: "buildEffectSprite", role: "effect-sequence step 0: spawn the hit effect sprite from the collided object's record, then arm the effect countdown and its priority sound", cert: "code" },
  0x1f09: { name: "loc_1f09", role: "effect-sequence step 1: a two-stage rate divider that flips a sprite-shadow bit on most beats and hands the sequence to its next step on every fourth", cert: "seen" },
  0x1f23: { name: "loc_1f23", role: "effect-sequence step 2: a two-stage rate divider that steps the effect sprite's tile on most beats and, when it runs out, resets the sequence and re-arms the parent effec", cert: "seen" },
  0x1f46: { name: "beginMarioFall", role: "when the 'ground went away' trigger is armed, drop Mario into a fresh falling state and remember the height he fell from", cert: "code" },
  0x216d: { name: "loc_216d", role: "grade an object against difficulty/position/input and, on a pass, advance its record", cert: "code" },
  0x21ee: { name: "advanceAttractDemoInput", role: "advance the canned-input script that drives the attract-mode demo", cert: "seen" },
  0x2207: { name: "loc_2207", role: "the 50m board-object state-machine dispatcher: gate on the 50m board, pick one of two object records by frame parity, and run the arm for its state", cert: "code" },
  0x2227: { name: "loc_2227", role: "one arm of the sub_2207 board-object state machine: tick this object's dwell timer, advance its state when the timer elapses, and stamp a shared flag when Mario has reach", cert: "code" },
  0x2243: { name: "marioReachedTargetColumn", role: "has Mario reached the target position? a three-condition hit test", cert: "code" },
  0x2257: { name: "loc_2257", role: "the 'no hit' tail of the sub_2243 hit test: abort the caller as well and unwind two levels, back to the grandparent", cert: "code" },
  0x2259: { name: "loc_2259", role: "one arm of the sub_2207 board-object state machine: tick this object's timer, step its position counter UP and mirror it on-screen, advance its state at the top of travel", cert: "code" },
  0x2284: { name: "stepMarioDownInClimbPose", role: "step Mario down one pixel, held in the climb-down pose", cert: "code" },
  0x2299: { name: "loc_2299", role: "advance a board object to its next state, on a randomised pacing gate", cert: "code" },
  0x22a2: { name: "loc_22a2", role: "one idle-then-descend tick for a BOARD_OBJ_SCRATCH object, resetting it to state 0 when it reaches the bottom of its travel", cert: "code" },
  0x22bd: { name: "loc_22bd", role: "mirror the byte at a source pointer into one of two sprite slots, selected by bit 3 of the pointer", cert: "code" },
  0x22cb: { name: "loc_22cb", role: "seed one object's velocity fields, choosing the source by mode and difficulty", cert: "seen" },
  0x22e1: { name: "loc_22e1", role: "pick an object's velocity magnitude by level, then commit it", cert: "code" },
  0x22f6: { name: "loc_22f6", role: "set an object's velocity from the RNG", cert: "code" },
  0x22f9: { name: "loc_22f9", role: "commit a value and its low-bit-derived sign into two object-record fields", cert: "code" },
  0x2303: { name: "loc_2303", role: "seed one object's step magnitude and its toward-player step direction (the difficulty-3/4 arm of object-velocity init)", cert: "code" },
  0x231a: { name: "loc_231a", role: "seed one object's toward-player step code and step delta from the horizontal offset to the player (the difficulty-5 arm of object-velocity init)", cert: "code" },
  0x2333: { name: "snapYToGirder", role: "nudge a coordinate one pixel along the 25m girder slope", cert: "code" },
  0x236e: { name: "loc_236e", role: "find a key in the object-parameter table and return its paired slot", cert: "code" },
  0x239c: { name: "stepBallisticMotion", role: "advance an airborne actor one frame along its ballistic arc", cert: "code" },
  0x23de: { name: "loc_23de", role: "refresh a moving object's two sprite-orientation bits from a packed direction lookup, on a per-object countdown", cert: "code" },
  0x2407: { name: "loc_2407", role: "spread a packed nibble-pair into a fixed-point value, then subtract a 16-bit operand; returns the difference", cert: "code" },
  0x241f: { name: "loc_241f", role: "horizontal position gate: classify Mario's X into a two-flag (D,E) verdict the movement code uses to clamp X and gate walk direction", cert: "code" },
  0x2441: { name: "loadBoardObjectRecords", role: "scatter this board's ROM object-init records into two parallel work-RAM attribute arrays", cert: "code" },
  0x24ea: { name: "update50mMovingObjects", role: "the 50m moving-object subsystem tick", cert: "code" },
  0x2523: { name: "service50mObjectSpawnRequest", role: "service the 50m moving-object spawn request, paced by a cooldown timer", cert: "code" },
  0x2591: { name: "advance50mObjectRow", role: "advance and edge-cull the 50m moving-object row", cert: "seen" },
  0x25f2: { name: "update50mConveyorObjects", role: "the 50m board's per-frame object update: gate on the 50m board, then run the three conveyor-object step drivers and carry Mario along his conveyor row", cert: "code" },
  0x2602: { name: "loc_2602", role: "per-frame driver for the first of sub_25f2's three timed sprite objects", cert: "code" },
  0x262f: { name: "loc_262f", role: "per-frame driver for the SECOND of sub_25f2's three timed sprite objects", cert: "code" },
  0x264c: { name: "loc_264c", role: "publish object-2's ±1 step in both polarities and, every 32nd frame, advance its mirrored sprite pair", cert: "code" },
  0x266f: { name: "loc_266f", role: "ensure object-2's step-direction latch is negative-going, then run the shared publish/animate tail", cert: "code" },
  0x2679: { name: "loc_2679", role: "on a timer, reverse object-3's step direction; then run the shared tail", cert: "code" },
  0x268d: { name: "loc_268d", role: "publish object-3's step and, every 32nd frame, advance its sprite pair", cert: "code" },
  0x26a6: { name: "loc_26a6", role: "step a mirrored pair of animation counters one frame, opposite ways", cert: "code" },
  0x26de: { name: "reverseStepDirection", role: "flip the sign of a signed direction-step byte at (HL)", cert: "code" },
  0x26e9: { name: "signStepHalfRate", role: "collapse a direction byte to a ±1 step, every other frame", cert: "code" },
  0x26fa: { name: "loc_26fa", role: "per-pass service dispatcher for one board's moving objects", cert: "code" },
  0x271e: { name: "loc_271e", role: "thin wrapper: run the vertical-reposition machine, then return", cert: "code" },
  0x2722: { name: "serviceBoardObjects", role: "service the six board objects for one pass, then publish their positions to the sprite buffer", cert: "code" },
  0x2745: { name: "loc_2745", role: "the vertical-reposition machine: gate on the reposition flag, then dispatch by Mario's X into the mover arms or the edge reset", cert: "code" },
  0x2766: { name: "loc_2766", role: "start Mario falling and clear the edge-reposition flag", cert: "code" },
  0x276f: { name: "loc_276f", role: "step Mario's Y toward the top of its travel, or edge-reset once it arrives", cert: "code" },
  0x277f: { name: "loc_277f", role: "the edge reset reached when the vertical mover runs off its track", cert: "code" },
  0x2787: { name: "loc_2787", role: "advance Mario's vertical position by one, or hand off to the edge reset once it reaches the bottom limit", cert: "code" },
  0x2797: { name: "loc_2797", role: "advance the six board objects in the 0x6600 array: each active object drifts one pixel vertically toward its limit, then lands or deactivates on arrival", cert: "code" },
  0x27da: { name: "spawnBoardObject", role: "on the spawn cadence, claim a free object slot and seed a new board object; always tick the cadence timer down", cert: "code" },
  0x2806: { name: "decrementByteAt", role: "decrement the byte at the given address by one", cert: "code" },
  0x2808: { name: "killMarioOnObjectCollision", role: "kill Mario when a board object overlaps his hitbox", cert: "code" },
  0x281d: { name: "loc_281d", role: "test the active special-object record against the board's hazards and, on an overlap, record where it was found", cert: "code" },
  0x2853: { name: "searchPlayerObjectOverlap", role: "run the current board's object-overlap search for the player and hand its severity code back to the caller", cert: "code" },
  0x286f: { name: "dispatchBoardCollision", role: "vector a collision test to the current board's handler", cert: "code" },
  0x2880: { name: "loc_2880", role: "board-overlap search arm: sweep three object arrays (0x6700x10, 0x6400x5, 0x66A0x1) through the shared collision search, stopping at the first hit", cert: "code" },
  0x28b0: { name: "loc_28b0", role: "board-overlap search arm: three collision sweeps (0x6400x5, 0x65A0x6, 0x66A0x1) through the shared search, stopping at the first hit", cert: "code" },
  0x28e0: { name: "loc_28e0", role: "board-3 (75m) overlap search arm: two collision sweeps (0x6400x5, then 0x65A0x10 only if the first misses) with a sweep-1 short-circuit", cert: "code" },
  0x2901: { name: "loc_2901", role: "run one bounding-box collision sweep over the 0x6400 object array", cert: "code" },
  0x2913: { name: "findCollidingObject", role: "scan an object list for the first record whose bounding box overlaps a reference point on both axes; stop and report a hit, or report the list exhausted", cert: "code" },
  0x2974: { name: "loc_2974", role: "test whether Mario overlaps either of the two objects in the 0x6680 pair, and report which one", cert: "code" },
  0x298c: { name: "loc_298c", role: "is the background tile just ahead of the current object outside the accepted tile band?", cert: "code" },
  0x2a22: { name: "loc_2a22", role: "constant-binding shim: run the collision search over OBJ_ARRAY_66 (0x6600, 6 records) -- does Mario overlap any object there", cert: "code" },
  0x2a2f: { name: "loc_2a2f", role: "probe the tile a moving object is standing on and, if it sits on a sloped girder, slide the object's X along the slope and report the contact", cert: "code" },
  0x2a85: { name: "loc_2a85", role: "while Mario is in plain grounded contact, look at the tile under his foot and, if the girder there is not level, defer to the slope-footing fall check", cert: "code" },
  0x2ab4: { name: "decideSlopeGirderFooting", role: "decide whether Mario keeps his footing on an angled girder or the ground has run out and he starts to fall", cert: "code" },
  0x2acd: { name: "triggerMarioFall", role: "request that Mario begin falling because the ground under him went away", cert: "code" },
  0x2ad3: { name: "carryMarioOnConveyorRow", role: "carry Mario along whichever 50m conveyor (moving-platform) row he is standing on", cert: "code" },
  0x2af6: { name: "selectConveyorStepAndMoveMario", role: "pick the drift step for this platform row by Mario's X, then move him", cert: "code" },
  0x2b02: { name: "moveMarioX", role: "advance Mario's X by the current velocity, then hold it inside the horizontal limits", cert: "code" },
  0x2b51: { name: "loc_2b51", role: "a reject exit of the player-vs-tilemap probe cascade; forces the two-level caller-skip so control unwinds past entry_2b1c", cert: "code" },
  0x2b53: { name: "loc_2b53", role: "the non-25m arm of the player-vs-tilemap descent probe", cert: "code" },
  0x2b74: { name: "loc_2b74", role: "the reject arm of the tile-probe cascade: hand back a zeroed result and unwind out of the probe and its caller", cert: "code" },
  0x2b7a: { name: "loc_2b7a", role: "pick the tile-probe's horizontal X-snap arm on the airborne X-velocity, then snap Mario's X to its 8-pixel column and commit it", cert: "code" },
  0x2b8b: { name: "loc_2b8b", role: "snap the probe's candidate X to its 8-pixel column, then commit it as Mario's position", cert: "code" },
  0x2b91: { name: "loc_2b91", role: "commit Mario's adjusted X to both the game position and his sprite record", cert: "code" },
  0x2b9b: { name: "probeTileForLanding", role: "the tile gate at the head of the airborne-descent collision probe", cert: "code" },
  0x2be1: { name: "resolveAirborneTileLanding", role: "resolve whether Mario's airborne descent has reached a tile surface; on a hit, snap him onto it and abort the collision probe", cert: "code" },
  0x2c03: { name: "loc_2c03", role: "board-1 (25m) periodic bonus-event scheduler: decide, this pass, whether to dispatch into the bonus-event slot-claim cluster and by which route", cert: "code" },
  0x2c41: { name: "loc_2c41", role: "head of the bonus-event slot-claim cluster: stir the random seed, then route to one of two slot-claim mode entries on the seed's low nibble", cert: "code" },
  0x2c49: { name: "loc_2c49", role: "one entry of the bonus-event slot-claim cluster (0x2C41): stash mode byte 1, then hand off to the shared slot-claim entry with the caller's bonus value", cert: "code" },
  0x2c4b: { name: "loc_2c4b", role: "one entry of the bonus-event slot-claim cluster (0x2C41): record the caller's mode byte, then hand off to the shared slot-claim body with that byte bumped by one", cert: "code" },
  0x2c4f: { name: "loc_2c4f", role: "one entry of the bonus-event slot-claim cluster (0x2C41): stash the caller's mode byte, then, when the bonus counter has reached its scheduled mark, step the mark and cla", cert: "code" },
  0x2c72: { name: "loc_2c72", role: "set the top bit of engine-scratch byte 0x6382, preserving the low bits", cert: "code" },
  0x2c7b: { name: "loc_2c7b", role: "pick a bonus-event slot-claim cluster entry by testing the caller's stepped value against the bonus", cert: "code" },
  0x2c86: { name: "loc_2c86", role: "one entry of the bonus-event slot-claim cluster (0x2C41): clear the slot-claim request flag, then hand off to the shared slot-claim entry with mode byte 3", cert: "code" },
  0x2cf6: { name: "loc_2cf6", role: "preset a renderer object record's sprite-code/attr/mode (default or alt triple, selected by bit 7 of 0x6382), then fall through into the frame-gated renderer loc_2d15", cert: "code" },
  0x2d15: { name: "loc_2d15", role: "the frame-gated step of the intro string/sprite renderer", cert: "code" },
  0x2d51: { name: "loc_2d51", role: "reload the render string cursor from RAM, then render the next character", cert: "code" },
  0x2d54: { name: "loc_2d54", role: "the string renderer's per-character body: emit one 4-byte sprite record for the next character of the string, or hand off to the terminator", cert: "code" },
  0x2d83: { name: "loc_2d83", role: "aim the string renderer at the fixed source string at 0x39CC and emit its first character", cert: "code" },
  0x2d8c: { name: "loc_2d8c", role: "the string renderer's 0x7F terminator: reinitialise the object record it was building and reload the ten-record sprite-object block", cert: "code" },
  0x2ddb: { name: "loc_2ddb", role: "raise two periodic event requests, on 50m/100m, while Mario is alive", cert: "code" },
  0x2e04: { name: "loc_2e04", role: "the actor-object scan loop: on 75m, while Mario is alive, update all ten records of the actor object array", cert: "code" },
  0x2e12: { name: "loc_2e12", role: "per-object update entry: dispatch one object by its active flag and state, otherwise walk it one animation-string step", cert: "code" },
  0x2e4b: { name: "loc_2e4b", role: "object update convergence: store the animation-string pointer back into the object record and, at the walk's end boundary, hand the object to its next state", cert: "code" },
  0x2e6c: { name: "mirrorObjectPositionToSprite", role: "mirror the current object's position into its paired sprite record, then advance the per-object scan", cert: "code" },
  0x2e78: { name: "advanceToNextObject", role: "step the per-object scan on to the next object's records", cert: "code" },
  0x2e84: { name: "loc_2e84", role: "object update state 4: advance the object's Y by 3, deactivating it once it passes the travel limit, then mirror its position to its sprite", cert: "code" },
  0x2e9c: { name: "loc_2e9c", role: "animation-string terminator handler: rewind the walk pointer to the string base and fire the wrap sound, then hand off to the object-update convergence point", cert: "code" },
  0x2ea7: { name: "spawnObjectIntoInactiveSlot", role: "inactive object slot: consume a pending spawn request and bring the slot to life, otherwise just step the scan on", cert: "code" },
  0x2ed4: { name: "driveHammerSprite", role: "per-frame hammer sprite / background-tune dispatcher", cert: "code" },
  0x2f43: { name: "updateActiveHammer", role: "advance the active hammer's duration counter one tick and lay down this frame's hammer sprite; when the counter passes its ~512-frame limit, end the hammer", cert: "seen" },
  0x2f7c: { name: "commitSpriteRecordAtMarioOffset", role: "commit an object's on-screen sprite record, positioned at a fixed offset from Mario, and mirror that position back into the object record", cert: "code" },
  0x2f97: { name: "buildPendingHammerSprite", role: "one build arm of the hammer/object sprite updater: when a hammer is pending, stamp the object's state and appearance, then commit its sprite record", cert: "code" },
  0x2fb7: { name: "selectHammerSpriteBlinkByTimer", role: "pick which object-sprite build path lays down this frame's record, based on how far the hammer's duration counter has run", cert: "code" },
  0x2fbe: { name: "blinkHammerSpriteOnFramePhase", role: "choose the object sprite's attribute for this frame's blink phase, then commit the record", cert: "code" },
  0x2fcb: { name: "tickTimedBoardBonus", role: "pace the bonus countdown on the timed boards (50m / 75m / 100m)", cert: "code" },
  0x2ff0: { name: "tileAddrForPixel", role: "map a screen pixel (y,x) to its tilemap cell address", cert: "code" },
  0x3009: { name: "loc_3009", role: "bit-field lookup over a packed 4x2-bit table, keyed by an input byte and a 2-bit selector", cert: "code" },
  0x304a: { name: "scrollClimbGraphicStep", role: "advance the opening-cutscene climb graphic up one row by one indexed cell-pair, then step the scroll index down", cert: "code" },
  0x3064: { name: "copyByteDisplaced", role: "copy one byte from an indexed cell to a displaced cell", cert: "code" },
  0x3069: { name: "loc_3069", role: "gated indirect step-advance: tick SUBSTATE_TIMER, and on the expiry frame increment the render-sequence step the SEQ_ADVANCE_PTR word points at", cert: "code" },
  0x306f: { name: "animateSpriteObjectBlock", role: "advance one animation frame of the ten-record sprite-object block, once every eight calls", cert: "code" },
  0x3096: { name: "xorMaskStridedPair", role: "XOR the 8-bit mask C into two bytes at HL, stride DE", cert: "code" },
  0x309f: { name: "enqueueTask", role: "post a 2-byte [opcode, argument] message onto the task ring", cert: "code" },
  0x30bd: { name: "clearSpriteColumns", role: "zero the X byte of four fixed groups of sprite records", cert: "code" },
  0x30db: { name: "loc_30db", role: "zero the X byte of Mario's sprite record, then a stride-4 run of six more sprite-shadow records", cert: "code" },
  0x30e4: { name: "clearStridedBytes", role: "zero B bytes at stride 4, walking the LOW address byte only", cert: "code" },
  0x3110: { name: "loc_3110", role: "frame-phase caller-skip guard: proceed on the odd frames (one of every two)", cert: "code" },
  0x311b: { name: "loc_311b", role: "frame-phase caller-skip guard: proceed on 5 of every 8 frames", cert: "code" },
  0x3126: { name: "loc_3126", role: "caller-skip frame-throttle: proceed on three of every four frames", cert: "code" },
  0x3131: { name: "loc_3131", role: "let the caller proceed on seven of every eight frames; skip it on the eighth", cert: "code" },
  0x313c: { name: "loc_313c", role: "per-object slot scan: tally live records into 0x63A1, flag each live record's +8 field, service one pending object-insert request, then return a caller-skip boolean (splice on zero count)", cert: "code" },
  0x31dd: { name: "loc_31dd", role: "arm a field on two objects when the board is hard enough and a rare entropy draw comes up", cert: "code" },
  0x31f6: { name: "loc_31f6", role: "pick a byte from the two timing-entropy cells: the low two bits of the random accumulator, or the frame counter in the single case those bits are 1", cert: "code" },
  0x32bd: { name: "loc_32bd", role: "a three-way object-walker dispatch keyed on the current board", cert: "code" },
  0x32d6: { name: "loc_32d6", role: "an object's interval down-counter with position-gated reload, then a periodic-timer tick", cert: "code" },
  0x330f: { name: "loc_330f", role: "tick one object's periodic timer; on expiry reload it and, on a random beat, advance the object's state", cert: "code" },
  0x33c3: { name: "loc_33c3", role: "on 25m only, advance one object-record coordinate by a single girder step", cert: "code" },
  0x33e7: { name: "loc_33e7", role: "advance an object's sprite animation, then nudge its step counter up or down according to the object's state", cert: "code" },
  0x3409: { name: "stepObjectSpriteFrame", role: "advance an object's animation sprite tile on a period-2 timer, flipping a bit at every sixteenth step", cert: "seen" },
  0x342c: { name: "loc_342c", role: "start or resume one object's scripted position walk, advance its X one step, then hand to the shared table-walk tail", cert: "code" },
  0x3445: { name: "loc_3445", role: "advance one object's table-driven position walk, or finalize it at the end of the table", cert: "code" },
  0x3478: { name: "loc_3478", role: "start-or-continue one object's table-driven position walk, marching the object's X in a chosen direction and deferring the per-frame Y to the shared tail", cert: "code" },
  0x34b9: { name: "loc_34b9", role: "seed an object record's paired position fields from one of two ROM template tables (skipped on board 3)", cert: "code" },
  0x34f3: { name: "loc_34f3", role: "gather five object records into five 4-byte sprite records", cert: "code" },
  0x3e70: { name: "loc_3e70", role: "pick one of three effect-sprite parameter pairs from the low bits of A, then hand off to the Mario-anchored record-stamp tail loc_1e28", cert: "code" },
  0x3e88: { name: "dispatchBoardOverlapSearch", role: "vector to the current board's collision-search arm, handing it the caller's bounds word across the dispatch", cert: "code" },
  0x3ec3: { name: "countObjectOverlaps", role: "count how many objects in an array overlap a probe point, within a per-object rectangular window", cert: "code" },
  0x3f24: { name: "stampFixedTilePair", role: "paint a fixed two-tile decoration into the tilemap", cert: "code" },
  0x3fa0: { name: "loc_3fa0", role: "board-setup prelude: stamp the 50m-only tiles, then run the board-setup continuation", cert: "code" },
  0x3fa6: { name: "stamp50mBoardTiles", role: "during board setup, stamp four tilemap cells, but only on the 50m conveyor board (board 2)", cert: "code" },
  0x3fc0: { name: "pinMarioClimbPose", role: "pin a fixed climb pose into Mario's hardware sprite record and hand back a pointer to that record's Y field", cert: "code" },
};

// ── Stack scratch ────────────────────────────────────────────────────────────
// Dead stack region, excluded from the memory-equivalence compare (a mistimed vblank NMI
// pushes a PC here that is overwritten before it is read). Bounds from SP low-water-mark.
export const STACK_SCRATCH = { lo: 0x6be0, hi: 0x6c00 };
