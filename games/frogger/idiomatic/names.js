// SPDX-License-Identifier: GPL-3.0-only

/**
 * Frogger idiomatic-layer registry + the work-RAM names its spine reads.
 *
 * resolveAllIdiomatic() reads ROUTINES: each 0xADDR maps to ./idiomatic/<name>.js, exporting
 * <entry ?? name>, wired OVER the translated base. Only the SPINE is listed here — every routine
 * without an entry falls back to its translated oracle, which is the born-live model.
 *
 * The spine is the foreground main loop, and it is TWO addresses because the ROM enters the loop
 * body at two points: 0x0341 (the head, run each attract pass) and 0x0368 (the pace tail, which the
 * in-play play-loop re-enters via `jp 0x0368`, skipping the head). The boot chain (0x0000, 0x02a3)
 * stays translated: it runs once, never yields, and its tail `m.call(0x0341)` already hands the
 * engine the driver generator — so boot needs no idiomatic form to be born live.
 *
 * Names carry an evidence tag: [code] understood from the routines that touch the cell; [seen]
 * observed under MAME. The pixel gate, not a name, is the correctness authority.
 */

// Attract/mode dispatch. [code] loc_0341 masks this against 2 to gate the attract dispatcher 0x0d11,
// and loc_0567 sets it to 3 at cold-start, so it is the top-level game mode.
export const GAME_MODE = 0x83d6;

// In-play flag AND player count (0 = attract, 1/2 = a game with that many players). [code] the pace
// tail branches to the in-play tree 0x040b on non-zero; the new-game setup stores the player count here.
export const PLAY_FLAG = 0x83fe;

// Start-already-latched flag. [code] set to 1 by the new-game setup; while non-zero the attract pace
// tail loops without re-reading the START buttons.
export const START_LATCH = 0x83b3;

// On-screen credit total, packed BCD. [code] the pace tail compares it against the player count and
// subtracts (with daa) when a game starts.
export const CREDIT_BCD = 0x83e1;

// IN1 input port (dip-interleaved). [code] the pace tail rotates bit 7 (START1) then bit 6 (START2)
// out of it to decide a 1- or 2-player start.
export const IN1_PORT = 0xe002;

// The two ROM entry points into the loop body (see the header).
export const MAIN_LOOP_HEAD = 0x0341;
export const PACE_TAIL = 0x0368;

// Tilemap base fillTilemapBlock28x32 fills from. [code] fillTilemapBlock28x32 loads it as the fixed start of a 28x32 block fill.
export const loc_a802 = 0xa802;

// Work-RAM, video-RAM, and IO-port cells the batch-1 leaves touch. Each is defined ONCE; shared
// cells note every leaf that uses them. Evidence is [code] (understood from the touching routines).
export const loc_800c = 0x800c; // [seen] demo object block base; clearObjectBlocksAndMirrorToObjRam clears 44 bytes here + mirrors 43 to OBJRAM, swapOutActivePlayerPages banks/restores its 43-byte object page
export const OBJRAM_COL3F_ATTR_SHADOW = 0x803f; // [seen] work-RAM shadow of OBJRAM per-column attribute byte 0xB03F (NMI DMAs 0x8007-0x803f -> 0xb007-0xb03f each frame); written (never read as a flag) by display routines to set column 0x3f's attribute -- renderCreditLine/swapInActivePlayerPages/swapOutActivePlayerPages write 1, initDisplayFieldOnce 3, others clear/set (corrects the earlier page-swap-done misread)
export const FROG_X = 0x8044; // [seen] frog X (game-space horizontal position, grounded: watched incrementing 0x84->0x90 as the demo frog moved right); frog object block base -- activateFrogObject sets it active, resetFrogObject writes the four object bytes from here, the move dispatcher scans lane objects against it
export const loc_8045 = 0x8045; // [code] frog object sub-field; activateFrogObject clears it when activating the frog
export const FROG_Y = 0x8047; // [seen] frog Y / row (game-space vertical position, grounded: watched E0=bottom -> 40=top as the frog climbed); frog object sub-field -- activateFrogObject clears it when activating the frog, the move dispatcher keys its lane-scan arm on it
export const loc_80ff = 0x80ff; // [seen] live work page base; swapOutActivePlayerPages banks 183 bytes from here and restores them from the other bank
export const loc_8100 = 0x8100; // [seen] second work-RAM sprite block base; clearObjectBlocksAndMirrorToObjRam zeroes 99 bytes from here
export const loc_8269 = 0x8269; // [code] frog state cell; resetFrogObject clears it during the frog-object reset
export const loc_825a = 0x825a; // [code] per-player start/demo flag; loc_05d3 sets it to 1, handOffToOtherPlayer sets it to 1 on the player hand-off
export const loc_825b = 0x825b; // [seen] 2-player start flag; loc_05d3 clears it, raiseTwoPlayerStartFlag raises it, swapOutActivePlayerPages restores it under the init guard
export const loc_826d = 0x826d; // [code] 2-player mode flag; loc_05d3 sets it to 1, raiseTwoPlayerStartFlag reads it to decide whether to raise the start flag
export const loc_8295 = 0x8295; // [code] one-shot init guard latch; swapOutActivePlayerPages returns early when set, else latches it to 1
export const loc_8297 = 0x8297; // [seen,poked] board-complete "all frogs home" reveal countdown / home-column selector; loc_05d3 sets 255, decremented each frame, fed to stampHomeBayFrogByColumn as the selector (grounding overturned the "demo start-flag" reading)
export const loc_8298 = 0x8298; // [seen,poked] board-complete reveal delay timer; loc_05d3 sets it to 0x40, it drains before the 0x8297 reveal countdown starts (grounding overturned the "demo start-flag" reading)
export const loc_829d = 0x829d; // [code] NMI in-play countdown word; loc_0292 decrements it each pass
export const loc_8371 = 0x8371; // [code] per-turn scratch cell; handOffToOtherPlayer clears it at the top of the player hand-off
export const loc_83ae = 0x83ae; // [code] countdown-expiry flag; loc_0292 clears it when the countdown word reaches zero
export const loc_83b6 = 0x83b6; // [code] per-player reset cell; handOffToOtherPlayer clears it when handing play to the other player
export const loc_83b7 = 0x83b7; // [seen,poked] life/level count; renderLivesRow clamps it to draw the lives row, awardExtraLife mirrors the new count here, handOffToOtherPlayer loads the other player's into it
export const PLAYER1_LIVES = 0x83b8; // [seen,poked] player 1 life count; awardExtraLife increments it, handOffToOtherPlayer reads it
export const PLAYER2_LIVES = 0x83b9; // [seen] player 2 life count; awardExtraLife increments it, handOffToOtherPlayer reads it
export const loc_83c2 = 0x83c2; // [code] cocktail-enabled flag; handOffToOtherPlayer toggles the screen flip only when it is non-zero
export const loc_83c3 = 0x83c3; // [code] frog-ready flag; resetFrogObject sets it to 1 at the end of the frog-object reset
export const loc_83cb = 0x83cb; // [code] screen-flip latch (work-RAM shadow); handOffToOtherPlayer toggles bit 0 and mirrors it to the flip IO ports
export const loc_83cc = 0x83cc; // [seen,poked] awardExtraLife clears this to 0 when awarding an extra life
export const loc_83cd = 0x83cd; // [code] frog-state / demo flag; loc_05d3 sets it to 1, resetFrogObject clears it during the frog-object reset
export const loc_83d2 = 0x83d2; // [code] frog 16-bit timer A; activateFrogObject seeds it to 64 in a two-player game
export const loc_83d9 = 0x83d9; // [code] sound-control byte RAM shadow; issueSoundCommand reads it to pulse bit 3 of the sound-control port
export const loc_83da = 0x83da; // [code] frog 16-bit timer B; activateFrogObject seeds it to 64 in a two-player game
export const loc_83e4 = 0x83e4; // [seen] shared time byte / inactive sentinel; renderTimeBar returns without drawing when it holds 255, else uses it as the fallback time source
export const loc_83e5 = 0x83e5; // [code] player-1 time-remaining byte; renderTimeBar uses it as the bar length when player 1 is active
export const loc_83e6 = 0x83e6; // [code] player-2 time-remaining byte; renderTimeBar uses it as the bar length when player 2 is active
export const loc_83ea = 0x83ea; // [code] demo start flag; loc_05d3 clears it to 0
export const loc_83f1 = 0x83f1; // [seen] high-score word table base (5 rank words 0x83f1-0x83fa, read at 0x83ef+2r); renderMode3ScoreRankingScreen reads it for the on-screen ranking scores; maintained by insertHighScoreEntry
export const loc_83f2 = 0x83f2; // [code] key-high of the first slot of the 5-entry descending table; insertHighScoreEntry inserts into it
export const ACTIVE_PLAYER = 0x83fd; // [seen] active player number (1/2); awardExtraLife and renderTimeBar pick the active player's counter, handOffToOtherPlayer toggles it
export const loc_8400 = 0x8400; // [code] ring cursor cell + buffer base; nextSpawnRandomByte decrements the cursor and XOR-folds two ring cells
export const loc_842c = 0x842c; // [code] frog state cell; resetFrogObject clears it during the frog-object reset
export const loc_842d = 0x842d; // [seen] frog state cell; resetFrogObject clears it during the frog-object reset
export const loc_8500 = 0x8500; // [code] work-page save bank base; swapOutActivePlayerPages banks 183 live bytes into here
export const loc_85c0 = 0x85c0; // [seen] other player's saved object page; swapOutActivePlayerPages restores 43 object bytes from here
export const loc_8600 = 0x8600; // [seen] other player's saved work page; swapOutActivePlayerPages restores 183 bytes from here
export const loc_86c0 = 0x86c0; // [code] object save bank base; swapOutActivePlayerPages banks 43 live object bytes into here
export const loc_a808 = 0xa808; // [code] tilemap fill base; fillTilemapBlock22x32 loads it as the fixed start of a 22x32 block fill
export const loc_a85e = 0xa85e; // [seen,poked] lives-row marker base; awardExtraLife stamps the new life marker at base + count*0x20
export const loc_a864 = 0xa864; // [seen,poked] home-slot VRAM base (slot 5); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_a87e = 0xa87e; // [code] lives/level row column base; renderLivesRow stamps the marker tile down it stepping +0x20
export const loc_a924 = 0xa924; // [seen,poked] home-slot VRAM base (slot 4); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_a9e4 = 0xa9e4; // [seen,poked] home-slot VRAM base (slot 3); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_aaa4 = 0xaaa4; // [seen,poked] home-slot VRAM base (slot 2); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_ab64 = 0xab64; // [seen,poked] home-slot VRAM base (slot 1); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_abbe = 0xabbe; // [code] time-bar column base (VRAM); renderTimeBar draws the bar up the column from here stepping -0x20
export const loc_b00c = 0xb00c; // [code] OBJRAM object mirror base; clearObjectBlocksAndMirrorToObjRam copies the zeroed 43-byte object head into here
export const loc_b80c = 0xb80c; // [code] flip_y IO latch; handOffToOtherPlayer mirrors the screen-flip bit to it when cocktail is enabled
export const loc_b810 = 0xb810; // [code] flip_x IO latch; handOffToOtherPlayer mirrors the screen-flip bit to it when cocktail is enabled
export const loc_d000 = 0xd000; // [seen] sound-command latch port (PPI1.A); issueSoundCommand writes register A here to issue a sound command
export const loc_d002 = 0xd002; // [seen] sound-control port (PPI1.B); issueSoundCommand pulses bit 3 low-then-high to raise the audio /INT

