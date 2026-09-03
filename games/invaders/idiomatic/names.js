// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders idiomatic-layer name registry. The frozen oracle in ../translated/ is the source of
// truth; this gives the idiomatic layer symbols for work-RAM cells + the ROUTINES map dispatched over
// the translated fallback (resolveAllIdiomatic). Tags: [seen] MAME-confirmed, [code] read from the
// translated behaviour, [guess] role unknown. loc_ cells are placeholders (understand half renames).

// Return-stack scratch (SP inits 0x2400, grows down; measured deepest 0x23e0). Excluded from the diff.
export const STACK_SCRATCH = { lo: 0x23e0, hi: 0x2400 };

export const TIMER_RELOAD = 0x0600;  // [code]
export const loc_1b25 = 0x1b25;
export const ALIEN_SPRITE_TABLE = 0x1c00;  // [seen]
export const ALIEN_SHOT_BLOWUP_SPRITE = 0x1cdc;  // [code]
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
export const SAUCER_SCORE_KEY_PTR = 0x208d;  // [code]
export const SAUCER_TIMER = 0x2091;  // [seen]
export const SOUND_PORT3_SHADOW = 0x2094;  // [seen]
export const SOUND_PORT5_SHADOW = 0x2098;  // [seen]
export const TASK_FLAGS = 0x20c1;  // [code]
export const loc_20e7 = 0x20e7;
export const GAME_ACTIVE = 0x20e9;  // [seen]
export const CREDIT_COUNT = 0x20eb;  // [seen]
export const HIGH_SCORE_OBJ_DESC = 0x20f4;  // [code]
export const PLAYER1_OBJ_DESC = 0x20f8;  // [code]
export const PLAYER2_OBJ_DESC = 0x20fc;  // [code]
export const VIDEO_RAM_BASE = 0x2400;  // [seen]
export const PLAYFIELD_VRAM_BASE = 0x2402;  // [seen]
export const FLEET_LEFT_EDGE_VRAM = 0x2524;  // [code]
export const CREDIT_COUNT_SCREEN_ADDR = 0x3c01;  // [code]
export const FLEET_RIGHT_EDGE_VRAM = 0x3ea4;  // [code]
export const VIDEO_RAM_END = 0x4000;  // [seen]
export const DRAW_BLOCK_STRIDE = 0x02e0;  // [code]
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
export const GAME_OBJECT_TABLE = 0x2010;  // [code]
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
export const SHIELD_VRAM_BASE = 0x2806;  // [code]

export const COLLISION_FLAG = 0x2061;  // [seen]
export const SAUCER_ACTIVE = 0x2084;  // [seen]
export const SAUCER_HIT = 0x2085;  // [seen]
export const TWO_PLAYER_GAME = 0x20ce;  // [seen]
export const PLAYER1_SHIELD_BUFFER = 0x2142;  // [seen]
export const PLAYER2_SHIELD_BUFFER = 0x2242;  // [seen]
export const loc_391c = 0x391c;
export const TAITO_COPYRIGHT_TEXT = 0x0bf7;  // [seen]
export const SCORE_HEADER_TEXT = 0x1ae4;  // [seen]
export const RESERVE_SHIP_SPRITE = 0x1c60;  // [code]
export const SAUCER_HIT_SPRITE = 0x1d7c;  // [seen]
export const CREDIT_LABEL_TEXT = 0x1fa9;  // [seen]
export const ALIEN_EXPLOSION_TIMER = 0x2003;  // [seen]
export const INPUT_CODE_STAGE_FLAG = 0x201e;  // [seen]
export const ALIEN_EXPLOSION_ADDR = 0x2064;  // [seen]
export const ALIEN_SHOT_SPRITE_PTR = 0x2079;  // [seen]
export const ANIM_COORD_STEP_LO = 0x20c3;  // [seen]
export const ANIM_SPRITE_COORD = 0x20c5;  // [code]
export const ANIM_SPRITE_SRC = 0x20c7;  // [seen]
export const ANIM_END_COORD = 0x20ca;  // [seen]
export const ANIM_DONE_FLAG = 0x20cb;  // [seen]
export const ANIM_BASE_SPRITE_SRC = 0x20cc;  // [seen]
export const loc_21fb = 0x21fb;
export const loc_22fb = 0x22fb;
export const SCORE_HEADER_SCREEN_ADDR = 0x241e;  // [code]
export const LIVES_DIGIT_SCREEN_ADDR = 0x2501;  // [code]
export const RESERVE_SHIP_ICONS_SCREEN_ADDR = 0x2701;  // [code]
export const TAITO_COPYRIGHT_SCREEN_ADDR = 0x2e1b;  // [code]
export const CREDIT_LABEL_SCREEN_ADDR = 0x3501;  // [code]

