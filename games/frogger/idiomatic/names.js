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
export const loc_800c = 0x800c; // [code] demo object block base; clearObjectBlocksAndMirrorToObjRam clears 44 bytes here + mirrors 43 to OBJRAM, swapOutActivePlayerPages banks/restores its 43-byte object page
export const loc_803f = 0x803f; // [code] page-swap-done flag; swapOutActivePlayerPages sets it to 1 after banking the active player's pages
export const loc_8044 = 0x8044; // [code] frog object block base; activateFrogObject sets it active, resetFrogObject writes the four object bytes from here
export const loc_8045 = 0x8045; // [code] frog object sub-field; activateFrogObject clears it when activating the frog
export const loc_8047 = 0x8047; // [code] frog object sub-field; activateFrogObject clears it when activating the frog
export const loc_80ff = 0x80ff; // [code] live work page base; swapOutActivePlayerPages banks 183 bytes from here and restores them from the other bank
export const loc_8100 = 0x8100; // [code] second work-RAM sprite block base; clearObjectBlocksAndMirrorToObjRam zeroes 99 bytes from here
export const loc_8269 = 0x8269; // [code] frog state cell; resetFrogObject clears it during the frog-object reset
export const loc_825a = 0x825a; // [code] per-player start/demo flag; loc_05d3 sets it to 1, handOffToOtherPlayer sets it to 1 on the player hand-off
export const loc_825b = 0x825b; // [code] 2-player start flag; loc_05d3 clears it, raiseTwoPlayerStartFlag raises it, swapOutActivePlayerPages restores it under the init guard
export const loc_826d = 0x826d; // [code] 2-player mode flag; loc_05d3 sets it to 1, raiseTwoPlayerStartFlag reads it to decide whether to raise the start flag
export const loc_8295 = 0x8295; // [code] one-shot init guard latch; swapOutActivePlayerPages returns early when set, else latches it to 1
export const loc_8297 = 0x8297; // [code] demo start-flag cell; loc_05d3 stores 255 here
export const loc_8298 = 0x8298; // [code] demo start-flag cell; loc_05d3 stores 64 here
export const loc_829d = 0x829d; // [code] NMI in-play countdown word; loc_0292 decrements it each pass
export const loc_8371 = 0x8371; // [code] per-turn scratch cell; handOffToOtherPlayer clears it at the top of the player hand-off
export const loc_83ae = 0x83ae; // [code] countdown-expiry flag; loc_0292 clears it when the countdown word reaches zero
export const loc_83b6 = 0x83b6; // [code] per-player reset cell; handOffToOtherPlayer clears it when handing play to the other player
export const loc_83b7 = 0x83b7; // [code] life/level count; renderLivesRow clamps it to draw the lives row, awardExtraLife mirrors the new count here, handOffToOtherPlayer loads the other player's into it
export const loc_83b8 = 0x83b8; // [code] player 1 life count; awardExtraLife increments it, handOffToOtherPlayer reads it
export const loc_83b9 = 0x83b9; // [code] player 2 life count; awardExtraLife increments it, handOffToOtherPlayer reads it
export const loc_83c2 = 0x83c2; // [code] cocktail-enabled flag; handOffToOtherPlayer toggles the screen flip only when it is non-zero
export const loc_83c3 = 0x83c3; // [code] frog-ready flag; resetFrogObject sets it to 1 at the end of the frog-object reset
export const loc_83cb = 0x83cb; // [code] screen-flip latch (work-RAM shadow); handOffToOtherPlayer toggles bit 0 and mirrors it to the flip IO ports
export const loc_83cc = 0x83cc; // [code] awardExtraLife clears this to 0 when awarding an extra life
export const loc_83cd = 0x83cd; // [code] frog-state / demo flag; loc_05d3 sets it to 1, resetFrogObject clears it during the frog-object reset
export const loc_83d2 = 0x83d2; // [code] frog 16-bit timer A; activateFrogObject seeds it to 64 in a two-player game
export const loc_83d9 = 0x83d9; // [code] sound-control byte RAM shadow; issueSoundCommand reads it to pulse bit 3 of the sound-control port
export const loc_83da = 0x83da; // [code] frog 16-bit timer B; activateFrogObject seeds it to 64 in a two-player game
export const loc_83e4 = 0x83e4; // [code] shared time byte / inactive sentinel; renderTimeBar returns without drawing when it holds 255, else uses it as the fallback time source
export const loc_83e5 = 0x83e5; // [code] player-1 time-remaining byte; renderTimeBar uses it as the bar length when player 1 is active
export const loc_83e6 = 0x83e6; // [code] player-2 time-remaining byte; renderTimeBar uses it as the bar length when player 2 is active
export const loc_83ea = 0x83ea; // [code] demo start flag; loc_05d3 clears it to 0
export const loc_83f2 = 0x83f2; // [code] key-high of the first slot of the 5-entry descending table; insertHighScoreEntry inserts into it
export const loc_83fd = 0x83fd; // [code] active player number (1/2); awardExtraLife and renderTimeBar pick the active player's counter, handOffToOtherPlayer toggles it
export const loc_8400 = 0x8400; // [code] ring cursor cell + buffer base; nextSpawnRandomByte decrements the cursor and XOR-folds two ring cells
export const loc_842c = 0x842c; // [code] frog state cell; resetFrogObject clears it during the frog-object reset
export const loc_842d = 0x842d; // [code] frog state cell; resetFrogObject clears it during the frog-object reset
export const loc_8500 = 0x8500; // [code] work-page save bank base; swapOutActivePlayerPages banks 183 live bytes into here
export const loc_85c0 = 0x85c0; // [code] other player's saved object page; swapOutActivePlayerPages restores 43 object bytes from here
export const loc_8600 = 0x8600; // [code] other player's saved work page; swapOutActivePlayerPages restores 183 bytes from here
export const loc_86c0 = 0x86c0; // [code] object save bank base; swapOutActivePlayerPages banks 43 live object bytes into here
export const loc_a808 = 0xa808; // [code] tilemap fill base; fillTilemapBlock22x32 loads it as the fixed start of a 22x32 block fill
export const loc_a85e = 0xa85e; // [code] lives-row marker base; awardExtraLife stamps the new life marker at base + count*0x20
export const loc_a864 = 0xa864; // [code] home-slot VRAM base (slot 5); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_a87e = 0xa87e; // [code] lives/level row column base; renderLivesRow stamps the marker tile down it stepping +0x20
export const loc_a924 = 0xa924; // [code] home-slot VRAM base (slot 4); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_a9e4 = 0xa9e4; // [code] home-slot VRAM base (slot 3); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_aaa4 = 0xaaa4; // [code] home-slot VRAM base (slot 2); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_ab64 = 0xab64; // [code] home-slot VRAM base (slot 1); renderFilledHomeSlots stamps the four frog-home tiles here when its occupancy entry is set
export const loc_abbe = 0xabbe; // [code] time-bar column base (VRAM); renderTimeBar draws the bar up the column from here stepping -0x20
export const loc_b00c = 0xb00c; // [code] OBJRAM object mirror base; clearObjectBlocksAndMirrorToObjRam copies the zeroed 43-byte object head into here
export const loc_b80c = 0xb80c; // [code] flip_y IO latch; handOffToOtherPlayer mirrors the screen-flip bit to it when cocktail is enabled
export const loc_b810 = 0xb810; // [code] flip_x IO latch; handOffToOtherPlayer mirrors the screen-flip bit to it when cocktail is enabled
export const loc_d000 = 0xd000; // [code] sound-command latch port (PPI1.A); issueSoundCommand writes register A here to issue a sound command
export const loc_d002 = 0xd002; // [code] sound-control port (PPI1.B); issueSoundCommand pulses bit 3 low-then-high to raise the audio /INT