// ── batch-2 cells: scroll engine, home-bay animations, fly patrol, sprite-object arms, animation clocks, game-start clears ──
export const loc_8001 = 0x8001; // [seen] scroll-copy source-pointer scratch (word); blitScrollTileGrid saves the source pointer here and the per-column loop reloads it
export const loc_8003 = 0x8003; // [code] scroll-copy row-count scratch; blitScrollTileGrid saves the row count here and the per-column loop reloads it
export const HOLD_FLAG = 0x8004; // [seen] hold flag / object-frog hit flag; stampHomeBaySlot stamps the slot but leaves the selector pending when non-zero, flagSpriteObjectFrogHit sets it to 1 (with gate loc_842c) when a sprite object overlaps the frog
export const loc_800d = 0x800d; // [seen] object-animation state block base; seedObjectAnimationState seeds 10 stride-2 cells (0x800d-0x801f) from a fixed table at board init
export const loc_8014 = 0x8014; // [seen] free-running position counter (rises +1/frame, wraps 0xff->0x00, independent of the frog); sprite-object motion arms drift each object toward it -- NOT the frog X (frog X is 0x8044/0x8047; grounding overturned the earlier reading)
export const loc_8019 = 0x8019; // [seen] object/animation-state cell in the 0x800d-0x801f block; renderMode3ScoreRankingScreen seeds it =3 at the mode-3 ranking-screen draw (a work cell, not a screen-id)
export const loc_801f = 0x801f; // [seen] top of the 0x800d-0x801f object/animation work block; base of renderMode3ScoreRankingScreen's 5-cell 4-strided clear (0x801f/8023/8027/802b/802f) that wipes leftover attract-demo objects off the ranking page
export const loc_8021 = 0x8021; // [seen] object-animation cell block base; seedObjectAnimationState seeds 14 stride-2 cells (0x8021-0x803b) from a fixed table at board init -- renderMode4PointTablePhase writes a mode-4 sprite CODE (=3) into this same object table [seen]
export const loc_8040 = 0x8040; // [seen,poked] fly sprite X position / base of the four-cell block armHomeGoalSprite arms; driveFlyPatrol writes path base loc_811c + path-table offset, armHomeGoalSprite arms it with the lead byte + fixed tail 25,3,16 (sibling loc_27de zeroes 0x8040-0x8043)
export const loc_8041 = 0x8041; // [code] fly sprite code; driveFlyPatrol sets it at the timer midpoint (33 or flipped 0xA1) and to the turn sprite (30) at an endpoint
export const loc_805c = 0x805c; // [code] base of the 4-byte timer/counter block clearFourByteCounterBlock clears to zero (0x805C-0x805F)
export const loc_8101 = 0x8101; // [seen] animateTwoPairFigure idle-clears the figure-animation phase when this is 0, else runs the animation
export const loc_8107 = 0x8107; // [code] scroll edge flag; stampScrollRevealColumn clears it on the 128/176 arm and sets it to 1 on the 160 arm
export const loc_8108 = 0x8108; // [code] scroll wrap-latch; blitScrollBand raises it to 1 on the mode-80 phase and clears it on the mode-48/96 phases
export const loc_8110 = 0x8110; // [seen] scroll-phase selector; stampScrollRevealColumn dispatches on it (80/208, 128/176, 160) to pick the stamp table
export const loc_8111 = 0x8111; // [seen] scroll-phase mode; blitScrollBand dispatches the source-row choice on it (0/112->A, 48/96->B, 80->C), loc_2005 steps it by 2
export const loc_8118 = 0x8118; // [code] frog-anim blit trigger; blitFrogAnimColumnOnTrigger blits the tile pair when non-zero then clears it to 0, else returns at once
export const loc_8119 = 0x8119; // [seen] scroll row-span shadow; blitScrollBand stores row count - 1 here at exit
export const loc_811a = 0x811a; // [seen] scroll-object row-count mirror; stampScrollRevealColumn writes (row-count field - 1) here before returning
export const loc_811c = 0x811c; // [code] fly path X base; driveFlyPatrol adds it to the path-table offset to form the sprite X at loc_8040
export const loc_8120 = 0x8120; // [code] home-bay slot cursor mirror; stampHomeBayGatorEmerging writes the slot value here, stampHomeBayGatorFull reads it as its 1..5 home-slot index, stampHomeBaySlot clears it with loc_8121
export const loc_8121 = 0x8121; // [code] pending home-bay slot selector (1..5); stampHomeBayFly/stampHomeBayGatorFull write it, stampHomeBaySlot dispatches on it to pick a bay and clears it after stamping
export const loc_8123 = 0x8123; // [code] home-bay slot cursor (mod 6); loc_23eb increments-and-wraps it, stampHomeBayFly/stampHomeBayGatorEmerging read it as the 1..5 home-slot index and mirror it (grounded; not a river/scroll phase)
export const loc_8145 = 0x8145; // [seen,poked] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_8146 = 0x8146; // [seen,poked] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_8147 = 0x8147; // [seen,poked] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_814e = 0x814e; // [seen,poked] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_814f = 0x814f; // [seen,poked] sprite-frame busy latch 1; advanceAnimationFrameBuffer returns without stepping while non-zero, animateTwoPairFigure reads it as a busy gate that must be 0, clearTwoPlayerFrameCells zeroes it in play-mode 2
export const loc_8150 = 0x8150; // [seen] animateTwoPairFigure gates its step on bit0 of this cell
export const loc_815b = 0x815b; // [code] sprite-frame busy latch 2; advanceAnimationFrameBuffer returns without stepping while it is non-zero
export const loc_819b = 0x819b; // [seen,poked] animation frame buffer; advanceAnimationFrameBuffer copies 11 bytes of the current frame source into it
export const loc_81b1 = 0x81b1; // [seen] scroll-copy column stride; blitScrollTileGrid advances the destination by this between columns
export const loc_81b3 = 0x81b3; // [code] animation frame index; advanceAnimationFrameBuffer advances it into the loc_1841 pointer table, wrapping to 0 at index 10
export const loc_81b4 = 0x81b4; // [code] animation frame timer; advanceAnimationFrameBuffer ticks it down each pass and reloads it to 21 when it reaches 0
export const loc_825e = 0x825e; // [seen,poked] home-bay-1 occupancy gate, primary bank (used when (0x83FD)==1); the home-bay stampers skip that bay when non-zero
export const loc_825f = 0x825f; // [seen,poked] home-bay-2 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8260 = 0x8260; // [seen,poked] home-bay-3 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8261 = 0x8261; // [seen,poked] home-bay-4 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8262 = 0x8262; // [seen,poked] home-bay-5 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8263 = 0x8263; // [code] home-bay-1 occupancy gate, alternate bank (used when (0x83FD)!=1); skipped when non-zero
export const loc_8264 = 0x8264; // [code] home-bay-2 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_8265 = 0x8265; // [code] home-bay-3 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_8266 = 0x8266; // [code] home-bay-4 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_8267 = 0x8267; // [code] home-bay-5 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_826a = 0x826a; // [code] gated countdown counter; tickGatedCountdown decrements it and, when it reaches 0, clears the enable flag loc_826c
export const loc_826c = 0x826c; // [code] countdown enable flag; tickGatedCountdown returns early while it is 0 and clears it to 0 once loc_826a reaches 0
export const loc_8270 = 0x8270; // [code] active player's lane-parameter block (33 bytes); loadActivePlayerLaneParams copies the selected difficulty block into here
export const loc_8273 = 0x8273; // [seen] scroll-object block base; stampScrollRevealColumn reads its row/column/row-count fields (+0/+1/+2) to build the VRAM stamp address
export const loc_827c = 0x827c; // [code] scroll-band descriptor base; blitScrollBand reads column (+0), unit count (+1), row count (+2) to place the video band
export const loc_8293 = 0x8293; // [code] player 1 difficulty index; loadActivePlayerLaneParams reads it to index the lane-parameter pointer table
export const loc_8294 = 0x8294; // [code] player 2 difficulty index; loadActivePlayerLaneParams reads it when the active player (0x83FD) is not 1
export const loc_8340 = 0x8340; // [code] arm cell armHomeGoalSprite sets to 160 alongside the four-cell block
export const loc_833d = 0x833d; // [code] fly travel direction/step byte; bit7 = direction (also the sprite flip bit), low 7 bits = path-table step index, walked by driveFlyPatrol
export const loc_833e = 0x833e; // [code] fly tongue/attack timer; driveFlyPatrol counts it down each frame and reloads it to 60 at a path endpoint or hold
export const loc_833f = 0x833f; // [code] figure-animation phase animateTwoPairFigure increments; blits at 64 and 112, clears it at 112 and whenever idle
// ROM tables read by the batch-2 routines
export const loc_13ef = 0x13ef; // [code] scroll-copy destination-base pointer (ROM); blitScrollTileGrid loads the VRAM destination base from here (0xa808)
export const loc_1413 = 0x1413; // [code] ROM tile-pair pattern source read by blitFrogAnimColumnOnTrigger, two bytes per row for 8 rows
export const loc_1841 = 0x1841; // [code] ROM table of 16-bit frame-source pointers; advanceAnimationFrameBuffer reads entry (loc_81b3) to find the 11-byte frame to copy
export const loc_2190 = 0x2190; // [code] scroll stamp table (ROM) for the 80/208 phase arm; stampScrollRevealColumn copies its bytes into VRAM
export const loc_2194 = 0x2194; // [code] scroll stamp table (ROM) for the 128/176 phase arm; stampScrollRevealColumn copies its bytes into VRAM
export const loc_2198 = 0x2198; // [code] scroll stamp table (ROM) for the 160 phase arm; stampScrollRevealColumn copies its bytes into VRAM
export const loc_2231 = 0x2231; // [code] scroll source tile row A (4 bytes); blitScrollBand blits it on modes 0 and 112
export const loc_2235 = 0x2235; // [code] scroll source tile row B (4 bytes); blitScrollBand blits it on modes 48 and 96
export const loc_2239 = 0x2239; // [code] scroll source tile row C (4 bytes); blitScrollBand blits it on mode 80
export const loc_2260 = 0x2260; // [code] lane-parameter pointer table (little-endian block pointers); loadActivePlayerLaneParams indexes it by 2*difficulty to reach the selected block
export const loc_279f = 0x279f; // [code] ROM base of the fly X-offset path table indexed by driveFlyPatrol (entry value 0 = endpoint/reverse, 1 = hold, >=2 = X offset)
export const loc_2cd5 = 0x2cd5; // [code] phase-tile table (ROM); animateSpriteObjectFrame indexes it by the stepped phase for the sprite tile the animation arm stages
// IO + VRAM bases the batch-2 routines touch
export const loc_8800 = 0x8800; // [code] watchdog reset_r port; spinWatchdogSettleDelay reads it once per settle pass to keep the dog fed (the read count is the io live-out)
export const loc_a800 = 0xa800; // [seen] VRAM base; computeVramColumnIndex computes HL minus this (less the incoming borrow) as the render offset it folds into the column index returned in C
export const loc_a806 = 0xa806; // [seen,poked] VRAM destination base for blitFrogAnimColumnOnTrigger's 8-row tile-pair blit (two bytes per row, dest steps +32 per row)
export const loc_a80e = 0xa80e; // [code] scroll-band video-RAM base; blitScrollBand offsets it by stride*rowSteps to reach the band's top cell
export const loc_a846 = 0xa846; // [seen,poked] first tile cell of the two-pair figure animateTwoPairFigure blits (second pair one row / +32 below at 0xA866)

