# Frogger — how the machine actually works

A code-grounded model of Konami's Frogger (`frogger`, 1981), built from the translated ROM, the
routines the idiomatic layer has rewritten, and the real machine under MAME. Its companion is
`gameplay.md`, which describes the same game from the outside, blind to the code. This document
answers what the code can settle and is honest about what it cannot.

**Confidence tags, not decoration:**
- **`[seen]`** — observed on the real ROM under MAME; **`[seen,poked]`** when the trigger was forced by
  a memory poke rather than natural play (the reading is real, the path was forced).
- **`[code]`** — from a translated routine's behaviour; mechanics exact, role inference, MAME did not
  exercise it.
- **`[guess]`** — plausible, unverified.

A role is `[seen]` only if its evidence terminates in MAME, never our own engine. Where a cell's role
is counterintuitive from the code alone, the map flags it inline. Data cells carry a tag too, not only
routines: a cell is `[seen]` once MAME confirms its role (see the data-name registry in `names.js`).

## The frame and the engine

### The two-thread frame model

The machine advances one video frame at a time through two code streams that share the same work RAM. A **foreground main loop**, `drainForegroundThenYieldEachVblank` (0x0341) [seen], free-runs continuously: it renders the header/credit line, reads the START buttons, and starts games, but writes no *accumulating* state — every value it sets is re-derived from scratch each cycle, so it is a per-frame **fixed point**. A **vblank NMI**, `serviceVblankNmi` (0x0066) [seen], preempts that loop once per displayed frame and does *all* per-frame accumulation: it copies the sprite shadow to the display, scans coins, ticks every timer, and steps the in-play or attract sub-engines by one frame. The NMI is therefore the frame clock and the sole accumulator; the foreground is idle work that spins on a busy-delay between the NMI's firings. Because the foreground accumulates nothing, spinning it many times between two NMIs lands on identical RAM — that fixed-point property is what defines "one frame."

### The vblank NMI: `serviceVblankNmi` (0x0066)

One frame of interrupt service runs in a fixed order:

1. **Ack.** `NMI_ENABLE` (0xb808) [seen] is written 0 to acknowledge/disable the interrupt latch; the matching write of 1 at the end re-arms it.
2. **Coin scan.** `scanCoinInputAndCredit` (0x2cf0) [seen] latches the inverted IN0 coin/service bits on the first pass, then on the release edge issues the coin sound, pulses the credited slot's hardware counter, adds the slot's packed-BCD credit (clamped at 0x99), and — unless a game is already in play — forces `GAME_MODE` (0x83d6) [seen] to the player-select mode 5 and redraws the credit line.
3. **Sprite-DMA shadow blit** (`blitSpriteShadow`). The work-RAM sprite shadow is copied into OBJRAM so the video hardware sees this frame's sprites. A single lead byte `OBJECT_READY_0` (0x8007) [seen] copies straight to `OBJRAM_SPRITE_DMA_LEAD` (0xb007) [seen]; then 28 two-byte pairs from `SPRITE_SHADOW_SRC_BASE` (0x8008) [seen] to `OBJRAM_SPRITE_BLIT_BASE` (0xb008) [seen], each pair with its **even byte nibble-swapped** (`(v>>4)|(v<<4)`) and its odd byte straight; then a second region whose base and pass count are gated by `HOME_COLUMN_STATE` (0x842f) [seen,poked]: when it is 0, eight 4-byte passes from `FLY_SPRITE_X` (0x8040) [seen,poked] to `OBJRAM_FLY_SPRITE_BASE` (0xb040) [seen]; otherwise six passes from `SPRITE_OBJECT_SLOT_A` (0x8048) [seen] to `OBJRAM_SPRITE_SLOT_A_BASE` (0xb048) [seen]. In each 4-byte pass only byte 0 is nibble-swapped; the other three copy straight. The nibble-swap is the hardware's sprite-attribute encoding.
4. **Coin-counter pulse timers.** `COIN_PULSE_TIMER_1` (0x837f) [seen] and `COIN_PULSE_TIMER_0` (0x837e) [seen], if non-zero, each decrement by one; when either reaches 0 it drops its hardware coin-counter latch — `COIN_COUNTER_1` (0xb81c) [seen] / `COIN_COUNTER_0` (0xb818) [seen] — back to 0, ending the physical counter pulse the coin scanner started.
5. **Cocktail mirror.** When `IN2_PORT` (0xe004) [seen] bit 3 is set and a two-player game is in play with the active player ≥ 2 (`PLAY_FLAG` (0x83fe) [seen] non-zero, `ACTIVE_PLAYER` (0x83fd) [seen] neither 0 nor 1), the OBJRAM copies of the fly and frog Y are offset by +2: `FLY_SPRITE_Y_OBJRAM` (0xb043) [seen] = `FLY_SPRITE_Y` (0x8043) [seen] + 2, `FROG_SPRITE_Y_OBJRAM` (0xb047) [seen] = `FROG_Y` (0x8047) [seen] + 2. This nudges the second player's sprites for the flipped cocktail-cabinet view.

The service then forks on `PLAY_FLAG`:

**In play (`PLAY_FLAG` ≠ 0).** `dequeueSoundCommand` (0x07ac) [seen] pops one queued sound. If `BOARD_LAYOUT_GATE` (0x83ea) [seen] is 0 the board is not yet laid, so the service returns immediately (the epilogue). Otherwise it reads the 16-bit `FROG_TIMER_A` (0x83d2) [seen]: while that timer is non-zero it decrements it and does only the minimal world step — `moveLaneObjectsAndCarryFrog` (0x14b7) [seen] plus `advanceAnimationFrameBuffer` — holding off the full gameplay logic; only when `FROG_TIMER_A` reaches 0 does the **full in-play accumulation cascade** run (below).

**In-play cascade** (reached when `FROG_TIMER_A` = 0): the sound-sequence countdown `SOUND_SEQUENCE_COUNTDOWN` (0x8382) [seen] decrements, and on hitting 0 enqueues the end-of-sequence sound pair (0x0f, 0xb0) and clears `PER_TURN_SCRATCH` (0x8371) [seen]. The cascade then branches on `ACTIVE_PLAYER`: if player 1 has all five bays home (`PLAYER1_SLOT` (0x825c) [seen,poked] = 5) it clears the five primary home-bay occupancy gates (`HOME_BAY1_OCCUPANCY_PRIMARY` (0x825e) [seen,poked] … `HOME_BAY5_OCCUPANCY_PRIMARY` (0x8262) [seen,poked]), zeroes `PLAYER1_SLOT`, and runs the board-complete handler `loc_05d3` (0x05d3) [seen,poked]; the player-2 branch does the same against the alternate-bank gates (`HOME_BAY1_OCCUPANCY_ALT` (0x8263) [seen] … `HOME_BAY5_OCCUPANCY_ALT` (0x8267) [seen]) when `PLAYER2_SLOT` (0x825d) = 5. Otherwise it runs the reveal/collision chain: while `HOME_REVEAL_DELAY_TIMER` (0x8298) [seen,poked] is non-zero it merely drains it; once drained it drains `HOME_REVEAL_COUNTDOWN` (0x8297) [seen,poked]; while `INPLAY_COUNTDOWN_WORD` (0x829d) [seen] is non-zero it waits; only when all three are clear does it drive the score-display countdown (`driveScoreDisplayCountdown` (0x0870) [seen]) and the master collision/input orchestrator `orchestrateCollisionsAndFrogInput` (0x1a55) [seen]. A one-shot latch `GATED_COUNTDOWN_ENABLE_MIRROR` (0x83b5) [seen] then arms the status-row redraw (`STATUS_ROW_BLIT_COUNTDOWN` (0x8384) [seen] = 0xff), and on the first frame that `BOARD_ADVANCE_DONE_FLAG` (0x8380) [seen] is set it reloads `SOUND_SEQUENCE_COUNTDOWN` to 64 and blits the ROM reveal strip `BOARD_ADVANCE_REVEAL_STRIP_SRC` (0x2f7b) [seen] up the `NO_MORE_FROGS_COLUMN_VRAM` (0xaa51) [seen] column via `copyRunUpTileColumn` (0x0028) [seen]. The `STATUS_ROW_BLIT_COUNTDOWN` then ticks and, at 0, blits the four-tile status row (`blitFourTileGroupColumn` (0x19e2) [seen] at `STATUS_ROW_VRAM_BASE` (0xa850) [seen,poked]). Finally the world steps: `advanceScrollLaneObjects` (0x2005) [seen] and `advanceAnimationFrameBuffer` scroll and animate; the frog-vs-lane resolver `dispatchFrogMoveAgainstLanes` (0x11bf) [seen] runs bracketed by ±1 nudges of the lane object-list indices `LANE_OBJLIST_8109` (0x8109) [seen] and `LANE_OBJLIST_8124` (0x8124) [seen] (gated by `SCROLL_EDGE_FLAG` (0x8107) [seen] / `SCROLL_WRAP_LATCH` (0x8108) [seen]) so the frog's collision scan reads the pre-scroll list; then `driveFrogDeathAnimation` (0x16f8) [seen], `moveLaneObjectsAndCarryFrog`, the sprite-object cluster `driveSpriteObjectCluster` (0x2970) [seen], the gated countdown `tickGatedCountdown` [seen], and `loc_0292` (0x0292) [seen] run, and if `HOME_REVEAL_COUNTDOWN` is non-zero it stamps that bay's home frog via `stampHomeBayFrogByColumn` (0x06a2) [seen].

**Attract / intro (`PLAY_FLAG` = 0).** If `GAME_MODE` ≥ 2 (an intro/point-table mode) a pacing countdown `POINT_TABLE_DRAW_STATE` (0x83d8) [seen] decrements; when it drains to 0 *and* `ATTRACT_DEMO_PHASE_COUNTER` (0x83d7) [seen] is 0, `GAME_MODE` steps down by one, advancing the intro sequence toward attract/play. If `GAME_MODE` = 0 the attract demo sequencer `driveAttractDemoSequencer` (0x0e7a) [seen] runs. In either sub-2 mode the service then calls `driveInPlayFrameUpdate` (0x2341) [seen] (a bare return outside active play) and scrubs the per-frame demo scratch so attract holds a clean slate: `FROG_STATE_DEMO_FLAG` (0x83cd) [seen], `loc_83cf` (0x83cf) [seen], `GATED_COUNTDOWN_ENABLE_MIRROR`, the word `PLAYER1_DIFFICULTY_INDEX` (0x8293) [seen], the whole slot/occupancy run `PLAYER1_SLOT` … `HOME_BAY5_OCCUPANCY_ALT` (0x825c–0x8267), and the ungrounded cells `loc_83af` (0x83af) = 0x80, `loc_83b0` (0x83b0) = 0, `loc_83b1` (0x83b1) = 0.

**Epilogue.** Every arm converges on writing `NMI_ENABLE` = 1, re-arming the interrupt. The observable result of the whole handler is memory: the OBJRAM shadow, the credit/coin state, the timers, and the stepped sub-engine state.

### The foreground main loop: `drainForegroundThenYieldEachVblank` (0x0341)

The foreground loop body has two ROM entry points: the **head** `MAIN_LOOP_HEAD` (0x0341) and the **pace tail** `PACE_TAIL` (0x0368) [seen] — the in-play play tree re-enters at the tail (skipping the head) once it has finished a frame's foreground, because the in-play dispatcher runs the head's render work itself. One pass (`runOneForegroundPass`) does:

**Head work** (only when entered at the head): if `GAME_MODE` ≥ 2, the intro/attract mode state machine `dispatchGameModeFrame` (0x0d11) [seen] runs; then `renderScoreHeader` (0x0b1f) [seen] draws the score row, `renderCreditLine` (0x0b67) [seen] draws the credit line unless `GAME_MODE` = 1, and `setUpPlayStartOnce` (0x230f) [seen] does once-per-life start setup. The six frog-hop step/reload constants are then re-seeded to fixed values every head pass — `FROG_HOP_VERTICAL_DELTA` (0x8254) [seen] = 2, `FROG_HOP_HORIZONTAL_DELTA` (0x8255) [seen] = 2, and the four hop-animation reloads `FROG_HOP_DOWN/UP/RIGHT/LEFT_ANIM_RELOAD` (0x8256–0x8259) [seen] = 9 — which is exactly why they are fixed points, not accumulators: writing a constant is idempotent.

**Pace tail** (the start-scan): if `PLAY_FLAG` ≠ 0, the in-play board/life dispatcher `setUpBoardOrContinueLife` (0x040b) [seen] runs one in-play foreground pass and the loop stays at the tail. Otherwise, if `START_LATCH` (0x83b3) [seen] is already set the pass just returns to the head (a game has begun this frame). Otherwise it reads `IN1_PORT` (0xe002) [seen] — bit 7 START1, bit 6 START2 — to choose a 1- or 2-player start (or no start), and starts only if `CREDIT_BCD` (0x83e1) [seen] holds enough credits for that player count.

**`startNewGame`** is the one-time seed on a valid start: it BCD-deducts the credit, sets `NUM_PLAYERS` (0x8370) [seen], LDIR-clears 0x200 bytes of play RAM at `WORK_PAGE_SAVE_BANK` (0x8500) [seen], then marks the game live — `PLAY_FLAG` = player count, `ACTIVE_PLAYER` = 1, `START_LATCH` = 1, `LIVES_COUNT` (0x83b7) [seen,poked] = 1, and the paired lives word `PLAYER1_LIVES` (0x83b8) [seen,poked] = 0x0101 (both players one life). It seeds score/timers via `initNewGameScoreAndTimers` (0x0b0a) [seen], clears the sound queue and enqueues the start jingle (commands 0x00, 0x09, 0x0a, 0x0b), sets `INPLAY_COUNTDOWN_WORD` = 32, `SOUND_SEQUENCE_COUNTDOWN` = 416, `FROG_TIMER_A` = 0, clears the active player's work RAM and the tilemap, loads the lane parameters for the difficulty, zeroes `HOME_COLUMN_STATE`, `loc_842d` (0x842d) [seen] and the `PLAYER1_DIFFICULTY_INDEX` word, clears 0x50 bytes of the sprite-object records at `SPRITE_OBJECT_RECORD_A_P1` (0x8440) [seen], and sets `HOLD_FLAG` (0x8004) [seen] = 0 and `PLAYER_START_DEMO_FLAG` (0x825a) [seen] = 1. (It also writes the ungrounded `loc_803d` (0x803d) = 3 and `loc_8071` (0x8071) = 0.)

### One frame, and why the foreground is a fixed point

A frame plays out as: the foreground loop spins — rendering the header, and either running the start-scan (attract) or, once a game is live, running one in-play pass through `setUpBoardOrContinueLife` at the pace tail — until the vblank interrupt preempts it. `serviceVblankNmi` then does the frame's real accumulation: it publishes this frame's sprites to OBJRAM, scans coins, ticks every timer down by one, and steps the active sub-engine (attract sequencer / intro pacer / in-play collision-and-motion cascade) by exactly one frame. Control returns to the foreground, which spins again until the next vblank. Because the foreground writes only constants and re-derived render state — never a value it increments or decrements — running its body twice between two vblanks reproduces the identical RAM as running it once; the model relies on this by draining the body to that fixed point each frame (a second drain pass exists only to settle the once-per-life restart cascade, and is otherwise a no-op). All forward motion of the game — timers, positions, scores, mode transitions — therefore happens in the NMI, once per displayed frame.

## The scrolling background and river lanes

The playfield background is redrawn incrementally from two independent "scroll objects" plus a per-object lane-mover that shifts the visible sprite runs. A per-frame clock steps three counters; on threshold crossings it fires a reveal-column stamp, a band blit, and — at three phase marks — a full grid copy through a shared tile-copy engine. Separately, eleven lane objects have their sprite runs shifted each frame, carrying a riding frog. A scripted "attract-demo" frog auto-hops across this background during the demo.

### The per-frame scroll clock

`advanceScrollLaneObjects` (0x2005) [seen] is the scroll driver, run once per in-play frame (it is invoked both from the in-play frame-update sequence in `driveInPlayFrameUpdate` and from the vblank service path). It manages two scroll objects and one master phase counter.

It keeps three free-running byte counters, all stepped every call and wrapped mod 256:

- Object-A counter `SCROLL_STAMP_PHASE` (0x8110) [seen] is incremented by 1. When it reaches or passes 80 the driver calls the reveal-column stamp `stampScrollRevealColumn`.
- Object-B counter `SCROLL_BAND_PHASE` (0x8111) [seen] is incremented by 2. While it is below 160 the driver calls the band blit `blitScrollBand`.
- Master `SCROLL_PHASE_COUNTER` (0x826e) [seen] is incremented by 1. On the exact values 16, 32, and 48 it triggers a lane re-stamp; value 48 is the wrap point and also resets this counter to 0 before its copy.

