// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders idiomatic-layer name registry. The frozen oracle in ../translated/ is the source of
// truth; this gives the idiomatic layer symbols for work-RAM cells + the ROUTINES map dispatched over
// the translated fallback (resolveAllIdiomatic). Tags: [seen] MAME-confirmed, [code] read from the
// translated behaviour, [guess] role unknown. loc_ cells are placeholders (understand half renames).

// Return-stack scratch (SP inits 0x2400, grows down; measured deepest 0x23e0). Excluded from the diff.
export const STACK_SCRATCH = { lo: 0x23e0, hi: 0x2400 };

export const TIMER_RELOAD = 0x0600;  // [seen]
export const loc_1b25 = 0x1b25;
export const ALIEN_SPRITE_TABLE = 0x1c00;  // [seen]
export const ALIEN_SHOT_BLOWUP_SPRITE = 0x1cdc;  // [seen]
export const SAUCER_SCORE_KEY_TABLE = 0x1d4c;  // [seen]
export const SAUCER_SCORE_SPRITE_TABLE = 0x1d50;  // [seen]
export const loc_1da0 = 0x1da0;
export const loc_2004 = 0x2004;
export const loc_2005 = 0x2005;
export const ALIEN_DRAW_INDEX = 0x2006;  // [seen]
export const FLEET_STEP_DY = 0x2007;  // [seen]
export const loc_2009 = 0x2009;
export const loc_200a = 0x200a;
export const FLEET_DROP_DELTA = 0x200e;  // [seen]
export const loc_2026 = 0x2026;
export const loc_2029 = 0x2029;
export const loc_202a = 0x202a;
export const loc_202b = 0x202b;
export const loc_202c = 0x202c;
export const loc_2048 = 0x2048;
export const ACTIVE_PLAYER_PAGE = 0x2067;  // [seen]
export const DRAW_PHASE_FLAG = 0x2072;  // [seen]
export const ALIEN_SHOT_BLOWUP_TIMER = 0x2078;  // [seen]
export const loc_207b = 0x207b;
export const loc_207c = 0x207c;
export const ALIEN_SHOT_ROW_COUNT = 0x207d;  // [seen]
export const loc_207e = 0x207e;
export const ALIEN_COUNT = 0x2082;  // [seen]
export const loc_2083 = 0x2083;
export const SAUCER_SCORE_KEY_PTR = 0x208d;  // [seen]
export const SAUCER_TIMER = 0x2091;  // [seen]
export const SOUND_PORT3_SHADOW = 0x2094;  // [seen]
export const SOUND_PORT5_SHADOW = 0x2098;  // [seen]
export const TASK_FLAGS = 0x20c1;  // [seen]
export const loc_20e5 = 0x20e5;
export const loc_20e7 = 0x20e7;
export const GAME_ACTIVE = 0x20e9;  // [seen]
export const CREDIT_COUNT = 0x20eb;  // [seen]
export const HIGH_SCORE_OBJ_DESC = 0x20f4;  // [seen]
export const PLAYER1_OBJ_DESC = 0x20f8;  // [seen]
export const PLAYER2_OBJ_DESC = 0x20fc;  // [seen]
export const VIDEO_RAM_BASE = 0x2400;  // [seen]
export const PLAYFIELD_VRAM_BASE = 0x2402;  // [seen]
export const FLEET_LEFT_EDGE_VRAM = 0x2524;  // [seen]
export const CREDIT_COUNT_SCREEN_ADDR = 0x3c01;  // [seen]
export const FLEET_RIGHT_EDGE_VRAM = 0x3ea4;  // [seen]
export const VIDEO_RAM_END = 0x4000;  // [seen]
export const DRAW_BLOCK_STRIDE = 0x02e0;  // [seen]
export const FLEET_RATE_THRESHOLDS = 0x1a11;  // [seen]
export const FLEET_RATE_TABLE = 0x1a21;  // [seen]
export const ALIEN_SHOT_RATE_TABLE = 0x1aa1;  // [seen]
export const WORKRAM_INIT_IMAGE = 0x1b00;  // [seen]
export const loc_1b83 = 0x1b83;
export const ALIEN_SHOT_RATE_THRESHOLDS = 0x1cb8;  // [seen]
export const loc_1d20 = 0x1d20;
export const loc_1e00 = 0x1e00;
export const ALIEN_DRAW_PENDING = 0x2000;  // [seen]
export const PLAYER_SHOT_HIT = 0x2002;  // [seen]
export const loc_2008 = 0x2008;
export const ALIEN_DRAW_ADDR = 0x200b;  // [seen]
export const FLEET_MOVE_DIR = 0x200d;  // [seen]
export const GAME_OBJECT_TABLE = 0x2010;  // [seen]
export const loc_2011 = 0x2011;
export const loc_2015 = 0x2015;
export const loc_201b = 0x201b;
export const loc_201d = 0x201d;
export const PLAYER_SHOT_STATUS = 0x2025;  // [seen]
export const PLAYER_SHOT_DESC = 0x2027;  // [seen]
export const FIRE_BUTTON_LATCH = 0x202d;  // [seen]
export const loc_2062 = 0x2062;
export const loc_2068 = 0x2068;
export const loc_2069 = 0x2069;
export const LAST_ALIEN_FLAG = 0x206b;  // [seen]
export const loc_2070 = 0x2070;
export const loc_2071 = 0x2071;
export const loc_2073 = 0x2073;
export const loc_2074 = 0x2074;
export const loc_2075 = 0x2075;
export const loc_2076 = 0x2076;
export const loc_207f = 0x207f;
export const SHIELD_SAVE_RESTORE_MODE = 0x2081;  // [seen]
export const loc_2087 = 0x2087;
export const FLEET_SOUND_STEP = 0x2095;  // [seen]
export const FLEET_SOUND_TIMER = 0x2096;  // [seen]
export const FLEET_SOUND_PERIOD = 0x2097;  // [seen]
export const SFX_OFF_TIMER = 0x2099;  // [seen]
export const FLEET_SOUND_OFF_TIMER = 0x209b;  // [seen]
export const loc_20c2 = 0x20c2;
export const loc_20cf = 0x20cf;
export const ATTRACT_DEMO_PTR = 0x20ed;  // [seen]
export const GAME_IN_PROGRESS = 0x20ef;  // [seen]
export const SCORE_ADD_PENDING = 0x20f1;  // [seen]
export const SCORE_ADD_VALUE = 0x20f2;  // [seen]
export const SCORE_ADD_VALUE_HI = 0x20f3;  // [seen]
export const ALIEN_FIELD_P1 = 0x2100;  // [seen]
export const ALIEN_FIELD_P2 = 0x2200;  // [seen]
export const SHIELD_VRAM_BASE = 0x2806;  // [seen]

