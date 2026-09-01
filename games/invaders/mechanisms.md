# Space Invaders — how the machine works

This map describes the parts of Space Invaders (Intel 8080, Midway `mw8080bw` board) whose behaviour has
been recovered into the idiomatic layer. It is a **current-state** description of the machine, not a history
of the port. Every claim is tagged with the confidence of its reading:

- **[seen]** — a role confirmed by a MAME observation.
- **[code]** — a role read from the routine bodies (the frozen oracle + its idiomatic rewrite); MAME
  grounding is still open. Everything below is **[code]**: this is the first understanding pass, and stage-B
  grounding has not yet run.
- **[guess]** — an unclear reading; these keep a `loc_<addr>` placeholder rather than a descriptive name.

What is described here is the layer of **low-level helper routines** — the primitives the game's spine calls
to touch video, sound, the alien field, the per-player records, and the frame timers. The game's control-flow
spine (the main loop, the object dispatchers, the interrupt handlers) is still the frozen translated oracle
and is **not** described yet; a routine named `loc_<addr>` anywhere below is one whose role is not yet pinned.

## Video RAM and the framebuffer

The screen is a 1-bit-per-pixel framebuffer living in main RAM from `VIDEO_RAM_BASE` (0x2400) up to just
below `VIDEO_RAM_END` (0x4000); the block `[VIDEO_RAM_BASE, VIDEO_RAM_END)` is what the beam scans. The
display is rotated (the cabinet is vertical), so the framebuffer is addressed **by column**: consecutive
bytes climb one screen column, and moving one column to the right steps the address by 0x20 (32 bytes = 256
pixels). `PLAYFIELD_VRAM_BASE` (0x2402) is the base used for the play-field region specifically.

Several primitives write this framebuffer:

- **`clearScreen`** (0x1a5c) zeroes the whole framebuffer, walking from `VIDEO_RAM_BASE` until the high byte
  reaches 0x40 (i.e. up to `VIDEO_RAM_END`). **`clearPlayfield`** (0x09d6) clears the play-field region the
  same way.
- **`fillScreenRow`** (0x14cc) fills a run of `B` columns with the accumulator byte, stepping the destination
  one column to the right (stride 0x20) each pass — a horizontal band across the screen (the caller uses it
  for full-width dividers); it leaves the advanced pointer in HL to continue. A count of 0 means 256 passes.
- **`coordToScreenAddr`** (0x1a47) turns a coordinate in HL into a framebuffer address: it shifts HL right by
  three (dividing the pixel coordinate to a byte coordinate) and forces the high byte into the 0x20-0x3f range
  so the result always lands inside the framebuffer window.
- **`drawSpriteColumn`** (0x1439) copies `B` source bytes into `B` adjacent screen columns (stride 0x20 = one
  column right per byte), each source byte an 8-pixel column-slice — a `B`-column-wide sprite strip.
  **`orBlitBitmap`** (0x1a69) is the OR-drawing form: for each of `B` columns (0x20 apart) it ORs `C` source
  bytes down that column, so a sprite is merged onto whatever is already on screen rather than overwriting
  it. **`blockCopy`** (0x1a32) is a plain byte-block copy from (DE) to (HL). **`captureScreenRect`** (0x147c)
  copies a screen-shaped rectangle (`B` columns × `C` bytes) out to a buffer — the inverse direction, used to
  save a region before something is drawn over it.

## Sound

Space Invaders drives its discrete sound board through two 8080 output ports, and the game keeps a RAM
**shadow** of each so it can set and clear individual bits without disturbing the others:

- **`SOUND_PORT3_SHADOW`** (0x2094) shadows OUT port 3. **`startSound`** (0x18fa) ORs bits into it and mirrors
  the result to port 3 (turning a sound on); the routine at 0x19dc ANDs bits out and mirrors again (turning
  one off).
- **`SOUND_PORT5_SHADOW`** (0x2098) shadows OUT port 5, which carries the fleet-movement and saucer sounds.
  **`latchSoundPort5`** (0x1770) masks the accumulator to the two sound-select bits and emits it; the routine
  at 0x176d emits `SOUND_PORT5_SHADOW & 0x30` (silencing the low sound bits).

