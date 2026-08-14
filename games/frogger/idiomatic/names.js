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

// ── batch-2 cells: scroll engine, lane/home markers, fly patrol, sprite-object arms, animation clocks, game-start clears ──
export const loc_8001 = 0x8001; // [code] scroll-copy source-pointer scratch (word); loc_20cc saves the source pointer here and the per-column loop reloads it
export const loc_8003 = 0x8003; // [code] scroll-copy row-count scratch; loc_20cc saves the row count here and the per-column loop reloads it
export const loc_8004 = 0x8004; // [code] hold flag / object-frog hit flag; loc_25ce stamps the slot but leaves the selector pending when non-zero, loc_2b58 sets it to 1 (with gate loc_842c) when a sprite object overlaps the frog
export const loc_800d = 0x800d; // [code] object-animation state block base; loc_1a02 seeds 10 stride-2 cells (0x800d-0x801f) from a fixed table at board init
export const loc_8014 = 0x8014; // [code] frog X; loc_29f9 reads it as the target the motion arm drifts each sprite object toward or away from
export const loc_8021 = 0x8021; // [code] object-animation cell block base; loc_1a02 seeds 14 stride-2 cells (0x8021-0x803b) from a fixed table at board init
export const loc_8040 = 0x8040; // [code] fly sprite X position / base of the four-cell block loc_27cb arms; loc_272f writes lane base loc_811c + path-table offset, loc_27cb arms it with the lead byte + fixed tail 25,3,16 (sibling loc_27de zeroes 0x8040-0x8043)
export const loc_8041 = 0x8041; // [code] fly sprite code; loc_272f sets it at the timer midpoint (33 or flipped 0xA1) and to the turn sprite (30) at an endpoint
export const loc_805c = 0x805c; // [code] base of the 4-byte timer/counter block loc_269a clears to zero (0x805C-0x805F)
export const loc_8101 = 0x8101; // [code] loc_291d idle-clears the figure-animation phase when this is 0, else runs the animation
export const loc_8107 = 0x8107; // [code] scroll edge flag; loc_20fb clears it on the 128/176 arm and sets it to 1 on the 160 arm
export const loc_8108 = 0x8108; // [code] scroll wrap-latch; loc_219c raises it to 1 on the mode-80 phase and clears it on the mode-48/96 phases
export const loc_8110 = 0x8110; // [code] scroll-phase selector; loc_20fb dispatches on it (80/208, 128/176, 160) to pick the stamp table
export const loc_8111 = 0x8111; // [code] scroll-phase mode; loc_219c dispatches the source-row choice on it (0/112->A, 48/96->B, 80->C), loc_2005 steps it by 2
export const loc_8118 = 0x8118; // [code] frog-anim blit trigger; loc_0f8c blits the tile pair when non-zero then clears it to 0, else returns at once
export const loc_8119 = 0x8119; // [code] scroll row-span shadow; loc_219c stores row count - 1 here at exit
export const loc_811a = 0x811a; // [code] scroll-object row-count mirror; loc_20fb writes (row-count field - 1) here before returning
export const loc_811c = 0x811c; // [code] fly lane X base; loc_272f adds it to the path-table offset to form the sprite X at loc_8040
export const loc_8120 = 0x8120; // [code] scroll-timer mirror/source cell; loc_2496 writes the scroll value here, loc_2532 reads it as its 1..5 lane index, loc_25ce clears it with loc_8121
export const loc_8121 = 0x8121; // [code] scroll-timer mirror / pending frog-home slot selector (1..5); loc_23fa/loc_2532 write it, loc_25ce dispatches on it to pick a slot and clears it after stamping
export const loc_8123 = 0x8123; // [code] lane-scroll timer / river-object phase counter (mod 6); loc_23eb increments-and-wraps it, loc_23fa/loc_2496 read it as the 1..5 lane index and mirror it
export const loc_8145 = 0x8145; // [code] one of five cells loc_2856 zeroes in play-mode 2
export const loc_8146 = 0x8146; // [code] one of five cells loc_2856 zeroes in play-mode 2
export const loc_8147 = 0x8147; // [code] one of five cells loc_2856 zeroes in play-mode 2
export const loc_814e = 0x814e; // [code] one of five cells loc_2856 zeroes in play-mode 2
export const loc_814f = 0x814f; // [code] sprite-frame busy latch 1; loc_1802 returns without stepping while non-zero, loc_291d reads it as a busy gate that must be 0, loc_2856 zeroes it in play-mode 2
export const loc_8150 = 0x8150; // [code] loc_291d gates its step on bit0 of this cell
export const loc_815b = 0x815b; // [code] sprite-frame busy latch 2; loc_1802 returns without stepping while it is non-zero
export const loc_819b = 0x819b; // [code] animation frame buffer; loc_1802 copies 11 bytes of the current frame source into it
export const loc_81b1 = 0x81b1; // [code] scroll-copy column stride; loc_20cc advances the destination by this between columns
export const loc_81b3 = 0x81b3; // [code] animation frame index; loc_1802 advances it into the loc_1841 pointer table, wrapping to 0 at index 10
export const loc_81b4 = 0x81b4; // [code] animation frame timer; loc_1802 ticks it down each pass and reloads it to 21 when it reaches 0
export const loc_825e = 0x825e; // [code] lane-1 / home-slot-1 object-present gate, primary bank (used when (0x83FD)==1); loc_23fa/loc_2496/loc_2532/loc_25ce skip the lane marker/slot when non-zero
export const loc_825f = 0x825f; // [code] lane-2 / home-slot-2 object-present gate, primary bank ((0x83FD)==1); marker/slot skipped when non-zero
export const loc_8260 = 0x8260; // [code] lane-3 / home-slot-3 object-present gate, primary bank ((0x83FD)==1); marker/slot skipped when non-zero
export const loc_8261 = 0x8261; // [code] lane-4 / home-slot-4 object-present gate, primary bank ((0x83FD)==1); marker/slot skipped when non-zero
export const loc_8262 = 0x8262; // [code] lane-5 / home-slot-5 object-present gate, primary bank ((0x83FD)==1); marker/slot skipped when non-zero
export const loc_8263 = 0x8263; // [code] lane-1 / home-slot-1 object-present gate, alternate bank (used when (0x83FD)!=1); marker/slot skipped when non-zero
export const loc_8264 = 0x8264; // [code] lane-2 / home-slot-2 object-present gate, alternate bank ((0x83FD)!=1); marker/slot skipped when non-zero
export const loc_8265 = 0x8265; // [code] lane-3 / home-slot-3 object-present gate, alternate bank ((0x83FD)!=1); marker/slot skipped when non-zero
export const loc_8266 = 0x8266; // [code] lane-4 / home-slot-4 object-present gate, alternate bank ((0x83FD)!=1); marker/slot skipped when non-zero
export const loc_8267 = 0x8267; // [code] lane-5 / home-slot-5 object-present gate, alternate bank ((0x83FD)!=1); marker/slot skipped when non-zero
export const loc_826a = 0x826a; // [code] gated countdown counter; loc_1fc7 decrements it and, when it reaches 0, clears the enable flag loc_826c
export const loc_826c = 0x826c; // [code] countdown enable flag; loc_1fc7 returns early while it is 0 and clears it to 0 once loc_826a reaches 0
export const loc_8270 = 0x8270; // [code] active player's lane-parameter block (33 bytes); loc_223d copies the selected difficulty block into here
export const loc_8273 = 0x8273; // [code] scroll-object block base; loc_20fb reads its row/column/row-count fields (+0/+1/+2) to build the VRAM stamp address
export const loc_827c = 0x827c; // [code] scroll-band descriptor base; loc_219c reads column (+0), unit count (+1), row count (+2) to place the video band
export const loc_8293 = 0x8293; // [code] player 1 difficulty index; loc_223d reads it to index the lane-parameter pointer table
export const loc_8294 = 0x8294; // [code] player 2 difficulty index; loc_223d reads it when the active player (0x83FD) is not 1
export const loc_8340 = 0x8340; // [code] arm cell loc_27cb sets to 160 alongside the four-cell block
export const loc_833d = 0x833d; // [code] fly travel direction/step byte; bit7 = direction (also the sprite flip bit), low 7 bits = path-table step index, walked by loc_272f
export const loc_833e = 0x833e; // [code] fly tongue/attack timer; loc_272f counts it down each frame and reloads it to 60 at a path endpoint or hold
export const loc_833f = 0x833f; // [code] figure-animation phase loc_291d increments; blits at 64 and 112, clears it at 112 and whenever idle
// ROM tables read by the batch-2 routines
export const loc_13ef = 0x13ef; // [code] scroll-copy destination-base pointer (ROM); loc_20cc loads the VRAM destination base from here (0xa808)
export const loc_1413 = 0x1413; // [code] ROM tile-pair pattern source read by loc_0f8c, two bytes per row for 8 rows
export const loc_1841 = 0x1841; // [code] ROM table of 16-bit frame-source pointers; loc_1802 reads entry (loc_81b3) to find the 11-byte frame to copy
export const loc_2190 = 0x2190; // [code] scroll stamp table (ROM) for the 80/208 phase arm; loc_20fb copies its bytes into VRAM
export const loc_2194 = 0x2194; // [code] scroll stamp table (ROM) for the 128/176 phase arm; loc_20fb copies its bytes into VRAM
export const loc_2198 = 0x2198; // [code] scroll stamp table (ROM) for the 160 phase arm; loc_20fb copies its bytes into VRAM
export const loc_2231 = 0x2231; // [code] scroll source tile row A (4 bytes); loc_219c blits it on modes 0 and 112
export const loc_2235 = 0x2235; // [code] scroll source tile row B (4 bytes); loc_219c blits it on modes 48 and 96
export const loc_2239 = 0x2239; // [code] scroll source tile row C (4 bytes); loc_219c blits it on mode 80
export const loc_2260 = 0x2260; // [code] lane-parameter pointer table (little-endian block pointers); loc_223d indexes it by 2*difficulty to reach the selected block
export const loc_279f = 0x279f; // [code] ROM base of the fly X-offset path table indexed by loc_272f (entry value 0 = endpoint/reverse, 1 = hold, >=2 = X offset)
export const loc_2cd5 = 0x2cd5; // [code] phase-tile table (ROM); loc_29c9 indexes it by the stepped phase for the sprite tile the animation arm stages
// IO + VRAM bases the batch-2 routines touch
export const loc_8800 = 0x8800; // [code] watchdog reset_r port; loc_1048 reads it once per settle pass to keep the dog fed (the read count is the io live-out)
export const loc_a800 = 0xa800; // [code] VRAM base; loc_1198 computes HL minus this (less the incoming borrow) as the render offset it folds into the column index returned in C
export const loc_a806 = 0xa806; // [code] VRAM destination base for loc_0f8c's 8-row tile-pair blit (two bytes per row, dest steps +32 per row)
export const loc_a80e = 0xa80e; // [code] scroll-band video-RAM base; loc_219c offsets it by stride*rowSteps to reach the band's top cell
export const loc_a846 = 0xa846; // [code] first tile cell of the two-pair figure loc_291d blits (second pair one row / +32 below at 0xA866)

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
  0x0ba9: { name: "loc_0ba9", role: "write one BCD digit (A low nibble) at (HL), then step HL up one 32-cell tilemap row (16-bit borrow); memory + HL live-out (loc_0ba0 chains two calls reusing the stepped HL)", cert: "code" },
  0x0c4a: { name: "loc_0c4a", role: "intro digit-page stamper: write tile E into page H at row (D - C), or nothing when C==0 (offset equals the row base); register live-ins D/C/E/H, memory-only live-out", cert: "code" },
  0x0e74: { name: "loc_0e74", role: "force the game mode (GAME_MODE 0x83D6) to 5 (attract-idle), the credits-present tail of the attract sequencer; memory-only live-out", cert: "code" },
  0x0f8c: { name: "loc_0f8c", role: "frog-anim pre-helper: when the trigger cell is set, blit an 8-row two-byte-per-row tile pair from a fixed pattern source down a VRAM column (+32 per row) then clear the trigger; a clear trigger returns at once; memory-only live-out", cert: "code" },
  0x1048: { name: "loc_1048", role: "power-on settle delay: feed the watchdog once per pass across a long count; the counter spin is pure time (collapsed away), the watchdog read count is the io live-out, memory unchanged", cert: "code" },
  0x1198: { name: "loc_1198", role: "coord/column compute for the tile render loop: from HL's distance to the VRAM base (less incoming borrow) fold one probed H bit and the shifted top column bits across 6 passes plus 3 final rotates into an accumulator; live-in HL+carry, live-out register C", cert: "code" },
  0x1802: { name: "loc_1802", role: "step the frame-cell animation: return early while either busy latch (0x814f/0x815b) is set; else tick the frame timer (0x81b4) down, and when it reaches 0 reload it to 21, advance the frame index (0x81b3) wrapping to 0 at 10, and copy 11 bytes of the indexed frame (via the 0x1841 pointer table) into the 0x819b buffer; memory-only live-out", cert: "code" },
  0x19e2: { name: "loc_19e2", role: "blit a 14-row VRAM column of the 4-tile group (tiles 72/73 across the top of each row pair, 74/75 across the row below) from the caller-supplied HL base, advancing 64 bytes per pair; HL live-in, memory-only live-out", cert: "code" },
  0x1a02: { name: "loc_1a02", role: "seed the object-animation state at board init: fill 14 stride-2 cells from base 0x8021 and 10 stride-2 cells from base 0x800d with fixed value tables (cell i takes seed i); no live-in, memory-only live-out", cert: "code" },
  0x1fc7: { name: "loc_1fc7", role: "tick a gated countdown: while the enable flag loc_826c is 0 do nothing, else decrement counter loc_826a and clear the enable flag when it reaches 0; no register live-in, memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x20cc: { name: "loc_20cc", role: "scroll-copy engine: stamp a source block into VRAM as a grid of two-byte column pairs -- save source/row-count to scratch (loc_8001/loc_8003), then for C columns copy B rows of a pair from the source (restarted each column) down the destination at a 32-byte row pitch, advancing by the column stride loc_81b1 between columns; count 0 runs 256; live-in DE source/B rows/C columns, memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x20fb: { name: "loc_20fb", role: "scroll-reveal column stamp: build a VRAM address from the scroll object's row/column/row-count fields (loc_8273 +0/+1/+2), then dispatch on the scroll-phase byte loc_8110 -- phases 80/208 use table loc_2190, 128/176 use loc_2194 and clear edge flag loc_8107, 160 uses loc_2198 and sets loc_8107, any other stamps nothing -- and always write the row-count-minus-one mirror loc_811a; no register live-in, memory-only live-out; code-level, MAME-grounding pending", cert: "code" },
  0x219c: { name: "loc_219c", role: "scroll-band blitter: from the 3-byte descriptor at 0x827C (column/units/rows) compute a video-RAM band base (0xA80E + stride*rowSteps), then the scroll-phase mode (0x8111) selects one of three 4-byte source rows (0x2231/0x2235/0x2239) blitted 6 rows down the band; raises the wrap-latch (0x8108) on the mode-80 phase, clears it on modes 48/96, and stores rows-1 to (0x8119); memory-only live-out", cert: "code" },
  0x223d: { name: "loc_223d", role: "load the active player's per-difficulty lane-parameter block: read the difficulty index (0x8293 for player 1, else 0x8294, chosen by 0x83FD), follow the little-endian pointer table at 0x2260 indexed by 2*difficulty, and copy 33 bytes of that block into 0x8270; runs under EXX so caller BC/DE/HL are preserved; memory-only live-out", cert: "code" },
  0x23eb: { name: "loc_23eb", role: "river-object phase counter: (0x8123) += 1, wrapping to 0 when it reaches 6 (a mod-6 lane-animation frame index); live-out memory + A (the new counter value, which a tail caller returns in A)", cert: "code" },
  0x23fa: { name: "loc_23fa", role: "lane scroll-marker setup: mirror the scroll timer (0x8123)->(0x8121), then for lane index (0x8123)==1..5 stamp a 2x2 tile marker (0x2C/0x2D over 0x2E/0x2F) into that lane's VRAM home (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864) when the lane object-present flag is clear; (0x83FD)==1 selects the primary 0x825E.. flag bank, else the alternate 0x8263.. bank; memory-only live-out", cert: "code" },
  0x2496: { name: "loc_2496", role: "lane scroll-marker setup: mirror the scroll timer (0x8123)->(0x8120), then for lane index (0x8123)==1..5 stamp a 2x2 tile marker (0x10/0x10 over 0xD0/0xD1) into that lane's VRAM home (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864) when the lane object-present flag is clear; (0x83FD)==1 selects the primary 0x825E.. flag bank, else the alternate 0x8263.. bank; memory-only live-out", cert: "code" },
  0x2532: { name: "loc_2532", role: "lane scroll-marker setup: mirror (0x8120)->(0x8121), then for lane index (0x8120)==1..5 stamp a 2x2 tile marker (0xD0/0xD1 over 0xD2/0xD3) into that lane's VRAM home (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864) when the lane object-present flag is clear; (0x83FD)==1 selects the primary 0x825E.. flag bank, else the alternate 0x8263.. bank; memory-only live-out", cert: "code" },
  0x25ce: { name: "loc_25ce", role: "stamp one frog-home slot's 2x2 tile block (base, +1, +32, +33, tile 16) when its per-player gate cell reads zero, slot picked by the pending-slot selector 0x8121 (1..5); then clear the 0x8121/0x8120 selector pair unless the hold flag 0x8004 is set; no register live-in, memory-only live-out", cert: "code" },
  0x269a: { name: "loc_269a", role: "clear the 4-byte block 0x805C-0x805F to zero; no register live-in, memory-only live-out", cert: "code" },
  0x272f: { name: "loc_272f", role: "drive the fly's horizontal patrol: while the tongue timer 0x833E counts down, re-render the sprite X position 0x8040 (lane base 0x811C + path-table 0x279F offset) and flip the sprite code 0x8041 at the timer midpoint; at zero advance one path step in 0x833D (bit7=direction, low 7=index), reversing direction at an endpoint (table value 0, reload+turn sprite) or holding (table value 1, reload only); no register live-in, memory-only live-out", cert: "code" },
  0x27cb: { name: "loc_27cb", role: "arm a four-cell block at 0x8040 with the caller's lead byte (reg B) plus a fixed tail (25,3,16), then set arm cell 0x8340=160; memory-only live-out", cert: "code" },
  0x2856: { name: "loc_2856", role: "when play-mode cell 0x83FE holds 2, zero five cells (0x814F,0x814E,0x8145,0x8146,0x8147); otherwise return untouched; memory-only live-out", cert: "code" },
  0x291d: { name: "loc_291d", role: "two-pair figure animation: when 0x8101==0 clear phase 0x833F; else gated by 0x8150 bit0 and 0x814F==0, bump 0x833F and at phase 64/112 blit tiles into 0xA846/0xA866 (frame 104.. or 208.., the latter restarting the phase); memory-only live-out", cert: "code" },
  0x29c9: { name: "loc_29c9", role: "[code] IX sprite-object animation arm: counts down the (IX+8) frame timer, on expiry reloads it (12), steps the (IX+6) phase (counting down, 1 wrapping to 4), reads the 0x2cd5 phase-tile table, folds in the (IX+5) flip bits, and stages the IY sprite tile/attr pair (iy+1,iy+5=+1,iy+2=iy+6=4); memory-only live-out", cert: "code" },
  0x29f9: { name: "loc_29f9", role: "[code] IX sprite-object motion arm: active while (IX+6)!=0 and the global gate 0x842c==0, counts down the (IX+9) move timer (reload 8); on expiry, past sprite row 96 it steps (IX+3) by +/-2, else drifts (IX+2) toward/away from the frog X (0x8014) along (IX+0/+1) and flips the direction bit (IX+5)/(IY+1) at the turn; memory-only live-out", cert: "code" },
  0x2b58: { name: "loc_2b58", role: "[code] IX sprite-object hit-test arm (leaf): gated on (IX+6), fires only when (IX+4)+2 == frog row (0x8047), then measures |(IY+0)[+16 when (IX+5)!=0] - (0x8044)| and, when it lands in [0,16), raises the hit flag 0x8004 and the global gate 0x842c (both =1); memory-only live-out", cert: "code" },
};