// ── batch-2 cells: scroll engine, home-bay animations, fly patrol, sprite-object arms, animation clocks, game-start clears ──
export const loc_8001 = 0x8001; // [code] scroll-copy source-pointer scratch (word); blitScrollTileGrid saves the source pointer here and the per-column loop reloads it
export const loc_8003 = 0x8003; // [code] scroll-copy row-count scratch; blitScrollTileGrid saves the row count here and the per-column loop reloads it
export const loc_8004 = 0x8004; // [code] hold flag / object-frog hit flag; stampHomeBaySlot stamps the slot but leaves the selector pending when non-zero, flagSpriteObjectFrogHit sets it to 1 (with gate loc_842c) when a sprite object overlaps the frog
export const loc_800d = 0x800d; // [code] object-animation state block base; seedObjectAnimationState seeds 10 stride-2 cells (0x800d-0x801f) from a fixed table at board init
export const loc_8014 = 0x8014; // [code] frog X; steerSpriteObjectTowardFrog reads it as the target the motion arm drifts each sprite object toward or away from
export const loc_8021 = 0x8021; // [code] object-animation cell block base; seedObjectAnimationState seeds 14 stride-2 cells (0x8021-0x803b) from a fixed table at board init
export const loc_8040 = 0x8040; // [code] fly sprite X position / base of the four-cell block armHomeGoalSprite arms; driveFlyPatrol writes path base loc_811c + path-table offset, armHomeGoalSprite arms it with the lead byte + fixed tail 25,3,16 (sibling loc_27de zeroes 0x8040-0x8043)
export const loc_8041 = 0x8041; // [code] fly sprite code; driveFlyPatrol sets it at the timer midpoint (33 or flipped 0xA1) and to the turn sprite (30) at an endpoint
export const loc_805c = 0x805c; // [code] base of the 4-byte timer/counter block clearFourByteCounterBlock clears to zero (0x805C-0x805F)
export const loc_8101 = 0x8101; // [code] animateTwoPairFigure idle-clears the figure-animation phase when this is 0, else runs the animation
export const loc_8107 = 0x8107; // [code] scroll edge flag; stampScrollRevealColumn clears it on the 128/176 arm and sets it to 1 on the 160 arm
export const loc_8108 = 0x8108; // [code] scroll wrap-latch; blitScrollBand raises it to 1 on the mode-80 phase and clears it on the mode-48/96 phases
export const loc_8110 = 0x8110; // [code] scroll-phase selector; stampScrollRevealColumn dispatches on it (80/208, 128/176, 160) to pick the stamp table
export const loc_8111 = 0x8111; // [code] scroll-phase mode; blitScrollBand dispatches the source-row choice on it (0/112->A, 48/96->B, 80->C), loc_2005 steps it by 2
export const loc_8118 = 0x8118; // [code] frog-anim blit trigger; blitFrogAnimColumnOnTrigger blits the tile pair when non-zero then clears it to 0, else returns at once
export const loc_8119 = 0x8119; // [code] scroll row-span shadow; blitScrollBand stores row count - 1 here at exit
export const loc_811a = 0x811a; // [code] scroll-object row-count mirror; stampScrollRevealColumn writes (row-count field - 1) here before returning
export const loc_811c = 0x811c; // [code] fly path X base; driveFlyPatrol adds it to the path-table offset to form the sprite X at loc_8040
export const loc_8120 = 0x8120; // [code] home-bay slot cursor mirror; stampHomeBayGatorEmerging writes the slot value here, stampHomeBayGatorFull reads it as its 1..5 home-slot index, stampHomeBaySlot clears it with loc_8121
export const loc_8121 = 0x8121; // [code] pending home-bay slot selector (1..5); stampHomeBayFly/stampHomeBayGatorFull write it, stampHomeBaySlot dispatches on it to pick a bay and clears it after stamping
export const loc_8123 = 0x8123; // [code] home-bay slot cursor (mod 6); loc_23eb increments-and-wraps it, stampHomeBayFly/stampHomeBayGatorEmerging read it as the 1..5 home-slot index and mirror it (grounded; not a river/scroll phase)
export const loc_8145 = 0x8145; // [code] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_8146 = 0x8146; // [code] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_8147 = 0x8147; // [code] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_814e = 0x814e; // [code] one of five cells clearTwoPlayerFrameCells zeroes in play-mode 2
export const loc_814f = 0x814f; // [code] sprite-frame busy latch 1; advanceAnimationFrameBuffer returns without stepping while non-zero, animateTwoPairFigure reads it as a busy gate that must be 0, clearTwoPlayerFrameCells zeroes it in play-mode 2
export const loc_8150 = 0x8150; // [code] animateTwoPairFigure gates its step on bit0 of this cell
export const loc_815b = 0x815b; // [code] sprite-frame busy latch 2; advanceAnimationFrameBuffer returns without stepping while it is non-zero
export const loc_819b = 0x819b; // [code] animation frame buffer; advanceAnimationFrameBuffer copies 11 bytes of the current frame source into it
export const loc_81b1 = 0x81b1; // [code] scroll-copy column stride; blitScrollTileGrid advances the destination by this between columns
export const loc_81b3 = 0x81b3; // [code] animation frame index; advanceAnimationFrameBuffer advances it into the loc_1841 pointer table, wrapping to 0 at index 10
export const loc_81b4 = 0x81b4; // [code] animation frame timer; advanceAnimationFrameBuffer ticks it down each pass and reloads it to 21 when it reaches 0
export const loc_825e = 0x825e; // [code] home-bay-1 occupancy gate, primary bank (used when (0x83FD)==1); the home-bay stampers skip that bay when non-zero
export const loc_825f = 0x825f; // [code] home-bay-2 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8260 = 0x8260; // [code] home-bay-3 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8261 = 0x8261; // [code] home-bay-4 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8262 = 0x8262; // [code] home-bay-5 occupancy gate, primary bank ((0x83FD)==1); skipped when non-zero
export const loc_8263 = 0x8263; // [code] home-bay-1 occupancy gate, alternate bank (used when (0x83FD)!=1); skipped when non-zero
export const loc_8264 = 0x8264; // [code] home-bay-2 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_8265 = 0x8265; // [code] home-bay-3 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_8266 = 0x8266; // [code] home-bay-4 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_8267 = 0x8267; // [code] home-bay-5 occupancy gate, alternate bank ((0x83FD)!=1); skipped when non-zero
export const loc_826a = 0x826a; // [code] gated countdown counter; tickGatedCountdown decrements it and, when it reaches 0, clears the enable flag loc_826c
export const loc_826c = 0x826c; // [code] countdown enable flag; tickGatedCountdown returns early while it is 0 and clears it to 0 once loc_826a reaches 0
export const loc_8270 = 0x8270; // [code] active player's lane-parameter block (33 bytes); loadActivePlayerLaneParams copies the selected difficulty block into here
export const loc_8273 = 0x8273; // [code] scroll-object block base; stampScrollRevealColumn reads its row/column/row-count fields (+0/+1/+2) to build the VRAM stamp address
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
export const loc_a800 = 0xa800; // [code] VRAM base; computeVramColumnIndex computes HL minus this (less the incoming borrow) as the render offset it folds into the column index returned in C
export const loc_a806 = 0xa806; // [code] VRAM destination base for blitFrogAnimColumnOnTrigger's 8-row tile-pair blit (two bytes per row, dest steps +32 per row)
export const loc_a80e = 0xa80e; // [code] scroll-band video-RAM base; blitScrollBand offsets it by stride*rowSteps to reach the band's top cell
export const loc_a846 = 0xa846; // [code] first tile cell of the two-pair figure animateTwoPairFigure blits (second pair one row / +32 below at 0xA866)