## The alien field

The rack of invaders is stored as a field of one-byte-per-alien cells in the active player's RAM page.
**`ACTIVE_PLAYER_PAGE`** (0x2067) holds the high byte of that page (0x21 for player 1, 0x22 for player 2);
its low bit doubles as the active-player selector used throughout the per-player logic below.
**`ALIEN_COUNT`** (0x2082) is the number of invaders still alive (0-55), recomputed by scanning the field.

- **`markAllAliensAlive`** (0x01c3) initialises the field, writing 1 into a run of 0x37 (55) cells from a base
  pointer — the full 5×11 rack at the start of a wave.
- The rack's screen position is anchored by a reference-alien coordinate pair at 0x2009 / 0x200a (the rack
  origin; which of the two is X and which is Y is not yet pinned, so both keep `loc_` names pending grounding).
  **`alienIndexToScreenCoords`** (0x017a) resolves a linear index over this base into per-column screen
  coordinates, stepping by 0x10 per column across the 11-wide rack.
- **`selectAlternateSpriteFrame`** (0x013b) advances a sprite pointer by 0x30 to the invader's second
  animation frame (the marching legs).

## Per-player records and input

Each player has a data page (selected by `ACTIVE_PLAYER_PAGE`) and a small object/sprite descriptor record,
`PLAYER1_OBJ_DESC` (0x20f8) and `PLAYER2_OBJ_DESC` (0x20fc), used for the saucer/UFO and per-player sprite
state. Pointer helpers select the active player's data by the page's low bit:

- **`activePlayerPageBase`** (0x1611) forms `ACTIVE_PLAYER_PAGE << 8`, the base address of the active player's
  field page. **`currentPlayerRecordPtr`** (0x09ca) selects the active player's descriptor
  (`PLAYER1_OBJ_DESC` vs `PLAYER2_OBJ_DESC`). **`activeFieldRecordPointer`** (0x0886) builds a pointer into
  the active field page.
- **`loadSpriteDescriptor`** (0x1a3b) reads a five-byte descriptor at a pointer into DE/A/C/B and re-forms a
  screen address from two of them. **`advanceRecordTotals`** (0x01d9) accumulates running totals inside a
  record.
- **`readActivePlayerInput`** (0x17c0) reads the active player's control input from IN port 1 or IN port 2,
  chosen by the `ACTIVE_PLAYER_PAGE` low bit (player 1 → IN1, player 2 → IN2).

## Frame tasks, timers, and configuration

- **`TASK_FLAGS`** (0x20c1) is a per-frame task/request bitmask: the spine clears it at the top of the frame
  loop and sets bits as work is requested; a dispatcher rotates the byte and vectors each set bit to its
  handler. **`GAME_ACTIVE`** (0x20e9) is the master enable read by both interrupt handlers — when it is zero
  they skip all per-frame object/draw work; the routine at 0x19d1 sets it (loading 1) and 0x19d7 clears it
  (loading 0), both funnelling through the shared store tail at 0x19d3.
- **`TIMER_RELOAD`** (0x0600) is the constant a 16-bit frame countdown reloads to when it underflows (the
  counter itself, at 0x2091, keeps a `loc_` name until grounding confirms exactly what it times).
- **`readStartingShips`** (0x08d1) reads the starting-lives DIP setting: `(input port 2 & 3) + 3`, i.e. 3-6
  ships.

## What is not described yet

The 155 routines still running as the frozen translated oracle — the main frame loop, the `pchl` object-state
dispatcher and its handlers, the two RST interrupt handlers, collision and scoring, and the attract-mode demo
— are not covered here; they lift and get described in later batches. A handful of lifted leaves also keep
`loc_<addr>` names because their role is not yet confident from the code alone (a timer-wrap flag at 0x2083, a
per-player byte pair at 0x20e7, a small ROM table at 0x1da0, and a few routines whose game-purpose is open);
these resolve at grounding or when their callers lift.