// ── §4 clock-free spine cells (see names-debt.txt) ────────────────────────────────────────────────
export const FRAME_DELAY_TIMER = 0x20c0;      // [seen] vblank-decremented busy-wait counter (loc_0010 `dcr m`)
export const ATTRACT_ANIM_ACK = 0x2055;       // [code] ISR anim-step handshake bit0 (loc_189e set/clear spin)
export const TYPE_PACE_COUNT = 0x206c;        // [code] per-record type-pace byte (loc_184c/loc_1815)
export const SCREEN_MODE_TOGGLE = 0x20ec;     // [code] attract-screen alternator, flipped 0/1 each loc_0b89 pass
export const loc_2050 = 0x2050;               // anim descriptor scratch (loc_189e blockCopy dst)
export const loc_2080 = 0x2080;               // loc_189e seeds =2 (role ungrounded)
export const loc_21ff = 0x21ff;               // starting-ships latch (loc_0aea)

// ── vblank/mid ISR bodies (idiomaticVblankNmi / idiomaticMidNmi) cells + frozen seam-fallback entries ──
export const COIN_INPUT_LATCH = 0x20ea;       // [code] coin-switch edge latch: armed while IN1 b0 idle, banks one CREDIT_COUNT on the press edge (loc_0010)
export const CREDIT_SCREEN_SHOWN = 0x2093;    // [code] attract credit-screen-shown latch (0 = not yet shown)
export const OBJECT_TABLE_MID = 0x2020;       // [code] mid-screen object/timer record-table base (loc_008c passes to the walker; vblank uses GAME_OBJECT_TABLE 0x2010)
// Frozen (translated) leaves the direct-JS ISR bodies still dispatch via callFrozenLeaf; each lifted in a later §4 step:
export const TILT_HANDLER = 0x17cd;           // per-frame tilt/panic check (loc_0010 0x001d call)
export const OBJECT_DISPATCH_VBLANK = 0x0248; // seat HL=GAME_OBJECT_TABLE then the walker (loc_0072 0x007b call)
export const OBJECT_WALKER = 0x024b;          // 16-byte object/timer record walker (loc_024b; lifted step 5)
export const MID_DRAW_SCAN = 0x0141;          // mid-screen draw scan (loc_008c 0x00ab call)
export const ATTRACT_CREDIT_SCREEN = 0x0765;  // attract credit-inserted screen sub-arm (loc_0010 0x0064 jmp)
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