export const COLLISION_FLAG = 0x2061;  // [seen]
export const SAUCER_ACTIVE = 0x2084;  // [seen]
export const SAUCER_HIT = 0x2085;  // [seen]
export const TWO_PLAYER_GAME = 0x20ce;  // [seen]
export const PLAYER1_SHIELD_BUFFER = 0x2142;  // [seen]
export const PLAYER2_SHIELD_BUFFER = 0x2242;  // [seen]
export const loc_391c = 0x391c;
export const TAITO_COPYRIGHT_TEXT = 0x0bf7;  // [seen]
export const SCORE_HEADER_TEXT = 0x1ae4;  // [seen]
export const RESERVE_SHIP_SPRITE = 0x1c60;  // [seen]
export const SAUCER_HIT_SPRITE = 0x1d7c;  // [seen]
export const CREDIT_LABEL_TEXT = 0x1fa9;  // [seen]
export const ALIEN_EXPLOSION_TIMER = 0x2003;  // [seen]
export const INPUT_CODE_STAGE_FLAG = 0x201e;  // [seen]
export const ALIEN_EXPLOSION_ADDR = 0x2064;  // [seen]
export const ALIEN_SHOT_SPRITE_PTR = 0x2079;  // [seen]
export const ANIM_COORD_STEP_LO = 0x20c3;  // [seen]
export const ANIM_SPRITE_COORD = 0x20c5;  // [seen]
export const ANIM_SPRITE_SRC = 0x20c7;  // [seen]
export const ANIM_END_COORD = 0x20ca;  // [seen]
export const ANIM_DONE_FLAG = 0x20cb;  // [seen]
export const ANIM_BASE_SPRITE_SRC = 0x20cc;  // [seen]
export const loc_21fb = 0x21fb;
export const loc_22fb = 0x22fb;
export const SCORE_HEADER_SCREEN_ADDR = 0x241e;  // [seen]
export const LIVES_DIGIT_SCREEN_ADDR = 0x2501;  // [seen]
export const RESERVE_SHIP_ICONS_SCREEN_ADDR = 0x2701;  // [seen]
export const TAITO_COPYRIGHT_SCREEN_ADDR = 0x2e1b;  // [seen]
export const CREDIT_LABEL_SCREEN_ADDR = 0x3501;  // [seen]

// ── §4 clock-free spine cells (see names-debt.txt) ────────────────────────────────────────────────
export const FRAME_DELAY_TIMER = 0x20c0;      // [seen] vblank-decremented busy-wait counter (loc_0010 `dcr m`)
export const ATTRACT_ANIM_ACK = 0x2055;       // [code] ISR anim-step handshake bit0 (runHandshakedAttractAnim set/clear spin)
export const TYPE_PACE_COUNT = 0x206c;        // [seen] per-record type-pace byte (typeDrawScriptRecord/drawScoreAdvanceTable)
export const SCREEN_MODE_TOGGLE = 0x20ec;     // [seen] attract-screen alternator, flipped 0/1 each finishAttractCycle pass
export const loc_2050 = 0x2050;               // anim descriptor scratch (runHandshakedAttractAnim blockCopy dst)
export const loc_2080 = 0x2080;               // runHandshakedAttractAnim seeds =2 (role ungrounded)
export const loc_21ff = 0x21ff;               // starting-ships latch (runAttractCycle)

// ── vblank/mid ISR bodies (idiomaticVblankNmi / idiomaticMidNmi) cells + frozen seam-fallback entries ──
export const COIN_INPUT_LATCH = 0x20ea;       // [seen] coin-switch edge latch: armed while IN1 b0 idle, banks one CREDIT_COUNT on the press edge (loc_0010)
export const CREDIT_SCREEN_SHOWN = 0x2093;    // [seen] attract credit-screen-shown latch (0 = not yet shown)
export const TILT_RESET_ACTIVE = 0x209a;      // [seen] tilt/panic reset-in-progress guard (set while the warm restart runs, cleared at its end)
export const loc_1cbc = 0x1cbc;               // tilt banner sprite-id source (typed by the tilt reset)
export const loc_3016 = 0x3016;               // tilt banner screen destination
export const OBJECT_TABLE_MID = 0x2020;       // [seen] mid-screen object/timer record-table base (loc_008c passes to the walker; vblank uses GAME_OBJECT_TABLE 0x2010)
export const OBJECT_DISPATCH_VBLANK = 0x0248; // [seen] vblank object-dispatch base-seat (walkVblankObjectTable)
export const OBJECT_WALKER = 0x024b;          // [seen] 16-byte object/timer record walker (walkObjectTable)
// Former direct-JS ISR-body seam entries -- all now lifted to idiomatic modules; kept as address names:
export const TILT_HANDLER = 0x17cd;           // per-frame tilt/panic check
export const MID_DRAW_SCAN = 0x0141;          // mid-screen draw scan
export const ATTRACT_CREDIT_SCREEN = 0x0765;  // [seen] credit-inserted/press-start screen
export const ATTRACT_TASK_DISPATCH = 0x0abf;  // attract task-flag dispatch sub-arm (loc_0010 0x0057 call)
// ROM/screen address literals passed as draw/script args by the spine (placeholders, see names-debt.txt):
export const loc_3017 = 0x3017;
export const loc_1cfa = 0x1cfa;
export const loc_1daf = 0x1daf;
export const loc_1dab = 0x1dab;
export const loc_2b14 = 0x2b14;
export const loc_1a95 = 0x1a95;
export const loc_1bb0 = 0x1bb0;
export const loc_1fc9 = 0x1fc9;
export const loc_33b7 = 0x33b7;
export const loc_2810 = 0x2810;
export const loc_1ca3 = 0x1ca3;
export const loc_1dbe = 0x1dbe;
export const loc_1dcf = 0x1dcf;
export const loc_1bc0 = 0x1bc0;
export const loc_3311 = 0x3311;
export const loc_2c11 = 0x2c11;
export const loc_1f90 = 0x1f90;
export const loc_1f9c = 0x1f9c;
export const loc_1fa0 = 0x1fa0;
export const loc_1fd5 = 0x1fd5;