// ── batch-3 cells: status/frog/scroll renders, sprite-object arms, attract demo, intro/score, sound queue ──
export const loc_8000 = 0x8000; // [seen] work-RAM page-0x80 base; loc_2c13 reads the placement seed at 0x8000|low, loc_2bab/loc_2b93 read a per-object target/table byte at 0x8000|(IX+0x0b) (loc_0faf reads the CELL 0x8000 as the frog-anim index -- page-base vs cell use, naming pass to reconcile)
export const loc_8007 = 0x8007; // [seen] object-ready flag; loc_1952 sets it to 1 after the frog render (with 0x8009/0x800b)
export const loc_8009 = 0x8009; // [seen] object-ready flag; loc_1952 sets it to 1 after the frog render
export const loc_800b = 0x800b; // [seen] object-ready flag; loc_1952 sets it to 1 after the frog render
export const loc_800f = 0x800f; // [seen] demo scroll register; loc_0de0 writes 3 here (paired with loc_800d) each dwell tick
export const loc_801b = 0x801b; // [seen] intro counter; loc_2d88 seeds it to 5 during the mode-2 setup -- ALSO a mode-4 sprite-record CODE cell renderMode4PointTablePhase seeds =3 (-> OBJRAM); shared work RAM, per-mode use [seen]
export const loc_8023 = 0x8023; // [seen] screen/mode state byte; blitPlayerSelectPrompt sets it to 3 on the two-player prompt arm -- ALSO a mode-4 sprite-record ATTR/Y field renderMode4PointTablePhase seeds =6 (-> OBJRAM); shared, per-mode use [seen]
export const loc_802b = 0x802b; // [seen] intro counter; loc_2d88 seeds it to 3 (also the store target of loc_0c4a) -- ALSO re-stamped =4 by placeScoreRankMarkers on the mode-3 ranking screen (rank-marker tile) [seen]
export const loc_802f = 0x802f; // [code] lane low-bound selector; loc_12e4 branches on it (<128 vs >=128) to pick the lane low-bound offset (12 vs 3) added to the frog base FROG_X -- ALSO a mode-4 sprite-record ATTR/Y field renderMode4PointTablePhase seeds =6 (-> OBJRAM 0xB02f); shared cell, per-mode use [seen]
export const loc_8058 = 0x8058; // [seen,poked] shared 4-byte sprite-object block; loc_2bab clears it (with the 16-byte IX struct) when an object reaches its target and despawns
export const loc_8109 = 0x8109; // [seen] loc_12e4 scans it as a lane object list (count byte then object X positions, band width 31); loc_1058 arms both plot cursors (IX/IY) to it for the frog-anim render loop
export const loc_8112 = 0x8112; // [seen] lane object list (count byte then object X positions), band width 92; loc_12e4 scans it for an object in the frog's move band
export const loc_811b = 0x811b; // [seen] lane object list (count byte then object X positions), band width 44; loc_12e4 scans it for an object in the frog's move band
export const loc_8124 = 0x8124; // [seen] lane object list (count byte then object X positions), band width 47; loc_12e4 scans it for an object in the frog's move band
export const loc_8134 = 0x8134; // [seen,poked] collision sub-flag; loc_27b3 zeroes it before falling through to the clear helper (loc_27bc)
export const loc_8135 = 0x8135; // [seen,poked] collision-latched flag; loc_27b3 returns early when 0, else clears it via the clear helper (also read by loc_26a6)
export const loc_8136 = 0x8136; // [seen] loc_12e4 scans it as a lane object list (band width 34); loc_10f8 uses it as the frog-anim arm-6 plot-cursor base
export const loc_813f = 0x813f; // [seen] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_8148 = 0x8148; // [seen] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_8151 = 0x8151; // [seen] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_815a = 0x815a; // [seen] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const RIVER_LANE0_DIR = 0x8248; // [seen] river lane-0 direction flag; loc_23b7 tails to the lane-0 commit handler when set, else clears the lane-0 mirror RIVER_LANE0_ARRIVAL
export const loc_8249 = 0x8249; // [code] river lane-1 direction flag; loc_23b7 tails to the lane-1 commit handler when set, else clears the lane-1 mirror loc_824d
export const RIVER_LANE2_DIR = 0x824a; // [seen] river lane-2 direction flag; loc_23b7 tails to the lane-2 commit handler when set, else clears the lane-2 mirror RIVER_LANE2_ARRIVAL
export const loc_824b = 0x824b; // [code] river lane-3 direction flag; loc_23b7 tails to the lane-3 commit handler when set, else clears the lane-3 mirror RIVER_LANE3_ARRIVAL
export const RIVER_LANE0_ARRIVAL = 0x824c; // [seen] river lane-0 arrival mirror flag; loc_23b7 clears it when the lane-0 direction flag RIVER_LANE0_DIR is clear
export const loc_824d = 0x824d; // [code] river lane-1 arrival mirror flag; loc_23b7 clears it when the lane-1 direction flag loc_8249 is clear
export const RIVER_LANE2_ARRIVAL = 0x824e; // [seen] river lane-2 arrival mirror flag; loc_23b7 clears it when the lane-2 direction flag RIVER_LANE2_DIR is clear
export const RIVER_LANE3_ARRIVAL = 0x824f; // [seen] river lane-3 arrival mirror flag; loc_23b7 clears it when the lane-3 direction flag loc_824b is clear
export const loc_825c = 0x825c; // [seen,poked] player-1 slot byte; loc_0534 zeros it before the cold-start pre-clear (loc_048f's P1-init later sets it to 1)
export const loc_826e = 0x826e; // [seen] scroll phase counter; loc_2005 steps it each NMI and runs a lane block at 16/32/48, clearing it to 0 at phase 48
export const loc_8274 = 0x8274; // [code] scroll object A descriptor +1 (row count); loc_2005 loads it as the grid copy engine's B row-count at phase 16/32/48
export const loc_827d = 0x827d; // [code] scroll object B descriptor +1 (row count); loc_2005 loads it as the band copy entry's B row-count
export const loc_8282 = 0x8282; // [seen] frog-anim arm-6 sprite triple code byte; loc_10f8 reads it into A and stashes it at loc_81b1 for the render loop
export const loc_8283 = 0x8283; // [code] frog-anim arm-6 row count; loc_10f8 loads it as the render loop's B (rows per pass)
export const loc_8284 = 0x8284; // [code] frog-anim arm-6 outer-pass count; loc_10f8 loads it as the render loop's C (passes, 0=>256)
export const loc_829b = 0x829b; // [seen] intro counter; loc_2d88 zeroes it during the mode-2 setup
export const loc_8300 = 0x8300; // [seen] pending sound-command count; loc_07ac returns when it is 0, else decrements it, issues the command at loc_8300+1, and shifts loc_8300+2.. down one slot
export const loc_83bb = 0x83bb; // [code] attract sequencer state cell; loc_0de0 clears it to 0 after placing the last cell
export const loc_83bc = 0x83bc; // [seen] attract demo dwell counter; loc_0de0 decrements it and reloads 32 on expiry
export const loc_83bf = 0x83bf; // [code] attract sequencer phase byte; loc_0de0 clears it to 0 after placing the last cell
export const loc_83d7 = 0x83d7; // [seen] attract demo phase counter (1..7); loc_0de0 dispatches the cell arm on it, decrements it, and reloads 7 when drained -- ALSO the mode-4 sub-phase counter (reload 5, counts 4..0) for renderMode4PointTablePhase; same cell, mode-dependent reload [seen]
export const loc_83d8 = 0x83d8; // [seen] mode-2 intro state cell; loc_2d88 stores 0xff here at the intro setup -- ALSO the shared attract frame-pacing/drawn-state gate loc_0d11 checks; renderMode4PointTablePhase parks it 0xC0 idle / 0x80 drawn [seen]
export const loc_83dc = 0x83dc; // [seen] 16-bit scroll/state cell; loc_0aba seeds it to 0x3C20 during the one-time layout setup
export const loc_83de = 0x83de; // [seen] scroll/state cell; loc_0aba seeds it to 0x60 during the one-time layout setup
export const loc_83e0 = 0x83e0; // [seen] display-field cell; loc_0aba zeroes it during the one-time layout setup
export const PLAYER2_SCORE = 0x83eb; // [seen,poked] player-2 score word (16-bit); loc_0f69 reads it as one of the two players' scores to rank and pack
export const PLAYER1_SCORE = 0x83ed; // [seen,poked] player-1 score word (16-bit); loc_0f69 reads it as one of the two players' scores to rank and pack, renderScoreHeader draws it in the 1-UP column (swapped from the earlier high-score reading -- 0x83ef is the high score)
export const loc_83fb = 0x83fb; // [seen] two-byte score display / intro digit field (0x83fb low, 0x83fc high); loc_0c3d reads the pair to draw the two intro digits, loc_0f69 stores the larger word's rank code at 0x83fb and the smaller's at 0x83fc
export const loc_842f = 0x842f; // [seen,poked] home-column state cell; loc_0670 clears it to 0 before tailing into the extra-life award
// ROM tables/sources read by the batch-3 routines
export const loc_130b = 0x130b; // [code] arm-pointer table (ROM); loc_12e4 indexes it by 2*(high nibble of frogX+15) to select the lane-scan arm
export const loc_13f9 = 0x13f9; // [code] frog-anim arm-6 render destination pointer (ROM word); loc_10f8 loads HL from it as the render loop's VRAM base
export const loc_1423 = 0x1423; // [code] ROM tile source; loc_2005 passes it in DE as the phase-16 scroll-grid source (object A), loc_1058 loads it as the frog-anim tile source (DE) and stashes it at loc_8001
export const loc_142b = 0x142b; // [code] ROM scroll-grid source for phase 32 (object A); loc_2005 passes it in DE to the copy engine
export const loc_1433 = 0x1433; // [code] ROM scroll-grid source for phase 48 (object A); loc_2005 passes it in DE to the copy engine
export const loc_145f = 0x145f; // [code] ROM scroll-band source for phase 16 (object B); loc_2005 passes it in DE to the band copy entry
export const loc_1473 = 0x1473; // [code] ROM scroll-band source for phase 32 (object B); loc_2005 passes it in DE to the band copy entry
export const loc_1487 = 0x1487; // [code] ROM scroll-band source for phase 48 (object B); loc_2005 passes it in DE to the band copy entry
export const loc_149f = 0x149f; // [code] frog-anim arm-6 tile source base (ROM); loc_10f8 sets DE to it and stashes it at loc_8001 for the render loop's row copy
export const loc_19f6 = 0x19f6; // [code] ROM 4-byte frog tile group (column set 1) read by loc_1952
export const loc_19fa = 0x19fa; // [code] ROM 4-byte frog tile group (column set 2) read by loc_1952
export const loc_19fe = 0x19fe; // [code] ROM 4-byte frog tile group (column set 3) read by loc_1952
export const loc_2cd9 = 0x2cd9; // [seen] object-state -> sprite attribute table (ROM); loc_2bfb indexes it by the object state byte (ix+6), ORs (ix+5), and writes the result to the IY slot (iy+1)
export const loc_2cdc = 0x2cdc; // [code] spawn pointer table (ROM); loc_2c13 reads a little-endian pointer at 2*variant, then derives the two placement spans
export const loc_2ce6 = 0x2ce6; // [seen] spawn variant table (ROM); loc_2c13 indexes it by 2*variant for a subtract-loop span (even byte) and the low byte of a page-0x80 seed cell (odd byte, stored to ix+0x0b)
export const loc_2f0e = 0x2f0e; // [code] ROM source of the 9-tile string loc_0f59 blits via rst 0x28
export const loc_2f12 = 0x2f12; // [code] ROM 5-tile strip source; loc_085b's second blit copies from here
export const loc_2f5c = 0x2f5c; // [code] ROM tile-strip source for loc_2d88's 11-tile main title blit
export const loc_2f6e = 0x2f6e; // [code] ROM 4-tile strip source; loc_0aba blits it up the loc_a8bf column (rst 0x28), loc_085b's first blit copies it up the loc_aa51 column
export const loc_2f73 = 0x2f73; // [code] ROM tile-strip source blitted by loc_2d88 (4 tiles) on the time<10 arm
export const loc_2f88 = 0x2f88; // [code] ROM tile-source base for blitPlayerSelectPrompt's first prompt blit (used by both arms)
export const loc_2f92 = 0x2f92; // [code] ROM tile-strip source blitted by loc_2d88 (7 tiles) on the time<10 arm
export const loc_2f93 = 0x2f93; // [code] ROM tile-source for blitPlayerSelectPrompt's one-credit second prompt blit
export const loc_2fae = 0x2fae; // [code] ROM tile-strip source blitted by loc_2d88 (7 tiles) on the time<10 arm
// VRAM bases the batch-3 routines touch
export const loc_a843 = 0xa843; // [seen] frog-render VRAM column base (group 1); loc_1952 copies four tiles from loc_19f6 down it, 5 columns +0x40 apart
export const loc_a844 = 0xa844; // [seen] frog-render box top-left VRAM corner; loc_1952 writes corner tiles 65,66 here and 69,70 at +0x360
export const loc_a850 = 0xa850; // [seen,poked] VRAM status-row base; loc_0f59 clears it via the 4-tile-group column blit
export const loc_a85c = 0xa85c; // [code] frog-render home-marker string VRAM base; loc_1952 loads HL with it before the tile-string blit
export const loc_a8a4 = 0xa8a4; // [code] frog-render VRAM column base (group 2); loc_1952 copies four tiles from loc_19fa down it, 4 columns
export const loc_a8a5 = 0xa8a5; // [code] frog-render VRAM column base (group 3); loc_1952 copies four tiles from loc_19fe down it, 4 columns
export const loc_a8bf = 0xa8bf; // [seen] VRAM cell loc_0aba blits a 4-tile strip up into (rst 0x28 dest) during the one-time layout setup
export const loc_a8c3 = 0xa8c3; // [seen] frog-render banner VRAM column base; loc_1952 stamps tile 71 four times stepping +0x20 then +0xa0
export const loc_a8c6 = 0xa8c6; // [seen] attract demo cell VRAM corner base (phase 1); loc_0de0 stamps a 2x2 tile block at base + 96*(phase-1)
export const loc_a8df = 0xa8df; // [code] VRAM cell loc_0aba fills 15 tile rows of tile 12 down from (+32/row) during the one-time layout setup
export const loc_aa51 = 0xaa51; // [code] no-more-frogs VRAM column start; loc_085b blits the 4-tile then 5-tile strips up from here
export const loc_aa70 = 0xaa70; // [seen,poked] VRAM destination loc_0f59 stamps the 9-tile string into (rst 0x28 dest)
export const loc_aa8d = 0xaa8d; // [seen] VRAM tilemap column base for loc_2d88's main title strip
export const loc_aaf1 = 0xaaf1; // [seen] VRAM column base for blitPlayerSelectPrompt's one-credit "ONE PLAYER ONLY" prompt
export const loc_ab11 = 0xab11; // [seen] VRAM column base for blitPlayerSelectPrompt's "ONE OR TWO PLAYERS" prompt
export const loc_ab15 = 0xab15; // [code] VRAM tilemap base for loc_2d88's score-digit draw on the time<10 arm