// ── object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ──
// The object table 0x2010.. holds five 16-byte records; each record's descriptor sub-fields and the
// per-record blit template in ROM 0x1b.. are named here as placeholders (understand half renames).
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
export const ROUTINES = {
  // ── §4 clock-free spine: boot chain, attract cycle, and the vblank busy-wait delays ──────────────
  0x0000: { name: "loc_0000", role: "[code] reset vector: tail-hands to boot init (loc_18d4), passing through the attract-loop generator the engine drives", cert: "code" },
  0x18d4: { name: "loc_18d4", role: "[code] boot init: seed work RAM (initWorkRam) + score panel (redrawScorePanel), then return the loc_18df attract-loop generator (SP seat dropped; harness seats SP for the NMI push)", cert: "code" },
  0x18df: { name: "loc_18df", role: "[code] attract-cycle join: set loc_20cf=8 then yield* into loc_0aea; reached from boot fall-through and loc_0b89 loop-back", cert: "code" },
  0x0aea: { name: "loc_0aea", role: "[code] attract round setup + free-run demo loop: silence sound, ei, type the attract screens (delays yield), seed the field, then per-frame advanceRoundState (advances ATTRACT_DEMO_PTR 0x20ed) until loc_2015 leaves 0xff; falls into loc_0b89", cert: "code" },
  0x0b89: { name: "loc_0b89", role: "[code] attract round teardown: credit/high-score panel + typed script + ISR-handshaked reveal (loc_189e), flip SCREEN_MODE_TOGGLE 0x20ec, tail-jmp loc_18df", cert: "code" },
  0x0ad7: { name: "loc_0ad7", role: "[code] vblank busy-wait: seed FRAME_DELAY_TIMER 0x20c0 = a and yield until the ISR drains it to 0", cert: "code" },
  0x0ab1: { name: "loc_0ab1", role: "[code] 0x40-frame attract delay -> loc_0ad7", cert: "code" },
  0x0ab6: { name: "loc_0ab6", role: "[code] 0x80-frame attract delay -> loc_0ad7", cert: "code" },
  0x0acf: { name: "loc_0acf", role: "[code] type the 0x0f-byte block to loc_2b14 using the caller's source de -> loc_0a93", cert: "code" },
  0x0a93: { name: "loc_0a93", role: "[code] type c sprite bytes from de onto hl, pacing 7 vblank frames per byte on FRAME_DELAY_TIMER (each pace step yields)", cert: "code" },
  0x0a80: { name: "loc_0a80", role: "[code] arm ISR anim task (TASK_FLAGS 0x20c1=2) and yield until ANIM_DONE_FLAG 0x20cb raised, then clear the task", cert: "code" },
  0x1815: { name: "loc_1815", role: "[code] draw the attract score-advance table: header string + loc_1dbe column script (no delay), then tail loc_1837 (typed loc_1dcf script)", cert: "code" },
  0x1837: { name: "loc_1837", role: "[code] point at the loc_1dcf script and fall into loc_183a", cert: "code" },
  0x183a: { name: "loc_183a", role: "[code] walk a draw script (fetchNextDrawRecord + loc_184c per record) until the 0xff terminator", cert: "code" },
  0x184c: { name: "loc_184c", role: "[code] type one script record: c = TYPE_PACE_COUNT 0x206c, de/hl from the fetched record -> loc_0a93", cert: "code" },
  0x189e: { name: "loc_189e", role: "[code] ISR-handshaked attract animation: arm TASK_FLAGS 0x20c1=4, spin ATTRACT_ANIM_ACK 0x2055 bit0 set-then-clear, draw, tail loc_0ab6 (the ISR anim it arms reaches the not-yet-translated object handler 0x050e)", cert: "code" },
  0x00b1: { name: "loadReferenceAlienState", role: "load the active player's saved field record: mirror the reference-alien coord word to loc_2009/ALIEN_DRAW_ADDR, derive the count at loc_2008, set FLEET_MOVE_DIR on the 0xfe edge sentinel", cert: "seen" },
  0x0100: { name: "drawPendingAlien", role: "draw the pending marching alien: bail to tickAlienExplosionDespawn when PLAYER_SHOT_HIT is set; else if the alien at (ACTIVE_PLAYER_PAGE:ALIEN_DRAW_INDEX) is live, build its sprite from ALIEN_SPRITE_TABLE (id bit0-cleared, rotate-left-3; +0x30 alternate frame via selectAlternateSpriteFrame when loc_2005 is set) and blitShiftedSprite 16 rows at ALIEN_DRAW_ADDR; clears ALIEN_DRAW_PENDING on every non-bail path", cert: "code" },
  0x01c0: { name: "markAllAliensAliveP1", role: "seat the player-1 alien-status base ALIEN_FIELD_P1 then markAllAliensAlive (fill 0x37 cells with 0x01)", cert: "code" },
  0x01cf: { name: "drawBottomLine", role: "draw the full-width bottom ground line via fillScreenRow(0x01, 0xe0, PLAYFIELD_VRAM_BASE); live-out HL", cert: "code" },
  0x01e6: { name: "initWorkRam", role: "boot-init: blockCopy the caller's B bytes from ROM image WORKRAM_INIT_IMAGE into the base of work RAM", cert: "code" },
  0x01f8: { name: "initShieldBuffers", role: "replicate the 0x2c-byte shield template loc_1d20 into four consecutive shield buffers from HL; live-out HL", cert: "code" },
  0x021e: { name: "drawOrSaveShields", role: "shield save/restore: store SHIELD_SAVE_RESTORE_MODE, then four 22x2 blocks from SHIELD_VRAM_BASE (stride DRAW_BLOCK_STRIDE) -- captureScreenRect when set, orBlitBitmap when clear", cert: "seen" },
  0x0430: { name: "loadPlayerShotDescriptor", role: "load the player-shot 5-byte descriptor at PLAYER_SHOT_DESC via loadSpriteDescriptor; HL := its screen address", cert: "code" },
  0x050f: { name: "loc_050f", role: "[code] object step handler (tail-target of the loc_0682 saucer handler): prime the record's strip (copyRecordToWorkBuffer), stage the two per-column rate cells, step the alien shot (loc_0563), clamp the firing column at 21, then either restore the strip or blit the record template and stow the column; a clean leaf, seam-placeable, reached via m.call from the frozen loc_0682", cert: "code" },
  0x0550: { name: "copyRecordToWorkBuffer", role: "stash A -> loc_207f, then blockCopy 0x0b bytes (DE)->work buffer loc_2073 (prime an object strip)", cert: "seen" },
  0x055b: { name: "copyWorkBufferToRecord", role: "blockCopy 0x0b bytes work buffer loc_2073 ->(HL) (restore the object strip; twin of copyRecordToWorkBuffer)", cert: "code" },
  0x0563: { name: "loc_0563", role: "alien-shot handler -- step the active alien shot (draw-phase gate, blowup animation, descend one step, redraw with collision, retire across the shield/ground bands) or, when idle, spawn a new one from a firing column (task-flag/rate-timer gated, column picked via the cursor list or a Y-scale)", cert: "code" },
  0x062f: { name: "loc_062f", role: "scan five object slots (stride 0x0b) on ACTIVE_PLAYER_PAGE from low byte C-1; live-outs: carry set on the first non-empty slot (else the final pointer add's carry), C decremented once, and L (the found slot's low byte, which the caller feeds to alienIndexToScreenCoords)", cert: "code" },
  0x0644: { name: "stepAlienShotBlowup", role: "step the alien-shot blowup: decrement ALIEN_SHOT_BLOWUP_TIMER; at 3 eraseAlienShot then re-seat ALIEN_SHOT_SPRITE_PTR=ALIEN_SHOT_BLOWUP_SPRITE and recenter the descriptor (loc_207b/loc_207c -= 2, ALIEN_SHOT_ROW_COUNT=6) and drawAlienShotWithCollision (tail); at 0 just eraseAlienShot (tail); else idle", cert: "seen" },
  0x0707: { name: "stopSaucerSound", role: "clear the saucer sound bit: SOUND_PORT3_SHADOW &= 0xfe via loc_19dc, mirror to sound port 3; value-out A", cert: "code" },
  0x070c: { name: "awardSaucerScore", role: "award the mystery-saucer score: raise SCORE_ADD_PENDING, read the key via SAUCER_SCORE_KEY_PTR, match it in SAUCER_SCORE_KEY_TABLE, copy the parallel SAUCER_SCORE_SPRITE_TABLE entry into the saucer sprite record loc_2087, store key*16 to SCORE_ADD_VALUE, resolveSpriteScreenAddr then drawThreeSprites (tail); live-out HL/DE/C", cert: "code" },
  0x0742: { name: "resolveSpriteScreenAddr", role: "load the sprite descriptor at loc_2087 then coordToScreenAddr; HL := screen address, DE := gfx pointer", cert: "code" },
  0x075f: { name: "copyTemplateToRecord", role: "blockCopy B bytes from ROM template loc_1b83 into the caller's object record (HL)", cert: "code" },
  0x0878: { name: "stageActivePlayerFieldSave", role: "stage the active player's field save: B := [loc_2008], DE := [loc_2009] word, HL := activeFieldRecordPointer", cert: "code" },
  0x08ff: { name: "drawSprite8x8", role: "resolve sprite id A to its 8-byte source at loc_1e00+8*A, latch A to port 6, blit an 8x8 sprite via drawSpriteColumn; live-out HL", cert: "code" },
  0x092e: { name: "readActivePlayerPageTopByte", role: "read the byte at the top of the active player's page ((mem[ACTIVE_PLAYER_PAGE]<<8)|0xff); live-out HL, A", cert: "code" },
  0x0935: { name: "awardExtraShip", role: "award the next reserve ship once the active player's tally passes the port-2-selected threshold: bump the stored ship count, redraw the reserve-ship column (RESERVE_SHIP_SPRITE) and lives digit, clear the award flag, seat SFX_OFF_TIMER=0xff, and cue the extra-ship sound (tail startSound 0x10)", cert: "code" },
  0x0988: { name: "applyPendingScoreAdd", role: "when SCORE_ADD_PENDING is set, clear it and BCD-add the two-byte SCORE_ADD_VALUE into the active player's record accumulator (base from currentPlayerRecordPtr, 8080 DAA decimal carry), then redraw the total as four BCD glyphs at the record's screen address (tail drawBcdWord); a clear flag is a no-op", cert: "code" },
  0x09ad: { name: "drawBcdWord", role: "draw the 16-bit value in DE as four BCD digit glyphs -- high byte D then low byte E -- via drawBcdByte; live-out HL (advanced two glyph-pairs), DE preserved", cert: "code" },
  0x0a59: { name: "loc_0a59", role: "poll [loc_2015] against 0xff and report equality in the Z flag (set via the return-assignment bridge for the still-frozen callers loc_0a3c/loc_081f/loc_0aea/loc_16e6, plus a boolean for idiomatic callers); reads no register, writes no memory", cert: "code" },
  0x0a5f: { name: "loc_0a5f", role: "if [GAME_IN_PROGRESS]!=0: startSound(0x08), index the 3-entry table via loc_097c(B), stamp SCORE_ADD_VALUE=table byte / SCORE_ADD_PENDING=0x01 /", cert: "code" },
  0x0ae2: { name: "loadDrawSequenceBlock", role: "blockCopy the 12-byte draw/animation sequence from (DE) into loc_20c2", cert: "code" },
  0x0bf1: { name: "loc_0bf1", role: "pre-round redraw trampoline: run loc_190a (fleet edge/direction update) then tail into drawTaitoCopyright", cert: "code" },
  0x1474: { name: "seatBlitPosition", role: "OUT port 2 := L&7 (MB14241 shift offset), then HL := coordToScreenAddr(HL) -- seat the next blit", cert: "code" },
  0x14cb: { name: "clearScreenStrip", role: "zero A then fillScreenRow(0) -- blank a run of B screen columns from HL; live-out HL", cert: "code" },
  0x14d8: { name: "resolvePlayerShotHit", role: "resolve a player-shot collision (dispatched while PLAYER_SHOT_STATUS==2): ret unless a hit is latched (PLAYER_SHOT_HIT, which loc_03bb copies from COLLISION_FLAG); then by the shot Y at loc_2029 either stand down into state 3 + clearShotHitAndSilence (missed off the top), mark the saucer hit + retire the shot (markSaucerHitAndRetireShot, saucer altitude band), or scale the coords to a 55-cell alien-rack index (loc_1581) and on a live cell kill the alien + queue the invader-die sound/explosion (loc_0a5f), enter state 5, blit, and arm the explosion despawn timer ALIEN_EXPLOSION_TIMER", cert: "seen" },
  0x154a: { name: "clearShotHitAndSilence", role: "clear PLAYER_SHOT_HIT, then loc_19dc(0xf7) masks bit 3 off SOUND_PORT3_SHADOW; value-out A", cert: "code" },
  0x1554: { name: "countStepsToThreshold", role: "count in C the 0x10 steps that lift A to/above threshold H (pre-normalizing a negative A via loc_1590); live-out A, C, carry clear", cert: "code" },
  0x1597: { name: "reverseFleetAtEdge", role: "fleet edge / direction reversal: scan the edge column selected by FLEET_MOVE_DIR (fleetReachedEdge); on a hit flip the direction and republish loc_2008 (step count, via loc_18f1) and FLEET_STEP_DY (mirrored from FLEET_DROP_DELTA), else leave state unchanged; RAM-only live-out", cert: "seen" },
  0x15c5: { name: "fleetReachedEdge", role: "scan 0x17 (23) bytes upward from HL for the first nonzero (fleet edge reached); carry live-out set=found (inlines the loc_166b set-carry) / clear=all-zero (trailing ana a), read by reverseFleetAtEdge via rnc; returns the found boolean", cert: "code" },
  0x15f3: { name: "countLiveAliens", role: "count live cells across the active player's 0x37-byte alien field into ALIEN_COUNT; set LAST_ALIEN_FLAG at exactly one survivor", cert: "seen" },
  0x1618: { name: "advanceRoundState", role: "gated pre-round step: when armed (loc_2015==0xff) and the field is idle, advance ATTRACT_DEMO_PTR (attract) or arm the shot on a fresh fire edge (play, GAME_IN_PROGRESS set)", cert: "code" },
  0x166b: { name: "loc_166b", role: "the fleetReachedEdge scan's 'found' sentinel (stc; ret): set carry and return true; inline candidate -- fleetReachedEdge already folds this set-carry directly", cert: "code" },
  0x170e: { name: "selectAlienShotRate", role: "select the alien-shot rate: scan ALIEN_SHOT_RATE_THRESHOLDS for the first entry >= the field-size key, store the parallel ALIEN_SHOT_RATE_TABLE byte to loc_20cf (read by the shot stepper loc_0563)", cert: "seen" },
  0x172c: { name: "loc_172c", role: "mode-gated sound step: PLAYER_SHOT_STATUS!=0 -> startSound(0x02), else loc_19dc(0xfd)", cert: "code" },
  0x1740: { name: "stepFleetMarchSound", role: "fleet-march sound beat: tick FLEET_SOUND_OFF_TIMER/FLEET_SOUND_TIMER, on beat emit SOUND_PORT5_SHADOW and re-arm, silencing at the edges; set FLEET_SOUND_STEP", cert: "seen" },
  0x1775: { name: "advanceFleetMarchSound", role: "on FLEET_SOUND_STEP, pick the fleet tempo for ALIEN_COUNT from FLEET_RATE_THRESHOLDS/FLEET_RATE_TABLE into FLEET_SOUND_PERIOD and rotate the port-5 fleet tone; tick SFX_OFF_TIMER", cert: "seen" },
  0x1844: { name: "drawSpriteColumn16", role: "draw a fixed 16-row sprite column (row count forced to 0x10) via drawSpriteColumn, preserving BC; live-out HL", cert: "code" },
  0x1904: { name: "markAllAliensAliveP2", role: "seat the player-2 alien-status base ALIEN_FIELD_P2 then markAllAliensAlive (0x37-byte 0x01 fill)", cert: "code" },
  0x190a: { name: "loc_190a", role: "run the state-2 handler resolvePlayerShotHit, then tail into the fleet edge/direction update reverseFleetAtEdge; RAM-only, callers ignore the result", cert: "code" },
  0x1925: { name: "drawPlayer1Score", role: "seat the player-1 score record pointer PLAYER1_OBJ_DESC, then drawScoreRecord (tail) -- draw the P1 BCD total as four glyphs at the record's screen address; RAM-only live-out", cert: "code" },
  0x192b: { name: "drawPlayer2Score", role: "seat the player-2 score record pointer PLAYER2_OBJ_DESC, then drawScoreRecord (tail) -- draw the P2 BCD total; RAM-only live-out", cert: "code" },
  0x1931: { name: "drawScoreRecord", role: "shared score-record draw: unpack a four-byte record at HL (a BCD value word then its two-byte screen address) and draw the value as four BCD glyphs there (tail drawBcdWord); reached for P1 (0x20f8), P2 (0x20fc) and the high score (0x20f4)", cert: "code" },
  0x1947: { name: "drawCreditCount", role: "draw the BCD credit tally CREDIT_COUNT as two decimal glyphs at CREDIT_COUNT_SCREEN_ADDR via drawBcdByte (tail dissolved); live-out HL", cert: "code" },
  0x1950: { name: "drawHighScore", role: "seat the high-score record pointer HIGH_SCORE_OBJ_DESC, then drawScoreRecord (tail) -- draw the high-score BCD total; also called by loc_1671 to repaint after a new high; RAM-only live-out", cert: "code" },
  0x1956: { name: "redrawScorePanel", role: "boot/attract score-panel repaint: clearScreen, then redraw the score header (drawScoreHeader), player-1/2 scores (drawPlayer1Score/drawPlayer2Score), the high score (drawHighScore), the CREDIT label (drawCreditLabel), and the credit tally (tail drawCreditCount); all seven ROM calls dissolved to direct idiomatic calls; RAM-only live-out", cert: "code" },
  0x1979: { name: "drawCreditReadout", role: "boot/attract credit readout: clearGameActive, then repaint the credit panel -- drawCreditCount (the BCD credit tally) then drawCreditLabel (the CREDIT label, tail)", cert: "code" },
  0x1988: { name: "loc_1988", role: "clear the play-field framebuffer", cert: "code" },
  0x19d1: { name: "setGameActive", role: "store 1 -> GAME_ACTIVE (shared tail loc_19d3); mark the game active", cert: "code" },
  0x19d7: { name: "clearGameActive", role: "store 0 -> GAME_ACTIVE (shared tail loc_19d3); clear the game-active flag", cert: "code" },
  0x1982: { name: "loc_1982", role: "store A -> TASK_FLAGS", cert: "seen" },
  0x013b: { name: "selectAlternateSpriteFrame", role: "bump sprite pointer to 2nd bank (DE += 0x30)", cert: "code" },
  0x017a: { name: "alienIndexToScreenCoords", role: "resolve L over 0x0b into (L,C,D) using the B,C pair at loc_2009/loc_200a", cert: "code" },
  0x01c3: { name: "markAllAliensAlive", role: "HL-relative fill of 0x37 bytes with 0x01", cert: "seen" },
  0x01d9: { name: "advanceRecordTotals", role: "record accumulate: [HL+2]+=C, [HL+3]+=[HL+1]; return 2nd total in A", cert: "seen" },
  0x067e: { name: "loc_067e", role: "store HL (16-bit) -> loc_2048", cert: "seen" },
  0x0886: { name: "activeFieldRecordPointer", role: "build HL = (ACTIVE_PLAYER_PAGE << 8) | 0xfc", cert: "code" },
  0x08d1: { name: "readStartingShips", role: "A = (port2 & 3) + 3", cert: "code" },
  0x08d8: { name: "loc_08d8", role: "if ALIEN_COUNT < 9: loc_207e = 0xfb", cert: "code" },
  0x0913: { name: "loc_0913", role: "gate on loc_2009<0x78, decrement 16-bit timer SAUCER_TIMER, reload 0x0600 + set flag loc_2083 on wrap", cert: "seen" },
  0x097c: { name: "loc_097c", role: "HL = loc_1da0 + clamp-index of A (offset 0 if A<2, 1 if 2<=A<4, 2 if A>=4)", cert: "code" },
  0x09ca: { name: "currentPlayerRecordPtr", role: "HL = bit0 of ACTIVE_PLAYER_PAGE ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC (active player's data pointer)", cert: "code" },
  0x09d6: { name: "clearPlayfield", role: "clear the play-field framebuffer", cert: "seen" },
  0x1439: { name: "drawSpriteColumn", role: "copy B bytes into B adjacent screen columns (stride 0x20 right per byte); live-out HL = HL + 0x20*B", cert: "seen" },
  0x147c: { name: "captureScreenRect", role: "block-copy a B-column x C-byte screen rectangle into a byte stream; live-out DE, HL", cert: "code" },
  0x14cc: { name: "fillScreenRow", role: "fill B columns with A stepping 0x20 right from HL (a horizontal band); leave HL one stride past", cert: "seen" },
  0x1581: { name: "loc_1581", role: "compute record pointer HL from index B, offset C, and the record-page cell", cert: "code" },
  0x1590: { name: "loc_1590", role: "normalize A up in 0x10 steps until non-negative, counting the steps in C", cert: "code" },
  0x1611: { name: "activePlayerPageBase", role: "HL := page byte (mem[ACTIVE_PLAYER_PAGE]) << 8", cert: "code" },
  0x176d: { name: "loc_176d", role: "OUT 5 := mem[SOUND_PORT5_SHADOW] & 0x30 (sound-off helper)", cert: "code" },
  0x1770: { name: "latchSoundPort5", role: "mask A to the two sound-select bits, OUT sound port 5", cert: "code" },
  0x17c0: { name: "readActivePlayerInput", role: "read the player-selected input port into A", cert: "code" },
  0x18e7: { name: "loc_18e7", role: "HL := 0x20e7 + bit0 of (0x2067)", cert: "code" },
  0x18f1: { name: "loc_18f1", role: "B := 2, or 3 when (0x2082) == 1", cert: "code" },
  0x18fa: { name: "startSound", role: "(0x2094) |= B, mirror to sound port, A := result", cert: "seen" },
  0x1910: { name: "loc_1910", role: "HL := loc_20e7 + (bit0 of ACTIVE_PLAYER_PAGE clear ? 1 : 0)", cert: "code" },
  0x19d3: { name: "loc_19d3", role: "store A -> GAME_ACTIVE (shared tail)", cert: "seen" },
  0x19dc: { name: "loc_19dc", role: "SOUND_PORT3_SHADOW &= B, mirror to sound port 3, A := result", cert: "seen" },
  0x1a06: { name: "objectMatchesDrawPhase", role: "raster draw-phase predicate: carry := (mem[DE] & 0x80) === mem[DRAW_PHASE_FLAG] -- true when the object's phase bit (bit7 of its byte) matches the current raster half (DRAW_PHASE_FLAG is 0x80 in the vblank half, 0x00 in the mid-screen half); the three object dispatchers rnc-skip an object that does not belong to this half-frame", cert: "code" },
  0x1a32: { name: "blockCopy", role: "block-copy B bytes (DE)->(HL), both advancing", cert: "seen" },
  0x1a3b: { name: "loadSpriteDescriptor", role: "read 5-byte descriptor at (HL) -> DE/A/C/B, then HL=C:A", cert: "code" },
  0x1a47: { name: "coordToScreenAddr", role: "HL := (HL >> 3) with H forced into the 0x2000-0x3fff video-RAM page", cert: "seen" },
  0x1a5c: { name: "clearScreen", role: "zero video RAM 0x2400..0x3fff", cert: "seen" },
  0x1a69: { name: "orBlitBitmap", role: "OR-merge C source bytes down each of B columns (columns 0x20 apart); advance HL and DE", cert: "seen" },
  0x01e4: { name: "seedWorkRamImage", role: "preset the copy count to 0xc0, then initWorkRam blockCopies the ROM template WORKRAM_INIT_IMAGE into the work-RAM base; memory-only", cert: "code" },
  0x01ef: { name: "initPlayer1ShieldBuffers", role: "seat the player-1 shield buffer base PLAYER1_SHIELD_BUFFER, then initShieldBuffers replicates the shield template into four slots; live-out HL", cert: "code" },
  0x01f5: { name: "initPlayer2ShieldBuffers", role: "seat the player-2 shield buffer base PLAYER2_SHIELD_BUFFER, then initShieldBuffers replicates the shield template into four slots; live-out HL", cert: "code" },
  0x0214: { name: "saveOrRestorePlayer2Shields", role: "seat DE=PLAYER2_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores the four player-2 shield blocks per the caller's mode; memory-only", cert: "code" },
  0x021b: { name: "saveOrRestorePlayer1Shields", role: "seat DE=PLAYER1_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores the four player-1 shield blocks per the caller's mode; memory-only", cert: "code" },
  0x073c: { name: "loc_073c", role: "resolve the sprite descriptor at loc_2087 to its screen address + gfx pointer (resolveSpriteScreenAddr), then blit the sprite column into video RAM (drawSpriteColumn); live-out HL", cert: "code" },
  0x08e4: { name: "blankScreenStrip", role: "return early when TWO_PLAYER_GAME is set, else clearScreenStrip blanks a 0x20-column VRAM strip at loc_391c", cert: "code" },
  0x08f3: { name: "drawSpriteList", role: "draw C consecutive sprite ids from (DE) as a run of 8x8 sprites via drawSprite8x8; live-out HL", cert: "code" },
  0x09c5: { name: "drawDigit", role: "map a 0-9 value to its glyph id (A += 0x1a) and draw it via drawSprite8x8", cert: "code" },
  0x1400: { name: "orBlitShiftedSprite", role: "seat the pixel-shift offset, then OR-blit a hardware-shifted B-row sprite into (HL)/(HL+1); live-out HL, DE", cert: "code" },
  0x1424: { name: "clearSpriteColumn", role: "seat the shift offset, then zero the 2-byte-wide x B-row sprite footprint at HL; live-out HL", cert: "seen" },
  0x1452: { name: "eraseShiftedSprite", role: "erase a hardware-shifted sprite by AND-ing its complemented bits out of the screen over B rows; live-out HL", cert: "seen" },
  0x1491: { name: "drawSpriteWithCollision", role: "OR-blit a hardware-shifted sprite while testing overlap, setting COLLISION_FLAG on any hit; live-out HL, DE", cert: "seen" },
  0x1545: { name: "retirePlayerShot", role: "set PLAYER_SHOT_STATUS to 4 (retiring), then clearShotHitAndSilence (clear PLAYER_SHOT_HIT and silence its sound)", cert: "code" },
  0x1562: { name: "scaleXToBlock", role: "scale the X coordinate to a grid block index in B via countStepsToThreshold (threshold loc_2009), residual in L", cert: "code" },
  0x156f: { name: "scaleYToBlock", role: "scale the Y coordinate to a grid block index in C via countStepsToThreshold (threshold loc_200a), residual in H", cert: "code" },
  0x15d3: { name: "blitShiftedSprite", role: "seat the shift offset, then overwrite-blit a hardware-shifted B-row sprite into (HL)/(HL+1); live-out HL (base), DE", cert: "seen" },
  0x1804: { name: "updateSaucerSound", role: "per-frame saucer sound gate: SAUCER_ACTIVE==0 -> stopSaucerSound, else drive the UFO tone", cert: "code" },
  0x1856: { name: "fetchNextDrawRecord", role: "fetch the next 4-byte draw record addressed by BC (A=(BC), advance BC); live-out A, BC", cert: "code" },
  0x19fa: { name: "clearScreenRegion", role: "repeatedly clearScreenStrip to blank a wider screen region", cert: "code" },
  0x00d7: { name: "loc_00d7", role: "seed the mirrored per-player cells loc_21fb/loc_22fb with 0x02, then blank the fixed 0x20-column screen strip via blankScreenStrip (guarded by TWO_PLAYER_GAME, which rnz-early-outs when nonzero); live-out HL", cert: "seen" },
  0x0209: { name: "savePlayer1Shields", role: "force save mode (A=1), then saveOrRestorePlayer1Shields captures the four player-1 shields into PLAYER1_SHIELD_BUFFER; memory-only", cert: "code" },
  0x020e: { name: "savePlayer2Shields", role: "force save mode (A=1), then saveOrRestorePlayer2Shields captures the four player-2 shields into PLAYER2_SHIELD_BUFFER; memory-only", cert: "code" },
  0x0213: { name: "restorePlayer2Shields", role: "force restore mode (A=0), then saveOrRestorePlayer2Shields OR-blits the player-2 shields back from PLAYER2_SHIELD_BUFFER; memory-only", cert: "code" },
  0x021a: { name: "restorePlayer1Shields", role: "force restore mode (A=0), then saveOrRestorePlayer1Shields OR-blits the player-1 shields back from PLAYER1_SHIELD_BUFFER; memory-only", cert: "code" },
  0x066c: { name: "drawAlienShotWithCollision", role: "seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR, loadSpriteDescriptor, then drawSpriteWithCollision; live-out HL/DE/A + COLLISION_FLAG", cert: "code" },
  0x0675: { name: "eraseAlienShot", role: "seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR, loadSpriteDescriptor, then eraseShiftedSprite (AND the sprite's bits out of the screen)", cert: "code" },
  0x074b: { name: "playSaucerHitSoundAndDrawSprite", role: "on saucer destruction: OR the port-5 UFO-hit sound bit and latchSoundPort5, repoint the saucer sprite record at SAUCER_HIT_SPRITE, then draw it", cert: "code" },
  0x08f1: { name: "drawThreeSprites", role: "seat count C=3, then drawSpriteList blits three consecutive 8x8 sprites from (DE)", cert: "code" },
  0x09b2: { name: "drawBcdByte", role: "draw the byte in A as two digit glyphs, high nibble then low, via drawDigit (BCD: each nibble is 0-9)", cert: "code" },
  0x1538: { name: "tickAlienExplosionDespawn", role: "decrement the despawn countdown ALIEN_EXPLOSION_TIMER; while nonzero return; on expiry reload the sprite address from ALIEN_EXPLOSION_ADDR, clearSpriteColumn, then retirePlayerShot", cert: "code" },
  0x1579: { name: "markSaucerHitAndRetireShot", role: "flag SAUCER_HIT (the saucer enters its explosion/score sequence, read by updateSaucerSound + the saucer handler), then retirePlayerShot -- reached from resolvePlayerShotHit when the shot collides in the saucer altitude band", cert: "code" },
  0x1868: { name: "stepAnimationFrame", role: "step one scripted-animation frame: bump the counter loc_20c2, advanceRecordTotals over ANIM_COORD_STEP_LO and load the descriptor from ANIM_SPRITE_COORD, set ANIM_DONE_FLAG at ANIM_END_COORD, else compute ANIM_SPRITE_SRC from ANIM_BASE_SPRITE_SRC and blitShiftedSprite", cert: "code" },
  0x191a: { name: "drawScoreHeader", role: "drawSpriteList the score-header line (SCORE_HEADER_TEXT) to SCORE_HEADER_SCREEN_ADDR", cert: "code" },
  0x193c: { name: "drawCreditLabel", role: "drawSpriteList the 'CREDIT' label (CREDIT_LABEL_TEXT) to CREDIT_LABEL_SCREEN_ADDR", cert: "code" },
  0x199a: { name: "drawTaitoCopyright", role: "behind a two-step port-1 input code (INPUT_CODE_STAGE_FLAG), drawSpriteList the Taito copyright (TAITO_COPYRIGHT_TEXT) to TAITO_COPYRIGHT_SCREEN_ADDR", cert: "code" },
  0x19e6: { name: "drawReserveLifeIcons", role: "draw A reserve-ship icons (RESERVE_SHIP_SPRITE) at RESERVE_SHIP_ICONS_SCREEN_ADDR, blanking the remainder; skip drawing when the count is zero", cert: "code" },
  0x1a7f: { name: "decrementShipsAndDrawReadout", role: "reserve-ships readout: readActivePlayerPageTopByte gives the count at the active page top; if zero bail; else store count-1 back (a ship enters play), drawReserveLifeIcons(count-1) the reserve row, then drawLivesDigit(count)", cert: "seen" },
  0x1a8b: { name: "drawLivesDigit", role: "draw the low nibble of A as a digit glyph at LIVES_DIGIT_SCREEN_ADDR via drawDigit", cert: "code" },
};