// ── batch-3 cells: status/frog/scroll renders, sprite-object arms, attract demo, intro/score, sound queue ──
export const loc_8000 = 0x8000; // [code] work-RAM page-0x80 base; loc_2c13 reads the placement seed at 0x8000|low, loc_2bab/loc_2b93 read a per-object target/table byte at 0x8000|(IX+0x0b) (loc_0faf reads the CELL 0x8000 as the frog-anim index -- page-base vs cell use, naming pass to reconcile)
export const loc_8007 = 0x8007; // [code] object-ready flag; loc_1952 sets it to 1 after the frog render (with 0x8009/0x800b)
export const loc_8009 = 0x8009; // [code] object-ready flag; loc_1952 sets it to 1 after the frog render
export const loc_800b = 0x800b; // [code] object-ready flag; loc_1952 sets it to 1 after the frog render
export const loc_800f = 0x800f; // [code] demo scroll register; loc_0de0 writes 3 here (paired with loc_800d) each dwell tick
export const loc_801b = 0x801b; // [code] intro counter; loc_2d88 seeds it to 5 during the mode-2 setup
export const loc_8023 = 0x8023; // [code] credit/1UP header state marker; loc_0db9 sets it to 3 in the multi-credit arm
export const loc_802b = 0x802b; // [code] intro counter; loc_2d88 seeds it to 3 (also the store target of loc_0c4a)
export const loc_802f = 0x802f; // [code] lane low-bound selector; loc_12e4 branches on it (<128 vs >=128) to pick the lane low-bound offset (12 vs 3) added to the frog base loc_8044
export const loc_8058 = 0x8058; // [code] shared 4-byte sprite-object block; loc_2bab clears it (with the 16-byte IX struct) when an object reaches its target and despawns
export const loc_8109 = 0x8109; // [code] loc_12e4 scans it as a lane object list (count byte then object X positions, band width 31); loc_1058 arms both plot cursors (IX/IY) to it for the frog-anim render loop
export const loc_8112 = 0x8112; // [code] lane object list (count byte then object X positions), band width 92; loc_12e4 scans it for an object in the frog's move band
export const loc_811b = 0x811b; // [code] lane object list (count byte then object X positions), band width 44; loc_12e4 scans it for an object in the frog's move band
export const loc_8124 = 0x8124; // [code] lane object list (count byte then object X positions), band width 47; loc_12e4 scans it for an object in the frog's move band
export const loc_8134 = 0x8134; // [code] collision sub-flag; loc_27b3 zeroes it before falling through to the clear helper (loc_27bc)
export const loc_8135 = 0x8135; // [code] collision-latched flag; loc_27b3 returns early when 0, else clears it via the clear helper (also read by loc_26a6)
export const loc_8136 = 0x8136; // [code] loc_12e4 scans it as a lane object list (band width 34); loc_10f8 uses it as the frog-anim arm-6 plot-cursor base
export const loc_813f = 0x813f; // [code] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_8148 = 0x8148; // [code] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_8151 = 0x8151; // [code] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_815a = 0x815a; // [code] lane object list (count byte then object X positions), band width 18; loc_12e4 scans it for an object in the frog's move band
export const loc_8248 = 0x8248; // [code] river lane-0 direction flag; loc_23b7 tails to the lane-0 commit handler when set, else clears the lane-0 mirror loc_824c
export const loc_8249 = 0x8249; // [code] river lane-1 direction flag; loc_23b7 tails to the lane-1 commit handler when set, else clears the lane-1 mirror loc_824d
export const loc_824a = 0x824a; // [code] river lane-2 direction flag; loc_23b7 tails to the lane-2 commit handler when set, else clears the lane-2 mirror loc_824e
export const loc_824b = 0x824b; // [code] river lane-3 direction flag; loc_23b7 tails to the lane-3 commit handler when set, else clears the lane-3 mirror loc_824f
export const loc_824c = 0x824c; // [code] river lane-0 arrival mirror flag; loc_23b7 clears it when the lane-0 direction flag loc_8248 is clear
export const loc_824d = 0x824d; // [code] river lane-1 arrival mirror flag; loc_23b7 clears it when the lane-1 direction flag loc_8249 is clear
export const loc_824e = 0x824e; // [code] river lane-2 arrival mirror flag; loc_23b7 clears it when the lane-2 direction flag loc_824a is clear
export const loc_824f = 0x824f; // [code] river lane-3 arrival mirror flag; loc_23b7 clears it when the lane-3 direction flag loc_824b is clear
export const loc_825c = 0x825c; // [code] player-1 slot byte; loc_0534 zeros it before the cold-start pre-clear (loc_048f's P1-init later sets it to 1)
export const loc_826e = 0x826e; // [code] scroll phase counter; loc_2005 steps it each NMI and runs a lane block at 16/32/48, clearing it to 0 at phase 48
export const loc_8274 = 0x8274; // [code] scroll object A descriptor +1 (row count); loc_2005 loads it as the grid copy engine's B row-count at phase 16/32/48
export const loc_827d = 0x827d; // [code] scroll object B descriptor +1 (row count); loc_2005 loads it as the band copy entry's B row-count
export const loc_8282 = 0x8282; // [code] frog-anim arm-6 sprite triple code byte; loc_10f8 reads it into A and stashes it at loc_81b1 for the render loop
export const loc_8283 = 0x8283; // [code] frog-anim arm-6 row count; loc_10f8 loads it as the render loop's B (rows per pass)
export const loc_8284 = 0x8284; // [code] frog-anim arm-6 outer-pass count; loc_10f8 loads it as the render loop's C (passes, 0=>256)
export const loc_829b = 0x829b; // [code] intro counter; loc_2d88 zeroes it during the mode-2 setup
export const loc_8300 = 0x8300; // [code] pending sound-command count; loc_07ac returns when it is 0, else decrements it, issues the command at loc_8300+1, and shifts loc_8300+2.. down one slot
export const loc_83bb = 0x83bb; // [code] attract sequencer state cell; loc_0de0 clears it to 0 after placing the last cell
export const loc_83bc = 0x83bc; // [code] attract demo dwell counter; loc_0de0 decrements it and reloads 32 on expiry
export const loc_83bf = 0x83bf; // [code] attract sequencer phase byte; loc_0de0 clears it to 0 after placing the last cell
export const loc_83d7 = 0x83d7; // [code] attract demo phase counter (1..7); loc_0de0 dispatches the cell arm on it, decrements it, and reloads 7 when drained
export const loc_83d8 = 0x83d8; // [code] mode-2 intro state cell; loc_2d88 stores 0xff here at the intro setup
export const loc_83dc = 0x83dc; // [code] 16-bit scroll/state cell; loc_0aba seeds it to 0x3C20 during the one-time layout setup
export const loc_83de = 0x83de; // [code] scroll/state cell; loc_0aba seeds it to 0x60 during the one-time layout setup
export const loc_83e0 = 0x83e0; // [code] display-field cell; loc_0aba zeroes it during the one-time layout setup
export const loc_83eb = 0x83eb; // [code] player-2 score word (16-bit); loc_0f69 reads it as one of the two words to rank and pack
export const loc_83ed = 0x83ed; // [code] high score word (16-bit); loc_0f69 reads it as the other word to rank and pack
export const loc_83fb = 0x83fb; // [code] two-byte score display / intro digit field (0x83fb low, 0x83fc high); loc_0c3d reads the pair to draw the two intro digits, loc_0f69 stores the larger word's rank code at 0x83fb and the smaller's at 0x83fc
export const loc_842f = 0x842f; // [code] home-column state cell; loc_0670 clears it to 0 before tailing into the extra-life award
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
export const loc_2cd9 = 0x2cd9; // [code] object-state -> sprite attribute table (ROM); loc_2bfb indexes it by the object state byte (ix+6), ORs (ix+5), and writes the result to the IY slot (iy+1)
export const loc_2cdc = 0x2cdc; // [code] spawn pointer table (ROM); loc_2c13 reads a little-endian pointer at 2*variant, then derives the two placement spans
export const loc_2ce6 = 0x2ce6; // [code] spawn variant table (ROM); loc_2c13 indexes it by 2*variant for a subtract-loop span (even byte) and the low byte of a page-0x80 seed cell (odd byte, stored to ix+0x0b)
export const loc_2f0e = 0x2f0e; // [code] ROM source of the 9-tile string loc_0f59 blits via rst 0x28
export const loc_2f12 = 0x2f12; // [code] ROM 5-tile strip source; loc_085b's second blit copies from here
export const loc_2f5c = 0x2f5c; // [code] ROM tile-strip source for loc_2d88's 11-tile main title blit
export const loc_2f6e = 0x2f6e; // [code] ROM 4-tile strip source; loc_0aba blits it up the loc_a8bf column (rst 0x28), loc_085b's first blit copies it up the loc_aa51 column
export const loc_2f73 = 0x2f73; // [code] ROM tile-strip source blitted by loc_2d88 (4 tiles) on the time<10 arm
export const loc_2f88 = 0x2f88; // [code] ROM tile-source base for loc_0db9's first header blit (used by both credit arms)
export const loc_2f92 = 0x2f92; // [code] ROM tile-strip source blitted by loc_2d88 (7 tiles) on the time<10 arm
export const loc_2f93 = 0x2f93; // [code] ROM tile-source for loc_0db9's one-credit second header blit
export const loc_2fae = 0x2fae; // [code] ROM tile-strip source blitted by loc_2d88 (7 tiles) on the time<10 arm
// VRAM bases the batch-3 routines touch
export const loc_a843 = 0xa843; // [code] frog-render VRAM column base (group 1); loc_1952 copies four tiles from loc_19f6 down it, 5 columns +0x40 apart
export const loc_a844 = 0xa844; // [code] frog-render box top-left VRAM corner; loc_1952 writes corner tiles 65,66 here and 69,70 at +0x360
export const loc_a850 = 0xa850; // [code] VRAM status-row base; loc_0f59 clears it via the 4-tile-group column blit
export const loc_a85c = 0xa85c; // [code] frog-render home-marker string VRAM base; loc_1952 loads HL with it before the tile-string blit
export const loc_a8a4 = 0xa8a4; // [code] frog-render VRAM column base (group 2); loc_1952 copies four tiles from loc_19fa down it, 4 columns
export const loc_a8a5 = 0xa8a5; // [code] frog-render VRAM column base (group 3); loc_1952 copies four tiles from loc_19fe down it, 4 columns
export const loc_a8bf = 0xa8bf; // [code] VRAM cell loc_0aba blits a 4-tile strip up into (rst 0x28 dest) during the one-time layout setup
export const loc_a8c3 = 0xa8c3; // [code] frog-render banner VRAM column base; loc_1952 stamps tile 71 four times stepping +0x20 then +0xa0
export const loc_a8c6 = 0xa8c6; // [code] attract demo cell VRAM corner base (phase 1); loc_0de0 stamps a 2x2 tile block at base + 96*(phase-1)
export const loc_a8df = 0xa8df; // [code] VRAM cell loc_0aba fills 15 tile rows of tile 12 down from (+32/row) during the one-time layout setup
export const loc_aa51 = 0xaa51; // [code] no-more-frogs VRAM column start; loc_085b blits the 4-tile then 5-tile strips up from here
export const loc_aa70 = 0xaa70; // [code] VRAM destination loc_0f59 stamps the 9-tile string into (rst 0x28 dest)
export const loc_aa8d = 0xaa8d; // [code] VRAM tilemap column base for loc_2d88's main title strip
export const loc_aaf1 = 0xaaf1; // [code] VRAM column base for loc_0db9's one-credit "1UP" header blit
export const loc_ab11 = 0xab11; // [code] VRAM column base for loc_0db9's multi-credit header blit
export const loc_ab15 = 0xab15; // [code] VRAM tilemap base for loc_2d88's score-digit draw on the time<10 arm

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
  0x0726: { name: "swapOutActivePlayerPages", role: "swap the active player's work pages OUT — bank the two live pages, restore the other player's from bank, set the swap-done flag, and one-shot latch the init guard; memory-only live-out", cert: "seen" },
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
  0x29f9: { name: "steerSpriteObjectTowardFrog", role: "[code] IX sprite-object motion arm: active while (IX+6)!=0 and the global gate 0x842c==0, counts down the (IX+9) move timer (reload 8); on expiry, past sprite row 96 it steps (IX+3) by +/-2, else drifts (IX+2) toward/away from the frog X (0x8014) along (IX+0/+1) and flips the direction bit (IX+5)/(IY+1) at the turn; memory-only live-out", cert: "seen" },
  0x2b58: { name: "flagSpriteObjectFrogHit", role: "[code] IX sprite-object hit-test arm (leaf): gated on (IX+6), fires only when (IX+4)+2 == frog row (0x8047), then measures |(IY+0)[+16 when (IX+5)!=0] - (0x8044)| and, when it lands in [0,16), raises the hit flag 0x8004 and the global gate 0x842c (both =1); memory-only live-out", cert: "seen" },
  // ── batch-3 routines ──
  0x0534: { name: "loc_0534", role: "clear the player-1 slot byte (0x825C) and the five occupancy gates (0x825E-0x8262), then transfer to the shared cold-start mid-entry 0x0567; no register live-in, memory-only live-out", cert: "code" },
  0x0670: { name: "loc_0670", role: "stamp all five home-slot markers: for each slot base (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864) load HL and call 0x0695 to fill its 2x2 marker block, clear 0x842F, then tail into the extra-life award 0x0A5F (whose result it returns); no register live-in, memory-only live-out", cert: "code" },
  0x06ee: { name: "loc_06ee", role: "swap the active player's work pages IN for player 1 — four bank copies (object+work pages saved to one bank, restored from another) plus the swap-done flag; any other player number tails to the swap-OUT path 0x0726; memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x07ac: { name: "loc_07ac", role: "drain one queued sound command: when the pending count at 0x8300 is non-zero, decrement it, issue the front command byte (0x8301) via the sound issuer 0x0794, then shift the queue down one slot (a count-length copy from 0x8302); reached only from the in-game NMI branch 0x0103; live-out memory (count + queue) + sound IO", cert: "code" },
  0x07c1: { name: "loc_07c1", role: "2-player start-flag helper: if (0x83fd)==1 delegate to 0x07ce (raise start flag under the 0x826d guard), else set (0x825b)=1; memory-only live-out", cert: "code" },
  0x085b: { name: "loc_085b", role: "[code] no-more-frogs tail (from the 0x0870 score driver's jp z): blits a 4-tile then a 5-tile strip up the VRAM column at 0xaa51 via the tile-column blit 0x0028 (the second continuing the destination the first left in HL), then raises the hold flag 0x8004; memory-only live-out", cert: "code" },
  0x0aba: { name: "loc_0aba", role: "one-time display-field setup, guarded by 0x842D: when 0x842D is 0 set it to 1, write 0x803F=3 and 0x83E0=0, blit a 4-tile strip up a column via rst 0x28 (HL=0xA8BF, DE=0x2F6E, B=4), fill 15 tile rows of tile 12 down the column from 0xA8DF (+32/row), then seed 0x83DC=0x3C20 and 0x83DE=0x60; non-zero 0x842D returns immediately; no register live-in, memory-only live-out", cert: "code" },
  0x0ba0: { name: "loc_0ba0", role: "print one packed-BCD byte as two tilemap digits (high nibble then low) via the digit-writer 0x0ba9: write the high nibble, then TAIL-call the writer for the low nibble so the writer's ret returns to loc_0ba0's caller; the writer steps the destination up one 32-cell row per digit; live-out memory + HL (destination stepped up two rows). Non-leaf; code-level, MAME-grounding pending", cert: "code" },
  0x0c3d: { name: "loc_0c3d", role: "draw the two-digit intro pair: load the digit pair (low byte 0x83FB, high byte 0x83FC) with a fixed row base and stamped byte, then run the row-draw helper 0x0c4a twice -- once for the low digit, then (fall-through tail) for the high digit; a zero digit draws nothing; memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x0db9: { name: "loc_0db9", role: "queue the credit/1UP header tiles: with exactly one credit blit the 1UP strips (a 4-tile column then an 11-tile column from a second tile source); otherwise set the header-state marker (0x8023)=3, blit a 4-tile then a 13-tile column and cap the advanced cursor with tile 35; both columns advance the shared HL/DE pointers via m.call(0x0028) which the routine reads back; memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x0de0: { name: "loc_0de0", role: "the attract board-demo cell assembler: on each dwell expiry (0x83BC), place one river-object cell for the current phase (0x83D7) -- stamp its 2x2 tile corner in VRAM (0xA8C6 + 96*(phase-1)) and clear its 4-byte object block (0x8040 + 4*(7-phase)) -- then step the phase counter, and when all seven are placed reload it to 7, reset the attract sequencer (0x83BF/0x83BB=0), and tail-call the attract-idle tail 0x0E74; no register live-in, memory-only live-out", cert: "code" },
  0x0f59: { name: "loc_0f59", role: "redraw one status line: clear its 4-tile-group VRAM column via 0x19E2, then stamp a 9-tile string via rst 0x28 from a fixed source; no register live-in, memory-only live-out", cert: "code" },
  0x0f69: { name: "loc_0f69", role: "pack the player-2 score (0x83EB) and the high score (0x83ED) into the score display field 0x83FB: order the two 16-bit words larger-first, run each through the score-rank helper 0x0A84 (D,E key -> A rank code), and store the larger word's rank code at 0x83FB and the smaller's at 0x83FC; no register live-in, memory-only live-out", cert: "code" },
  0x1058: { name: "loc_1058", role: "[code] frog-animation render arm (a 0x0faf jp-table target): runs the guarded pre-blit 0x0f8c, loads the 0x8273 sprite triple and 0x13ef pattern pointer, arms both 0x8109 plot cursors, stores the plot byte at 0x81b1 and source pointer at 0x8001, then tail-calls the shared render loop 0x0ff1; memory-only live-out", cert: "code" },
  0x10f8: { name: "loc_10f8", role: "frog-animation arm 6: read the arm's sprite triple, arm the shared render loop's cursors/pointers/counts and stash the code+source it rereads, then enter the loop 0x0ff1; memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x12e4: { name: "loc_12e4", role: "upper-half horizontal-move dispatcher: return if the move is already resolved (0x8004!=0), else pick one of 16 arms by the frog-X high nibble through the pointer table at 0x130B -- 5 arms scan no lane, 10 scan a lane object list for an object inside the frog's move band; an in-band object sets the block flag 0x8004=1, a clear lane transfers to the frog-kill tail 0x12D0 when the frog is not yet across; memory-only live-out", cert: "code" },
  0x1952: { name: "loc_1952", role: "frog sprite render: copy three ROM 4-tile groups (0x19f6/0x19fa/0x19fe) down VRAM columns, stamp the banner column + four box corners, blit the home-marker string (0x19e2), set 0x8007/0x8009/0x800b=1, then tail-chain object-anim init (0x1a02); memory-only live-out", cert: "code" },
  0x2005: { name: "loc_2005", role: "NMI scroll driver: copy each scroll object's byte into its shadow, step object A's counter by 1 (>=80 runs the reveal-column stamp 0x20fb) and object B's by 2 (<160 runs the band blit 0x219c), then advance the phase counter and at 16/32/48 feed each object's descriptor into the scroll copy engine (0x20cc grid + 0x20bf band entry), phase 48 also clearing the counter to 0; callees reached via m.call, memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x23b7: { name: "loc_23b7", role: "per-vblank river-lane arrival setup: point the cursors at the frog X/Y cells, then for each of the four ride lanes tail to that lane's commit handler (0x1bba/0x1c0d/0x1c76/0x1cd5) when its direction flag is set, else clear the lane's mirror flag; memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x27b3: { name: "loc_27b3", role: "collision-flag reset (guarded entry): if (0x8135)==0 return, else zero (0x8134) and fall through to 0x27bc, which clears 0x8040-0x8043 and (0x8135); memory-only live-out", cert: "code" },
  0x27ea: { name: "loc_27ea", role: "dive/turtle animation driver: dispatch on the dive phase (0x83B7) -- below 2 hands to the idle arm 0x2873, at/above 5 to arm 0x2874; the middle band reloads 0x8101 and when it is 0 runs 0x288c (with 0x27FE pushed as its return) before continuing into the shared surface-timer step 0x27FE; no register live-in, memory-only live-out", cert: "code" },
  0x287e: { name: "loc_287e", role: "arm the frame-cell block once: when the busy latch 0x814f is clear, set 0x8150=1 and seed 0x8146/0x8147 from (0x819b & 0x0f)*8, then raise 0x814f so a later pass does not re-seed (folds the shared 0x289c seed helper inline as a JS helper); memory-only live-out, [code]-level, MAME-grounding pending", cert: "code" },
  0x28bb: { name: "loc_28bb", role: "frog-vs-diver collision test gated on 0x8150 bit0 and dive phase 0x83b7>=2: box-checks the frog (0x8047 Y, 0x8044 X) against the diver's Y band and the X window around 0x8101 -- inner overlap tail-calls the frog-kill routine 0x12d0, outer overlap stamps the 2x2 mounted-frog tile quad (0x68..0x6b) at 0xa846 and sets 0x8004=1; memory-only live-out, [code]-level, MAME-grounding pending", cert: "code" },
  0x2af3: { name: "loc_2af3", role: "IX sprite-object motion arm: skipped when the record's active flag (ix+6) is 0; else run the arm helper 0x2ae6, derive on-screen X into iy+0 from ix+4 vs 0x60 (either 0x8014-(ix+2) or ix+3), mirror ix+4 into iy+3/iy+7, set iy+4 from a +15/-15 bias on ix+5, and on the fold (bias wraps to 0) plus retire flag (ix+7) clear ix[0..15]/iy[0..7] and set ix+0x0a=0x20; one of the five per-slot arms run by dispatcher 0x29b9; memory-only live-out", cert: "code" },
  0x2b93: { name: "loc_2b93", role: "IX sprite-object arm: when (IX+6)!=0, read the 0x80-page table byte indexed by (IX+0x0b), store (table byte - (IX+2)) to (IY+0) and (IX+4) to (IY+3); live-in IX (object struct) + IY (sprite slot), memory-only live-out, [code]-level, MAME-grounding pending", cert: "code" },
  0x2bab: { name: "loc_2bab", role: "[code] IX sprite-object motion arm (from the sprite dispatcher 0x2b83): active while (IX+6)!=0, counts down the (IX+9) move timer (reload 8); on expiry reads the per-object target at 0x80(IX+0x0b) and steps (IX+2) one toward it along (IX+0) (facing!=0) or (IX+1) (facing==0) by comparing the 8-bit gap to (IY+0), or on reaching the target despawns -- clearing the 16-byte struct at IX and the 4-byte block at 0x8058 -- unless the hold flag 0x8004 is set; memory-only live-out", cert: "code" },
  0x2bfb: { name: "loc_2bfb", role: "stage an active IX sprite-object's attribute + code into its IY sprite slot: when the object-state byte (ix+6) is non-zero, index the 0x2cd9 attribute table by that state, OR in the object flag bits (ix+5), write the result to (iy+1) and set (iy+2)=2; an inactive object (state 0) returns untouched; live-in IX/IY (oracle boundary), memory-only live-out. Leaf; code-level, MAME-grounding pending", cert: "code" },
  0x2c13: { name: "loc_2c13", role: "spawn an inactive IX sprite-object: gated on the level count 0x83b7>=3 and the slot being idle (ix+6==0). Four spawn-PRNG draws (0x0aee) density-gate the spawn (u8(8*count+128) >= roll), pick 1 of 5 variants and its tile/attribute (ix+4 = variant*16+48), and set orientation (ix+3/ix+5); two fixed tables (0x2ce6 spans/seed, 0x2cdc pointer) feed a repeated-subtraction loop that resolves the position bytes (ix+0/1/2); on success arms the object with (ix+6)=1,(ix+9)=8. Memory-only live-out. Non-leaf; code-level, MAME-grounding pending", cert: "code" },
  0x2ca8: { name: "loc_2ca8", role: "IX sprite-object proximity arm (leaf): when the object is active ((IX+6)!=0) and on the frog row ((IX+4)==(0x8047)), adjust the sprite Y ((IY+0)) by +20 when the direction bit (IX+5) is clear else -4, and if the result lands in [0,16) ahead of the frog X (0x8044) raise the hit flag (0x8004)=1 and mark the object hit-consumed (IX+6)=2; live-in IX record / IY slot, memory-only live-out", cert: "code" },
  0x2d88: { name: "loc_2d88", role: "mode-2 intro: set 0x83d8=0xff, fill the play-field tilemap (0x0766), seed 0x829b=0/0x8021=0/0x801b=5/0x802b=3, blit the 11-tile title strip from 0x2f5c to 0xaa8d (rst 0x28); if the shared time byte 0x83e4 is >=10 return, else draw one score digit (0x0ba9) at 0xab15 and blit three more strips (0x2fae/0x2f73/0x2f92); tail-called from the mode dispatcher 0x0d11; memory-only live-out", cert: "code" },
};