Before touching each counter the driver snapshots that object's third descriptor byte into a shadow cell: object A's descriptor byte (the +2 field of `SCROLL_OBJECT_BLOCK_BASE`, 0x8273 [seen]) is copied to `SCROLL_STAMP_ROWCOUNT` (0x811a) [seen], and object B's (the +2 field of `SCROLL_BAND_DESCRIPTOR_BASE`, 0x827c [seen]) is copied to `SCROLL_BAND_ROWSPAN` (0x8119) [seen]. Each scroll object is thus a 3-byte descriptor: object A at 0x8273 supplies a column-stride byte (+0), a row count (+1, exported as `SCROLL_OBJ_A_ROW_COUNT`, 0x8274 [seen]), and the shadowed byte (+2); object B at 0x827c is the same shape (its +1 row count is `SCROLL_OBJ_B_ROW_COUNT`, 0x827d [seen]).

### The lane re-stamp

At master phase 16, 32, and 48 the driver runs a two-part re-stamp that feeds both scroll objects into the copy engine. Each phase mark selects a fixed pair of ROM source blocks: phase 16 uses `SCROLL_GRID_SRC_PHASE16` (0x1423) [seen] for the grid and `SCROLL_BAND_SRC_PHASE16` (0x145f) [seen] for the band; phase 32 uses 0x142b [seen] / 0x1473 [seen]; phase 48 uses 0x1433 [seen] / 0x1487 [seen].

The re-stamp first copies object A as a grid: row count from `SCROLL_OBJ_A_ROW_COUNT`, column count from the `SCROLL_STAMP_ROWCOUNT` shadow, and column stride loaded from object A's +0 byte into `SCROLL_COPY_COLUMN_STRIDE` (0x81b1) [seen]. It then copies object B the same way, taking rows from `SCROLL_OBJ_B_ROW_COUNT`, columns from the `SCROLL_BAND_ROWSPAN` shadow, and stride from object B's +0 byte. The phase-48 path clears the master phase counter to 0 immediately before the object-A copy.

### The copy engine

`blitScrollTileGrid` (0x20cc) [seen] stamps a source block into VRAM as a grid of two-byte column pairs. It first parks its source pointer in the scratch word `SCROLL_COPY_SRC_PTR` (0x8001) [seen] and its row count in `SCROLL_COPY_ROWCOUNT` (0x8003) [seen]. It then walks C columns; within each column it copies B rows of a two-byte tile pair from the source down the destination at a 32-byte row pitch (one tilemap row), restarting the source at the top of every column, and between columns it advances the destination by the column-stride byte `SCROLL_COPY_COLUMN_STRIDE`. A count byte of 0 runs its loop the full 256 times (both for rows and columns).

The destination base is read from a ROM pointer cell. The default entry uses `SCROLL_COPY_DEST_PTR` (0x13ef) [seen], which points at VRAM 0xa808; the alternate entry `blitScrollTileGridAlt` is the same loop reading its base from `SCROLL_COPY_DEST_PTR_ALT` (0x13f5) [seen] instead. The lane re-stamp uses the default entry for object A and the alt entry for object B, so the two scroll objects paint into two different VRAM regions from the same copy loop.

### The reveal column

`stampScrollRevealColumn` (0x20fb) [seen] stamps one narrow reveal column into the tilemap for object A, fired by the clock when the object-A counter passes 80. It builds a destination from object A's descriptor: it reads the row field (0x8273 +0), the column field (+1), and the row count (+2), forms a step of `row + (32*column mod 256)`, multiplies that step by a span derived from the row count (row-count 0 → 255 spans, 1 → 256, otherwise row-count − 1), and offsets by the tilemap fill base `TILEMAP_FILL_BASE_22X32` (0xa808) [seen].

It then dispatches on the object-A counter value `SCROLL_STAMP_PHASE` to pick a 4-byte ROM stamp table, and stamps two column-pairs of two rows each (four rows, 32-byte row pitch) from it:

- Counter 80 or 208 → table `SCROLL_STAMP_TABLE_80_208` (0x2190) [seen].
- Counter 128 or 176 → table `SCROLL_STAMP_TABLE_128_176` (0x2194) [seen], and it clears the edge flag `SCROLL_EDGE_FLAG` (0x8107) [seen] if set.
- Counter 160 → table `SCROLL_STAMP_TABLE_160` (0x2198) [seen], and it raises `SCROLL_EDGE_FLAG` to 1.
- Any other counter value stamps nothing.

Every path finishes by writing object A's row-count-minus-one back into the `SCROLL_STAMP_ROWCOUNT` mirror.

### The band

`blitScrollBand` (0x219c) [seen] blits a six-row scrolling tile band for object B, fired while the object-B counter stays below 160. It reads the 3-byte descriptor at 0x827c as column (+0), unit count (+1), and row count (+2). The band's top VRAM cell is `SCROLL_BAND_VRAM_BASE` (0xa80e) [seen] offset by `(column + 32*units mod 256) * rowSteps`, where rowSteps is `(rows − 1) mod 256` or 256 when that is zero.

It selects one of three 4-byte ROM source rows by the object-B counter value `SCROLL_BAND_PHASE`: counter 0 or 112 → `SCROLL_BAND_ROW_A` (0x2231) [seen]; counter 48 or 96 → `SCROLL_BAND_ROW_B` (0x2235) [seen]; counter 80 → `SCROLL_BAND_ROW_C` (0x2239) [seen]; any other value blits nothing. When a source is chosen it copies six rows down VRAM at a 32-byte pitch, alternating between the source's first and second tile pair on even/odd rows. The 48/96 case also clears the wrap latch `SCROLL_WRAP_LATCH` (0x8108) [seen] if set, and the 80 case raises it to 1. On exit it stores `rows − 1` into the `SCROLL_BAND_ROWSPAN` shadow.

### The static tile-group column

`blitFourTileGroupColumn` (0x19e2) [seen] paints a fixed, non-scrolling 14-row column of a repeating 2×2 tile group into VRAM from a caller-supplied base. Each of the 14 iterations writes tiles 72 and 73 across the top row of a pair and tiles 74 and 75 across the row one tilemap row below (a 32-byte pitch), then advances the destination 64 bytes (two rows) to the next pair. The content is constant, so this is a static column stamp rather than a scroll operation. Its callers supply the base: the vblank/render paths and one-time board setup stamp it at the status-row base `STATUS_ROW_VRAM_BASE` (0xa850) [seen,poked], and the frog/home render stamps it at `FROG_RENDER_HOME_MARKER_VRAM` (0xa85c) [seen].

### The lane-object mover

`moveLaneObjectsAndCarryFrog` (0x14b7) [seen] is the per-frame mover that shifts the on-screen sprite runs of the moving lane objects and carries a riding frog. It walks eleven lane objects in a fixed order, keyed on the walk index cell `LANE_OBJECT_INDEX` (0x80ff) [seen], which it increments per object and wraps back to 0 after object 10 so the next frame restarts from object 0.

For each object i it locates four fixed-stride records: a control byte at `ANIM_FRAME_BUFFER` (0x819b) [seen,poked] + i (this 11-byte block is the per-board lane-control table — low nibble = pixel speed, bit 4 = sub-rate flag), a sprite run at `SPRITE_BLOCK2_BASE` (0x8100) [seen] + 9i (a length byte followed by the run of sprite-X bytes), a lead-sprite record at `LIVE_OBJECT_PAGE` (0x800c) [seen] + 4i (with X mirrored at +0 and +2), and a per-object phase countdown at `LANE_OBJECT_PHASE_TABLE` (0x81a6) [seen] + i.

Objects 0/2/3/7/9 move rightward and 1/4/6/8/10 move leftward; object 5 is a spacer that only advances the walk. A mover computes its shift amount `c` from the control byte's low nibble; if that object's phase countdown is already running, or the control byte's bit 4 is set, it instead runs the countdown — ticking it down and holding the object still until the countdown reaches 1, then forcing a single one-pixel step — which lets a lane advance at a sub-frame rate. On a real step it adds (rightward) or subtracts (leftward) `c` from every byte of the sprite run and from the lead sprite's two X mirrors.

The mover then carries the frog if the frog shares this object's cell. It reads `FROG_Y` (0x8047) [seen]; the rightward mover carries only rows inside the lane band (0x30 ≤ row < 0x73), while the leftward mover enforces only the upper bound (row < 0x73) and omits the 0x30 floor — a faithful ROM asymmetry. The row's low nibble picks the cell edge: below 0x03 is the low-edge carry, at or above 0x0c is the high-edge carry; the object index must match the cell column derived from the row's high nibble. On a matching low-edge carry it shifts `FROG_X` (0x8044) [seen] by `c` and flags the frog lost — setting `HOLD_FLAG` (0x8004) [seen] to 1 — if the new X falls below 0x08 or reaches 0xe7 (off either screen edge); the high-edge carry shifts the frog into the next column with no edge test. Objects that don't carry simply clear their phase countdown so they move freely next frame.

### The attract-demo frog

During the attract demo an auto-piloted frog hops across the same background under a canned script. `driveAttractDemoFrogHop` (0x236d) [seen] begins each scripted hop. It returns early while the countdown-enable gate `GATED_COUNTDOWN_ENABLE_FLAG` (0x826c) [seen] or the hold flag `HOLD_FLAG` is set, and while its spawn-dwell counter `ATTRACT_HOP_DWELL` (0x8299) [seen] is nonzero (a running dwell just ticks down). When the dwell drains it reloads the dwell to 0x30, advances a phase index in `IN_PLAY_BOARD_STATE_BYTE` (0x829a) [seen], and reads that phase's frame code from the script table `HOP_FRAME_TABLE` (0x2e68) [seen]. Frame code 0x02/0x05/0x08/0x0b re-runs a LEFT/RIGHT/UP/DOWN hop-begin, 0x0e is a no-op slot, and 0xff ends the script — resetting the phase index and dwell to 0 and clearing `TWO_PLAYER_START_FLAG` (0x825b) [seen].

`advanceAttractDemoFrogHop` (0x23b7) [seen] runs immediately after and continues whichever directional hop is in progress. For each of the four directions it checks that direction's active flag (`FROG_HOP_DOWN_ACTIVE` 0x8248 / `FROG_HOP_UP_ACTIVE` 0x8249 / `FROG_HOP_RIGHT_ACTIVE` 0x824a / `FROG_HOP_LEFT_ACTIVE` 0x824b, all [seen]); if set it steps that direction's hop one frame, and if clear it zeroes that direction's arrival-mirror flag (`FROG_HOP_DOWN_ARRIVAL` 0x824c / `FROG_HOP_UP_ARRIVAL` 0x824d / `FROG_HOP_RIGHT_ARRIVAL` 0x824e / `FROG_HOP_LEFT_ARRIVAL` 0x824f, all [seen]). The two routines pair 1:1: the begin driver kicks off a hop and the continuation animates it, giving the demo frog a smooth scripted traversal without player input.

## The frog hop

The frog moves in discrete 16-pixel hops. Every vblank the machine runs one input scan, `scanFrogInputAndDispatchHop` (0x1acb) [seen], which decides whether the player is allowed to move, reads the joystick for the active player, and either continues a hop already underway or starts a new one. A hop, once begun, plays out over a fixed number of frames driven by a per-direction animation counter. It is atomic against same- or lower-priority directions, but the priority scan lets a fresh press of a *higher*-priority direction (DOWN outranks all) begin a new hop mid-flight, abandoning the one in progress.

### The three input gates

Before any joystick bit is read, the scan takes three early-return gates in order; any one of them ends the frame with the frog frozen:

- `GATED_COUNTDOWN_ENABLE_FLAG` (0x826c) [seen] non-zero → return. While this countdown-enable flag is set the frog cannot be steered at all (it fences off input during a gated countdown phase).
- `FROG_HOP_INPUT_TIMER` (0x8268) [seen,poked] non-zero → decrement it by one and step the home-bay slot cursor via `loc_23eb` (0x23eb) [seen], then return. This is a hold-off lock: while the timer counts down, new joystick input is ignored and each frame only advances the home-bay slot cursor `HOME_BAY_SLOT_CURSOR` (0x8123) [seen] (increment-and-wrap mod 6). The timer is not armed during ordinary land play — it is set on the home-goal path — so in normal hopping this gate is transparent; its lock behavior is grounded by poke (poking =8 gave no hop while it counted, a hop only after it drained to 0).
- `HOLD_FLAG` (0x8004) [seen] non-zero → return. This is the hit/hold flag raised when the frog is killed or held; while set the frog takes no input.

### Player routing: cocktail port select and per-direction bits

Only after the gates pass does the scan choose which physical joystick to read. The select is `p2 = (IN2_PORT bit 3 set) AND (ACTIVE_PLAYER != 1)`, where `IN2_PORT` (0xe004) [seen] bit 3 (mask 0x08) is the cocktail wiring bit and `ACTIVE_PLAYER` (0x83fd) [seen] is the current player number. So player-2 routing engages only in a cocktail cabinet while player 2 is up.

The "main port" for the horizontal axis is then `IN0_PORT` (0xe000) [seen] for player 1 or `IN1_PORT` (0xe002) [seen] for player 2. All joystick reads are active-low: a **clear** bit means the direction is pressed (`(port & bit) === 0`). The full direction-to-bit map the machine reads:

- RIGHT: main port (P1 IN0 / P2 IN1), bit 4 (mask 0x10).
- LEFT: main port (P1 IN0 / P2 IN1), bit 5 (mask 0x20).
- DOWN: P1 reads IN2 bit 6 (mask 0x40); P2 reads IN2 bit 0 (mask 0x01).
- UP: P1 reads IN2 bit 4 (mask 0x10); P2 crosses to IN0 bit 0 (mask 0x01).

DOWN/UP thus live on IN2 for player 1, while player 2's DOWN sits on IN2 bit 0 and its UP on IN0 bit 0; the horizontal axis always reads the selected main port.

### The four-way priority scan and the dispatch triad

The scan tests the four directions in the fixed order **DOWN → UP → RIGHT → LEFT**, and each direction that acts returns immediately, so only one direction is serviced per frame and earlier directions win. For each direction the same triad applies against that direction's active flag `FROG_HOP_{DOWN,UP,RIGHT,LEFT}_ACTIVE` (0x8248–0x824b) [seen]:

1. If the direction's `*_ACTIVE` flag is set, a hop is already in progress → hand off to that direction's advance handler and return.
2. Else if the direction's joystick bit reads pressed → call that direction's begin handler and return.
3. Else the direction is idle → clear its arrival latch `FROG_HOP_{…}_ARRIVAL` (0x824c–0x824f) [seen] and its animation counter `FROG_HOP_{…}_ANIM_COUNTER` (0x8250–0x8253) [seen], then fall through to the next direction.

Because each active or pressed direction returns, holding one direction blocks all lower-priority directions for that frame, and a direction's idle-clear only runs when every higher-priority direction was idle-and-unpressed. UP carries one extra condition on its START: a new UP hop begins only when `(FROG_HOP_RIGHT_ACTIVE + FROG_HOP_LEFT_ACTIVE) & 0xff === 0` — a diagonal into an in-flight left/right hop cannot start an up hop. (An already-active UP hop advances before that guard, so it scopes only the press; the two states are mutually exclusive in any case.) The frog's position cells `FROG_X` (0x8044) [seen] and `FROG_Y` (0x8047) [seen] are the operands the dispatched handlers work on.

### Beginning a hop

The eight handlers live in one multi-entry unit, `animateFrogHop` (begin entries at 0x1b8b / 0x1be4 / 0x1c41 / 0x1ca0) [seen]. A begin handler first checks per-direction position guards, then runs the shared begin body:

- **DOWN** (`beginFrogHopDown`): blocked if `FROG_Y >= 0xF0` (frog already at the bottom edge).
- **UP** (`beginFrogHopUp`): no position guard.
- **RIGHT** (`beginFrogHopRight`): blocked if `FROG_Y < 0x30` (above the field top) or `FROG_X >= 0xE0` (right edge).
- **LEFT** (`beginFrogHopLeft`): blocked if `FROG_Y < 0x30` (above the field top) or `FROG_X < 0x20` (left edge).

If the guard passes, the shared begin body fires. When the direction's animation counter is zero (a genuinely fresh hop) it emits the hop sound — command `0x04` through `enqueueSoundCommand` (0x0018) [seen] — and stamps the direction's rest sprite code into `FROG_SPRITE_CODE` (0x8045) [seen] (unless the frog already shows that rest code, in which case it re-primes the counter from the reload and drops straight into advance). It then loads the counter from the direction's reload length `FROG_HOP_{…}_ANIM_RELOAD` (0x8256–0x8259) [seen] and falls through into the matching advance. (Mechanically the body bumps the counter by one and bails if that wrap yields zero, otherwise reloads it from the reload cell; in practice a fresh press reloads and advances.) The rest sprite codes are DOWN 0xDE, UP 0x1E, RIGHT 0xA1, LEFT 0x21.

### Advancing a hop frame by frame