// ── credit-inserted screen + game-start init (creditScreen / startOnePlayerGame / startTwoPlayerGame / startGameFlow) ──────
// ROM sprite-list sources and video-RAM destinations for the credit prompt and the one/two-player start
// prompts, plus the per-player object-record cells seeded once when a game starts.
export const loc_1ff3 = 0x1ff3;               // credit-screen top prompt sprite-id source
export const loc_3013 = 0x3013;               // credit-screen top prompt screen destination
export const loc_1acf = 0x1acf;               // one-player start prompt sprite-id source
export const loc_1aba = 0x1aba;               // two-player start prompt sprite-id source
export const loc_21fc = 0x21fc;               // player-1 object-record coordinate word (seeded at game start)
export const loc_21fe = 0x21fe;               // player-1 object-record byte cleared at game start
export const loc_22fc = 0x22fc;               // player-2 object-record coordinate word (seeded at game start)
export const loc_22fe = 0x22fe;               // player-2 object-record byte cleared at game start
export const loc_22ff = 0x22ff;               // player-2 starting-ships latch (player-1 mirror loc_21ff)

// ── object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ──
// The object table 0x2010.. holds five 16-byte records; each record's descriptor sub-fields and the
// per-record blit template in ROM 0x1b.. are named here as placeholders (understand half renames).
// The five object-record handler ROM entry points the walker (walkObjectTable) computed-dispatches to: each
// record carries a fixed handler target at rec+3/rec+4 that the walker reads and calls directly.
export const PLAYER_SHIP_HANDLER_ADDR = 0x028e;       // [seen] record-0 player-ship handler (playerShipHandler): moves the ship X by input (loc_201b), runs the ship's death/explosion animation, and on drain during play consumes a life + arms the next main-loop flow
export const PLAYER_SHOT_HANDLER_ADDR = 0x03bb;       // [seen] record-1 player-shot handler (playerShotHandler)
export const ALIEN_SHOT_SLOT2_HANDLER_ADDR = 0x0476;  // [seen] record-2 alien-shot handler (alienShotSlot2Handler): countdown-gated, no column-cursor (specific alien-shot type pending §5 grounding)
export const ALIEN_SHOT_SLOT3_HANDLER_ADDR = 0x04b6;  // [seen] record-3 alien-shot handler (alienShotSlot3Handler): column-cursor managed, clamps at 16, self-disables at the last alien (specific alien-shot type pending §5 grounding)
export const SAUCER_HANDLER_ADDR = 0x0682;            // [seen] record-4 mystery-ship/saucer handler (saucerHandler): delegates to alienShotSlot4Handler (a further alien-shot stepper) in the non-saucer sub-path
export const loc_1b30 = 0x1b30;
export const loc_1b32 = 0x1b32;
export const loc_1b40 = 0x1b40;
export const loc_1b48 = 0x1b48;
export const loc_1b50 = 0x1b50;
export const loc_1b58 = 0x1b58;
export const loc_2030 = 0x2030;
export const loc_2032 = 0x2032;
export const loc_2035 = 0x2035;
export const loc_2036 = 0x2036;
export const loc_2038 = 0x2038;
export const loc_2040 = 0x2040;
export const loc_2045 = 0x2045;
export const loc_2046 = 0x2046;
export const loc_2056 = 0x2056;
export const loc_2058 = 0x2058;
export const loc_206e = 0x206e;
export const loc_2086 = 0x2086;
export const loc_208a = 0x208a;
export const loc_208c = 0x208c;
export const loc_208f = 0x208f;
// record-0 player-ship handler cells (playerShipHandler) -- its death/explosion animation cells + ROM record template and animation sprite base:
export const loc_2012 = 0x2012;               // record-0 draw-pending flag, cleared after each redraw
export const loc_2018 = 0x2018;               // record-0 current animation sprite descriptor (5 bytes)
export const loc_201a = 0x201a;               // record-0 animation coordinate word (low of the descriptor)
export const loc_206a = 0x206a;               // record-0 animation cursor countdown
export const loc_206d = 0x206d;               // record-0 warm-restart suppress flag
export const loc_1b10 = 0x1b10;               // ROM template restored into record 0 on animation expiry
export const loc_1c70 = 0x1c70;               // record-0 two-frame animation sprite base

