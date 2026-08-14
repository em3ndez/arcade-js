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
};