An advance handler steps a hop by one frame. It is entered every vblank the direction stays active (via the scan's dispatch triad), and once through immediately from begin. The shared advance body (`advanceFrogHopDown` 0x1bba, `advanceFrogHopRight` 0x1c76, `advanceFrogHopLeft` 0x1cd5) [seen]:

1. If the direction's `*_ARRIVAL` latch is set → return (this hop has already landed).
2. Raise the `*_ACTIVE` flag to 1.
3. Decrement the animation counter (mod 256). If it reaches 0: clear `*_ACTIVE`, set `*_ARRIVAL` to 1, stamp the direction's rest sprite, and return — the hop has landed.
4. Otherwise step the frog by the hop delta and stamp the direction's moving sprite.

The per-frame steps: DOWN adds `FROG_HOP_VERTICAL_DELTA` (0x8254) [seen] to `FROG_Y` (moving down = increasing Y); RIGHT adds `FROG_HOP_HORIZONTAL_DELTA` (0x8255) [seen] to `FROG_X`; LEFT subtracts it from `FROG_X`. Moving sprite codes are DOWN 0xDC, RIGHT 0x9F, LEFT 0x1F. The reload length sets the hop's duration; observed at 9 for the UP and RIGHT hops, which yields eight stepped frames of a 2-pixel delta — a single 16-pixel tile of travel — with the ninth (drain) frame marking arrival and stamping the rest sprite.

The `*_ARRIVAL` cell is the one-hop-per-press latch. It is set the moment a hop lands and is cleared only by the scan's idle path (step 3 of the dispatch triad, i.e. when the direction reads unpressed). While it stays set, re-calling begin re-primes the counter but the advance body early-returns without moving the frog — so holding the stick produces exactly one hop, and a second hop requires releasing (which clears the latch) and pressing again.

**UP is the special case** (`advanceFrogHopUp` 0x1c0d) [seen]. Instead of the shared body it: first steps the home-bay slot cursor `loc_23eb` (its returned value discarded); then applies the same arrival-guard / active-raise / counter-decrement logic, moving the frog **up** by subtracting `FROG_HOP_VERTICAL_DELTA` from `FROG_Y` on stepped frames (moving sprite 0x1C, rest 0x1E). On the landing frame it additionally calls `scoreFrogRowProgress` (0x1fd6) [seen], which range-checks `FROG_Y` and, when the frog has reached a row nearer the top than the recorded high-water mark `FROG_FURTHEST_ROW` (0x8269) [seen], updates that mark and awards a one-point BCD delta through `addScoreAndAwardExtraLife` (0x08e0) [seen]. So only forward (upward) hops score row progress; down/left/right hops move the frog but never award points. golden-run grounding: an UP hop carried `FROG_Y` 0xE0→0xD0 at −2/frame over eight frames with the counter draining 8→0 and arrival set on the ninth.

## The home bays

Frogger's board finishes at five home bays across the top row. The machine tracks each bay's won/empty state in a pair of gate cells, animates a creature (fly bonus or crocodile) drifting through the still-empty bays, awards a bay when the frog lands in its column band, and — once all five are filled — plays a left-to-right "all frogs home" reveal before resetting the bays and granting an extra life.

### The occupancy gates and the per-player home tally

Which bays are already won is held in two parallel banks of five one-byte gates. The primary bank is `HOME_BAY1_OCCUPANCY_PRIMARY` (0x825e) [seen,poked] through `HOME_BAY5_OCCUPANCY_PRIMARY` (0x8262) [seen,poked]; the alternate bank runs `HOME_BAY1_OCCUPANCY_ALT` (0x8263) [seen] through `HOME_BAY5_OCCUPANCY_ALT` (0x8267) [seen], five contiguous cells each. `ACTIVE_PLAYER` (0x83fd) [seen] selects the bank: the primary bank is read when it holds 1, the alternate bank otherwise, so each player carries an independent set of five bay flags. A gate reads nonzero once its bay is filled and zero while empty. Every routine that stamps into a bay first tests that bay's active-bank gate and skips the write when it is nonzero, so a filled bay is never overwritten by the empty-bay animation or a second landing.

Alongside the gates, a per-player scalar counts how many bays are filled: `PLAYER1_SLOT` (0x825c) [seen,poked] and `PLAYER2_SLOT` (0x825d). This count is what the completion check reads to know the board is done (all five, i.e. the count reaches 5).

The gates and counts are zeroed together on a fresh board. `coldStartClearSlotGates` [seen] zeros `PLAYER1_SLOT` and the five primary gates, then falls into `coldStartClearAltSlotGates` [seen], which zeros `PLAYER2_SLOT` and the five alternate gates; the two-player continue path enters at that second stage. `clearPlayerOneHomeBayGates` [seen,poked] is the player-1-only cold re-init, zeroing `PLAYER1_SLOT` and the five primary gates before rejoining the shared cold-start entry.

### The slot cursor and the empty-bay animation

While bays sit empty they are not blank — a creature is animated cycling through them, one bay at a time, driven by a rotating slot cursor and a free-running frame counter. The cursor is `HOME_BAY_SLOT_CURSOR` (0x8123) [seen], advanced once per in-play frame by `loc_23eb` [seen], which increments it and wraps it to 0 at 6, so it cycles 0,1,2,3,4,5 mod 6. Values 1..5 name a home bay (a 1-based index into the five bays); value 0 is a rest phase where nothing is stamped.

The creature and its timing are chosen per frame in the collision/scoring orchestrator. A second counter, `SCROLL_TIMER_COUNTER` (0x8122) [seen], is bumped every frame, and the low bit of `LIVES_COUNT` (0x83b7) [seen,poked] picks which creature is drawn: when that bit is clear the crocodile path runs, when set the fly path runs.

- Fly path: at the counter's wrap to 0, `stampHomeBayFly` [seen,poked] stamps the 2×2 fly-bonus tiles (44,45 over 46,47) into the current cursor bay's VRAM base; at counter value 0x70, `stampHomeBaySlot` [seen] re-stamps the empty home tile over it (clearing the fly).
- Crocodile path: at wrap, `stampHomeBayGatorEmerging` [seen,poked] stamps the just-surfacing gator (16,16 over 208,209); at 0x50, `stampHomeBayGatorFull` [seen,poked] stamps the fully-surfaced gator (208,209 over 210,211); at 0xb0, `stampHomeBaySlot` clears it back to the empty tile.

The stamp destinations are the five fixed home-slot VRAM bases `HOME_SLOT1_VRAM` (0xab64) [seen,poked], `HOME_SLOT2_VRAM` (0xaaa4) [seen,poked], `HOME_SLOT3_VRAM` (0xa9e4) [seen,poked], `HOME_SLOT4_VRAM` (0xa924) [seen,poked], `HOME_SLOT5_VRAM` (0xa864) [seen,poked] — note the bases descend in address as the bay index rises. Every 2×2 stamp writes four tilemap cells: `base`, `base+1` on the top row and `base+32`, `base+33` one row below (stride 32).

Three cells publish the cursor between the stampers. `stampHomeBayFly` copies the cursor into `PENDING_HOME_BAY_SLOT` (0x8121) [seen]. `stampHomeBayGatorEmerging` copies it into `HOME_BAY_SLOT_CURSOR_MIRROR` (0x8120) [seen]; `stampHomeBayGatorFull` reads that mirror and republishes it into `PENDING_HOME_BAY_SLOT`. So whichever creature path ran, `PENDING_HOME_BAY_SLOT` ends up naming the bay currently showing a creature. `stampHomeBaySlot` is the shared eraser: it dispatches on `PENDING_HOME_BAY_SLOT` (1..5, else no-op), tests that bay's active-bank gate (skips if filled), stamps the empty home tile 16 into all four cells, and — unless `HOLD_FLAG` (0x8004) [seen] is set — clears both `PENDING_HOME_BAY_SLOT` and the mirror back to 0. When the hold flag is set the selector is left pending, deferring the clear.

### Reaching the home row: the column dispatcher and the reject

When the frog climbs into the top region (its row `FROG_Y` (0x8047) [seen] low enough), control reaches `selectHomeBayGoalHandler` [seen]. It reads the frog's horizontal position `FROG_X` (0x8044) [seen] and matches it against five inclusive column bands — 0x15–0x1c, 0x45–0x4c, 0x75–0x7c, 0xa5–0xac, 0xd5–0xdc — dispatching to that bay's goal handler. Any X outside every band (each gap between bays, and anything left of the first band) falls through to `holdFrogMissedHomeBay` [seen]: if the frog has fully reached the home row (`FROG_Y` below 0x2a) with no bay under it, it raises `HOLD_FLAG` — losing the frog — and either way hands off to the input scan.

### Awarding a bay: the goal handler

The five bay handlers are one shared body, `awardHomeBayGoal` [seen] (`awardHomeBay1Goal`..`awardHomeBay5Goal`), each parameterized by its bay: the two occupancy-gate addresses, a screen Y (0x18, 0x48, 0x78, 0xa8, 0xd8 for bays 1–5), a key (1..5), and its slot VRAM base. The body:

1. Reads this bay's gate for the active player; if it is already nonzero (bay already won) it returns, doing nothing.
2. If `FROG_Y` is still at or past 0x2a (frog has not fully reached the home row) it defers to the input scan instead of awarding.
3. Fly-bonus key match: if `PENDING_HOME_BAY_SLOT` equals this bay's key — i.e. the frog landed in the very bay currently displaying the fly/creature — it calls `awardBonusPoints`. That routine, gated on `HOME_BAY_SLOT_CURSOR_MIRROR`: when the mirror is nonzero (a creature stamp is mid-cycle) it raises `HOLD_FLAG` and returns a skip signal, so the handler returns without finishing the award this frame; when the mirror is clear it writes the floating-score popup record `GOAL_AWARD_RECORD` (0x805c) [seen] (the bay's screen Y as popup position, then 0x19, 0x03, 0x20), arms the goal sprite via `HOME_GOAL_SPRITE_ARM_CELL` (0x8340) [seen] = 0xa0, and adds a BCD 0x20 bonus to the score.
4. Stamps the home-goal graphic and resets the frog through `stampHomeGoalAndResetFrog` [seen] (below), passing the bay's slot base.
5. If a collision is latched (`COLLISION_SUBFLAG` (0x8134) [seen,poked] nonzero) it arms the goal celebration sprite via `armHomeGoalSprite` and clears the sub-flag.
6. Finally it marks the win: sets this bay's active-bank gate to 1 and increments the active player's home tally (`PLAYER1_SLOT` or `PLAYER2_SLOT`).

`armHomeGoalSprite` [seen,poked] arms the celebration sprite: it writes the caller's lead byte (the bay Y) into `FLY_SPRITE_X` (0x8040) [seen,poked] plus a fixed three-byte tail (25, 3, 16) into the next three cells, and sets the arm cell `HOME_GOAL_SPRITE_ARM_CELL` to 160. The same arm cell is later ticked down elsewhere; when it drains it clears the sprite block.

### The shared home-goal fill and frog reset

`stampHomeGoalAndResetFrog` [seen] is reached once a bay is awarded and does the visible fill plus all the bookkeeping to launch the next frog. If a collision is latched it first adds the bonus score and clears the sprite block, then redirects the stamp target to the last cell of that block. It stamps the frog-reached-home 2×2 graphic — tiles 0x6c, 0x6d on the top row, 0x6e, 0x6f below — at the bay's slot base, adds the home bonus (BCD 0x05) to the score, and refreshes the score display strip.

In play (`PLAY_FLAG` (0x83fe) nonzero) it queues the arrival jingle and branches on the active player's home tally: when that count already reads 4 — the arrival that completes the fifth and final bay — it copies the count into `HOME_COLUMN_STATE` (0x842f) [seen,poked], clears the active player's work RAM, zeros a 0x18-byte sprite block, and clears the collision sprite block; otherwise it advances the arrival-fanfare pointer, stepping `FANFARE_INDEX` (0x8381) [seen] (wrapping 0→0x14) and loading the corresponding entry from `FANFARE_TABLE` (0x2e87) [seen] into the sound-sequence countdown. (The routine's own note calls this the "fourth home"; by the code it is the arrival where the tally reads 4, which is the fifth/last bay, since the tally is incremented by the goal handler only after this routine returns.)

It then reseeds the next frog: parks the frog object off-screen (X, sprite code, and attribute cleared, `FROG_Y` = 0xf0), clears the up-hop/arrival and board-layout gate cells, arms the hop-input lock timer (0x10) and the gated countdown (0x20), and sets the demo/state flags so the next frog starts clean.

### Persisting the filled bays each frame

The occupancy gates double as the redraw list. Each scene render calls `renderFilledHomeSlots` [seen] with the base of the active player's occupancy bank (primary or alt); it walks the five gate bytes and, for every nonzero one, re-stamps the frog-in-home 2×2 graphic (tiles 108, 109 over 110, 111 — the same 0x6c–0x6f tiles) into that bay's fixed VRAM base. This keeps already-won bays drawn every frame regardless of what the empty-bay animation does to the others.

### Completing the board: the all-frogs-home reveal

When the active player's tally reaches 5, the per-frame service routine takes the board-completion branch (for player 1: `PLAYER1_SLOT` == 5; the player-2 path checks `PLAYER2_SLOT` == 5). It zeros that player's five occupancy gates and slot count, then arms the reveal through `loc_05d3` [seen,poked], which sets the board-advance request and start/demo flags, seeds `HOME_REVEAL_COUNTDOWN` (0x8297) [seen,poked] to 255 and `HOME_REVEAL_DELAY_TIMER` (0x8298) [seen,poked] to 64.

The reveal then plays out over subsequent frames. First the delay timer drains: while it is nonzero the service routine decrements it and does nothing else with the bays. Once it hits 0, the countdown runs: while `HOME_REVEAL_COUNTDOWN` is nonzero it is decremented one per frame, and each frame the current countdown value is passed as a column selector to `stampHomeBayFrogByColumn` [seen]. That dispatcher stamps the 2×2 frog-in-home completion graphic (tiles 252,253 over 254,255) into one bay whenever the selector exactly equals a bay's column value — 192→bay1, 144→bay2, 112→bay3, 80→bay4, 48→bay5 — so as the countdown sweeps down from 255 it drops a frog into each home in left-to-right sequence; other values are no-ops. When the countdown passes 16 the selector delegates to `fillAllHomeSlotsAndAwardLife` [seen,poked], which stamps the empty home tile (16) back into all five bays via `fillTwoByTwoTileBlock` [seen], clears `HOME_COLUMN_STATE`, and tails into `awardExtraLife` [seen,poked] (bumps the active player's life count, mirrors it into `LIVES_COUNT`, and stamps the lives-row marker). That closes the board: the bays are reset to empty and the player is granted the extra life before the next board is laid.

## The frog — move resolution and render

Three cooperating clusters own the frog each frame: a two-half **lane resolver** that decides whether a horizontal frog move is blocked, safe, or fatal; a one-shot **board-init composite render** that paints the goal-bay furniture and seeds the object-animation state; and an eleven-arm **frog-animation** pipeline that repaints every lane's sprite objects through one shared tile-column loop. The animation arms and the lane resolver share the same per-lane object lists, so the render and the collision test are two ends of one data structure.

### Lane resolution: the two-half sixteen-arm dispatch

The move-vs-lanes decision is split into a lower half `dispatchFrogMoveAgainstLanes` (0x11bf) [seen] and an upper half `resolveFrogMoveAgainstLanes` (0x12e4) [seen], each a sixteen-way dispatch keyed on a nibble of the frog's row, and each delegating to the other for the nibbles it does not own.

The lower half is the entry. It returns immediately if `FROG_STATE_DEMO_FLAG` (0x83cd) [seen] is set or if `HOLD_FLAG` (0x8004) [seen] is already non-zero — the hold flag is the "move already resolved / frog already hit" latch, so once raised no further lane scan runs this frame. It then reads `FROG_Y` (0x8047) [seen], the frog's game-space row (0xE0 at the screen bottom falling to 0x40 at the top as the frog climbs). If the low nibble of `FROG_Y` is ≥ 9 it hands the whole decision to the upper half; otherwise the **high** nibble of `FROG_Y` indexes a ten-entry lane map, and a nibble absent from the map (0, 1, 2, 8, 14, 15) also delegates to the upper half. The upper half applies the mirror gate: it re-checks `HOLD_FLAG`, forms `key = (FROG_Y + 15) & 0xff`, returns if `key`'s low nibble is < 5 (the no-lane arm), and otherwise selects a lane on `key`'s high nibble from an identical ten-entry map. The +15 bias makes the upper half key on the row-boundary-adjusted band, so the two halves together partition the frog's exact sub-row.

Both maps carry the same ten lanes — high nibble → `[object-list base, band width]`:

| nibble | list base | width |
|---|---|---|
| 3 | `SPRITE_BLOCK2_BASE` (0x8100) [seen] | 60 |
| 4 | `LANE_OBJLIST_8109` (0x8109) [seen] | 31 |
| 5 | `LANE_OBJLIST_8112` (0x8112) [seen] | 92 |
| 6 | `LANE_OBJLIST_811B` (0x811b) [seen] | 44 |
| 7 | `LANE_OBJLIST_8124` (0x8124) [seen] | 47 |
| 9 | `LANE_OBJLIST_8136` (0x8136) [seen] | 34 |
| 10 | `LANE_OBJLIST_813F` (0x813f) [seen] | 18 |
| 11 | `LANE_OBJLIST_8148` (0x8148) [seen] | 18 |
| 12 | `LANE_OBJLIST_8151` (0x8151) [seen] | 18 |
| 13 | `LANE_OBJLIST_815A` (0x815a) [seen] | 18 |