// ── in-game main-loop + round-restart cluster cells (see names-debt.txt) ──────────────────────────
// Screen (video-RAM) destinations and per-record source tables read by the round-start splash, the
// next-round handoff, and the game-over / new-round flows.
export const loc_1b70 = 0x1b70;               // round-start sprite-id source strip
export const loc_2b11 = 0x2b11;               // round-start sprite-list screen destination
export const loc_3711 = 0x3711;               // round-start extra-sprite screen destination
export const loc_271c = 0x271c;               // round-start strip-clear screen base (player-1 select)
export const loc_1aa6 = 0x1aa6;               // typed game-over / new-round text source
export const loc_2803 = 0x2803;               // two-player game-over text screen destination
export const loc_3a03 = 0x3a03;               // two-player game-over player-number glyph screen slot
export const loc_2d18 = 0x2d18;               // game-over field-clear text screen destination
export const loc_1da2 = 0x1da2;               // player-index-to-field-page lookup table
export const ROUTINES = {
  // ── §4 clock-free spine: boot chain, attract cycle, and the vblank busy-wait delays ──────────────
  0x0000: { name: "resetEntry", role: "[seen] reset vector: jumps to boot init (bootInit), which enters the attract loop", cert: "seen" },
  0x18d4: { name: "bootInit", role: "[seen] boot init: seed work RAM (initWorkRam) and the score panel (redrawScorePanel), then enter the attract loop at enterAttractCycle", cert: "seen" },
  0x18df: { name: "enterAttractCycle", role: "[seen] attract-cycle join: set loc_20cf=8 then continue into runAttractCycle; reached from boot init and the finishAttractCycle loop-back", cert: "seen" },
  0x0aea: { name: "runAttractCycle", role: "[seen] attract round setup + free-run demo loop: silence sound, ei, type the attract screens, seed the field, then per-frame advanceRoundState (advances ATTRACT_DEMO_PTR 0x20ed) until loc_2015 leaves 0xff; falls into finishAttractCycle", cert: "seen" },
  0x0b89: { name: "finishAttractCycle", role: "[seen] attract round teardown: credit/high-score panel + typed script + ISR-handshaked reveal (runHandshakedAttractAnim), flip SCREEN_MODE_TOGGLE 0x20ec, tail-jmp enterAttractCycle", cert: "seen" },
  0x0ad7: { name: "waitFrames", role: "[seen] vblank busy-wait: seed FRAME_DELAY_TIMER 0x20c0 = a and wait until the vblank ISR drains it to 0", cert: "seen" },
  0x0ab1: { name: "waitShortDelay", role: "[seen] 0x40-frame attract delay -> waitFrames", cert: "seen" },
  0x0ab6: { name: "waitLongDelay", role: "[seen] 0x80-frame attract delay -> waitFrames", cert: "seen" },
  0x0acf: { name: "typeAttractBlock", role: "[seen] type the 0x0f-byte block to loc_2b14 using the caller's source de -> typePacedSpriteRun", cert: "seen" },
  0x0a93: { name: "typePacedSpriteRun", role: "[seen] type c sprite bytes from de onto hl, pacing 7 vblank frames per byte on FRAME_DELAY_TIMER", cert: "seen" },
  0x0a80: { name: "runAttractAnimTask", role: "[seen] arm ISR anim task (TASK_FLAGS 0x20c1=2) and wait until ANIM_DONE_FLAG 0x20cb is raised, then clear the task", cert: "seen" },
  0x1815: { name: "drawScoreAdvanceTable", role: "[seen] draw the attract score-advance table: header string + loc_1dbe column script (no delay), then tail typeSecondDrawScript (typed loc_1dcf script)", cert: "seen" },
  0x1837: { name: "typeSecondDrawScript", role: "[seen] point at the loc_1dcf script and fall into typeDrawScript", cert: "seen" },
  0x183a: { name: "typeDrawScript", role: "[seen] walk a draw script (fetchNextDrawRecord + typeDrawScriptRecord per record) until the 0xff terminator", cert: "seen" },
  0x184c: { name: "typeDrawScriptRecord", role: "[seen] type one script record: c = TYPE_PACE_COUNT 0x206c, de/hl from the fetched record -> typePacedSpriteRun", cert: "seen" },
  0x189e: { name: "runHandshakedAttractAnim", role: "[seen] ISR-handshaked attract animation: arm TASK_FLAGS 0x20c1=4, spin ATTRACT_ANIM_ACK 0x2055 bit0 set-then-clear, draw, tail waitLongDelay (the ISR anim it arms drives object handler 0x050e)", cert: "seen" },
  0x00b1: { name: "loadReferenceAlienState", role: "load the active player's saved field record: mirror the reference-alien coord word to loc_2009/ALIEN_DRAW_ADDR, derive the count at loc_2008, set FLEET_MOVE_DIR on the 0xfe edge sentinel", cert: "seen" },
  0x0100: { name: "drawPendingAlien", role: "draw the pending marching alien: bail to tickAlienExplosionDespawn when PLAYER_SHOT_HIT is set; else if the alien at (ACTIVE_PLAYER_PAGE:ALIEN_DRAW_INDEX) is live, build its sprite from ALIEN_SPRITE_TABLE (id bit0-cleared, rotate-left-3; +0x30 alternate frame via selectAlternateSpriteFrame when loc_2005 is set) and blitShiftedSprite 16 rows at ALIEN_DRAW_ADDR; clears ALIEN_DRAW_PENDING on every non-bail path", cert: "seen" },
  0x01c0: { name: "markAllAliensAliveP1", role: "seat the player-1 alien-status base ALIEN_FIELD_P1 then markAllAliensAlive (fill 0x37 cells with 0x01)", cert: "seen" },
  0x01cf: { name: "drawBottomLine", role: "draw the full-width bottom ground line via fillScreenRow(0x01, 0xe0, PLAYFIELD_VRAM_BASE); live-out HL", cert: "seen" },
  0x01e6: { name: "initWorkRam", role: "boot-init: blockCopy the caller's B bytes from ROM image WORKRAM_INIT_IMAGE into the base of work RAM", cert: "seen" },
  0x01f8: { name: "initShieldBuffers", role: "replicate the 0x2c-byte shield template loc_1d20 into four consecutive shield buffers from HL; live-out HL", cert: "seen" },
  0x021e: { name: "drawOrSaveShields", role: "shield save/restore: store SHIELD_SAVE_RESTORE_MODE, then four 22x2 blocks from SHIELD_VRAM_BASE (stride DRAW_BLOCK_STRIDE) -- captureScreenRect when set, orBlitBitmap when clear", cert: "seen" },
  0x0430: { name: "loadPlayerShotDescriptor", role: "load the player-shot 5-byte descriptor at PLAYER_SHOT_DESC via loadSpriteDescriptor; HL := its screen address", cert: "seen" },
  0x050f: { name: "alienShotSlot4Handler", role: "[seen] object step handler called by the saucer handler saucerHandler: prime the record's strip (copyRecordToWorkBuffer), stage the two per-column rate cells, step the alien shot (stepAlienShot), clamp the firing column at 21, then either restore the strip or blit the record template and stow the column", cert: "seen" },
  0x0550: { name: "copyRecordToWorkBuffer", role: "stash A -> loc_207f, then blockCopy 0x0b bytes (DE)->work buffer loc_2073 (prime an object strip)", cert: "seen" },
  0x055b: { name: "copyWorkBufferToRecord", role: "blockCopy 0x0b bytes work buffer loc_2073 ->(HL) (restore the object strip; twin of copyRecordToWorkBuffer)", cert: "seen" },
  0x0563: { name: "stepAlienShot", role: "alien-shot handler -- step the active alien shot (draw-phase gate, blowup animation, descend one step, redraw with collision, retire across the shield/ground bands) or, when idle, spawn a new one from a firing column (task-flag/rate-timer gated, column picked via the cursor list or a Y-scale)", cert: "seen" },
  0x062f: { name: "findLiveAlienInColumn", role: "scan five object slots (stride 0x0b) on ACTIVE_PLAYER_PAGE from low byte C-1; live-outs: carry set on the first non-empty slot (else the final pointer add's carry), C decremented once, and L (the found slot's low byte, which the caller feeds to alienIndexToScreenCoords)", cert: "seen" },
  0x0644: { name: "stepAlienShotBlowup", role: "step the alien-shot blowup: decrement ALIEN_SHOT_BLOWUP_TIMER; at 3 eraseAlienShot then re-seat ALIEN_SHOT_SPRITE_PTR=ALIEN_SHOT_BLOWUP_SPRITE and recenter the descriptor (loc_207b/loc_207c -= 2, ALIEN_SHOT_ROW_COUNT=6) and drawAlienShotWithCollision (tail); at 0 just eraseAlienShot (tail); else idle", cert: "seen" },
  0x0707: { name: "stopSaucerSound", role: "clear the saucer sound bit: SOUND_PORT3_SHADOW &= 0xfe via clearSoundPort3Bit, mirror to sound port 3; value-out A", cert: "seen" },
  0x070c: { name: "awardSaucerScore", role: "award the mystery-saucer score: raise SCORE_ADD_PENDING, read the key via SAUCER_SCORE_KEY_PTR, match it in SAUCER_SCORE_KEY_TABLE, copy the parallel SAUCER_SCORE_SPRITE_TABLE entry into the saucer sprite record loc_2087, store key*16 to SCORE_ADD_VALUE, resolveSpriteScreenAddr then drawThreeSprites (tail); live-out HL/DE/C", cert: "seen" },
  0x0742: { name: "resolveSpriteScreenAddr", role: "load the sprite descriptor at loc_2087 then coordToScreenAddr; HL := screen address, DE := gfx pointer", cert: "seen" },
  0x075f: { name: "copyTemplateToRecord", role: "blockCopy B bytes from ROM template loc_1b83 into the caller's object record (HL)", cert: "seen" },
  0x0878: { name: "stageActivePlayerFieldSave", role: "stage the active player's field save: B := [loc_2008], DE := [loc_2009] word, HL := activeFieldRecordPointer", cert: "code" },
  0x08ff: { name: "drawSprite8x8", role: "resolve sprite id A to its 8-byte source at loc_1e00+8*A, latch A to port 6, blit an 8x8 sprite via drawSpriteColumn; live-out HL", cert: "seen" },
  0x092e: { name: "readActivePlayerPageTopByte", role: "read the byte at the top of the active player's page ((mem[ACTIVE_PLAYER_PAGE]<<8)|0xff); live-out HL, A", cert: "seen" },
  0x0935: { name: "awardExtraShip", role: "award the next reserve ship once the active player's tally passes the port-2-selected threshold: bump the stored ship count, redraw the reserve-ship column (RESERVE_SHIP_SPRITE) and lives digit, clear the award flag, seat SFX_OFF_TIMER=0xff, and cue the extra-ship sound (tail startSound 0x10)", cert: "seen" },
  0x0988: { name: "applyPendingScoreAdd", role: "when SCORE_ADD_PENDING is set, clear it and BCD-add the two-byte SCORE_ADD_VALUE into the active player's record accumulator (base from currentPlayerRecordPtr, 8080 DAA decimal carry), then redraw the total as four BCD glyphs at the record's screen address (tail drawBcdWord); a clear flag is a no-op", cert: "seen" },
  0x09ad: { name: "drawBcdWord", role: "draw the 16-bit value in DE as four BCD digit glyphs -- high byte D then low byte E -- via drawBcdByte; live-out HL (advanced two glyph-pairs), DE preserved", cert: "seen" },
  0x0a59: { name: "isArmTriggerSet", role: "poll [loc_2015] against 0xff and report equality in the Z flag; reads no register, writes no memory", cert: "seen" },
  0x0a5f: { name: "queueInvaderKillScore", role: "if [GAME_IN_PROGRESS]!=0: startSound(0x08), index the 3-entry table via invaderScoreEntryPtr(B), stamp SCORE_ADD_VALUE=table byte / SCORE_ADD_PENDING=0x01 /", cert: "seen" },
  0x0ae2: { name: "loadDrawSequenceBlock", role: "blockCopy the 12-byte draw/animation sequence from (DE) into loc_20c2", cert: "seen" },
  0x0bf1: { name: "updateFleetAndDrawCopyright", role: "pre-round redraw trampoline: run resolveShotAndFleetEdge (fleet edge/direction update) then tail into drawTaitoCopyright", cert: "seen" },
  0x1474: { name: "seatBlitPosition", role: "OUT port 2 := L&7 (MB14241 shift offset), then HL := coordToScreenAddr(HL) -- seat the next blit", cert: "seen" },
  0x14cb: { name: "clearScreenStrip", role: "zero A then fillScreenRow(0) -- blank a run of B screen columns from HL; live-out HL", cert: "seen" },
  0x14d8: { name: "resolvePlayerShotHit", role: "resolve a player-shot collision (dispatched while PLAYER_SHOT_STATUS==2): ret unless a hit is latched (PLAYER_SHOT_HIT, which playerShotHandler copies from COLLISION_FLAG); then by the shot Y at loc_2029 either stand down into state 3 + clearShotHitAndSilence (missed off the top), mark the saucer hit + retire the shot (markSaucerHitAndRetireShot, saucer altitude band), or scale the coords to a 55-cell alien-rack index (alienGridCellPtr) and on a live cell kill the alien + queue the invader-die sound/explosion (queueInvaderKillScore), enter state 5, blit, and arm the explosion despawn timer ALIEN_EXPLOSION_TIMER", cert: "seen" },
  0x154a: { name: "clearShotHitAndSilence", role: "clear PLAYER_SHOT_HIT, then clearSoundPort3Bit(0xf7) masks bit 3 off SOUND_PORT3_SHADOW; value-out A", cert: "seen" },
  0x1554: { name: "countStepsToThreshold", role: "count in C the 0x10 steps that lift A to/above threshold H (pre-normalizing a negative A via normalizeUpBySteps); live-out A, C, carry clear", cert: "seen" },
  0x1597: { name: "reverseFleetAtEdge", role: "fleet edge / direction reversal: scan the edge column selected by FLEET_MOVE_DIR (fleetReachedEdge); on a hit flip the direction and republish loc_2008 (step count, via fleetStepSize) and FLEET_STEP_DY (mirrored from FLEET_DROP_DELTA), else leave state unchanged; RAM-only live-out", cert: "seen" },
  0x15c5: { name: "fleetReachedEdge", role: "scan 0x17 (23) bytes upward from HL for the first nonzero (fleet edge reached); carry live-out set=found (inlines the loc_166b set-carry) / clear=all-zero (trailing ana a), read by reverseFleetAtEdge via rnc; returns the found boolean", cert: "seen" },
  0x15f3: { name: "countLiveAliens", role: "count live cells across the active player's 0x37-byte alien field into ALIEN_COUNT; set LAST_ALIEN_FLAG at exactly one survivor", cert: "seen" },
  0x1618: { name: "advanceRoundState", role: "gated pre-round step: when armed (loc_2015==0xff) and the field is idle, advance ATTRACT_DEMO_PTR (attract) or arm the shot on a fresh fire edge (play, GAME_IN_PROGRESS set)", cert: "seen" },
  0x166b: { name: "loc_166b", role: "the fleetReachedEdge scan's 'found' sentinel (stc; ret): set carry and return true; inline candidate -- fleetReachedEdge already folds this set-carry directly", cert: "seen" },
  0x170e: { name: "selectAlienShotRate", role: "select the alien-shot rate: scan ALIEN_SHOT_RATE_THRESHOLDS for the first entry >= the field-size key, store the parallel ALIEN_SHOT_RATE_TABLE byte to loc_20cf (read by the shot stepper stepAlienShot)", cert: "seen" },
  0x172c: { name: "updatePlayerShotSound", role: "mode-gated sound step: PLAYER_SHOT_STATUS!=0 -> startSound(0x02), else clearSoundPort3Bit(0xfd)", cert: "seen" },
  0x1740: { name: "stepFleetMarchSound", role: "fleet-march sound beat: tick FLEET_SOUND_OFF_TIMER/FLEET_SOUND_TIMER, on beat emit SOUND_PORT5_SHADOW and re-arm, silencing at the edges; set FLEET_SOUND_STEP", cert: "seen" },
  0x1775: { name: "advanceFleetMarchSound", role: "on FLEET_SOUND_STEP, pick the fleet tempo for ALIEN_COUNT from FLEET_RATE_THRESHOLDS/FLEET_RATE_TABLE into FLEET_SOUND_PERIOD and rotate the port-5 fleet tone; tick SFX_OFF_TIMER", cert: "seen" },
  0x1844: { name: "drawSpriteColumn16", role: "draw a fixed 16-row sprite column (row count forced to 0x10) via drawSpriteColumn, preserving BC; live-out HL", cert: "seen" },
  0x1904: { name: "markAllAliensAliveP2", role: "seat the player-2 alien-status base ALIEN_FIELD_P2 then markAllAliensAlive (0x37-byte 0x01 fill)", cert: "seen" },
  0x190a: { name: "resolveShotAndFleetEdge", role: "run the state-2 handler resolvePlayerShotHit, then tail into the fleet edge/direction update reverseFleetAtEdge; RAM-only, callers ignore the result", cert: "seen" },
  0x1925: { name: "drawPlayer1Score", role: "seat the player-1 score record pointer PLAYER1_OBJ_DESC, then drawScoreRecord (tail) -- draw the P1 BCD total as four glyphs at the record's screen address; RAM-only live-out", cert: "seen" },
  0x192b: { name: "drawPlayer2Score", role: "seat the player-2 score record pointer PLAYER2_OBJ_DESC, then drawScoreRecord (tail) -- draw the P2 BCD total; RAM-only live-out", cert: "seen" },
  0x1931: { name: "drawScoreRecord", role: "shared score-record draw: unpack a four-byte record at HL (a BCD value word then its two-byte screen address) and draw the value as four BCD glyphs there (tail drawBcdWord); reached for P1 (0x20f8), P2 (0x20fc) and the high score (0x20f4)", cert: "seen" },
  0x1947: { name: "drawCreditCount", role: "draw the BCD credit tally CREDIT_COUNT as two decimal glyphs at CREDIT_COUNT_SCREEN_ADDR via drawBcdByte; live-out HL", cert: "seen" },
  0x1950: { name: "drawHighScore", role: "seat the high-score record pointer HIGH_SCORE_OBJ_DESC, then drawScoreRecord (tail) -- draw the high-score BCD total; also called by loc_1671 to repaint after a new high; RAM-only live-out", cert: "seen" },
  0x1956: { name: "redrawScorePanel", role: "boot/attract score-panel repaint: clearScreen, then redraw the score header (drawScoreHeader), player-1/2 scores (drawPlayer1Score/drawPlayer2Score), the high score (drawHighScore), the CREDIT label (drawCreditLabel), and the credit tally (drawCreditCount); RAM-only live-out", cert: "seen" },
  0x1979: { name: "drawCreditReadout", role: "boot/attract credit readout: clearGameActive, then repaint the credit panel -- drawCreditCount (the BCD credit tally) then drawCreditLabel (the CREDIT label, tail)", cert: "seen" },
  0x1988: { name: "loc_1988", role: "clear the play-field framebuffer", cert: "seen" },
  0x19d1: { name: "setGameActive", role: "store 1 -> GAME_ACTIVE (shared tail storeGameActive); mark the game active", cert: "seen" },
  0x19d7: { name: "clearGameActive", role: "store 0 -> GAME_ACTIVE (shared tail storeGameActive); clear the game-active flag", cert: "seen" },
  0x1982: { name: "storeTaskFlags", role: "store A -> TASK_FLAGS", cert: "seen" },
  0x013b: { name: "selectAlternateSpriteFrame", role: "bump sprite pointer to 2nd bank (DE += 0x30)", cert: "seen" },
  0x017a: { name: "alienIndexToScreenCoords", role: "resolve L over 0x0b into (L,C,D) using the B,C pair at loc_2009/loc_200a", cert: "seen" },
  0x01c3: { name: "markAllAliensAlive", role: "HL-relative fill of 0x37 bytes with 0x01", cert: "seen" },
  0x01d9: { name: "advanceRecordTotals", role: "record accumulate: [HL+2]+=C, [HL+3]+=[HL+1]; return 2nd total in A", cert: "seen" },
  0x067e: { name: "loc_067e", role: "store HL (16-bit) -> loc_2048", cert: "seen" },
  0x0886: { name: "activeFieldRecordPointer", role: "build HL = (ACTIVE_PLAYER_PAGE << 8) | 0xfc", cert: "seen" },
  0x08d1: { name: "readStartingShips", role: "A = (port2 & 3) + 3", cert: "seen" },
  0x08d8: { name: "setAlienShotStepWhenFew", role: "if ALIEN_COUNT < 9: loc_207e = 0xfb", cert: "seen" },
  0x0913: { name: "tickSaucerSpawnTimer", role: "gate on loc_2009<0x78, decrement 16-bit timer SAUCER_TIMER, reload 0x0600 + set flag loc_2083 on wrap", cert: "seen" },
  0x097c: { name: "invaderScoreEntryPtr", role: "HL = loc_1da0 + clamp-index of A (offset 0 if A<2, 1 if 2<=A<4, 2 if A>=4)", cert: "seen" },
  0x09ca: { name: "currentPlayerRecordPtr", role: "HL = bit0 of ACTIVE_PLAYER_PAGE ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC (active player's data pointer)", cert: "seen" },
  0x09d6: { name: "clearPlayfield", role: "clear the play-field framebuffer", cert: "seen" },
  0x1439: { name: "drawSpriteColumn", role: "copy B bytes into B adjacent screen columns (stride 0x20 right per byte); live-out HL = HL + 0x20*B", cert: "seen" },
  0x147c: { name: "captureScreenRect", role: "block-copy a B-column x C-byte screen rectangle into a byte stream; live-out DE, HL", cert: "seen" },
  0x14cc: { name: "fillScreenRow", role: "fill B columns with A stepping 0x20 right from HL (a horizontal band); leave HL one stride past", cert: "seen" },
  0x1581: { name: "alienGridCellPtr", role: "compute record pointer HL from index B, offset C, and the record-page cell", cert: "seen" },
  0x1590: { name: "normalizeUpBySteps", role: "normalize A up in 0x10 steps until non-negative, counting the steps in C", cert: "seen" },
  0x1611: { name: "activePlayerPageBase", role: "HL := page byte (mem[ACTIVE_PLAYER_PAGE]) << 8", cert: "seen" },
  0x176d: { name: "silenceFleetMarchNote", role: "OUT 5 := mem[SOUND_PORT5_SHADOW] & 0x30 (sound-off helper)", cert: "seen" },
  0x1770: { name: "latchSoundPort5", role: "mask A to the two sound-select bits, OUT sound port 5", cert: "seen" },
  0x17c0: { name: "readActivePlayerInput", role: "read the player-selected input port into A", cert: "seen" },
  0x18e7: { name: "otherPlayerFlagPtr", role: "HL := 0x20e7 + bit0 of (0x2067)", cert: "seen" },
  0x18f1: { name: "fleetStepSize", role: "B := 2, or 3 when (0x2082) == 1", cert: "seen" },
  0x18fa: { name: "startSound", role: "(0x2094) |= B, mirror to sound port, A := result", cert: "seen" },
  0x1910: { name: "activePlayerFlagPtr", role: "HL := loc_20e7 + (bit0 of ACTIVE_PLAYER_PAGE clear ? 1 : 0)", cert: "seen" },
  0x19d3: { name: "storeGameActive", role: "store A -> GAME_ACTIVE (shared tail)", cert: "seen" },
  0x19dc: { name: "clearSoundPort3Bit", role: "SOUND_PORT3_SHADOW &= B, mirror to sound port 3, A := result", cert: "seen" },
  0x1a06: { name: "objectMatchesDrawPhase", role: "raster draw-phase predicate: carry := (mem[DE] & 0x80) === mem[DRAW_PHASE_FLAG] -- true when the object's phase bit (bit7 of its byte) matches the current raster half (DRAW_PHASE_FLAG is 0x80 in the vblank half, 0x00 in the mid-screen half); the three object dispatchers rnc-skip an object that does not belong to this half-frame", cert: "seen" },
  0x1a32: { name: "blockCopy", role: "block-copy B bytes (DE)->(HL), both advancing", cert: "seen" },
  0x1a3b: { name: "loadSpriteDescriptor", role: "read 5-byte descriptor at (HL) -> DE/A/C/B, then HL=C:A", cert: "seen" },
  0x1a47: { name: "coordToScreenAddr", role: "HL := (HL >> 3) with H forced into the 0x2000-0x3fff video-RAM page", cert: "seen" },
  0x1a5c: { name: "clearScreen", role: "zero video RAM 0x2400..0x3fff", cert: "seen" },
  0x1a69: { name: "orBlitBitmap", role: "OR-merge C source bytes down each of B columns (columns 0x20 apart); advance HL and DE", cert: "seen" },
  0x01e4: { name: "seedWorkRamImage", role: "preset the copy count to 0xc0, then initWorkRam blockCopies the ROM template WORKRAM_INIT_IMAGE into the work-RAM base; memory-only", cert: "seen" },
  0x01ef: { name: "initPlayer1ShieldBuffers", role: "seat the player-1 shield buffer base PLAYER1_SHIELD_BUFFER, then initShieldBuffers replicates the shield template into four slots; live-out HL", cert: "seen" },
  0x01f5: { name: "initPlayer2ShieldBuffers", role: "seat the player-2 shield buffer base PLAYER2_SHIELD_BUFFER, then initShieldBuffers replicates the shield template into four slots; live-out HL", cert: "seen" },
  0x0214: { name: "saveOrRestorePlayer2Shields", role: "seat DE=PLAYER2_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores the four player-2 shield blocks per the caller's mode; memory-only", cert: "seen" },
  0x021b: { name: "saveOrRestorePlayer1Shields", role: "seat DE=PLAYER1_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores the four player-1 shield blocks per the caller's mode; memory-only", cert: "seen" },
  0x073c: { name: "drawSaucerSprite", role: "resolve the sprite descriptor at loc_2087 to its screen address + gfx pointer (resolveSpriteScreenAddr), then blit the sprite column into video RAM (drawSpriteColumn); live-out HL", cert: "seen" },
  0x08e4: { name: "blankScreenStrip", role: "return early when TWO_PLAYER_GAME is set, else clearScreenStrip blanks a 0x20-column VRAM strip at loc_391c", cert: "seen" },
  0x08f3: { name: "drawSpriteList", role: "draw C consecutive sprite ids from (DE) as a run of 8x8 sprites via drawSprite8x8; live-out HL", cert: "seen" },
  0x09c5: { name: "drawDigit", role: "map a 0-9 value to its glyph id (A += 0x1a) and draw it via drawSprite8x8", cert: "seen" },
  0x1400: { name: "orBlitShiftedSprite", role: "seat the pixel-shift offset, then OR-blit a hardware-shifted B-row sprite into (HL)/(HL+1); live-out HL, DE", cert: "seen" },
  0x1424: { name: "clearSpriteColumn", role: "seat the shift offset, then zero the 2-byte-wide x B-row sprite footprint at HL; live-out HL", cert: "seen" },
  0x1452: { name: "eraseShiftedSprite", role: "erase a hardware-shifted sprite by AND-ing its complemented bits out of the screen over B rows; live-out HL", cert: "seen" },
  0x1491: { name: "drawSpriteWithCollision", role: "OR-blit a hardware-shifted sprite while testing overlap, setting COLLISION_FLAG on any hit; live-out HL, DE", cert: "seen" },
  0x1545: { name: "retirePlayerShot", role: "set PLAYER_SHOT_STATUS to 4 (retiring), then clearShotHitAndSilence (clear PLAYER_SHOT_HIT and silence its sound)", cert: "seen" },
  0x1562: { name: "scaleXToBlock", role: "scale the X coordinate to a grid block index in B via countStepsToThreshold (threshold loc_2009), residual in L", cert: "seen" },
  0x156f: { name: "scaleYToBlock", role: "scale the Y coordinate to a grid block index in C via countStepsToThreshold (threshold loc_200a), residual in H", cert: "seen" },
  0x15d3: { name: "blitShiftedSprite", role: "seat the shift offset, then overwrite-blit a hardware-shifted B-row sprite into (HL)/(HL+1); live-out HL (base), DE", cert: "seen" },
  0x1804: { name: "updateSaucerSound", role: "per-frame saucer sound gate: SAUCER_ACTIVE==0 -> stopSaucerSound, else drive the UFO tone", cert: "seen" },
  0x1856: { name: "fetchNextDrawRecord", role: "fetch the next 4-byte draw record addressed by BC (A=(BC), advance BC); live-out A, BC", cert: "seen" },
  0x19fa: { name: "clearScreenRegion", role: "repeatedly clearScreenStrip to blank a wider screen region", cert: "seen" },
  0x00d7: { name: "loc_00d7", role: "seed the mirrored per-player cells loc_21fb/loc_22fb with 0x02, then blank the fixed 0x20-column screen strip via blankScreenStrip (guarded by TWO_PLAYER_GAME, which rnz-early-outs when nonzero); live-out HL", cert: "seen" },
  0x0209: { name: "savePlayer1Shields", role: "force save mode (A=1), then saveOrRestorePlayer1Shields captures the four player-1 shields into PLAYER1_SHIELD_BUFFER; memory-only", cert: "seen" },
  0x020e: { name: "savePlayer2Shields", role: "force save mode (A=1), then saveOrRestorePlayer2Shields captures the four player-2 shields into PLAYER2_SHIELD_BUFFER; memory-only", cert: "seen" },
  0x0213: { name: "restorePlayer2Shields", role: "force restore mode (A=0), then saveOrRestorePlayer2Shields OR-blits the player-2 shields back from PLAYER2_SHIELD_BUFFER; memory-only", cert: "seen" },
  0x021a: { name: "restorePlayer1Shields", role: "force restore mode (A=0), then saveOrRestorePlayer1Shields OR-blits the player-1 shields back from PLAYER1_SHIELD_BUFFER; memory-only", cert: "seen" },
  0x066c: { name: "drawAlienShotWithCollision", role: "seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR, loadSpriteDescriptor, then drawSpriteWithCollision; live-out HL/DE/A + COLLISION_FLAG", cert: "seen" },
  0x0675: { name: "eraseAlienShot", role: "seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR, loadSpriteDescriptor, then eraseShiftedSprite (AND the sprite's bits out of the screen)", cert: "seen" },
  0x074b: { name: "playSaucerHitSoundAndDrawSprite", role: "on saucer destruction: OR the port-5 UFO-hit sound bit and latchSoundPort5, repoint the saucer sprite record at SAUCER_HIT_SPRITE, then draw it", cert: "seen" },
  0x08f1: { name: "drawThreeSprites", role: "seat count C=3, then drawSpriteList blits three consecutive 8x8 sprites from (DE)", cert: "seen" },
  0x09b2: { name: "drawBcdByte", role: "draw the byte in A as two digit glyphs, high nibble then low, via drawDigit (BCD: each nibble is 0-9)", cert: "seen" },
  0x1538: { name: "tickAlienExplosionDespawn", role: "decrement the despawn countdown ALIEN_EXPLOSION_TIMER; while nonzero return; on expiry reload the sprite address from ALIEN_EXPLOSION_ADDR, clearSpriteColumn, then retirePlayerShot", cert: "seen" },
  0x1579: { name: "markSaucerHitAndRetireShot", role: "flag SAUCER_HIT (the saucer enters its explosion/score sequence, read by updateSaucerSound + the saucer handler), then retirePlayerShot -- reached from resolvePlayerShotHit when the shot collides in the saucer altitude band", cert: "seen" },
  0x1868: { name: "stepAnimationFrame", role: "step one scripted-animation frame: bump the counter loc_20c2, advanceRecordTotals over ANIM_COORD_STEP_LO and load the descriptor from ANIM_SPRITE_COORD, set ANIM_DONE_FLAG at ANIM_END_COORD, else compute ANIM_SPRITE_SRC from ANIM_BASE_SPRITE_SRC and blitShiftedSprite", cert: "seen" },
  0x191a: { name: "drawScoreHeader", role: "drawSpriteList the score-header line (SCORE_HEADER_TEXT) to SCORE_HEADER_SCREEN_ADDR", cert: "seen" },
  0x193c: { name: "drawCreditLabel", role: "drawSpriteList the 'CREDIT' label (CREDIT_LABEL_TEXT) to CREDIT_LABEL_SCREEN_ADDR", cert: "seen" },
  0x199a: { name: "drawTaitoCopyright", role: "behind a two-step port-1 input code (INPUT_CODE_STAGE_FLAG), drawSpriteList the Taito copyright (TAITO_COPYRIGHT_TEXT) to TAITO_COPYRIGHT_SCREEN_ADDR", cert: "seen" },
  0x19e6: { name: "drawReserveLifeIcons", role: "draw A reserve-ship icons (RESERVE_SHIP_SPRITE) at RESERVE_SHIP_ICONS_SCREEN_ADDR, blanking the remainder; skip drawing when the count is zero", cert: "seen" },
  0x1a7f: { name: "decrementShipsAndDrawReadout", role: "reserve-ships readout: readActivePlayerPageTopByte gives the count at the active page top; if zero bail; else store count-1 back (a ship enters play), drawReserveLifeIcons(count-1) the reserve row, then drawLivesDigit(count)", cert: "seen" },
  0x1a8b: { name: "drawLivesDigit", role: "draw the low nibble of A as a digit glyph at LIVES_DIGIT_SCREEN_ADDR via drawDigit", cert: "seen" },
};