// ── batch-5 cells: the mode-4 attract point-table (renderMode4PointTablePhase) VRAM columns, ROM tile-strip sources, and sprite records ──
export const loc_ab6d = 0xab6d; // [seen] phase-4 point-table points-value VRAM base; renderMode4PointTablePhase writes the packed-BCD points byte here then blits the strip up the column
export const loc_ab70 = 0xab70; // [seen] phase-3 point-table points-value VRAM base; renderMode4PointTablePhase writes the packed-BCD points byte here
export const loc_ab71 = 0xab71; // [code] phase-3 point-table second VRAM column base; renderMode4PointTablePhase stamps a 19-tile strip up from here
export const loc_ab73 = 0xab73; // [seen] phase-2 point-table points-value VRAM base; renderMode4PointTablePhase writes the packed-BCD points word here
export const loc_ab74 = 0xab74; // [seen] phase-2 point-table second VRAM column base; renderMode4PointTablePhase stamps a 15-tile strip up from here
export const loc_ab76 = 0xab76; // [seen] phase-1 point-table VRAM column base; renderMode4PointTablePhase stamps a 10-tile strip up from here
export const loc_ab77 = 0xab77; // [seen] phase-1 point-table points-value VRAM base; renderMode4PointTablePhase writes the packed-BCD points byte here then continues the strips up the column
export const loc_2ed1 = 0x2ed1; // [code] ROM tile-strip source for renderMode4PointTablePhase's phase-4 point-table column
export const loc_2ee5 = 0x2ee5; // [seen] ROM 13-tile "SCORE RANKING" header strip source; renderMode3ScoreRankingScreen blits it to VRAM 0xaaac as the mode-3 ranking-screen header
export const loc_2f17 = 0x2f17; // [code] ROM tile-strip source for renderMode4PointTablePhase's phase-3 point-table second column
export const loc_2f2a = 0x2f2a; // [code] ROM tile-strip source for renderMode4PointTablePhase's phase-2 point-table second column
export const loc_2f39 = 0x2f39; // [code] ROM tile-strip source for renderMode4PointTablePhase's phase-2 point-table column
export const loc_2f43 = 0x2f43; // [code] ROM tile-strip source for renderMode4PointTablePhase's phase-3 point-table column
export const loc_2f9e = 0x2f9e; // [code] ROM tile-strip source for renderMode4PointTablePhase's phase-1 point-table column
export const loc_2fba = 0x2fba; // [seen] ROM 4-tile " PTS" suffix strip source, blitted after a packed-BCD points value; SHARED -- renderMode4PointTablePhase uses it per point-table phase (1-4), renderMode3ScoreRankingScreen uses it after each ranking-row score
export const loc_801d = 0x801d; // [seen] mode-4 point-table sprite-record ATTR/Y field; renderMode4PointTablePhase phase 4 seeds it 6 (-> OBJRAM 0xB01d)
export const loc_8027 = 0x8027; // [seen] mode-4 point-table sprite-record CODE field; renderMode4PointTablePhase phase 4 seeds it 3 (-> OBJRAM 0xB027)
export const loc_8029 = 0x8029; // [seen] mode-4 point-table sprite-record ATTR/Y field; renderMode4PointTablePhase phase 4 seeds it 6 (-> OBJRAM 0xB029)
export const loc_802d = 0x802d; // [seen] mode-4 point-table sprite-record CODE field; renderMode4PointTablePhase phase 4 seeds it 3 (-> OBJRAM 0xB02d)