### The lane scan and the kill tail

A selected lane runs a band scan. The scan builds a horizontal window `[low, low+width)` in frog X-space: `low = (FROG_X + offset) & 0xff`, where `FROG_X` (0x8044) [seen] is the frog's horizontal position and `offset` is 3 or 12. The two halves pick that offset from different selectors but the same pair of values: the lower half uses 3 when `FROG_Y >= 0x80` else 12; the upper half uses 12 when `LANE_LOW_BOUND_SELECTOR` (0x802f) [seen] < 128 else 3. When `low + width` exceeds 0xFF the window wraps past the byte edge and the in-band test becomes `objX >= low || objX < top` instead of `objX >= low && objX < top`.

Each lane object list is laid out as a leading **count byte** followed by that many object X-positions: the scan reads `remaining = mem8[laneBase]` (a zero count means scan the full 256), then walks `laneBase+1, laneBase+2, …`, testing each `objX` against the band. The outcome depends on which band the frog is in, split at `FROG_Y` 0x80 — the road occupies `Y >= 0x80` (lower screen, moving cars) and the river occupies `Y < 0x80` (upper screen, floating logs):

- **Object found in band.** In the road band an object is a car: the move is fatal/blocked, so the upper half sets `HOLD_FLAG = 1` and the lower half calls the shared kill tail. In the river band an object is a log to ride: the move is safe and the scan simply returns (the lower half routes this back through the upper half, which returns).
- **Lane clear (count exhausted).** In the river band a clear lane is open water: the frog drowns via the kill tail. In the road band a clear lane is safe road and the scan returns.

The shared kill tail is `killFrogAtLane` (0x12d0) [seen], exported from the lower half and also called directly by the upper half. It unconditionally raises `HOLD_FLAG = 1`; then, only in the mid-river sub-band `0x30 <= FROG_Y < 0x80`, it also raises `SECOND_BANK` (0x829c) [seen], the drown/mid-river-death cell read downstream by the death animation. Above the river (`Y >= 0x80`) and in the top strip (`Y < 0x30`) it leaves `SECOND_BANK` untouched and only flags the hold. Because the road-band `HOLD_FLAG = 1` and a road-band `killFrogAtLane` are equivalent (the tail returns before `SECOND_BANK` when `Y >= 0x80`), the two halves' road-hit paths coincide.

### The board-init composite render

`renderFrogAndArmObjects` (0x1952) [seen] paints the fixed frog-scene furniture once at board start (driven from the per-frame scene core `renderFrogSceneAndTickTimer` (0x0942) [seen]) and seeds the object-animation state. It runs three column-copy passes: four ROM source tiles from `FROG_RENDER_TILES_G1` (0x19f6) [seen] down five VRAM columns starting at `FROG_RENDER_VRAM_COL_G1` (0xa843) [seen], four from `FROG_RENDER_TILES_G2` (0x19fa) [seen] down four columns at `FROG_RENDER_VRAM_COL_G2` (0xa8a4) [seen], and four from `FROG_RENDER_TILES_G3` (0x19fe) [seen] down four columns at `FROG_RENDER_VRAM_COL_G3` (0xa8a5) [seen]; within a column the destination steps one screen row (0x20) per tile, and between columns it skips 0x40. It then stamps a banner: tile 71 written eight times (four pairs) from `FROG_RENDER_BANNER_VRAM` (0xa8c3) [seen], each pair stepping +0x20 then +0xA0. It writes the box corners — tiles 65,66 at `FROG_RENDER_BOX_VRAM_CORNER` (0xa844) [seen] and tiles 69,70 at that corner + 864 (the bottom corner). It blits the home-marker column via `blitFourTileGroupColumn` from `FROG_RENDER_HOME_MARKER_VRAM` (0xa85c) [seen]. Finally it raises the three object-ready flags `OBJECT_READY_0/1/2` (0x8007/0x8009/0x800b) [seen] to 1 and hands off to the animation-state seed.

`blitFourTileGroupColumn` (0x19e2) [seen] draws a 14-row column of a four-tile group from a caller-supplied base: on each of 14 iterations it writes tiles 72,73 across the top row and 74,75 across the row one screen-row below (base + 0x20), then advances the base by 0x40 (two screen rows) — a repeating 2×2 tile block down the goal-bay column.

`seedObjectAnimationState` (0x1a02) [seen] fills two stride-2 cell blocks from fixed seed tables, cell *i* taking seed *i*: fourteen cells from `OBJECT_ANIM_STATE_8021` (0x8021) [seen] with `[6,6,5,5,5,5,4,4,5,5,7,7,6,6]`, and ten cells from `OBJECT_ANIM_STATE_800D` (0x800d) [seen] with `[2,2,5,5,2,2,2,2,5,5]`. These seed the per-object animation counters used by the lane objects.

### The frog-animation dispatcher and its eleven arms

`dispatchFrogAnimationArm` (0x0faf) [seen] reads the animation-index cell (0x8000) [seen] (a value 0..10) and jumps to one of eleven render arms. Arm 5 has no render body — it goes straight to the index advance. Every render arm shares one structure: it reads a three-byte **parameter triple** for its arm, stashes the triple's stride byte into `SCROLL_COPY_COLUMN_STRIDE` (0x81b1) [seen] and its tile-source base into `SCROLL_COPY_SRC_PTR` (0x8001) [seen], then enters the shared tile-column loop with this arm's row-count (rows per column), column-count (number of columns), VRAM destination, tile source, and a pair of plot cursors.

The parameter triples are packed contiguously in the 33-byte `ACTIVE_LANE_PARAM_BLOCK` (0x8270) [seen] — arm *k* reads its triple at offset 3·*k* (verified: arm 0 at +0, arm 2 at +6, arm 6 at +18 via its aliased cells `FROG_ANIM_ARM6_SPRITE_CODE/ROW_COUNT/PASS_COUNT` (0x8282/0x8283/0x8284) [seen], … arm 10 at +30). Eleven triples fill the block exactly. The block is refreshed each life from the active player's difficulty table by `loadActivePlayerLaneParams`, so board difficulty tunes every arm's row/column counts. Each arm's VRAM destination comes from a ROM pointer table at 0x13ed + 2·*k* (arm 0 `FROG_ANIM_ARM0_DEST_PTR` (0x13ed) [seen], arm 1's slot aliased as `SCROLL_COPY_DEST_PTR` (0x13ef) [seen], arm 4's as `SCROLL_COPY_DEST_PTR_ALT` (0x13f5) [seen], … arm 10 `FROG_ANIM_ARM10_DEST_PTR` (0x1401) [seen]), and each arm's tile source is a per-arm ROM base (arm 0 `FROG_ANIM_ARM0_SRC_BASE` (0x1403) [seen], arm 1 `SCROLL_GRID_SRC_PHASE16` (0x1423) [seen], arm 4 `SCROLL_BAND_SRC_PHASE16` (0x145f) [seen], arm 6 `FROG_ANIM_ARM6_SRC_BASE` (0x149f) [seen], and the [seen]-tagged arm-2/3/7/8/9/10 sources).

The plot cursors are the crucial cross-link: **each arm's cursor base is exactly the lane object list that the move resolver scans.** Arm *k* plots into lane nibble *k*+3 (arm 0 → 0x8100, arm 1 → 0x8109, …, arm 10 → 0x815a), and arm 5 / nibble 8 is the shared gap — the arm that renders nothing and the row that scans no lane. So the ten render arms repopulate the ten scanned lane object lists one-for-one every time the scene renders, and the resolver reads back the count byte and X-positions those arms just wrote.

Arm 1 alone runs a guarded pre-blit `blitFrogAnimColumnOnTrigger` (0x0f8c) [seen] before its render: when `FROG_ANIM_BLIT_TRIGGER` (0x8118) [seen] is non-zero it copies an eight-row two-byte tile pair from `FROG_ANIM_TILE_PAIR_SRC` (0x1413) [seen] down the VRAM column at `FROG_ANIM_COLUMN_VRAM` (0xa806) [seen,poked] (stepping +0x20 per row), then clears the trigger so the blit is one-shot; a clear trigger touches nothing.

### The shared tile-column render loop and the index recursion

`renderFrogAnimTileColumns` (0x0ff1) [seen] is entered by every arm and does the actual VRAM stamping and sprite-object plotting. It iterates over the arm's column count. Per column:

1. It computes the on-screen column index from the current VRAM destination via `computeVramColumnIndex` (0x1198) [seen]. That helper takes the destination's distance from `VRAM_BASE` (0xa800) [seen] (less the incoming borrow), keeps the top three column bits of the low byte, and runs six fold passes (each rotating an accumulator left and folding one probed high-byte bit into bit 0 while shifting the column bits) plus three final rotates — a bit-shuffle that reconstructs the screen column (0..31) from Frogger's rotated VRAM address.
2. Unless plotting is suppressed by `TWO_PLAYER_START_FLAG` (0x825b) [seen] being non-zero, it writes the **negated** column index into the next slot of the arm's object list (`mem8[ix+1]`, advancing the IX cursor by one each column) and increments the list's leading count byte (the IY cursor). This is exactly the `[count, x0, x1, …]` layout the lane resolver reads — the negated index is the hardware sprite X for that column.
3. It copies the tile-rows for the column: `row-count` tile-pairs (two bytes each), stepping the destination down one screen row (0x20) per row and the source forward by 2 between rows. The row count is parked in `SCROLL_COPY_ROWCOUNT` (0x8003) [seen] and reloaded per column, and the source pointer is reloaded from `SCROLL_COPY_SRC_PTR` each column, so every column restarts from the arm's tile-source base.
4. It advances the destination by `SCROLL_COPY_COLUMN_STRIDE`; the 16-bit overflow of that add becomes the next column's borrow into the column-index computation (only the destination is held to 16 bits).

When the column count is exhausted the loop hands to `advanceFrogAnimIndexAndRedispatch` (0x1029) [seen]. That bumps the animation-index cell (0x8000) by one; while the new index is below the arm count (0x0b) it re-dispatches the next arm; when it reaches 0x0b it wraps the index to 0 and returns. So a single dispatch entry renders the whole sequence of arms from the current index up through arm 10 and then resets the index to 0 — in normal per-frame use, starting from 0, that draws all eleven arms (repopulating all ten lane lists) in one sweep. Arm 5's empty body means its slot advances the index without drawing, leaving nibble-8's list untouched.

## The sprite-object engine

Frogger's moving hazards and rideable creatures are driven by a small fixed set of *sprite objects*, each a 16-byte record in work RAM that the machine advances one step per frame and stages into a hardware sprite slot. This section describes the record and slot layout as game state, the per-frame cluster that runs the objects, spawning and its pseudo-random generator, per-object motion/animation, slot staging and retirement, frog hit-testing, and the bonus fly.

### Object records and hardware slots (the state)

Each sprite object owns a **16-byte record** (the IX base). Two record families exist, selected by ACTIVE_PLAYER (0x83fd) [seen] so the two players keep independent objects: the dispatcher-A records at SPRITE_OBJECT_RECORD_A_P1 (0x8440) [seen] / SPRITE_OBJECT_RECORD_A_P2 (0x8460) [seen], and the dispatcher-B records at SPRITE_OBJECT_RECORD_B_P1 (0x8480) [seen] / SPRITE_OBJECT_RECORD_B_P2 (0x8490) [seen]. The 16 bytes carry a uniform field layout:

- **+0 / +1** — the far and near band-boundary X limits of the object's travel. Spawning sets +1 to the low edge and +0 to the low edge plus a band span; the motion and steer arms compare the frog-independent position source against these to decide when to reverse or stop.
- **+2** — the position accumulator. Motion nudges it +/-1 per move tick; the slot-staging arms subtract it from a lane/position source to get the on-screen X.
- **+3** — the vertical/parked byte: 0x00 places the object on the play row, 0xf0 parks it off-screen; the dispatcher-A motion arm steps it by +/-2 for objects on a low sprite row.
- **+4** — the row/category attribute. Its value both selects the screen row the object collides on (the hit test matches +4 (+2 in dispatcher A) against the frog row) and gates its kind: a value >= 0x60 is "parked/fixed", below is "moving". Spawning writes variant*16+48 (dispatcher B) or 0x4e on-screen / 0x7e parked (dispatcher A).
- **+5** — direction bit / horizontal sprite-flip bit (0x00 or 0x80); the motion arms flip it at a turn, and the attribute/hit arms fold it into the sprite and into the hit-window bias.
- **+6** — the active/state byte: 0 = idle (every arm early-returns on it), 1 = armed, and thereafter the animation phase (counts 1..4). The dispatcher-B ahead hit-test advances it to 2.
- **+7** — the "has moved / eligible to retire" flag, set by the dispatcher-A motion arm and required before that object may be recycled.
- **+8** — the animation-frame timer (reload 12).
- **+9** — the motion timer (reload 8).
- **+0x0a** — the dispatcher-A spawn/respawn timer; retirement reseeds it to 0x20.
- **+0x0b** — the lane index: a low byte used to reach a per-object position cell in the page-0x80 lane table (loc_8000, 0x8000 [seen]).

Each record stages into a **hardware sprite slot** (the IY base), which is a 4-byte hardware sprite entry laid out `[X, code, color, Y]`: slot+0 = X, slot+1 = tile code (high bit = horizontal flip), slot+2 = color/attribute, slot+3 = Y. Dispatcher A uses an 8-byte slot holding *two* such entries stacked (a 16px-wide, two-tile creature) at SPRITE_OBJECT_SLOT_A (0x8048) [seen], with a second slot SPRITE_OBJECT_SLOT_A_SECOND (0x8050) [seen] for its second object; the second entry's tile is the first's tile+1 and its X is a fold boundary. Dispatcher B uses a single 4-byte entry, the shared block SPRITE_OBJECT_SLOT_B (0x8058) [seen,poked]. These slot bytes are the object's on-screen presence: the machine mirrors them to sprite hardware (OBJRAM) each frame, so writing the slot *is* drawing the object.

### The per-frame cluster and its two dispatchers

`driveSpriteObjectCluster` [seen] runs the whole object set once per frame and gates the workload on LIVES_COUNT (0x83b7) [seen,poked], the life/level count. Below 3 it runs nothing but dispatcher B. At 3 or above it runs dispatcher A on the active player's record 0x8440/slot 0x8048, then a second dispatcher-A pass; that second pass advances to a fresh object (record +0x10 -> 0x8450, slot 0x8050) only when the count reaches 6, otherwise it re-runs the arms on the *same* record/slot. Finally it always runs dispatcher B on record 0x8480/slot 0x8058. So the level count scales the object population: one always-live dispatcher-B object, plus one dispatcher-A object from level 3, plus a second from level 6.

`dispatchSpriteObjectArmsA` [seen] is dispatcher A: it runs five per-object arms in fixed order against the current record/slot — spawn, animate-frame, motion, place-slot-and-retire, hit-test. `updateSpriteObject` [seen,poked] is dispatcher B: its five arms in fixed order are spawn, steer-toward-target, write-slot-X, hit-test-ahead, write-slot-attribute. The two dispatchers are structurally parallel (spawn / animate / move / stage / hit) but their objects behave differently: dispatcher A drives free-drifting two-tile creatures that bounce between band edges, dispatcher B drives a single-tile object that steers toward a fixed lane target and can be ridden by the frog.

### Spawning and the spawn PRNG

Spawning consumes a lagged-XOR pseudo-random generator. `nextSpawnRandomByte` [seen,poked] operates a 32-cell ring at SPAWN_RNG_RING_BASE (0x8400) [seen] whose cell 0 is a moving cursor: each call decrements the cursor (wrapping down to 31 at 0), computes a partner cell 13 ahead (folded back under the ring size), XORs the two ring cells, stores the result back into the partner, and returns it. Every spawn decision draws several bytes, advancing the ring as a side effect.

`spawnSpriteObject` [seen,poked] is dispatcher B's spawn arm. It runs only when LIVES_COUNT >= 3 and the record is idle (+6 == 0). It draws a *density* byte and aborts unless `(8*count + 128) & 0xff >= roll` — a threshold that rises with the level, so higher levels spawn more readily. It draws a *variant* (`roll & 7`) and aborts if it is 5 or more, so exactly five variants (0..4) are legal and rolls of 5/6/7 skip the frame. The variant selects the tile/row byte +4 = variant*16+48, and indexes two ROM tables: SPAWN_VARIANT_TABLE (0x2ce6) [seen] supplies a subtraction span (even byte) and a low byte (odd byte) that becomes +0x0b and indexes a page-0x80 seed cell for the start position; SPAWN_POINTER_TABLE (0x2cdc) [seen] supplies a little-endian pointer from which a second span and an iteration count are derived. A subtract-loop then walks the seed position down by those two spans — aborting the whole spawn if the primary span underflows (the object does not fit this frame) — to compute the placement remainder, from which the +0/+1/+2 band/position bytes are written. A final PRNG bit (bit 0) picks the launch direction: odd reveals the object on-screen (+5 = 0, +3 = 0), even parks it off-screen (+5 = 0x80, +3 = 0xf0). The record is then armed: +6 = 1, +9 = 8.

`spawnSpriteObjectArmA` [seen] is dispatcher A's spawn arm and is *timer*-gated as well as level-gated. It counts the record's +0x0a spawn timer down each frame and acts only on expiry with the object idle. It draws the same rising density threshold (`count*8 + 0x80`), then a band roll: one-in-four (`bandRoll & 3 == 0`) sends it straight to the park-or-reveal tail (below) instead of the band walk. Otherwise it derives a per-band X stride from SPRITE_SPAWN_X_STRIDE (0x8276) [seen] (rotate-right-twice + 0x24) and a band count from SPRITE_SPAWN_BAND_SCAN_COUNT (0x8278) [seen], and walks a value down from (FREE_RUNNING_POS_COUNTER (0x8014) [seen] − 0x10), each band subtracting 0x40 then the stride: landing below 0x40 places the object on-screen at that band offset (+2 = the counter, +1/+0 = the band edges, +4 = 0x4e), landing below the stride or exhausting the bands parks it off-screen (+4 = 0x7e, then a coin-flip PRNG either reveals it or parks it fully at +3 = 0xf0). Either way it arms the timers (+6 = 1, +8 = 0x0b, +9 = 8) and falls into the shared spawn tail.

That tail, `raiseSpriteArmOneShotAndQueueSound` [seen], is a per-turn one-shot keyed on PER_TURN_SCRATCH (0x8371) [seen]: while the scratch flag is still 0 it latches it to 1 and queues the spawn sound (command 0x90); once set, later arms in the same turn do nothing, so at most one spawn sound is queued per turn regardless of how many objects arm.

### Motion and animation

`loc_29f9` [seen] is dispatcher A's motion arm. It runs only while the object is active (+6 != 0) and the global hit gate loc_842c (0x842c) [seen] is clear — so a frog hit freezes all dispatcher-A motion. It counts the +9 move timer down (reload 8), sets the "has-moved" flag +7 = 1, and then either (for an object on a low sprite row, slot Y >= 96) steps its +3 vertical byte by +/-2 per facing, or drifts its +2 position toward the FREE_RUNNING_POS_COUNTER along the +0/+1 band edges. Reaching a band edge calls the turn: it flips +5 (direction and sprite-flip together), reloads the slot's travel span from the stored second-entry X, and flips the slot's sprite-flip bit. The free-running counter (not the frog) is the drift reference, so these objects sweep the lane on their own cycle.

`steerSpriteObjectTowardTarget` [seen,poked] is dispatcher B's motion arm. Active-gated and +9-timer-gated the same way, on each expiry it reads the object's per-object target — the page-0x80 lane cell at 0x8000 | +0x0b — and drifts +2 one step toward it along +0 or +1 by facing (+5). On reaching the target it despawns the object (zeroing the 16-byte record and the 4-byte slot 0x8058) *unless* HOLD_FLAG (0x8004) [seen] is set, in which case the object is kept — this is how a frog riding the object holds it alive rather than letting it despawn out from under the frog.

`animateSpriteObjectFrame` [seen] animates dispatcher-A objects. It counts the +8 frame timer down; on expiry it reloads 12 and steps the +6 phase downward (1 wraps to 4), reads SPRITE_OBJECT_PHASE_TILE_TABLE (0x2cd5) [seen] at the new phase, ORs in the +5 flip bits, and stages the two-tile sprite pair: slot+1 = tile, slot+5 = tile+1, slot+2 = slot+6 = 4 (color). Phase 0 (idle) stages nothing. Dispatcher B does not frame-animate; instead `writeSpriteObjectSlotAttr` [seen,poked] indexes OBJECT_STATE_ATTR_TABLE (0x2cd9) [seen] by the state byte +6, ORs in +5, writes that to slot+1, and writes color 2 to slot+2 — so a dispatcher-B object's look is a direct function of its current state, not a cycling frame.

### Slot staging and retirement

`writeSpriteObjectSlotX` [seen,poked] stages the active dispatcher-B object: it reads the lane cell at 0x8000 | +0x0b and writes the on-screen X = lane byte - +2 into slot+0, and copies the row byte +4 into slot+3 (Y).

`placeSpriteObjectSlotAndRetire` [seen,poked] does the equivalent for dispatcher A and also handles recycling. For an active object it first fires the shared one-shot spawn sound, then computes the on-screen X: a parked object (+4 >= 0x60) uses its fixed +3 byte, a moving object uses `(FREE_RUNNING_POS_COUNTER - +2) & 0xff`. It writes that X to slot+0 and copies the row byte to both sprite entries' Y (slot+3, slot+7). It then computes the second entry's fold-boundary X (slot+4) with a +15 or -15 bias by direction, and detects the *fold-wrap* — the on-screen X reaching the fold value. On a fold-wrap with the retire flag +7 set, it retires the object: it zeroes the whole 16-byte record and the 8-byte slot and reseeds the spawn timer +0x0a to 0x20, so the object reappears after roughly 0x20 frames.

### Hit-testing the frog

Both dispatchers box-test their object against the frog, whose position lives in FROG_X (0x8044) [seen] and FROG_Y (0x8047) [seen].

`flagSpriteObjectFrogHit` [seen] (dispatcher A) fires only when the object is active and its row (+4 plus a 2-row bias) equals the frog row. It takes the slot X, adds a half-tile (0x10) bias when the direction bit is set, and if that lands within a 16-pixel window at or ahead of the frog X it raises two flags: HOLD_FLAG = 1 and the global gate loc_842c = 1. Setting loc_842c is what freezes the dispatcher-A motion arm — the objects stop the frame the frog is caught.

`flagSpriteObjectFrogHitAhead` [seen,poked] (dispatcher B) fires when the object is active and its row byte +4 equals the frog row exactly. It projects the slot X by +20 (direction bit clear) or -4 (set) and, if that projected point lands within a 16-pixel window at or ahead of the frog X, raises HOLD_FLAG = 1 and advances the object to state 2 (+6 = 2). Because HOLD_FLAG then blocks the steer arm's despawn, this is the "frog reached / mounted the object" path: the object is held (state 2) rather than allowed to run to its target and vanish.

### The fly

The bonus fly is a separate object built on its own four-cell sprite block based at FLY_SPRITE_X (0x8040) [seen,poked] — X at 0x8040, code at FLY_SPRITE_CODE (0x8041) [seen], color at 0x8042, and Y at FLY_SPRITE_Y (0x8043) [seen]. Its appearance is triggered by FLY_DRIFT_COUNTER (0x811c) [seen], a slowly rising counter (wrapping 0xff->0x00 on a long period); the wrap to 0 is the cue to arm the fly.

`animateFlyEatCollision` [seen] runs the fly each frame as a small state machine over three flags: COLLISION_SUBFLAG (0x8134) [seen,poked] (an eat is in progress), COLLISION_LATCH (0x8135) [seen,poked] (the fly is armed/out), and FLY_EAT_PHASE (0x813d) [seen] (bit0 = retract this frame). While an eat is in progress it does nothing but track the fly sprite onto the frog (copy FROG_X into FLY_SPRITE_X, FROG_SPRITE_CODE (0x8045) [seen] into the fly code, and frog Y+2 into the fly Y). When the drift counter reads 0 it arms the tongue once (if not already latched): it bumps the eat phase, stamps the fly descriptor (code 0x1e, color 0x04, Y 0x60), sets COLLISION_LATCH, resets the fly path step to 1, and loads the attack timer to 60. If the retract bit is set it resets the latched collision. Otherwise, while the tongue is out, it runs the patrol mover and box-tests the fly against the frog: the frog must be in the vertical band [0x5a, 0x68) and the fly X within +/-4 of the frog X. A hit latches COLLISION_SUBFLAG, queues the eat sound (0x18), and snaps the fly onto the frog.

`driveFlyPatrol` [seen] walks the fly horizontally along a ROM path table, FLY_PATH_OFFSET_TABLE (0x279f) [seen], indexed by FLY_TRAVEL_DIR_STEP (0x833d) [seen] (bit7 = direction and sprite-flip, low 7 bits = path step). While the attack timer FLY_ATTACK_TIMER (0x833e) [seen] counts down, the fly re-renders its X each frame — screen X = path-table offset + FLY_DRIFT_COUNTER, so the whole patrol rides the drifting base — and flips its sprite code at the timer midpoint. At zero it advances one path step (stepping back two first when travelling backward); a table entry of 0 marks an endpoint (reverse the direction bit, reload the timer to 60, show the turn sprite), an entry of 1 holds in place (reload only), and any larger value is the next X offset. The fly thus paces back and forth across its lane until the frog lines up under it and eats it.

## The two-pair figure and dive animation

The river carries a rideable/lethal object — a diver figure whose graphic is a 2x2 tile quad. Two separate VRAM animations share one block of arm/gate/latch state: the *figure* animation that flips the on-screen quad, and a *dive* animation that paints a descending tile column. A per-frame driver arms, paces, and emits both, and a box-collision test decides each frame whether the frog mounts the figure or dies on it.

### Shared state

All of the routines below coordinate through a small cluster of RAM cells; understanding the cluster first makes the routines legible.

- `FIGURE_ANIM_PHASE` (0x8101) [seen] — dual role. As a gate it reads 0 = "figure idle" (no diver present); non-zero enables the figure animation and the re-arm. As data its non-zero value **is the diver's on-screen X coordinate**, read directly by the collision test. It is written outside this subsystem — nothing here assigns it (all three references are `=== 0` reads).
- `FIGURE_ANIM_STEP_GATE` (0x8150) [seen] — the arm/variant gate. Bit 0 must be set for the figure animation and the collision test to step; the surface-timer pacer `stepDiveSurfaceTimer` (0x27fe) [seen] reads bit 0 to pick which ROM tile table the dive copier is then handed. The two arm routines write it differently (set vs increment, below).
- `SPRITE_FRAME_BUSY_LATCH1` (0x814f) [seen,poked] — the busy latch shared by the figure animator and the dive copier, giving them a mutual interlock. While set (a dive cycle is armed), the figure animator bails and only the dive copier advances; the copier clears it at cycle end, re-enabling the figure animator. The arm routines refuse to re-seed while it is set.
- `ANIM_FRAME_BUFFER` (0x819b) [seen,poked] — the shared animation frame buffer (filled elsewhere with the current frame source). Its low nibble sets the dive pacing: the seed is `(0x819b & 0x0f) * 8`.
- `TWOPLAYER_FRAME_CELL_8146` (0x8146) [seen,poked] and `TWOPLAYER_FRAME_CELL_8147` (0x8147) [seen,poked] — the surface-timer counter pair: 0x8146 holds the reload period, 0x8147 is the live countdown.
- `TWOPLAYER_FRAME_CELL_814E` (0x814e) [seen,poked] and `TWOPLAYER_FRAME_CELL_8145` (0x8145) [seen,poked] — the dive-cycle cursor: 0x814e is the byte index into the frame table (steps +2 per frame), 0x8145 is the VRAM column offset (steps +0x20 per frame).
- `TWO_PAIR_FIGURE_ANIM_PHASE` (0x833f) [seen] — the figure animation's own phase counter, incremented by the figure animator.
- `TWO_PAIR_FIGURE_VRAM` (0xa846) [seen,poked] — first tile cell of the on-screen 2x2 figure quad; the second pair sits one row (+0x20) below at 0xa866. Both the figure animator and the mount branch write here.
- `FROG_ANIM_COLUMN_VRAM` (0xa806) [seen,poked] — VRAM base of the descending dive column the frame copier paints into (destination = 0xa806 + column offset). This is a **different** VRAM region from the figure quad at 0xa846.
- `LIVES_COUNT` (0x83b7) [seen,poked] — read here purely as the **level/difficulty selector** for the dive; it is the level count (it does not decrement across frog deaths), not a cycling dive phase.

### Level-gated dispatch: the per-frame dive driver

Each in-play frame the collision orchestrator `orchestrateCollisionsAndFrogInput` (0x1a55) [seen] runs the diver's three routines in fixed order while the play flag `PLAY_FLAG` (0x83fe) is set: first `mountOrKillFrogOnTwoPairFigure`, then `animateTwoPairFigure`, then the dive driver `loc_27ea` (0x27ea) [seen,poked]. Because the orchestrator returns straight to its shared exit when the play flag is clear, none of this runs in attract mode.

`loc_27ea` dispatches on the level count `LIVES_COUNT`:
- level < 2 → return immediately (no diver on the first level).
- level >= 5 → hand off to the high-phase arm `armDiveHighPhase` (0x2874) [seen].
- level 2..4 (the middle band) → if the figure is idle (`FIGURE_ANIM_PHASE` == 0) run the mid arm `resetDiveSurfaceCounter` (0x288c) [seen] and then the surface-timer step; otherwise run the surface-timer step alone.

So the diver first appears at level 2, and the arm variant changes at level 5.

### Arming a dive cycle

Both arms seed the same state but differ in exactly one write, which is what flips the animation variant between cycles.

`armTwoPairFigureFrame` (0x287e) [seen,poked] is the high-level arm (reached via `armDiveHighPhase` only while `FIGURE_ANIM_PHASE` == 0). It refuses to run when the busy latch `SPRITE_FRAME_BUSY_LATCH1` is already set (already seeded this cycle). Otherwise it **sets** `FIGURE_ANIM_STEP_GATE = 1`, seeds both surface-timer cells `TWOPLAYER_FRAME_CELL_8146` and `TWOPLAYER_FRAME_CELL_8147` to `(ANIM_FRAME_BUFFER & 0x0f) * 8`, then raises the busy latch so a later pass this cycle will not re-seed.

`resetDiveSurfaceCounter` is the mid-band arm and is a structural twin with one difference: instead of setting the gate to 1 it **increments** it (`FIGURE_ANIM_STEP_GATE = FIGURE_ANIM_STEP_GATE + 1`). Same busy-latch guard, same seed of both counter cells, same raising of the latch. Because the mid arm increments the gate each cycle, bit 0 flips between cycles (alternating the tile table the copier reads); the high arm pins it to 1 (always the odd/main variant).

`armDiveHighPhase` itself is thin: while `FIGURE_ANIM_PHASE` == 0 it runs `armTwoPairFigureFrame` (the one-shot seed), and then — regardless — continues into the shared surface-timer step.

### Pacing and emitting dive frames

`stepDiveSurfaceTimer` (0x27fe) [seen] is the shared per-frame pacer. If the busy latch is clear it returns at once (dive idle). Otherwise it runs a two-cell countdown between 0x8146 (period) and 0x8147 (countdown):

- While `0x8146 != 0x8147`, it steps the countdown via `stepDiveFrameCounter` (0x28b0) [seen], passing 0x8147 as the counter cell: if that cell has drained to 0 it reloads it from 0x8146, otherwise it decrements it. No frame is emitted on these ticks.
- When `0x8146 == 0x8147` (which is true right after a reload, and at the initial seed), it consumes one tick (`0x8147 -= 1`) and **emits one dive frame**: on the even gate phase (`FIGURE_ANIM_STEP_GATE & 1 == 0`) via `selectDiveVariantFrame` (0x286d) [seen], on the odd phase via `copyDiveAnimFrame` with the main table.

The net effect is that one dive frame is emitted per full countdown of the period, so the seed `(0x819b & 0x0f) * 8` sets the inter-frame delay (larger low nibble → slower dive). `selectDiveVariantFrame` just points the copy at the alternate arm-0 tile table `FROG_ANIM_ARM0_SRC_BASE` (0x1403) [seen] and hands off to the copier; the odd path uses the main table `FROG_ANIM_TILE_PAIR_SRC` (0x1413) [seen].

`copyDiveAnimFrame` (0x281b) [seen] copies one two-byte tile pair from `tableBase + 0x814e` into the VRAM column at `FROG_ANIM_COLUMN_VRAM + 0x8145` (two bytes). It then advances the cursor for next time: the frame index 0x814e steps +2, the column offset 0x8145 steps +0x20 (a full VRAM row). A cycle is eight frames: once the frame index reaches 0x10 the cycle is complete, and the routine ends it by clearing the busy latch `SPRITE_FRAME_BUSY_LATCH1 = 0` and zeroing all of 0x814e, 0x8145, 0x8146, 0x8147, so the next arm re-seeds from scratch. Clearing the latch is what re-enables the figure animation.

### The two-pair figure animation

`animateTwoPairFigure` (0x291d) [seen] flips the on-screen figure quad and is called every in-play frame independent of level. Its guards are: if `FIGURE_ANIM_PHASE` == 0 it clears the figure phase `TWO_PAIR_FIGURE_ANIM_PHASE = 0` and returns (idle); if the gate bit `FIGURE_ANIM_STEP_GATE & 1` is clear it returns; if the busy latch `SPRITE_FRAME_BUSY_LATCH1` is non-zero it returns. That last guard is the interlock: while a dive cycle is armed the figure does not animate.