// ── batch-7 cells: score-header + credit-line readouts (renderScoreHeader/renderCreditLine/initNewGameScoreAndTimers) ──
export const UP_LABEL_STRIP = 0x2edf; // [seen] ROM 3-tile "-UP" label strip; renderScoreHeader shares it for both the 1-UP and 2-UP columns
export const HI_SCORE_LABEL_STRIP = 0x2ee2; // [seen] ROM 8-tile "HI-SCORE" label strip; renderScoreHeader blits it above the high-score column
export const CREDIT_LABEL_STRIP = 0x2f68; // [seen] ROM 6-tile "CREDIT" label strip; renderCreditLine blits it as the credit-line label
export const NUM_PLAYERS = 0x8370; // [seen] number-of-players; renderScoreHeader draws the 2-UP column only when it is not 1 (==1 -> single player)
export const loc_83b4 = 0x83b4; // [seen] renderCreditLine one-time credit-column-clear latch; set to 1 on the first call after clearing the credit column, then checked to skip the clear thereafter
export const PLAYER1_EXTRA_LIFE_AWARDED = 0x83e7; // [seen] player-1 extra-life-awarded flag (0x83e7 P1 / 0x83e8 P2 pair); loc_08e0 sets it when the extra life is awarded, initNewGameScoreAndTimers clears the pair at new-game start
export const HIGH_SCORE = 0x83ef; // [seen] high-score word (16-bit), entry[0] of the ranking table read at 0x83ef+2r; renderScoreHeader draws it in the HI-SCORE column, initNewGameScoreAndTimers does NOT touch it