When it does run it increments `TWO_PAIR_FIGURE_ANIM_PHASE` (mod 256) and blits at two phase marks. At phase 64 it blits frame A (first tile 104): tiles 104,105 into 0xa846,0xa847 and tiles 106,107 into 0xa866,0xa867 (the second pair one row below via the +32 stride). At phase 112 it blits frame B (first tile 208) into the same four cells and resets the phase to 0, restarting the cycle. So the figure holds frame A from phase 64 until frame B momentarily appears at 112, then loops.

### Mounting or killing the frog on the diver

`mountOrKillFrogOnTwoPairFigure` (0x28bb) [seen,poked] is the frog-vs-diver box test, run first each frame by the orchestrator. It returns unless the arm gate is set (`FIGURE_ANIM_STEP_GATE & 1`) and the level is at least 2 (`LIVES_COUNT >= 2`) — so the hazard is live only while a dive cycle is armed on level 2+.

It then box-checks, all in unsigned 8-bit arithmetic with a half-tile bias of 8:
- **Vertical band.** `frogTop = (FROG_Y (0x8047) [seen] + 8)` must satisfy `42 <= frogTop < 59`; otherwise return (frog not on the diver's row).
- **Horizontal window.** With `frogRight = (FROG_X (0x8044) [seen] + 8)` and `diverX = FIGURE_ANIM_PHASE` (the diver's X), it returns if `(diverX + 8) < frogRight` (frog past the diver's right edge) or if `(diverX - 32) >= frogRight` (frog left of the 32-wide window). Overlap therefore requires `frogRight` in the window `(diverX - 32, diverX + 8]`.
- **Mount vs kill split.** Within the overlap, if `(diverX - 8) >= frogRight` — i.e. `frogRight` is in the back sub-window `(diverX - 32, diverX - 8]` — it is an **outer overlap → ride**: set the hold/attach flag `HOLD_FLAG` (0x8004) [seen] = 1 and stamp the mounted-frog quad (tiles 104,105,106,107) into 0xa846,0xa847,0xa866,0xa867 (the same cells and the same tile-104 base the figure's frame A uses). Otherwise `frogRight` falls in the near sub-window `(diverX - 8, diverX + 8]` — an **inner overlap → death**: tail-call the frog-kill `killFrogAtLane` (0x12d0) [seen], which raises `HOLD_FLAG = 1` and, only in the mid-river band `0x30 <= FROG_Y < 0x80`, also raises the second-bank kill cell `SECOND_BANK` (0x829c) [seen].

So landing on the diver's body (the back sub-window) mounts the frog and draws it riding; landing on its leading edge (the near sub-window) drowns it. The decision is purely positional; the level only gates whether the hazard exists.

### Clearing the collision block

A separate small mechanism resets the fly/goal collision block and its latch. `clearCollisionSpriteBlock` (0x27bc) [seen] zeroes the four-byte sprite block `FLY_SPRITE_X` (0x8040) [seen,poked] through 0x8043 and the collision latch `COLLISION_LATCH` (0x8135) [seen,poked]. `clearLatchedCollision` (0x27b3) [seen,poked] guards on that latch: if `COLLISION_LATCH == 0` it returns (nothing latched), otherwise it clears the collision sub-flag `COLLISION_SUBFLAG` (0x8134) [seen,poked] and falls into `clearCollisionSpriteBlock` to zero the block and the latch together. These are dispatched from the death/hop and goal paths (the death driver runs the guarded reset, and the home-goal handler clears the block after a latched hit is scored), not from the diver routines above — this collision block is the fly/goal sprite block, distinct from the diver's figure state.

## Board setup and player lifecycle

The machine reuses one family of RAM-wiping and layout primitives across four occasions — a cold new game, the once-per-board in-play layout, advancing to the next board, and building the attract demo — and threads the two-player lifecycle (page banking, player hand-off, continue) through them. The top-level dispatchers (cold start, board setup, next-life, player-two continue) end by tail-returning into the foreground main loop at its pace-tail re-entry (endForegroundPassAtPaceTail); the shared clear/fill/swap primitives return to their callers. All are memory-only in effect.

### Shared clear and fill primitives

Two primitives paint the tilemap. `clearTilemapToTile16` [seen] fills all 1024 cells of the 32x32 tilemap (VRAM_BASE (0xa800) through 0xabff) with the blank tile 0x10 — this is the rst 0x38 whole-screen wipe. `fillTilemapBlock28x32` [seen] fills a 28-wide by 32-tall block from TILEMAP_FILL_BASE_28X32 (0xa802) with tile 16, writing 28 cells per row and skipping 4 cells between rows, so it clears the play area while leaving the 4-column status margin untouched.

Three primitives wipe player/actor work RAM:
- `forceClearPlayerWorkRam` [seen] unconditionally zeroes the 32-byte frog object block from FROG_X (0x8044) [seen] and the 12-byte home-bay gate block from HOME_BAY_GATE_BLOCK (0x8420) [code].
- `clearActivePlayerWorkRam` [seen] guards that: in a one-player game (PLAY_FLAG (0x83fe) [seen] == 1) it returns and leaves the block intact; in a two-player game or attract (PLAY_FLAG 0 or 2) it falls into the force-clear. The one-player skip preserves the single player's frog/gate state that a two-player game must instead swap out.
- `clearObjectBlocksAndMirrorToObjRam` [seen] zeroes a 44-byte object block at LIVE_OBJECT_PAGE (0x800c) [seen], copies its now-zero 43-byte head into the OBJRAM object mirror OBJRAM_OBJECT_MIRROR_BASE (0xb00c) [seen], then zeroes a 99-byte sprite block at SPRITE_BLOCK2_BASE (0x8100) [seen] — clearing both the live object page and the sprite-actor scratch used for the next board's objects.

Two narrower clears round out the family: `clearFourByteCounterBlock` [seen] zeros the 4-byte GOAL_AWARD_RECORD (0x805c) [seen] home-bay-award record, and `clearTwoPlayerFrameCells` [seen] zeros five frame-latch cells (SPRITE_FRAME_BUSY_LATCH1 and four adjacent cells) but only when PLAY_FLAG holds 2.

### Loading the active player's lane parameters

`loadActivePlayerLaneParams` [seen] installs the current board's lane layout. It reads the difficulty index for whichever player is active — PLAYER1_DIFFICULTY_INDEX (0x8293) [seen] when ACTIVE_PLAYER (0x83fd) [seen] holds 1, else PLAYER2_DIFFICULTY_INDEX (0x8294) [seen] — follows the little-endian pointer table LANE_PARAM_PTR_TABLE (0x2260) [seen] indexed by 2*difficulty to that difficulty's ROM block, and copies 33 bytes into ACTIVE_LANE_PARAM_BLOCK (0x8270) [seen]. The difficulty index is the selector, so bumping it (see board advance) rotates the machine through five different lane configurations.

### Cold start: wiping work RAM for a new game

A new game runs a three-part fall-through chain, each part landing in the next:

1. `coldStartClearSlotGates` [seen] zeros PLAYER1_SLOT (0x825c) [seen,poked] (the player-1 home count) and the five primary-bank home-bay occupancy gates from HOME_BAY1_OCCUPANCY_PRIMARY (0x825e) [seen,poked]. These gates mark which of the five home bays are already filled; the home-bay stampers skip a bay whose gate is non-zero, so clearing them re-opens all five bays.
2. `coldStartClearAltSlotGates` [seen] does the same for player 2 — PLAYER2_SLOT (0x825d) and the five alternate-bank gates from HOME_BAY1_OCCUPANCY_ALT (0x8263) [seen]. The two banks are the per-player home tallies (primary bank used when the active-player cell is 1, alt bank otherwise). The player-2 continue path also enters here.
3. `coldStartClearPlayRamAndSetMode` [seen] is the shared mid-entry that finishes init. It clears the screen (clearTilemapToTile16), runs `clearActivePlayerWorkRam`, then the credit/score-rank/header setup callees (renderCreditLine, packScoreRankPair, renderScoreHeader). It block-clears three work-RAM spans: 0x160 bytes from SPRITE_BLOCK2_BASE (the sprite/actor block), 5 bytes from loc_8000 (0x8000) [seen] (the low object bytes), and 0x2f bytes from LIVE_OBJECT_PAGE (the live-object page). It then zeros the game-state bytes: FROG_READY_FLAG (0x83c3) [seen], PLAY_FLAG, ATTRACT_SEQUENCER_PHASE (0x83bf) [seen], CONTINUE_FLAG (0x83c9) [seen], CONTINUE_FLAG_2P (0x83ca) [seen], FLIP_X_LATCH (0xb810) [seen], FLIP_Y_LATCH (0xb80c) [seen], and — via one 16-bit write to PLAYER1_DIFFICULTY_INDEX, which sits directly below PLAYER2_DIFFICULTY_INDEX — both players' difficulty indices at once. It also zeros ATTRACT_PHASE_COMPANION (0x83bb) [seen], SCREEN_FLIP_LATCH (0x83cb) [seen], POINT_TABLE_DRAW_STATE (0x83d8) [seen], loc_83c4 (0x83c4) (role ungrounded), IN_PLAY_BOARD_INIT_GUARD (0x83ba) [seen], INIT_GUARD_LATCH (0x8295) [seen], and TWO_PLAYER_START_FLAG (0x825b) [seen]. Finally it sets GAME_MODE (0x83d6) [seen] = 3 (attract score-ranking), force-clears the player work RAM, and returns to the pace tail. A fresh game thus boots into the score-ranking attract mode with every gate, flag, and difficulty index zeroed.

`clearPlayerOneHomeBayGates` [seen,poked] is a fourth entry used for a player-1 cold board re-init in a two-player game (taken at the death/switch handler when player 2's board is already active, i.e. CONTINUE_FLAG_2P != 0). It zeros PLAYER1_SLOT and the five primary gates, then jumps directly into part 3 — skipping the player-2 alt-gate clear so player 2's home tally survives.

### One-shot board layout passes

`setUpBoardOrContinueLife` [seen] is the per-frame board-start / life-loss dispatcher. It reads BOARD_LAYOUT_GATE (0x83ea) [seen]: when the gate is set the board is already laid, so it tail-hands to the continue / next-life path (beginNextLifeOrIntro). Otherwise it lays out a fresh board. When not in the demo (FROG_STATE_DEMO_FLAG (0x83cd) [seen] == 0) it redraws the score header; and only if the game is two-player (PLAY_FLAG != 1) does it also clear the tilemap and swap in the active player's pages. If a board-advance is pending (BOARD_ADVANCE_REQUEST (0x826d) [seen] != 0) it runs the board-advance foreground. It renders the frog scene and ticks the timer, storing that pass's returned continue flag into BOARD_LAYOUT_GATE (so the gate latches once the board is drawn), redraws the time bar, and stamps three board-start HUD cells at HUD_STAMP_BASE (0x839c) [seen] (+2=0x20, +1=0x10, +0=0x20). In a two-player game it raises the active player's start flag, then clears BOARD_ADVANCE_REQUEST, mirrors the demo flag into PER_PLAYER_RESET_CELL (0x83b6) [seen], redraws the lives row, and returns to the pace tail.

`initInPlayBoardOnce` [seen] performs the heavier one-shot in-play setup, guarded so its body runs once per board. It always runs `clearActivePlayerWorkRam` first; if IN_PLAY_BOARD_INIT_GUARD (0x83ba) [seen] is already non-zero it returns. Otherwise it clears both difficulty indices, zeros ANIM_FRAME_INDEX (0x81b3) [seen] (16-bit), TWO_PLAYER_START_FLAG, and IN_PLAY_BOARD_STATE_BYTE (0x829a) [seen], marks the guard = 1, then runs the lane/object/field setup (loadActivePlayerLaneParams, activateFrogObject, fillTilemapBlock28x32, clearObjectBlocksAndMirrorToObjRam). It seeds INTRO_COUNTER_801B (0x801b) [seen] = 4 and POINT_TABLE_SPRITE_ATTR_8029 (0x8029) [seen] = 6, then blits the board HUD strips (via tile-column copies), the player-select prompt, and the extra-life score-target digits read from EXTRA_LIFE_SCORE_TARGET (0x2e08) [seen].

`setUpPlayStartOnce` [seen] is the once-per-life start-of-play layout called from the main loop, gated twice: it returns unless GAME_MODE == 1 (active play) and INTRO_COUNTER_829B (0x829b) [seen] == 0. Only then does it clear CREDIT_COLUMN_CLEAR_LATCH (0x83b4) [seen], lay out the board (initDisplayFieldOnce, clearAndSeedScoreField, loadActivePlayerLaneParams, renderFrogAndArmObjects, a status-row tile-group blit, resetFrogObject) with TWO_PLAYER_START_FLAG cleared mid-way, run the frog-animation dispatcher, and finally raise TWO_PLAYER_START_FLAG and set INTRO_COUNTER_829B = 1 so the whole layout fires exactly once per life.

### Advancing to the next board

`advanceBoardForeground` [seen] runs when a board is completed. It queues two sound cues (0x10, 0x30), then bumps the active player's difficulty index modulo 5 — increment, wrapping 5 back to 0 — so successive boards ramp through the five lane tiers and then repeat. It reseeds the score field, clears the object blocks and mirrors them to OBJRAM, reloads the (now harder) lane parameters via loadActivePlayerLaneParams, and seeds the object-animation state. It marks BOARD_ADVANCE_DONE_FLAG (0x8380) [seen] = 1 and tail-adds the board-advance score bonus, BOARD_ADVANCE_SCORE_DELTA (0x0100) [seen] (100 points, packed BCD).

`seedObjectAnimationState` [seen] fills two stride-2 cell blocks from fixed tables at board init: 14 cells from OBJECT_ANIM_STATE_8021 (0x8021) [seen] and 10 cells from OBJECT_ANIM_STATE_800D (0x800d) [seen], cell i taking seed i.

`activateFrogObject` [seen] readies the frog: FROG_X = 1 (active), FROG_SPRITE_CODE (0x8045) [seen] = 0, FROG_Y (0x8047) [seen] = 0; and only in a two-player game (PLAY_FLAG == 2) it seeds the two 16-bit frog timers FROG_TIMER_A (0x83d2) [seen] and FROG_TIMER_B (0x83da) [seen] to 64.

### Swapping players in a two-player game

Each player owns a 183-byte work page (led by LANE_OBJECT_INDEX (0x80ff) [seen]) and a 43-byte object page (LIVE_OBJECT_PAGE). Two save areas hold the parked player's state: the "other player" pair OTHER_PLAYER_WORK_PAGE (0x8600) [seen] / OTHER_PLAYER_OBJECT_PAGE (0x85c0) [seen], and the save-bank pair WORK_PAGE_SAVE_BANK (0x8500) [seen] / OBJECT_PAGE_SAVE_BANK (0x86c0) [seen].

`swapOutActivePlayerPages` [seen] banks the two live pages into the save-bank pair, restores the incoming player's pages from the "other player" pair, and writes the OBJRAM per-column attribute shadow OBJRAM_COL3F_ATTR_SHADOW (0x803f) [seen] = 1. Then, unless INIT_GUARD_LATCH (0x8295) [seen] is already set, it clears TWO_PLAYER_START_FLAG and latches the guard to 1 (a one-shot).

`swapInActivePlayerPages` [seen] handles only player 1 (ACTIVE_PLAYER == 1); any other player number tails to the swap-out path. For player 1 it is the mirror of swap-out — it banks the live pages into the "other player" pair and restores the live pages from the save-bank pair — again writing the attribute shadow = 1. So the two save areas alternate roles (source vs destination) between swap-in and swap-out.

`handOffToOtherPlayer` [seen] performs the turn hand-off. It clears PER_TURN_SCRATCH (0x8371) [seen], returns immediately in a one-player game, then toggles ACTIVE_PLAYER between 1 and 2 (XOR 3), loads LIVES_COUNT (0x83b7) [seen,poked] from that player's life counter (PLAYER1_LIVES (0x83b8) [seen,poked] or PLAYER2_LIVES (0x83b9) [seen]), clears PER_PLAYER_RESET_CELL, and sets PLAYER_START_DEMO_FLAG (0x825a) [seen] = 1. When COCKTAIL_ENABLED_FLAG (0x83c2) [seen] is set it toggles bit 0 of SCREEN_FLIP_LATCH and mirrors it to the FLIP_X_LATCH / FLIP_Y_LATCH IO ports — physically flipping the cocktail-cabinet screen so the second player sees the board right-side-up.

`raiseActivePlayerStartFlag` [seen] and `raiseTwoPlayerStartFlag` [seen] raise TWO_PLAYER_START_FLAG. Player 1 delegates to the guarded helper, which raises the flag only if BOARD_ADVANCE_REQUEST is non-zero; any other active player writes the flag directly.

### Continue, next life, and the intro / game-over timer

`beginNextLifeOrIntro` [seen] is the continue / next-life path (reached when BOARD_LAYOUT_GATE was already set). It redraws the score header; if no life remains (LIFE_RESTART_FLAG (0x83ce) [seen] == 0) it just resumes the play loop. Otherwise it re-activates the frog, clears the active player's work RAM, zeros the score-display cursor SCORE_DISPLAY_CURSOR_LO/HI (0x839a/0x839b) [seen] and loc_83cc (0x83cc) [seen,poked], clears BOARD_LAYOUT_GATE = 0 (requesting a fresh layout next frame), zeros the 14-byte per-life HUD block at PER_LIFE_HUD_BASE (0x83a0) [seen], and plays the restart jingle (0x80). It then branches on loc_83cf (0x83cf) [seen]: non-zero runs the intro/game-over countdown, otherwise it hands play to the other player before resuming.

`runIntroTimerThenInitGame` [seen] is the intro / game-over entry. It redraws the GAME-OVER line, plays two jingles (0x0c, 0x0d), and spins the 16-bit INTRO_TIMER (0x83c5) [seen] down to zero (a countdown delay). It then dispatches by configuration: a one-player game re-enters the full cold-start chain (coldStartClearSlotGates); a turn where player 2 is active takes the player-2 continue setup; otherwise it sets CONTINUE_FLAG = 1 and, if CONTINUE_FLAG_2P is already set, pre-clears the player-1 home-bay gates (clearPlayerOneHomeBayGates). Failing that it clears the tilemap, hands to the other player, sets PLAY_FLAG = 1 and PLAYER1_SLOT = 1, zeros the five primary occupancy gates, and copies the saved player-1 work page (0xb7 bytes from OTHER_PLAYER_WORK_PAGE into the live work page) and object page (0x2b bytes from OTHER_PLAYER_OBJECT_PAGE into the live object page), setting the attribute shadow = 1.

`setUpPlayerTwoContinue` [seen] is the symmetric player-2 setup. It marks CONTINUE_FLAG_2P = 1; if CONTINUE_FLAG is already set it enters the cold-start alt-slot-gate clear. Otherwise it clears the tilemap, hands to the other player, sets PLAY_FLAG = 1 and PLAYER2_SLOT = 1, zeros the five alternate-bank occupancy gates, copies the saved player-2 object page (0x2b bytes from OBJECT_PAGE_SAVE_BANK) and work page (0xb7 bytes from WORK_PAGE_SAVE_BANK) into the live pages, and sets the attribute shadow = 1.

### Assembling the attract-demo board

`driveAttractDemoSequencer` [seen] builds and animates the attract river each frame while no credits are queued (CREDIT_BCD (0x83e1) [seen] == 0). If credits are present it forces attract-idle mode. Otherwise it is a state machine on ATTRACT_SEQUENCER_PHASE (0x83bf) [seen]:
- Phase 0 seeds the demo: it fills the play field (fillTilemapBlock28x32), clears the object blocks, and lays out seven four-byte cells starting at FLY_SPRITE_X (0x8040) [seen,poked], each written +0 = 0x00, +2 = 0x03, +3 = 0x81. It sets the frame timer ATTRACT_FRAME_TIMER (0x83bd) [seen] = 4 and its index byte = 5, then arms the animator: ATTRACT_DEMO_PHASE_COUNTER (0x83d7) [seen] = 7, ATTRACT_DEMO_DWELL (0x83bc) [seen] = 0x20, and advances the phase.
- Phase 1 is the scroll animator. The phase counter (1..7) selects one cell's base and its scroll floor from a fixed arm table; the shared tail advances the cell's animation frame on its tick clock (tickAttractCellFrameClock, driven by ATTRACT_FRAME_TIMER and ATTRACT_FRAME_INDEX (0x83be) [seen], looking up the tile in ATTRACT_TILE_TABLE (0x2e1b) [seen]), scrolls the cell left four pixels, writes that frame's tile, and — once the cell reaches its floor — clamps the tile to 0x1e, decrements the counter, and (when it drains) reloads it to 0x14 and advances the phase.
- Phase 2 steps each of the seven cells' +3 bytes down by 4 (not the +0 X byte the phase-1 scroll animator moved).
- Any higher phase tails to the per-cell stamp.

`stampAttractDemoCell` [seen] is the per-cell board-demo assembler. It sets the demo scroll registers OBJECT_ANIM_STATE_800D and DEMO_SCROLL_REGISTER (0x800f) [seen] = 3, decrements ATTRACT_DEMO_DWELL, and returns while still dwelling. On expiry it reloads the dwell to 32, stamps one phase's 2x2 tile corner in VRAM at ATTRACT_DEMO_CORNER_VRAM (0xa8c6) [seen] + 96*(phase-1) using a fixed base-tile table (writes tile, tile+1 across, tile+2/tile+3 on the next row), clears that cell's four-byte object block at FLY_SPRITE_X + 4*(7-phase), and decrements ATTRACT_DEMO_PHASE_COUNTER. When all seven cells are placed it reloads the counter to 7, resets ATTRACT_SEQUENCER_PHASE = 0 and ATTRACT_PHASE_COMPANION (0x83bb) [seen] = 0, and forces attract-idle mode.

`setAttractIdleMode` [seen] — the credits-present / demo-complete tail — simply forces GAME_MODE = 5 (attract-idle).

## Status, scoring, and sound

Every number the machine puts on screen — scores, the high-score table, credits, the extra-life/time HUD, the end-of-board bonus — flows through one small family of digit and strip primitives, and every noise it makes flows through one command ring. This section covers those primitives, the routines that feed them, and the coin front end that starts a game.

### The shared digit and strip primitives

The atom of every readout is `writeScoreDigitStepUp` [seen] (0x0ba9). It stamps one numeral: it writes `digit & 0x0f` straight into the tilemap cell at the caller's pointer, then moves the pointer *up one 32-cell tilemap row* (`ptr - 32`, wrapped to 16 bits) and hands the stepped pointer back. Because the tile index it stores *is* the digit value, the character ROM's tiles 0..9 are the numeral glyphs 0..9 — no translation table. Stepping back 32 cells per digit walks one character cell along the display, so a field is laid out as a run of adjacent cells.

Packed BCD is unpacked on top of that atom. `writePackedBcdByte` [seen] (0x0ba0) prints one packed-BCD byte as two digits — high nibble first, then low — leaving the pointer stepped two rows on. `writePackedBcdWord` [seen] (0x0b9b) prints a 16-bit value as four digits: the high byte's two, then the low byte's two. `writeScoreField` [seen] (0x0b95) is the score/point-value printer: it prints the caller's packed-BCD word as four digits via `writePackedBcdWord`, then appends one fixed literal `0` digit, for a five-cell readout. That trailing zero is the game's storage convention: scores are held as `value/10` in a BCD word and the ones place is always drawn as `0`. So a stored word of 0x0463 displays as `04630`, and a score delta of 1 (BCD) is worth 10 displayed points, a delta of 0x20 worth 200.

Labels and glyph strips ride a second primitive, `copyRunUpTileColumn` [seen] (0x0028): it copies `count` bytes from a ROM source into a tilemap column, stepping the destination back one 32-cell row per byte while the source advances (a `count` of 0 copies 256), and returns both advanced pointers so a caller can chain a second strip where the first left off. Two fill helpers round out the set: `fillTenCellRun` [seen] (0x0779) writes the blank tile 16 into ten consecutive cells, and `fillTilemapBlock22x32` [seen] (0x0781) tiles a 22-wide by 32-tall background block with tile 16 (skipping ten cells between rows) from base 0xa808.

### The status header and the credit line

`renderScoreHeader` [seen] (0x0b1f) redraws the three-column score header every frame. It blits the "HI-SCORE" label strip (`HI_SCORE_LABEL_STRIP`, 0x2ee2, 8 tiles) to `HISCORE_LABEL_DST` [seen] (0xaa60) and writes `HIGH_SCORE` [seen] (0x83ef) as a score field at `HISCORE_VALUE_DST` [seen] (0xaa41). It then stamps a "1" digit at `P1_DIGIT_DST` [seen] (0xab20), blits the shared "-UP" strip (`UP_LABEL_STRIP`, 0x2edf, 3 tiles) up from where the digit left the pointer, and writes `PLAYER1_SCORE` [seen,poked] (0x83ed) at `P1_SCORE_DST` [seen] (0xab41). Only when `NUM_PLAYERS` [seen] (0x8370) is not 1 does it draw the 2-UP column — a "2" digit at the base of the score-display VRAM page `SCORE_DISPLAY_VRAM_PAGE` [seen] (0xa900), the same "-UP" strip, and `PLAYER2_SCORE` [seen,poked] (0x83eb) at `P2_SCORE_DST` [seen] (0xa921). The header therefore reflects live score words directly; there is no separate cached copy.

`renderCreditLine` [seen] (0x0b67) draws the credit line. On its first call it clears the whole 32-cell credit column from `CREDIT_COLUMN_TOP_VRAM` [seen] (0xa81f) with the clear tile 0x10, latching `CREDIT_COLUMN_CLEAR_LATCH` [seen] (0x83b4) so the clear runs once. Every call then blits the "CREDIT" label (`CREDIT_LABEL_STRIP`, 0x2f68, 6 tiles) to `CREDIT_LABEL_DST` [seen] (0xa97f), sets the per-column attribute shadow `OBJRAM_COL3F_ATTR_SHADOW` [seen] (0x803f) to 1, and prints the packed-BCD credit count `CREDIT_BCD` (0x83e1) as two digits at `CREDIT_COUNT_DST` [seen] (0xa89f).

`clearAndSeedScoreField` [seen] (0x0629) resets the score field for a new board. It clears the active player's work RAM via `clearActivePlayerWorkRam` [seen] (0x07e6) — which returns untouched in a one-player game (`PLAY_FLAG` == 1) and otherwise zeroes the frog-object block and the home-bay gate bytes — then zeroes the display-cursor pair `SCORE_DISPLAY_CURSOR_LO` [seen] (0x839a) / `SCORE_DISPLAY_CURSOR_HI` [seen] (0x839b), sets the field-seeded flag `loc_83cc` [seen,poked] (0x83cc) to 1, and tiles 0x20 rows of the field with blank tile 16 — two ten-cell runs per row separated by a two-cell gap (stepping the low byte only, no page carry), stepping down one row each pass — starting at `FROG_ANIM_COLUMN_VRAM` [seen,poked] (0xa806).

### Scoring, extra lives, and the time bonus

`addScoreAndAwardExtraLife` [seen] (0x08e0) is the scoring core. It is gated off entirely while `PLAY_FLAG` [seen] (0x83fe) is 0. Otherwise it picks the active player's score word from `ACTIVE_PLAYER` [seen] (0x83fd) — `PLAYER1_SCORE` (0x83ed) or `PLAYER2_SCORE` (0x83eb) — and adds the BCD delta to it a byte at a time, propagating the low byte's decimal carry into the high byte (the Z80 `daa` carry, reproduced by `bcdAddByte` in core/bcd.js). It then checks the one-time threshold award: if the player's award flag (`PLAYER1_EXTRA_LIFE_AWARDED` [seen] 0x83e7 / `PLAYER2_EXTRA_LIFE_AWARDED` [seen] 0x83e8) is clear and the new score has reached `EXTRA_LIFE_SCORE_TARGET` [seen] (ROM word at 0x2e08, = 0x2000, i.e. 20000 displayed), it clears the scratch cell `loc_83cf` [seen] (0x83cf), sets the award flag, increments the active player's counter — which is that player's *time-remaining* byte `TIME_REMAINING_P1` [seen] (0x83e5) / `TIME_REMAINING_P2` [seen] (0x83e6) — stamps the bonus tile 0x4d into that counter's HUD column by walking back one 0x20 row per count from `EXTRA_LIFE_HUD_SLOT_TOP` [seen] (0xabde), and queues a tile-update command (0x07) on the sound ring. Finally it trails the running high score: `HIGH_SCORE` (0x83ef) is bumped to the new score whenever the new score is larger. (Note: despite the routine name, the 20000-point award increments the time-remaining byte and stamps a HUD tile, not a life count; the true extra-life-per-board award is `awardExtraLife`, below.)

`scoreFrogRowProgress` [seen] (0x1fd6) is the per-hop scorer. When the frog's row `FROG_Y` [seen] (0x8047) is in [0x30,0xd0], and the frog has reached a row nearer the top than its recorded high-water mark `FROG_FURTHEST_ROW` [seen] (0x8269), it updates the mark and awards a BCD delta of 1 (10 displayed points) through `addScoreAndAwardExtraLife`. The bottom edge 0xd0 seeds the mark above the band (0xe0) on first crossing, and the mid row 0x80 updates the mark but awards nothing.

`awardBonusPoints` (0x2673) fires when the frog reaches a home bay. If the home-bay slot cursor mirror `HOME_BAY_SLOT_CURSOR_MIRROR` [seen] (0x8120) is already non-zero it raises the hold flag `HOLD_FLAG` [seen] (0x8004) and returns a skip signal that tells its caller (`awardHomeBayGoal`) to abort the rest of the home-arrival handling. Otherwise it seeds the four-byte goal-award record `GOAL_AWARD_RECORD` [seen] (0x805c) with the popup's screen position followed by the fixed bytes 0x19, 0x03, 0x20; arms the goal-celebration sprite countdown `HOME_GOAL_SPRITE_ARM_CELL` [seen] (0x8340) to 0xa0; and adds a BCD delta of 0x20 (200 displayed points) to the score.

`awardExtraLife` [seen,poked] (0x0a5f) is the board-completion life award, tailed into when all five home bays are filled. It clears `loc_83cc` (0x83cc), increments the active player's life count `PLAYER1_LIVES` [seen,poked] (0x83b8) / `PLAYER2_LIVES` [seen] (0x83b9), mirrors the new count into the display count `LIVES_COUNT` [seen,poked] (0x83b7), and — unless the count has reached the cap of 16 — stamps the lives-row marker tile 0x4c at `LIVES_ROW_MARKER_BASE` [seen,poked] (0xa85e) offset by count × 0x20. The cap limits the drawn markers, not the count. The lives row itself is redrawn by `renderLivesRow` [seen] (0x0a48) from `LIVES_COUNT`, and the extra time from the threshold award shows through `renderTimeBar` [seen] (0x0a16), which draws the active player's time-remaining byte as a column of tile 0x4d.

New-game reset of these cells is `initNewGameScoreAndTimers` [seen] (0x0b0a): it zeros both score words and both extra-life-awarded flags, and copies the starting-time byte (0x83e4) into both time-remaining bytes so both time bars start full; it deliberately does not touch the high score at 0x83ef.

### The high-score ranking table

`insertHighScoreEntry` [seen] (0x0a84) maintains a five-entry descending table of 16-bit keys, two bytes per slot (key-low just below key-high), whose top slot's high byte is `HIGH_SCORE_TABLE_TOP_HI` [seen] (0x83f2) — the table spanning 0x83f1..0x83fa. It walks the five slots top to bottom and inserts at the first slot the new key outranks (higher high byte, or equal high byte and higher low byte), shifting the tail down one slot to open the gap, then stores the new key. An exact duplicate at the last slot is reported but not stored. It returns a slot-index code: 0 when the key ranked below every slot, otherwise `4 × (slots below the insertion point) + 1` (so rank-5 insertion returns 1, rank-1 insertion returns 17).

`packScoreRankPair` [seen,poked] (0x0f69) drives that table at new-game init. It reads both players' final score words, ranks the larger first and the smaller second through `insertHighScoreEntry`, and packs the two returned rank codes into the display field `INTRO_DIGIT_FIELD` [seen] (0x83fb) — the larger's code in the low byte (0x83fb), the smaller's in the high byte (0x83fc). This is the "did you make the table" record consumed by the attract ranking screen.

### The end-of-board bonus countdown

`driveScoreDisplayCountdown` [seen] (0x0870) runs the end-of-board bonus display each frame. It returns immediately while the demo flag `FROG_STATE_DEMO_FLAG` [seen] (0x83cd) or the hold flag `HOLD_FLAG` (0x8004) is set. On its first pass (guard `COUNTDOWN_EXPIRY_FLAG` [seen] 0x83ae still 0) it sets that flag and queues sound 0x06. It then runs the one-time layout `initDisplayFieldOnce` [seen] (0x0aba): guarded by `loc_842d` [seen] (0x842d), it blits a four-tile strip up `LAYOUT_SETUP_STRIP_VRAM` (0xa8bf), fills 15 rows of tile 12 down `LAYOUT_SETUP_COLUMN_VRAM` [seen] (0xa8df), and seeds the 16-bit counter at `loc_83dc` [seen] (0x83dc) with `SCROLL_STATE_INIT` [seen] (0x3c20) and the display byte `loc_83de` [seen] (0x83de) with 96. That 16-bit seed sets the *step count* in the high byte `SCORE_DISPLAY_COUNTER_HI` [seen] (0x83dd = 0x3c, sixty steps) and the *per-step pace* in the low byte (0x20, thirty-two frames per step).

If `SCORE_DISPLAY_ARM_SELECT` [seen] (0x83df) is non-zero the driver takes the bonus arm (below). Otherwise it ticks the pace low byte down; on each drain it reloads it to 0x20 and takes one step: if the step count `SCORE_DISPLAY_COUNTER_HI` has reached 0 it takes the end tail `blitEndStripAndSetHold`; otherwise it decrements the step count, BCD-decrements the displayed byte `loc_83de` (via `bcdSubByte`), fires a warning sound 0x05 and clears `OBJRAM_COL3F_ATTR_SHADOW` when that byte reaches 0x10, and animates one bar cell. The bar animation indexes a cell from the step count's high bits (rotate the top six bits, double for the two-byte stride from the bar base at 0xa8df) and writes `0x10 - (count & 3)` there, so each step advances one tile of the draining bar.

`blitEndStripAndSetHold` [seen] (0x085b) is the no-more-frogs tail: it blits a four-tile then a five-tile strip up `NO_MORE_FROGS_COLUMN_VRAM` [seen] (0xaa51) — the second continuing where the first left the pointer — and raises `HOLD_FLAG` (0x8004) = 1, which halts the countdown driver.

`armScoreBonusStrip` [code] (0x08c5) is the bonus arm — the `SCORE_DISPLAY_ARM_SELECT != 0` branch and also a standalone entry from the home-goal path. Guarded by `loc_83e0` [seen] (0x83e0) so it runs once, it blits a five-tile strip up 0xaa51, prints the remaining countdown byte `loc_83de` as two BCD digits, then cashes that remaining byte into the score through `addScoreAndAwardExtraLife` — the end-of-board time-bonus payout.

### Sound: the command ring

Audio and some tile-update work are dispatched to the sound CPU through a single command ring, not played directly. `enqueueSoundCommand` [seen] (0x0018, the `rst 0x18` primitive) pushes one command byte onto the ring: it drops the command outright while `PLAY_FLAG` (0x83fe) is 0, otherwise it bumps the pending count `SOUND_QUEUE_COUNT` [seen] (0x8300) and stores the command in the slot at that new index (0x8300 + count). The ring is a simple FIFO — the count is the number pending, slot *i* holds the *i*-th queued command.

`dequeueSoundCommand` [seen] (0x07ac) drains one command per in-play frame: while the pending count is non-zero it decrements the count, issues the front command (slot 0x8301), and shifts the remaining slots down one. `issueSoundCommand` [seen] (0x0794) is the hardware hand-off: it latches the command byte into the sound-data port `SOUND_CMD_LATCH` [seen] (0xd000, PPI1 port A), then pulses `SOUND_CTRL_PORT` [seen] (0xd002, PPI1 port B) bit 3 low-then-high using the RAM shadow `SOUND_CTRL_SHADOW` [seen] (0x83d9) — the falling edge raises the audio CPU's /INT so it reads the latched command. `clearSoundQueue` [seen] (0x07d9) resets the whole 48-byte ring region (the count plus 47 slots, 0x8300..0x832f) at game start.

The ring carries more than tones. `addScoreAndAwardExtraLife` queues 0x07 (a tile update), the countdown driver queues 0x06 and 0x05 (start and warning), and `enqueueLaneScrollSyncedCommand` [seen] (0x2906) queues 0xd0 — the frog-on-log edge blit — but only while `PLAY_FLAG` is set, the lane-control phase byte `LANE_CONTROL_SPEED_7` [seen] (0x81a2) is in [0x02,0x0e], and the lane scroll position `LANE_RUN_SCROLL_POS` [seen] (0x8140) is 0, so the blit lands on a scroll-aligned frame. `raiseSpriteArmOneShotAndQueueSound` [seen] (0x2ae6) is a per-turn one-shot: while its scratch flag (0x8371) is 0 it latches it and enqueues the spawn sound 0x90, then does nothing on later calls that turn.

### Coins and credits

`scanCoinInputAndCredit` [seen] (0x2cf0) is the coin scanner the vblank interrupt calls first. It reads the coin input port `IN0_PORT` [seen] (0xe000) and inverts it. On the boot/attract pass — when the latch `COIN_INPUT_LATCH` [seen] (0x83e2) is 0 — it arms the latch with the inverted coin+service bits (`~IN0 & 0xc4`) and returns. Once armed, it waits for the release edge (all masked bits low again) before crediting, so one coin credits once. On the edge it issues the coin sound (1), then services the slot the latch bit selects: bit 0x40 selects slot 2 (pulse hardware counter `COIN_COUNTER_1` [seen] 0xb81c and seed its pulse timer `COIN_PULSE_TIMER_1` [seen] 0x837f to 4), otherwise slot 1 (pulse `COIN_COUNTER_0` [seen] 0xb818 and `COIN_PULSE_TIMER_0` [seen] 0x837e — unless the latch's bit 0x04 says skip the counter).

The credit amount comes from the coinage word `COINAGE_WORD` [seen] (0x83d4), which is one of {0,2,4,6}. Slot 1 credits {0→1, 2→every other coin, 4→every other coin, 6→1}; slot 2 credits {0→1, 2→every other coin, 4→3, 6→6}. The "every other coin" variants bump the pair toggle `COIN_PAIR_TOGGLE` [seen] (0x83e3) and grant one credit only on the even count. A declined every-other coin adds nothing. Otherwise the credit is added in BCD to `CREDIT_BCD` (0x83e1), clamped at 0x99 on carry. Finally, unless a game is already in play (`PLAY_FLAG` non-zero), it starts the player-select flow: it draws the player-select prompt via `blitPlayerSelectPrompt` [seen] (0x0db9) if the mode was already player-select, forces `GAME_MODE` [seen] (0x83d6) to 5 (player-select), clears `POINT_TABLE_DRAW_STATE` [seen] (0x83d8), zeroes the 0x20-byte fly/object work block from `FLY_SPRITE_X` [seen,poked] (0x8040), and redraws the credit line.

### The attract SCORE RANKING screen

`renderMode3ScoreRankingScreen` [seen] (0x0bb3) builds the attract-mode score-ranking screen in one call. It resets the attract pacing machinery — steps the pacing gate `POINT_TABLE_DRAW_STATE` (0x83d8) down one, zeros the sub-phase counter `ATTRACT_DEMO_PHASE_COUNTER` [seen] (0x83d7) and the start latch `START_LATCH` [seen] (0x83b3) — then paints the 22×32 background via `fillTilemapBlock22x32`, seeds the work cell `OBJECT_ANIM_STATE_8019` [seen] (0x8019) to 3 and zeros five 4-strided cells from `OBJECT_ANIM_STATE_801F` [seen] (0x801f) to wipe leftover attract objects. It stamps the rank markers (below), blits the 13-tile "SCORE RANKING" header (`SCORE_RANKING_HEADER_STRIP`, 0x2ee5) to `SCORE_RANKING_HEADER_DST` [seen] (0xaaac), then for rank 1..5 draws the rank digit at column `SCORE_RANKING_RANK_DIGIT_VRAM_PAGE` [seen] (0xaa00) offset `(2·rank + 0xcd)`, and that rank's high-score word — read from `HIGH_SCORE_TABLE_BASE` [seen] (0x83f1) + 2·(rank−1) — as a score field at `SCORE_DISPLAY_VRAM_PAGE` (0xa900) offset `(2·rank + 0xed)`, each flanked by a fixed tile strip and the " PTS" suffix (`PTS_SUFFIX_STRIP`, 0x2fba). It ends by falling into the shared final-strip tail.

`placeScoreRankMarkers` [seen] (0x0c3d) stamps the "your rank" markers. For each of the two bytes of the packed field `INTRO_DIGIT_FIELD` (0x83fb) — the rank codes `packScoreRankPair` stored — a non-zero code writes the constant marker tile 4 into work-RAM page 0x80 at offset (48 − code), via the row helper `loc_0c4a` [seen] (0x0c4a) which writes a byte into page-H RAM at row (D − C) and skips when C is 0. A zero code stamps nothing; the rank is encoded as a *position*, not a rendered numeral.

`blitMode3FinalStrip` [seen] (0x0c17) is the shared final-strip tail: it zeros the strip-state cell `OBJECT_ANIM_STATE_8039` [code] (0x8039), then blits a 15-tile strip (`MODE3_FINAL_STRIP_SRC`, 0x2f4d) up the VRAM column `MODE3_FINAL_STRIP_VRAM` [seen] (0xaafc). It is reached both by fall-through from the ranking render and by a direct jump when the mode is already set up.

## The lane-object mover

`moveLaneObjectsAndCarryFrog` (0x14b7) [seen] is the per-frame engine that scrolls every obstacle lane and, when the frog is riding, drags it along with the lane it stands on. One routine drives all eleven lanes; a single leaf mover handles one lane, and a sign-flipped twin handles the other direction. The whole thing runs off a handful of parallel 11-entry work-RAM tables indexed by a walk cursor.

### The eleven-object walk

The routine loops over eleven lane objects in a fixed order, driven by the walk cursor `LANE_OBJECT_INDEX` (0x80ff) [seen]. Each pass reads `i = mem8[0x80ff]`, dispatches object `i`, then increments the cursor; when the incremented value reaches 11 (`OBJECT_COUNT = 0x0b`) the cursor is reset to 0 and the routine returns, so the next frame restarts from object 0. Because the mover itself never touches 0x80ff, the same `i` read at the top is still the live index when the shift runs — the increment happens only after the object has moved.

Which mover runs for each object is a fixed table (`LANE_MOVERS`): objects 0, 2, 3, 7, 9 scroll rightward; objects 1, 4, 6, 8, 10 scroll leftward; object 5 is a **spacer** with no mover — its pass only advances the cursor, moving nothing. An index above 10 is a structural impossibility and throws.

Each object owns three parallel per-index cells, addressed by adding `i` (or a strided multiple of `i`) to a base:

- its **control byte** at `ANIM_FRAME_BUFFER + i` (0x819b + i) [seen,poked] — the low nibble is the lane speed, bit 4 is the sub-rate flag (this 11-byte block 0x819b–0x81a5 is the per-board lane-control block; `LANE_CONTROL_SPEED_7` (0x81a2) [seen] is its object-7 byte);
- its **sprite run** at `SPRITE_BLOCK2_BASE + i*9` (0x8100 + 9·i) [seen] — a length-prefixed list of the lane's per-column positions (stride `RUN_STRIDE = 9`);
- its **lead record** at `LIVE_OBJECT_PAGE + i*4` (0x800c + 4·i) [seen] — the object's 4-byte OBJRAM record (stride `LEAD_STRIDE = 4`);
- its **phase countdown** at `LANE_OBJECT_PHASE_TABLE + i` (0x81a6 + i) [seen] — the sub-rate tick counter.

### One mover, two speeds

A lane runs at one of two speeds decided by its control byte, arbitrated through the phase countdown cell:

- **Fast lane** (bit 4 clear, and no countdown pending): the lane shifts by the full speed nibble `c = b & 0x0f` **every frame** — `c` pixels per frame.
- **Slow / sub-rate lane** (bit 4 set): instead of moving `c` px/frame it moves **1 px every `c` frames**. On the frame the control byte is re-read (`phase == 0`) with bit 4 set, the countdown is seeded to `c − 1` and the lane holds; each subsequent frame decrements the countdown and holds; when the countdown is read as `1` the lane shifts by exactly 1 pixel and the countdown is cleared, so the next frame re-reads the control byte and re-seeds. A pending countdown (`mem8[phase] != 0`) always takes precedence over the control byte, which is how the hold persists across frames. This is what gives the game lanes that visibly creep rather than jump — the phase table is the fractional-speed accumulator, one cell per lane.

The dispatch order inside each mover is: pending countdown first, then bit-4 sub-rate, else the plain per-frame shift. `LANE_OBJECT_PHASE_TABLE` (0x81a6) is grounded [seen] as counting down one per frame, reloading to the control nibble minus one, with the lead stepping one pixel on the frame the count reaches 0.

### The shift and the per-column scroll

The shift walks the lane's sprite run and advances every position in it. The run's first byte is a **count `n`**; the mover then adds the speed `c` to each of the `n` bytes that follow it (a count of 0 means a full 256-byte run, since `(0−1) & 0xff` loops 256 times). That is the per-column scroll: every column/segment of the obstacle (a log or truck is several 8-pixel pieces) steps by the same `c` in lockstep, so the whole object slides as a unit.

The mover then advances the **lead record**: it writes the shifted X into both byte 0 and byte 2 of the 4-byte record at 0x800c + 4·i (`x = (mem8[lead] + c) & 0xff`, then `mem8[lead] = mem8[lead+2] = x`). The lead page 0x800c is the OBJRAM shadow — `OBJRAM_OBJECT_MIRROR_BASE` (0xb00c) [seen] is its hardware mirror — and it lives inside the per-frame sprite-shadow DMA window `SPRITE_SHADOW_SRC_BASE` 0x8008–0x803f [seen], copied each vblank into OBJRAM `OBJRAM_SPRITE_BLIT_BASE` 0xb008 [seen] with the **even byte of every pair nibble-swapped** (`((v>>4)|(v<<4)) & 0xff`) and the odd byte straight. Since the lead X bytes sit at even offsets, the plain X the mover computes lands in OBJRAM 0x00–0x3f nibble-swapped — that swapped value is the lane's per-column tilemap-scroll register, so advancing the lead X each frame is exactly how the lane scrolls on the rotated Galaxian display.

### The mirror mover

The leftward mover is the rightward mover with the sign flipped: it subtracts `c` from every run byte and from the lead's two X bytes instead of adding, and shares the identical two-speed / phase-countdown arbitration. The idiomatic module even reuses the same `swapNibbles` helper. Two real ROM asymmetries survive between the twins and are reproduced faithfully:

- The rightward shift gates the carry to the band `0x30 ≤ FROG_Y < 0x73`; the leftward shift keeps only the **upper** bound (`FROG_Y >= 0x73` → no carry) and omits the lower `< 0x30` bound. This is a faithful ROM asymmetry; its effect on a below-band frog is narrow — the carry also requires the row's low nibble and high-nibble-derived column to match the object, so it fires only in that corner case.
- The rightward low-edge carry re-tests `FROG_Y < 0x30` before carrying; the leftward low-edge carry does not.

### The carry and the row→object map

After shifting, a mover checks whether the frog is standing on **this** lane and, if so, drags it. The gate is the frog's row `FROG_Y` (0x8047) [seen]: only rows in the river band (rightward: `[0x30, 0x72]`) qualify; the road band and the top are excluded, matching real Frogger where logs carry but the road never does. Within the band the low nibble `col = FROG_Y & 0x0f` selects the sub-case: `col < 0x03` is the **low edge** of the cell, `col >= 0x0c` is the **high edge**, and anything between (the frog centered / mid-hop) is not carried at all.

The mover then confirms the frog is actually in *this object's* lane via a row→index map. It takes the row's high nibble, subtracts the band top `0x30`, and nibble-swaps the result; that value is compared against the current walk index `LANE_OBJECT_INDEX`:

- **Low edge** (`rightCarryLow`/`leftCarryLow`): `cellCol = swapNibbles((FROG_Y & 0xf0) − 0x30)`, mapping row bands 0x3x…0x7x to object indices 0…4 — the five river lanes.
- **High edge** (`rightCarryHigh`/`leftCarryHigh`): the same map but with `+0x10` first, `swapNibbles((FROG_Y & 0xf0) + 0x10 − 0x30)` — the frog straddling a cell boundary is assigned to the *next* lane up.

If `cellCol` does not equal the object being moved, the carry is refused (phase cleared, no drag). When it matches, the frog rides:

- Low edge: `FROG_X` (0x8044) [seen] is stepped by the lane speed in the lane's direction (`+c` right, `−c` left) and then bounds-checked — if the ride pushes it off the screen (`FROG_X < 0x08` or `FROG_X >= 0xe7`) the frog is lost: `loseFrog` raises `HOLD_FLAG` (0x8004) [seen] to `0x01`. Riding a log off either end drowns the frog.
- High edge: `FROG_X` is stepped by the same amount with **no** bounds check — the frog is simply carried into the adjacent column.

Every path ends by clearing the object's phase countdown (or, on a loss, setting the hold flag and then clearing the phase), so the object is free to re-arm its sub-rate cycle next frame. The routine's only live-out is memory: the shifted run/lead bytes, the frog X, and the hold flag.

## Not yet named / open

- **`loc_27ea`** — `[seen,poked]`, the two-pair-figure per-frame driver (above); kept `loc_` because its
  role is ambiguous: a turtle-dive-specific clock versus a generic figure clock, undecided.
- **`loc_0c4a`** — `[seen]`, a work-RAM store (writes `E` to page `0x80` at `0x80(D-C)`), called by
  `placeScoreRankMarkers`; kept `loc_` — role grounded, no converged name. It is not the intro-digit-tile
  writer it resembles.
- **`loc_23eb`** — `[seen]`, the home-bay slot cursor (above); kept `loc_`, no converged descriptive name.
- **`computeVramColumnIndex`** (`0x1198`) — a pure-register leaf returning only `C`; `[code]`, with no
  runtime-observable effect to ground.
- **`0x83c7`** — a work-RAM cell held as a bare literal (keep-hex): write-only in the layer, role
  unconfirmed.