export const ROUTINES = {
  0x0341: {
    name: "drainForegroundThenYieldEachVblank",
    role: "the foreground main loop as a vblank coroutine: drain the idempotent foreground to its per-frame fixed point, then yield so the engine fires the NMI at the pace tail. Each drain runs the loop body twice — one pass is the steady-state fixed point, the second settles the life-restart cascade and is a no-op otherwise",
    cert: "code",
  },
  0x0368: {
    name: "endForegroundPassAtPaceTail",
    role: "the pace-tail re-entry, 0x0368, reached as `jp 0x0368` by every branch of the translated in-play tree once it has finished a frame's foreground. As a coroutine it runs nothing and hands control back to the driver, so the driver — not a busy-delay loop — decides when the pass is done and the frame yields",
    cert: "code",
  },
  0x0766: {
    name: "fillTilemapBlock28x32",
    role: "fill a 28-wide by 32-tall tilemap block with tile 16 from a fixed base, skipping 4 cells between rows; no live-in, memory-only live-out",
    cert: "seen",
  },
  0x0028: { name: "copyRunUpTileColumn", role: "copy a run of bytes up a tilemap column (destination steps back one 32-cell row per byte, source advances); count 0 copies 256; leaves both pointers advanced for the caller", cert: "seen" },
  0x0292: { name: "loc_0292", role: "[seen] frog-spawn/ready delay: decrement the countdown word at 0x829D (seeded 0x20 at frog start) to zero and clear 0x83AE; loc_0066 spawns the frog when it reaches 0 -- NOT the time bar (that reads 0x83E5/E6). Grounded role, name deferred; memory-only live-out", cert: "seen" },
  0x05d3: { name: "loc_05d3", role: "[seen,poked] per-player board-completion re-arm (all five frogs home): 0x826D/0x825A/0x83CD=1, 0x825B/0x83EA=0, 0x8297=0xFF, 0x8298=0x40 (0x8298 then times the board-complete animation); reached for whichever player filled all homes, not attract/2P-specific. Grounded role, name deferred; memory-only live-out", cert: "seen" },
  0x064b: { name: "clearObjectBlocksAndMirrorToObjRam", role: "clear the demo work-RAM object block, mirror it into OBJRAM, then clear a second work-RAM block; no live-in, memory-only live-out", cert: "seen" },
  0x0695: { name: "fillTwoByTwoTileBlock", role: "stamp a 2x2 marker block (base, +1, +32, +33) with tile 16 at the caller's base; memory-only live-out", cert: "seen" },
  0x0726: { name: "swapOutActivePlayerPages", role: "swap the active player's work pages OUT — bank the two live pages, restore the other player's from bank, write the OBJRAM per-column attribute shadow 0x803f=1, and one-shot latch the init guard; memory-only live-out", cert: "seen" },
  0x0779: { name: "fillTenCellRun", role: "fill 10 consecutive cells with tile 16 from the caller's base; leaves the pointer past the run and the counter drained to 0, both read back by the caller", cert: "seen" },
  0x0781: { name: "fillTilemapBlock22x32", role: "fill a 22-wide by 32-tall tilemap block with tile 16 from base 0xa808, skipping 10 cells between rows; no live-in, memory-only live-out", cert: "seen" },
  0x0794: { name: "issueSoundCommand", role: "issue one sound command: latch A to PPI1.A, pulse PPI1.B bit-3 for the audio /INT edge; live-in A, IO-only live-out", cert: "seen" },
  0x07ce: { name: "raiseTwoPlayerStartFlag", role: "2-player start-flag helper: set (0x825b)=1 unless (0x826d)==0; no register live-in, memory-only live-out", cert: "seen" },
  0x0804: { name: "activateFrogObject", role: "[seen] activate the frog object (mark 0x8044 active, clear 0x8045/0x8047); the two-player timer-seed branch (0x83D2/0x83DA<-0x40) never fired (only called with PLAY_FLAG=0) -- code-level, not refuted; memory-only live-out", cert: "seen" },
  0x0822: { name: "handOffToOtherPlayer", role: "hand play to the other player (toggle player bits, load that player's lives, reset two per-player cells) and, when cocktail is enabled, toggle the screen-flip latch to the flip IO ports; one-player early return; memory-only live-out", cert: "seen" },
  0x09aa: { name: "resetFrogObject", role: "frog-object reset: write the four object bytes, clear four state cells, set the ready flag to 1; no live-in, live-out is memory + A (the ready-flag value, consumed by the render caller)", cert: "seen" },
  0x09db: { name: "renderFilledHomeSlots", role: "home-marker render: for each non-zero entry in the five-slot occupancy list at HL, stamp the four frog-home tiles at that slot's fixed VRAM base; HL live-in, memory-only live-out", cert: "seen" },
  0x0a16: { name: "renderTimeBar", role: "[seen] render the col30 time indicator: draw (active time byte 0x83E5/P1 or 0x83E6/P2) copies of tile 0x4D up the column at 0xABBE, capped, early-out when inactive. The prominent draining green time bar (col28/29, tiles 0x48-0x4B) is separate, unlifted code; memory-only live-out", cert: "seen" },
  0x0a48: { name: "renderLivesRow", role: "render the lives/level row: draw min((0x83B7),0x0F) copies of tile 0x4C down the column at 0xA87E stepping +0x20; memory-only live-out", cert: "seen" },
  0x0a5f: { name: "awardExtraLife", role: "[seen,poked] award an extra life on BOARD COMPLETION (via loc_06A2 A==0x10 all-homes -> loc_0670): clear 0x83CC, bump the active player's life count (0x83B8/0x83B9), mirror to 0x83B7, and unless the marker count is 16 stamp tile 0x4C into the lives row (16 caps the MARKER, not the count). Not a score threshold; memory-only live-out", cert: "seen" },
  0x0a84: { name: "insertHighScoreEntry", role: "[seen] insert a 16-bit key (D,E) into the 5-entry descending HIGH-SCORE table ending at 0x83F2 (top slot; RAM 0x83F1-0x83FA == the attract SCORE RANKING), LDDR-shifting the tail down; live-out memory + A (slot-index code, 0 when not inserted). Live insert not observed; table identity dispositive", cert: "seen" },
  0x0aee: { name: "nextSpawnRandomByte", role: "[seen,poked] spawn PRNG step: decrement the 0x8400 ring cursor (wrap 0->0x1F) and XOR-fold (0x8400+cursor) into (0x8400+j), j=cursor+0x0D; callers loc_2A6A/loc_2C13 (object arms, gated 0x83B7>=3) consume A to place object spawns -- a PRNG, not a checksum; live-out memory + A", cert: "seen" },
  0x0ba9: { name: "writeScoreDigitStepUp", role: "write one BCD digit (A low nibble) at (HL), then step HL up one 32-cell tilemap row (16-bit borrow); memory + HL live-out (loc_0ba0 chains two calls reusing the stepped HL)", cert: "seen" },
  0x0c4a: { name: "loc_0c4a", role: "[seen] store a byte into work RAM: write E to work-RAM page 0x80 at 0x80(D-C) (dest 0x802B observed), skip when C==0 -- NOT a tilemap tile stamp (overturned from the intro-digit reading); live-in D/C/E, memory-only live-out", cert: "seen" },
  0x0e74: { name: "setAttractIdleMode", role: "force the game mode (GAME_MODE 0x83D6) to 5 (attract-idle), the credits-present tail of the attract sequencer; memory-only live-out", cert: "seen" },
  0x0f8c: { name: "blitFrogAnimColumnOnTrigger", role: "frog-anim pre-helper: when the trigger cell is set, blit an 8-row two-byte-per-row tile pair from a fixed pattern source down a VRAM column (+32 per row) then clear the trigger; a clear trigger returns at once; memory-only live-out", cert: "seen" },
  0x1048: { name: "spinWatchdogSettleDelay", role: "power-on settle delay: feed the watchdog once per pass across a long count; the counter spin is pure time (collapsed away), the watchdog read count is the io live-out, memory unchanged", cert: "seen" },
  0x1198: { name: "computeVramColumnIndex", role: "coord/column compute for the tile render loop: from HL's distance to the VRAM base (less incoming borrow) fold one probed H bit and the shifted top column bits across 6 passes plus 3 final rotates into an accumulator; live-in HL+carry, live-out register C", cert: "code" },
  0x1802: { name: "advanceAnimationFrameBuffer", role: "step the frame-cell animation: return early while either busy latch (0x814f/0x815b) is set; else tick the frame timer (0x81b4) down, and when it reaches 0 reload it to 21, advance the frame index (0x81b3) wrapping to 0 at 10, and copy 11 bytes of the indexed frame (via the 0x1841 pointer table) into the 0x819b buffer; memory-only live-out", cert: "seen" },
  0x19e2: { name: "blitFourTileGroupColumn", role: "blit a 14-row VRAM column of the 4-tile group (tiles 72/73 across the top of each row pair, 74/75 across the row below) from the caller-supplied HL base, advancing 64 bytes per pair; HL live-in, memory-only live-out", cert: "seen" },
  0x1a02: { name: "seedObjectAnimationState", role: "seed the object-animation state at board init: fill 14 stride-2 cells from base 0x8021 and 10 stride-2 cells from base 0x800d with fixed value tables (cell i takes seed i); no live-in, memory-only live-out", cert: "seen" },
  0x1fc7: { name: "tickGatedCountdown", role: "tick a gated countdown: while the enable flag loc_826c is 0 do nothing, else decrement counter loc_826a and clear the enable flag when it reaches 0; no register live-in, memory-only live-out; code-level, MAME-grounding pending", cert: "seen" },
  0x20cc: { name: "blitScrollTileGrid", role: "scroll-copy engine: stamp a source block into VRAM as a grid of two-byte column pairs -- save source/row-count to scratch (loc_8001/loc_8003), then for C columns copy B rows of a pair from the source (restarted each column) down the destination at a 32-byte row pitch, advancing by the column stride loc_81b1 between columns; count 0 runs 256; live-in DE source/B rows/C columns, memory-only live-out; code-level, MAME-grounding pending", cert: "seen" },
  0x20fb: { name: "stampScrollRevealColumn", role: "scroll-reveal column stamp: build a VRAM address from the scroll object's row/column/row-count fields (loc_8273 +0/+1/+2), then dispatch on the scroll-phase byte loc_8110 -- phases 80/208 use table loc_2190, 128/176 use loc_2194 and clear edge flag loc_8107, 160 uses loc_2198 and sets loc_8107, any other stamps nothing -- and always write the row-count-minus-one mirror loc_811a; no register live-in, memory-only live-out; code-level, MAME-grounding pending", cert: "seen" },
  0x219c: { name: "blitScrollBand", role: "scroll-band blitter: from the 3-byte descriptor at 0x827C (column/units/rows) compute a video-RAM band base (0xA80E + stride*rowSteps), then the scroll-phase mode (0x8111) selects one of three 4-byte source rows (0x2231/0x2235/0x2239) blitted 6 rows down the band; raises the wrap-latch (0x8108) on the mode-80 phase, clears it on modes 48/96, and stores rows-1 to (0x8119); memory-only live-out", cert: "seen" },
  0x223d: { name: "loadActivePlayerLaneParams", role: "load the active player's per-difficulty lane-parameter block: read the difficulty index (0x8293 for player 1, else 0x8294, chosen by 0x83FD), follow the little-endian pointer table at 0x2260 indexed by 2*difficulty, and copy 33 bytes of that block into 0x8270; runs under EXX so caller BC/DE/HL are preserved; memory-only live-out", cert: "seen" },
  0x23eb: { name: "loc_23eb", role: "[seen] home-bay animation slot cursor: (0x8123) += 1 wrapping to 0 at 6 (mod-6), read by the home-bay stampers as the home-slot index 1..5 -- NOT a river/lane-scroll phase (overturned); live-out memory + A", cert: "seen" },
  0x23fa: { name: "stampHomeBayFly", role: "[seen,poked] stamp the home-bay FLY: for home-slot (0x8123)==1..5, when the slot flag is clear, stamp fly tiles (0x2C/0x2D over 0x2E/0x2F) into that home bay VRAM (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864); (0x83FD) picks the flag bank -- the fly bonus creature in a home bay (overturned from lane-scroll); memory-only live-out", cert: "seen" },
  0x2496: { name: "stampHomeBayGatorEmerging", role: "[seen,poked] stamp the EMERGING gator into a home bay: for home-slot (0x8123)==1..5 stamp tiles (0x10/0x10 over 0xD0/0xD1) into the home bay VRAM when clear -- the gator hazard just surfacing (overturned from lane-scroll); memory-only live-out", cert: "seen" },
  0x2532: { name: "stampHomeBayGatorFull", role: "[seen,poked] stamp the FULL gator into a home bay: at the later phase (0x8120), stamp tiles (0xD0/0xD1 over 0xD2/0xD3) into the home bay VRAM when clear -- the fully-surfaced gator hazard (overturned from lane-scroll); memory-only live-out", cert: "seen" },
  0x25ce: { name: "stampHomeBaySlot", role: "stamp one frog-home slot's 2x2 tile block (base, +1, +32, +33, tile 16) when its per-player gate cell reads zero, slot picked by the pending-slot selector 0x8121 (1..5); then clear the 0x8121/0x8120 selector pair unless the hold flag 0x8004 is set; no register live-in, memory-only live-out", cert: "seen" },
  0x269a: { name: "clearFourByteCounterBlock", role: "clear the 4-byte block 0x805C-0x805F to zero; no register live-in, memory-only live-out", cert: "seen" },
  0x272f: { name: "driveFlyPatrol", role: "drive the fly's horizontal patrol: while the tongue timer 0x833E counts down, re-render the sprite X position 0x8040 (path base 0x811C + path-table 0x279F offset) and flip the sprite code 0x8041 at the timer midpoint; at zero advance one path step in 0x833D (bit7=direction, low 7=index), reversing direction at an endpoint (table value 0, reload+turn sprite) or holding (table value 1, reload only); no register live-in, memory-only live-out", cert: "seen" },
  0x27cb: { name: "armHomeGoalSprite", role: "[seen,poked] arm the home-goal sprite: write the caller's lead byte (B = bay Y) + fixed tail (25,3,16) into the 0x8040 sprite descriptor and set arm timer 0x8340=160; fires on reaching a home bay (the bonus/goal sprite), NOT the fly; memory-only live-out", cert: "seen" },
  0x2856: { name: "clearTwoPlayerFrameCells", role: "when play-mode cell 0x83FE holds 2, zero five cells (0x814F,0x814E,0x8145,0x8146,0x8147); otherwise return untouched; memory-only live-out", cert: "seen" },
  0x291d: { name: "animateTwoPairFigure", role: "two-pair figure animation: when 0x8101==0 clear phase 0x833F; else gated by 0x8150 bit0 and 0x814F==0, bump 0x833F and at phase 64/112 blit tiles into 0xA846/0xA866 (frame 104.. or 208.., the latter restarting the phase); memory-only live-out", cert: "seen" },
  0x29c9: { name: "animateSpriteObjectFrame", role: "[code] IX sprite-object animation arm: counts down the (IX+8) frame timer, on expiry reloads it (12), steps the (IX+6) phase (counting down, 1 wrapping to 4), reads the 0x2cd5 phase-tile table, folds in the (IX+5) flip bits, and stages the IY sprite tile/attr pair (iy+1,iy+5=+1,iy+2=iy+6=4); memory-only live-out", cert: "seen" },
  0x29f9: { name: "loc_29f9", role: "[seen] IX sprite-object motion arm: active while (IX+6)!=0 and the global gate 0x842c==0, counts down the (IX+9) move timer (reload 8); on expiry, past sprite row 96 it steps (IX+3) by +/-2, else drifts (IX+2) toward/away from the free-running counter 0x8014 (NOT the frog X) along (IX+0/+1) and flips the direction bit (IX+5)/(IY+1) at the turn; memory-only live-out. Name reverted to loc_: the batch-2 TowardFrog reading was overturned when 0x8014 grounded as a free-running counter, and no replacement name has converged", cert: "seen" },
  0x2b58: { name: "flagSpriteObjectFrogHit", role: "[code] IX sprite-object hit-test arm (leaf): gated on (IX+6), fires only when (IX+4)+2 == frog row (0x8047), then measures |(IY+0)[+16 when (IX+5)!=0] - (0x8044)| and, when it lands in [0,16), raises the hit flag 0x8004 and the global gate 0x842c (both =1); memory-only live-out", cert: "seen" },
  // ── batch-3 routines ──
  0x0534: { name: "clearPlayerOneHomeBayGates", role: "[seen,poked] Player-1 COLD board re-init (2-player, taken at the player-death/switch handler when player-2's board is already active, 0x83ca!=0): zeros the P1 slot byte 0x825c and the five primary-bank home-bay occupancy gates 0x825e-0x8262, then jp 0x0567 (shared cold-start mid-entry). Consumed by the cold-start init which reads them cleared.", cert: "seen,poked" },
  0x0670: { name: "fillAllHomeSlotsAndAwardLife", role: "[seen,poked] Board-complete (A==0x10 final phase of the 0x06a2 home-fill dispatcher): stamps the 2x2 frog marker (tile 0x10) into all five home-bay VRAM bases via fillTwoByTwoTileBlock, clears the home-column state cell 0x842f, then tails into awardExtraLife (bumps the active player's life count + stamps the lives-row marker).", cert: "seen,poked" },
  0x06ee: { name: "swapInActivePlayerPages", role: "[seen] For player 1 (0x83fd==1): banks the live object page (43B) to 0x85c0 and the live work page (183B) to 0x8600, restores this player's object page from 0x86c0 into 0x800c and work page from 0x8500 into 0x80ff, and writes the OBJRAM per-column attribute shadow 0x803f=1; any other player number tails to swapOutActivePlayerPages (0x0726). Runs at 2-player turn transitions.", cert: "seen" },
  0x07ac: { name: "dequeueSoundCommand", role: "[seen] When the pending-count 0x8300 is nonzero: decrements it, issues the front command byte 0x8301 via issueSoundCommand (latches PPI1.A 0xd000 + pulses PPI1.B 0xd002 for the audio /INT), then shifts the remaining queue down one slot. Runs each in-play NMI (from 0x0103, gated on PLAY_FLAG).", cert: "seen" },
  0x07c1: { name: "raiseActivePlayerStartFlag", role: "[seen] Raises the 2-player start flag for the active player: player 1 (0x83fd==1) delegates to raiseTwoPlayerStartFlag (which sets 0x825b=1 only if the 2P-mode cell 0x826d!=0), any other player writes 0x825b=1 directly at 0x07ca. Called (call nz) from the 2-player game-setup path.", cert: "seen" },
  0x085b: { name: "blitEndStripAndSetHold", role: "[seen] The no-more-frogs tail (reached from the 0x0870 score-display driver's jp z at 0x089a when the 0x83dd counter hits 0): blits a 4-tile strip (src 0x2f6e) then a 5-tile strip (src 0x2f12) up VRAM column 0xaa51 via copyRunUpTileColumn (the second continuing the HL the first left), then raises the hold latch 0x8004=1 which halts the score-display countdown.", cert: "seen" },
  0x0aba: { name: "initDisplayFieldOnce", role: "[seen] One-shot (guarded by 0x842d) display-field layout: sets 0x842d=1 and 0x803f=3, clears 0x83e0=0, blits a 4-tile strip (src 0x2f6e) up column 0xa8bf, fills 15 rows of tile 12 down column 0xa8df (+32/row), then seeds 0x83dc=0x3c20 (16-bit) and 0x83de=0x60. A set 0x842d returns immediately.", cert: "seen" },
  0x0ba0: { name: "writePackedBcdByte", role: "[seen] Prints one packed-BCD byte (A) as two tilemap digits -- high nibble then low -- via writeScoreDigitStepUp twice, leaving HL advanced two 32-cell rows for the caller's next byte.", cert: "seen" },
  0x0c3d: { name: "placeScoreRankMarkers", role: "[seen] On the mode-3 SCORE RANKING attract screen, for each of the two bytes of the packed field 0x83FB (low then high) that is nonzero, writes the constant marker byte 0x04 into a work-RAM staging row at 0x8000+(48-value) via the helper loc_0c4a; a zero byte writes nothing. Consumed downstream on the ranking display fed by loc_0f69's packed rank codes.", cert: "seen" },
  0x0db9: { name: "blitPlayerSelectPrompt", role: "[seen] Draws the player-select prompt line from ROM text at 0x2F88. With exactly one credit blits 'ONE PLAYER ONLY' up the VRAM column at 0xAAF1 (4 tiles 'ONE ' from 0x2F88 then 11 tiles 'PLAYER ONLY' from 0x2F93). Otherwise sets state byte 0x8023=3, blits 'ONE OR TWO PLAYER' up the column at 0xAB11 (4 then 13 tiles from 0x2F88/0x2F8C) and caps the advanced cursor with tile 0x23='S' -> 'ONE OR TWO PLAYERS'. Memory-only (VRAM) live-out.", cert: "seen" },
  0x0de0: { name: "stampAttractDemoCell", role: "[seen] Attract board-demo cell assembler (tail-called from the attract sequencer loc_0e7a when phase>2). Sets demo scroll regs 0x800D/0x800F=3, decrements dwell counter 0x83BC and returns while still dwelling; on expiry reloads 0x83BC=0x20, stamps one phase's 2x2 tile corner in VRAM (base+tile,+1,+2,+3), clears that cell's 4-byte object block, decrements phase counter 0x83D7, and on drain reloads 0x83D7=7 and resets the attract sequencer (0x83BF/0x83BB) before tailing to setAttractIdleMode.", cert: "seen" },
  0x0f59: { name: "blitGameOverLine", role: "[seen,poked] Redraws the GAME-OVER line: clears the 0xA850 tile-group column (via blitFourTileGroupColumn), then blits the fixed 9-tile string 'GAME OVER' from ROM 0x2F0E up the VRAM column starting at 0xAA70 (-0x20 per tile). Called first thing by the game-over/intro entry loc_048f. Memory-only (VRAM) live-out.", cert: "seen,poked" },
  0x0f69: { name: "packScoreRankPair", role: "[seen,poked] At cold-start new-game init (called by loc_0567), reads both players' score words (0x83EB player 2, 0x83ED player 1), runs each through insertHighScoreEntry (larger word first), and packs the two returned rank codes into display field 0x83FB (larger's code -> low byte 0x83FB, smaller's -> high byte 0x83FC). Memory-only live-out consumed by loc_0c3d's marker draw.", cert: "seen,poked" },
  0x1058: { name: "renderFrogAnimArm1", role: "[seen] Frog-animation render arm 1 (jp-table target of the 0x0FAF dispatcher): runs the guarded pre-blit (blitFrogAnimColumnOnTrigger/0x0f8c), reads its sprite triple from 0x8273, points HL at the pattern table via (0x13EF), arms the IX/IY plot cursors at 0x8109, stashes the sprite code at 0x81B1 and the tile source 0x1423 at 0x8001, then enters the shared render loop 0x0FF1. Memory-only live-out.", cert: "seen" },
  0x10f8: { name: "renderFrogAnimArm6", role: "[seen] Frog-animation render arm 6 (jp-table target of the 0x0FAF dispatcher, sibling of the 0x1058 set): reads its sprite triple from 0x8282, points HL at the pattern table via (0x13F9), arms the IX/IY plot cursors at 0x8136, stashes the sprite code at 0x81B1 and the tile source 0x149F at 0x8001, then enters the shared render loop 0x0FF1 (no pre-blit). Memory-only live-out.", cert: "seen" },
  0x12e4: { name: "resolveFrogMoveAgainstLanes", role: "[seen] per-frame upper-half horizontal-move resolver: runs every frame during the demo/live game gated on the hold flag 0x8004 (returns if !=0), keyed on frog X 0x8044 (watched incrementing 0x84->0x90 as the demo frog moved right) and frog Y 0x8047 (watched E0=bottom -> 40=top as the frog climbed). Road section (Y>=0x80): an in-band lane object raises hit flag 0x8004=1; river section (Y<0x80): a clear lane tail-kills via 0x12d0 (kill-tail's 0x8004<-01 observed at f5109). Live-out memory.", cert: "seen" },
  0x1952: { name: "renderFrogAndArmObjects", role: "[seen] board-init composite VRAM render (fires at board start, 2 hits per game): copies a ROM 4-tile group into VRAM (0xA843<-0x40), stamps banner tile 0x47 at 0xA8C3 and box-corner tile 0x41(=65) at 0xA844, then raises the three object-ready flags 0x8007/0x8009/0x800b=1; tail-chains seedObjectAnimationState. Live-out memory (callers reload A).", cert: "seen" },
  0x2005: { name: "advanceScrollLaneObjects", role: "[seen] per-vblank scroll driver: runs every frame during play; steps phase counter 0x826e +1/frame (wraps), counter A 0x8110 +1, counter B 0x8111 +2, copies each scroll object's byte into its shadow 0x811a/0x8119; at phase marks 16/32/48 feeds descriptors to the scroll copy engine (writes 0x81b1). Live-out VRAM + scroll shadows/counters.", cert: "seen" },
  0x23b7: { name: "commitRiverLaneArrivals", role: "[seen] per-frame river-lane arrival pass: for each of four ride lanes, when its direction flag 0x8248-0x824b is set tail-calls that lane's commit handler; else clears the lane's arrival mirror 0x824c-0x824f. Live-out memory.", cert: "seen" },
  0x27b3: { name: "clearLatchedCollision", role: "[seen,poked] guarded collision reset: when latch 0x8135==0 it returns (observed in normal play); when 0x8135!=0 it zeroes sub-flag 0x8134 (PC=27B9) and falls into helper 0x27bc which clears 0x8040-0x8043 and 0x8135 (PC 27C0/27C2/27C4/27C6/27C7). Only runs inside the death/hop path -- caller loc_16f8 is gated on 0x8004!=0, so with an idle frog it never runs. Live-out memory.", cert: "seen,poked" },
  0x27ea: { name: "loc_27ea", role: "[seen,poked] per-frame dive-animation driver, called by the collision orchestrator loc_1a55 only when PLAY_FLAG 0x83fe!=0 (hence 0-hit in attract). Dispatches on 0x83b7, which MAME shows is the LEVEL count (=1 the whole level-1 game, does NOT decrement across frog deaths -> not lives): 0x83b7<2 -> bare-ret arm 0x2873 (no dive; seen every call at level 1), 0x83b7>=5 -> arm 0x2874 -> (0x8101==0) seed via loc_287e then surface-timer 0x27fe, 2..4 -> 0x27fe. Dive frames blit to VRAM 0xA806 via loc_281b (0xA806<-0x10 at PC=283A), NOT the 0xA846 two-pair figure. ADJUDICATION: side1's dispatch mechanism (to 0x2873/0x2874) is correct but 0x83b7 is the LEVEL count, not a cycling 'dive phase'; side2 correctly reads 0x83b7 as a 'count' but wrongly attributes the animation to the 0xA846 two-pair figure (it targets 0xA806). Neither derivation is fully correct -> keep loc_.", cert: "seen,poked" },
  0x287e: { name: "armTwoPairFigureFrame", role: "[seen,poked] one-shot arm reached via loc_27ea's high arm (loc_2874) at level>=5 when 0x8101==0: when busy latch 0x814f==0, sets the diver/two-pair-figure gate 0x8150=1 (PC=2885), seeds both frame cells 0x8146/0x8147 from (0x819b & 0x0f)*8 (PC 28A7/28A9), then sets busy latch 0x814f=1 (PC=28AC) so a later pass won't re-seed. The gate 0x8150 it raises is consumed by the 0xA846 figure animator (0x291d) and the collision test loc_28bb. Live-out memory.", cert: "seen,poked" },
  0x28bb: { name: "mountOrKillFrogOnTwoPairFigure", role: "[seen,poked] frog-vs-diver box collision, gated on arm bit 0x8150 bit0 and level 0x83b7>=2: early-returns every call at level 1 (0x8150 bit0=0). With gates poked (0x8150=1, 0x83b7=5) and frog/diver positions set, the OUTER-overlap branch raised ride flag 0x8004=1 and stamped the 2x2 mounted-frog tile quad 0x68/0x69/0x6A/0x6B at 0xA846/0xA847/0xA866/0xA867; the INNER-overlap branch pushes 0x28ee and tail-calls the frog-kill 0x12d0. Live-out memory.", cert: "seen,poked" },
  0x2af3: { name: "placeSpriteObjectSlotAndRetire", role: "[seen,poked] Dispatcher-A (0x29b9) sprite-object arm on record IX=0x8440 / slot IY=0x8048. Inactive (ix+6==0) -> early return (its natural state all pass). When forced active: writes slot iy+0 = onScreenX, iy+3 = iy+7 = attr(ix+4), iy+4 = a +15/-15 biased position; on the fold-wrap with the retire flag (ix+7) set it clears the 16-byte record AND the 8-byte slot and sets ix+10=0x20. onScreenX = mem8[0x8014]-(ix+2), where 0x8014 is a free-running position counter (MAME: rises +1/frame while the frog is still), NOT the frog X.", cert: "seen,poked" },
  0x2b93: { name: "writeSpriteObjectSlotX", role: "[seen,poked] Dispatcher-B (0x2b83) sprite-object arm on record IX=0x8480 / slot IY=0x8058. For an active record (ix+6!=0) it writes slot iy+0 = target - (ix+2) and slot iy+3 = (ix+4), where target = mem8[0x8000 | (ix+0x0b)] is a lane-position cell. Live-out is the two IY slot bytes, which are DMA-copied to hardware OBJRAM 0xB058 the following frame (real on-screen sprite).", cert: "seen,poked" },
  0x2bab: { name: "steerSpriteObjectTowardTarget", role: "[seen,poked] Dispatcher-B motion arm on IX=0x8480. Active while (ix+6)!=0; counts down the (ix+9) move timer (reload 8); on each expiry steps (ix+2) one step toward the per-object target (a lane-position cell mem8[0x8000|(ix+0b)]) along (ix+0)/(ix+1) by facing (ix+5); on reaching the target it despawns -- clearing the 16-byte record AND the shared 4-byte block 0x8058 -- UNLESS the hold flag 0x8004 is set. Live-out memory only.", cert: "seen,poked" },
  0x2bfb: { name: "writeSpriteObjectSlotAttr", role: "[seen,poked] Dispatcher-B sprite-object arm on IX=0x8480 / IY=0x8058. For an active record (ix+6!=0) it indexes the ROM attribute table 0x2cd9 by the state byte (ix+6), ORs in the object flag bits (ix+5), writes the result to slot iy+1, and writes the sprite code 2 to slot iy+2. Inactive -> untouched. Live-out is the two IY slot bytes.", cert: "seen,poked" },
  0x2c13: { name: "spawnSpriteObject", role: "[seen,poked] Dispatcher-B spawn arm on inactive IX=0x8480. Gated on the level count 0x83b7>=3 and an idle slot (ix+6==0); runs spawn-PRNG draws to density-gate and pick a variant, derives the tile/attribute (ix+4=variant*16+48), the lane index (ix+0b) and the position bytes (ix+0/1/2), and a direction (ix+3/ix+5), then arms the record (ix+6=1, ix+9=8). Live-out is the IX record + the advanced PRNG ring.", cert: "seen,poked" },
  0x2ca8: { name: "flagSpriteObjectFrogHitAhead", role: "[seen,poked] Dispatcher-B proximity/hit-test arm (leaf) on IX=0x8480 / IY=0x8058. Gated on active (ix+6!=0) and object row (ix+4) == frog row (0x8047). Projects the slot X (iy+0) by +20 (ix+5==0) / -4 (ix+5!=0); if that point lands within a 16px window at-or-ahead of the frog X (0x8044) it raises the frog-hit flag 0x8004=1 and advances the object to state 2 (ix+6=2). Live-out memory only.", cert: "seen,poked" },
  0x2d88: { name: "renderMode2IntroScreen", role: "[seen] Builds the mode-2 intro/attract screen (dispatched at the GAME_MODE 0x83d6 == 0x02 transition). Sets the intro-state cell 0x83d8=0xff, fills the play-field tilemap, seeds counters (0x801b=5, 0x802b=3, zeroes 0x8021 and 0x829b), and blits the title tile strip to VRAM 0xaa8d; when the shared time byte 0x83e4<10 it also writes a score digit and three further title strips. Live-out = the seeded cells + the VRAM the fills/blits write.", cert: "seen" },
  // ── batch-4 dispatchers ──
  0x06a2: { name: "stampHomeBayFrogByColumn", role: "[seen] Board-complete \"all frogs home\" reveal dispatcher, keyed on the home-column selector in A (fed each frame from 0x8297 via the NMI/main-loop dispatch at 0x023e `ld a,(0x8297); call nz,0x06a2`): five descending column values -- 0xC0/0x90/0x70/0x50/0x30 -- each stamp the 2x2 FROG-IN-HOME (occupied/completion) graphic (tiles 0xFC/0xFD top, 0xFE/0xFF bottom) into that bay's fixed VRAM base (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864); as the board-complete countdown 0x8297 (set to 0xFF by loc_05d3, decremented by 0x0257) passes each threshold a frog is placed into the next home, revealing all five in sequence. Value 0x10 delegates to fillAllHomeSlotsAndAwardLife (0x0670), which resets all five bays to the EMPTY home tile (0x10) and awards the extra life. Any other A returns (no-op). OVERTURNS the hypothesis semantic: the FC-FF tiles are the OCCUPIED/frog graphic, not an \"empty marker\" -- EMPTY is tile 0x10 (the delegated fill-all path). Mechanism (dispatch, five bays, 0x10 fill-all-award-life, else return) is confirmed; the \"empty\" reading is inverted.", cert: "seen" },
  0x0b9b: { name: "writePackedBcdWord", role: "writePackedBcdWord -- writes a 16-bit packed-BCD value from DE as four consecutive tilemap digit-cells: the high byte (D)'s two nibbles then the low byte (E)'s two, via writePackedBcdByte twice, stepping HL up one 32-cell tilemap row (-0x20, with 16-bit borrow) per digit so it returns HL advanced four rows for the caller's next field. LIVE-OUT: VRAM + HL.", cert: "seen" },
  0x11bf: { name: "dispatchFrogMoveAgainstLanes", role: "Lower-half entry + dispatcher of the frog's per-frame position-vs-lanes resolution. Guarded by (0x83cd)==0 and (0x8004)==0; dispatches on frog Y (0x8047): low nibble>=9 or a high nibble not in the lane map delegates to the upper half resolveFrogMoveAgainstLanes (0x12e4), the other high nibbles select a scan arm that walks a per-lane object-X list (count byte + X positions) for an object inside the frog's band [frogX+off,+width). Road band (Y>=0x80): in-band object => KILL via 0x12d0 (0x8004<-1); clear lane => delegate/safe. River band (Y<0x80): in-band object (log) => delegate/ride; clear lane => KILL(drown). Effect: kill-or-survive the frog by lane occupancy. Alt scanFrogLaneForCollision names the same routine.", cert: "seen" },
  0x2b83: { name: "updateSpriteObject", role: "[seen,poked] Sprite-object dispatcher-B. Once per frame (60Hz) the sole caller loc_2970 enters with IX=0x8480 (record base) / IY=0x8058 (sprite-slot base) and this routine runs the five arms in fixed order -- spawnSpriteObject(0x2c13), steerSpriteObjectTowardTarget(0x2bab), writeSpriteObjectSlotX(0x2b93), flagSpriteObjectFrogHitAhead(0x2ca8), writeSpriteObjectSlotAttr(0x2bfb) -- then RET, advancing that one IX record / IY slot one step per frame. No register live-out; memory-only. Observed effect: spawns an object into record 0x8480, steers it (move timer +9 drains, position drifts, despawns on reaching target), stages X/attr/code into slot 0x8058, which is DMA-copied to hardware OBJRAM 0xB058 as a real on-screen sprite.", cert: "seen,poked" },
  // ── batch-5 routines ──
  0x0b95: { name: "writeScoreField", role: "[seen] Score/point-value field printer: prints the caller's 16-bit packed-BCD word (DE) as four tilemap digit cells at the caller's pointer (HL) via writePackedBcdWord, then appends one fixed trailing-zero digit via writeScoreDigitStepUp(m,0) -- a 5-cell readout implementing the Frogger 'score/10 stored + literal ones-place 0' convention. Each cell steps the pointer up one 32-cell tilemap row. Live-out: VRAM (5 cells). Callers: loc_0b1f (P1/high/P2 scores), loc_0d4c (score-target), loc_0bb3 (per-level point targets).", cert: "seen" },
  0x0c6d: { name: "renderMode4PointTablePhase", role: "[seen] Draws one phase per frame-cycle of the mode-4 (GAME_MODE 0x83d6==4) attract POINT-TABLE screen. Under MAME this screen is literally Frogger's \"-POINT TABLE-\" attract page (FROGGER logo, \"10 PTS FOR EACH STEP\", \"50 PTS FOR EVERY FROG ARRIVED HOME SAFELY\", \"1000 PTS BY SAVING FROGS INTO FIVE HOMES\", KONAMI (c) 1981). Steps the shared attract sub-phase counter 0x83d7 (reload 5 when drained, then count down) so successive calls cycle phases 4,3,2,1,0; phase 0 parks the pacing/state gate 0x83d8=0xC0 (idle), phases 1-4 blit their tile strips + a packed-BCD point value (0x10/0x1000/0x50/0x10) up VRAM columns and park 0x83d8=0x80 (drawn); phase 4 also seeds four object/sprite records (code=3, attr/Y=6) into the 0x801b-0x802f work table which propagate to hardware OBJRAM. Memory-only live-out (VRAM 0xA800-0xABFF, object work table 0x8010-0x803f).", cert: "seen" },

  // ── batch-6 routine (last near-leaf) ──
  0x0bb3: { name: "renderMode3ScoreRankingScreen", role: "[seen] Draws the mode-3 (GAME_MODE 0x83d6==3) attract SCORE RANKING screen in one call -- under MAME: FROGGER logo, \"SCORE RANKING\" header, five ranked high scores (1ST 04630 PTS .. 5TH 01270 PTS), KONAMI (c) 1981. Steps the attract pacing gate 0x83d8, zeros the sub-phase counter 0x83d7 and the start-latch 0x83b3, fills the 22x32 background via fillTilemapBlock22x32, zeros five 4-strided cells from 0x801f (with 0x8019=3), stamps the rank markers via placeScoreRankMarkers, then for rank 1..5 writes the rank digit at column 0xAA(2r+0xCD) and that rank's packed-BCD score -- read from the high-score table word at 0x83EF+2r (0x83F1-0x83FA, the table loc_0a84/insertHighScoreEntry maintains) -- at column 0xA9(2r+0xED) via writeScoreField, each flanked by fixed tile strips (a running header source from 0x2EE5, the per-score source 0x2FBA). Falls through into the shared final-strip tail loc_0c17 (kept as m.call; loc_0d11 also enters there). Memory-only live-out (VRAM + reset work cells). Caller loc_0d11 (dispatches on GAME_MODE==3).", cert: "seen" },

  // ── batch-7 routines (held-back service routines) ──
  0x07d9: { name: "clearSoundQueue", role: "[seen] game-start reset of the sound-command queue: zeroes exactly 0x8300-0x832f (the pending-command count 0x8300 + the 47 command slots above it), leaving 0x82ff and 0x8330 untouched", cert: "seen" },
  0x0b0a: { name: "initNewGameScoreAndTimers", role: "[seen] new-game reset: zeros the player-1 score word (0x83ed), the player-2 score word (0x83eb) and the P1/P2 extra-life-awarded flags (0x83e7/0x83e8), then copies the starting-time byte (0x83e4) into both time-remaining bytes (0x83e5/0x83e6) so both time bars start full; does NOT touch the high score (0x83ef). Pure leaf, memory-only live-out; caller loc_0341 (new-game setup)", cert: "seen" },
  0x0b1f: { name: "renderScoreHeader", role: "[seen] redraw the 3-column score header each frame: HI-SCORE (label 0x2ee2 \"HI-SCORE\" -> 0xaa60, high score 0x83ef -> 0xaa41), \"1-UP\" (digit 1 -> 0xab20, shared \"-UP\" strip 0x2edf, P1 score 0x83ed -> 0xab41), and when 0x8370!=1 \"2-UP\" (digit 2 -> 0xa900, \"-UP\", P2 score 0x83eb -> 0xa921); 0x8370==1 skips the 2-UP arm", cert: "seen" },
  0x0b67: { name: "renderCreditLine", role: "[seen] draws the \"CREDIT\" line: label ROM 0x2f68 \"CREDIT\" -> 0xa97f, first-call-only credit-column clear latched by 0x83b4, then the packed-BCD credit count 0x83e1 -> 0xa89f; also writes the 0x803f OBJRAM per-column attribute shadow", cert: "seen" },
};
