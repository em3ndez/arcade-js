# Time Pilot — how the machine actually works

A code-grounded model of Konami's Time Pilot (`timeplt`, 1982), built from the translated ROM, from
the routines the idiomatic layer has rewritten, and from observations of the real machine under
MAME. Its companion is `gameplay.md`, which describes the same game from the outside using only the
public record and deliberately knows nothing about the code. Where the two meet is the interesting
part: this document exists to answer the questions `gameplay.md` could not, and to be honest about
which ones it still cannot.

**Every claim carries a confidence tag, and the tags are not decoration.**

- **`[seen]`** — observed on the real ROM under MAME. Our engine may be in the chain, but the
  reference must be the real machine. A pixel diff against a MAME golden is `[seen]`.
- **`[code]`** — derived from the behaviour of a translated routine. The mechanics are exact,
  because the lift is faithful; the *role* is inference.
- **`[guess]`** — plausible and unverified. Not to be relied on.

**A number is `[seen]` only if its evidence chain terminates in MAME.** A dispatch count from our
own `Machine` replaying the ROM is our engine, however long the window, and an
idiomatic-versus-oracle equality is our JavaScript against our JavaScript. Both are good evidence
about the *port* and both are `[code]`. This is not pedantry: several claims in this document's
history were tagged `[seen]` on the strength of a measurement taken from our own machine, and the
error is invisible once written.

A wrong role stated confidently is worse than no name at all. Where the code cannot settle
something, this document says so rather than choosing.

**How this is written.** The body is re-derived WHOLE each understanding pass, from `gameplay.md`,
blind to its previous version — never patched. A patch preserves the previous reading's blind spots;
a rewrite forces re-derivation. Each of the area re-derivations behind the sections below carried an
explicit prohibition against reading or citing the prior map. Grounding that lands **between** passes
is folded into the section it belongs to rather than held back — so a `[seen]` claim may sit inside a
section a rewrite produced, and an open question may have been struck off since.

The structure below follows `gameplay.md`'s outside-in order and what the evidence actually turned
out to be.

---

## §2 The frame: one interrupt, four modes

Time Pilot runs as two cooperating loops. In the foreground, a loop that never exits drains a ring of drawing commands and, whenever the ring is empty, redraws the cloud bands and waits for the next picture. Everything else — reading the panel, counting coins, moving every aircraft, deciding what screen the cabinet is showing — happens inside one interrupt that fires once per frame at the start of vertical blank. There is no vertical-blank flag poll anywhere in the program; the hardware raises the interrupt only while one latch line is set, and the service turns that line off early and back on at its very end [code]. The interrupt does a fixed block of housekeeping and then hands the rest of the frame to a two-level **sequence machine**: an outer phase, SEQUENCE_PHASE 0xA9AB [seen], chooses one of four modes (power-on wipe, attract, credit-and-start, round engine), and an inner index, SEQUENCE_SUBSTEP 0xA9AC [code], chooses which step of that mode runs this frame. A step does its work and, when it is finished, bumps the inner index so the next frame runs the next step. Nearly all of the game's pacing is expressed as steps that hold on a countdown — the shared delay cell SEQUENCE_DELAY 0xA9EB [seen] — before moving on. Woven through all of it is an unusually dense web of program-image checksums, most of which do not stop the machine when they fail but quietly knock the sequence machine off its rails.

Three of the hardware addresses the frame touches mean different things in each direction, and it is worth fixing that before reading anything else. 0xC000 is the sound-command latch when written and the raster (scanline) counter when read — the sprite multiplexer reads it, and those reads have nothing to do with sound. 0xC200 kicks the watchdog when written and returns the gameplay switch bank DSW1 when read. 0xC300 is the first line of the control latch — the interrupt gate — when written and the coin/start panel IN0 when read [code].

### Power-on: from reset to the first frame

The processor starts at 0x0000, three bytes that pass straight on to `seatTheStackAndSettleTheControlLatch` [seen]. That routine first reads EXPANSION_SOCKET_PROBE 0x6000: an empty socket floats the bus, and only the value 0x55 would mean an expansion board is present, which on a real cabinet never happens, so the boot continues. It kicks the watchdog, walks the eight addresses of the output latch from NMI_ENABLE_LATCH 0xC300 upward writing zero — the latch takes its data from the low bit and pairs two addresses to a line, so this settles four control lines, the frame interrupt's gate among them — and turns the picture on by writing VIDEO_ENABLE_LATCH 0xC308 from a byte of the image, DISPLAY_ON_VALUE 0x2D4B, rather than from a literal [code]. The stack is seated just below sprite memory, at SPRITE_RAM_BASE 0xB000, and grows down through the top of work RAM.

`clearWorkRamAndSpriteBanksThenColdInit` [seen] then zeroes two 48-byte runs of the second sprite bank and the whole 2 KB of work RAM from PLAYER_STATE 0xA800 to 0xAFFF, kicking the watchdog between runs. Because work RAM is now all zero, the sequence machine comes up in phase 0, step 0 — and because the wipe is a real instruction rather than the power-up state of the chips, every work-RAM cell's post-reset value is a property of the machine that later code can rely on. The same wipe also makes it a writer of every cell in work RAM, which matters whenever a cell's writers are being enumerated [code]. `clearScreenRamAndVerifyImageThenColdInit` [seen] fills the 1 KB colour plane with 0x10 and the 1 KB character plane with the blank glyph 0xF1 (both bases read from image words, COLOUR_RAM_BASE_WORD 0x2581 and VIDEO_RAM_BASE_WORD 0x4A37), then sums the entire program image and hands on to `initColdStartRamThenSeedConfig` [seen]. That routine paints the 64-cell display command ring COMMAND_RING 0xAC00 [seen] with 0xFF — every cell marked free — seeds the random generator, copies the default high-score table in, and empties the deferred-cell lists, before handing on to the settings decode described under *The gameplay-config bank* below.

The last boot step is `petWatchdogThroughStartupDelayThenStartMachine` [seen]: twelve passes of 256 watchdog kicks each, counted down in SEQUENCE_DELAY 0xA9EB (which therefore ends the boot at zero, a fact the attract cycle's first hold inherits), a zero command sent to the audio processor through `sendSoundCommand` [seen] to quiet it, and finally `enableInterruptAndEnterForegroundLoop` [seen], which writes the image byte NMI_ENABLE_BYTE 0x4C87 (0x01) to the interrupt gate and jumps into the command-ring loop `runCommandRingDrainLoop` [seen] at 0x0B93. From here on, the foreground only ever draws; the frame interrupt does the thinking.

The foreground loop is entered once and never left. Boot reaches it by a jump, so there is no return address for it to go back to, and every frame interrupt lands inside it: the stack sits at one depth the whole time the loop runs, and the interrupt is always accepted two bytes below that seat [seen]. Almost all of its time is spent spinning on an empty ring — only a tiny fraction of its passes find a command to run [seen].

It reads the ring cell COMMAND_READ_CURSOR 0xA9B3 [seen] names. A cell with its high bit set is free, so the loop redraws the banded cloud layer and waits for the next frame. An occupied cell yields a command byte and an argument byte; both cells are marked free again before the command runs, the cursor steps two cells (wrapping inside the 64), and the command's low nibble selects one of sixteen handlers from COMMAND_HANDLER_TABLE 0x0BBC [code]. That the low nibble alone selects the handler is established on the real machine — a command byte placed in the ring runs the handler its nibble names and no other [seen]; the order is from the code: because the pair is freed before the handler runs, a handler may reuse the very pair it arrived in [code]. The ones the sequence machine leans on are 1 (draw a caption by index), 2 (draw a caption in the pen colour), 3 (erase a caption), 4 (add a score award), 5 (draw the reserve-ship emblems), 6 (draw the round-count pictograms), 7 (draw the round-number caption), and 10 and 11 (draw a caption in one of two shifted colours); six of the unused slots point at a bare return [code]. Producers append with `postCommand` [seen], which writes a pair at COMMAND_WRITE_CURSOR 0xA9B2 [code] only if that cell is free and otherwise drops the pair silently, so a burst of requests while the foreground is behind simply loses the excess.

### The vertical-blank service

The frame interrupt enters at 0x0066 (`enterVblankInterrupt` [code]) and runs the frame service `serviceVerticalBlankInterrupt` [code] at 0x00D9 (`saveAccumulatorForFrameInterrupt` [code] at 0x00D8 falls into it). Its order is fixed and every step runs every frame:

First it publishes the picture that the previous frame's logic prepared. `publishSpriteShadow` [seen] gathers three runs of the sprite shadow — six bytes from SCENERY_ENTRY_SLOT0 0xAA30, thirty-two from PLAYER_ENTRY 0xAA10, ten from SCENERY_ENTRY_SLOT3 0xAA36, and the matching attribute runs from 0xAA60, 0xAA40 and 0xAA66 — into the two 48-byte hardware banks at SPRITE_BANK0_BASE 0xB010 and SPRITE_BANK1_BASE 0xB410, transforming bytes one way when the picture is upright and another when it is turned round for the second player on a cocktail table. Only while the machine is in phase 3 with its inner step between SPRITE_RAISE_STEP_FLOOR 0x0832 (5) and 7 — the round intro, lead-in and live round — does it additionally raise the top bit of eight of those sprites [code]. `drainBothDeferredCellLists` [seen] then blanks the character cells painted by the previous pass, paints the cells pending now, and copies the pending list onto the erase list (DEFERRED_WRITE_CURSOR 0xAE00 [seen], DEFERRED_BLANK_CURSOR 0xAE80 [seen]), so every deferred stamp lives exactly one frame.

Next it closes the interrupt gate (zero to NMI_ENABLE_LATCH 0xC300) and kicks the watchdog, so no second frame interrupt can land while this one is half done; the close comes after the sprite copy, so it is not the copy it protects. It then settles which way round the picture is: SCREEN_UNFLIPPED 0xA987 [seen] is cleared — picture turned round — only while ACTIVE_PLAYER 0xAD32 [seen] is non-zero (the second player is up) and the cabinet-type bit COCKTAIL_MODE 0xA9C2 [code] reads zero, and set otherwise, and the result goes straight to FLIPSCREEN_LATCH 0xC302 [code]. COCKTAIL_MODE reads one with the switch at its default upright setting, so it is the cocktail table that reads zero [code]. Because the sprite copy has already run, the sprites are always published under the *previous* frame's flip decision. The same flag later decides which control panel `readPlayerControls` [seen] reads.

It then latches all five input ports, complemented because the hardware is active-low: the gameplay DIP bank DSW1_PORT 0xC200 into DIP1_MIRROR 0xA9AD [code], the coin/start panel IN0_PORT 0xC300 into IN0_MIRROR 0xA9AE [seen], player one's stick and fire IN1_PORT 0xC320 into IN1_MIRROR 0xA9AF [code], the cocktail panel IN2_PORT 0xC340 into IN2_MIRROR 0xA9B0 [code], and the coinage DIP bank DSW0_PORT 0xC360 into COINAGE_SETTINGS 0xA9B1 [seen]. The mirrors are rewritten unconditionally, so they always show what the panel is asserting this frame — a non-zero mirror proves a contact was closed and nothing more. In IN0_MIRROR, bit 0 is coin 1, bit 1 coin 2, bit 2 the service credit, bit 3 one-player start and bit 4 two-player start [code].

Two counters step: FRAME_TICK 0xA980 [seen], a free-running byte that every "on odd frames" or "every eighth frame" decision in the game reads, and BCD_FRAME_COUNTER 0xA9CE [code], a two-digit packed-decimal counter (incremented then decimal-adjusted, wrapping at 100) that only this service and the demo's round start touch by address. Three cooldowns are wound one step toward zero and stop there: BANK_LAUNCH_COOLDOWN 0xA817 [seen], WAVE_CLAIM_TIMER 0xA812 [seen] and ATTACKER_SPAWN_COOLDOWN 0xA8F4 [seen]; the round engine re-arms and tests them (see the spawning sections), so they tick in real time regardless of which mode is running. The coin inputs are serviced (next section).

Only then does the frame's real work run: the low two bits of SEQUENCE_PHASE 0xA9AB select one of the four words of SEQUENCE_PHASE_ARM_TABLE 0x015F — `dispatchSequencePhase0SubStepArm` [seen], `dispatchSequencePhase1SubStepArm` [seen], `dispatchSequencePhase2SubStepArm` [seen] or `dispatchSequenceSubStepArm` [code] — and that dispatcher runs the step SEQUENCE_SUBSTEP selects. Finally `sendOneQueuedSoundThenUnwindTheFrameInterrupt` [code] sends one byte from the sound queue — so a sound requested anywhere in the service leaves on the same frame — and reopens the interrupt gate from the image byte NMI_REENABLE_BYTE 0x1600 (0x01). Reopening only after the frame's work is done is what guarantees one service per frame.

### Coins, credits and the coin counters

`serviceCoinInputs` [seen] runs five things in fixed order every frame. Each input is debounced the same way: its bit is shifted into the bottom of a history byte, and only a history whose low three bits read `001` — two frames released then one pressed — counts as an insertion, so a coin that stays on the switch counts once.

The service credit comes first. `awardOneCreditOnDebouncedInputEdge` [seen] debounces IN0 bit 2 through SERVICE_CREDIT_DEBOUNCE 0xA983 [code] and on a clean edge requests the coin sound and adds one credit — one flat credit per press, with no accumulator and no price. Coin slot 1, in `tallyCoinSlot1AndAwardCredit` [seen], debounces IN0 bit 0 through COIN_SLOT_1_DEBOUNCE 0xA9C7 [code]; each coin requests the coin sound, adds one to COIN_ACCEPTED 0xA981 [seen] (the coins the mechanical counter still owes a pulse) and adds 0x10 to COIN_SLOT_1_ACCUMULATOR 0xA9C8 [code]. COIN_SLOT_1_RATIO 0xA9C9 [seen] holds the price: coins-required-minus-one in its high nibble and credits-given in its low nibble. When the accumulator passes it, the accumulator is pulled back by the price and — unless FREE_PLAY 0xA9C0 [seen] is set — the low nibble is added in packed decimal to CREDIT_COUNT 0xA986 [code], saturating at 99, and the two-digit credit panel is repainted by `paintCreditCountPanel` [seen]. Coin slot 2, in `meterCoinageTowardCreditOnEdge` [seen], is the same machine on IN0 bit 1 with COIN_SLOT_2_DEBOUNCE 0xA9CA [code], COIN_ACCEPTED_SLOT_2 0xA982 [code], COIN_SLOT_2_ACCUMULATOR 0xA9CB [code] and COIN_SLOT_2_RATIO 0xA9CC [seen], crediting through the shared `awardCoinCreditThenPulseCoinCounter` [seen]. The two slots are wholly independent, price included: each slot's credits follow its own nibble pair alone, and each switch setting yields the coins-and-credits pair the cabinet's own labelling gives it [seen]. The sound is requested through `requestCoinSound` [seen], which queues the code held at COIN_SOUND 0x322E with no permission test, so coins chime even in attract.

Three cells here are easy to conflate. The port mirror shows a closed contact this frame; the coin debt counts pulses owed to the mechanical counter, bumped only after a clean debounce; and the credit count is reached only through the price arithmetic. An accepted coin is therefore not a banked credit on any setting that charges more than one coin per credit [code].

The last two calls drive the mechanical counters. `pulseSlot1CoinCounter` [seen] does nothing while COIN_ACCEPTED is zero; otherwise it runs a 48-frame pulse on COIN_PULSE_TIMER 0xA984 [seen]: it raises COIN_COUNTER_0_LATCH 0xC30A when the timer is idle, drops it when the countdown passes 24, and on the frame the countdown reaches zero takes one coin off the debt, so two coins owed come out as two distinct clicks — five coins make five separate pulses of 48 frames each, and with no coin the line and the timer are never touched [seen]. `pulseSlot2CoinCounter` [seen] is byte for byte the same driver for slot 2, on COIN_PULSE_TIMER_SLOT_2 0xA985 [code] and COIN_COUNTER_1_LATCH 0xC30C. The shared credit tail ends by running the slot-1 driver, so on a frame when slot 2 or the service switch awards a credit the slot-1 pulse advances twice; the service credit adds a credit without adding a coin to either debt, so it never clicks a counter [code].

### The sound queue

Sound requests are bytes appended to a small FIFO: SOUND_QUEUE_COUNT 0xAC43 [seen] holds how many are waiting and the bytes follow from SOUND_QUEUE_HEAD 0xAC44 [seen]. `appendSoundCommandToQueue` [code] steps the count and writes the new code at the cell the new count names, so codes land in arrival order; nothing checks for room. Once per frame, as the last act of the vertical-blank service, `sendOldestQueuedSoundCommand` [seen] takes the head byte, slides the rest down one cell and hands the byte to `sendSoundCommand` [seen], which writes it to SOUND_COMMAND_LATCH 0xC000 and pulses AUDIO_IRQ_LATCH 0xC304 high then low to make the audio processor look. That one routine is the machine's only writer of the sound latch, and every latch write is paired with exactly one high-then-low pulse [seen]. A burst of requests therefore drains at one per frame [code].

Requests enter through three gates. `enqueueSoundUnconditional` [code] always queues (coins, the transition bursts). `enqueueSoundIfGameInProgress` [seen] queues only while PLAY_ACTIVE 0xAD30 [seen] is set and otherwise drops the request without trace. `enqueueSoundIfGameOrAttract` [seen] also accepts the request when the operator's attract-sound switch DEMO_SOUNDS_ENABLE 0xA9C6 [code] is on. Which sound a code is can be read off the named request routine that queues it — `requestPlayerShotSound` [seen], `requestEnemyLaunchSound` [seen], `requestEnemyWaveSound` [seen], `requestMotherShipWarpSound` [code], `requestBonusLifeSound` [seen], `requestParachutistAwardSound` [seen], `requestRoundStartSound` [seen] and `requestCurrentEraSound` [seen], each from the event its name states. `enqueueTransitionSoundBurst` [code] queues seven codes back to back — six read from fixed bytes of the image and a seventh formed as 140 plus ERA_INDEX 0xAD04 [seen], the one that differs from era to era — and is what the round-clear, life-loss and initials-finished moments ring with.

### The sequence machine

The two cells are always written as a pair. `advanceSequencePhase` [seen] steps the phase and zeroes the inner index; `advanceSequenceSubStep` [seen] steps the inner index alone; `seatSequencePhase3AndResetSubStep` [seen] jumps straight to phase 3, step 0. Every entry into a mode is one of these or an explicit store of both cells, and several of those stores take their values from bytes of the program image rather than from literals, which is how many of the anti-tamper checks below are able to steer the machine [code].

Each phase has its own inner table, laid inline directly behind its dispatcher and reached through the shared table-jump at 0x0030 (`rst 0x30`), and each reads the index its own way. Phase 0 masks it to three bits and dispatches through PHASE0_SUBSTEP_DISPATCH_TABLE 0x15C8, where only slots 0 and 6 hold routines; the other six words point at bytes that are not code. Phases 1 and 2 use the index almost raw (the doubling into a word offset wraps, so only its low seven bits matter) through PHASE1_SUBSTEP_DISPATCH_TABLE 0x1659, thirteen real steps, and PHASE2_SUBSTEP_DISPATCH_TABLE 0x1806, five real steps. Phase 3 masks it to four bits and dispatches through PHASE3_SUBSTEP_DISPATCH_TABLE 0x0F29, sixteen steps [code]. After the step returns, phase 1 always runs a shared tail and phase 3 always runs a shared continuation; phase 2's tail, `noOpSequencePhase2Tail` [code], is a bare return at 0x181D, and phase 0 has none.

Because the phase is read through a two-bit mask, a phase that is ever stepped past 3 reads back as phase 0 and indexes the phase-0 table with whatever inner index it carries — the landing that every "step the phase on a failed check" arm in phase 3 heads toward [code].

The four modes, and what separates them, are established on the real machine [seen]:

| phase | mode |
|---|---|
| 0 | power-on wipe — blanks the screen one line per frame, then hands over |
| 1 | attract — pen sweep, copyright screen, ranking table, then the demonstration launch |
| 2 | credit on the board, "PUSH START BUTTON" |
| 3 | the round engine — every real round and every demonstration round |

Phase 3 is necessary for play and not sufficient. The attract demonstration is launched by entering phase 3 with the play flag clear — one life, the real game logic, flown by a script — so it is the play flag PLAY_ACTIVE, not the phase, that separates a game from a demo. Anything that treats phase 3 as a play detector counts the demo as a game, and since the demo is where most attract-mode execution comes from, that error silently corrupts any measurement keyed on it [seen].

### Phase 0 — the power-on wipe

Phase 0 runs straight after power-on. Step 0, `startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase` [seen], arms a 32-line wipe of the whole character plane — BLANK_LINE_CURSOR 0xA989 [seen] at CHAR_PLANE_BASE 0xA400 and BLANK_LINES_LEFT 0xA988 [seen] at 32 — through `armWholePlaneWipeThenDerailOnATamperedImage` [seen], then sets the inner index to 6 by reading it from WIPE_SUBSTEP_SEED 0x1749 (a byte that is the low half of an address inside an instruction) and folds 256 image bytes from SEQUENCE_PHASE_TAMPER_SPAN_BASE 0x5648 into the phase by subtraction with a final exclusive-or of 0x4E; on the genuine image that fold leaves phase 0 at 0 [code].

Step 6, `armAttractScreenShowingHighScore` [seen], blanks one line per frame with `blankNextLine` [seen] — thirty-two cells of blank glyph 0xF1 in colour 0x10 — and waits for the line count to reach zero. On that frame it lays down the permanent header: captions 5, 6 and 7 ("HI-SCORE", "1-UP", "2-UP") and a round-count pictogram of 1, two marker cells HIGH_SCORE_MARKER_CELL_LOWER 0xA701 and HIGH_SCORE_MARKER_CELL_UPPER 0xA6E1 seeded with glyph 0x13, six cells patched from the record list HIGH_SCORE_PATCH_TABLE 0x163F, and the six-digit high score from HIGH_SCORE_HI 0xA98D [code] via `paintHighScoreReadout` [code]. It then sets phase 1, step 2 directly — skipping the attract cycle's own background sweep, since the plane is already clean — and, when FREE_PLAY is set, adds caption 13 ("FREE PLAY") [code].

### Phase 1 — the attract cycle

Phase 1 is the title-and-high-score cycle that runs whenever no credit is on the board, ending in the gameplay demonstration. Its shared tail, `advanceSequenceElseStartFreePlayGame` [seen], runs after every step: if CREDIT_COUNT is non-zero it steps the phase to 2, and otherwise, only on free play with a start button held (IN0 bits 3 or 4), it clears every sprite and starts a game without charging. So a coin dropped at any point of the cycle takes effect on the very next frame [code].

The steps, in order [code]:

Step 0, `erasePenRouteThenAdvanceStep` [seen], sets the tracing pen to the blank glyph 0xF1 in colour 5 — PEN_GLYPH 0xAD0B [seen], PEN_COLOUR 0xAD0C [seen] — and sends it back to the start of its route with `armThePenRouteThenColdStartOnATamperedImage` [seen]: PEN_ROUTE_LEG 0xA9E2 [seen] to zero and the row and column position words PEN_ROW_POS 0xA9E3 [seen] and PEN_COLUMN_POS 0xA9E5 [seen] loaded from image words. If the pen colour already held 5 there is nothing to repaint, and the sweep is skipped by bumping the index twice. Step 1, `advancePenRunAnimationStep` [seen], lets the pen sweep one interpolated run per frame — each run stamps glyph and colour into consecutive cells toward the next corner of PEN_ROUTE_TABLE 0x0290, recolouring the background as it goes — until the route returns to a zero row, then negatively sums 34 bytes of the copyright-hold step's own code into BANK_LAUNCH_COOLDOWN 0xA817, where it comes to zero on a genuine image and is checked in the next step. That cell is the round engine's live launch cooldown, borrowed here as a tamper result — and since the frame service winds it one step toward zero before the next step reads it, a tampered sum of exactly one passes [code].

Step 2, `showCreditLine` [seen], on free play only steps on. Otherwise it repaints the credit panel, draws caption 8 ("CREDIT"), and reads the borrowed cooldown: anything but zero transfers to 0x2E3E, where there is no routine. On zero it stamps the four-sprite copyright strip with `stampCopyrightStrip` [seen], queues the flashing copyright line through `flashCopyrightLine` [seen] — caption 0 on odd frames and its alternate-colour twin, caption 31, on even ones, so the line blinks between colours 0x10 and 0x05 — and sums 20 image bytes from BOOT_CONFIG_CHECKSUM_BASE 0x086B through `sumImageBlockForTheTamperCheck` [seen]; `advanceSequenceUnlessImageTampered` [seen] steps on only when that sum is 0x67.

Step 3, `buildCopyrightScreenThenVerifyImage` [seen], draws the copyright screen: "© KONAMI 1982", "PLAY", "PLEASE DEPOSIT COIN", "AND TRY THIS GAME", the HI-SCORE and 1-UP/2-UP labels and the two title-art runs (captions 20 and 21) [code]. Step 4, `holdCopyrightThenEraseTheCoinInvitation` [seen], holds that screen for as long as SEQUENCE_DELAY counts, re-stamping the strip and flashing the line every frame; the delay arrives at zero from power-on, so the first countdown wraps and the hold lasts 256 frames. On expiry it copies the glyph and colour of the "N" of KONAMI (COPYRIGHT_SAMPLE_GLYPH_CELL 0xA63C, COPYRIGHT_SAMPLE_COLOUR_CELL 0xA23C) into TAMPER_GLYPH_KONAMI 0xACC7 [seen] and erases the two coin-invitation captions.

Step 5, `paintReadoutsThenSampleWitnessOrDerail` [code], checks the copyright line's colours with `checkTheCopyrightLineColoursOrDerail` [code], checks that TAMPER_GLYPH_SOURCE_CELL 0xA67C holds the glyph 0x7C (the "K") — a mismatch enters `stepMotherShipWarpFlashFrame` [seen] part-way through its opening bytes — then draws caption 19 ("SCORE RANKING TABLE") and the five table rows with `paintFiveLabelledNumericReadouts` [code], and copies TAMPER_SAMPLE_GLYPH_CELL 0xA5DC [seen] and TAMPER_SAMPLE_COLOUR_CELL 0xA1DC [seen] into TAMPER_GLYPH_READBACK 0xADFB [seen] and TAMPER_COLOUR_READBACK 0xADFC [seen]. Step 6, `holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail` [code], holds the ranking table for a second SEQUENCE_DELAY countdown, then checks the copyright colours again and verifies the "N" through a pointer built from a byte of code: the first opcode of `runParachutistSlot` [seen] at 0x47B3, which is 0x3A, plus 2 gives the low byte 0x3C, and that plus 0x6A gives the high byte 0xA6, so only an untouched routine points the check at 0xA63C, where the glyph must be 0x3B. On success it copies the glyph and colour of 0xA67C into TAMPER_GLYPH_COPY 0xAB43 [code]. Steps 7 to 11 are pure guards — `guardBlockOrBlankDisplay` [code], `guardBlockOrDerailSequence` [code], `foldImageBlockIntoSignatureThenAdvanceSequence` [seen], `stepSequenceUnderChecksum` [code] and the empty `trampolineToAdvanceSequenceSubStep` [seen] — each one frame long on a genuine image.

Step 12, `verifyImageSignatureThenStartAttractDemoOrDerail` [code], checks the folded signature TAMPER_IMAGE_SIGNATURE 0xAA6F [code] against 0x76 and then starts the demonstration: it clears the caption sprites, seeds the autopilot with `seedDemoAutopilotScript` [seen], clears TWO_PLAYER_GAME 0xAD31 [code], PLAYER_TWO_LIVES 0xAD20 [seen] and — the crucial difference from a real game — PLAY_ACTIVE, gives PLAYER_ONE_LIVES 0xAD10 [seen] one life, and sets phase 3, step 0. The demo is therefore the real round engine running with the play flag clear, flown by a script instead of the stick. The autopilot picks one of three heading scripts (DEMO_AUTOPILOT_SCRIPT_FIRST 0x218C, _SECOND 0x2251, _THIRD 0x22FA) from the era the previous demo left in PLAYER_ONE_ERA_INDEX 0xAD14 [seen] — era 0 or 3 takes the first, era 1 the second, anything else the third — and seats DEMO_SCRIPT_DWELL 0xADF2 [code] (one more than the script's leading byte) and the pointer DEMO_SCRIPT_POINTER_LO/HI 0xADF3/0xADF4 [code]. The script is therefore chosen by where player one's era was left — by the previous demo, or by a real game — not by the era the new demo is about to fly [code].

### Phase 2 — credit on the board, waiting for start

A credit moves the machine to phase 2, step 0, from either the attract tail or the demo's continuation. Step 0, `parkSpritesAndArmLineWipeThenAdvanceSequence` [seen], clears every sprite with `hideAllSprites` [seen] (zeroing the vertical position of all 24 slots from PLAYER_SPRITE_Y 0xAA41), samples LINE_WIPE_SAMPLED_CELL 0xA5FC into LINE_WIPE_SAMPLE_RECORD 0xACBE — a sample nothing ever reads back — and arms a line wipe from the fifth line, BLANK_LINE_START_CELL 0xA404, for BLANK_LINES_COUNT 0x0CCD (27) lines with `armLineWipeFromFifthLine` [seen]. Step 1, `blankOneLineThenGuardBlockOrDerailSequence` [seen], clears one line per frame and, on the frame the last line goes, checks a 1 KB image block.

Step 2, `postAttractInfoCaptions` [seen], draws the start screen: "PLAY", the two title-art runs, the bonus-life pair chosen by BONUS_LIFE_SETTING 0xA9C3 [code] — captions 15 and 16 ("1ST BONUS 10000 PTS", "AND EVERY 50000 PTS") when it is clear, 17 and 18 (the 20000/60000 pair) when set — "PUSH START BUTTON" and the copyright line. With two or more credits it adds caption 25 ("ONE OR TWO PLAYERS") and jumps to step 4; with one it adds caption 23 ("ONE PLAYER ONLY") and goes to step 3 [code].

Step 3, `stepCopyrightScreenAwaitingStart` [seen], re-stamps the strip and flashes the copyright line each frame, samples COPYRIGHT_GLYPH_SAMPLE_CELL 0xA61C into TAMPER_GLYPH_STRIP 0xABFE [seen], and starts a one-player game if one-player start is held. While the count stays at exactly one it simply waits; if a second credit arrives it draws "ONE OR TWO PLAYERS" and steps to 4. Step 4, `stepTwoCreditCopyrightScreenAwaitingStart` [seen], tests two-player start first and then one-player start. There is no timeout: with credit on the board the cabinet stays on this screen indefinitely [code].

### Starting a game

The credited start is two routines, not one routine with a player count in it, and IN0 bits 3 and 4 choose between them; on the real machine each button runs its own routine and never the other's [seen]. `startOnePlayerGame` [seen] clears the caption sprites, clears TWO_PLAYER_GAME and PLAYER_TWO_LIVES, raises PLAY_ACTIVE to 0xFF, loads PLAYER_ONE_LIVES from STARTING_LIVES 0xA9C1 [code], takes one credit off CREDIT_COUNT with a packed-decimal subtract, repaints the credit panel, keeps three screen cells aside with `copyThreeTilemapCellsFromBothPlanes` [seen], and jumps to phase 3, step 0. `startTwoPlayerGame` [seen] does the same with both players stocked from the same setting, TWO_PLAYER_GAME raised, and two credits taken, and runs a one-shot check, `setUpTwoPlayerStartObjectOnce` [seen], that acts only if TAMPER_GLYPH_COPY no longer matches the cell it was copied from — in which case it plants stray values in an object slot, rings the Mother-Ship warp sound if the ship is alive, and posts a score award [code].

Free play is a different start, not a zero price. `startGameOnFreePlay` [seen] has no credit arithmetic in it at all; it is reached only from callers that have first found no credit on the board and FREE_PLAY set — the attract tail, the demo continuation and the initials screen — and it reads both start buttons, testing two-player first, so with both held a two-player game starts. It stocks player one, and player two for a two-player start, from STARTING_LIVES, clearing the other block otherwise [code]. On a cabinet set to charge, this routine never runs; with the coinage set to free play, each start button takes its own arm of it [seen]. So a survey of what code runs, taken on the default switch settings, cannot see the free-play half of the machine at all.

### Phase 3 — the round engine and its sixteen steps

Phase 3 hosts every real round and every demo round. After each step, `advanceAttractTowardGameStart` [code] runs as a continuation: while PLAY_ACTIVE is set it does nothing; in the demo, a credit on the board sets the phase from SEQUENCE_PHASE_ON_CREDIT 0x1736 (2) with the inner index zeroed — the demo is abandoned mid-flight for the start screen — and on free play a held start button starts a game directly [code].

The sixteen steps of PHASE3_SUBSTEP_DISPATCH_TABLE 0x0F29 fall into a straight run that plays the round and several side entries that the life, round and game-over logic jump into [code]:

| step | routine | role in the flow |
|---|---|---|
| 0 | `armRoundStartThenStepSequence` [seen] | new game / new demo: reset both players |
| 1 | `seatCaptionPenFromEraFoldingTamperIntoPhase` [seen] | era pen; re-entry point after a life or a hand-over |
| 2 | `blankCaptionThenAdvancePenRunStep` [seen] | background sweep in the era colour |
| 3 | `loadActivePlayerContextAndPostRoundHud` [seen] | load the player's saved context, draw the HUD |
| 4 | `postRoundStartCaptionsAndResetPlayfield` [code] | captions, kill meter, reset the playfield |
| 5 | `flyRoundIntroFlashingEraYearThenEraseIntroCaptions` [code] | round intro |
| 6 | `flyEnemyFreeLeadInThenStepSequence` [code] | lead-in |
| 7 | `serviceRoundThenResolvePlayerState` [seen] | the live round |
| 8 | `fileScoreAfterGameOverHoldElsePassTurn` [code] | game-over hold, then file the score |
| 9 | `erasePenRouteThenOpenInitialsEntry` [code] | open the initials screen |
| 10 | `stepHighScoreInitialsEntry` [code] | initials entry |
| 11 | `loc_12e2` [seen] | post-entry hold, then pass the turn |
| 12 | `restartAttractSequence` [seen] | back to attract |
| 13 | `paintSelfTestScreenPhaseThenStepSequence` [code] | round-clear transition set-up |
| 14 | `stepRoundStartIntroAnimation` [code] | round-clear transition animation |
| 15 | `loc_15b5` [code] | empty |

The inner index is therefore a per-life cycle rather than a progression: each lost life sends it back to step 1, not to 0 [seen].

**Round start (steps 0–4).** Step 0 requests the round-start sound, parks the enemy aim anchor ENEMY_AIM_ANCHOR_Y 0xAC64 [seen] and the first aim point ENEMY_AIM_POINT_TABLE 0xAC65 [seen] on the ship's centre (0x78, 0x84), zeroes the upper two bytes of both players' life-tick counters, fills PLAYER_ONE_KILLS_REMAINING 0xAD12 [seen] and PLAYER_TWO_KILLS_REMAINING 0xAD22 [seen] from KILL_QUOTA 0xA9CD [seen], zeroes both players' era, bonus latch and Mother-Ship flag, sets both round numbers and both ROUND_ARMED copies to 1, zeroes ACTIVE_PLAYER and PEN_COLOUR, and then splits on PLAY_ACTIVE. In a real game it zeroes both three-byte scores (PLAYER1_SCORE_LO 0xAD33 and PLAYER2_SCORE_LO 0xAD36 onward [code]), posts a score-award command of 0 (which repaints the score labels and, in a one-player game, blanks the absent second score), loads the difficulty record the operator chose, copies START_RUNG_ROUNDS_1_5 0xA9D3 [seen] into both players' START_RUNG (0xAD1A, 0xAD2A [seen]), and sets SEQUENCE_DELAY to 150. In the demo it instead advances ATTRACT_STAGE_COUNTER 0xA9D0 [code] round 1→2→3→1 and makes that the demo's era (so demos cycle 1940, 1970, 1982) with round number one higher, zeroes FRAME_TICK, BCD_FRAME_COUNTER and SCRIPT_CYCLE_COUNTER 0xA9CF [code], reseeds the random generator, zeroes the shot array PLAYER_SHOT_ARRAY 0xAA80–0xAADF [seen] and the object block PLAYER_STATE 0xA800–0xA97F, loads difficulty record 2, fills the stand-off aim block from ENEMY_STANDOFF_AIM_SET_Y 0xAC74 to ENEMY_STANDOFF_AIM_BLOCK_END 0xAC83 [code] with 0x80, and sets SEQUENCE_DELAY to 90. Those two block clears are demo set-up, not a round init: they run once at each demonstration start and not at all when a credited game begins [seen]. Because the generator is reseeded and the frame counter zeroed at the start of every demo round, a demo round flown on the same script in the same era plays out the same way every time [code].

Step 1 chooses the pen for the active player's era from a five-entry table at 0x0F8D — always the blank glyph 0xF1, in colour 1 to 5 by era — storing it both in the live pen and in that player's saved copy (PLAYER_ONE_PEN_GLYPH 0xAD1B [seen] / PLAYER_TWO_PEN_GLYPH 0xAD2B [code]). If the pen colour already matched, the era has not changed and step 2 is skipped. The pen is re-armed at its route start. Step 2 blanks a fourteen-cell run and sweeps the pen one run per frame until the route closes, recolouring the playfield background in the era's colour — the era's sky [guess]. Step 3, `loadActivePlayerContextAndPostRoundHud` [seen], blanks the same run and copies the active player's sixteen saved bytes (PLAYER_ONE_LIVES 0xAD10 or PLAYER_TWO_LIVES 0xAD20 onward) over the live context that starts at LIVES_REMAINING 0xAD00 [seen]: lives, ROUND_NUMBER 0xAD01 [code], KILLS_REMAINING 0xAD02 [code], BONUS_LIFE_LATCH 0xAD03 [seen], ERA_INDEX 0xAD04, LIFE_TICKS_LOW/MID/HIGH 0xAD05–0xAD07, START_RUNG 0xAD0A [seen], the pen pair, MOTHER_SHIP_ARMED 0xAD0D [seen] and ROUND_ARMED 0xAD0E [seen]. In a real game it then draws the round-count pictograms from ROUND_NUMBER and the reserve-ship emblems for lives-minus-one; in the demo no HUD is drawn.

Step 4, `postRoundStartCaptionsAndResetPlayfield` [code], draws "PLAYER 1" or "PLAYER 2" in the pen colour, followed either by "STAGE" and the two-digit ROUND_NUMBER (`drawRoundNumberCaption` [seen], display command 7, which draws nothing once the round reaches 100) when ROUND_ARMED is set (the first life of a new round) or by "READY" when it is clear (a restart after losing a life); the demo shows "READY" alone. It redraws the kill meter with `drawKillMeter` [seen] and resets the playfield with `resetPlayfieldAndArmNewRound` [seen]: scroll to zero, the ship at the centre facing 0x80 with PLAYER_STATE set to 0xFF (alive), every object and shot slot retired, ERA_RUNG 0xACC0 [seen] reset to START_RUNG and ERA_RUNG_TIMER 0xA9D7 [seen] to ERA_RUNG_PERIOD 0xA9D6 [seen], the era's scenery seated, and the spawn-cadence cells loaded from the row the era and rung select.

**Round intro (step 5).** `flyRoundIntroFlashingEraYearThenEraseIntroCaptions` [code] flies the ship and the scenery — the player frame, the scenery for the era, and the sprite multiplexing passes — with no enemies. On odd frames it counts SEQUENCE_DELAY down; while ROUND_ARMED holds, the low nibble of FRAME_TICK picks one of three commands at nibbles 0, 5 and 10 that redraw the era's "A.D." year caption (caption 26 plus the era: 1910, 1940, 1970, 1982, 2001) in three different colours, so the year flashes. When the delay expires it erases the player line, "STAGE" and the year line, clears ROUND_ARMED, sets SEQUENCE_DELAY to 42 and steps on. The intro therefore lasts twice the arriving delay: 300 frames at the start of a game, 180 in a demo, and 180 after a lost life or hand-over [code].

**Lead-in (step 6).** `flyEnemyFreeLeadInThenStepSequence` [code] runs the same flight and scenery services plus `fireAndSweepPlayerShots` [seen], so the player can already fly and shoot, but still no enemy services; after 42 frames it steps into the live round.

**The live round (step 7).** `serviceRoundThenResolvePlayerState` [seen] is the round engine's service list, run once per frame of this step in this fixed order: enemy re-aim and animation (`reaimAndAnimateEnemyCraftOnPhaseTick` [seen]), the player's own frame (`dispatchPlayerFrameByState` [seen]), the player's shots, the enemy-wave driver (`driveEnemyWaveForLifePhase` [seen]), the parachutist (`runParachutistSlot` [seen]), the Mother-Ship gate (`armMotherShipOrStep` [seen]), the seven craft slots (`stepSevenCraftSlots` [seen]), the scenery, the era-2-and-later object bank (`sweepEra2PlusObjectBank` [seen]), the 1940 bomber (`serviceEra1BomberObject` [seen]) and fixed slot (`serviceFixedSlotInEra1` [seen]), four actor slots (`stepFourActorSlots` [seen]), the 1910 ballistic bank (`serviceEra0BallisticObjectBank` [seen]), the collision pass (`dispatchCollisionPassByEra` [seen]), a sound request made only while its group is clear (`askForSoundWhileTheGroupIsClear` [seen]), the bonus-life check, the hit-chain expiry (`expireHitChain` [seen]), the difficulty escalation, and the kill meter — with sprite-multiplex passes interleaved and a full multiplex pass last. Those subsystems are the subject of the later sections. The list closes by reading PLAYER_STATE 0xA800 [seen]: 0xFF (alive) goes to `advanceRoundWhenFieldCleared` [code], 0 (dead) goes to `loseLifeAndHandOver` [seen], and any other value — the ship still dying — just returns [code].

This is not a once-per-frame list for the machine as a whole. Every member runs exactly as often as every other, all of it inside phase 3, and fewer times than the frames phase 3 occupies [seen]; the frames it misses are the intro, lead-in, transition and game-over steps around the live round [code]. Anything the list counts — the base-sixty life ticks in particular — therefore measures live-round frames, not time [code].

**Round clear.** `advanceRoundWhenFieldCleared` [code] acts only when KILLS_REMAINING is zero, ROUND_TRANSITION_HOLD 0xACC6 [code] is set, and all fifteen sixteen-byte object records from ACTOR_RECORD_SLOT0 0xA810 [seen] read empty; so after the Mother-Ship falls, the round waits for the sky to empty. It then rings the transition burst. In the demo that ends the demonstration: ROUND_TRANSITION_HOLD is reloaded from ROUND_TRANSITION_HOLD_SEED 0x07D1 (which holds zero), sprites are cleared, and the machine goes back to phase ATTRACT_SEQUENCE_START_PHASE 0x16D3 (1), step 0. In a game it clears 23 sprites, runs `startNextRound` [seen] — ROUND_NUMBER up by one, ERA_INDEX on by one and wrapping to 0 after the fifth era, START_RUNG reloaded from START_RUNG_ROUNDS_1_5 for rounds below 6, START_RUNG_ROUNDS_6_10 0xA9D4 [code] below 11 and START_RUNG_ROUNDS_11_UP 0xA9D5 [code] after that, KILLS_REMAINING refilled from KILL_QUOTA, MOTHER_SHIP_ARMED and ROUND_TRANSITION_HOLD cleared, ROUND_ARMED raised — saves the context into the active player's slot, and jumps to step NEXT_ROUND_START_SUBSTEP 0x4A35 (13) [code]. The quota is the same cell every round, so the kill count to call the Mother-Ship does not grow as the eras loop [code].

**Round-clear transition (steps 13 and 14).** Step 13 stocks a small animation control block starting at INTRO_ANIMATION_STEP 0xA9F0 [code], paints fixed runs across the top of the character plane and colours several column stubs from a base of PEN_COLOUR, and sets the saved pen from the new era with `setSavedPenFromEra` [seen]. Step 14 runs on two frames of every four and switches on INTRO_ANIMATION_STEP: the early stages flash the ship white (`flashPlayerWhiteEveryOtherFrame` [seen]) while two scripted character-plane bands advance, then cycle the ship's colour, and stage 4 floods the colour plane with the saved player colour; past that it sets SEQUENCE_DELAY to 90, clears every sprite, reloads the context and HUD, and reseats the inner index from INTRO_SUBSTEP_RELOAD 0x2750 (3), so the new era begins through the normal round-start run from the context load onward [code]. This is the passage between eras — the time warp of the outside descriptions [guess].

**Losing a life, and handing over (back to step 1).** `loseLifeAndHandOver` [seen] clears every sprite and, if ROUND_TRANSITION_HOLD is already set — the Mother-Ship was destroyed before the ship died — runs `startNextRound` first, so the era still advances. It rings the transition burst, takes one from LIVES_REMAINING and saves the whole context to the active player's slot. At zero lives it goes to the game-over banner. Otherwise, if the other player's saved lives are non-zero, it flips ACTIVE_PLAYER; either way it sets SEQUENCE_DELAY to 90 and the inner index from HANDOVER_SUBSTEP_SEED 0x4B52 (1), re-entering the round start at the era pen [code]. Every per-player cell is reached through ACTIVE_PLAYER, so flipping it is the whole hand-over; `handPlayOverToOtherPlayer` [seen] is the same flip with the same delay and seed, used after game over.

**Game over (steps 8, 11, 12).** `postGameOverBanner` [seen] draws "PLAYER n" and "GAME OVER", sets SEQUENCE_DELAY to 180 and steps from 7 to 8; if PLAY_ACTIVE is clear — the demo ship has lost its single life — it runs `restartAttractSequence` [seen] instead, ending the demo. Step 8, `fileScoreAfterGameOverHoldElsePassTurn` [code], holds the banner for those 180 frames and then offers the finished score to the high-score table. If it does not qualify, both captions are erased, the inner index is set from SKIP_INITIALS_SUBSTEP_SEED 0x0843 (11), and `passTurnToOtherPlayerIfLivesElseStepSequence` [seen] at once either hands over to the other player (if they still have lives) or steps to 12. If it qualifies, the sound whose code sits at 0x18FA is requested (game-only), the pen is set to blank glyph in colour 0 and re-armed, and the machine steps to 9. Step 11, `loc_12e2` [seen], is reached only when initials entry finishes: it waits out the 60-frame SEQUENCE_DELAY that entry leaves and then makes the same pass-or-step decision. Step 12, `restartAttractSequence` [seen], clears PLAY_ACTIVE, the inner index and ACTIVE_PLAYER and sets the phase from ATTRACT_SEQUENCE_START_PHASE 0x16D3 (1): the cabinet returns to the full attract cycle, pen sweep included.

### Scoring, bonus lives and the high score

Each player's score is three packed-decimal bytes, low first: PLAYER1_SCORE_LO/MID/HI 0xAD33–0xAD35 and PLAYER2_SCORE_LO/MID/HI 0xAD36–0xAD38 [code]. Awards add in at the low end and carry upward; the readout and every comparison read from the high end. Points arrive as display command 4, handled in the foreground by `awardScoreToPlayer` [seen]: it does nothing unless PLAY_ACTIVE is set (the demo scores nothing), adds the three-byte award its argument selects from SCORE_AWARD_TABLE 0x0D27 to the active player's score in decimal, and — comparing from the most significant byte down — copies the score into the displayed high score, 0xA98B–0xA98D with HIGH_SCORE_HI 0xA98D [code] its top byte, as soon as it pulls ahead, then repaints what changed. An argument of zero only redraws the score labels (both "1-UP" and "2-UP" in a two-player game; in a one-player game the solo label, with the second score blanked).

`awardBonusLifeAtScoreMark` [seen] runs in the service list. With play active it compares the active player's top score byte — the hundred-thousands and ten-thousands digits — against one of two mark lists chosen by BONUS_LIFE_SETTING bit 0: BONUS_LIFE_MARK_TABLE_BIT0_CLEAR 0x4E1B lists 01, 06, 11 … 96 (10,000 then every 50,000 up to 960,000) and BONUS_LIFE_MARK_TABLE_BIT0_SET 0x4E30 lists 02, 08, 14 … 98 (20,000 then every 60,000) [code]. The match is exact on that byte, so a score that jumps a mark in one award never earns it, and bit 0 of BONUS_LIFE_LATCH 0xAD03 makes it one-shot: a match while the latch is set does nothing, and the first non-matching frame clears it. A fresh match adds a life, redraws the reserve-ship emblems and requests the bonus-life sound through `requestBonusLifeSound` [seen].

### The high-score table and initials entry

The table lives in work RAM at HIGH_SCORE_TABLE_BASE 0xAB08 [code]: five eight-byte records (the first at the table base, then HIGH_SCORE_REC1_BASE 0xAB10 through HIGH_SCORE_REC4_BASE 0xAB28, ending at HIGH_SCORE_TABLE_END 0xAB2F), each a rank byte, three packed-decimal score bytes low first, three name glyphs and a blank eighth byte. `loadDefaultHighScores` [seen] copies the forty-byte DEFAULT_HIGH_SCORE_TABLE 0x4BB1 in at power-on — 10,000, 8,800, 8,460, 6,520 and 4,300 — and HIGH_SCORE_HI is seeded from DEFAULT_HIGH_SCORE_HI 0x08C9 to match the top entry [code]. The ranking screen draws each record as one column (`paintLabelledNumericReadoutColumn` [seen]) — a three-tile rank pictogram, the six-digit score and the three initials — pairing each record with its own screen cursor HIGH_SCORE_REC0_CURSOR 0xA711 through HIGH_SCORE_REC4_CURSOR 0xA719 and its own colour [code].

`fileScoreIntoHighScoreTable` [seen] is an insertion sort keyed on the score. It takes the active player's score (PLAYER1_SCORE_HI 0xAD35 or PLAYER2_SCORE_HI 0xAD38, by ACTIVE_PLAYER), walks the records from the top with `isScoreBelow` [seen] — a three-byte compare from the most significant byte down in which all three equal counts as *not* below — and stops at the first record it is not below, so a score that ties a standing entry files above it. A score that beats none leaves the table untouched and reports that it was dropped. Otherwise the records beneath slide down one place (a descending byte copy from HIGH_SCORE_SLIDE_SRC 0xAB27; none move when the slot is the last), the freed record receives the score with its three name cells set to the blank glyph 0xF1, the rank column is renumbered 0–4, SCRATCH_PTR_A 0xA991 [seen] is left on the first name cell, and SCRATCH_PTR_B 0xA993 [seen] on the screen cell where that row's initials appear, found from HIGH_SCORE_INITIALS_CELL_BASE 0xA531 plus twice the rank.

Step 9, `erasePenRouteThenOpenInitialsEntry` [code], sweeps the blank pen across the background, and when the route closes draws "SCORE RANKING TABLE", the copyright line, the title art and "INPUT YOUR INITIALS", repaints all five rows, clears the four press histories and the letter index — INITIALS_BACK_PRESS_HISTORY 0xA995 [code], INITIALS_FORWARD_PRESS_HISTORY 0xA996 [code], INITIALS_COMMIT_PRESS_HISTORY 0xA997 [code], INITIALS_ALT_COMMIT_PRESS_HISTORY 0xA998 [code], INITIALS_LETTER_INDEX 0xA999 [code] — sets INITIALS_SLOTS_LEFT 0xA99A [code] to 3, stamps the first letter at the cursor from INITIALS_LETTER_GLYPH_TABLE 0x12C7 [code], and keeps that cell's colour in INITIALS_LOCKED_LETTER_COLOUR 0xA990 [code].

Step 10, `stepHighScoreInitialsEntry` [code], alternates frames. On odd frames it advances INITIALS_CURSOR_FLASH_TIMER 0xA99C [code] and colours the cursor cell 0x14 or 0x10 by its bit 4, so the cursor blinks. On even frames it reads the facing panel through `readPlayerControls` [seen] (player two's panel when the picture is turned round) and shifts four bits into the four histories: bit 0 steps the letter back, bit 1 forward, and bits 4 and 5 both commit. A commit (either history reading `001`) writes the shown letter into the table through SCRATCH_PTR_A and onto the screen through SCRATCH_PTR_B in the locked colour, moves both pointers on, and — unless that was the third — resets the letter to index 0 and shows it at the new cursor. Forward and back walk a 27-entry ring of letters, wrapping at both ends; a history that has filled with presses (0xFF forward, 0x7F back) is emptied by `rearmHeldControlRepeat` [seen] so that a held stick repeats after a pause. Every eighth frame the entry clock — SEQUENCE_DELAY again, arriving at zero from the game-over hold, so it runs 256 ticks — counts down, and running out blanks the cursor cell and ends entry with whatever was committed. Finishing, either way, sets SEQUENCE_DELAY to 60, rings the transition burst and steps to 11. Throughout, once neither player has lives left, a start button with credit on the board (one-player only with a single credit; either with two or more) or on free play starts the next game at once, abandoning the entry [code].

### The gameplay-config bank

The operator settings are decoded once at power-on into a block of cells around 0xA9C0. `seedGameConfigFromDipSwitches` [seen] copies HIGH_SCORE_HI from DEFAULT_HIGH_SCORE_HI 0x08C9 and KILL_QUOTA 0xA9CD [seen] from DEFAULT_KILL_QUOTA 0x0874 (0x38, i.e. 56), stores the complemented coinage bank in COINAGE_SETTINGS and unpacks it with `unpackCoinage` [seen]: each nibble indexes the sixteen-entry COINAGE_VALUE_TABLE 0x4B95 into COIN_SLOT_1_RATIO or COIN_SLOT_2_RATIO, and a nibble of 15 in either half raises FREE_PLAY to 0xFF [seen]. The gameplay bank is complemented and peeled a field at a time: bits 0–1 plus three give STARTING_LIVES 0xA9C1 [code] as 3, 4 or 5, with the fourth setting folding to 0xFF (255 lives); bit 2 is COCKTAIL_MODE 0xA9C2 [code] and bit 3 BONUS_LIFE_SETTING 0xA9C3 [code] (`unpackTheFirstThreeSwitchSettings` [seen]); bits 4–6 are DIFFICULTY_SETTING 0xA9C4 [seen], eight steps, and bit 7 is DEMO_SOUNDS_ENABLE 0xA9C6 [code] (`finishBootSelfTestAndColdStart` [seen]), which also initialises the flip line from FLIPSCREEN_INIT_BYTE 0x0C3E and tiles the character plane. STARTING_LIVES is what every game start copies into the players' lives; BONUS_LIFE_SETTING chooses both the bonus-life mark list and the start screen's bonus captions; DEMO_SOUNDS_ENABLE is the second key to the game-or-attract sound gate.

Difficulty acts through two layers. At the start of a game `loadDifficultyRecord` [seen] copies the four-byte record DIFFICULTY_SETTING selects from DIFFICULTY_RECORD_TABLE 0x186A into START_RUNG_ROUNDS_1_5 0xA9D3 [seen], START_RUNG_ROUNDS_6_10 0xA9D4 [code], START_RUNG_ROUNDS_11_UP 0xA9D5 [code] and ERA_RUNG_PERIOD 0xA9D6 [seen]. The eight records run from (0, 2, 6, period 13) at the easiest setting to (15, 15, 15, period 5) at the hardest, so a harder setting both starts each round on a higher rung and climbs more often; the demo always uses record 2, (0, 4, 8, period 11) [code]. Within a round, `escalateDifficultyRungOnCounterWrap` [seen] counts the service list's passes in LIFE_TICKS_LOW 0xAD05 [seen] as a base-sixty packed-decimal digit that carries into LIFE_TICKS_MID 0xAD06 [seen] and LIFE_TICKS_HIGH 0xAD07 [code]; each time the low place rolls over (every sixty passes) ERA_RUNG_TIMER 0xA9D7 [seen] counts down, and when it fires it is reloaded from ERA_RUNG_PERIOD, ERA_RUNG 0xACC0 [seen] climbs one step toward its ceiling of 15, and `applyEraRungSettings` [seen] scatters the ten-byte row that (era × 16 + rung) selects through ERA_RUNG_SETTINGS_POINTER_TABLE 0x1B04 over the spawn-cadence cells. Every life restarts the climb at START_RUNG, because the playfield reset reseats both the rung and its timer [code].

### The random generator

RANDOM_REGISTER 0xAB30 [seen] is a seventeen-byte shift register. `drawRandomByte` [seen] shifts every byte one place along, puts the exclusive-or of the bytes now at offsets 7 and 16 into the head, and returns that feedback plus FRAME_TICK; the head cell is written only by that feedback store and by the seed copy, and the shift writes only the sixteen cells behind it [seen]. `seedRandomRegister` [seen] lays a fixed seed of constants, the seventeen bytes at RANDOM_REGISTER_SEED_SOURCE 0x4B84 (`ff 05 f6 80 32 17 9c c9 dd 21 74 98 fd bf 24 ae 46`), once at power-on and again at the start of every demonstration round [seen]. Because the draw adds the free-running frame counter, the sequence a real game sees depends on when each draw happens; in the demo, where the register is reseeded and FRAME_TICK zeroed at each round start and the ship flies a fixed script, it repeats exactly [code].

### ROM self-checks, and what a bad copy does

The program checks its own image throughout the attract cycle, the round start and the game-over path, and almost none of those checks fail cleanly. A routine sums or exclusive-ors a block of the image, applies a trailing constant, and compares; on the genuine image every one of them passes by construction, and on an altered one the failure is built to look like a crash or a misbehaving machine rather than a refusal [code]. The image reads itself so often that a read of a program address is no evidence that code there ran — only an instruction fetch is. And the checks leave traps for a reader too: several cells carry writers that have nothing to do with what the cell is for (the attract pen step parks its tamper sum in the round engine's launch cooldown), so a cell's name has to be judged against every writer it has, the power-on wipe included. Several call sites exist only behind a failed check, and several of their targets are not routines at all but caption records and tables that merely disassemble as code. Grouped by consequence:

*A boot check that carries on.* `clearWorkRamAndSpriteBanksThenColdInit` sums 256 bytes from 0x00D8 (the frame service itself) against 0x87; a mismatch runs one whole frame service out of band and then continues the boot [code].

*Checks that crash into data or into the middle of other code.* The whole-image sum in `clearScreenRamAndVerifyImageThenColdInit` (0x0000–0x5FFF against 0xAF), the 240-byte sum in `armWholePlaneWipeThenDerailOnATamperedImage`, the sums and folds in `erasePenRouteThenAdvanceStep`, `buildCopyrightScreenThenVerifyImage` and `showCreditLine` (its cooldown guard), the signature test in `verifyImageSignatureThenStartAttractDemoOrDerail`, the copyright-colour walk in `checkTheCopyrightLineColoursOrDerail` (thirteen cells up the copyright line, each of which must hold colour 0x10 or 0x05 — the two colours the flashing line alternates between), the KONAMI glyph checks at 0xA67C and at the pointer derived from `runParachutistSlot`'s first opcode, the readback test in `seedDemoAutopilotScript` (TAMPER_GLYPH_READBACK must be 0xFD and TAMPER_COLOUR_READBACK 0x10 or 0x05; a failure runs the second autopilot script's bytes as code), the exclusive-or over IMAGE_GUARD_BLOCK_0711_BASE 0x0711 that `drawEmblemStripThenGuardImage` [seen] makes each time the reserve ships are drawn (a failure lands in the default high-score table), and the sum of sixteen bytes of the copyright-hold step's code onto 0x8C that `drawRoundNumberCaption` makes after drawing the stage number, all transfer on failure into bytes that are caption records, lookup tables or the middle of other routines — `loc_0167` [code] is caption record 9, `loc_08fa` [code] a stretch of table, and the trap at `loc_0f8d` [code] is the era pen table — so control is destroyed rather than reported [code]. The same trap at `loc_0f8d` is where `advanceSequenceUnlessImageTampered`'s failure goes, discarding four return addresses as it unwinds. `seedRandomRegister` adds three image bytes from RANDOM_SEED_GUARD_WORD0 0x086D and RANDOM_SEED_GUARD_WORD1 0x0870 to 0x44 at power-on and every demo round start, and on anything but zero sends control nowhere that exists. `finishBootSelfTestAndColdStart` sums 256 bytes from BOOT_SELFTEST_CHECKSUM_BASE 0x27DE against 0xC5 and on a mismatch abandons the startup for the frame service; `erasePenRouteThenOpenInitialsEntry` folds INITIALS_ENTRY_CHECKSUM_BASE 0x4880 and on a mismatch likewise enters the frame service from outside any interrupt [code]. `armThePenRouteThenColdStartOnATamperedImage` (256 bytes from 0x0E33 against 0xFD) instead restarts the machine from the work-RAM clear, so on an altered image the machine reboots whenever the pen is re-armed — in the attract cycle, at the era pen of every round start, and after a qualifying game over.

*Checks that go dark.* `guardBlockOrBlankDisplay` sums 51 bytes of `stampCopyrightStrip` from a seed byte COPYRIGHT_STRIP_CHECK_SEED 0x4A40 against 239; failure switches the picture off with the image byte DISPLAY_OFF_VALUE 0x4C89, copies TAMPER_WITNESS_SAMPLE_CELL 0xA65C into TAMPER_WITNESS 0xAD39 [code], and does not step the index — so the attract cycle stalls on a black screen, repeating the check every frame. At round start, the real-game arm of step 0 writes VIDEO_ENABLE_LATCH from an exclusive-or over DISPLAY_LATCH_CHECKSUM_BASE 0x1550 plus one, and step 3 from an exclusive-or over TAMPER_CHECKSUM_SPAN_BASE 0x5B50 minus one; the latch reads only the low bit, which the genuine spans leave set, so an altered span can blank the display at the moment a game begins [code].

*Checks that derail the sequence.* The largest group folds image bytes into SEQUENCE_PHASE itself, or steps it, so a bad copy wanders into the wrong mode. Phase folds that net to no change on the genuine image sit in phase 0 step 0 (0x5648, key 0x4E), the demo arm of step 0 (SEQUENCE_PHASE_CHECKSUM_BASE 0x3310, key 0x90), step 1 (30 bytes from 0x178C plus 0x2C), step 2 (20 bytes from 0x1734 plus 0x77), step 5 (`loc_4d9f`, key 0xA2) and step 6 (`loc_0831` key 0xC2 on entry, `loc_12a7` key 0x59 on exit) [code]. Explicit "step the phase if the check fails" arms sit in `guardBlockOrDerailSequence` (768 bytes from 0x0008), `stepSequenceUnderChecksum` (256 bytes from SEQUENCE_CHECKSUM_SPAN_BASE 0x0BCC against the byte at EXPECTED_CHECKSUM_TOTAL 0x1A50), `blankOneLineThenGuardBlockOrDerailSequence` (1 KB from IMAGE_GUARD_BLOCK_4980_BASE 0x4980), step 2 (IMAGE_GUARD_BLOCK_0BDD_BASE 0x0BDD), step 4 (ROUND_START_CHECKSUM_BASE 0x4C99) and step 8's filed arm (HIGH_SCORE_FILED_CHECKSUM_BASE 0x01F1) [code]. In phase 1 a stepped phase lands on the start screen with no credit on the board; in phase 2 it starts a demonstration round; in phase 3 each of those arms steps the inner index after the phase, so the machine reads back as phase 0 at slot 1 and dispatches into the phase-0 table's non-routine words. `restartAttractSequence` writes the inner index twice, the second time from a fold of ATTRACT_RESTART_FOLD_BYTE 0x4901 and the word at PLAYER_ANIM_COL_COUNT 0x4902 that comes to zero only on the genuine image, so on an altered one the attract cycle restarts at some other step. `foldImageBlockIntoSignatureThenAdvanceSequence` raises a flag cell at 0xAA3F that nothing reads and folds the 30 bytes of `seatCaptionPenFromEraFoldingTamperIntoPhase` onto the seed byte TAMPER_SIGNATURE_SEED_BYTE 0x27C0 into TAMPER_IMAGE_SIGNATURE, which step 12 tests three frames later [code].

The sampled witnesses work the same way at a distance. TAMPER_GLYPH_KONAMI is read back by the era scenery seat, TAMPER_GLYPH_STRIP and TAMPER_COLOUR_STRIP 0xABFF by the round-start ship strip (which expects 0xA5 and 0x05 or 0x10), TAMPER_WITNESS by the scenery seed, TAMPER_GLYPH_COPY by the two-player start and the readback pair by the demonstration start, so an altered image or an altered copyright line is noticed some distance from where it was sampled [code].

## §3 The world moves, not the ship

Time Pilot's ship never travels. Its sprite is seated once, at the start of every life, near the middle of the playfield. The rest of the game is arranged so that the *world* slides past it. Each frame the machine works out how fast and in which direction the ship would be flying, negates that vector, and stores it as a pair of per-frame scroll words. Every other object then folds those words into its own motion: enemy craft, shots, bombs, the Mother-Ship, parachutists and the drifting scenery. The ship's "flight" is the sum of all those small slides. `gameplay.md` quotes the public record's version of this — *"the background moves in the opposite direction to the player's plane, rather than the other way around"* — and the code does exactly that. There is no separate camera and no hardware scroll register: the camera is a subtraction, and the two cells that hold it are the most load-bearing pair in the game. This section follows that vector from the stick to the glass. It then covers the three clocks that set how hard the world pushes back: the era, the round and the difficulty rung.

### The ship is pinned; the camera is its negated velocity

resetPlayfieldAndArmNewRound (0x19F0) [seen] seats the ship at the start of every life and every round. The sprite entry's native-X byte PLAYER_ENTRY 0xAA10 [seen] gets 0x84, its native-Y byte PLAYER_SPRITE_Y 0xAA41 [seen] gets 0x78, and the heading PLAYER_HEADING 0xA802 [seen] gets 0x80, and the player state is set fully wound (0xFF). The same routine zeroes both scroll words. Nothing in the round's code writes the ship's position again, so for the whole life the ship stays where it was put and only its heading changes. The only other writers of those two bytes work outside play: the attract screens borrow the same sprite entries for the copyright caption (stampCopyrightStrip (0x0B06) [seen]), and the sprite-hiding sweeps hideCaptionSprites (0x0B2B) [seen] and hideAllSprites (0x15B6) [seen] zero them [code].

Every frame of the round engine, dispatchPlayerFrameByState (0x1EDF) [seen] decides what to do with the heading. If the player state byte PLAYER_STATE 0xA800 [seen] is clear, it does nothing. If the state is part-way through its wind-up, it runs the ship's animation strip. If the state is fully wound (0xFF), there are three cases. In the demo (PLAY_ACTIVE 0xAD30 [seen] clear), flyDemoShipByScript (0x214B) [seen] steers from a ROM script instead: DEMO_SCRIPT_DWELL 0xADF2 [code] holds a frame countdown in its low six bits and a steering command in its top two, and DEMO_SCRIPT_POINTER_LO / DEMO_SCRIPT_POINTER_HI 0xADF3 / 0xADF4 [code] are the cursor it walks through the script. Each frame the command either leaves the heading alone or moves it three notches one way or the other. With a stick direction held, turnShipTowardTargetHeading (0x1F01) [seen] turns the ship toward it. With the stick centred, the heading is left alone. All three paths end in the same tail, scrollWorldAtTheEraPace (0x1F42) [seen]. So the world scrolls every live frame whether or not the player is steering: the ship always flies forward and has no throttle [code].

The same tail runs during the round's opening sub-steps. flyRoundIntroFlashingEraYearThenEraseIntroCaptions (0x16AF) [code] and flyEnemyFreeLeadInThenStepSequence (0x5694) [code] each run the player frame and the scenery every frame. So the world is already moving under the ship while the era's caption is on screen and before any enemy is let in [code].

scrollWorldAtTheEraPace looks up the ship's velocity for its current heading (see the next subsection) and hands the pair to negateVelocityIntoWorldScrollThenDressSprite (0x1F55) [seen]. That routine negates each component as a 16-bit quantity. It stores the first as WORLD_SCROLL_Y 0xA808 [seen] and the second as WORLD_SCROLL_X 0xA80A [seen], then re-dresses the ship's sprite for its heading. The re-dress goes through dressPlayerSpriteForHeading (0x20AF) [seen]: the heading is rounded to the nearest of thirty-two sectors, and that sector indexes two parallel 32-entry tables at PLAYER_HEADING_SHAPE_TABLE 0x20CE. They give the sprite code PLAYER_SPRITE_CODE 0xAA11 [seen] and the attribute byte PLAYER_SPRITE_ATTRIBUTE 0xAA40 [seen] [code].

negateVelocityIntoWorldScrollThenDressSprite and the zeroing in resetPlayfieldAndArmNewRound are the only writers of the scroll pair anywhere in the program [code]. That has a consequence while the ship is dying. The player frame then takes the animation arm and never reaches the scroll tail, so the scroll words keep whatever value they had on the ship's last live frame. The world goes on drifting at that final velocity until the next life's reset zeroes it [code].

Both scroll words are 8.8 fixed point: 0x0100 is one pixel per frame.

### From heading to velocity, and why the axes cross

A heading is one byte: 256 steps to a full turn. velocityForHeading (0x596E) [seen] turns it into a pair of velocity components using a 256-entry table of signed 16-bit samples. The first component is the sample at the heading itself. The second is the sample a quarter-turn earlier (heading − 64). Every one of these tables holds the same curve: a coarse cosine, full positive at sample 0, zero a quarter-turn away, full negative opposite. So the two samples are perpendicular components of a single vector, and its length is the table's peak [code]. Choosing a table therefore chooses a speed and nothing else. doubledVelocityForHeading (0x59A0) [seen] is the same lookup with both components doubled, wrapping at sixteen bits instead of saturating.

The pair then lands on the axes crosswise. The *first* component (the cosine at the heading) becomes WORLD_SCROLL_Y 0xA808 [seen]. Every mover adds that word to the coordinate whose whole part is the sprite entry's `+0x31` byte and whose fraction is the object record's `+3`. That is the sprite's **native-Y** byte. The *second* component becomes WORLD_SCROLL_X 0xA80A [seen], which always pairs with the entry's `+0x00` byte and the record's `+5`: **native X**.

The board is mounted ROT90 clockwise, so a sprite at native (X, Y) appears at display x = 239 − native Y, display y = native X. Native Y is therefore the display's *horizontal* axis, mirrored, and a positive WORLD_SCROLL_Y slides the whole world left on the glass. Native X is the display's *vertical* axis, and a positive WORLD_SCROLL_X slides the world down [seen]. The names are crossed against the glass on purpose: each cell is named for the sprite field it lands in, not for the direction it moves the picture. Anything that describes this vector in screen terms calls the Y word the "horizontal" scroll and the X word the "vertical" one; that is a difference of convention, not a disagreement about any byte, and the two readings are the same vector seen from two different frames.

Putting the table and the rotation together [code]:

- Heading 0x00 flies the ship toward display-left.
- Heading 0x40 flies it down the screen.
- Heading 0x80, where every life starts, flies it right, so the world opens sliding left.
- Heading 0xC0 flies it up.

The stick table at 0x1F2E maps the four single stick bits to exactly those four quarter-headings. It maps the four legal diagonal pairs to the headings halfway between (0x20, 0x60, 0xA0, 0xE0), and anything else to 0x00. That gives the eight facings every 32 notches [code].

### Turning, and the one era-keyed turn rate

turnShipTowardTargetHeading does not jump to the wanted heading; it walks there, one step per frame. A heading already on target is left alone. A heading within one notch of it is snapped onto it. Otherwise the heading is stepped the short way round the compass: by 3 notches while ERA_INDEX 0xAD04 [seen] has a low digit below 3, and by 4 notches from the fourth era on [code]. An exact about-face (128 notches) is an ordinary turn that goes the positive way round. It is slow, but it is allowed [code].

With a step of 4, an eighth of a turn (32 notches) takes eight frames and lands exactly. With a step of 3 it does not divide evenly: the walk ends two short, the next step overshoots by one, and the frame after that snaps back. That is about twelve frames per eighth of a turn [code]. snapHeadingOntoTheTurnTarget (0x1F3E) [seen] is the arm that performs the snap and then falls into the same scroll tail. The demo pilot turns 3 notches per step in every era [code].

### The era sets the pace

The only choice scrollWorldAtTheEraPace makes is which velocity table to use, and it chooses on ERA_INDEX 0xAD04 [seen] alone. Era 0 (the manual's 1910) uses OPENING_ERA_VELOCITY_TABLE 0x5E00, with a peak of 256 (one pixel per frame). Eras 1 and 2 (1940, 1970) share the table at 0x2E3E, with a peak of 306 (about 1.20 px/frame). Every era from 3 up (1982, 2001) uses VELOCITY_TABLE_08FA 0x08FA, with a peak of 331 (about 1.29 px/frame) [code]. That third table is the ceiling: the last two eras fly at the same pace, and nothing above it is ever selected [code].

This is worth stating plainly because the public record appears to have missed it. `gameplay.md` records that the plane "is always flying forward at what appears to be a fixed speed". It is not: the ship's speed steps up twice over the five eras. Both descriptions are true of the same machine, because the ship's velocity *is* the world scroll. A faster ship renders as a faster world rather than a faster plane, and there is nothing on screen to measure it against [code].

The ROM holds six tables of this one curve, differing only in size: each is within two units of the 256-peak table scaled to its own peak, so they share one heading map and one turn geometry and differ by a scalar alone [code]. Besides the three above there are the table at 0x59D7 (peak 206), VELOCITY_TABLE_5C00 0x5C00 (peak 231) and a table at 0x2530 (peak 281). The six peaks form an evenly stepped ladder, 206 to 331 in steps of 25. The ship takes the third, fifth and sixth rungs and steps over the fourth [code].

That fourth rung, the 281 table at 0x2530, is wired to nothing. The two short entries that would select it (at 0x585A and 0x595F) have no callers. The only code that reaches the address is a tamper trap at 0x2735 that jumps into it as if it were code [code]. Two of the live tables are trap landings too: 0x08FA is the target of tamper jumps at 0x0757 and 0x0865, and 0x2E3E of one at 0x2D51 [code].

The tables are chosen through short entries, each of which loads one table and jumps into (or, for a couple, falls into) one of a few shared bodies. Only two of those bodies move anything. flyAlongHeading (0x58BC) [seen] adds the velocity once, and flyAlongHeadingAtDoubleVelocity (0x58FE) [seen] adds it twice, so an object routed through the second outruns every rung of the first. The other bodies, velocityForHeading and doubledVelocityForHeading, only look the pair up and hand it back; they write no memory. Every body has an entry for the slowest table, and one lookup body is entered two ways (a short prologue at 0x599D falling into doubledVelocityForHeading at 0x59A0, each with its own table entries). So a rung alone does not identify a routine: what identifies one of these entries is the body it reaches together with how it enters [code].

The same tables drive the enemy craft, so the era sets their speed *relative* to the ship's. The five per-era craft services are reached through dispatchSeatedSlotByEraIndex (0x290E) [seen]:

- **1910.** serviceEra0EnemyCraftSlot (0x2927) [seen] flies its craft through flyAtSlowestSpeed (0x5840) [seen] on the 206 table, while the ship flies at 256.
- **1940.** serviceEra1EnemyCraftSlot (0x294C) [code] flies at 256, through the entry at 0x5854 that selects OPENING_ERA_VELOCITY_TABLE, while the ship flies at 306.
- **1970.** serviceEra2EnemyCraftSlot (0x2984) [seen] drops back to 206, and steers only three frames in four.
- **1982.** serviceEra3EnemyCraftSlot (0x29B0) [seen] flies on the ship's own 331 table, through the entry at 0x58A4 that selects VELOCITY_TABLE_08FA. The jets are exactly as fast as the player, which matches gameplay.md's "as fast and manoeuvrable as you" [code].
- **2001.** serviceEra4EnemyCraftSlot (0x29D5) [seen] steers through steerEnemyTowardShip (0x29F7) [seen]. That routine alternates, on bit 1 of the frame tick, between a doubled step on the 206 table (412) and a single step on the 306 table. The average is about 359, faster than the ship [code].

Per-era enemy turn rates come from a five-entry table, TURN_RATE_BY_ERA_TABLE 0x2C1D (1, 1, 2, 2, 5), indexed by ERA_INDEX and read by steerTowardAimHeading (0x2BEF) [seen]. A craft within two notches of its aim heading is not turned; otherwise it turns the short way by its era's rate [code].

steerEnemyTowardShip uses that table in a borrowed way. When the craft's native-Y byte lies within 72 of either of two reference values (120 or 132), it rewrites ERA_INDEX to 0 around its one steering call and then restores it to 4. So the 2001 craft turns at rate 1 inside that window and at rate 5 outside it. The trick works only because this routine runs in era 4 and nowhere else [code].

### Everything in the world rides the scroll

Anything that belongs to the world adds the scroll pair to its position every frame, so it keeps its place in the world while the ship "moves". Each coordinate is sixteen bits stored in two places: the whole byte in the sprite entry, the fraction byte in the object's 16-byte record. A sub-pixel step accumulates in the fraction until it carries into the whole byte. Nothing clamps a coordinate; the whole byte simply wraps at 256 [code].

The movers differ only in what they add on top of the scroll:

- driftWithWorldScroll (0x2B60) [seen] adds the scroll pair alone, so the object is fixed in the world.
- flyAlongHeading (0x58BC) [seen] adds the scroll plus the object's own heading-derived velocity from whatever table the caller picks.
- flyAlongHeadingAtDoubleVelocity (0x58FE) [seen] doubles the object's own component but adds the scroll only once, so the object goes faster through the world without the world itself moving faster.
- flyAlongStoredVelocity (0x3E05) [seen] adds a velocity word the object carries in its record (`+0x0A`, `+0x0C`), folded into a single add with the scroll. Nothing else may also drift such an object, or the scroll would be applied twice.
- flyAlongBallisticArc (0x4017) [seen], stepMotherShip [code] and fireAndSweepPlayerShots (0x23E3) [seen] each fold the same two words into their own arithmetic. A new player shot stores four times the ship's own velocity (the scroll words multiplied by −4) as its own per-frame motion. The scroll is added on top of that each frame, so the shot pulls away from the ship at three times the ship's speed [code].

### Depth: the scenery lags or leads the scroll

The scenery is the clouds of the four sky eras and the asteroids of the 2001 era, in gameplay.md's terms [guess]. It is the one family that does *not* take the scroll whole, and that is how the game shows depth. Three drift routines each scale the displacement before adding it:

- driftAtHalfWorldScroll (0x2DF4) [seen] adds half the scroll, via displaceByHalf (0x304D) [seen].
- driftAtThreeQuartersWorldScroll (0x2D93) [seen] adds three quarters, via displaceByThreeQuarters (0x303E) [seen].
- driftAtFiveQuartersWorldScroll (0x2D6E) [seen] adds five quarters, via displaceByFiveQuarters (0x2E31) [seen].

The action (enemies, shots, the Mother-Ship) moves at exactly 1× the scroll. Objects at ½ and ¾ therefore slide past more slowly than the action, which reads as far off. Objects at 5⁄4 overtake it, which reads as nearer than the action [code for the fractions; the depth reading is an interpretation].

Each fraction is taken with an arithmetic shift, which rounds toward negative. So the same scroll run in opposite directions can move a scenery object by amounts that differ by one 1/256-pixel step per frame [code].

Only one tile of each scenery object carries position state. The object's leading tile is drifted. Its other tiles are re-laid every frame from that leader by placeAbuttingTile (0x3058) [seen], which puts the next entry one sprite pitch (16) further along native Y with the same native X. Some objects use placeDiagonallyAbuttingTile (0x308A) [seen] instead: 16 back along native Y and 16 on along native X, done as one 16-bit add so that a wrap on X carries into Y. advanceToNextSlot (0x309B) [seen] steps the pair of cursors between slots: 16 bytes per record slot, 2 bytes per sprite entry. Because the followers are derived rather than drifted, a multi-tile object keeps its shape exactly under any scroll. Because every byte wraps, an object that leaves one edge of the field comes back in on the opposite edge, so eight sprites make an endless sky [code].

### Seating and running the scenery, per era

There are eight scenery sprite entries, starting at SCENERY_ENTRY_SLOT0 0xAA30 [seen] (the fourth is SCENERY_ENTRY_SLOT3 0xAA36 [seen]). Their fraction bytes live in the records from SCENERY_RECORD_SLOT0 0xA900 [code]. They are seated once per life, inside resetPlayfieldAndArmNewRound, by seatEraSceneryRowThenClearAndRunScenery (0x30A5) [seen]. That routine starts by summing the 16-byte boot block at BOOT_CONFIG_CHECKSUM_BASE 0x086B [guess] (the block that also holds DEFAULT_KILL_QUOTA 0x0874) and comparing the total with 0x22. It is a tamper tripwire whose answer is discarded here: nothing at this entry branches on it [code]. It then copies the era's 8-byte row from the table at 0x3176 into the eight sprite-code bytes, from SCENERY_SPRITE_CODE_SLOT0 0xAA31 [seen] at stride 2. The four sky eras draw from one family of codes (0x5C–0x7C); era 4's row (0x30–0x33, 0x85–0x87) is a different set of shapes altogether [code].

Control then passes to clearSceneryEntriesThenRunEraScenery (0x30D1) [seen]. It first fills the eight attribute bytes, from SCENERY_SPRITE_ATTRIBUTE_SLOT0 0xAA60 [seen] (SCENERY_SPRITE_ATTRIBUTE_SLOT3 0xAA66 [seen] is the fourth). The fill value is 0xCC in the sky eras and 0x28 in era 4, supplied through seatSceneryFillByte0x28ThenClearEraScenery (0x3156) [seen]. The two cases then seat positions differently:

- **Sky eras.** seedSceneryEntriesThenRunScenery (0x3117) [seen] seats four position pairs from SCENERY_SEED_TABLE 0x316E. Those bytes are *coordinates*, not tints or shapes. For each of four entry pairs, the first byte goes to the leader's native-Y byte (`+0x31`) and 16 more than it to its partner's. The second byte goes to both entries' native-X bytes. That seeds four two-tile pairs, each partner one sprite pitch along native Y from its leader, at (Y,X) = (0x20,0xD0), (0x50,0x60), (0xA0,0xA0) and (0xD0,0x60) [code].
- **Era 4.** Eight single (Y,X) pairs are seated from ERA4_SCENERY_SEED_TABLE 0x315E, one per entry [code].

Both seating paths are guarded. The sky path needs TAMPER_WITNESS 0xAD39 [code] to read 0x68, and the byte after it to read 0x10 or 0x05; anything else jumps into the middle of an unrelated tile-placing loop at 0x307F, carrying the failing witness cell as its pointer, so the first thing that loop does is overwrite the witness. The seat never happens [code]. The era-4 path needs the copyright-glyph witness TAMPER_GLYPH_KONAMI 0xACC7 [seen] to read 0x3B with a colour byte of 0x05 or 0x10; otherwise it reaches 0x315B, a bare jump into the scenery-row table at 0x3176, which is then run as if it were code [code]. On a genuine image both guards pass, and both paths finish by running one frame of scenery.

From then on runSceneryForEra (0x2CBC) [seen] runs once per frame from the round service, and during the round's intro and lead-in sub-steps. It picks one of three fixed running orders on ERA_INDEX; each object's first step is seeded with slot 0, and each step leaves the cursors on the next object:

- **Era 0 (1910)** runs driftThreeTileSceneryAtFiveQuarters (0x2D15) [seen]: a three-tile straight row at 5⁄4. Then two driftTwoTileSceneryAtThreeQuarters (0x2D36) [seen] pairs at ¾, and one driftOneTileSceneryAtHalf (0x2D68) [seen] single at ½.
- **Eras 1–3 (1940, 1970, 1982)** swap the leading object for driftNearestSceneryTriTile (0x2D21) [seen]: a three-tile L at 5⁄4, one abutting tile and one diagonal. The ¾ and ½ objects are the same as in era 0.
- **Era 4 (2001)** runs two stepTwoTileSceneryAtFiveQuarters (0x2D2D) [seen] pairs at 5⁄4, then two driftOneTileSceneryAtThreeQuarters (0x2D62) [code] singles at ¾, then two driftOneTileSceneryAtHalf singles at ½.

Any index other than 0 or 4 falls into the middle order rather than being refused [code].

Because each handler places its object's tiles before stepping on, the running orders also record how big each layer's objects are. In eras 0 to 3 the 5⁄4 layer carries three-tile objects, the ¾ layer two-tile ones and the ½ layer single tiles, so the nearest layer has the largest sprites and the farthest the smallest, strictly. In era 4 the order is only monotone, not strict: the 5⁄4 layer carries two-tile objects, but the ¾ and ½ layers both carry single tiles. That smaller, more numerous set is the asteroid field `gameplay.md` describes for 2001 [code].

### "The era" is not one switch

Three subsystems read the same ERA_INDEX and divide it at different boundaries. The ship's pace splits it {0}, {1, 2}, {3, 4}. The ship's turn step splits it {0, 1, 2}, {3, 4}. The scenery splits it {0}, {1, 2, 3}, {4}. The first two are decided in the same chain, so the ship's own handling divides the era two different ways by itself. None of these treats an era as one bundle of settings, and the spawn-pressure settings described below are yet another per-era axis. A reader who assumes a single era boundary will predict changes that do not happen [code].

### Era, round and difficulty are three different things

Three separate quantities scale the game, and the code keeps them apart:

- **The era**, ERA_INDEX 0xAD04 [seen], runs 0–4 in the manual's order (1910, 1940, 1970, 1982, 2001). It picks the look and the behaviour: the scroll pace, the turn step, the craft type and its speed, the scenery set, the collision pass and many sounds.
- **The round**, ROUND_NUMBER 0xAD01 [code], counts every era cleared, starting from 1.
- **The difficulty rung**, ERA_RUNG 0xACC0 [seen], is a 0–15 index into the spawn-pressure settings, which rises the longer a life lasts.

startNextRound (0x2DB8) [seen] advances the first two together and resets the third's starting point. It adds one to ROUND_NUMBER and moves ERA_INDEX on by one, wrapping from 4 back to 0: the loop back to 1910 that the manual describes. It then reloads START_RUNG 0xAD0A [seen] from one of three cells, chosen by the unwrapped round count:

- rounds 1–5 use START_RUNG_ROUNDS_1_5 0xA9D3 [seen];
- rounds 6–10 use START_RUNG_ROUNDS_6_10 0xA9D4 [code];
- round 11 and every round after it use START_RUNG_ROUNDS_11_UP 0xA9D5 [code].

Because the era wraps every five rounds, the brackets are the loops: the first pass through history, the second, and every later pass, which all share the third bracket's starting rung [code]. ROUND_NUMBER is a single byte, so round 256 would read as 0 and fall back into the first bracket [code].

The kill quota is deliberately *not* on any of these axes. startNextRound refills KILLS_REMAINING 0xAD02 [code] from KILL_QUOTA 0xA9CD [seen]. That cell is loaded once at boot by seedGameConfigFromDipSwitches (0x52AA) [seen] from the ROM byte DEFAULT_KILL_QUOTA 0x0874, which holds 56. So the manual's 56 is the same in every era, every loop and on every difficulty setting [code]. The same routine also clears MOTHER_SHIP_ARMED 0xAD0D [seen] and ROUND_TRANSITION_HOLD 0xACC6 [code] and sets ROUND_ARMED 0xAD0E [seen] to 0xFF, so the next round is left armed rather than merely counted [code].

Each player keeps an independent copy of all of this. ERA_INDEX, ROUND_NUMBER, KILLS_REMAINING, the life clock and START_RUNG all live in the 16-byte live block starting at LIVES_REMAINING 0xAD00 [seen]. That block is saved to PLAYER_ONE_LIVES 0xAD10 [seen] or PLAYER_TWO_LIVES 0xAD20 [seen] on hand-over, and loadActivePlayerContextAndPostRoundHud (0x4C75) [seen] copies the right one back in. Two alternating players can therefore be in different eras, loops and rungs [code]. The attached per-player cells include PLAYER_ONE_ERA_INDEX 0xAD14 [seen], PLAYER_TWO_ERA_INDEX 0xAD24 [code], PLAYER_ONE_START_RUNG 0xAD1A [seen] and PLAYER_TWO_START_RUNG 0xAD2A [seen].

At the start of a game, armRoundStartThenStepSequence (0x27B1) [seen] sets both players' round numbers to 1 and their eras to 0. ERA_RUNG itself sits outside the saved block; it is rebuilt from START_RUNG at every life.

### The difficulty rung climbs during a life

The sequence enters every life and every round through postRoundStartCaptionsAndResetPlayfield (0x0774) [code]. That routine first XOR-folds the 256-byte span at ROUND_START_CHECKSUM_BASE 0x4C99 [code] and advances the outer phase on a wrong total. It then posts the round-start captions and calls resetPlayfieldAndArmNewRound, which restarts the rung:

- ERA_RUNG 0xACC0 [seen] is reloaded from START_RUNG.
- The escalation timer ERA_RUNG_TIMER 0xA9D7 [seen] is reloaded from its period ERA_RUNG_PERIOD 0xA9D6 [seen].
- The three-place life clock (LIFE_TICKS_LOW 0xAD05 [seen] and the word at LIFE_TICKS_MID 0xAD06 [seen]) is zeroed.
- The settings row for (era, rung) is scattered into the spawn cells.

The row lookup indexes ERA_RUNG_SETTINGS_POINTER_TABLE 0x1B04 with (era × 16) + rung. That table is five eras of sixteen *pointers*, each to a 10-byte row. The ten bytes land, in order, in:

- BANK_LAUNCH_SLOT_COUNT 0xA844 [seen]
- BANK_LAUNCH_NEAR_HALF_X 0xA837 [seen]
- BANK_LAUNCH_NEAR_HALF_Y 0xA827 [seen]
- BANK_LAUNCH_COOLDOWN 0xA817 [seen] and BANK_LAUNCH_COOLDOWN_PERIOD 0xA814 [seen], both from one byte
- ROUND_CRAFT_COUNT 0xACC1 [code]
- SCRIPT_PICK_THRESHOLD 0xACC4 [seen]
- ATTACKER_SPAWN_SLOT_COUNT 0xA8C6 [seen]
- ATTACKER_SPAWN_WINDOW_HALF 0xA8D6 [seen]
- ATTACKER_SPAWN_AIM_WINDOW_HALF 0xA8E6 [seen]
- ATTACKER_SPAWN_COOLDOWN 0xA8F4 [seen] and ATTACKER_SPAWN_COOLDOWN_PERIOD 0xA8F6 [seen], both from one byte

Reading the rows up the rungs, the cooldowns shrink and the counts and windows broadly grow, though not every knob moves in every era. In era 0, for example, the bank-launch cooldown falls from 60 at rung 0 to 25 at rung 15, and the attacker cooldown falls from 90 to 25. SCRIPT_PICK_THRESHOLD shows the per-era basing: it opens at 80 in eras 0 to 2, 96 in era 3 and 0 in era 4, and reaches 240 at rung 15 in every era. A higher rung therefore means more attackers, launched more often [code]. Because each era has its own sixteen rows, a new era starts its own ladder rather than continuing the last one [code].

The twelve cells fall into two parallel families of the same shape. The BANK_LAUNCH_* cells are read by launchBankEnemyWhenAimedNearPlayer and the Mother-Ship stepper. The ATTACKER_SPAWN_* cells are read by the per-era attacker spawners. Each family has a live cooldown and its reload period, one or two near-band or aim-window half-widths, and a slot count. The two live cooldowns, BANK_LAUNCH_COOLDOWN and ATTACKER_SPAWN_COOLDOWN, are counted down by the vblank service itself, and each is reloaded from its period when it fires [code]. BANK_LAUNCH_COOLDOWN 0xA817 also has a second life outside play: advancePenRunAnimationStep (0x1734) [seen] stores the checksum of a 34-byte code block into it (0x00 on a genuine image) during the sequence machine's pen-run steps, so the byte is scratch there and a spawn setting in play [code].

The climb comes from escalateDifficultyRungOnCounterWrap (0x4D3A) [seen], which the round service serviceRoundThenResolvePlayerState (0x1199) [seen] calls once per pass, late in its fixed list. Each call advances the life clock through advanceSexagesimalDigit (0x4D67) [seen]. That is a packed-decimal byte that rolls over at 60, carrying into the next place, so the clock reads in base sixty. Only when the lowest place rolls over (once every sixty passes, about a second at one pass per frame) does the routine touch the rung timer. A timer already at 0 means escalation is off, and it returns. Otherwise it counts the timer down. When the timer reaches 0 it reloads it from ERA_RUNG_PERIOD, raises ERA_RUNG by one, clamping at the ceiling of 15, and re-applies the settings row through applyEraRungSettings (0x1A9A) [seen]. That routine does the same scatter that resetPlayfieldAndArmNewRound does inline [code].

So pressure rises steadily for as long as a life lasts, one rung every PERIOD seconds, up to rung 15. Losing the life drops it back to the round's starting rung [code].

### The difficulty switch sets the ladder, not the era

At boot, the DSW1 bank at DSW1_PORT 0xC200 is read complemented and split across several routines [code]:

- seedGameConfigFromDipSwitches turns bits 0–1 into STARTING_LIVES 0xA9C1 [code]: 3, 4 or 5, with the fourth setting stored as 0xFF.
- unpackTheFirstThreeSwitchSettings (0x2E19) [seen] stores bit 2 as COCKTAIL_MODE 0xA9C2 [code] and bit 3 as BONUS_LIFE_SETTING 0xA9C3 [code].
- finishBootSelfTestAndColdStart (0x49A8) [seen] stores bits 4–6 as DIFFICULTY_SETTING 0xA9C4 [seen] and bit 7 as DEMO_SOUNDS_ENABLE 0xA9C6 [code].

The difficulty setting is the manual's eight steps. It never touches the era, the quota or the scroll pace. Its only job is to choose one of eight 4-byte records from DIFFICULTY_RECORD_TABLE 0x186A. At the start of a real game, armRoundStartThenStepSequence calls loadDifficultyRecord (0x0F7B) [seen], which copies that record over the four consecutive cells START_RUNG_ROUNDS_1_5, START_RUNG_ROUNDS_6_10, START_RUNG_ROUNDS_11_UP and ERA_RUNG_PERIOD. armRoundStartThenStepSequence then seeds both players' START_RUNG from the first of them, and both players' KILLS_REMAINING from KILL_QUOTA [code].

The eight records, as starting rungs for rounds 1–5 / 6–10 / 11 and up, then the number of base-sixty clock wraps (roughly seconds) per rung [code]:

| DIFFICULTY_SETTING | start rungs by loop | wraps per rung |
|---|---|---|
| 0 | 0 / 2 / 6 | 13 |
| 1 | 0 / 3 / 7 | 12 |
| 2 | 0 / 4 / 8 | 11 |
| 3 | 2 / 6 / 10 | 10 |
| 4 | 4 / 8 / 12 | 9 |
| 5 | 7 / 10 / 13 | 7 |
| 6 | 11 / 13 / 14 | 5 |
| 7 | 15 / 15 / 15 | 5 |

As the setting hardens, the starting rung rises and the time per rung falls. At the hardest setting the starting rung is already the clamp, so the climb is over before it begins. The three bracket bytes are not "easy / medium / hard" tiers: all three come from the same record, so from the same switch position, and what chooses among them is how many rounds the player has completed. So the switch sets where on the ladder each loop starts and how fast a life climbs it, and nothing else. Driven through all eight positions on the real ROM under MAME, one process per position, and read back from the derived cells, the table comes out exactly as above in both directions [seen].

The attract demo ignores the switch. When play is not active, armRoundStartThenStepSequence always loads record 2, a literal where the real game passes DIFFICULTY_SETTING; under MAME all eight switch positions produced this same record before a credit was taken [seen]. It seeds both players' START_RUNG from that record as well. It also cycles ATTRACT_STAGE_COUNTER 0xA9D0 [code] through 1, 2, 3, which become the demo's era and (plus one) its round number. The demo therefore shows only the 1940, 1970 and 1982 eras, never 1910 or 2001. That matches the attract-mode claim gameplay.md attributes to the Konami set [code]. So the era index does change during attract, from one demo to the next, and anything that takes a moving era index or the live play arm as proof that a game is being played will count the demo as one. And a demo is no guide to how the cabinet's difficulty switch is set [code].

### The cabinet switch turns the picture, not the world

Every vblank, serviceVerticalBlankInterrupt [code] rewrites SCREEN_UNFLIPPED 0xA987 [seen]. It stores 0 only when the second player is up (ACTIVE_PLAYER 0xAD32 [seen] non-zero) *and* COCKTAIL_MODE reads 0. Flipping only makes sense for a cocktail cabinet, so that value is taken to be the cocktail position [guess]. Otherwise it stores 1. The value is copied straight to the flip-screen line FLIPSCREEN_LATCH 0xC302 [code]; at cold start the latch is first driven from the fixed ROM byte FLIPSCREEN_INIT_BYTE 0x0C3E.

Three readers consult the flag:

- publishSpriteShadow (0x0365) [seen] chooses between its upright and turned-round transforms when it copies the sprite shadow to the hardware banks.
- readPlayerControls (0x1ED1) [seen] returns the second panel's mirror IN2_MIRROR 0xA9B0 [code] instead of IN1_MIRROR 0xA9AF [code].
- floodColourPlaneWithSavedPlayerColour [code] chooses which end to flood from.

The world model is untouched. Headings, velocities, scroll words and every coordinate stay in native terms, and only the final picture and the controls are turned round for the player sitting opposite [code].

### The fixed ROM tables the world reads

The whole of this section runs off a small set of fixed tables in the program image [code]:

- **Velocity tables.** Six 256-sample copies of the one velocity curve: the table at 0x59D7, VELOCITY_TABLE_5C00 0x5C00, OPENING_ERA_VELOCITY_TABLE 0x5E00, the unreached table at 0x2530, the table at 0x2E3E and VELOCITY_TABLE_08FA 0x08FA. Peaks are 206, 231, 256, 281, 306 and 331.
- **Steering.** The 16-entry stick-to-heading table at 0x1F2E and the ship's 32-sector shape and attribute tables at PLAYER_HEADING_SHAPE_TABLE 0x20CE.
- **Enemy turn rates.** The per-era rate table TURN_RATE_BY_ERA_TABLE 0x2C1D.
- **Scenery.** The era scenery-code rows at 0x3176, and the two position-seed tables SCENERY_SEED_TABLE 0x316E and ERA4_SCENERY_SEED_TABLE 0x315E.
- **Difficulty.** The eighty-pointer (era, rung) settings index ERA_RUNG_SETTINGS_POINTER_TABLE 0x1B04 with its 10-byte rows, and the eight 4-byte difficulty records at DIFFICULTY_RECORD_TABLE 0x186A.
- **Kill quota.** The single quota byte at 0x0874, which holds 56.

The era picks among these tables, the rung indexes into the settings rows, and the difficulty switch picks which record seeds the rungs.

## §4 Objects: one array, two tables, and two ways onto the screen

Everything that flies in Time Pilot — the ship, the enemy craft of each era, their bullets, bombs and
missiles, the 1940 bomber, the Mother-Ship, the parachutist and the drifting clouds — is the same kind
of thing to the program: a **slot**. A slot is two pieces of storage that always travel together. One
is a sixteen-byte **record** in a single array of work RAM, holding the object's state, heading,
velocity and timers. The other is a **sprite entry** in a shadow copy of the sprite hardware, holding
what the object looks like and where it is on the screen. Because the entry table is itself split in
two, an object really lives in three places at once, and nearly every routine in this subsystem is
written against a pair of cursors — one on the record, one on the entry — that step through their
tables in lockstep.

Getting objects onto the glass then happens two different ways. Sprites reach the screen by being
**published** from the shadow into the hardware sprite banks once a frame, and eight of them are
**doubled mid-frame** by re-positioning them after the beam has passed. The player's shots never use a
sprite at all: they are **stamped as tiles** into the character plane and erased again a frame later.

### One array of sixteen-byte records

The record array runs from PLAYER_STATE 0xA800 [seen] up to PLAYER_STATE_BLOCK_END 0xA97F: twenty-four
records of sixteen bytes. Record 0 belongs to the ship itself; the other twenty-three are laid out in
fixed families, and the family a record belongs to is decided purely by its address:

- four **actor** records, ACTOR_RECORD_SLOT0 0xA810 [seen] through ACTOR_RECORD_SLOT3 0xA840 [seen],
  which carry enemy fire;
- five **craft** records, CRAFT_RECORD_SLOT0 0xA850 [seen] through CRAFT_RECORD_SLOT4 0xA890 [seen], then
  MOTHER_SHIP_STATE 0xA8A0 [seen], then CRAFT_RECORD_SLOT6 0xA8B0 [seen] — seven records that carry the
  era's ordinary enemy craft whenever the Mother-Ship is not up;
- three **era-object** records, ERA_OBJECT_RECORD_SLOT0 0xA8C0 [seen], ERA_OBJECT_RECORD_SLOT1 0xA8D0
  [seen] and ERA_OBJECT_RECORD_SLOT2 0xA8E0 [code], whose meaning changes with the era (bombs in 1910,
  the bomber and its shot in 1940, missiles and alien weapons from 1970 on);
- PARACHUTIST_RECORD 0xA8F0 [seen];
- eight scenery records from SCENERY_RECORD_SLOT0 0xA900 [code] to the top of the array.

When the round-start step postRoundStartCaptionsAndResetPlayfield (0x0774) [code] resets the playfield,
resetPlayfieldAndArmNewRound (0x19F0) [seen] calls freeAndNumberEveryObjectSlot (0x1AE4) [seen]. That one
routine, on the whole array at once, walks the twenty-three records from 0xA810 — every record but the
ship's, scenery included — clears each one's first byte and stamps its last byte (+0x0F) with its
position in the run counting from one. That stamp is how the program tells one record from another
without doing address arithmetic: the four actor records are numbered 1–4, the seven craft records 5–11,
the era objects 12–14, the parachutist 15 and the scenery 16–23. The number is used as a **phase key** —
a record whose number equals `(FRAME_TICK & 7) + 5` gets its turn this frame, so each of the seven craft
gets one turn in eight frames and on the eighth (key 12) no craft does — and as an **identity** that can
be written into a shared cell and matched back later (the claim token, below). [code]

The array also serves as storage for settings that belong to a whole bank rather than to one object.
They sit at fixed bytes inside particular records: WAVE_KILL_COUNTDOWN 0xA811 [code], WAVE_CLAIM_TIMER
0xA812 [seen], BANK_LAUNCH_COOLDOWN_PERIOD 0xA814 [seen] and BANK_LAUNCH_COOLDOWN 0xA817 [seen] inside the
first actor record; CLAIM_TOKEN 0xA821 [code] and BANK_LAUNCH_NEAR_HALF_Y 0xA827 [seen] in the second;
BANK_LAUNCH_NEAR_HALF_X 0xA837 [seen] in the third; BANK_LAUNCH_SLOT_COUNT 0xA844 [seen] in the fourth;
MOTHER_SHIP_HOLD_COUNTER 0xA8A4 [seen] and MOTHER_SHIP_AIM_SIDE_TOGGLE 0xA8B4 [seen] in the Mother-Ship's
pair; ATTACKER_SPAWN_SLOT_COUNT 0xA8C6 [seen], ATTACKER_SPAWN_AIM_SIDE_TOGGLE 0xA8D4 [seen],
ATTACKER_SPAWN_WINDOW_HALF 0xA8D6 [seen], HITS_REMAINING 0xA8DC [seen] and ATTACKER_SPAWN_AIM_WINDOW_HALF
0xA8E6 [seen] in the era-object records; ATTACKER_SPAWN_COOLDOWN 0xA8F4 [seen],
ATTACKER_SPAWN_COOLDOWN_PERIOD 0xA8F6 [seen] and PARACHUTIST_RUNG 0xA8F7 [seen] in the parachutist's.
The round reset's slot clearing touches only state bytes, fractions, delay bytes and the numbers, so
these parked settings survive it, and the reset then reloads most of them from a ten-byte settings row
chosen by the era and the current difficulty rung (through ERA_RUNG_SETTINGS_POINTER_TABLE 0x1B04): the actor
bank's slot count, near-windows and launch cooldown, and the era-object bank's slot count, windows and
spawn cooldown, with each cooldown byte written both to its running cell and to its period. Anyone
reading the record layout below as "every byte of a record belongs to that record" will misread these:
ATTACKER_SPAWN_COOLDOWN_PERIOD, for instance, sits at +6 of the parachutist's record, yet the retire that
puts a bomber's shot on cooldown copies it into a quite different record. Whether a parked setting and
its host record's own use of the same byte ever meet depends on the era: HITS_REMAINING, for example, is
byte +12 of the second era-object record, and is read only in era 1, where that record is the bomber's
silent second half. [code]

Three of these settings are timers the vertical-blank service winds down: it takes one off
BANK_LAUNCH_COOLDOWN, WAVE_CLAIM_TIMER and ATTACKER_SPAWN_COOLDOWN every frame while they are non-zero,
and ATTACKER_SPAWN_COOLDOWN is also counted down by launchAttackerIntoFreeSlot on that slot's turn. [code]

The ship's own record holds the world's motion: PLAYER_HEADING 0xA802 [seen] is its heading, and
WORLD_SCROLL_Y 0xA808 [seen] and WORLD_SCROLL_X 0xA80A [seen], two 16-bit words, are written each frame
as the **negation** of the ship's velocity by negateVelocityIntoWorldScrollThenDressSprite (0x1F55)
[seen]. That pair is the per-frame displacement every other object adds to its own position, which is what makes the ship stand still at the centre while
the world slides past it. [code]

### Two tables of sprite entries, kept in lockstep

The sprite shadow is two parallel tables of two-byte entries. The first runs from PLAYER_ENTRY 0xAA10
[seen] to 0xAA3F; the second sits exactly 0x30 bytes above it, from PLAYER_SPRITE_ATTRIBUTE 0xAA40 [seen]
to 0xAA6F. Entry *k* of the first table pairs with record *k* of the array — record `0xA800 + 16k` owns
entry `0xAA10 + 2k` — so the families line up one for one: the ship at PLAYER_ENTRY 0xAA10, the actors at
ACTOR_ENTRY_SLOT0 0xAA12 [seen] to ACTOR_ENTRY_SLOT3 0xAA18 [seen], the craft at CRAFT_ENTRY_SLOT0 0xAA1A
[seen] to CRAFT_ENTRY_SLOT4 0xAA22 [seen], MOTHER_SHIP_ENTRY 0xAA24 [seen], CRAFT_ENTRY_SLOT6 0xAA26 [seen],
ERA_OBJECT_ENTRY_SLOT0 0xAA28 [seen], ERA_OBJECT_ENTRY_SLOT1 0xAA2A [seen], ERA_OBJECT_ENTRY_SLOT2 0xAA2C
[code], PARACHUTIST_ENTRY 0xAA2E [seen], and the eight scenery entries from SCENERY_ENTRY_SLOT0 0xAA30
[seen].

Read from an entry's base, the four bytes of one sprite are:

- **+0x00** — the horizontal screen coordinate, X (PLAYER_ENTRY 0xAA10 for the ship);
- **+0x01** — the shape code (PLAYER_SPRITE_CODE 0xAA11 [seen]);
- **+0x30** — the attribute byte: colour in the low six bits and the two flip bits on top
  (PLAYER_SPRITE_ATTRIBUTE 0xAA40);
- **+0x31** — the vertical screen coordinate, Y (PLAYER_SPRITE_Y 0xAA41 [seen]; also ACTOR_SPRITE_Y_SLOT0
  0xAA43 [seen], MOTHER_SHIP_SPRITE_Y 0xAA55 [seen], ERA_OBJECT_SPRITE_Y_SLOT0 0xAA59 [seen]).

The record, by contrast, holds no whole coordinate, no shape and no colour; everything the picture needs
is in the entry. [code]

A cloud bigger than one sprite is not a structure of its own. placeAbuttingTile (0x3058) [seen] writes
only two bytes — the next entry's coordinates, sixteen pixels on along +0x31 and level on +0x00 — and
steps both cursors; it copies no shape and no attribute. So a three-sprite cloud is three ordinary
entries whose positions are recomputed from the first every frame. That makes the scenery budget
legible: each era's scenery list fills exactly the eight scenery slots — pieces of 3, 2, 2 and 1 sprites
through era 3, six pieces of 2, 2, 1, 1, 1 and 1 in era 4. The number of pieces changes with the era;
the number of slots never does, and a bigger piece is bought by having fewer of them. [code]

Stepping to the next slot therefore means adding sixteen to the record cursor and two to the entry
cursor at the same moment. advanceToNextSlot (0x309B) [seen] is exactly that and nothing else, and every
bank sweep below repeats the same pair of strides inline; it is the only thing that keeps the two
cursors addressing the same object. [code]

The ship's slot is seated at the centre of the picture when a round starts — PLAYER_ENTRY 0xAA10 = 0x84
and PLAYER_SPRITE_Y 0xAA41 = 0x78 — and never moves. Those two numbers recur throughout the object code
as "the player's position": spawn and launch windows measure distance from 0x84 on the +0x00 axis and
0x78 on the +0x31 axis. [code]

### Where each coordinate lives: whole part in the entry, fraction in the record

A position on each axis is a 16-bit fixed-point number, split across the two stores. The **whole
pixel** is the entry byte the hardware reads; the **fraction** is a byte of the record. The +0x31
coordinate pairs with record byte +3, and the +0x00 coordinate with record byte +5. Every mover
reassembles the pair, adds a displacement, and splits it back, so a motion smaller than a pixel banks in
the fraction instead of being lost. This is why every mover touches two tables to move one thing, and
why a reader expecting a position to live in one place will not find it. [code]

The movers differ only in where the displacement comes from:

- **driftWithWorldScroll** (0x2B60) [seen] adds just the shared world displacement: WORLD_SCROLL_Y 0xA808
  to the +0x31 axis and WORLD_SCROLL_X 0xA80A to the +0x00 axis. An object that only drifts is fixed in
  the world: it slides across the screen at exactly the rate the ship flies, the other way.
- **flyAlongHeading** (0x58BC) [seen] turns the record's heading (byte +2) into a velocity through
  velocityForHeading (0x596E) [seen] and adds it on top of the drift. The heading is a 256-step compass;
  a velocity table holds 256 signed 16-bit samples, the sample at the heading drives the +0x31 axis and
  the sample a quarter-turn back drives the +0x00 axis, so the pair is always perpendicular and the
  table's amplitude *is* the speed. Speed is chosen by choosing the table: flyAtSlowestSpeed (0x5840)
  [seen] and loc_58aa (0x58AA) [seen] use the table at 0x59D7, loc_5854 (0x5854) [seen] and loc_58b6
  (0x58B6) [seen] use OPENING_ERA_VELOCITY_TABLE 0x5E00, loc_58a4 (0x58A4) [seen] uses
  VELOCITY_TABLE_08FA 0x08FA, loc_5860 (0x5860) [seen] uses the table at 0x2E3E.
- **flyAlongHeadingAtDoubleVelocity** (0x58FE) [seen] adds twice the heading's velocity but the world
  displacement only once, so the object moves faster through the world without the world moving faster
  (loc_58aa and loc_58b6 are its two entries).
- **flyAlongStoredVelocity** (0x3E05) [seen] ignores the heading and uses two velocity words the record
  already carries — +10/+11 for the +0x31 axis and +12/+13 for the +0x00 axis — folded into the same add
  as the drift. These are objects whose course is fixed at launch: enemy bullets, the bomber and its
  shot, the straight first leg of an era-3 missile, the parachutist.

Nothing clamps a coordinate. Both whole parts wrap at 256, and the retire tests below are written as
wrapped-distance windows for exactly that reason.

### The record, byte by byte

Most families use the sixteen bytes the same way, and where they differ it is the family's handler, not
the record, that decides:

- **+0x00 — the state / marker byte.** 0x00 means free. 0xFF means live. 0xFE, in a craft record, means
  held (waiting to enter). Any other value is a countdown: a dying craft, an exploding shot, a bomb's
  one-shot animation, a parachutist showing its award.
- **+0x01** — the heading the object is *aiming* for (or, for a ballistic bomb, the side it was thrown to).
- **+0x02** — the heading it is actually *flying*; steering moves +2 toward +1.
- **+0x03, +0x05** — the fractions of the two coordinates.
- **+0x04** — a per-object counter: the era-4 approach countdown, the craft's era-4 shape block.
- **+0x07/+0x08** — the ballistic bomb's accelerating speed word.
- **+0x08, +0x09, +0x0A** — for craft, the current script step, its step timer and the script selector
  (described below).
- **+0x0A..+0x0D** — for straight-flying objects, the two stored velocity words.
- **+0x0E** — the slot's delay: a release countdown for a held craft, a re-spawn cooldown after a
  retire, a straight-flight countdown for a missile. Its top bit also marks a craft released from a
  formation hold (see below).
- **+0x0F** — the slot number stamped at round start.

The state byte, the two headings, the fractions, the delay and the number mean the same thing to every
family; **+0x08..+0x0D do not**. The
ship's record keeps the world displacement there, a straight-flying object its velocity, a craft its
script, a ballistic bomb its speed word, and any single name for that block would be wrong for somebody.
One writer into it, fileTwoPairsIntoObjectRecordHighByteFirst (0x46CE) [seen], used when the Mother-Ship
takes a new heading, files a 16-bit pair into +0x0C/+0x0D and a second into +0x1C/+0x1D — the same field
one record further on, so each of the Mother-Ship's two records gets one — each stored **high byte
first**, the reverse of a word; it reads and tests nothing. [code]

**The craft's steering script.** stepShapeAnimation (0x323A) [seen] runs the three script bytes. The
selector +0x0A picks a run of thirty-two bytes through SHAPE_RUN_POINTER_TABLE 0x3438; the timer +0x09
is counted down once per call and the count it lands on is the index into that run, and the byte found
there lands in +0x08. So a script is read **backwards**, from the far end of its run toward the front,
and it **stops on the run's first byte**: once the timer is zero the routine returns without writing
anything, and nothing raises the timer again. Every site that starts a script loads the timer with
0x20, the length of a run, so a fresh script plays its whole run. Every run in the table begins with the
same byte, 0x11, so that is where every script comes to rest. [code]

The script's bytes are steering orders, not pictures. The craft re-aimer
reaimAndAnimateEnemyCraftOnPhaseTick (0x31B4) [seen] visits one craft per call (on the ticks of the
low life-tick counter LIFE_TICKS_LOW 0xAD05 [seen] whose high nibble is 0 or 3, the low nibble
choosing the slot; on the other ticks it lays out the aim points instead), steps its script, and reads
+0x08: an ordinary value is an index into the table of aim points at ENEMY_AIM_POINT_TABLE 0xAC65 [seen],
and the craft's aim heading +0x01 is pointed at that point; 0x10 means hold the current aim; and the
resting value 0x11 points the aim **directly away** from the first aim point, then writes 0x10 and a
zero timer so the order is given once. So every craft's script ends by turning it round to fly off and
holding that course. [code] stopFiveSlotAnimations (0x3855) [seen] writes that finished state — +0x08 =
0x11, +0x09 = 0 — straight into the first five craft records at one point in the life counter, which
sends those craft away at once. [code] In gameplay terms this is the enemy that "will eventually turn
around and leave". [guess]

### The life of a slot: free, held, live, dying

A slot comes to life when a spawner finds it free. Every spawner works the same way: it walks a bank with
the two cursors, stops at the first record whose +0x00 reads zero, fills in the entry's coordinates,
shape and attribute and the record's heading, velocity and timers, and writes the state byte **last** —
usually by decrementing the zero to 0xFF — so a slot is never live with stale contents. The spawners are
spread across the game: the enemy-spawning code fills craft records through
spawnEnemyIntoFreeSlotElseStepSearch (0x37D6) [seen] and the formation fill inside
driveEnemyWaveForLifePhase (0x36AF) [seen]; launchBankEnemyWhenAimedNearPlayer (0x3ED6) [seen] fills
the actor bank with enemy fire; launchAttackerIntoFreeSlot (0x4243) [seen] and commissionStagedAttackerByEra (0x42B7) [seen]
fill the era-object bank; armBomberSlotWhenTimerFires (0x3C25) [seen] places the bomber; spawnAtEdgeAhead
(0x4853) [seen] places the parachutist. [code]

A formation craft can be born **held**: the formation fill in driveEnemyWaveForLifePhase writes 0xFE
instead of 0xFF whenever its descriptor gives the craft a non-zero entry delay in +0x0E, so "held" and
"live" are chosen by one store. The same fill counts every craft it places into WAVE_KILL_COUNTDOWN
0xA811 [code] (cleared first) and, once done, loads WAVE_CLAIM_TIMER 0xA812 [seen] with 0xE4, which the
vertical-blank service then runs down a frame at a time. While held, releaseHeldObject (0x2B52) [seen]
counts +0x0E down once per turn; the turn it lands on zero it steps the state byte from 0xFE to 0xFF — live —
and reloads +0x0E with 0x80. That top bit is what countTheKillAndGrantTheSharedToken looks for later, so
it marks the craft as a released formation member. [code]

A live craft is killed by the collision code writing 0xF0 into its state byte. From there
stepDyingObjectState (0x2B93) [seen] runs the death as a countdown in the same byte:

- at 0xF0 it re-seats the byte to 0x3B and calls countTheKillAndGrantTheSharedToken (0x2BBA) [seen],
  which requests the death sounds, takes one off KILLS_REMAINING 0xAD02 [code] (never below zero), and —
  if this craft carries the released-formation bit and WAVE_CLAIM_TIMER is still non-zero — counts
  WAVE_KILL_COUNTDOWN down; the kill that zeroes it writes this record's number, with its top bit set,
  into CLAIM_TOKEN 0xA821 [code];
- from 0x3C upward it counts down and flies on at the slowest speed (decrementObjectStateThenFlyAtSlowestSpeed
  0x2BB4 [seen]); a craft whose state arrives at exactly 0x3C has its kill counted first;
- below that it counts down, retires the slot at zero, and otherwise hands the object to
  moveObjectByStateByteThenRunAppearance (0x2C22) [seen]: at 32 and above the wreck still flies at the
  slowest speed and its state falls a second step in the same frame, below 32 it only drifts with the
  world;
- driveObjectAppearanceByPhaseBand (0x2C31) [seen] then dresses the wreck from the same byte. From 42 up
  only the colour moves — the attribute's top two bits are kept and FRAME_TICK 0xA980 [seen]'s low nibble
  is dropped beneath them, so the sprite flickers through sixteen tints. From 10 to 41 the state, less
  ten and halved, indexes the sixteen-shape run at OBJECT_PHASE_SHAPE_TABLE 0x2C94 in one fixed tint (60): the explosion.
  Below 10 the wreck survives only if CLAIM_TOKEN names it; anything else is retired on the spot. The
  one wreck that holds the token shows a fixed shape (252) in a fixed tint (108) and has its state
  stepped back up seven frames in eight, so it lingers, sinking one step every eighth frame; when it
  reaches 1 it posts command 4 (argument 12) and clears the token, and the next frame it goes out. [code]
  In gameplay terms that is the formation bonus: the last member of a released formation, shot while the
  claim window of 0xE4 frames (a little under four seconds) is open, leaves a marker behind that awards
  the bonus — the "2,000" caption. [guess]

The other families die more simply. An exploding bomb or missile is a plain countdown (below). An enemy
bullet that is hit is retired on the spot outside era 4. The bomber soaks hits (below). The Mother-Ship
has its own state machine, which sits outside this section.

### Retiring and hiding

"Retire" always means the same two things together: the record's state byte goes to zero, freeing the
slot, and **both coordinate bytes of the entry go to zero**, which parks the sprite at the corner of the
coordinate space, off the picture. The variants differ only in what else they touch:

- **retireSlot** (0x40AB) [seen] — state byte and both coordinates, nothing more, leaving +0x0E as it
  was. Enemy fire, the ballistic bombs and the missile bank retire this way.
- **retireSlotAndSubPixel** (0x2BDE) [seen] — also zeroes the two fractions (+3, +5), so the next object
  to take the slot starts on a whole pixel. This is the craft family's retire. It and retireSlot have
  no caller in common, which is what makes them two families' helpers rather than two versions of one.
- **retireSlotIntoCooldown** (0x48AD) [seen] — retireSlot plus +0x0E = 0xF0, so the slot cannot be
  re-spawned at once; the parachutist uses it.
- **retireSlotIntoSharedCooldown** (0x3DFB) [seen] — retireSlot plus +0x0E loaded from
  ATTACKER_SPAWN_COOLDOWN_PERIOD 0xA8F6 [seen], so every slot retired this way goes out holding the
  same, era-set cooldown; the bomber's shot uses it.
- **retireEntryPairIntoCooldown** (0x46DB) [seen] — for the two-sprite Mother-Ship: the record's state
  byte, both coordinates of **two neighbouring entries** (MOTHER_SHIP_ENTRY 0xAA24 and CRAFT_ENTRY_SLOT6
  0xAA26 when seated there), and +0x0E = 95.
- **retireObjectAndHold** (0x3C0D) [seen] — for the two-sprite bomber: the state bytes of its record and
  the next one (0xA8C0 and 0xA8D0), both coordinates of the caller's entry and of the fixed second entry
  ERA_OBJECT_ENTRY_SLOT1 0xAA2A, and +0x0E = 128, which becomes the delay before the next bomber.

**Hiding** is different: it leaves the slots alone and takes pictures off the screen. hideAllSprites
(0x15B6) [seen] zeroes the +0x31 coordinate of all twenty-four entries, PLAYER_SPRITE_Y 0xAA41 through
0xAA6F in steps of two, which puts every sprite above the first drawn line; it is called on the
transitions that wipe the screen — losing a life (loseLifeAndHandOver 0x11ED [seen]), clearing the
field (advanceRoundWhenFieldCleared 0x1271 [code]), the round-start intro (stepRoundStartIntroAnimation
0x1323 [code]), the screen-clearing sequence step parkSpritesAndArmLineWipeThenAdvanceSequence (0x181E)
[seen], high-score initials entry when it starts the next game (stepHighScoreInitialsEntry 0x18C3
[code]) and the attract and start steps. hideCaptionSprites (0x0B2B) [seen] zeroes the same coordinate
for only the first four entries — the ship and the first three actor entries — when a game or the attract demo starts. [code]

Because a retire zeroes the same +0x31 byte, **a retired slot is also a hidden one**: "retired" and
"hidden" are the same store to the entry, and only the record's state byte tells them apart. [code]

### Retire lines and edge tests

Because coordinates wrap, an object that leaves the screen does not fall off the end of anything; it
keeps going round the 256-pixel space. The program therefore retires objects at **lines** placed as far
from the ship as the space allows. hasReachedRetireLine (0x2B83) [seen] answers true when the +0x31
coordinate is within one pixel of 248 or the +0x00 coordinate is within one pixel of 4. Those are the
ship's own coordinates plus half the space (0x78 + 0x80 = 0xF8, 0x84 + 0x80 = 0x104 → 4), so the line on
each axis is the point directly opposite the ship — the farthest an object can get from a camera that
never moves. Almost every flying family asks it once a frame: all five era craft handlers, enemy
bullets, the bomber's shot, the missile bank's straight, homing and breakaway arms, and the parachutist.
The era-4 approach arm asks it too but ignores the answer, so an object still approaching its standoff
point is never retired at the line. [code]

The window is only three pixels wide, so an object whose whole part moves more than three pixels a
frame on the retiring axis can step over the line and go round again. Whether anything in the game is
that fast is not settled; the player's shots use their own explicit range test instead. [code]

The two-sprite objects use a heading-dependent test instead, because a pair of sprites sixteen pixels
apart needs its line moved to match the side it is travelling toward. hasReachedBoundaryBandSelectedByHeading
(0x3CC4) [seen] looks at the record's heading: on one half of the compass it hands straight to
hasDriftedOffTheField (0x3CD9) [seen], which fires when the +0x31 coordinate sits in 240–242; on the
other half it tests the band just below, 237–239. The two halves ask about two adjacent,
non-overlapping bands, so the direction an object is arriving from picks its own edge. Either way, if
the +0x31 band misses, the question passes to hasReachedHorizontalEdgeWindow (0x3CE1) [code], a
four-wide window straddling the wrap on the +0x00 coordinate (254, 255, 0, 1). The tests write
nothing; the bomber and the Mother-Ship retire on them. [code]

The ballistic bomb has its own pair of limits inside flyAlongBallisticArc (below), and the player's shots
have theirs inside the shot sweep.

### Animations: dressing a sprite for its heading and its frame

Every live object rewrites its entry's shape (+0x01) and attribute (+0x30) as it goes. Two kinds of
dresser exist: those driven by the object's **heading**, and those driven by a **counter** — the
object's own state byte or the free-running FRAME_TICK 0xA980 [seen].

The heading dressers round the heading to the nearest sector (adding half a sector before dividing, so
the circle closes) and read a shape and an attribute from ROM:

- **spriteForHeading** (0x2A57) [seen] rounds to sixteen sectors and reads SPRITE_SHAPE_BY_SECTOR_TABLE
  0x2A77 and its parallel SPRITE_MIRROR_BY_SECTOR_TABLE 0x2A87. Eight shapes cover the compass because the
  other eight directions reuse them with the flip bits set. On alternate pairs of frames (FRAME_TICK bit 1)
  the shape is moved on by eight, so each direction flutters between two pictures — the propeller.
  refreshSpriteFromHeading (0x2A3C) [seen] stores the pair as it stands (the 1910 biplanes);
  refreshSecondEraSpriteFromHeading (0x2A47) [seen] adds 16 to the shape and 53 to the attribute, the
  same lookup moved into another bank of pictures and colours (the 1940 monoplanes). [code]
- **dressSpriteForFineHeading** (0x2A97) [seen] rounds to thirty-two sectors and reads two-byte
  shape/attribute pairs from FINE_HEADING_SHAPE_TABLE 0x2ABC, with the same +8 flutter (era 2's craft).
- **dressSpriteForCoarseHeading** (0x2AFC) [seen] rounds to sixteen sectors and reads
  COARSE_HEADING_SHAPE_TABLE 0x2B18 and the table sixteen bytes on (era 3's craft), without flutter.
- **dressSpriteShapeAndAttributeForHeadingSector** (0x3FAF) [seen] does the same from
  HEADING_SECTOR_SHAPE_TABLE 0x3FCA for the era-object bank's homing objects.
- **mirrorTwoTileObjectByHeading** (0x3CE9) [seen] dresses the bomber's two entries with a consecutive
  pair of shapes, `0xA0 + 4 × (3 − HITS_REMAINING) + (FRAME_TICK & 2)` and one more; which entry takes the
  lower code, and one flip bit of the shared attribute (0xED or 0x6D), swap at the half-turn, so the
  pair turns end-for-end together and still reads as one aircraft. The base steps by four per hit
  taken, so the bomber wears its damage. [code]
- **dressSpriteForHeadingOrRetireAtEdge** (0x4447) [seen] first asks the boundary band test and
  retires the Mother-Ship's pair through retireEntryPairIntoCooldown the frame it fires. Otherwise it
  dresses the pair with a consecutive pair of shapes from HEADING_SHAPE_PAIR_TABLE 0x44F1, picked by
  the era, by FRAME_TICK bit 1 (a two-frame alternation) and by the Mother-Ship's own byte +4,
  MOTHER_SHIP_HOLD_COUNTER 0xA8A4 [seen], in one tint from ERA_SPRITE_COLOUR_TABLE 0x4531; between the
  two halves of the compass it swaps which entry takes which shape and toggles the attribute's top flip
  bit. In era 4 it gives the pair a two-frame flutter instead (dressSpriteFlutterShapesByFrameTickBit
  0x44DC [seen], shapes 0xD5/0xD4 stepping by two on FRAME_TICK bit 2) in tint 0x70, and while
  MOTHER_SHIP_HOLD_COUNTER is anything but 7 a counter in the record's byte +6 flashes the pair to tint 0x51
  at intervals (restartAnimationCounterThenDressFlutterSprite 0x44C9 [seen]).

The counter dressers ignore heading altogether:

- **animateSelectedShapeCycle** (0x2B38) [seen] gives an era-4 craft shape
  `0xD8 + ((FRAME_TICK >> 2) & 3) + 4 × (record+4 − 1)` in attribute 0x61: a four-step spin, with the
  record's byte +4 choosing which block of four pictures it spins through (the sum wraps at a byte
  rather than clamping).
- **animateFixedShapeCycle** (0x3E7E) [seen] gives shape `0x40 + ((FRAME_TICK >> 1) & 7)` in attribute
  0x44 — used for era 4's enemy fire.
- **animateFixedShapeCycleAtHalfRate** (0x41F1) [code] gives shape `0x50 + ((FRAME_TICK >> 1) mod 8)` in
  attribute 10 — the same step rate as the one above, from a different block of shapes — used for the
  era-4 objects of the era-object bank. Neither of these two reads anything of the object, so two
  entries dressed in the same frame come out identical.
- **runOneShotAnimatedObjectSlot** (0x406C) [seen], **stepDriftingCountdownObjectByEraFrames** (0x413C)
  [seen] and **runSlotCountdownDriftAndAnimateElseRetire** (0x3E8E) [seen] are the explosion players.
  Each treats the state byte as a countdown: at or above 0x3C it is first clamped to 0x3B and a sound is
  requested (stampObjectStateByte3bThenRequestSound 0x409D [seen], or
  stampObjectStateByte3bThenRequestTwoSounds 0x3ECB [code]); then the object drifts with the world, the
  count falls, the slot retires at zero, and from 0x1C (28) upward the count picks one of eight frames,
  four counts per frame. The tables are ONE_SHOT_OBJECT_SHAPE_TABLE 0x4094 (attribute 0x0E) for the
  1910 bomb bank, NEAR_ERA_SPRITE_FRAME_TABLE 0x416E (attribute 0x0D) or FAR_ERA_SPRITE_FRAME_TABLE 0x4183
  (attribute 0x02) for the missile bank by era, and COUNTDOWN_SLOT_SHAPE_TABLE 0x3EC3 (attribute 3) for
  enemy fire. Below 0x1C the last frame simply holds until the count runs out. [code]

### Sweeping the banks

Each frame of play the round service, serviceRoundThenResolvePlayerState (0x1199) [seen], runs the
object banks in a fixed order, interleaved with the other subsystems and with the mid-frame sprite
passes described further down: the parachutist, the Mother-Ship's step, the seven craft slots, the
scenery, the missile sweep, the 1940 bomber and its shot, the four actor slots, and the 1910 bomb bank,
before the collision pass. Each bank has its own shape of sweep.

**The seven craft slots.** stepSevenCraftSlots (0x28A1) [seen] visits the craft slots in fixed order,
each through a small entry that seats both cursors — seatCraftSlot0ThenDispatchByEra (0x28B7)
[seen] and its siblings for slots 1–4, then seatMotherShipSlotThenDispatchByEraUnlessArmed (0x28EE) [seen]
for record MOTHER_SHIP_STATE 0xA8A0 with entry MOTHER_SHIP_ENTRY 0xAA24, then
seatCraftSlot6ThenDispatchByEraUnlessArmed (0x28FE) [seen]. The last two stand down whenever
MOTHER_SHIP_ARMED 0xAD0D [seen] is set: those two records and entries then belong to the Mother-Ship,
which armMotherShipOrStep (0x43B7) [seen] runs as a two-sprite object instead. Every entry ends in
dispatchSeatedSlotByEraIndex (0x290E) [seen], which jumps through the eight-word table
ERA_SLOT_DISPATCH_TABLE 0x2914 at index `ERA_INDEX & 7` (ERA_INDEX 0xAD04 [seen]). Only the first five words are handlers, one
per era; startNextRound (0x2DB8) [seen] wraps ERA_INDEX from 4 back to 0, so the last three words are
never selected. [code]

All five era handlers branch on the state byte in the same order — zero does nothing, 0xFE runs
releaseHeldObject, any value other than 0xFF runs stepDyingObjectState — and differ only in what a live
craft does:

- **Era 0 — serviceEra0EnemyCraftSlot** (0x2927) [seen]: steer toward the aim heading
  (steerTowardAimHeading 0x2BEF [seen], which stops within a step of the aim and otherwise turns the
  short way by a per-era step from TURN_RATE_BY_ERA_TABLE 0x2C1D — 1, 1, 2, 2 and 5 for eras 0 to 4),
  fly at the slowest speed, retire at the line; otherwise try to fire
  (launchBankEnemyWhenAimedNearPlayer), dress from the heading (refreshSpriteFromHeading) and try to
  throw a bomb (launchAttackerIntoFreeSlot).
- **Era 1 — serviceEra1EnemyCraftSlot** (0x294C) [code]: steer, fly on OPENING_ERA_VELOCITY_TABLE
  0x5E00 (loc_5854), retire at the line; otherwise try to fire and dress with
  refreshSecondEraSpriteFromHeading. It makes no attacker launch, because in era 1 the era-object bank
  belongs to the bomber.
- **Era 2 — serviceEra2EnemyCraftSlot** (0x2984) [seen]: steer on three frames in four (skipped when
  `FRAME_TICK & 3` is 3), fly at the slowest speed, retire at the line; otherwise fire, dress with
  dressSpriteForFineHeading, and try to launch into the era-object bank.
- **Era 3 — serviceEra3EnemyCraftSlot** (0x29B0) [seen]: steer, fly on VELOCITY_TABLE_08FA (loc_58a4),
  retire at the line; otherwise fire, dress with dressSpriteForCoarseHeading, launch.
- **Era 4 — serviceEra4EnemyCraftSlot** (0x29D5) [seen]: steerEnemyTowardShip (0x29F7) [seen] turns and
  flies the craft, and does it in an unusual way — when the craft's +0x31 coordinate is within 72 of
  either 120 or 132, it temporarily writes 0 into ERA_INDEX so the turn is taken at era 0's gentle rate
  of 1 instead of 5, then writes 4 back; the move alternates the double-speed mover loc_58aa and the
  single-speed loc_5860 on FRAME_TICK bit 1. Then retire at the line; otherwise dress with animateSelectedShapeCycle, fire, launch.

**The four actor slots — enemy fire.** Any live craft may put a bullet into the actor bank through
launchBankEnemyWhenAimedNearPlayer (0x3ED6) [seen]. It acts only on the craft's own turn (the phase key
`(FRAME_TICK & 7) + 5` against the record number), only while BANK_LAUNCH_COOLDOWN 0xA817 [seen] is zero,
and only if a free record exists among the first BANK_LAUNCH_SLOT_COUNT 0xA844 [seen] actor records.
The craft must be away from the ship on at least one axis by the half-window in BANK_LAUNCH_NEAR_HALF_Y
0xA827 [seen], its heading must lie within BANK_LAUNCH_NEAR_HALF_X 0xA837 [seen] of PLAYER_HEADING, and
the aim at ENEMY_STANDOFF_AIM_MAIN 0xAC7F [seen] must be within a sixteenth of a turn of the craft's own
heading. Then a launch sound is requested and the bullet takes the craft's whole coordinates, a doubled
velocity for that aim (from OPENING_ERA_VELOCITY_TABLE from era 1 on, from the table at 0x5C00 in era
0), shape 0x4D and attribute 0x62; the cooldown is re-armed from BANK_LAUNCH_COOLDOWN_PERIOD 0xA814
[seen], and the state byte is decremented from 0 to 0xFF. [code]

stepFourActorSlots (0x3E36) [seen] then seats each of the four actor records with its entry and hands it
to dispatchObjectSlotByHeadByte (0x3E63) [seen]: zero is skipped; 0xFF goes to
flyAndRetireSlotCyclingShapeInEra4 (0x3E6C) [seen], which flies the bullet along its stored velocity,
retires it at the line, and in era 4 alone also cycles its shape with animateFixedShapeCycle; any other
value goes to runSlotCountdownDriftAndAnimateElseRetire (0x3E8E) [seen], which in eras 0–3 retires the
bullet on the spot and in era 4 plays its explosion. In the game's terms, the saucers' shots burst
when shot down, while the older eras' bullets simply vanish. [guess]

**The era-object bank.** This bank's three records change job with the era, and three different entry
points service it.

*Era 0, the bombs.* serviceEra0BallisticObjectBank (0x3FEA) [seen] returns at once outside era 0;
otherwise it seats the cursors on ERA_OBJECT_RECORD_SLOT0 0xA8C0 and ERA_OBJECT_ENTRY_SLOT0 0xAA28 with a count of three and routes each
slot by its marker: 0xFF flies it along flyAlongBallisticArc (0x4017) [seen], any other non-zero marker
runs its one-shot explosion (runOneShotAnimatedObjectSlot), zero is stepped over. The three helpers
sweepObjectSlotBankByHead (0x3FF9) [seen], sweepObjectSlotBankServicingFirstSlot (0x4008) [seen] and
advanceSlotThenSweepObjectBankByHead (0x400B) [seen] are the same loop entered at three points — before
the first test, at the service, and at the advance — striding sixteen and two. The arc itself is two
unlike axes: on the +0x31 axis the bomb takes a fixed step of one and a half pixels a frame, its sign from
record byte +1; on the +0x00 axis it takes a speed word held in +7/+8 which grows by 9 every frame. A
bomb is thrown with that speed at 0xFF00 — moving one way — and the steady growth turns it round and
accelerates it the other way; both axes also take the world drift. It retires when the +0x31 coordinate
comes within sixteen of the wrap or the +0x00 coordinate reaches 248. [code] That is the 1910
biplanes' bomb, lobbed up and falling away on a parabola. [guess]

Bombs are thrown by launchAttackerIntoFreeSlot (0x4243) [seen], called from a live craft's handler.
It too acts only on the craft's turn, only once ATTACKER_SPAWN_COOLDOWN 0xA8F4 [seen] has run out (it
counts the cooldown down on turns when it has not), and only when a free record exists among the first
ATTACKER_SPAWN_SLOT_COUNT 0xA8C6 [seen] era-object records; the found record and entry are parked in
SCRATCH_PTR_A 0xA991 [seen] and SCRATCH_PTR_B 0xA993 [seen]. The craft must not be within
ATTACKER_SPAWN_WINDOW_HALF 0xA8D6 [seen] of the ship on both axes at once. In era 0 the launch goes
through setTheLaunchFacingInsideOneAimWindow (0x429C) [seen], which throws only when the craft's +0x00
coordinate lies within ATTACKER_SPAWN_AIM_WINDOW_HALF of the ship's 0x84, and sets the facing to 1 when
the craft lies beyond the ship's 0x78 on the +0x31 axis, else 0 — so the bomb's fixed step carries it
toward the ship's line; in the other eras the launch goes straight to
commissionStagedAttackerByEra (0x42B7) [seen], which copies the craft's whole-and-fraction coordinates
into the staged slot, stores the facing in +1, and fits the object out by era: in era 0 shape 0x4F, a
flip bit from the facing, and the 0xFF00 speed word; in eras 1–2 an aim at ENEMY_STANDOFF_AIM_MAIN with
the flying heading set a quarter-turn to one side, the side chosen by bit 0 of the slot number, and
+0x0E = 0 so it homes at once; in era 3 a stored velocity for the facing turned 0x1A to one side and
+0x0E = 0x20, so it flies straight for 32 turns before homing; in era 4 a straight aim with +4 seeded from
ATTACKER_SPAWN_AIM_WINDOW_HALF 0xA8E6 [seen]. Outside era 0 the shape and attribute come from
HEADING_SECTOR_SHAPE_TABLE by the new heading. Each path requests a launch sound, decrements the state
byte to 0xFF and re-arms the cooldown from ATTACKER_SPAWN_COOLDOWN_PERIOD. (The eras 1–2 path also
covers era 1, but no era-1 craft calls the launcher.) Because the vertical-blank service also runs
ATTACKER_SPAWN_COOLDOWN down every frame, the craft's turns only hurry it along. [code]

*Era 1, the bomber.* serviceEra1BomberObject (0x3B5F) [seen] returns at once outside era 1; otherwise it
treats record 0xA8C0 as a single object
with two sprites, ERA_OBJECT_ENTRY_SLOT0 0xAA28 and ERA_OBJECT_ENTRY_SLOT1 0xAA2A. A free record runs
armBomberSlotWhenTimerFires (0x3C25) [seen], which counts +0x0E down on even frames; when it reaches zero,
and the Mother-Ship is not up, it places the bomber at an edge position read from HEADING_SHAPE_TABLE
0x3C84 by the ship's heading, sets its heading to one of two opposite facings, stores a velocity for
that facing, sets HITS_REMAINING 0xA8DC [seen] to 3 and marks it live. A live bomber runs
advanceTwoTileObjectThenTryAimedSpawn (0x3B77) [seen]: fly along the stored velocity, place the second
sprite sixteen pixels further along the +0x31 axis at the same +0x00, retire through retireObjectAndHold
when the boundary band fires, otherwise dress the pair and try to fire. A bomber whose state byte the
collision code has changed runs advanceHitSoakingObjectThenAnimateDeath (0x3B94) [seen]: while
HITS_REMAINING is non-zero it spends one, sets the state back to live and keeps flying; with none left
it clamps the state to 0x61, requests the death sounds, recolours both sprites to 0x3D, and counts
down while drifting, the second sprite still following sixteen pixels on — every
eighth count above 0x40 it reseats the pair from DEATH_ANIMATION_SHAPE_TABLE 0x3C09, at exactly 0x40 it
posts command 4 (argument 11) and shows the pair as shapes 0xFA/0xFB in colour 0x6C, and at zero it
retires and holds. [code] Four hits in all, then an award caption — the 1,500-point middle-size
bomber. [guess]

The bomber fires through spawnAimedEnemyIntoEraBankWhenInWindow (0x3D25) [seen]. Its destination is
ERA_OBJECT_RECORD_SLOT2 0xA8E0 [code] / ERA_OBJECT_ENTRY_SLOT2 0xAA2C [code] when ATTACKER_SPAWN_SLOT_COUNT
is not 1 and that record is free, and otherwise ACTOR_RECORD_SLOT3 0xA840 / ACTOR_ENTRY_SLOT3 0xAA18,
which must then be free. When the bomber is live, ATTACKER_SPAWN_COOLDOWN is clear,
ATTACKER_SPAWN_SLOT_COUNT is non-zero, the destination is free and either of the bomber's two sprites
lies outside ATTACKER_SPAWN_WINDOW_HALF of the ship on either axis, it requests a launch sound, aims from
that sprite at ENEMY_STANDOFF_AIM_MAIN, alternates the side of a 0x18 offset with
ATTACKER_SPAWN_AIM_SIDE_TOGGLE 0xA8D4 [seen], and seats the shot at that sprite's position with a doubled
velocity for the offset heading, shape 0x4D and attribute 0x62, re-arming the cooldown. A shot in 0xA8E0
is flown in era 1 by serviceFixedSlotInEra1 (0x3DDA) [seen] through serviceSlotByHeadByte (0x3DEB)
[code]: 0xFF flies along its stored velocity and retires into the shared cooldown only once that step
has landed it on the line; any other non-zero value retires into the shared cooldown where it stands,
without moving. A shot seated in the actor bank is flown there like any enemy bullet. [code]

*Eras 2–4, the per-slot sweep.* sweepEra2PlusObjectBank (0x40D6) [seen] returns below era 2 or when
ATTACKER_SPAWN_SLOT_COUNT 0xA8C6 is zero; otherwise it seats the record cursor on 0xA8C0, the entry
cursor on 0xAA28 and the turn count from ATTACKER_SPAWN_SLOT_COUNT, and enters the turn body
serviceSlotByMarkerThenCloseSweepTurn (0x40EA) [code]. The sweep is a loop made of tail transfers: each
turn routes its slot by marker to one arm, and every arm ends at closeOneTurnOfTheSlotSweep (0x410B)
[code], which moves the record cursor on sixteen and the entry cursor on two, counts the turn down, and
re-enters the turn body while turns remain. The routes are:

- marker 0x00 — straight to the turn close;
- any marker other than 0xFF — stepCountdownSlotThenCloseTurn (0x4108) [code]: one frame of
  stepDriftingCountdownObjectByEraFrames (the explosion), then the turn close;
- 0xFF in era 4 — stepSlotApproachThenBreakawayRetire (0x4194) [seen]: while the approach counter in +4
  is running it is counted down and flyTowardShipStandoffThenEndApproach (0x41B8) [seen] flies the object
  — on every sixteenth frame re-aiming it at one of **two fixed standoff points**, ENEMY_STANDOFF_AIM_SET
  0xAC75 [seen] or ENEMY_STANDOFF_AIM_CLEAR 0xAC79 [seen] by bit 0 of its slot number (not at the ship's
  own point), and cutting +4 to zero through endApproachNow (0x41EC) [seen] once it is within sixteen of
  that point on both axes; each frame it turns two units toward the aim on three frames in four
  (steerTowardAimAtFixedRate 0x421F [seen]), moves at double speed on OPENING_ERA_VELOCITY_TABLE and
  spins its shape. It is not retired at the line while approaching. Once +4 is zero it stops steering and
  breaks away, still spinning, flying on at double speed until it meets a retire line. [code] That is the
  2001 saucers' bending shot. [guess]
- 0xFF with +0x0E still running — flyLiveSlotAndTickCountdown (0x418B) [seen]: fly along the stored
  velocity (retiring at the line), count +0x0E down, close the turn. This is the straight first leg of
  an era-3 missile. [code]
- 0xFF with +0x0E spent — chaseOneAimPointAndRetireAtTheLine (0x4117) [seen]: re-aim at
  ENEMY_STANDOFF_AIM_MAIN on the one frame in sixteen whose `FRAME_TICK & 15` equals the record's slot
  number (spreading a bank's re-aims over sixteen frames), turn one unit toward the aim
  (steerTowardAimOneUnitAFrame 0x4201 [seen]), move at double speed on the 0x59D7 table, dress from
  HEADING_SECTOR_SHAPE_TABLE, retire at the line, then close the turn. [code] That is the homing
  missile of the 1970 helicopters and 1982 jets. [guess]

**The parachutist.** runParachutistSlot (0x47B3) [seen] runs PARACHUTIST_RECORD 0xA8F0 with
PARACHUTIST_ENTRY 0xAA2E, in every era but 4. A free slot goes to spawnAtEdgeAhead (0x4853) [seen]: on odd
frames, while the Mother-Ship is not up, it counts +0x0E down and at zero places the parachutist at the
edge position EDGE_SPAWN_COORD_TABLE 0x488D gives for the ship's heading sector, sets its stored velocity
to zero on the +0x31 axis and 0x0040 on the +0x00 axis, and marks it live last. In flight it follows that
stored velocity on top of the world drift — a slow, steady glide through the world — retires into cooldown at the line, and
shows a shape from PARACHUTIST_FLIGHT_SHAPE_TABLE 0x47EA picked by `(FRAME_TICK >> 4) & 7` in attribute
0x75. Any other state byte is a countdown that drifts with the world and hands off to
postNextParachutistBonus (0x4831) [code] at 0x10 and showParachutistAward (0x4809) [seen] from 0x3C up,
before retiring into cooldown at zero. [code]

### Way one: publishing the shadow to the sprite banks

Nothing in the object code writes the sprite hardware. It writes the shadow, and the first thing the
vertical-blank service does each frame is publishSpriteShadow (0x0365) [seen], which copies the shadow
into the two hardware sprite banks: bank 0 at SPRITE_BANK0_BASE 0xB010 gets the first bytes of each
entry (coordinate and shape), bank 1 at SPRITE_BANK1_BASE 0xB410 gets the second-table bytes (attribute
and coordinate), forty-eight bytes each, twenty-four sprites. [code]

The copy is not in memory order. Each bank is gathered from three runs: the first three scenery entries
(0xAA30–0xAA35, and 0xAA60–0xAA65 for bank 1), then the sixteen object entries from the ship to the
parachutist (0xAA10–0xAA2F, 0xAA40–0xAA5F), then the remaining five scenery entries (0xAA36–0xAA3F,
0xAA66–0xAA6F). So the hardware's slots 0–2 and 19–23 hold the eight cloud sprites and slots 3–18 hold
every object. The reorder is a priority arrangement: the video hardware draws its sprites from the
highest slot down, so the lowest slot is drawn last and wins an overlap. The first three cloud sprites
therefore pass in front of every object, and the other five behind. [code] In eras 0–3 those front three
are exactly the three-sprite cloud the scenery code moves fastest, so the nearest-looking cloud both
moves fastest and is drawn in front; in era 4 the fastest rung is two two-sprite pieces, and one of its
sprites falls into the back group. [code]

Each byte passes through a transform chosen by which half of a sprite it is and by SCREEN_UNFLIPPED
0xA987 [seen]. With SCREEN_UNFLIPPED non-zero only the Y byte changes, to the complement of (itself plus
14), which is `241 − Y`. The hardware reads a sprite's vertical position back as 241 minus that byte, so
the encoding is exactly undone and the shadow's Y is the sprite's own top row. With SCREEN_UNFLIPPED
zero — the picture turned round — X becomes the complement of (itself plus 15), which is `240 − X`, the
shape is left alone, the attribute has both flip bits toggled, and the Y byte merely steps on by one,
which the hardware reads back as `240 − Y`. So the turned-round picture mirrors every sprite in
software on both axes and flips its image; the transforms wrap at a byte. [code] The orientation flag is
written by the vertical-blank service only **after** the publish, and a cold start clears work RAM, so
the first publish after power-on is always the turned-round one. [code]

Last, and only inside one window of the sequence machine — SEQUENCE_PHASE 0xA9AB [seen] equal to 3 and
SEQUENCE_SUBSTEP 0xA9AC [code] at least the ROM byte SPRITE_RAISE_STEP_FLOOR 0x0832 (5) and below 8 —
the eight cloud sprites (bank slots 0, 1, 2 and 19–23) are **raised**: where a cloud's bank-1 coordinate
byte has its top bit clear, 0x80 is added both to it and to the same sprite's X byte; a byte whose top
bit is already set is left as the copy wrote it. Either way, once the raise has run, every cloud slot
carries its top bit set: the request is posted for every cloud slot and for no object. That window covers the round's fly-in steps and the
live round, and the raise is what arms the mid-frame doubling that follows. [code]

### Doubling the cloud sprites mid-frame

The round engine itself runs inside the vertical-blank service, after the publish, so while the object
code works the beam is already drawing the picture. The program uses that to make eight hardware sprites
show sixteen clouds. [code]

A raised cloud sprite has the top bit of its bank-1 coordinate byte set; that bit is a request. The
scanline-gated pass multiplexSpriteSlotsSkipping (0x0F97) [seen] visits the eight cloud slots — the pairs
SPRITE_BANK1_SLOT0_Y 0xB411 / SPRITE_BANK0_BASE 0xB010, SPRITE_BANK1_SLOT1_Y 0xB413 / SPRITE_BANK0_SLOT1_X
0xB012, SPRITE_BANK1_SLOT2_Y 0xB415 / SPRITE_BANK0_SLOT2_X 0xB014, and SPRITE_BANK1_SLOT19_Y 0xB437 /
SPRITE_BANK0_SLOT19_X 0xB036 through SPRITE_BANK1_SLOT23_Y 0xB43F / SPRITE_BANK0_SLOT23_X 0xB03E — and, for
each one with its request bit set, adds the live beam position from SCANLINE_COUNTER 0xC000 to that byte.
When the sum carries out of eight bits the beam has passed the sprite's first appearance: the pass clears
the request bit and adds 0x80 to the partner bank-0 byte, which moves the sprite half the coordinate space
away on both axes for the rest of the frame. A slot whose trigger line has not been reached is left for a
later pass. [code]

The top bit is **not only a flag**. The whole byte, bit 7 included, goes into the sum with the beam
position, so the bit moves the firing line by half a screen as well as marking the request; masking it
off before the comparison would change when every trade fires. [code]

serviceRoundThenResolvePlayerState calls this gated pass five times between its service groups — after
the enemy-spawning step, after the craft slots, after the missile sweep, after the actor slots and after the
collision pass — so the trades land close to the lines that trigger them. It then finishes with
multiplexSpriteSlots (0x1098) [seen], the waiting twin: for each slot still carrying a request it spins
on the beam until the trigger line is reached, then trades. The two routines are the same eight blocks,
byte for byte, except for one byte in each block — the displacement of the branch after the beam test,
which jumps forward past the slot in the skipping pass and back to the head of the block in the waiting
one. The skipping pass catches slots opportunistically between other work; the waiting pass is the
backstop that guarantees every request is served before the frame ends. The last five blocks, for slots
19–23, can also be entered on their own at loc_10f8 (0x10F8) [seen], and
spinRemainingSpriteMultiplexSlots (0x10FD) [seen] joins just inside the slot-19 block, at its beam
test. The round's two fly-in steps, flyRoundIntroFlashingEraYearThenEraseIntroCaptions (0x16AF) [code]
and flyEnemyFreeLeadInThenStepSequence (0x5694) [code], use the same pairing around the ship, scenery
and shot services: two skipping passes and a closing waiting one. So every frame a cloud sprite is drawn
twice — once where the raise put it, and again, after its trigger line, at its published position — and
the next vertical blank publishes and raises it afresh. [code]

### Way two: shots stamped into the character plane

The player's shots are not sprites. They live in their own bank, PLAYER_SHOT_ARRAY 0xAA80 [seen] to
PLAYER_SHOT_ARRAY_END 0xAADF, six records sixteen bytes apart (the stride is the ROM byte
PLAYER_SHOT_SLOT_STRIDE 0x0861), cleared at round start by freeAllShotSlots (0x2755) [seen]. A shot's
record holds everything: +0 is the occupancy byte (0xFF live), +3/+4 and +5/+6 are its two coordinates as
16-bit words with the pixel in the high byte, and +10/+11 and +12/+13 are its own step on each axis.
[code]

fireAndSweepPlayerShots (0x23E3) [seen] fires only while the ship is alive and no round transition is
holding. A fresh press of the fire button — the button down this frame and up the last — arms a burst of
three in SHOT_BURST_PENDING 0xAA81 [seen], and a shot is launched into the first free record while the
burst is pending (in the attract demo whenever the cooldown allows), at most one shot per six frames of
SHOT_SPAWN_COOLDOWN 0xAA82 [seen], each with a shot sound:
the starting pixel on each axis comes from PLAYER_SHOT_VELOCITY_TABLE 0x2771 by the ship's heading in
thirty-two sectors, and the shot's own step is set to minus four times that frame's world displacement.
Each frame every live shot adds its own step plus the current world displacement, so while the ship holds
its course a shot crosses the screen at three times the world's rate in the ship's direction of travel. A
shot is culled when its +4 pixel enters 0xF0–0xFF or its +6 pixel enters 0xF8–0x0F across the wrap, or
when its occupancy byte is anything but 0xFF — culling zeroes +0 and both pixel bytes. [code]

Every surviving shot is drawn by queueTileStampForObject (0x5337) [seen]. It biases the two pixel bytes
by seven; their high five bits choose a cell of the character plane, 32 cells to a row from
COLOUR_PLANE_BASE 0xA000, and their low three bits choose one of sixty-four pre-shifted two-by-two
records at PRESHIFTED_TILE_RECORD_TABLE 0x53D4, each four glyph/attribute pairs. Every pair with a
non-zero glyph is appended to the deferred write list DEFERRED_WRITE_LIST 0xAE04 [seen] as four bytes —
the cell's colour-plane address low and high, the glyph, the attribute — through DEFERRED_WRITE_CURSOR
0xAE00 [seen], a cursor that steps only its low byte so the list wraps inside its own page. [code]

The list is acted on at the next vertical blank, straight after the sprite publish, by
drainBothDeferredCellLists (0x5286) [seen]. It first runs blankCellsPaintedLastPass (0x530E) [seen] over
the erase list DEFERRED_BLANK_LIST 0xAE84 [code] (cursor DEFERRED_BLANK_CURSOR 0xAE80 [seen]), writing the
blank glyph 32 into the character plane (the colour-plane address with bit 10 set) of each named cell,
colour untouched. It then runs paintDeferredCells (0x52D2) [seen] over the write list, writing each glyph
into the character plane and each attribute, plus PEN_COLOUR 0xAD0C [seen]'s low nibble, into the colour
plane. Both skip any cell whose existing colour byte has bit 4 set, the bit that draws a tile above the
sprites, so a shot never overwrites or erases such a cell. Finally the whole write list is copied onto
the erase list and the write cursor is parked on its first entry again; when nothing was pending both
cursors are simply parked by emptyBothDeferredCellLists (0x526A) [seen]. So a stamp painted on one frame
is erased on the next, and a moving shot is a two-by-two block of tiles repainted one position further on
each frame. [code]

The two lists are **not a double buffer**. The copy runs one way on every pass — the write list onto
the erase list, never back — and the two walkers are unlike: the blanking one writes only the character
plane and leaves colour as it was, the painting one writes both planes. The halves cannot exchange roles
the way a double buffer's do. [code]

## §5 The player's ship

The player's jet never moves on the screen. It is parked at a fixed sprite position in the middle of the picture, and everything the stick does is expressed through two numbers: the ship's **heading**, and the **world scroll** that heading implies. Turning changes the heading a few steps per frame; the heading picks a velocity; the velocity is negated and applied to the world, so the clouds, enemies and bullets slide past a stationary ship. Firing, the demo pilot and even the enemy spawner all start from that same heading byte. This section follows the ship from the byte that holds its state, through the controls and the turn, to the shots it fires, how it dies, and how the attract demo flies it with no one at the stick.

### The player record and the fixed sprite

The ship's state lives in a small record at the base of the actor area. Its first byte, `PLAYER_STATE 0xA800` [seen], is the ship's whole life cycle in one value: `0x00` means there is no ship to run, `0xFF` means the ship is whole and flying, and anything in between is a countdown through its destruction (below). The third byte is `PLAYER_HEADING 0xA802` [seen], a full byte read as a 256-step circle, so one step is 1/256 of a turn. The byte between them, `loc_a801 0xA801`, is cleared when a round is armed; the code does not establish a role for it.

Paired with the record is the ship's sprite entry. `PLAYER_ENTRY 0xAA10` [seen] holds its X, `PLAYER_SPRITE_Y 0xAA41` [seen] its Y, `PLAYER_SPRITE_CODE 0xAA11` [seen] its shape and `PLAYER_SPRITE_ATTRIBUTE 0xAA40` [seen] its colour and mirror bits. `resetPlayfieldAndArmNewRound` [seen], which the round-start arm `postRoundStartCaptionsAndResetPlayfield` [code] runs at sub-step 4 of the round engine, seats the position once per life (X `0x84`, Y `0x78`), and no routine in the player code ever writes those two cells again: the ship stays put and the world moves [code]. The same reset sets the heading to `0x80`, marks the state `0xFF`, clears `SHOT_BURST_PENDING 0xAA81` [seen] and `ROUND_TRANSITION_HOLD 0xACC6` [code], zeroes both halves of the world scroll, and calls `freeAllShotSlots` [seen] to empty the shot bank. When the round engine is entered for the attract demo, `armRoundStartThenStepSequence` [seen] first wipes the whole block from `PLAYER_STATE` up to `PLAYER_STATE_BLOCK_END 0xA97F` (and the shot bank with it) to zero, so the demo has no ship to run until the reset marks one; a real game does not take that wipe and relies on the reset alone [code].

The shape and attribute are refreshed every flying frame by `dressPlayerSpriteForHeading` [seen]. It rounds the heading to the nearest of thirty-two sectors (add four, divide by eight) and reads two parallel thirty-two-entry tables at `PLAYER_HEADING_SHAPE_TABLE 0x20CE` in the program image: the shape comes from the first table and the attribute byte, carrying the mirror bits, from the table thirty-two bytes on. The shape table holds only sixteen distinct codes, each used twice with different mirror bits, so the ship is drawn in thirty-two orientations from sixteen pictures plus mirroring, even though it steers on a 256-step circle. It never locks to eight [code].

### One frame of the ship

Each frame the round engine calls `dispatchPlayerFrameByState` [seen], which reads `PLAYER_STATE` and picks one of four courses. At zero nothing happens, because there is no ship. At any value other than zero or `0xFF` the ship is being destroyed, and `advancePlayerAnimationStrip` [seen] runs one frame of the explosion. At `0xFF` with `PLAY_ACTIVE 0xAD30` [seen] clear, no one is playing, so this is the attract demo and `flyDemoShipByScript` [seen] steers the ship from a script. At `0xFF` in a real game the control panel is read: if any of the four stick bits (the low nibble) is set, `turnShipTowardTargetHeading` [seen] turns the ship, and if the stick is centred the heading is left alone and the frame goes straight to `scrollWorldAtTheEraPace` [seen].

Each flying course ends in that same world-scroll tail, so the ship flies on whether or not the stick is held. There is no throttle, no brake, no acceleration and no momentum: both velocity components are recomputed from the heading every frame and stored, so letting go of the stick simply holds the heading and keeps the speed [code].

`dispatchPlayerFrameByState` runs in three places in the round sequence. The first is the intro flight, `flyRoundIntroFlashingEraYearThenEraseIntroCaptions` [code] (sub-step 5 of the round engine's table at `0x0F29`), which flies the ship over the scenery but never calls the shot routine, so during the intro the player can steer but cannot fire [code]. When its delay runs out it re-arms `SEQUENCE_DELAY 0xA9EB` [seen] to `0x2A` and steps on to the lead-in with no enemies, `flyEnemyFreeLeadInThenStepSequence` [code] (sub-step 6), which runs the ship and `fireAndSweepPlayerShots` [seen] together while it counts that delay down once per frame, 42 frames in all. The third is the full round service, `serviceRoundThenResolvePlayerState` [seen] (sub-step 7), where the ship is serviced second, after the enemy re-aim, and the shots third.

### Reading the controls

`readPlayerControls` [seen] decides which panel belongs to the player who is up. The vertical-blank service copies each input port into work RAM every frame, inverted so that a pressed input reads 1: `IN1_MIRROR 0xA9AF` [code] for the main panel and `IN2_MIRROR 0xA9B0` [code] for the cocktail panel. The same service decides `SCREEN_UNFLIPPED 0xA987` [seen] each frame, clearing it only when player two is up (`ACTIVE_PLAYER 0xAD32` [seen] nonzero) and `COCKTAIL_MODE 0xA9C2` [code] reads zero, and writes that value straight to the hardware flip-screen line. When `SCREEN_UNFLIPPED` is zero the picture has been turned round for the cocktail player and the control read returns the second panel; otherwise it returns the first. Nothing else chooses between the panels, so the second panel matters only when the screen is flipped, and the panel that is live is always the one facing the picture [code].

The whole byte that comes back is the product, because its callers split it three ways. The flight code takes the low four bits as the stick. The shot code takes bit 4 as fire and edge-detects it into a burst, through `FIRE_BUTTON_EDGE_SHIFT 0xA98E` [seen]. And the high-score entry, `stepHighScoreInitialsEntry` [code], shifts individual bits into one-bit press histories of its own: bit 0 into `INITIALS_BACK_PRESS_HISTORY 0xA995` [code], bit 1 into `INITIALS_FORWARD_PRESS_HISTORY 0xA996` [code], bit 4 into `INITIALS_COMMIT_PRESS_HISTORY 0xA997` [code] and bit 5 into `INITIALS_ALT_COMMIT_PRESS_HISTORY 0xA998` [code].

### Turning: eight targets, a 256-step heading

The stick does not set a heading directly. It names a **target**: the stick is absolute, not relative. `turnShipTowardTargetHeading` [seen] uses the stick nibble as an index into a sixteen-byte table at `0x1F2E` in the program image and gets the heading it wants. The table's contents, with the stick direction each bit carries on the real machine, are:

| stick nibble | stick | target | stick nibble | stick | target |
|---|---|---|---|---|---|
| `1` | LEFT | `0x00` | `8` | DOWN | `0x40` |
| `2` | RIGHT | `0x80` | `9` | DOWN+LEFT | `0x20` |
| `4` | UP | `0xC0` | `A` | RIGHT+DOWN | `0x60` |
| `5` | UP+LEFT | `0xE0` | `6` | UP+RIGHT | `0xA0` |

The byte values are from the program image [code]; which physical stick direction sets each bit, and that holding fire alongside it leaves the target unchanged, were watched under MAME (§12) [seen]. Left and right are an opposed pair half a turn apart, and so are up and down (`0xC0` against `0x40`). The four diagonals fall exactly between their neighbours, so the stick selects one of **eight facings**, each a multiple of `0x20` [code]. A nibble that asserts both halves of an opposed pair (`3`, `7`, `B` through `F`) indexes a zero and aims at heading `0x00` [code].

★ The sixteen bytes at `0x1F2E` are also a routine's address. The same bytes that the turn reads as data are jumped into as instructions by the explosion's tamper divert (below), where they are `loc_1f2e` [code]. So `0x1F2E` is a lookup table to the turn and code to the divert, and must never be treated as pure data [code].

The routine then moves `PLAYER_HEADING` toward the target in one of three ways, depending on the difference *heading − target* taken as a byte. If the difference is zero, nothing is written. If it is one step either side (`0xFF` or `0x01`), the heading is *snapped* onto the target; that store is the arm at `0x1F3E`, `snapHeadingOntoTheTurnTarget` [seen]. Otherwise the heading is **stepped the short way round**: a difference of `0x80` or more means the target is ahead in the increasing direction, so the heading is increased, and a smaller difference means it is decreased. An exact half-turn difference (`0x80`) always resolves as an increase. There is no special case, no cap and no refusal anywhere in this law [code].

The step is **3** per frame, or **4** once the low digit of `ERA_INDEX 0xAD04` [seen] reaches 3, which is the last two eras. The turn rate is set by the era and nothing else: nothing on the player's path reads a difficulty setting [code]. The snap exists because 3 does not divide the 32-step spacing of the targets. A three-step turn from one facing to the next goes 32, 29, … 5, 2, and a difference of 2 is outside the one-step window, so the ship oversteps to one past the target and is snapped back the next frame. In frames, an eighth of a turn takes 12 at the slow rate and 8 at the fast rate, and a full reversal takes 44 and 32, about three quarters of a second in the first three eras and just over half a second in the last two [code].

This settles the outside-in question in gameplay.md of whether the ship can about-face: it **can reverse**, but never by flipping. A reversal is an ordinary turn through every heading in between; it is slow, not forbidden, and the direction of rotation is fixed when the stick is pulled exactly opposite [code]. Because the heading passes through all the intermediate values, the "many more facings while turning" described in gameplay.md are real headings: the sprite shows them at thirty-two-sector resolution, the world scroll follows every one of the 256 values (all of which were observed live), and shots leave along them (below) [seen].

### Speed and the world scroll

`scrollWorldAtTheEraPace` [seen] turns the heading into motion. It picks one of three velocity tables from `ERA_INDEX` alone: `OPENING_ERA_VELOCITY_TABLE 0x5E00` for era 0, the table at `0x2E3E` for eras 1 and 2, and `VELOCITY_TABLE_08FA 0x08FA` from era 3 up. `velocityForHeading` [seen] reads each table as 256 signed 16-bit samples indexed by the raw heading. The sample at the heading gives one component, and the sample a quarter-turn earlier gives the perpendicular one. The three tables are the same curve at three sizes, with peaks of 256, 306 and 331 [code]. Read in 1/256-pixel units per frame, the ship's speed is fixed within an era and steps up twice across the five: about 1, 1.2 and 1.29 pixels a frame [code]. Because the player's velocity *is* the camera, raising it speeds up the entire world.

`negateVelocityIntoWorldScrollThenDressSprite` [seen] negates both components and stores them as this frame's world motion: the heading-aligned component in `WORLD_SCROLL_Y 0xA808` [seen] and the perpendicular one in `WORLD_SCROLL_X 0xA80A` [seen]. It then calls `dressPlayerSpriteForHeading`. Heading `0x00` puts the whole velocity on the first component, heading `0x40` on the second. Everything else that should appear to hold its place in the sky reads this pair. The scenery drifters (`driftWithWorldScroll` [seen], `driftAtHalfWorldScroll` [seen], `driftAtThreeQuartersWorldScroll` [seen], `driftAtFiveQuartersWorldScroll` [seen]) move at fractions and multiples of it, which is where the parallax comes from.

Composed with the screen rotation measured in §3, the world-scroll pair traces a circle round the heading with no residual reaching a tenth of a pixel, and the player's direction of travel on the glass is:

| heading | the player travels |
|---|---|
| `0x00` | LEFT |
| `0x40` | DOWN |
| `0x80` | RIGHT |
| `0xC0` | UP |

So the heading byte increases **counter-clockwise on the glass**, and every round starts with the ship travelling right [seen]. ★ This is the direction of *travel* and nothing more. That the ship's nose is drawn pointing the same way is a separate claim about the shape table, and it has not been measured.

The velocity tables are not computed. A rounded cosine of the same peak disagrees with the ROM at almost every index; each table is a monotone quarter-wave whose differences run one step near one axis and eight near the other, mirrored and negated into the other quadrants, a drawn circle rather than a calculated one [code]. Its small defects sit at the same indices in all three tables, so they were made once and scaled. Samples are duplicated at several places (`0x3F`/`0x40`, `0x62`/`0x63`, `0x7F`/`0x80`, `0xBF`/`0xC0`, `0xD2`/`0xD3`), making adjacent headings identical, and the sample at `0x43` is zero where its neighbours (`−16` and `−32` at the opening size) call for about `−24`. That zero costs almost no speed but rotates the direction, so a heading turning steadily through that sample steps backwards and then forwards again [code]. Nothing here claims a player can see it.

The heading also reaches outside the ship. `driveEnemyWaveForLifePhase` [seen] biases its wave shapes by the heading's sixteenth-sector and aims relative to it. `spawnAtEdgeAhead` [seen] picks its edge spawn point from the heading sector. Enemies are placed relative to the direction the player is flying [code]. And `layOutEnemyAimPointsFromScrollAngle` [seen] builds a block of six aim points around the ship. Working from the record base `ENEMY_AIM_ANCHOR_Y 0xAC64` [seen], it takes the doubled opening-era velocity for the heading and for the heading a quarter-turn on, scales each to two lengths, and adds them to the centre (`0x78`, `0x84`), which is the ship's own pinned position. The result is two points straight along the direction of travel and four abeam, two on each side, each set at distances of about `0x10` and `0x20` pixels, written over `0xAC74`–`0xAC7F` [code]. Under MAME the block was watched being rewritten continuously, with every pair sitting around that centre at those two radii [seen]. The enemy steerers read it: `flyTowardShipStandoffThenEndApproach` [seen] aims a craft at `ENEMY_STANDOFF_AIM_SET 0xAC75` [seen] or `ENEMY_STANDOFF_AIM_CLEAR 0xAC79` [seen] (the abeam points on either side) by a selector bit in the craft's record; the chase steerer, the era spawners and the Mother-Ship stepper read `ENEMY_STANDOFF_AIM_MAIN 0xAC7F` [seen], the far point ahead; and the re-aim pass indexes `ENEMY_AIM_POINT_TABLE 0xAC65` [seen] by twice a craft's state byte [code]. The points stand *off* the ship, not on it. No run has watched an enemy steer to one, so "aims at the player" is a code reading. The details belong to the enemy sections.

### Firing

Shots are handled by `fireAndSweepPlayerShots` [seen]. It runs after the ship, so the heading and world scroll it reads are this frame's. It has two halves: *maybe seed a new shot*, then *move every live shot*.

**Seeding** is attempted only while the ship is whole (`PLAYER_STATE` = `0xFF`) and `ROUND_TRANSITION_HOLD` is zero. The hold is raised by the Mother-Ship's stepping, behind `armMotherShipOrStep` [seen], and by `stepMotherShipWarpFlashFrame` [seen] as the round winds toward the time warp, so the fire button goes dead once the round is won [code]. Inside that gate, the fire bit (bit 4 of the panel) is shifted into `FIRE_BUTTON_EDGE_SHIFT`. When its low two bits read `01` (released last frame, pressed this frame), `SHOT_BURST_PENDING` is loaded with **3**. Holding the button leaves the history saturated and makes no new edge, so a burst needs a release and a fresh press; a new press during a burst reloads the count to 3 [code]. In a real game (`PLAY_ACTIVE` set) nothing is seeded while `SHOT_BURST_PENDING` is zero, but **the demo skips this test**, so the autopilot fires whenever the cooldown allows [code]. Nothing is seeded while `SHOT_SPAWN_COOLDOWN 0xAA82` [seen] is nonzero. Otherwise the first free slot is taken, a free slot being one whose head byte is zero; if all six slots are busy, the pending count waits for one to free.

Seeding a shot requests the shot sound through `requestPlayerShotSound` [seen], which queues the code stored at `PLAYER_SHOT_SOUND 0x3270` (dropped in attract unless demo sounds are on); then the seeder sets the cooldown to 6 and takes one off the pending count. The sweep that follows in the same frame winds the cooldown down once per frame, so shots leave at most one every six frames, and the three shots of a burst span thirteen frames [code]. Together these reproduce, from the code, the "three-shot burst per press, release to fire again" that gameplay.md reports from a single source [code].

The shot bank is `PLAYER_SHOT_ARRAY 0xAA80` [seen]: six sixteen-byte records, which is the hard ceiling on shots in the air. `freeAllShotSlots` clears it at round start by zeroing each slot's head byte and fifth byte. In a record, the head byte (+0) is `0x00` for a free slot, `0xFF` for a live shot and `0xF0` for a destroyed one. Two 16-bit positions sit at +3 and +5, with their whole-pixel parts in the high bytes at +4 and +6. Two 16-bit per-frame steps sit at +10 and +12. The burst count `0xAA81` and the cooldown `0xAA82` are bytes +1 and +2 of the first slot's own record [code].

A new shot's two **step** words are four times the ship's velocity, written as −4 × each world-scroll component, so a shot's direction carries the full 256-step heading. Its **starting position** comes from a 32-entry word table at `PLAYER_SHOT_VELOCITY_TABLE 0x2771`, indexed by the heading's thirty-two-sector number (the same rounding the sprite uses), with the two bytes of the entry going into the whole-pixel bytes at +4 and +6. **Despite that table's name, what the code does with it is set a position, not a velocity.** Its entries trace a ring of radius 6 pixels round (`0x78`, `0x84`), the ship's own sprite position, and the entry for each sector lies on the side the ship is travelling toward; the shot starts just off the ship in its direction of travel [code].

**Sweeping** moves each live slot by its step plus this frame's world scroll, *per axis*. On screen that is 4 × ship velocity − 1 × ship velocity: the shot pulls away from the ship at three times the ship's speed, so shots too speed up with the era [code]. Because the world-scroll term is re-read every frame while the step was fixed when the shot left, a shot keeps its own course through the sky when the ship turns after firing; only its apparent drift on screen changes [code]. There is no lifetime. A shot is culled when its first axis's whole part reaches `0xF0` or more, when its second axis's whole part falls in `0xF8`–`0x0F` (it has left the field), or when its head byte is anything other than `0xFF`. The last rule clears a shot that a collision has marked `0xF0` on the frame after it hits. Culling zeroes the head and both whole-pixel bytes [code]. A surviving shot is not a sprite. `queueTileStampForObject` [seen] turns its two whole-pixel coordinates into a two-by-two block of pre-shifted character tiles and queues them on the deferred character-write list, so **player shots are drawn in the character plane** [code].

Shots hit things in the era's collision pass (`dispatchCollisionPassByEra` [seen]). `stagePlayerShotSweepAgainstTargetsAndRun` [seen] and `dispatchShotSweepByMotherShipArmed` [seen] hand the six shots to `destroyTargetsHitByShots` [code], or to `destroyCraftAndMotherShipHitByShots` [seen] while `MOTHER_SHIP_ARMED 0xAD0D` [seen] is set. Only a target on the screen can be hit. A live shot and a live craft collide when the shot's whole-pixel bytes (+6 against the target's X, +4 against its Y) lie within a 15-wide box of −7…+7 on both axes; the Mother-Ship is tested with windows of its own. Both then take `0xF0`, and `postChainedHitScore` [seen] pays for the kill. The sweep does not stop at the first hit, so one shot can take several targets in one pass [code].

### Being hit, and the explosion

The same collision pass tests the ship itself, but only while `PLAYER_STATE` reads `0xFF`. `destroyPlayerAndObjectsTouchingIt` [seen], `destroySlotsAndPlayerOnContact` [seen], `ramTestPlayerVsMotherShip` [seen] with its wider arm `destroyPlayerAndMotherShipOnContact` [seen], `destroyFixedTargetReachedByPlayer` [code] and `destroyTargetsReachedByFixedAttacker` [seen] each compare the ship's sprite position (`PLAYER_ENTRY`, `PLAYER_SPRITE_Y`) with a run of objects inside a box, and each writes `0xF0` into `PLAYER_STATE` on contact. All of them except `destroyPlayerAndObjectsTouchingIt` also post the hit score for what the ship collided with, so the code agrees with gameplay.md's single-source claim that dying by collision still scores [code]. The last test of the pass, `markObjectsTouchingPlayer` [seen], is the one that does *not* hurt the ship. With a count of one it lands on `PARACHUTIST_RECORD 0xA8F0` [seen], and inside a ±8 box it marks the parachutist `0xF0` while the ship stays whole. This is how the ship collects a parachutist by flying into it [code].

★ `PLAYER_STATE` is one byte doing two jobs. The dispatcher reads it as a three-way selector (`0`, `0xFF`, anything else), and the explosion reads the same byte as its phase and counts it down. It is a counter, not a static mode flag. The count never runs back up to `0xFF` on its own, because the dispatcher stops calling the explosion once the byte reaches zero; the whole value `0xFF` is set only by the round reset [code].

With the state at `0xF0`, the next frame's dispatch hands the record to `advancePlayerAnimationStrip` [seen]. On its first frame the value is at or above `0xB4`, so it is clamped to `0xB4`. The sprite-shape byte beside the entry (`PLAYER_SPRITE_CODE`) is set to `0xFF`, taking the ship's sprite away. The sound requests go out: `requestRoundIntroSoundBurst` [seen] always, and `requestLateEraProgressSound` [seen] as well once `ERA_INDEX` is 2 or more.

From then on the byte drops by one every frame. On seven keyframes (`0xB3`, one below the cap, then `0xAB`, `0xA3`, `0x9B`, `0x93`, `0x8B`, `0x83`, eight frames apart) a picture is copied into the character plane over the ship's fixed position. The strips are `PLAYER_ANIM_STRIP_0` through `PLAYER_ANIM_STRIP_4` (`0x1F76`–`0x1FEE`), shown in the order 0, 1, 2, 3, 3, 2, 4, so the fireball grows and then subsides. Between keyframes nothing is drawn [code]. Each keyframe is blitted tile by tile from `PLAYER_ANIM_VRAM_BASE 0xA5AF`, row 13 column 15: the row count (6) and tiles per row (5) are read from fixed program bytes at `PLAYER_ANIM_ROW_COUNT 0x337A` and `PLAYER_ANIM_COL_COUNT 0x4902`, and the cursor steps `0x1B` from the end of one row to the start of the next. Each tile write is paired with a colour write to the same address with bit 2 of its high byte cleared, `0x400` below in the colour plane, and every tile takes the one colour `ERA_INDEX + 0xC1`, so the explosion is tinted by era [code]. From `0xB4` down to zero is 180 frames, and when the byte reaches zero the round service's closing test sees a dead ship and calls `loseLifeAndHandOver` [seen], which charges the life and passes the turn (see the lives-and-turns section) [code].

The explosion has a tamper check built into its first frame. After the sound requests it samples `TAMPER_GLYPH_STRIP 0xABFE` [seen] and `TAMPER_COLOUR_STRIP 0xABFF` [seen], which must read `0xA5` and one of `0x05`/`0x10`. On any other value the frame hands the byte it read to the stick-direction table at `0x1F2E` and runs those bytes as instructions (`loc_1f2e` [code]) instead of counting down. On a genuine image this never happens [code].

The same round service also resolves a **living** ship. When `PLAYER_STATE` is still `0xFF` at the end of the frame it calls `advanceRoundWhenFieldCleared` [code]. A state strictly between the two is left for the explosion to finish.

### The ship at round start

Before the ship is handed to the player, `stepRoundStartIntroAnimation` [code] (sub-step 14 of the round engine) animates the ship's sprite while the character-plane bands build. It acts only on frames where bit 1 of `FRAME_TICK 0xA980` [seen] is clear, and its step cell `INTRO_ANIMATION_STEP 0xA9F0` [code] picks the arm.

In steps 0 and 1, `flashPlayerWhiteEveryOtherFrame` [seen] alternates the ship's colour field between 62 and 0 on the low bit of `PLAYER_FLASH_TICK 0xA9F1` [code], leaving the two mirror bits alone. When the tick reads 8 it sets the step to 1 and calls `requestPlayerSpawnFlashSound` [code], which queues the sound code at `PLAYER_SPAWN_FLASH_SOUND 0x07A9` only in a real game. In step 2, `cyclePlayerSpriteColourThenAdvanceStepAtZero` [code] swaps the colour between 63 and 55 on bit 2 of `SPRITE_COLOUR_CYCLE_COUNTDOWN 0xA9F3` [code], so the colour holds four ticks at a time, and it moves the step to 3 when it finds the count at zero. The final arm seats a delay of 90, hides every sprite, loads the active player's context and sends the sequence back to sub-step 3, from which the round-start arm and its playfield reset follow.

### The demo autopilot

The attract demo flies the real round engine with `PLAY_ACTIVE` clear, so the ship is flown by a script rather than a recording. `verifyImageSignatureThenStartAttractDemoOrDerail` [code] starts it. On a genuine image it parks the caption sprites and seeds the script, then clears `TWO_PLAYER_GAME 0xAD31` [code], `PLAYER_TWO_LIVES 0xAD20` [seen], `PLAY_ACTIVE` and the sequence sub-step. It gives `PLAYER_ONE_LIVES 0xAD10` [seen] a single life and sets `SEQUENCE_PHASE 0xA9AB` [seen] to 3, the round engine. The demo is one life, one player [code].

`seedDemoAutopilotScript` [seen] chooses one of three heading scripts using `PLAYER_ONE_ERA_INDEX 0xAD14` [seen] as the selector: `DEMO_AUTOPILOT_SCRIPT_FIRST 0x218C` for selector 0 or 3, `DEMO_AUTOPILOT_SCRIPT_SECOND 0x2251` for selector 1, and `DEMO_AUTOPILOT_SCRIPT_THIRD 0x22FA` otherwise. The selector is read before the round arm moves the demo on: `armRoundStartThenStepSequence` then advances the demo's era through 1, 2, 3 and round again. So while demos run back to back each demo era has its own script, the first script flying era 1, the second era 2 and the third era 3 [code]. The seeder seats `DEMO_SCRIPT_DWELL 0xADF2` [code] at the script's first byte plus one, and `DEMO_SCRIPT_POINTER_LO/HI 0xADF3/0xADF4` [code] at the script's address. It also checks two tile-readback cells: `TAMPER_GLYPH_READBACK 0xADFB` [seen] must be `0xFD` and `TAMPER_COLOUR_READBACK 0xADFC` [seen] must be `0x10` or `0x05`. A mismatch sends it into the second script's bytes run as code; a genuine image returns normally [code].

Each script byte is a command. Its top two bits are the turn and its low six bits the number of frames it lasts. Each frame, `flyDemoShipByScript` [seen] counts `DEMO_SCRIPT_DWELL` down while its low six bits are above 1. When they are spent it steps the pointer, loads the next byte plus one, and looks again, so spent or zero-length entries are skipped in the same frame and a byte with low six bits *n* steers for *n* frames. The surviving command then acts: top bits `00` fly straight, `01` take **3** off the heading, and `10` or `11` add **3**. The frame then falls into the same world-scroll tail as a real player [code]. The demo never reads the stick table and never snaps, so its heading drifts through arbitrary values, and its turn rate is 3 in every era.

All three scripts open with four `0x3C` bytes, about four seconds of straight flight (60 frames each), before the manoeuvres begin [code]. The fire gate's demo exemption means the autopilot shoots continuously at the six-frame rate for as long as it flies [code]. When the demo's round ends, the attract branch of `advanceRoundWhenFieldCleared` sends the sequence back to attract rather than on to a next round [code].

## §6 Killing, and being killed

Everything that can die in Time Pilot lives in a fixed set of sixteen-byte object records. That covers the player's ship, the era's fighters, their bullets, bombs and missiles, the 1940 bomber, the parachutists and the Mother-Ship. The records run from ACTOR_RECORD_SLOT0 0xA810 [seen] to PARACHUTIST_RECORD 0xA8F0 [seen], and each one is paired with a two-byte sprite entry whose two coordinates sit 49 bytes apart in parallel tables. The lead byte of every record is its state, and the whole business of killing is written in that byte. 0xFF means live, 0x00 means the slot is free, and 0xFE means a craft is being held back before it is released. A collision stamps 0xF0 into both parties. On its next turn, each object's own per-frame handler sees the 0xF0 and plays the death its class calls for, counting its state down to zero and then retiring the slot. The collision code itself never animates or removes anything, and it requests no sound. It only marks, and it pays out score. Everything else happens in the victim's handler a frame later.

So a kill is **paid in two places at two times** [code]. The score is posted when the collision is found. The death sound, and for an enemy craft the tick off the kill quota, come on the next frame, when the handler finds the mark.

One consequence is a warning for anyone reading or instrumenting this machine: **there is no single "kill routine."** About ten separate contact tests exist. They share one marker but not one body, and the two biggest targets, the Mother-Ship and the 1940 bomber, are reached only by tests of their own. Watching one sweep will under-count the kills [code].

The records group by class. The four at ACTOR_RECORD_SLOT0 0xA810 to 0xA840 hold enemy bullets. The seven from CRAFT_RECORD_SLOT0 0xA850 [seen] to CRAFT_RECORD_SLOT6 0xA8B0 [seen] hold enemy craft. The fifth and sixth of those seven, MOTHER_SHIP_STATE 0xA8A0 [seen] and 0xA8B0, are also where the Mother-Ship rides while it is up. The three era-object records, ERA_OBJECT_RECORD_SLOT0 0xA8C0 [seen] to ERA_OBJECT_RECORD_SLOT2 0xA8E0 [code], hold whatever the era's special weapon is, and that changes with the era. They hold bombs in 1910, the bomber and its shot in 1940, missiles in 1970 and 1982, and alien shots in 2001. So calling this bank "the projectile bank" would fit only some eras. PARACHUTIST_RECORD 0xA8F0 holds the single parachutist. The player's own record is PLAYER_STATE 0xA800 [seen], with its sprite entry at PLAYER_ENTRY 0xAA10 [seen] and PLAYER_SPRITE_Y 0xAA41 [seen]. Its six shots live at PLAYER_SHOT_ARRAY 0xAA80 [seen].

Byte 0x0F of every record holds that slot's ordinal. Each playfield reset stamps these ordinals from 1 at 0xA810 upward, so the craft are numbered 5 to 11. Several mechanisms below use that ordinal as a per-slot phase key [code].

### The frame's collision pass

The round engine, serviceRoundThenResolvePlayerState (0x1199) [seen], moves everything first and tests for contact afterwards. In order, it:

- steps the player;
- fires and moves the shots;
- runs the formation spawner and the parachutist;
- steps the Mother-Ship, then the seven craft;
- runs the era's weapon bank, the bomber and its shot, the four bullets and the 1910 bomb bank.

Only then does it call dispatchCollisionPassByEra (0x4E4F) [seen]. After the collisions it runs the extra-life check, runs the hit-chain timer down, lets the difficulty rung escalate and repaints the kill meter. Last, it decides between advancing the round and taking a life.

The collision work is split across two frames by the low bit of FRAME_TICK 0xA980 [seen]. Because that tick advances once per vertical blank, the two halves genuinely alternate and neither runs twice in a frame. The fork is on the era in ERA_INDEX 0xAD04 [seen] first, and on parity second:

- **1910, 1970 and 1982 (eras 0, 2 and 3).** Even frames run the full pass, runAllCollisionSweepsThisFrame (0x4E63) [seen]. Odd frames run dispatchShotSweepByMotherShipArmed (0x4F35) [seen], which tests the player's shots against the craft.
- **1940 (era 1).** splitCollisionWorkByFrameParity (0x4EBC) [seen] runs the same odd-frame shot sweep. Its even frame is a custom pass built around the bomber.
- **2001 (era 4).** dispatchEra4CollisionByFrameParity (0x4F2A) [seen] runs the full pass on even frames. On odd frames it tests the shots against a longer run that starts at the bullet records, so in this era the enemy bullets can be shot down. That run is nine records long while the Mother-Ship is armed, which covers the bullets and the first five craft, and eleven while it is not. When the ship is armed, a pass against the Mother-Ship follows.

The rule holds across all four branches: odd frames test the shots against targets, and even frames test the player against objects, with the even-frame chain opening on a shot sweep of its own.

The full pass works through a fixed order:

1. stagePlayerShotSweepAgainstTargetsAndRun (0x4F5D) [seen] tests the six shots against the three era-object records.
2. destroyPlayerAndObjectsTouchingIt (0x5185) [seen] tests the player against the four bullet records.
3. destroySlotsAndPlayerOnContact (0x5152) [seen] tests the player against the craft. It takes all seven records normally, but only the first five while the Mother-Ship is armed, and in that case ramTestPlayerVsMotherShip (0x50B1) [seen] adds a ram test against the ship itself.
4. destroyTargetsReachedByFixedAttacker (0x5121) [seen] tests the player against the three era-object records.
5. markObjectsTouchingPlayer (0x51B3) [seen] checks the one record left, the parachutist.

Each sweep hands its record and entry cursors to the next, so each one picks up where the last stopped. Laying out the record block in class order is what makes that chaining work.

The 1940 even-frame pass reorders all of this around the bomber:

1. destroyFixedTargetHitByShots (0x4F7E) [seen] tests the shots against the bomber in ERA_OBJECT_RECORD_SLOT0 0xA8C0 only.
2. The player is tested against the bullets, then the craft, then the Mother-Ship when it is armed.
3. destroyFixedTargetReachedByPlayer (0x507E) [code] tests the player against the bomber.
4. The player is tested against the single record at ERA_OBJECT_RECORD_SLOT2 0xA8E0, which holds the bomber's own shot. Like a bullet contact, this one pays nothing.
5. The parachutist check comes last.

In 1940 the shots never test ERA_OBJECT_RECORD_SLOT2 or the bullet records, so in that era the bomber's shot and the fighters' bullets cannot be shot down [code].

### What each sweep tests, and which contacts pay

Every test has the same form. Both parties must read live (0xFF). On each axis the two coordinates are subtracted as bytes, so the distance wraps at 256, and a slack is added. The result must then fall inside a window. The windows differ by pairing:

- **Shots against craft, bullets and era objects** (destroyTargetsHitByShots, 0x5211) [code]. The box is fifteen units square. A target is skipped if either of its coordinates lies in the narrow band around zero that a retired or unplaced slot leaves behind. A shot that hits is spent, but the sweep goes on testing that same shot against the rest of the run in the same pass. One shot can therefore take several targets, and each one is paid for. Between shots, the target cursors are reloaded from SCRATCH_PTR_A 0xA991 [seen] and SCRATCH_PTR_B 0xA993 [seen], so every shot is tested against the same run. That pair is the game's general-purpose scratch cursor pair, and which of the two holds the record and which the entry is not fixed. The shot sweeps put the record in SCRATCH_PTR_B, while the launchers below put it in SCRATCH_PTR_A. The names say where each pointer is stored, not what it holds [code].
- **Shots against the Mother-Ship** (destroyCraftAndMotherShipHitByShots, 0x4FBF [seen]; destroyMotherShipAndShotOnMutualHit, 0x4FE0 [seen]). The first routine also runs the five-craft shot sweep. The ship's position is read from MOTHER_SHIP_ENTRY 0xAA24 [seen] and MOTHER_SHIP_SPRITE_Y 0xAA55 [seen]. The box is thirteen units wide, or seventeen in 1910 and 2001 where the ship is drawn wider. It is thirty-one tall and sits off-centre along that axis. The box is fixed and never turns with the ship's heading, so a hit counts from any angle.
- **Shots against the bomber** (destroyFixedTargetHitByShots) [seen]. The box is thirteen wide by thirty-one tall, tested against ERA_OBJECT_ENTRY_SLOT0 0xAA28 [seen] and ERA_OBJECT_SPRITE_Y_SLOT0 0xAA59 [seen]. The routine reads the bomber's state once, before the sweep. If the bomber is not live it takes no shot at all.
- **Player against bullets** (destroyPlayerAndObjectsTouchingIt) [seen]. This is the tightest box, eleven square. It marks the player and the bullet and posts **no score**.
- **Player against craft** (destroySlotsAndPlayerOnContact) [seen]. The box is fifteen by seventeen. It marks both parties and **does** post score. The sweep does not stop at the first contact, so ramming two craft in one frame pays for both.
- **Player against era objects** (destroyTargetsReachedByFixedAttacker) [seen]. The box is thirteen square, and a contact **pays**. So ramming a bomb, missile or alien shot scores, although ramming a bullet does not.
- **Player against the Mother-Ship** (ramTestPlayerVsMotherShip [seen]; destroyPlayerAndMotherShipOnContact, 0x50EE [seen]). The era is the only thing that changes here. The two arms are identical except that one axis of the box is seventeen wide in 1910 and 2001 and thirteen in the middle three eras, so this is one hitbox at two widths. The other axis is thirty-five tall. Contact marks both, **zeroes MOTHER_SHIP_HOLD_COUNTER 0xA8A4** [seen] and pays.
- **Player against the bomber** (destroyFixedTargetReachedByPlayer) [code]. The box is thirteen wide by thirty-three tall. Contact marks both, **zeroes HITS_REMAINING 0xA8DC** [seen] and pays.
- **Player against the parachutist** (markObjectsTouchingPlayer) [seen]. The box is seventeen square. Only the parachutist is marked (0xF0). The player is left untouched and nothing is scored here, because this is a rescue and not a collision.

The single-target shot tests against the bomber and the Mother-Ship keep sweeping after the target is marked. Several shots inside the box in one pass are therefore all spent, and each one pays the chain score. The target's own handler, though, sees a single 0xF0 on its next turn and takes off only one hit [code].

Because the two ram tests zero the hit counters, ramming either multi-hit target kills it outright, however many hits it had left. Ramming an ordinary craft counts as a kill and scores exactly as a shot would. This matches gameplay.md's single-source claim that "collision still scores" [code].

### Scoring a hit: the chain

Every contact that pays calls postChainedHitScore (0x51DE) [seen]. It does not post a fixed 100. Instead it posts awards from an eight-step climbing chain:

- If CHAIN_WINDOW 0xA99D [seen] has run down to zero, the call posts award 1.
- Otherwise it steps CHAIN_STEP 0xA99E [seen] and posts award (step mod 8) + 1.

Either way the window is reloaded to 30 frames. On every round-engine frame, expireHitChain (0x5205) [seen] counts the window down, and once it reads zero it holds CHAIN_STEP at zero.

The award goes onto the command ring as command 4, and the command table routes that to awardScoreToPlayer (0x0C90) [seen]. That routine adds the three-byte packed-decimal entry at SCORE_AWARD_TABLE 0x0D27 [code] to the active player's score. Entries 1 to 9 are 100 to 900. Entries 10 to 15 are 1,000, 1,500, 2,000, 3,000, 4,000 and 5,000. An isolated kill therefore scores 100. Kills that land within half a second of each other climb to 200, 300 and so on up to 800, then wrap back to 100 [code]. The same routine copies the score into the high score when it overtakes it. A zero argument repaints the score labels instead. Nothing happens at all while PLAY_ACTIVE 0xAD30 [seen] is clear, so the attract demo never scores.

### Enemy craft, era by era

stepSevenCraftSlots (0x28A1) [seen] steps the seven craft records in a fixed order. For each record, dispatchSeatedSlotByEraIndex (0x290E) [seen] picks one of five per-era handlers from the word table at ERA_SLOT_DISPATCH_TABLE 0x2914 [code].

The stepper enters all seven workers on every frame, even while MOTHER_SHIP_ARMED 0xAD0D [seen] is set. The last two workers, seatMotherShipSlotThenDispatchByEraUnlessArmed (0x28EE) [seen] and seatCraftSlot6ThenDispatchByEraUnlessArmed (0x28FE) [seen], each test that flag themselves and return at once, because those two records now belong to the Mother-Ship. So "five of the seven slots exist while it is up" describes the slots, not the stepper [seen]. A description or rewrite in which the stepper itself skips two workers does not match this ROM, even if the memory left behind would look the same.

All five handlers branch on the state byte in the same way:

- **0x00.** Nothing happens.
- **0xFE.** The held craft ticks its release delay in record byte 0x0E down. When the delay runs out, releaseHeldObject (0x2B52) [seen] steps the state to 0xFF and reloads the delay with 128.
- **Any value other than 0xFF.** The craft is dying (see "How a craft dies" below).
- **0xFF.** The craft turns toward its aim heading and flies. It is retired if it has reached the retire line (hasReachedRetireLine, 0x2B83 [seen]: a column and a row near the field's edge). If it is still in play, it gets one chance to fire.

The eras differ in how a live craft flies and what it can fire:

- **1910 biplanes** (serviceEra0EnemyCraftSlot, 0x2927) [seen]. They turn every frame and fly at the slowest table speed. On its turn a biplane may fire a bullet and may also throw a bomb.
- **1940 monoplanes** (serviceEra1EnemyCraftSlot, 0x294C) [code]. They fly on the opening-era pace table and fire bullets only. They cannot throw bombs, because the 1940 era-object records belong to the bomber.
- **1970 helicopters** (serviceEra2EnemyCraftSlot, 0x2984) [seen]. They turn on only three frames in four, fly at the slowest speed and are drawn with fine heading steps. They fire bullets and launch missiles.
- **1982 jets** (serviceEra3EnemyCraftSlot, 0x29B0) [seen]. They fly on a pace table of their own and are drawn with coarse heading steps. They fire bullets and launch missiles.
- **2001 saucers** (serviceEra4EnemyCraftSlot, 0x29D5) [seen]. They steer through steerEnemyTowardShip (0x29F7) [seen], which borrows the 1910 turn rate while the saucer's row lies within a wide band around the player's screen lines. On bit 1 of the frame tick they alternate between double the slowest speed and a second pace table, and they cycle a spinning shape. They fire bullets and launch alien shots.

Right after the saucer's steering code sits a short block that re-arms a craft from a hit counter in its record byte 4. It also calls the kill routine countTheKillAndGrantTheSharedToken on each absorbed hit, and it rewrites ERA_INDEX. No jump or call anywhere in the program targets it, so it is treated as unreached [code].

**Bullets.** launchBankEnemyWhenAimedNearPlayer (0x3ED6) [seen] fires them. Each craft gets its own turn, one frame in eight: its ordinal in record byte 0x0F must equal FRAME_TICK's low three bits plus five. A bullet also needs all of the following:

- BANK_LAUNCH_COOLDOWN 0xA817 [seen] must be clear. The vertical-blank service counts it down once a frame.
- A free record must exist among the first BANK_LAUNCH_SLOT_COUNT 0xA844 [seen] bullet records.
- The craft must be outside a window of half-width BANK_LAUNCH_NEAR_HALF_Y 0xA827 [seen] around the player's fixed screen point (0x84, 0x78) on at least one axis. Craft at point-blank range therefore do not fire.
- The craft's own heading must be within BANK_LAUNCH_NEAR_HALF_X 0xA837 [seen] of PLAYER_HEADING 0xA802 [seen].
- The heading from the craft toward the aim point ENEMY_STANDOFF_AIM_MAIN 0xAC7F [seen] must be within a sixteenth of a turn of its own heading.

The routine also carries a third window test, on ATTACKER_SPAWN_AIM_WINDOW_HALF. That test is guarded by a comparison of the entry pointer's page against a value the page never holds, so it can never run [code].

The bullet starts at the craft's position, with a velocity looked up from the aim through one table in 1910 and another in every later era. The cooldown then reloads from BANK_LAUNCH_COOLDOWN_PERIOD 0xA814 [seen]. stepFourActorSlots (0x3E36) [seen] flies each bullet in a straight line through dispatchObjectSlotByHeadByte (0x3E63) [seen] and flyAndRetireSlotCyclingShapeInEra4 (0x3E6C) [seen], and only in 2001 does a bullet cycle its shape. A bullet whose state is not 0xFF is handled by runSlotCountdownDriftAndAnimateElseRetire (0x3E8E) [seen]. Outside 2001 a marked bullet is simply retired on the spot. In 2001 it plays an eight-shape explosion first.

**Bombs, missiles and alien shots.** launchAttackerIntoFreeSlot (0x4243) [seen] launches these into the era-object records, using the same one-turn-in-eight key. It is gated by three things:

- ATTACKER_SPAWN_COOLDOWN 0xA8F4 [seen]. Unlike the bullet cooldown, this one is counted down by the launcher itself, one step on each turn that finds it non-zero, rather than once a frame [code].
- ATTACKER_SPAWN_SLOT_COUNT 0xA8C6 [seen].
- A clearance window of ATTACKER_SPAWN_WINDOW_HALF 0xA8D6 [seen] around the player's screen point.

commissionStagedAttackerByEra (0x42B7) [seen] then copies the craft's position into the new record and sets up the era's weapon:

- **1910.** The launch first passes through setTheLaunchFacingInsideOneAimWindow (0x429C) [seen]. The bomb is thrown only while the biplane is inside a column of half-width ATTACKER_SPAWN_AIM_WINDOW_HALF 0xA8E6 [seen] around the player. It is thrown toward whichever side of the player the biplane is on. flyAlongBallisticArc (0x4017) [seen] then gives it a constant sideways step, plus a speed on the other axis that starts at −256 and grows by 9 every frame. That is the thrown-up-then-falling arc gameplay.md describes. serviceEra0BallisticObjectBank (0x3FEA) [seen] runs the three bomb records.
- **1970.** The missile is aimed at the aim point but launched a quarter-turn off that line. The low bit of the slot's ordinal picks which side.
- **1982.** The missile is launched a fixed step to one side of the jet's facing, flies straight for 32 frames, and then homes.
- **2001.** The alien shot is aimed straight at the aim point, with an approach countdown seeded from ATTACKER_SPAWN_AIM_WINDOW_HALF.

Each era's arm over this bank is itself gated on the era. serviceEra0BallisticObjectBank returns outside 1910, serviceEra1BomberObject outside 1940, and sweepEra2PlusObjectBank (0x40D6) [seen] below 1970. Which handler drives the bank is therefore decided by ERA_INDEX alone [code].

From 1970 on, sweepEra2PlusObjectBank runs the records one at a time through serviceSlotByMarkerThenCloseSweepTurn (0x40EA) [code]. stepCountdownSlotThenCloseTurn (0x4108) [code] is a second entry that runs the dying step for one record and closes its turn. closeOneTurnOfTheSlotSweep (0x410B) [code] moves on to the next record. A live record is handled in one of three ways:

- A live missile whose record byte 0x0E is still counting flies straight and ticks the count (flyLiveSlotAndTickCountdown, 0x418B) [seen].
- Once that count is spent, the missile homes (chaseOneAimPointAndRetireAtTheLine, 0x4117) [seen]. It re-aims at ENEMY_STANDOFF_AIM_MAIN only on the one frame in sixteen that matches its ordinal, turns one unit a frame and flies at double speed.
- In 2001 the shot runs stepSlotApproachThenBreakawayRetire (0x4194) [seen] instead. It closes on the player while its approach countdown runs, then breaks away at double speed.

The straight bullet and the bending shot are the two alien weapons gameplay.md describes.

A marked bomb or missile does not count as a kill. Its handler turns the mark into 0x3B, requests one sound, and plays a short explosion drawn from era-specific frame tables while it drifts with the world until it retires. In 1910 that handler is runOneShotAnimatedObjectSlot (0x406C) [seen], and in later eras it is stepDriftingCountdownObjectByEraFrames (0x413C) [seen].

### How a craft dies, and the kill count

When a craft's handler finds a state that is neither 0xFF, 0xFE nor 0x00, it runs stepDyingObjectState (0x2B93) [seen]. The death has three parts:

1. **The kill.** On the frame it finds 0xF0, the handler re-stamps the state to 0x3B and calls countTheKillAndGrantTheSharedToken (0x2BBA) [seen]. That routine requests the two death sounds and decrements KILLS_REMAINING 0xAD02 [code], stopping at zero. A state of exactly 0x3C also counts a kill, which matters for the Mother-Ship's staggered field clear below. A state above 0x3C is simply counted down while the craft flies on at the slowest speed, still looking like itself.
2. **The fall.** While the state is 0x20 or more, the wreck keeps flying at the slowest speed. Below 0x20 it only drifts with the world. ★ **The countdown is shorter than the state value suggests.** Above 0x20 the state is decremented *twice* a frame: once by stepDyingObjectState, and again by moveObjectByStateByteThenRunAppearance (0x2C22) [seen] through decrementObjectStateThenFlyAtSlowestSpeed (0x2BB4) [seen]. Below 0x20 it drops once a frame. The state therefore falls below 10, where the appearance step retires an ordinary craft, about thirty-six frames after the kill, and reaches zero after about forty-five for a craft holding the formation claim; neither is the fifty-nine the state value suggests. Reading the state byte as a frame count overstates the explosion [code].
3. **The appearance.** driveObjectAppearanceByPhaseBand (0x2C31) [seen] picks the look from the same byte. At 42 and above the sprite keeps its shape and cycles sixteen tints. From 10 to 41 it steps through a run of explosion shapes, each held for two state values. Below 10 the slot is retired at once, unless the craft holds the formation claim (see the next section).

Only these craft deaths reduce KILLS_REMAINING. Bombs, missiles, bullets, the bomber, the Mother-Ship and parachutists never touch it [code]. Shooting a projectile still **scores**, but it does not move the meter. This answers one of gameplay.md's open questions: the 1940 bomber does not advance the counter.

### Formations and the 2,000 bonus

driveEnemyWaveForLifePhase (0x36AF) [seen] feeds craft into the band in two ways, depending on the phase in the low nibble of LIFE_TICKS_MID. The spawners work only while ROUND_TRANSITION_HOLD 0xACC6 [code] is clear.

In the early phases the ordinary spawners place single craft:

- In phases 0 to 6, gateTheFreeSlotSearchAndPickItsRun (0x37BD) [seen] runs.
- In phase 8, spawnEnemyCraftWhenBandUnderTwo (0x379F) [seen] runs. It acts only while fewer than two of the seven craft records are occupied, which keeps a thin trickle rather than a swarm.

Both act only when LIFE_TICKS_LOW reads 0x00 or 0x30. Both hand a downward free-slot search to spawnEnemyIntoFreeSlotElseStepSearch (0x37D6) [seen], which fills at most one record per call. The search starts at the last craft record and covers ROUND_CRAFT_COUNT 0xACC1 [code] records, or, once the kill quota is spent, five records counting down from the fifth. A new craft comes in live at the edge position that a table gives for the player's heading, jittered at random [code].

In the later phases, once LIFE_TICKS_LOW reads zero, the driver seats a whole formation at once from the rows at WAVE_DESCRIPTOR_TABLE 0x397B [code]. It walks the first ROUND_CRAFT_COUNT craft records, or the first five once the quota is spent, and fills every free one it finds. Each craft it places is held (0xFE) with a release delay taken from the descriptor, and every descriptor delay is non-zero. When the delay runs out, the release reloads record byte 0x0E with 128. That set top bit is what marks the craft as a formation member.

The spawner counts the craft it placed into WAVE_KILL_COUNTDOWN 0xA811 [code]. It then opens the claim window by writing 0xE4 into WAVE_CLAIM_TIMER 0xA812 [seen], which the vertical-blank service counts down once a frame, 228 frames in all. If the formation filled at least five records, the siren sounds (requestEnemyWaveSound, 0x5817 [seen]) and the countdown stands. If it filled fewer, the countdown is reset to ROUND_CRAFT_COUNT, and the siren sounds only if the formation still reached that many.

The bonus is paid through the same kill routine:

1. Each time a member dies while the claim window is still open, countTheKillAndGrantTheSharedToken decrements WAVE_KILL_COUNTDOWN. Every qualifying death counts, not only the last.
2. The kill that brings the countdown to zero writes that craft's ordinal, with the top bit set, into CLAIM_TOKEN 0xA821 [code].
3. When the claiming craft's death reaches the bottom band, it is not retired. It shows a fixed bonus sprite instead.
4. Its state then crawls down one step every eight frames.
5. On its last step it posts award 12, which is **2,000 points**, and clears the token.

So the code gives gameplay.md's rough "about three seconds" a concrete length of 228 frames [code].

In 2001 the craft come from spawnEnemyWaveIntoFreeSlots (0x386E) [seen] instead. Every frame it refills any free record among the first ROUND_CRAFT_COUNT, or the first five while the Mother-Ship is armed. It places the craft live with no membership bit, so 2001 has no formation bonus [code].

### The kill meter

drawKillMeter (0x0809) [seen] repaints the bar every round frame from KILLS_REMAINING:

- The era picks a ten-byte row from KILL_METER_GLYPH_ROW_TABLE 0x087C [code], holding two alternating bar glyphs and eight end glyphs.
- The number of bar cells is the count divided by four. They are laid from KILL_METER_BAR_START_CELL 0xA79F [code], 0x20 apart in video memory.
- The low three bits of the count pick the end glyph that caps the bar.
- One blank cell after the cap erases the cell the bar has just vacated.

The bar is longest at the start of a round, at 56/4 = 14 cells, and it shortens by one cell for every four kills. It measures kills *still owed*, not kills made.

The quota comes from KILL_QUOTA 0xA9CD [seen]. At boot that cell takes a single write, from DEFAULT_KILL_QUOTA 0x0874 [code], which holds 56. It is read by startNextRound (0x2DB8) [seen], which copies it into KILLS_REMAINING at every round, and by armRoundStartThenStepSequence at the start of a game. Nothing makes the quota depend on the era, the loop or a DIP switch, so it is 56 in every era of every loop. The harder later rounds the manual describes come from a different cell, the difficulty rung, so "harder" never means "more enemies to clear" [code].

The bar is also the whole answer to gameplay.md's "time bar" question. It is a direct rendering of the quota. **Nothing in this game times the player**, and the one source that calls it a time bar was watching the kill meter [code].

### The 1940 bomber

In 1940 the era-object records hold one large bomber. serviceEra1BomberObject (0x3B5F) [seen] runs it in ERA_OBJECT_RECORD_SLOT0 0xA8C0, and its second sprite tile borrows the next entry. Its hit counter HITS_REMAINING belongs to the era-object bank. The Mother-Ship's counter sits in a different record, so the two counters never touch [code].

**Spawning.** While the record is empty, armBomberSlotWhenTimerFires (0x3C25) [seen] ticks its delay in record byte 0x0E down on even frames. That delay is 128 at every playfield reset and after every retirement. When the delay fires, and only if the Mother-Ship is not armed, the bomber is placed at a position that HEADING_SHAPE_TABLE 0x3C84 [code] picks from the player's heading. The position is nudged when the heading lies near a horizontal or vertical. The bomber gets a left-or-right facing bit, a fixed velocity and **HITS_REMAINING 0xA8DC** [seen] set to three. If the Mother-Ship is armed at the moment the delay fires, the count has already reached zero, so it wraps and the next try comes 255 even frames later [code].

**Flight and fire.** advanceTwoTileObjectThenTryAimedSpawn (0x3B77) [seen] flies the bomber in a straight line and places its second tile sixteen units below the first. At the field edge it is retired (retireObjectAndHold, 0x3C0D) [seen]. Otherwise spawnAimedEnemyIntoEraBankWhenInWindow (0x3D25) [seen] lets it fire when one of its two tiles is outside the clearance window around the player's screen point and ATTACKER_SPAWN_COOLDOWN is clear. The shot is aimed at ENEMY_STANDOFF_AIM_MAIN and pushed alternately to either side by ATTACKER_SPAWN_AIM_SIDE_TOGGLE 0xA8D4 [seen]. It goes into ERA_OBJECT_RECORD_SLOT2 0xA8E0 or, failing that, the last bullet record. serviceFixedSlotInEra1 (0x3DDA) [seen] and serviceSlotByHeadByte (0x3DEB) [code] fly that shot straight and retire it at the line or as soon as it is marked. So the bomber **does** shoot, which settles one of gameplay.md's conflicting sources [code].

**The object wears its damage.** mirrorTwoTileObjectByHeading (0x3CE9) [seen] draws the bomber from a shape base that steps by four for each hit taken, three minus HITS_REMAINING. A fresh bomber and a damaged one are therefore drawn from different sprite shapes. The two tiles are swapped and flipped on whichever half of the heading circle the bomber is flying [code].

**Hits and death.** Each hit by a shot pays the chain score. advanceHitSoakingObjectThenAnimateDeath (0x3B94) [seen] then spends one of the three counted hits, sets the record back to live and sounds the hit, and nothing else changes. The fourth hit finds the counter at zero, which matches the manual's "destroyed by 4 hits"; gameplay.md's three-hit source is one short [code]. The record then counts down from 0x61. Every eight steps it swaps in a new shape from DEATH_ANIMATION_SHAPE_TABLE 0x3C09 [code]. At 0x40 it posts award 11, which is **1,500 points**, and switches to the fixed score sprite. It then drifts with the world down to zero and retires. The bomber never counts toward the kill quota.

### Parachutists

runParachutistSlot (0x47B3) [seen] runs the single record at PARACHUTIST_RECORD 0xA8F0, and does nothing in 2001: **there are no parachutists in 2001** [code]. A parachutist is not ejected by a shot-down craft. It appears on its own timer, and the cycle repeats for as long as the round lasts:

1. **Spawn.** A free record goes to spawnAtEdgeAhead (0x4853) [seen]. That routine refuses while the Mother-Ship is armed, and otherwise counts the delay in record byte 0x0E down on alternate frames. retireSlotIntoCooldown (0x48AD) [seen] loads the delay with 240 at every reset and retirement, so a parachutist appears 480 frames after the last one left. It comes in at the edge given by EDGE_SPAWN_COORD_TABLE 0x488D [code] for the player's heading, rounded to the nearest of sixteen sectors.
2. **Drift and loss.** The parachutist drifts at a small fixed velocity and cycles its fluttering shape on the frame tick. If it reaches the retire line it is lost, and the delay starts again.
3. **Rescue.** Touching it is detected by markObjectsTouchingPlayer. The 0xF0 mark sends it to showParachutistAward (0x4809) [seen], which sets the state to 0x3B, sounds the award and draws the value sprite chosen by PARACHUTIST_RUNG 0xA8F7 [seen]. The first four values come from PARACHUTIST_AWARD_SHAPE_TABLE 0x482D [code], and every later rescue uses one fixed sprite.
4. **Payment.** When the countdown reaches 0x10, postNextParachutistBonus (0x4831) [code] pays the award and advances the rung. The first four steps take their award numbers from PARACHUTIST_BONUS_ARG_TABLE 0x484F [code], which holds 10, 12, 13 and 14, and every later step pays award 15. The ladder is therefore **1,000 / 2,000 / 3,000 / 4,000, then 5,000 for every rescue after that** [code]. The countdown then runs on to zero and the slot retires into its cooldown.

PARACHUTIST_RUNG is byte 7 of the parachutist's own record. resetPlayfieldAndArmNewRound (0x19F0) [seen] clears it, and that routine runs at the start of every life and every round, so the ladder resets both on death and on a change of era [code]. The shot sweeps never include this record, so a parachutist cannot be shot.

### The Mother-Ship: arming, flight and fire

armMotherShipOrStep (0x43B7) [seen] runs every round frame and works in three stages:

- While ROUND_TRANSITION_HOLD reads 0xFF, it does nothing.
- While MOTHER_SHIP_ARMED is set, it hands the frame to stepMotherShip (0x43F0) [code].
- Otherwise, once every eight frames (when FRAME_TICK's low three bits read 5), it checks whether the quota is spent. It ORs KILLS_REMAINING with the state bytes of both of the ship's records, 0xA8A0 and 0xA8B0, and goes on only if all three are zero.

When they are, it sets MOTHER_SHIP_ARMED to 0xFF and loads **seven** into MOTHER_SHIP_HOLD_COUNTER 0xA8A4 [seen], which is byte 4 of the ship's record. It also retires the record pair with a 95-frame entry delay (retireEntryPairIntoCooldown, 0x46DB) [seen].

★ **The quota and the Mother-Ship are one mechanism.** The kill that empties the quota is what puts the ship on the field, and the seven is loaded in the same step. So the manual's "destroy 56 enemies and land 7 hits on the Mother-Ship" is a single sequence in the code [code].

MOTHER_SHIP_ARMED is cleared only by startNextRound and resetPlayfieldAndArmNewRound. It therefore stays up after the ship dies, until the round turns over or a new life starts [code]. While it is up, the rest of the game makes room:

- craft records five and six stand down;
- the shot and ram sweeps run five craft instead of seven;
- the 2001 craft count drops to five;
- the bomber will not arm;
- parachutists will not spawn.

stepMotherShip is a state machine keyed on MOTHER_SHIP_STATE 0xA8A0:

- **Idle (0x00).** The ship counts its entry delay down. Once the delay is spent, and provided ROUND_TRANSITION_HOLD is clear, it enters at a position that HEADING_SHAPE_TABLE picks from the player's heading, jittered by a sixteenth of a turn. Its facing is reduced to a single bit, and setMotherShipVelocityFromHeading (0x46BA) [seen] gives it a per-era speed. The ship can therefore travel only one of two opposite ways, which is the straight crossing gameplay.md describes [code]. Its arrival sound is picked by era. ★ If the hit counter has fallen below six, re-entry **raises it back to five**. The first two hits survive a departure, and any hits beyond those are undone, so a ship that leaves damaged comes back with at most two hits taken off [code].
- **Live (0xFF).** Each frame the ship moves along its velocity plus the world scroll and is drawn as a two-sprite pair by dressSpriteForHeadingOrRetireAtEdge (0x4447) [seen]. At the field edge it is retired with a fresh 95-frame delay and later comes back in. **It fires.** It needs BANK_LAUNCH_COOLDOWN to be clear, and one of its halves must be on screen but outside BANK_LAUNCH_NEAR_HALF_Y 0xA827 [seen] of the player's screen point. It then drops an aimed shot from that half's position into the first free one of the last two bullet records, ACTOR_RECORD_SLOT2 0xA830 and ACTOR_RECORD_SLOT3 0xA840 [seen]. The shot is aimed at ENEMY_STANDOFF_AIM_MAIN and pushed alternately about a tenth of a turn to either side by MOTHER_SHIP_AIM_SIDE_TOGGLE 0xA8B4 [seen]. Its velocity comes from one table in 1910 and 1940 and another from 1970 on [code].
- **Hit (0xF0 from a shot).** On the next frame, if MOTHER_SHIP_HOLD_COUNTER is still non-zero, the counter is decremented, the ship goes back to live and the hit sounds. Each hit already paid the chain score when the sweep marked it. The counter starts at seven, and the killing hit is the one that finds it at zero, so the code needs **eight** shots to bring down an undamaged ship. gameplay.md's "7 hits" either counts only the absorbed hits or is one short. This is the one number in this section that contradicts the manufacturer, so it should be watched on the real machine before anyone repeats it [code].

The counter is one byte of the ship's own record, and three instructions act on it. The arming path writes seven, the hit path decrements it and puts the ship back to live, and the re-entry path writes five whenever it is below six [code].

### The Mother-Ship's death: the field clear and the warp

The killing hit, or any ram, leaves the ship at 0xF0 with its counter at zero. The death then runs as follows [code]:

1. **Frame one.** The state counts down to 0xEF.
2. **The field clear.** On the next frame the state reads 0xEF, which triggers the field clear. The routine zeroes HITS_REMAINING, requests the transition and intro sound bursts, and walks all fifteen records from 0xA810 to 0xA8F0. Every live record is given a staggered death code of 0x14 plus ten for each position down the block, and posts award 2, which is **200 points**. Every held record is simply cleared. This is gameplay.md's "all remaining craft are destroyed", and the swept enemies **do** score, 200 each. The staggered codes then play out in each class's normal death:
   - The bullets sit at the top of the block, so they get the lowest codes, 0x14 to 0x32. These are below sixty, so they never take the path that stamps 0x3B and sounds. Outside 2001 they vanish at once, and in 2001 they run down silently.
   - The craft get codes from 0x3C up. Each flies on slowly until its code counts down to 0x3C, then counts a kill and explodes. The craft therefore blow up one after another, while the quota is already at zero.
   - A bomber that is still alive dies and still pays its 1,500.
   - A parachutist that is still drifting is pushed into its award state and paid as if rescued.
3. **The hold.** The same step sets ROUND_TRANSITION_HOLD to 0xFE, sets the ship's state to 0xE4 and changes its sprite colour. From here fireAndSweepPlayerShots (0x23E3) [seen] fires no new shots and the craft spawners stop, although shots already in flight keep moving.
4. **The explosion.** The state counts down. Above 0xB4, each frame shows a shape from MOTHER_SHIP_WARP_SHAPE_TABLE 0x461B [code], an eight-shape cycle stepped as the counter falls.
5. **The payout.** At exactly 0xB4 the ship switches to the flash sprite and posts award 13, which is **3,000 points**. The warp sound plays only if the player is still alive.
6. **Disappearance.** At 0x5A the sprites are blanked.
7. **The warp.** At zero, ROUND_TRANSITION_HOLD becomes 0xFF and the ship goes idle.

This fixes something a reader would otherwise get wrong. The state byte of an object record is not a small alphabet of free, live, held and destroyed. The field clear writes a whole *range* of values into it, so any reading that treats 0xF0 as the only way into a death countdown is wrong [code].

At the end of the warp the program also checks itself. On a genuine program image, where TAMPER_GLYPH_COPY 0xAB43 [code] reads 0x7C followed by 0x10 or 0x05, the sequence ends there. On any other image it falls into stepMotherShipWarpFlashFrame (0x459B) [seen], a routine entered part-way through the instructions before it. That entry discards stack words the routine does not own, and depending on their contents it can call loseLifeAndHandOver, a life-loss. It then leaves the ship's state at 0xFF. On a genuine image this path is never taken. That it is meant as copy protection, derailing a patched ROM, is [guess].

### Advancing the round

On every frame the player is alive (PLAYER_STATE 0xFF), serviceRoundThenResolvePlayerState calls advanceRoundWhenFieldCleared (0x1271) [code]. That routine waits for three things together: KILLS_REMAINING is zero, ROUND_TRANSITION_HOLD is non-zero, and all fifteen records from 0xA810 are empty. So the staggered explosions have to finish, and the Mother-Ship's own record has to return to idle at the end of the warp, before the era changes. Once all three hold, it requests the transition sounds. What happens next depends on whether a game is running:

- **In a game,** it clears the object sprite coordinates and calls startNextRound. That routine steps ROUND_NUMBER 0xAD01 [code] and advances ERA_INDEX, wrapping back to 1910 after the fifth era. It reloads START_RUNG 0xAD0A [seen] from the bracket for rounds 1–5, 6–10 or 11 and up. It refills KILLS_REMAINING from KILL_QUOTA, clears MOTHER_SHIP_ARMED and ROUND_TRANSITION_HOLD, and raises ROUND_ARMED. The live sixteen-byte player block is then copied into the active player's save slot, and SEQUENCE_SUBSTEP 0xA9AC [code] is reseated from NEXT_ROUND_START_SUBSTEP 0x4A35 [code] to run the next era's intro.
- **In the attract demo** (PLAY_ACTIVE clear), the same event restarts the attract sequence instead.

### Player death and the lost life

Being killed is the same event as an enemy being killed. A contact writes 0xF0 into PLAYER_STATE 0xA800, and every writer of that mark is a collision sweep [seen]. Which sweeps can do it depends on the era, since the wide ram arm against the Mother-Ship exists only in 1910 and 2001. From the mark on, every collision test refuses to run against the player, because each one requires PLAYER_STATE to read 0xFF. The shot routine stops firing. dispatchPlayerFrameByState (0x1EDF) [seen] hands every frame to advancePlayerAnimationStrip (0x2010) [seen]:

1. **The first frame.** The routine clamps the state to 0xB4 and hides the ship's sprite. It requests a sound burst, plus an extra cue from 1970 onward. A copy-protection test of TAMPER_GLYPH_STRIP 0xABFE [seen] and TAMPER_COLOUR_STRIP 0xABFF [seen] can divert this frame elsewhere [code].
2. **The explosion.** The state counts down one per frame. At seven keyframes, 0xB3, 0xAB, 0xA3, 0x9B, 0x93, 0x8B and 0x83, it paints a strip of tiles onto the character plane at PLAYER_ANIM_VRAM_BASE 0xA5AF [code], the fixed centre of the screen where the ship sits, coloured by era. The ship's destruction is therefore drawn in background tiles, not in sprites [code].
3. **The end.** After 180 frames the state reaches zero.

Meanwhile the world keeps running. Craft, bullets and the Mother-Ship go on moving, but nothing can hit the player.

When the round engine finds PLAYER_STATE at zero, it calls loseLifeAndHandOver (0x11ED) [seen]:

1. It hides all sprites.
2. **If ROUND_TRANSITION_HOLD is non-zero, it calls startNextRound first.** A player who dies after the Mother-Ship has been destroyed, including one who died ramming it, still moves on to the next era, so the win is not lost by dying during the warp [code]. This confirms gameplay.md's single-source "collide with the Mother Ship and you still advance".
3. It requests the transition sounds.
4. It decrements LIVES_REMAINING 0xAD00 [seen].
5. It copies the sixteen-byte block that starts there into PLAYER_ONE_LIVES 0xAD10 [seen] or PLAYER_TWO_LIVES 0xAD20 [seen], according to ACTIVE_PLAYER 0xAD32 [seen].

The block holds the player's round, KILLS_REMAINING, bonus latch, era, life clock, start rung and MOTHER_SHIP_ARMED, so each player's progress is saved separately. The kill count **survives a death**, and the next life resumes with the kills still owed. If the quota was already spent, the Mother-Ship is armed again from a fresh seven, because resetPlayfieldAndArmNewRound clears MOTHER_SHIP_ARMED [code].

If lives remain, the turn passes to the other player whenever that player still has lives. The sequence reseats itself through SEQUENCE_DELAY 0xA9EB [seen], set to 90, and HANDOVER_SUBSTEP_SEED 0x4B52 [code]. On the next life, resetPlayfieldAndArmNewRound brings the ship back [code]:

- WORLD_SCROLL_Y and WORLD_SCROLL_X are zeroed, and the ship is placed at the screen centre (0x84, 0x78) with heading 0x80.
- ★ **There is no invulnerability window.** The routine writes the live value into PLAYER_STATE just before it writes the position, so the new ship can be hit from its first frame.
- All shots are freed.
- Every one of the object records is freed and renumbered, the craft on the field included. The bomber's record is retired with its 128 delay, the parachutist's with its 240 delay, and the bomber's shot's with the shared spawn cooldown.
- The parachutist ladder and ROUND_TRANSITION_HOLD are cleared.
- The era's difficulty record for the current rung is copied into the fire and spawn tuning cells, BANK_LAUNCH_* and ATTACKER_SPAWN_*.

If the count reaches zero, postGameOverBanner (0x1253) [seen] takes over. In the attract demo it restarts the attract sequence. In a game it queues the "PLAYER n" and "GAME OVER" captions and holds them by setting SEQUENCE_DELAY to 180. fileScoreAfterGameOverHoldElsePassTurn (0x330B) [code] counts that hold down and then tries to file the score:

- If the score makes no table entry, it queues two captions and reseats SEQUENCE_SUBSTEP from SKIP_INITIALS_SUBSTEP_SEED 0x0843 [code]. It then passes the turn to the other player if they have lives (passTurnToOtherPlayerIfLivesElseStepSequence, 0x12E7) [seen].
- If the score is filed, it opens initials entry. First it sums the 256 bytes from HIGH_SCORE_FILED_CHECKSUM_BASE 0x01F1 [code], and it derails the sequence phase unless the sum is 0x19.

### Extra lives

awardBonusLifeAtScoreMark (0x4DDE) [seen] runs every round frame while PLAY_ACTIVE is set. Bit 0 of BONUS_LIFE_SETTING 0xA9C3 [code] chooses between two counted mark lists:

- **BONUS_LIFE_MARK_TABLE_BIT0_CLEAR 0x4E1B** [code] holds twenty marks: 10,000, 60,000, then every 50,000 up to 960,000.
- **BONUS_LIFE_MARK_TABLE_BIT0_SET 0x4E30** [code] holds seventeen marks: 20,000, 80,000, then every 60,000 up to 980,000.

Each mark is the top packed-decimal byte of a score. The check compares the active player's PLAYER1_SCORE_HI 0xAD35 [code] or PLAYER2_SCORE_HI 0xAD38 [code] against the list for an exact match. No single award exceeds 5,000, so a score cannot step over a 10,000-point band without matching it. Bit 0 of BONUS_LIFE_LATCH 0xAD03 [seen] makes each award fire only once: a match while the latch is set does nothing, and the first frame without a match clears it.

An award increments LIVES_REMAINING, requests the bonus-life sound, and posts command 5 with the old count. That command repaints the reserve-ship strip through drawEmblemStripThenGuardImage (0x4D72) [seen].

The lists are finite, so **no extra ship is awarded after 960,000** under the first setting, or after 980,000 under the second [code]. This confirms Wikipedia's cap in gameplay.md and overturns the manual's open-ended "each additional 50,000". The fourth starting-lives setting is 255, after 3, 4 and 5; seedGameConfigFromDipSwitches (0x52AA) [seen] writes it into STARTING_LIVES 0xA9C1 [code]. That 255 is the manual's "256".

## §7 Score, and the ladder that ends

Everything in this section hangs off one loop. While a round is being played, the phase-3 sequence machine sits on sub-step 7 of its sixteen-arm table at PHASE3_SUBSTEP_DISPATCH_TABLE 0x0F29, which dispatchSequenceSubStepArm [code] indexes by the low nibble of SEQUENCE_SUBSTEP 0xA9AC [code]. That arm is serviceRoundThenResolvePlayerState [seen]: it runs every subsystem once in a fixed order, and near the end of the list come the four that belong here: awardBonusLifeAtScoreMark, expireHitChain, escalateDifficultyRungOnCounterWrap and drawKillMeter. Then it reads the player's state byte, PLAYER_STATE 0xA800 [seen], and makes the only decision that can end a round. A live player (0xFF) hands on to advanceRoundWhenFieldCleared [code], which asks whether the era is finished; a player who has been fully torn down (0x00) hands on to loseLifeAndHandOver [seen], which starts the road towards the next life, the other player, or game over; any other value is a death still being animated, and nothing is decided that frame. The rest of the sub-step table is the connective tissue around that decision: arms 0-6 bring a round or a life onto the screen, arm 8 onwards is the game-over, high-score and hand-over tail, and arms 13-14 are the passage between eras.

Scores themselves are never touched by the code that detects a kill. A kill posts a two-byte command, a command and its argument, onto the 64-cell COMMAND_RING 0xAC00 [seen], and the foreground ring drain runCommandRingDrainLoop [seen] later takes each pair off and dispatches it through the handler table at COMMAND_HANDLER_TABLE 0x0BBC. The poster, postCommand [seen], writes a pair only into a free cell (one whose high bit is set); if the cell at the write cursor still holds an untaken command, the new pair is simply dropped, not queued behind it. So under load an award can be lost outright [code]. This is why reading the game means reading posts: a scoring routine does not score, it posts, and one command carries almost every award, keyed by its argument.

Command 4 is the score award; command 5 redraws the reserve-ship strip; command 6 draws the round count as a pictogram strip; commands 1, 2, 10 and 11 draw a caption from CAPTION_RECORD_TABLE 0x0C50 in its own colour, the pen colour, or the shared colour offset by five or ten; command 3 erases one; command 7 draws "STAGE" with the round number beside it; command 0 also paints from the caption table. Commands 8, 9 and 12 to 15 point at a bare return. The ring carries no sound at all, which is worth saying because it is the natural assumption: sound has an entirely separate queue at SOUND_QUEUE_HEAD 0xAC44, from which sendOldestQueuedSoundCommand [seen] hands one byte per frame to the sound CPU at the end of the frame interrupt [code]. The caption numbers below are decoded from the caption table's glyph runs [code]: 2 is " READY ", 9 and 10 are "PLAYER 1" and "PLAYER 2", 11 is "GAME OVER", 12 is "INPUT YOUR INITIALS !", 14 is "STAGE", 19 is "SCORE RANKING TABLE", 0 is "© KONAMI 1982", and 26-30 are "A.D. 1910" through "A.D. 2001". Captions 9 and 10 start at the same cell and differ in a single glyph, the digit.

### How points are paid

The score award is awardScoreToPlayer [seen], reached as ring command 4. Its argument is an index into SCORE_AWARD_TABLE 0x0D27, a ROM table of sixteen three-byte packed-decimal amounts: index 0 is nothing, 1 to 9 are 100 to 900, and 10 to 15 are 1,000, 1,500, 2,000, 3,000, 4,000 and 5,000 [code]. The whole command is vetoed while PLAY_ACTIVE 0xAD30 [seen] is clear, which is why the attract demo can shoot things down without anything scoring. Otherwise the amount is added, one packed-decimal byte at a time from the low end with the carry passed up, into the active player's three-byte score: PLAYER1_SCORE_LO 0xAD33 through PLAYER1_SCORE_HI 0xAD35, or PLAYER2_SCORE_LO 0xAD36 through PLAYER2_SCORE_HI 0xAD38 [code], chosen by ACTIVE_PLAYER 0xAD32 [seen]. The carry out of the top byte is simply dropped, so a score rolls over from 999,999 to zero [code]. A recorded score of 15,000,000 in the public record is therefore rollovers and a scorekeeper, not a wider counter. The fresh score is then compared, most significant byte first, against the displayed high score, whose top byte is HIGH_SCORE_HI 0xA98D [code]; the moment it is strictly greater it is copied over and repainted through paintHighScoreReadout [code], so the high score climbs live during play. Last, the player's own score readout is repainted. Index 0 takes a separate path that does no arithmetic at all: it repaints the score labels, and in a one-player game (TWO_PLAYER_GAME 0xAD31 [code] clear) it erases the second player's label and blanks the six digit cells of that absent score. The new-game arm armRoundStartThenStepSequence [seen] zeroes both scores and posts exactly this command 4 with argument 0 to lay the scoreboard out.

Three small entry points feed the readouts, each fixing a first character cell, the top byte of a three-byte field and the colour 0x10 and falling straight into the shared six-digit painter paintSixDigitFieldSuppressingLeadingZeros [seen]: paintPlayerOneScoreReadout [code] paints PLAYER1_SCORE_HI's field at PLAYER1_SCORE_READOUT_BASE 0xA781, paintPlayerTwoScoreReadout [seen] paints PLAYER2_SCORE_HI's at PLAYER2_SCORE_READOUT_BASE 0xA501, and paintHighScoreReadout paints the high score's at HIGH_SCORE_READOUT_BASE 0xA641. The field is walked downward from its top byte, so the leftmost digit is painted first. The first four digits go through paintSuppressedDigit [seen], sharing one flag that the caller clears once and carries across the whole field, which is why a run of leading zeros blanks as one field and not cell by cell. A non-zero digit indexes DIGIT_GLYPH_TABLE 0x0DCC by its own value and steps the flag; a zero digit indexes entry zero once the flag is set, but while the flag is still clear it indexes the blank entry. That blank is itself a glyph-table index read out of a program byte, LEADING_ZERO_BLANK_GLYPH_INDEX 0x3246, not a literal glyph. The last two digits go through paintUnsuppressedDigit [seen], which has no flag and always paints, so they always print; and because every award in SCORE_AWARD_TABLE has a zero low byte, those two digits are permanently "00" [code]. The plain painter masks its value to four bits and indexes a ten-entry table with it, so the values A to F would read past the table's end: there is no glyph for them, and the game never produces them.

Almost every kill in the game is paid through one routine, postChainedHitScore [seen], and what it pays is not a flat 100. Two cells make a chain. CHAIN_WINDOW 0xA99D [seen] is how long a hit still counts as part of the current chain; every call re-arms it to 30, and expireHitChain [seen] counts it down once per pass of the service list, not from inside the routine that benefits from it. CHAIN_STEP 0xA99E [seen] is the rung. A kill arriving with the window already empty pays award 1, 100 points, and leaves the rung alone; a kill arriving while the window is still open steps the rung and pays award (rung mod 8) + 1. So kills landing within about half a second of each other pay 100, 200, 300 and so on up to 800, after which the ladder comes back round to 100 and climbs again. It wraps rather than capping: the rung itself keeps counting past eight, and it is only the argument that cycles, so a reader expecting the top award to repeat would be wrong [code]. Once the window has run dry, expireHitChain holds the rung at zero on every pass that finds the window already empty [code]. That leaves a gap, because the poster and the ticker sit at different points in the service list: on the pass where the window ticks from 1 to 0, the rung is not yet cleared, and a kill on the very next pass, whose collision sweep runs before expireHitChain, finds the window empty, pays the bottom award, re-arms the window and leaves the old rung standing, so the next chained kill resumes the old climb instead of starting again [code]. The callers are every collision sweep that destroys something: destroyTargetsHitByShots [code] for shots against a run of targets, destroyCraftAndMotherShipHitByShots [seen] and destroyMotherShipAndShotOnMutualHit [seen] for the Mother-Ship, destroyFixedTargetHitByShots [seen] for the fixed era object, destroyTargetsReachedByFixedAttacker [seen], and the contact sweeps destroySlotsAndPlayerOnContact [seen], destroyFixedTargetReachedByPlayer [code], destroyPlayerAndMotherShipOnContact [seen] and ramTestPlayerVsMotherShip [seen]. A sweep does not stop at its first overlap, so one shot can take several targets in a pass and is paid for each. The contact sweeps matter for a question the public record raises: when the player flies into something, both are marked destroyed (0xF0) and the chained score is posted for the thing rammed, so a collision death still scores the enemy it hit [code].

Five awards are paid outside the chain, each as a fixed command-4 index. The middle-size bomber of the second era is a hit-soaking object: advanceHitSoakingObjectThenAnimateDeath [seen] spends one of HITS_REMAINING 0xA8DC [seen] per hit and puts the record back to live while any remain, so an object armed with three takes four hits; when it finally dies its record head counts down, and at the value 0x40 it posts award 11, 1,500 points [code]. Each of the absorbed hits is also a chained score, because the shot sweep that detects the hit posts one. The formation bonus is paid through a shared claim token. When a craft begins to die, countTheKillAndGrantTheSharedToken [seen] checks whether it was launched as a formation member (the top bit of its cooldown byte) while the formation's claim window WAVE_CLAIM_TIMER 0xA812 [seen] is still open; if so it ticks WAVE_KILL_COUNTDOWN 0xA811 [code], and the kill that zeroes it writes that craft's own ordinal, top bit set, into CLAIM_TOKEN 0xA821 [code]. That craft's death animation is run by driveObjectAppearanceByPhaseBand [seen]; in its last band the object survives only while the token names it, holds a fixed shape and tint, and on its first phase posts award 12, 2,000 points, and clears the token so it is paid once. Any other object reaching that band unnamed is retired. The Mother-Ship's kill pays award 13, 3,000 points, and every live craft it sweeps off the field pays award 2, 200 points, both described below with the era's end. The parachutist ladder is the fifth, also below.

### Extra ships

awardBonusLifeAtScoreMark [seen] runs every frame of play and does nothing while PLAY_ACTIVE is clear. Bit 0 of BONUS_LIFE_SETTING 0xA9C3 [code], unpacked from the gameplay DIP bank, chooses between two length-prefixed ROM lists of score marks: BONUS_LIFE_MARK_TABLE_BIT0_CLEAR 0x4E1B and BONUS_LIFE_MARK_TABLE_BIT0_SET 0x4E30. Each list is a length byte followed by its marks, and a list whose length byte read zero would be walked as the full 65,536-byte span rather than as empty [code]. Each mark is compared only against the top byte of the active player's score, the packed pair of hundred-thousands and ten-thousands digits, and only for exact equality: a table walk for an equal, not a threshold test. The first list holds twenty marks, 10,000, 60,000, then every 50,000 up to 960,000; the second holds seventeen, 20,000, 80,000, then every 60,000 up to 980,000 [code]. These are the two bonus settings of the operator's DIP table. So the manual's "each additional 50,000" is bounded by the table, and the Wikipedia claim of a 960,000 ceiling is what the first list encodes. The same source's "survival of the fittest" mode, though, is not in the code: past the last mark the search simply misses, and the miss path does exactly what it does between any two marks, clearing the latch; no counter moves and no mode is entered. And the ceiling is not permanent: past the last mark no further ship is given until the score rolls over at a million and the top byte walks back through the low values, when the whole schedule pays again [code]. Because a single award is never more than 5,000 points, the top byte cannot step over a mark, so exact matching does not miss one. A one-shot latch, bit 0 of BONUS_LIFE_LATCH 0xAD03 [seen], stops a mark paying on every frame the top byte sits on it: a match while the latch is set does nothing, the first frame without a match clears it. A paid mark increments LIVES_REMAINING 0xAD00 [seen], requests the bonus sound, and posts command 5 with the pre-increment count, which is exactly the number of reserve ships now owed a picture (the reserve strip always shows lives minus one, the same convention the context load uses). Nothing else in the game gives a life back: LIVES_REMAINING is written only by this increment, by the decrement on a death, and by the context load that swaps a player in [code].

### The kill ladder and the meter

The ladder that ends an era is KILLS_REMAINING 0xAD02 [code], and it counts down. startNextRound [seen] loads it at the start of every round from KILL_QUOTA 0xA9CD [seen], a cell filled once at boot from a ROM byte whose value is 56; nothing keys it on era, loop or difficulty, so the quota is 56 in every round of every loop. The only decrement is in countTheKillAndGrantTheSharedToken, and it is a floor-decrement: once the count reaches zero, further kills no longer move it. That routine is reached from stepDyingObjectState [seen] on the frame a destroyed object's state byte is re-armed from 0xF0 into its death countdown, and stepDyingObjectState in turn is reached from the five per-era enemy-craft slot handlers, serviceEra0EnemyCraftSlot [seen], serviceEra1EnemyCraftSlot [code], serviceEra2EnemyCraftSlot [seen], serviceEra3EnemyCraftSlot [seen] and serviceEra4EnemyCraftSlot [seen]. So what advances the ladder is the ordinary enemy craft of each era; the bomber, projectiles, the Mother-Ship and the parachutist all score without moving it [code]. stepDyingObjectState also counts a kill when a state byte counting down from above passes through 0x3C, which is what the higher staggered death codes of the Mother-Ship's field sweep (below) do; by then the ladder is already at zero, so those counts only request their sounds and consult the claim token [code].

The bar along the bottom of the screen is a direct picture of this cell, redrawn by drawKillMeter [seen] once per frame of play and once more at every round start. The era selects a ten-byte row from KILL_METER_GLYPH_ROW_TABLE 0x087C: two glyphs the bar is built from, then eight end glyphs. The bar is laid from the fixed cell KILL_METER_BAR_START_CELL 0xA79F, stepping one row of the character plane at a time, with one bar cell for every four kills still owed and the two bar glyphs alternating; the end glyph, picked by the low three bits of the count, goes after the last bar cell, and one blank glyph after that erases the cell the bar has just vacated. The bar therefore shortens a cell every four kills with its end sliding along behind it. Only the glyph plane is written; the bar never touches colour. Nothing about it is a timer: it is the kill count and nothing else [code].

### The Mother-Ship and the end of an era

armMotherShipOrStep [seen] is called once per frame from the service list. While ROUND_TRANSITION_HOLD 0xACC6 [code] holds 0xFF it does nothing at all. While MOTHER_SHIP_ARMED 0xAD0D [seen] is raised it steps the Mother-Ship's state machine. Otherwise, on the one frame in eight where FRAME_TICK 0xA980 [seen] has low bits 5, it checks that KILLS_REMAINING is zero and that both of the two records the Mother-Ship occupies, MOTHER_SHIP_STATE 0xA8A0 [seen] and the record a stride above it, are empty; when all three hold it raises MOTHER_SHIP_ARMED, writes 7 into the record's hit counter MOTHER_SHIP_HOLD_COUNTER 0xA8A4 [seen], and retires the pair into an idle delay from which the ship launches. The armed flag is cleared only by a round start or a life start, so after a death with the quota already spent the Mother-Ship is armed afresh, with a fresh counter [code].

Hits on the Mother-Ship come from the shot sweeps and the ram tests, each of which stamps 0xF0 into MOTHER_SHIP_STATE and posts a chained score. On the next step the state machine sees that just-hit value and looks at the counter: if it is non-zero, the hit is absorbed, the counter drops by one, the state goes back to live (0xFF) and a pair of sounds is requested. By the code, then, seven hits are absorbed and the one that arrives with the counter at zero is the killing hit [code], one more than the manual's "7 hits"; nothing in the code makes the seventh hit final. Two further details bear on that count. Each time the ship re-launches from idle, a counter below 6 is set back to 5, so a ship that has been worn down and leaves the screen comes back partly repaired [code]. And the two ram paths, destroyPlayerAndMotherShipOnContact and ramTestPlayerVsMotherShip, zero the counter as they mark both craft destroyed, so ramming the Mother-Ship kills it outright rather than costing one hit [code]. Their collision box is a little wider on one axis in the first and last eras, the same widening the shot sweeps apply.

The killing hit starts a countdown in the Mother-Ship's own state byte, and the rest of the era's end is timed off it. One frame into it, when the state has dropped one below the hit value, the state machine clears the whole field: HITS_REMAINING is zeroed, the transition and round-intro sound bursts are queued, and it walks the fifteen object records from ACTOR_RECORD_SLOT0 0xA810 [seen]. Every record holding a live object (0xFF) is given a staggered death code, 0x14 for the first and ten more for each record after it, so the field goes down in a ripple, and for each one a command 4 with argument 2 is posted, 200 points per object swept away [code]; records holding 0xFE are simply cleared. ROUND_TRANSITION_HOLD is set to 0xFE, which stands down the enemy spawner and stops the player's shot spawner from launching new shots while it still sweeps the ones in flight. One consequence follows mechanically: the parachutist's record is the last of those fifteen, so a parachutist still in flight at that moment receives a death code at or above 0x3C, which is the value its own handler treats as a pickup, and it pays out as if docked [code]. The ship itself then runs down a long countdown in which it cycles eight shapes from the warp shape table; at state 0xB4 it flashes, the warp sound is requested if the player is alive, and command 4 with argument 13 pays 3,000 points; at 0x5A its sprite is hidden; at zero the state returns to idle and ROUND_TRANSITION_HOLD becomes 0xFF, which stops armMotherShipOrStep for the rest of the round. On a genuine image the program-image gates checked at that point return at once; stepMotherShipWarpFlashFrame [seen], the continuation they otherwise fall into, is a tamper derail and not part of play.

advanceRoundWhenFieldCleared, reached only while the player is alive, is what turns the ship's death into a new era. It waits for three things together: KILLS_REMAINING at zero, ROUND_TRANSITION_HOLD non-zero, and every one of the fifteen records from ACTOR_RECORD_SLOT0 empty, which includes the Mother-Ship's own two records, the bomber and the parachutist. So the round ends only after the Mother-Ship's countdown has run out and the last swept-away craft and any rescued parachutist have finished their animations and retired [code]. It then queues the transition sound burst and branches on PLAY_ACTIVE. In the attract demo (flag clear) the round simply ends the demo: ROUND_TRANSITION_HOLD is reloaded from ROUND_TRANSITION_HOLD_SEED 0x07D1 (zero), every sprite is hidden, PLAY_ACTIVE and ACTIVE_PLAYER are cleared, SEQUENCE_PHASE 0xA9AB [seen] is set from ATTRACT_SEQUENCE_START_PHASE 0x16D3 (the attract phase, 1) and the sub-step restarts at zero. In a real game it blanks 23 sprite Y bytes from ACTOR_SPRITE_Y_SLOT0 0xAA43 [seen], calls startNextRound, copies the sixteen-byte live context block from LIVES_REMAINING into the active player's save block (PLAYER_ONE_LIVES 0xAD10 [seen] or PLAYER_TWO_LIVES 0xAD20 [seen]), and seats SEQUENCE_SUBSTEP from NEXT_ROUND_START_SUBSTEP 0x4A35, which is 13: the passage between eras.

### Starting the next round

startNextRound [seen] is the whole of what "the next era" means to the state. It steps ROUND_NUMBER 0xAD01 [code], which a new game seeds to 1, steps ERA_INDEX 0xAD04 [seen] and wraps it from 4 back to 0, so after 2001 the game returns to 1910 as round 6. It then reloads START_RUNG 0xAD0A [seen], the difficulty rung the round opens on, from one of three cells bracketed by the round number: START_RUNG_ROUNDS_1_5 0xA9D3 [seen] below round 6, START_RUNG_ROUNDS_6_10 0xA9D4 [code] for rounds 6 to 10, START_RUNG_ROUNDS_11_UP 0xA9D5 [code] from round 11. All three come from the same DIP-selected difficulty record, so this is the manual's "Round 6 is identical with Round 1, but …harder": each full loop opens every round on a higher rung, the eras themselves unchanged [code]. KILLS_REMAINING is refilled from KILL_QUOTA, MOTHER_SHIP_ARMED and ROUND_TRANSITION_HOLD are cleared, and ROUND_ARMED 0xAD0E [seen] is set to 0xFF, marking this as the first life of a new round rather than a restart after a death.

Sub-steps 13 and 14 play the passage between eras. paintSelfTestScreenPhaseThenStepSequence [code] lays out a control block for the animation, paints a fixed attribute run and several colour-plane rows and columns offset from PEN_COLOUR 0xAD0C [seen], and re-seeds the active player's saved pen from the new era. stepRoundStartIntroAnimation [code] then runs one step on each frame where bit 1 of FRAME_TICK is clear, two frames in every four: early steps flash the player's ship and advance two scripted character-plane bands, a later step cycles the ship's colour, another floods the colour plane with the player's saved colour; the last step sets SEQUENCE_DELAY 0xA9EB [code] to 90, hides every sprite, loads the player's context and HUD, and reseats the sub-step from INTRO_SUBSTEP_RELOAD 0x2750, which is 3, so the ordinary context-load arm then runs once more. That this is the time warp the public record describes between eras is [guess]; mechanically it is a scripted screen effect that ends in the ordinary round-start arms. Sub-step 15, loc_15b5 [code], does nothing at all.

From sub-step 3 on, a new round and a new life share one path. loadActivePlayerContextAndPostRoundHud [seen] copies the active player's saved block back into the live block at LIVES_REMAINING and, in play, posts command 6 with ROUND_NUMBER and command 5 with lives minus one, redrawing the round and reserve strips. postRoundStartCaptionsAndResetPlayfield [code] (sub-step 4) folds the 256 program bytes from ROUND_START_CHECKSUM_BASE 0x4C99 and steps the outer phase on any total but the genuine one, then posts the round's captions: in the demo just " READY "; in play "PLAYER 1" or "PLAYER 2" in the pen colour, followed, on a fresh round (ROUND_ARMED set), by command 7 drawing "STAGE" and the round number, or, after a death, by " READY " again. It redraws the kill meter and runs resetPlayfieldAndArmNewRound [seen], which clears the scroll, re-seats the ship alive at the centre, retires every object slot, clears MOTHER_SHIP_ARMED, ROUND_TRANSITION_HOLD and PARACHUTIST_RUNG 0xA8F7 [seen], reloads the difficulty rung from START_RUNG, and scatters the era-and-rung record that sets this round's launch counts and windows. flyRoundIntroFlashingEraYearThenEraseIntroCaptions [code] (sub-step 5) first folds the 256-byte span at loc_4d9f 0x4D9F [guess] into SEQUENCE_PHASE, a fold that nets out on a genuine image, then flies the ship over the era scenery with no enemies; on odd frames it counts SEQUENCE_DELAY down. While ROUND_ARMED is set, the frame tick's low nibble posts the era's "A.D." caption (ERA_INDEX + 26) in three colours in turn, at nibbles 0, 5 and 10, so the year cycles through its colours; after a death ROUND_ARMED is clear and only " READY " stands. When the delay runs out it erases the player caption, the STAGE field and the year caption (which shares its cells with " READY "), clears ROUND_ARMED, sets the delay to 42 and steps on. flyEnemyFreeLeadInThenStepSequence [code] (sub-step 6) folds loc_0831 0x0831 [guess] into the phase, then gives the player 42 frames of flying and shooting with the scenery but still no enemies, and on expiry folds loc_12a7 0x12A7 [guess] and steps to sub-step 7, the round proper. The delay sub-step 5 counts down on its odd frames was set by whichever path came in: 150 by a new game, 90 by the attract demo, after a death or after the era passage.

The parachutist's award ladder lives in its own record and resets with each life. The parachutist is a singleton, not a pool: runParachutistSlot [seen] manages the single record PARACHUTIST_RECORD 0xA8F0 [seen] with its sprite entry PARACHUTIST_ENTRY 0xAA2E [seen], and its first act is to read the era and return in era index 4, so there are no parachutists in 2001 [code]. An empty slot is filled by spawnAtEdgeAhead [seen], which does nothing while MOTHER_SHIP_ARMED is raised, acts only on alternate frames, and waits out a cooldown in the record before placing the parachutist at one of sixteen positions from EDGE_SPAWN_COORD_TABLE 0x488D, chosen by the player's heading sector. Every position sits near the border of the wrapped field and roughly in the direction the ship is pointing, so the parachutist enters from the edge the player is flying towards, not at random and not behind [seen]. Reading that table by hand is a trap: the first byte of each pair goes to the sprite entry's +0x31 and the second to its +0x00, and taking them in the other order turns "ahead" into "behind" for several of the sixteen; for comparison the player's own entry holds 0x78 at +0x31 and 0x84 at +0x00. In flight it drifts along its stored velocity and is retired into cooldown if it reaches the retire line. A pickup puts the record's state at or above 0x3C; showParachutistAward [seen] then sets it to 0x3B, requests the award sound and dresses the sprite with a shape chosen by the record's rung byte from a four-entry table, with one fixed shape past the end of it. The state counts down while the award drifts with the world, and at 0x10 postNextParachutistBonus [code] posts command 4 with the argument for the current rung, read before the rung is stepped: PARACHUTIST_BONUS_ARG_TABLE 0x484F holds 10, 12, 13 and 14, that is 1,000, 2,000, 3,000 and 4,000, and every rung past the fourth pays argument 15, 5,000 points, for good. The rung is PARACHUTIST_RUNG 0xA8F7 [seen], byte 7 of the record, and resetPlayfieldAndArmNewRound zeroes it at every life start and every round start, so the ladder restarts at 1,000 on a death and on an era change, exactly the reset rule the secondary sources report [code]. The rung is not in the per-player context block; it is a single shared cell. Every hand-over passes through the playfield reset, which clears it, so the sharing never shows, but it is sharing and not separation [code].

### Losing a life, and the turn passing on

loseLifeAndHandOver [seen] runs once, on the frame a dead player's state byte reaches zero. It hides every sprite, and if ROUND_TRANSITION_HOLD is already non-zero, meaning the Mother-Ship has been destroyed, it calls startNextRound first, so a death during the era's closing sequence still carries the player into the next era [code]. Because ramming the Mother-Ship destroys it and raises the hold within a frame or two while the player's own death is still animating, this is the mechanism behind the report that colliding with the Mother-Ship still advances the stage when a ship remains [code]. It then queues the transition sounds, decrements LIVES_REMAINING, and copies the whole sixteen-byte live block into the active player's save block, so the era, the round, the remaining kill count, the bonus latch and the rest are all preserved per player: a player who dies keeps the kills already made towards the 56 [code].

If the decrement left lives, the turn passes only if the other player still has any: the save block the active-player index does not select is tested, and if its first byte is non-zero ACTIVE_PLAYER is flipped. Either way SEQUENCE_DELAY is set to 90 and the sub-step is seated from HANDOVER_SUBSTEP_SEED 0x4B52, which is 1, so the round-start arms run again from the pen-drawn caption steps seatCaptionPenFromEraFoldingTamperIntoPhase [seen] and blankCaptionThenAdvancePenRunStep [seen], then load whichever player is now up. A hand-over therefore moves no data at the moment it happens: it moves the index, and the block belonging to the player now named is copied in later by the context-load arm, so everything per player follows because everything per player is addressed through ACTIVE_PLAYER. Index zero is player one: the caption posted for zero is "PLAYER 1", the score painter chosen on zero is the player-one readout, and a one-player start fills the first save block. A one-player game can never hand over, and that is not a special case: startOnePlayerGame [seen] clears TWO_PLAYER_GAME and writes zero into PLAYER_TWO_LIVES, so the test for the other player's lives always fails and the same player goes again. The score display follows the index too: the inactive player's six cells stand still while the active player's move, and in a one-player game the second field is blanked by the argument-0 score command.

If the decrement reached zero, postGameOverBanner [seen] takes over. In play it posts "PLAYER 1" or "PLAYER 2" in the pen colour and then "GAME OVER" in the shared colour offset by five, sets SEQUENCE_DELAY to 180, and steps the sub-step from 7 to 8. It also carries an arm for PLAY_ACTIVE clear, which restarts the attract sequence directly.

### Game over and the high-score table

Sub-step 8 is fileScoreAfterGameOverHoldElsePassTurn [code]. It counts SEQUENCE_DELAY down, so the banner stands for 180 frames, and on the frame the delay expires it calls fileScoreIntoHighScoreTable [seen] for the active player's score.

The table is five eight-byte records from HIGH_SCORE_TABLE_BASE 0xAB08 to HIGH_SCORE_TABLE_END 0xAB2F [code]: a rank byte, the three score bytes (the first record's top byte is HIGH_SCORE_REC0_SCORE_HI 0xAB0B), three name glyphs and a spare byte that filing never writes. At cold start loadDefaultHighScores [seen] copies all forty bytes from DEFAULT_HIGH_SCORE_TABLE 0x4BB1, whose five entries are 10,000, 8,800, 8,460, 6,520 and 4,300, with names of two letters around a full stop reading K.O, N.A, M.I, O.O and Y.A [code]. Filing walks the records top first, asking isScoreBelow [seen] whether the finished score is below each standing score, most significant byte first; the first record it is not below is its slot, so a tie files above the standing entry. A score below all five is dropped. Otherwise the records beneath the slot slide down one place, copied from HIGH_SCORE_SLIDE_SRC 0xAB27 downward so no byte is overwritten before it is read, which pushes the old fifth entry off the end. The slot's three name cells are set to the blank glyph and SCRATCH_PTR_A 0xA991 [seen] is left pointing at the first of them; the three score bytes are copied in; SCRATCH_PTR_B 0xA993 [seen] is set to the on-screen cell for that rank's initials, HIGH_SCORE_INITIALS_CELL_BASE 0xA531 [guess] plus twice the rank; and the rank column is renumbered 0 to 4 from the top.

If the score was dropped, the arm erases the player and GAME OVER captions, seats the sub-step from SKIP_INITIALS_SUBSTEP_SEED 0x0843, which holds 11, and asks passTurnToOtherPlayerIfLivesElseStepSequence [seen] what happens next; that lands either on a hand-over or on sub-step 12. If the score was filed, it requests one sound through loc_583a [seen], sets PEN_COLOUR to 0 and PEN_GLYPH 0xAD0B [seen] to the blank glyph 0xF1 and arms the pen's route, so the pen will now travel its route painting blanks, wiping the screen. It folds the 256 bytes from HIGH_SCORE_FILED_CHECKSUM_BASE 0x01F1 into an eight-bit sum, stepping the outer phase if it is not the genuine total, and steps on to sub-step 9.

erasePenRouteThenOpenInitialsEntry [code] (sub-step 9) advances the blanking pen one run per frame and returns until the pen's row, PEN_ROW_CELL 0xA9E4 [seen], comes back to zero, which is the end of its route. It then XOR-folds the 256 bytes from INITIALS_ENTRY_CHECKSUM_BASE 0x4880 (a tampered image derails here) and builds the entry screen: "SCORE RANKING TABLE", "© KONAMI 1982", captions 20 and 21, and "INPUT YOUR INITIALS !". paintFiveLabelledNumericReadouts [code] paints the five records, each as a column with a rank pictogram, the six-digit score and the three name cells, each row in its own colour. The input state is cleared: INITIALS_BACK_PRESS_HISTORY 0xA995, INITIALS_FORWARD_PRESS_HISTORY 0xA996, INITIALS_COMMIT_PRESS_HISTORY 0xA997, INITIALS_ALT_COMMIT_PRESS_HISTORY 0xA998 and INITIALS_LETTER_INDEX 0xA999 go to zero, and INITIALS_SLOTS_LEFT 0xA99A is set to 3 [code]. The glyph for letter 0, taken from the 27-entry INITIALS_LETTER_GLYPH_TABLE 0x12C7, is stamped at the cursor cell SCRATCH_PTR_B names, and that cell's colour, the colour its rank row was just painted in, is saved to INITIALS_LOCKED_LETTER_COLOUR 0xA990 [code] so that finished letters can be given it back.

stepHighScoreInitialsEntry [code] (sub-step 10) is the entry itself, and it splits its work between alternate frames. On odd frames it only flashes the cursor: INITIALS_CURSOR_FLASH_TIMER 0xA99C [code] is stepped and its bit 4 switches the cursor cell's colour between 0x14 and 0x10, a change every sixteen odd frames. On even frames it reads the control panel that faces the screen, readPlayerControls [seen] choosing IN1_MIRROR 0xA9AF or IN2_MIRROR 0xA9B0 [code] by SCREEN_UNFLIPPED 0xA987 [seen]; that this lets player two enter from their own side of a cocktail cabinet is [guess]. Four bits are shifted into the four histories: bit 0 steps the letter back, bit 1 steps it forward, and bits 4 and 5 both commit it; that these are joystick left, right and the fire button is [guess]. A press counts only on its fresh edge, when the last three samples read not, not, pressed. A commit takes priority: the shown letter's glyph is written both to the table through SCRATCH_PTR_A and to the screen through SCRATCH_PTR_B, the screen cell takes the locked-letter colour, both pointers step on, and INITIALS_SLOTS_LEFT drops; if that was the third letter the entry finishes, otherwise the letter index goes back to 0 and the new cursor cell is drawn. A fresh forward press steps INITIALS_LETTER_INDEX up, wrapping 26 to 0; a fresh back press steps it down, wrapping 0 to 26; either redraws the cursor letter and restarts the flash. A held control repeats because a saturated history is emptied by rearmHeldControlRepeat [seen], after which the next sample reads as a fresh press again. The two directions saturate at different values, the forward history when it is all ones and the back history at 0x7F, so held forward steps once every eight samples and held back once every seven [code].

The entry is also on a clock. On every eighth frame SEQUENCE_DELAY is decremented, and running it out blanks the cursor cell and finishes the entry, keeping whatever letters were already locked; the name cells never reached stay blank. Nothing re-arms the delay between the game-over hold running it down to zero and this arm, so its first tick wraps it to 255 and the clock gives 256 ticks, about 2,048 frames [code]. Finishing either way sets SEQUENCE_DELAY to 60, queues the transition sound burst and steps to sub-step 11.

Every frame of the entry, unless it finished that frame, stepHighScoreInitialsEntry also checks whether a new game is being started over the top of it. That is allowed only once both players are out of lives, PLAYER_ONE_LIVES and PLAYER_TWO_LIVES both zero, and reads the start bits of IN0_MIRROR 0xA9AE [seen]. On free play, FREE_PLAY 0xA9C0 [seen] set, either start button hides every sprite and calls startGameOnFreePlay [seen]. Otherwise it needs CREDIT_COUNT 0xA986 [code]: with one credit only the one-player start is accepted, with more either is; the one-player start calls startOnePlayerGame [seen] and anything else startTwoPlayerGame [seen]. So a waiting player can cut a high-score entry short by pressing start [code].

### Where the turn goes after a game over

Sub-step 11 is loc_12e2 [seen]. It counts SEQUENCE_DELAY down, 60 frames after an entry, and on the frame it reaches zero asks passTurnToOtherPlayerIfLivesElseStepSequence [seen] the same question the dropped-score path asked: does the other player's save block still hold lives? If it does, handPlayOverToOtherPlayer [seen] flips ACTIVE_PLAYER, sets SEQUENCE_DELAY to 90 and reseats the sub-step from HANDOVER_SUBSTEP_SEED, so the second player's turn begins at sub-step 1 exactly as after an ordinary death. Each player therefore meets game over, the table and the initials entry separately, in turn. If the other player has nothing left, the sub-step simply steps to 12, restartAttractSequence [seen], which is the true end of the credit: it clears PLAY_ACTIVE, SEQUENCE_SUBSTEP and ACTIVE_PLAYER, sets SEQUENCE_PHASE from ATTRACT_SEQUENCE_START_PHASE (the attract phase), and writes the sub-step a second time from a fold of program bytes that comes back to zero on a genuine image. Whatever was filed stays in the table at HIGH_SCORE_TABLE_BASE, which the attract sequence shows, and HIGH_SCORE_HI keeps the best score across credits, since only the cold-start initialisation reseeds it [code].

## §8 The character plane: text, the meter, and a routine nothing reaches

Everything on Time Pilot's screen that is not a sprite lives in one 32-by-32 grid of character cells:
the captions, the scores, the round number, the kill meter, the reserve-ship emblems, the round-start
sweep and even the player's own shots. The grid is two planes of the same shape a kilobyte apart. The
glyph plane at CHAR_PLANE_BASE 0xA400 holds bytes that pick which 8x8 tile is shown, and the colour
plane at COLOUR_PLANE_BASE 0xA000 holds, at the same offset, that cell's colour. The two differ only in
address bit 0x400, so a cell's colour lives at `glyphCell & ~0x400` and its glyph at `colourCell | 0x400`,
and every painter in this section crosses between the planes by clearing or setting that one bit. [code]

The colour byte carries more than a colour. Captions whose colour comes from their record, the score
and credit digits and the ranking rows all use colours from 0x10 upwards, with the 0x10 bit set; that
bit is the one the shot painters (below) treat as "leave this cell alone". Captions coloured from the
pen are masked to four bits and so never carry it, and a few graphic runs add 0x20 (the second 256-tile
bank) and the flip bits 0x40/0x80, as described where they occur. [code]

★ **Coming back from the colour plane is a SET, not a restore, and the code depends on it.** A painter
that has just written a colour byte reaches that colour cell by *clearing* bit 0x400, and returns the
cursor to the glyph side with an unconditional OR rather than by remembering where it started. A cursor
that happened to *arrive* on the colour side is therefore not restored: its glyph is overwritten by its
own colour byte and the cursor is snapped across to the glyph plane anyway. drawTextRun,
blankNextLine and paintGlyphOverBlankInColourThenStepCursor all do it this way, so a reader who
"tidies" any of them into a save-and-restore changes what they do. [code]

Two sets of words are needed for positions, because text and memory run at right angles. A *memory row*
is 32 consecutive addresses and a *memory column* is 32 cells a stride of 32 apart; the pen, the flood
and the shot lists below work in rows and columns. Text runs the other way: the cursor steppers
advanceCharCursor 0x0020 [seen] and retreatCharCursor 0x0028 [seen] move one character place along a
line by subtracting or adding 32, so a *text line* is a memory column, a caption runs *down* memory in
steps of 32, and the next text line is one address on. This is the vertical, side-mounted monitor
gameplay.md describes, seen from the code's side. The two steppers are exact inverses on the same axis,
which is what lets a digit painter step back and have its caller's step forward net to nothing (below).
Both are single-byte restart vectors, so the whole text system leans on them. [code]

Three kinds of blank glyph are used, and all three are empty tiles in the tile ROM: 0xF1 is the
ordinary blank that captions, wipes, the meter and the pen use; 0x20 is the blank the shot-erasing list
writes; 0x52 is a blank that ends one caption. [code]

### The command ring: the interrupt asks, the foreground draws

Almost no game logic writes text directly. The frame's logic runs inside the vertical-blank service, and
anything that needs characters drawn is *posted* as a two-byte request — a command byte and an argument
— onto a 64-cell ring, COMMAND_RING 0xAC00 [seen]. The machine's foreground, the loop the cold start
ends in, spends its whole life draining that ring. So captions, score digits, the emblem strip and the
round tally are all painted between interrupts, one request at a time, in the order they were asked for.
[code]

postCommand 0x0038 [seen], itself a restart vector, appends a pair at COMMAND_WRITE_CURSOR 0xA9B2
[code]. A ring cell is *free* while its high bit is set; the ring is filled with 0xFF at cold start and
each consumed cell is set back to 0xFF. If the cell the write cursor names is still occupied the pair is
dropped silently — nothing reports the loss — otherwise both bytes go in and the cursor moves two cells
on, wrapping inside the 64. enqueueFixedCommandOnRing 0x0B46 [seen] is a fixed wrapper that always posts
command 1 with argument 31. [code]

runCommandRingDrainLoop 0x0B93 [seen] is the foreground loop. It looks at the cell COMMAND_READ_CURSOR
0xA9B3 [seen] names; while that cell is free it simply looks again, and it has no exit of its own. An
occupied cell yields a command and an argument, and *both* cells are freed before anything runs, so a
handler may post a new request into the very pair it came from. The low nibble of the command indexes
sixteen handler words at COMMAND_HANDLER_TABLE 0x0BBC; the handler receives the argument, and when it
returns it comes back through enterCommandRingDrain 0x0B90 [seen], which drops straight back into the
loop. The sixteen slots decode as follows. Command 1 goes to drawTextRunByIndex 0x0BF2 [seen], a caption
in its own recorded colour; command 2 to drawCaptionInPenColour 0x0C0F [seen]; command 3 to
eraseTextRunByIndex 0x0C39 [seen]; command 4 to awardScoreToPlayer 0x0C90 [seen]; command 5 to
drawEmblemStripThenGuardImage 0x4D72 [seen]; command 6 to drawCountAsPictogramStrip 0x0DD7 [seen];
command 7 to drawRoundNumberCaption 0x0EAC [seen]; command 10 to drawCaptionFivePastSharedColour 0x3421
[seen]; and command 11 to drawCaptionTenPastSharedColour 0x0C23 [seen]. Command 0 points at a handler at
0x0BDD and commands 8, 9 and 12-15 all point at a lone return at 0x0BDC; none of them is ever posted
(see the last subsection). [code]

### Captions: one record table, five ways to paint it

All fixed text comes from CAPTION_RECORD_TABLE 0x0C50, thirty-two word pointers to records scattered
through the program image. A record opens with the glyph-plane cell the caption starts at (a word), then
one colour byte, then a run of glyph codes ended by the terminator 0xB9, which is tested before anything
is written, so it is never painted and an empty run paints nothing. The common painter is drawTextRun
0x0BFF [seen]: each glyph goes into the cell the cursor names, the caller's colour into the same cell of
the colour plane, and the cursor steps one place along the line. [code]

The caption commands differ only in where the colour comes from, and that is the whole point of having
several. Command 1, drawTextRunByIndex, uses the colour stored in the record. The other three painters
step over the stored byte and derive the colour from PEN_COLOUR 0xAD0C [seen] instead:
drawCaptionInPenColour takes its low four bits, drawCaptionFivePastSharedColour adds 5, and
drawCaptionTenPastSharedColour adds 10, each cut back to four bits — three offsets spaced evenly round
the sixteen-colour wheel the mask implies. Posting the same caption through commands 2, 10 and 11 in
turn therefore redraws it in three related colours, which is how the round intro flashes the era year.
★ **The flashing is three handlers taking turns, not one handler cycling.** Each handler paints one
fixed colour for a given PEN_COLOUR, and PEN_COLOUR is not a frame counter: it is written only from the
era's colour table, the fixed values 5 and 0 and the player's saved copy, so it holds still across a
flash; watched under MAME, each handler painted a given era caption at one and only one value of the
cell. [seen] Command 3, eraseTextRunByIndex, walks the same run but writes only the blank 0xF1, one
plane only — the erased cells keep their colour — so it erases any caption of the same length at the
same cell, whatever that caption said. [code]

The glyph codes are not ASCII; they are a scrambled alphabet. The digit table (below) fixes ten of them,
and reading the rest by consistent substitution across all thirty-two records, checked against the tile
ROM's glyph shapes, decodes the table as follows. [code] Records 0 and 31 are both "© KONAMI 1982" at
the same cell, 0 in colour 0x10 and 31 in colour 5; flashCopyrightLine 0x0B39 [seen] posts one or the
other through command 1 by the low bit of FRAME_TICK 0xA980 [seen] (31 on even ticks, 0 on odd), so the
copyright line alternates between the two colours every time the title steps call it. Record 1 is
"PLAY", 3 "PLEASE DEPOSIT COIN", 4 "AND TRY THIS GAME", 5 "HI-SCORE", 6 "1-UP", 7 "2-UP", 8 "CREDIT" and
13 "FREE PLAY" (8 and 13 share one cell, so one simply overwrites the other). Records 15 to 18 are the
bonus lines "1ST BONUS 10000 PTS.", "AND EVERY 50000 PTS.", "1ST BONUS 20000 PTS." and "AND EVERY 60000
PTS." — the exact bonus settings the dip switches select, which is a strong check that the bytes really
are glyphs; 19 is "SCORE RANKING TABLE", 12 "INPUT YOUR INITIALS" (closed by the blank 0x52), 22 "PUSH
START BUTTON", 23 "ONE PLAYER ONLY" and 25 "ONE OR TWO PLAYERS". In play, record 2 is " READY ", 9 and
10 are "PLAYER 1 " and "PLAYER 2 " (same cell, same length), 11 is "GAME OVER", and 14 is "STAGE" padded
with three blanks. Records 26 to 30 are the era years 1910, 1940, 1970, 1982 and 2001, each behind a
three-glyph prefix no other caption uses — the era's "A.D." [guess] — all seven glyphs long and all at
the same cell, 0xA673, which is also where " READY " sits. [code]

★ **Two records are not text at all, though the same routine paints them.** Records 20 and 21 are
eighteen-glyph rows on adjacent lines (0xA708 and 0xA709) whose colour byte is 0x32: the 0x20 bit
selects the second 256-tile bank, and decoded there the bytes are pieces of a shaded picture drawn in
three pen levels — a byte is a piece of a larger shape, not a letter. Together the two rows are a title
graphic [guess]. Anyone reading "draws text" as the routine's whole meaning will misread these two.
Record 24 is empty — a start cell and a colour and nothing else. [code]

Because the records live wherever there was room in the image, some of them sit where code might be
expected. Record 19's bytes are at 0x004F, among the restart vectors. Record 9's record is at 0x0167,
which is also the landing loc_0167 [code] that the whole-plane wipe's tamper check jumps into as if it
were code; record 4's record at loc_49fa 0x49FA is the landing of another; and record 7's record at
0x2509 is where the stage-number painter's own check jumps (below). On a genuine image none of these
derails is ever taken, so those bytes are only ever read as captions. [code]

### Which caption appears when

The title screen is laid out by buildCopyrightScreenThenVerifyImage 0x083E [seen], which requests the
copyright line and posts, through command 1, records 0, 1, 3, 4, 5, 6, 7, 20 and 21 — copyright, PLAY,
the coin invitation, the score headings and the title graphic. While it holds,
holdCopyrightThenEraseTheCoinInvitation 0x1748 [seen] re-stamps the copyright sprites and re-requests
the flashing copyright line every frame, counts SEQUENCE_DELAY 0xA9EB [seen] down, and on expiry samples
one copyright cell into a tamper witness and posts two erases, records 3 and 4, the coin invitation.
So the invitation holds for 256 frames and vanishes on a single frame, all thirty-six of its cells at
once, while the copyright line keeps its own repaint straight through that frame and past it. [seen]
showCreditLine 0x2D3F [seen] repaints the credit count and posts record 8, "CREDIT", unless FREE_PLAY
0xA9C0 [seen] is set. armAttractScreenShowingHighScore 0x15FE [seen] posts records 5, 6 and 7 again, a
round tally of one (command 6, argument 1), paints the high score, writes glyph 0x13 — the digit
table's zero — into HIGH_SCORE_MARKER_CELL_UPPER 0xA6E1 [seen] and HIGH_SCORE_MARKER_CELL_LOWER 0xA701
[seen], and posts record 13, "FREE PLAY", only on a free-play machine.
paintReadoutsThenSampleWitnessOrDerail 0x176A [code] posts record 19 and paints the ranking table.
[code]

Once a credit is in, postAttractInfoCaptions 0x1830 [seen] posts PLAY, the title graphic, the bonus-line
pair chosen by BONUS_LIFE_SETTING 0xA9C3 [code] (records 15/16 when it is zero, else 17/18), PUSH START
BUTTON and the copyright line, then "ONE OR TWO PLAYERS" with two or more credits or "ONE PLAYER ONLY"
with one. stepCopyrightScreenAwaitingStart 0x07E6 [seen] waits while the credit count is exactly one
and, once it is not, posts record 25 and steps on. [code]

In play the text comes from the round engine. postRoundStartCaptionsAndResetPlayfield 0x0774 [code]
opens each life. In the demo (PLAY_ACTIVE 0xAD30 [seen] clear) it posts only " READY " in the pen
colour; in a real game it posts "PLAYER 1" or "PLAYER 2" by ACTIVE_PLAYER 0xAD32 [seen] in the pen
colour, then — when ROUND_ARMED 0xAD0E [seen] says a round is starting — command 7, the stage number,
and otherwise " READY ". It then repaints the kill meter and resets the playfield. Before posting it
XOR-folds the 256-byte span at ROUND_START_CHECKSUM_BASE 0x4C99 [code]; any total but the genuine one
bumps the outer sequence phase. [code]

drawRoundNumberCaption draws record 14, "STAGE", in the pen colour, backs the cursor up two places into
the padding, and paints ROUND_NUMBER 0xAD01 [code] as two digits with a leading zero dropped: the tens
go through paintDigitDroppingLeadingZero 0x0EEB [seen] with an allowance of one. That painter suppresses
by a different mechanism from the score printer's: for a zero with allowance left it writes *nothing*
and steps the cursor back, so the caller's following step forward nets to zero and the ones digit
lands where the tens would have been — the number shifts rather than being padded. A round number of
100 or more draws nothing at all, and the command's argument is ignored: the routine reads ROUND_NUMBER
itself. It closes by summing sixteen bytes of the program image from 0x1748 onto a fixed seed; any
total but zero jumps into caption record 7 at 0x2509. [code]

flyRoundIntroFlashingEraYearThenEraseIntroCaptions 0x16AF [code] runs the frames that follow, flying
the ship over the scenery. While ROUND_ARMED holds, the low nibble of FRAME_TICK picks a command every
sixteen frames — 2 at nibble 0, 10 at nibble 5, 11 at nibble 10 — each posted with argument ERA_INDEX
0xAD04 [seen] plus 26, so the era year is redrawn in the pen colour, then five past it, then ten past
it, and flashes through three colours. On odd frames SEQUENCE_DELAY counts down; when it expires the
routine erases records 9, 14 and 26 through command 3 — which, because erasure only counts glyphs,
clears "PLAYER 1" or "PLAYER 2", "STAGE nn" and whichever era year or " READY " was showing — clears
ROUND_ARMED, reloads the delay with 42 and steps the sequence. Each frame it also folds the span
loc_4d9f [guess] into SEQUENCE_PHASE 0xA9AB [seen] with a subtract-then-XOR that nets to nothing on a
genuine image. [code]

At the end of a game postGameOverBanner 0x1253 [seen] posts "PLAYER n" in the pen colour (command 2) and
"GAME OVER" five past it (command 10), and holds for 180 counts of SEQUENCE_DELAY; in the demo it posts
nothing and restarts the attract sequence instead. fileScoreAfterGameOverHoldElsePassTurn 0x330B
[code] then waits out that delay and tries to file the score (below). A score that ranks nowhere gets
its two captions erased (command 3, records 9 and 11), the sub-step is reseated from the program byte
SKIP_INITIALS_SUBSTEP_SEED 0x0843 [code] (11, the wait-then-pass-turn arm), and the turn moves on.
[code]

### Numbers on the screen

Digits come from DIGIT_GLYPH_TABLE 0x0DCC: eleven glyph codes, the digits 0-9 and then the blank 0xF1 at
entry 10. A second table, DIGIT_GLYPH_TABLE_2 0x0F06, holds ten different codes whose tiles draw the
identical digit shapes; only the stage number uses it. [code]

★ **The digit painters print DECIMAL, not hexadecimal.** They mask a value to four bits and their
callers split a byte into high nibble then low, which invites the reading that they print bytes in hex.
They do not: the table is only eleven bytes long, and the five indices the mask lets through beyond it
reach into the first bytes of drawCountAsPictogramStrip's code, which decode as tiles to two blanks, a
full stop, an unrelated shaded shape and a second "3". The table covers exactly the digits a
packed-decimal byte can hold, which is how the machine keeps every counter it shows; holding a displayed
field at 0xAB, 0xCD and 0xEF under MAME drove the painter through all six unused indices and it painted
exactly those bytes. [seen]

Two single-digit painters feed everything else. paintUnsuppressedDigit 0x0D90 [seen] always paints.
paintSuppressedDigit 0x0DAF [seen] carries a flag the caller owns: a non-zero digit paints itself and
bumps the flag, and a zero paints entry 0 once the flag is set but, while it is still clear, paints the
entry whose index is read from the program byte LEADING_ZERO_BLANK_GLYPH_INDEX 0x3246 (10, the blank).
paintTwoSuppressedDigitsFromByte 0x0DA0 [seen] and paintTwoUnsuppressedDigitsFromByte 0x0D81 [seen]
paint both nibbles of one packed-decimal byte, high first. [code]

paintSixDigitFieldSuppressingLeadingZeros 0x0D73 [seen] is the score printer: it walks three packed
bytes from the most significant down, sends the first four digits through the suppressing painter with
one shared flag cleared before the first digit, and paints the last two plainly, so leading zeros vanish
across the whole field but a score always shows at least its final "00". Three thin entries fix its
arguments: paintPlayerOneScoreReadout 0x0D57 [code] (PLAYER1_SCORE_HI 0xAD35 [code] into
PLAYER1_SCORE_READOUT_BASE 0xA781), paintPlayerTwoScoreReadout 0x0D61 [seen] (PLAYER2_SCORE_HI 0xAD38
[code] into PLAYER2_SCORE_READOUT_BASE 0xA501) and paintHighScoreReadout 0x0D6B [code] (HIGH_SCORE_HI
0xA98D [code] into HIGH_SCORE_READOUT_BASE 0xA641), all in colour 0x10. paintCreditCountPanel 0x4AFB
[seen] paints CREDIT_COUNT 0xA986 [code] as two unsuppressed digits at CREDIT_COUNT_READOUT_CELL 0xA47F
in colour 0x10, so an empty machine shows "00" rather than a blank. [code]

Scores change only through command 4. awardScoreToPlayer does nothing unless PLAY_ACTIVE is set — the
demo never scores. A non-zero argument indexes three-byte packed-decimal awards at SCORE_AWARD_TABLE
0x0D27, which decode as 100 times the argument for 1-9, then 1,000, 1,500, 2,000, 3,000, 4,000 and 5,000
for 10-15. The award is added into the active player's score starting at its low byte (PLAYER1_SCORE_LO
0xAD33 or PLAYER2_SCORE_LO 0xAD36, [code]), the score is compared with the high score from the top byte
down, and if it now leads it is copied into HIGH_SCORE_HI and the high score is repainted; the player's
own readout is always repainted. Argument 0 is a separate arm that only redraws the headings: in a
two-player game (TWO_PLAYER_GAME 0xAD31 [code]) it draws "1-UP" and "2-UP" with both scores; in a
one-player game it draws the caption whose index is the program byte SOLO_SCORE_LABEL_INDEX 0x0B31 (6,
"1-UP"), paints player one's score, erases the caption indexed by ABSENT_SCORE_LABEL_INDEX 0x15C6 (7,
"2-UP"), and blanks the six cells of the second score. [code]

The awards posted line up with gameplay.md's scoring chart. postChainedHitScore 0x51DE [seen] posts
argument 1 (100) for an isolated kill; a kill arriving while CHAIN_WINDOW 0xA99D [seen] is still
counting steps CHAIN_STEP 0xA99E [seen] and posts that step modulo eight plus one, so closely spaced
kills climb through 200, 300 and on to 800 and wrap back to 100. Either way the window is reloaded to
30. postNextParachutistBonus 0x4831 [code] takes the slot's step number and posts the arguments at
PARACHUTIST_BONUS_ARG_TABLE 0x484F — 10, 12, 13, 14, that is 1,000, 2,000, 3,000, 4,000 — and 15 (5,000)
for every rescue past the fourth, gameplay.md's parachutist ladder.
advanceHitSoakingObjectThenAnimateDeath 0x3B94 [seen] posts 11 (1,500), the middle-size bomber's value;
stepMotherShip, reached from armMotherShipOrStep 0x43B7 [seen], posts 13 (3,000), the Mother-Ship's,
from its destroyed-ship arm, and 2 (200) once for each slot it re-seeds; driveObjectAppearanceByPhaseBand
0x2C31 [seen] posts 12 (2,000). armRoundStartThenStepSequence 0x27B1 [seen] zeroes both scores at a game's start and posts
argument 0 to redraw the headings. [code]

The ranking table is five labelled rows. paintFiveLabelledNumericReadouts 0x4BDC [code] hands each
eight-byte record of the high-score table — HIGH_SCORE_TABLE_BASE 0xAB08 through HIGH_SCORE_REC4_BASE
0xAB28, all [code] — to paintLabelledNumericReadoutColumn 0x4C1F [seen] with its own start cell
(HIGH_SCORE_REC0_CURSOR 0xA711 to HIGH_SCORE_REC4_CURSOR 0xA719, a line apart; [code]) and its own
colour (0x14, 0x16, 0x12, 0x15, 0x13). Each row begins with three glyphs chosen indirectly: the record's
rank byte, times the record size of three, indexes READOUT_PICTOGRAM_TABLE 0x4CB4 — "1ST" to "5TH".
Then, four places on, comes the six-digit score from the record's three score bytes through the score
printer, and then, three places on, the record's three name glyphs; the record is walked strictly
forward, rank, score, name. Every glyph store is paired with a store of the row's colour to the same
cell with bit 0x400 cleared, so the colour plane is reached by arithmetic, not by a second cursor.
[seen] The defaults at DEFAULT_HIGH_SCORE_TABLE 0x4BB1 are 10000, 8800, 8460, 6520 and 4300, with names
"K.O", "N.A", "M.I", "O.O" and "Y.A". [code]

### The kill meter

gameplay.md's "scale at the bottom of the screen" is drawKillMeter 0x0809 [seen], and it is the kill
quota drawn, not a timer. The era selects a ten-byte row of KILL_METER_GLYPH_ROW_TABLE 0x087C: two bar
glyphs, then eight end glyphs. The number of bar cells is KILLS_REMAINING 0xAD02 [code] divided by four
(five bits of it); they are laid from KILL_METER_BAR_START_CELL 0xA79F one place at a time with the two
bar glyphs alternating, then comes the end glyph chosen by the low three bits of the count, then one
blank. So each cell stands for four kills and each alternating pair for eight. Read against the tile
ROM, the two bar glyphs of a row are the two halves of one small era-specific picture, and the end
glyphs are those halves with rows missing — entries 0 and 4 blank, the others progressively fuller — so
the meter shortens one kill at a time, not one cell at a time. drawKillMeter writes the glyph plane
only. [code] Forcing the count alone under MAME confirms the rendering: two values four apart differ in
exactly one character cell at the bottom of the glass and nowhere else. [seen]

Its colour comes from blankFourteenCharCells 0x07D2 [seen], which blanks the fourteen cells from the
same start cell and colours them 0x16. Fourteen is exactly what the default quota fills: the byte at
DEFAULT_KILL_QUOTA 0x0874 is 0x38, 56, the manual's 56 enemies, and 56/4 is 14. The blank runs when a
player's turn is loaded (loadActivePlayerContextAndPostRoundHud 0x4C75 [seen]) and during the
round-start sweep; the meter itself is redrawn at every round start and on every pass of
serviceRoundThenResolvePlayerState 0x1199 [seen]. [code]

### The emblem strip and the round tally

Commands 5 and 6 share one line of the plane from opposite ends. drawEmblemStripThenGuardImage, gated on
PLAY_ACTIVE, stamps up to six two-by-two emblems (glyphs 9-12, colour 0x18) down the line from
EMBLEM_STRIP_TOP 0xA783 through stampTwoByTwoTileBlock 0x4DAF [seen], then blanks the rest of the line
down to EMBLEM_STRIP_FLOOR 0xA623 with paintGlyphOverBlankInColourThenStepCursor 0x4DCF [seen] (glyph
and neighbour both 0xF1, colour 0x10), and finally XOR-folds a 256-byte span of the program image as a
tamper check. Its argument is a count of reserve ships: loadActivePlayerContextAndPostRoundHud posts
LIVES_REMAINING 0xAD00 [seen] less one, and awardBonusLifeAtScoreMark 0x4DDE [seen] posts the count
from just before it adds the extra life. [code]

drawCountAsPictogramStrip paints the other end. loadActivePlayerContextAndPostRoundHud posts
ROUND_NUMBER to it, and the attract screen posts a constant 1. The value is clamped to 99 and broken
greedily into thirties, tens, fives and ones; from COUNT_PICTOGRAM_STRIP_START 0xA463 it lays the ones
first as single glyph 0x01 (colour 0x13, through drawSlotWithOneGlyph 0x0E8D [seen]), then fives as
two-cell glyph 0x32/0x33 (colour 0x11, paintDoubleTile 0x0E9C [seen]), then tens and thirties as
four-cell blocks from 0xCE and 0x23 (colours 0x16 and 0x11, paintQuadTile 0x0E70 [code]), and pads with
blanks up to EMBLEM_STRIP_FLOOR — the floor the emblem strip blanks down to. The two strips meet there,
and the tally strip is fourteen places long whatever the value. Its closing check folds three words of
the program image and restarts the machine on a bad total. [code]

### Wiping the plane

blankNextLine 0x01C2 [seen] blanks one text line — a memory column of 32 cells, glyph 0xF1, colour 0x10
— at BLANK_LINE_CURSOR 0xA989 [seen], moves the cursor one address on to the next text line, counts
BLANK_LINES_LEFT 0xA988 [seen] down and reports when it reaches zero. Two setups aim it.
armWholePlaneWipeThenDerailOnATamperedImage 0x019A [seen] points it at CHAR_PLANE_BASE with 32 lines —
the whole plane — and is started by startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase 0x15E2 [seen],
which seats the sub-step from the program byte WIPE_SUBSTEP_SEED 0x1749 (6). That lands on
armAttractScreenShowingHighScore, which erases one line per frame and only lays out its screen on the
call that clears the last. armLineWipeFromFifthLine 0x01B5 [seen] points it at BLANK_LINE_START_CELL
0xA404, the fifth line, with the count read from the program byte BLANK_LINES_COUNT 0x0CCD (27);
parkSpritesAndArmLineWipeThenAdvanceSequence 0x181E [seen] arms it as the credit screen begins and
blankOneLineThenGuardBlockOrDerailSequence 0x2CDB [seen] runs it a line per frame, folding a 1,024-byte
span when the last line goes. So the first four text lines and the last one survive the credit screen's
wipe. [code]

At power-on, before any of this, tileCharPlaneWithBoxLattice 0x00B1 [seen] covers the plane with a
lattice of boxes: fourteen bands of sixteen two-by-two blocks, each stamped by stampGridBox 0x00C7
[seen] from four fixed glyphs (86, 131, 199, 239) that decode through the tile ROM as the four corners
of one closed 16-by-16-pixel box. The bands lie on consecutive pairs of memory rows from row 2 to row 29,
leaving the first two and last two rows untouched, so the plane shows a grid of hollow boxes sixteen
across and fourteen down. [code] It really reaches the glass and really goes: under MAME the full
pattern stands for about three and a half seconds of a cold machine, until the boot wipe (which cannot
start before the first interrupt) clears it, once per power-on. [seen] Nothing in the game draws on it
and nothing restores it. [code]

### The pen and its radial sweep

The biggest thing the plane ever draws is a sweep drawn by a "pen": a glyph and colour, PEN_GLYPH 0xAD0B
[seen] and PEN_COLOUR 0xAD0C [seen], stamped cell by cell along straight lines. plotPenCell 0x026F
[seen] stamps the pen glyph into the cell named by PEN_ROW_CELL 0xA9E4 [seen] and PEN_COLUMN_CELL
0xA9E6 [seen] — the row masked to five bits and multiplied by 32, plus the column, from CHAR_PLANE_BASE —
puts PEN_COLOUR into the same cell of the colour plane, and hands the address back. [code]

drawInterpolatedPenRun 0x0201 [seen] draws one whole line per call. Its position is two 8.8 values,
PEN_ROW_POS 0xA9E3 [seen] and PEN_COLUMN_POS 0xA9E5 [seen], whose high bytes are the row and column
cells just named. It stamps the start cell, computes a signed per-step increment of one sixteenth of
the distance to the target — PEN_ROW_STEP 0xA9E7 [seen] and PEN_COLUMN_STEP 0xA9E9 [seen] — and plots
cell after cell until the cell it has just stamped is the end cell. The target and end are program
words, not variables: PEN_ROW_TARGET 0x32F5 and PEN_COLUMN_TARGET 0x0B45 hold row 16 and column 17, and
PEN_RUN_END_CELL 0x14B2 holds 0xA611, that very cell. Every line therefore runs to the same point, the
middle of the plane. It then steps PEN_ROUTE_LEG 0xA9E2 [seen], reads the next start point from
PEN_ROUTE_TABLE 0x0290 (row in the low byte, column in the high), reseats the pen there with the
fractions cleared, and reports whether the new row is zero.
armThePenRouteThenColdStartOnATamperedImage 0x01E1 [seen] resets the leg to zero and the position to
PEN_ROUTE_START_ROW 0x0D45 / PEN_ROUTE_START_COLUMN 0x280C, row 16 column 4, then sums a 256-byte span
and cold-starts the machine on a bad total. [code]

The start points walk once round the border of the rectangle from row 2 to row 29 and column 4 to
column 30, one cell at a time — the armed start at row 16 column 4 and 105 more from the table, 106 in
all, exactly the rectangle's perimeter — and then comes a row-zero sentinel. One call per frame draws
one spoke from the border to the centre, so over 106 frames the pen sweeps round the screen like a
clock hand and covers the whole rectangle. The pen's glyph is always the blank 0xF1, so what the sweep
actually changes is the colour of every cell it crosses. [code]

The colour decides what the sweep means. setSavedPenFromEra 0x339C [seen] and
seatCaptionPenFromEraFoldingTamperIntoPhase 0x335E [seen] read a glyph/colour pair for the player's era
from the table at 0x0F8D: blank 0xF1 with colour 1, 2, 3, 4 or 5 for eras 0-4. The first writes only the
player's saved copy; the second seats the pair into the live pen and the saved copy
(PLAYER_ONE_PEN_GLYPH 0xAD1B [seen] or PLAYER_TWO_PEN_GLYPH 0xAD2B [code]), arms the pen route, and,
when the colour was already in the pen, steps the sequence an extra time, skipping the sweep entirely —
the screen only sweeps when the era's colour changes. blankCaptionThenAdvancePenRunStep 0x5BD7 [seen]
is the sweep step of the round engine: it blanks the meter's fourteen cells and draws one spoke per
frame, and when the sweep closes it folds two guard spans and steps on. In the attract sequence
erasePenRouteThenAdvanceStep 0x074B [seen] sets the pen to colour 5 (again skipping the sweep if it was
already 5) and advancePenRunAnimationStep 0x1734 [seen] draws it; after a filed high score,
fileScoreAfterGameOverHoldElsePassTurn sets colour 0 and erasePenRouteThenOpenInitialsEntry 0x08B4
[code] draws it. With a blank glyph, a palette's background pen is all that shows, so each era's colour
is plausibly its sky colour and the sweep is the time-warp changing the sky [guess]. [code]

### Initials entry

A score that ranks is filed by fileScoreIntoHighScoreTable 0x4CC3 [seen], which slides the lower records
down, writes the score and three blank name glyphs into the freed record, renumbers the rank bytes, and
leaves SCRATCH_PTR_A 0xA991 [seen] on the new record's name bytes and SCRATCH_PTR_B 0xA993 [seen] on the
screen cell of that row's name, HIGH_SCORE_INITIALS_CELL_BASE 0xA531 [guess] plus two per rank.
fileScoreAfterGameOverHoldElsePassTurn requests a sound, arms the colour-0 sweep, and adds up the
256-byte span at HIGH_SCORE_FILED_CHECKSUM_BASE 0x01F1 [code], bumping the outer phase on a bad total.
[code]

erasePenRouteThenOpenInitialsEntry draws one spoke a frame until the sweep closes, then XOR-folds the
256-byte span at INITIALS_ENTRY_CHECKSUM_BASE 0x4880 [code] (a bad total derails into the middle of the
frame service's entry at 0x00D9), posts "SCORE RANKING TABLE", the copyright line, the title graphic
and "INPUT YOUR INITIALS", paints the five ranking rows, zeroes INITIALS_BACK_PRESS_HISTORY 0xA995,
INITIALS_FORWARD_PRESS_HISTORY 0xA996, INITIALS_COMMIT_PRESS_HISTORY 0xA997,
INITIALS_ALT_COMMIT_PRESS_HISTORY 0xA998 and INITIALS_LETTER_INDEX 0xA999, sets INITIALS_SLOTS_LEFT
0xA99A to 3, stamps the first letter at the cursor cell, and keeps that cell's existing colour in
INITIALS_LOCKED_LETTER_COLOUR 0xA990 (all [code]). [code]

stepHighScoreInitialsEntry 0x18C3 [code] runs the entry. Letters come from INITIALS_LETTER_GLYPH_TABLE
0x12C7 [code], an alphabet of its own glyph codes whose tiles draw the same shapes as the captions'
letters; the index runs round a ring of 27 — A to Z and a full stop, the same shape as the stops in the
default names. On even frames it reads the control byte of the panel facing the screen
(readPlayerControls 0x1ED1 [seen] picks IN1_MIRROR 0xA9AF or IN2_MIRROR 0xA9B0 [code] by
SCREEN_UNFLIPPED 0xA987 [seen]) and shifts bits 0, 1, 4 and 5 into the back, forward, commit and
alternate-commit histories. A press counts only when its history's last three samples read "now, not
before, not before". A fresh press on either commit history locks the shown letter into both the screen
cell and the record, colours the cell with the locked colour, moves both pointers on, and either
finishes (no slots left) or starts the next slot at A. A fresh forward or back press steps the letter
round the ring and redraws it in colour 0x10. A held control repeats because a saturated history is
emptied by rearmHeldControlRepeat 0x1980 [seen] — forward at 0xFF, back at 0x7F, so held forward repeats
every eight samples and held back every seven. That bits 0 and 1 are the stick's two stepping directions
and bits 4-5 the fire button and its partner is [guess]. On odd frames INITIALS_CURSOR_FLASH_TIMER
0xA99C [code] counts up and its 0x10 bit flashes the cursor cell between colours 0x14 and 0x10. [code]

The entry clock is SEQUENCE_DELAY, ticked every eighth frame. It arrives here at zero, so the first
entry gets 256 ticks; running out blanks the cursor cell and finishes the entry. Finishing reloads the
delay with 60, requests the transition sounds and steps on to loc_12e2 0x12E2 [seen], which counts those
60 down and then passes the turn. Meanwhile, if both PLAYER_ONE_LIVES 0xAD10 [seen] and PLAYER_TWO_LIVES
0xAD20 [seen] are zero, a start press cuts the entry short and starts the next game: on free play any
start button, otherwise one credit takes only the one-player button and two or more take either. [code]

### The round-won band animation and the colour flood

When a round is won in a real game, advanceRoundWhenFieldCleared starts the next round and reseats the
sub-step from NEXT_ROUND_START_SUBSTEP 0x4A35 (13), and the plane plays a small scripted animation. (In
the demo a cleared field returns to the attract sequence instead, so the demo never plays it.)
paintSelfTestScreenPhaseThenStepSequence 0x4A0F [code] sets it up: it stocks the block that begins at
INTRO_ANIMATION_STEP 0xA9F0 [code] — the step from the program byte SELFTEST_INTRO_SHAPE_SEED 0x3213
[guess] (0), PLAYER_FLASH_TICK 0xA9F1 [code] 0, BAND_TO2_PASS_COUNTDOWN 0xA9F2 [code] 0xFF,
SPRITE_COLOUR_CYCLE_COUNTDOWN 0xA9F3 [code] 4, BAND_TO4_PASS_COUNTDOWN 0xA9F4 [code] 0xFF,
COLOUR_FLOOD_COUNTDOWN 0xA9F6 [code] 8, and BAND_SCRIPT_CURSOR 0xA9F7 [code] aimed at the script at
SELFTEST_CONTROL_BLOCK_PARKED_POINTER 0x56F1. It seeds the plane's first memory row, the 32 bytes from
CHAR_PLANE_BASE, with a picture (thirteen 0x14, two zeros, thirteen 0x14, four 0x0E) that the animation
keeps as its backing copy, colours the band in PEN_COLOUR plus 0xA0, 0x20, 0xE0 and 0x60 — the second
tile bank, with different flip bits for each half, so the band is one graphic mirrored about the centre —
and sets the player's saved pen from the era. [code]

The band is the plane's centre memory column: CHAR_PLANE_COLUMN_BASE 0xA451 heads 28 cells a memory row
apart down column 17, split into an upper run ending at CHAR_PLANE_UPPER_RUN_BOTTOM 0xA5D1 and a lower
run from CHAR_PLANE_LOWER_RUN_TOP 0xA631 to CHAR_PLANE_LOWER_RUN_BOTTOM 0xA7B1, with a two-line block
across columns 16-18 at the middle — CHAR_PLANE_STUB_LEFT_TOP 0xA5F0 [guess], CHAR_PLANE_COLUMN_MID_TOP
0xA5F1, CHAR_PLANE_STUB_RIGHT_TOP 0xA5F2 [guess] and the matching bottoms 0xA610 [guess], 0xA611 and
0xA612 [guess]. gatherCharColumnIntoBackingRun 0x158C [code] copies that shape into the first memory
row, restoreColumnFromSavedRun 0x1563 [code] puts it back, and fillCellRun 0x1319 [code] lays one byte
over thirteen cells. [code]

stepRoundStartIntroAnimation 0x1323 [code] runs two frames in every four and steps through
INTRO_ANIMATION_STEP, each stage handing on to the next when its own work is done. Steps 0 and 1 flash
the player's ship white, alternating its sprite colour with zero on every call while keeping the
attribute's two flip bits; at the eighth tick the step moves to 1 and the spawn-flash sound is requested.
Step 1 also runs advanceScriptedCharPlaneBandTo2 0x142A [code]. Step 2 cycles the ship's colour between
two values every fourth call on its own countdown and moves to step 3 when that runs out, while
advanceScriptedCharPlaneBandTo4 0x14C5 [code] runs in both steps 2 and 3. Each band routine alternates a
blanking pass, which fills the band with 0xF1, with a drawing pass that restores the band from its
backing copy, steps cells' glyph codes by one wherever the script byte is non-zero
(stepThirteenScriptedGlyphCells 0x4A9D [code] walks thirteen cells and thirteen script bytes, one bit of
its argument choosing whether glyphs and script run forwards or backwards, the other whether the cells
are taken a row down or a row up), nudges the centre block by two
further script bits, and gathers the band back. The first grows the band's glyphs up through the script
until it meets 0xFF and sets step 2; the second walks them back down until a byte with any bit above
bit 0 appears, requests the inter-round sounds and sets step 4. The band thus flickers as it grows and
shrinks. [code]

Step 4 is floodColourPlaneWithSavedPlayerColour 0x13CC [code]: it fills the colour plane from
COLOUR_FLOOD_FIRST_CELL 0xA044, 28 memory rows of 27 cells — the same rectangle the pen sweeps — with
the active player's PLAYER_ONE_PEN_COLOUR 0xAD1C [seen] or PLAYER_TWO_PEN_COLOUR 0xAD2C [code], sets
step 5, and counts COLOUR_FLOOD_COUNTDOWN down once (nothing reads it). ★ Its two arms, chosen by the
screen-flip flag, write the identical rectangle with the identical byte, one ascending from the near
corner and one descending from the far corner: the flip changes only the order of the writes, never the
result. The step after reloads SEQUENCE_DELAY with 90, hides every sprite, loads the player's turn and
reseats the sub-step from INTRO_SUBSTEP_RELOAD 0x2750 (3). [code]

### Shots drawn as characters

The player's shots are not sprites; they are drawn into the character plane through two deferred lists
that the vertical-blank service settles every frame. fireAndSweepPlayerShots 0x23E3 [seen] calls
queueTileStampForObject 0x5337 [seen] for each live shot. That routine adds 7 to the shot's two pixel
coordinates, takes the top five bits of each as the cell (from COLOUR_PLANE_BASE, 32 cells to a memory
row) and the low three bits of each as one of 64 records at PRESHIFTED_TILE_RECORD_TABLE 0x53D4: four
glyph/attribute pairs for a two-by-two block, the shot pre-shifted to every pixel offset within a cell,
so the sub-cell shift is resolved by lookup rather than computed. Between the four pairs the cell walks
+1, +31, +1 — across, down a row, across — and it takes that walk whether or not a pair is used. Pairs
with glyph 0 are skipped, so the block can be partly empty but a skipped cell still costs its place; the
rest are appended as four-byte entries (address low, address high, glyph, attribute) at
DEFERRED_WRITE_CURSOR 0xAE00 [seen], whose list DEFERRED_WRITE_LIST 0xAE04 [seen] never leaves its page.
[code]

drainBothDeferredCellLists 0x5286 [seen] first runs blankCellsPaintedLastPass 0x530E [seen] over the
erase list at DEFERRED_BLANK_CURSOR 0xAE80 [seen] / DEFERRED_BLANK_LIST 0xAE84 [code], writing the blank
glyph 0x20 into each cell and leaving its colour; then paintDeferredCells 0x52D2 [seen] writes each
pending glyph and its attribute plus the low four bits of PEN_COLOUR, so shots take on the era's tint;
then it copies the pending list wholesale over the erase list, marks the copied count with the 0x80 bit,
and parks the pending cursor. Where nothing was pending, emptyBothDeferredCellLists 0x526A [seen] parks
both cursors, so a stale erase list is never left behind; the same routine empties the pair at cold
start. Both passes leave alone any cell whose colour already has the 0x10 bit, so a shot flies behind
the scores, the record-coloured captions and the ranking rows without erasing them — though not behind
pen-coloured captions, whose colours never carry that bit. [code]

★ **The pair is not a double buffer.** The copy runs one way, pending onto erase, on every pass and
never back, so the halves never swap; and they hold different jobs rather than alternating ones — one is
the edits to make, the other a record of last pass's edits to take back. What is drawn this pass is
exactly what is erased next pass: under MAME, attributed by program counter over thousands of passes,
the set of cells the blanking walker erased was exactly the set the painting walker had written on the
pass before, in both directions. [seen] Each walker takes its entry count from the low byte of its own
cursor less the four-byte header, divided by four and kept to five bits, after the blank list's walker
has masked away the copy's 0x80 mark. A zero byte count is an empty list, but a non-zero byte count
whose five-bit entry count comes out zero is not: the walk then runs 256 times. [code]

### Sprites that act as captions

Not every caption is characters. stampCopyrightStrip 0x0B06 [seen] parks four sprites, shapes 4 to 7,
side by side sixteen pixels apart from PLAYER_ENTRY 0xAA10 [seen] on; it reads nothing, so every title
step can re-stamp it harmlessly. hideCaptionSprites 0x0B2B [seen] zeroes the four position bytes from
PLAYER_SPRITE_Y 0xAA41 [seen] — the same store that retires an object — to take it away; both game-start
paths, one per start button, and the demo start call it first. Several title steps also copy caption
cells into witness records (sampleCellGlyphAndColour 0x1AFC [seen]; copyThreeTilemapCellsFromBothPlanes
0x4B30 [seen], which reads both planes of each of three cells named by a table at 0x0D1B and keeps the
colour byte and glyph together as a pair; and the six-entry HIGH_SCORE_PATCH_TABLE 0x163F that
armAttractScreenShowingHighScore writes, each seeded with one letter of KONAMI and the marker 5); those
witnesses belong to the image-guard machinery, not to drawing. [code]

### What nothing reaches

paintCaptionColourBandAndStepSequence 0x4A42 [code] is the routine nothing reaches. It is not a separate
piece of code: 0x4A42 falls in the middle of paintSelfTestScreenPhaseThenStepSequence's band setup,
just after the first of the two zero cells that separate its two thirteen-cell runs, so entering there
lays the caller's A over the next cell, a thirteen-cell run of C and a four-cell 0x0E tail, and then
shares the colouring and the pen seating that routine ends with. No word in the program image names
0x4A42. The only instruction that transfers there is a conditional relative jump (`jr c` at 0x4A0C)
that exists only when the glyph bytes of caption record 4 ("AND TRY THIS GAME", at loc_49fa 0x49FA) are
executed as code — the copyright-colour tamper derail — and even on that path the instruction before it
is an AND, which clears the carry the jump tests, so it never fires. On a genuine image the entry is
dead twice over. ★ It is not the repair half of a check-then-repair pair either: the thirteen-cell
colour inspection that seems to lead to it is a tamper check whose failure arm jumps into caption data,
a deliberate crash of the same shape as the game's other traps. [code]

The ring has its own unreached corners. Handler slot 0 of COMMAND_HANDLER_TABLE points at 0x0BDD, a
complete painter that draws a caption's glyphs while leaving every cell's existing colour, but no code
posts command 0; its bytes also open the 256-byte span IMAGE_GUARD_BLOCK_0BDD_BASE 0x0BDD that
blankCaptionThenAdvancePenRunStep folds. Slots 8, 9 and 12-15 point at a bare return at 0x0BDC and are
never posted either. Caption record 24 — an empty record, at 0x3ED2, aimed at cell 0xA692 — is named by
no poster. And the round engine's sub-step 15, loc_15b5 0x15B5 [code], the last slot of the sixteen-arm
table at 0x0F29, is a single return that reads nothing and writes nothing; whether the sequence ever
selects it is not settled here. [code]

## §9 What the code settles

`gameplay.md` ends with two dozen numbered questions the public record could not answer, ordered by
how much a faithful reimplementation depends on them. This section answers the ones the lifted code
can, and says plainly which it cannot. **Every answer here is `[code]` unless marked otherwise** —
derived from the ROM, not watched on a screen.

| # | the question | the answer |
|---|---|---|
| 1 | Is the quota 56 for every era and every loop? | **Yes, always.** One byte, loaded once at boot from ROM. Not era-, loop- or DIP-keyed. The later-round escalation lives in a different cell. |
| 2 | What counts toward the 56? | **Only the seven ordinary enemy-craft slots.** Not projectiles, not the 1940 bomber, not the Mother-Ship, not the pickup. Projectiles still score. |
| 3 | Mother-Ship behaviour | Partly. Two-slot object, armed after a delay, per-era speed. **Hits count from any angle**, and the count **never falls below five across appearances** — the first two hits persist, later ones are undone. Which edge it enters from, and whether it fires, are open. |
| 4 | Does clearing the Mother-Ship pay for the enemies it sweeps? | **Unsettled — the code shows no such payout.** The shot sweep that kills the Mother-Ship posts one chained-hit score for the ship itself and returns; nothing walks the ordinary slots to pay a post apiece or ripple them apart. What the boss's death does to the standing formation needs the real machine. |
| 5 | Does ramming credit the points? Can you ram the Mother-Ship and still advance? | **Both yes, by separate mechanisms.** Ramming an enemy craft posts a score; ramming a projectile does not. Ramming the Mother-Ship zeroes its hit counter, so it dies outright. |
| 6 | The 1940 bomber: three hits or four? | **Four.** The manual is right; StrategyWiki is wrong. |
| 10 | Parachutists in the final era? | **No.** The manager reads the era index and returns immediately. |
| 11 | Is the pickup ladder capped at 5,000? | **Yes, hard.** Four table entries, then the same award for ever. |
| 12 | What resets the ladder? | The routine that places a plane on the field — which covers both a lost life and a new round. |
| 17 | Is the player's speed fixed? | ★ **No.** It steps up twice across the eras, and the public record appears to have missed it. See §3. |
| 18 | Is there an extra-life ceiling at 960,000 and a "survival of the fittest" mode? | ★ **The ceiling is real; the mode is not.** The bonus table simply ends. And rollover restarts the whole ladder. |
| 20 | Score width and rollover | **Six BCD digits, rolls at 1,000,000.** A recorded 15,000,000 is fifteen rollovers. |
| 21 | What happens when you die? | Fully answered, and all of it new — **no invulnerability window**, respawn at the pinned position, and **the kill counter is not reset**. See §6. |
| 22 | Two-player independence | **Yes** for lives, round, era and score, and now watched rather than derived: a two-player MAME run alternated the two players nine times, with each one's score field moving only while it was up. ★ The pickup rung counter is a **shared** cell, masked by the fact that every hand-over clears it. |
| 24 | Is there a timer anywhere? | ★ **Nothing times the player.** The bottom bar renders the kill quota; the source calling it a "time bar" was describing the kill meter. Short countdown cells exist in the interrupt (§2), but none races the player. |

### The pattern in the misses

The public record is not sloppy; it is **outside-in**, and every place it goes wrong is a place
where the inside and the outside genuinely look different.

- It calls the player's speed fixed because **the plane never moves on screen.** The ship is pinned
  and the world is what accelerates, so there is nothing on the glass to measure the change
  against — and the enemies speed up too.
- It reports a "time bar" because a bar that fills toward an event looks like a clock.
- It splits three ways on the bomber's hit count because a counter that starts at three and dies on
  the fourth hit can honestly be described either way, depending on whether you count the one that
  kills it.
- It could not settle what happens on death because **nothing about death is visible except its
  consequences.**

Where the record and the code disagree, the record usually describes the *experience* correctly and
the mechanism wrongly. That is worth remembering when using it as evidence: `gameplay.md` is a
reliable witness to what a player sees and an unreliable one about why.

### What the code cannot settle, and what would

These need the real machine, not more reading: `[code]` is the wrong instrument for all of them.

- **Whether the speed-up is perceptible.** The numbers differ; whether a player can tell is a
  question about eyes.
- **The Mother-Ship's entry edge and whether it fires.**
- **What clearing the Mother-Ship does to the formation it stands over.** The shot sweep pays a
  single post for the boss and nothing for the ordinary slots; whether the machine visibly sweeps or
  pays them on the boss's death is not something the code decides.
- ★ **Whether the Mother-Ship really takes seven hits or eight.** The same arithmetic that gives the
  1940 bomber four hits from a counter of three gives the Mother-Ship eight from a counter of
  seven — contradicting the manufacturer. Flagged rather than published.
- **Formation composition and the bonus window** — the per-era spawn parameter table is not
  transcribed. See §11.
- **What the player actually perceives of the era boundaries**, given that the two subsystems that
  read the era index divide it at different rounds.

---

## §10 What our instruments can and cannot see

Most entries here have already caused a false claim; the rest are limits caught before one could
form. They are recorded as instrument properties, not as history, because each will cause the next
one too.

### ★ The oracle's own fidelity has a scope, and it is narrower than the claim it carries

**This is the most important limitation in the document, because everything else rests on it.**

The translated layer is described as byte-exact against MAME. That is true, and it is scoped: it
holds for routines the golden capture actually **dispatches**. `tools/pixel_suite.py` drives its
tape with `Coin 1` and `1 Player Start` and nothing else — **no fire, no direction** — for
`SECONDS = 30`, `GOLDEN_FRAMES = 1802`. A routine that tape never reaches contributes no evidence in
either direction. It is **unobserved, not verified.** A substantial fraction of the registry is never dispatched under
the golden tape, and no figure for it is quoted here on purpose: the shape is what is durable, and
anyone who needs the number should measure it rather than inherit it.

The consequence reaches the whole idiomatic layer. Each idiomatic module is proved memory-equivalent
**to the translation**, never to MAME directly. Where the tape dispatches, that composes into a
chain back to hardware. Where it does not, it is a proof of agreement with an **unverified
reference** — internally consistent and unanchored.

`games/timeplt/tools/unit_equiv.sh` is the instrument that would close this: per-routine
equivalence, tape-configurable, fire- and direction-capable, 90-second default, entry list rebuilt
from `translated/` at run time. **It is wired into no gate, no Makefile target and no hook, and has
never been shown to run clean.** Recording this gap is not closing it.

The gap was already known in exactly one place. `idiomatic/test/equivalence-5211.test.js` says, in
capitals: *"THE SHARED DRIVEN TAPE IS TOTALLY BLIND TO THIS ROUTINE, AND THAT IS THE HEADLINE. The
coin -> start tape never presses fire, so no shot slot is ever live."* Every artifact carrying the
claim forward stated it unqualified. **A caveat that lives in a test comment and is absent from the
durable record is functionally not known at all** — the next reader inherits the confident version.

★ **But do not over-read the tape's input list, because it mis-states the fix.** The capture is not
thirty seconds of a title screen. The attract **demo runs the real play arm** — the era index
advances during it and it fires — so a substantial amount of gameplay code is dispatched with no
input at all. That is why coverage is a large fraction rather than a sliver. The same test file says
so: *"The real teeth are the undriven ATTRACT demo, which does fire, and a crafted space."*

So the honest form of the gap is not "gameplay is never exercised". It is: **the only gameplay the
oracle has been checked against is whatever the demo happens to do, and the demo is not a player.**
It never collects a parachutist, never dies deliberately, never finishes a round, never reaches the
later eras — and, being one plane, never hands over to a second player, which is a whole branch of
the round machinery the demo cannot enter at all. Adding *any* input would not close this; adding input that reaches **what the demo never
does** would, which is precisely what `unit_equiv.sh`'s tape parameter exists for.

### ★ A driven tape measures the eras it reaches, and it reaches two

The strongest not-reached list this document has produced was wrong about three routines, and the
reason generalises. A tape that coins up, flies and fires never survives four rounds, so it lives in
the first two eras — and whole families of handler are gated on the era with `cp 2` and `cp 4`. On
one sweep three cluster routines read as never dispatched; holding the era cell at 4 while play ran
dispatched them 8225, 38749 and 48894 times.

So a not-reached row is a statement about which ERA the tape lived in before it is a statement about
the code, and the fix is cheap: hold the era and sweep again. The poke has to be written every
frame, not once a second, because a routine that borrows a different rate row writes the era cell
twice in three instructions and leaves it on whatever it last set.

What the technique does NOT reach is anything gated on a round actually ending — see §8.

### A read tap over-counts, because the ROM reads itself

This ROM folds blocks of itself through anti-tamper checksums, and a memory read tap counts a
checksum pass as a hit. Under an ungated sweep, routines two agents had independently proved dark
showed non-zero counts. Any reachability instrument here must gate on the program counter. `[code]`

### A PC-gated tap cannot tell an entry from a loop head

The gate re-triggers on every turn of a wait, so a routine that spins on the beam reports its
iterations as dispatches. The decisive case: an address our own machine measures at **zero**
dispatches reports **54659** PC hits on the real machine, because it lies inside a busy spin and is
never called at all in that run. `[seen]`

**So a PC hit count is a dispatch count only for a routine that does not wait.** For anything that
waits it is an iteration count wearing a dispatch's clothes — which is precisely the class the
raster and sprite-multiplex work lives in. Two agents once produced confident and opposite frequency
orderings for the multiplex twins; both should be disregarded, and nothing available settles it.

★ **There is a way to get a real number out of one of these anyway: count a STORE the block makes,
instead of its entry.** The five sprite-flip blocks are the case. An entry tap on the first of them
read 28910 in a 100 s attract run — the turns of its own beam wait, since its `jr nc` returns to its
own head — while write taps on the two sprite-RAM cells each block publishes read 670, 544, 616, 627
and 501 for the five blocks in that same run. Those are COMPLETIONS: the times a block found a
request pending and got past the wait. The two figures answer different questions, and the spin
count must never be quoted as a dispatch figure. `[seen]`

### ★ A zero whose only control is REMOTE is a weaker zero, and has to be labelled as one

`restartAnimationCounterThenDressFlutterSprite` read zero in every run of the last sweep — undriven attract, a one-player run, a
two-player run and a 300 s driven run. Its three siblings in the same block were tapped in the same
runs and **they are zero too**. So there is no positive control anywhere in that neighbourhood: what
the sweep establishes is that the tap array works, not that it could have caught a hit HERE. A tap
mis-installed on this one address, or a block the array never really covered, would produce exactly
the same page.

Most zeros in this document are not like that. They carry a LOCAL control — a sibling firing through
the same array in the same run, or a twin run in which the same address fires. **Record which kind a
zero is in the same breath as the zero**, because once written down as "0" the two are
indistinguishable, and the weak one will be read as the strong one.

The image explains this zero rather than corroborating it: no reference to the address exists
anywhere in the program image, and the only way in is a relative branch from a sibling arm, taken on
a bit that only that sibling ever sets — a second-visit arm of an animation counter, which needs an
object to survive into a second cycle of what the sibling handles. That is a reason a sweep would
miss it. It is not evidence that nothing reaches it. `[seen]` for the zeros; `[code]` for the
reference count.

### A call-site grep misses computed dispatch, in both directions

The mnemonic form `(call|jp|jr) 0xADDR` misses a call whose target is computed and loaded into a
register first; `0x181d` scores zero by it and is a genuine entry, reached as a pushed return
address that the transcription renders as `m.call(0x181d)`. The `m.call` form in turn misses tail jumps the transcription
renders as something else. **Take the union of both forms and treat even that as a lower bound**,
because table dispatch is invisible to either. A zero from one form alone means "look harder", never
"not an entry". `[code]`

### ★ A transcribed file is not evidence that its address is code

The lift faithfully transcribes whatever bytes it is pointed at. A `translated/loc_<addr>.js`
therefore records that somebody attempted a decode at that address — **never that the address is an
entry point.** Several files in the layer are decodes of *data*: velocity tables reached only by
anti-tamper traps, and caption records sitting a few bytes from a real routine. Several of them
give themselves away by calling addresses outside the ROM entirely.

**No exhaustive determination of this set has been made.** Treat it as open rather than as a list.
The cases below are additions to that set, not a closure of it.

This deserves its own entry rather than a line in the list above, because the misleading artifact is
a **file** — the most authoritative-looking object in the repository. Most other limits on this page
are a measurement lying, and a measurement invites suspicion. A checked-in source file does not,
which is why this one cost a false claim in §8 of this very document and survived hours of drafting
before anything caught it. `[code]`

#### The worked example: one address that refuses to have a single answer

**0x0F8D is read as a table by two routines and jumped to as code by a third.** It has exactly three
references in the image, and they do not agree about what it is.

- 0x0F8C is `c9`, a `ret`. 0x0F8D through 0x0F96 is `f1 01 f1 02 f1 03 f1 04 f1 05`, and real code
  resumes at 0x0F97.
- 0x3381 doubles the selector (`add a,a`), points HL at 0x0F8D and takes the byte there through the
  index-and-fetch restart at 0x0008; it then steps one on and takes the next byte as well.
- 0x33AE doubles the selector, points HL at 0x0F8D, forms the address through the index-only restart
  at 0x0018, and copies exactly two bytes — `ldi` twice.
- 0x5308 is `jp nz,0x0f8d`. The value tested is a byte-sum walked over a block of the ROM by 0x43E8
  and handed down a chain of tail jumps before being compared against 0x67.

★ **The two-byte record is the reading the USING CODE performs, not our reading of the bytes.** Both
readers double the selector before indexing, and both consume two consecutive bytes; the table's own
content agrees, a constant first byte against a second running 1 to 5. Nothing in the bytes says
"two-byte record" — the arithmetic in front of them does, and that is where a code/data
determination has to come from.

★ **And the reference graph cannot settle code-vs-data here, even in principle.** The third
reference arrives only on the arm where that sum fails to match — one of the self-checks §2
describes — so the tamper arm makes the data a jump target ON PURPOSE. An instrument that asks "is
this address the target of a transfer" answers yes, correctly, about a routine that does not exist.
`[code]`

#### A misdecode that MANUFACTURES a call-graph edge

`translated/loc_307f.js` transcribes 0x307F-0x3089 as instructions. Those bytes are a **caption
record**: the first two are a destination in video RAM, the third a colour, and the rest a glyph run
closed by 0xB9 — the terminator `drawTextRun` tests. 0x307F is one entry of the pointer table at
0x0C50 that the caption routines index to choose which one to paint.

★ **Its misdecoded `djnz 0x3074` is the only transfer into 0x3074 in the whole image.** A linear
decode from every byte offset finds that one and no other, and the little-endian word `74 30` occurs
nowhere, so no table names it either. A routine's entry status currently rests on a misdecode. That
is worse than a bad decode sitting inertly in the layer: it manufactures an edge, and anything
deriving entry points from the reference graph inherits it as evidence.

On this evidence 0x3074 is interior rather than an entry. **0x306A-0x3073 is untranscribed**, and it
is that routine's real prologue — two `iy` loads and a pair of immediates into H and L — which the
transcribed body at 0x3074 continues. Its siblings at 0x3058 and 0x308A open with the same two `iy`
loads and reach the same tail at 0x309B, so the family's shape puts the boundary at 0x306A. `[code]`

**0x1F76–0x200B is a five-frame tilemap animation, not code.** Five records of thirty bytes, each
six rows of five tile codes with the blank glyph as the pad, copied into the character plane and
its colour plane by a loop that takes both counts from ROM bytes. A seven-way compare ladder picks
the record from a per-object countdown, and two of the five records are each selected by two of
the seven arms, so the shape grows and then shrinks; the fifth record is entirely blank and erases
it. `translated/loc_1f99.js` and `translated/loc_1f2e.js` are both this field decoded as
instructions and belong on this list.

**0x5254 is not a routine.** It is the loop tail of 0x5211, and `translated/loc_5254.js` is a
second transcription of bytes `translated/loc_5211.js` already carries; the idiomatic layer covers
them inside `destroyTargetsHitByShots`. No pointer anywhere in the image names the address, and
its only inbound transfers are two branches from inside 0x5211's own body.

#### A data table decoded as a hundred bytes of instructions

`translated/loc_2251.js` decodes 0x2251-0x22B8 as instructions ending in a `halt`. 0x2251 is one of
three sibling tables — 0x218C, 0x2251, 0x22FA — all opening `3c 3c 3c 3c`, and all three are handed
to the same reader at 0x2123, which takes the table's first byte as a countdown seed and writes the
table's base into work RAM as a pointer. That reader treats all three as data, and only one of them
has a file. Its single transfer, `jp 0x2251` at 0x213D, sits behind a test on the work-RAM pair
0xADFB/0xADFC: the anti-tamper idiom again. `[code]`

#### The bytes exist twice

`translated/loc_1098.js` covers 0x1098-0x1198 and inlines the block beginning at 0x10F8;
`translated/loc_10f8.js` transcribes 0x10F8-0x1198 over again. Benign today — the only transfers
into 0x10F8 are two branches inside 0x1098's own range, so nothing enters it from outside its owner
— but it is exactly the duplicate-transcription shape `translation.md` warns about, where one span's
bytes exist in two files and the copies drift the moment either is edited. `[code]`

#### Two refusals, and they are the method working

At 0x0F8D and at 0x1F99, agents writing the idiomatic layer DECLINED to produce a module and said
why, rather than carrying the frozen decode forward. Both addresses already carry a `translated/`
file, so the refusals did not prevent the defect — they stopped it propagating into the layer that
ships. In a project carrying this defect in its own oracle, an agent that will not treat data as
code is the system learning rather than repeating, and it is worth recording as a result and not
only as an absence. `[code]`

### ★ A rewrite's header is silent about the ROM BY RULE, and silence is not a finding

The entry above is about a layer that says too much: a transcribed file asserts a decode it was
never in a position to justify. This is its mirror, and it costs the same kind of false claim from
the opposite direction.

A comment in `games/<game>/idiomatic/` may describe THAT FILE and nothing else — not the ROM, not
the frozen decode, not a sibling routine. So when a rewrite's header says it steps over a byte
unread, that is a true and complete statement about the rewrite, and it carries **no claim
whatever** about what the byte is. The header is not being cautious; it is forbidden to say.

★ **So an enforced silence reads exactly like a finding of absence, and it fails hardest where it
matters most.** The routine that DOES use the byte is a different file — precisely the one this
header may not mention. The caption record's colour byte is the worked case: most of the routines
that index the caption table never read it — some take a colour from a work-RAM cell instead, some
write no colour at all — so their headers correctly report skipping a byte, while the one reader
that unpacks the record's full header takes the colour from exactly that byte. Read the skippers'
headers as a refutation and you conclude the byte has no role, in the teeth of the ROM.

Ask the ROM, and enumerate the readers — never a header that was told not to talk about them.
`[code]`

### ★ "Dark" means dark in the eras the tape visits — and one list proves it

The driven tape does not get far into the game, so a routine serving later content reads exactly
like dead code. This is not a worry; it is measured. The three shims that arm the player's velocity
table decay in precisely the order that says where the tape stops:

| shim | selects for | PC hits |
|---|---|---|
| 0x594E | era 0 | 5784 |
| 0x5965 | eras 1–2 | 962 |
| **0x596B** | **era 3 and up** | **2596** (attract, era 3) / **2821** (era 4 held) |

`[seen]` for the counts; `[code]` for which era each arm serves, which is read from
`scrollWorldAtTheEraPace`.

★ **The zero this table once carried for `0x596B` was the tape's, and a later sweep collected the
number.** An undriven attract run that reaches the fourth era dispatched it 2596 times, all of them
attributed to era 3; a driven run holding the era index at 4 dispatched it 2821 times, all at era 4;
and two runs that stayed in eras 0-2 dispatched it zero times. So the row's own prediction — era 3
and up — held, and the lesson below stands for a better reason than it did: the arm was never dark,
only unvisited. `[seen]`

Four of the twelve addresses a code survey reads as dark share one cause:
`0x596B` is the player's top-speed arm and has since been watched executing thousands of times,
`0x5860` and `0x58A4` are later-era enemy shims — and
`0x59D7` **is not code at all.** It is the slowest velocity table, dark because a program counter
never enters data.

Two lessons, and the second is the uncomfortable one. Striking `0x596B` off as dead code would
delete the arm that gives the player its top speed. And a list that cannot distinguish *data* from
*unreached code* excludes the right things for a reason that does not generalise — the same
blindness will admit a data table as a candidate just as readily. Entry candidacy needs a code/data
determination the sweep does not supply.

### Our own engine is not a grounding instrument

A measurement from `new Machine(ROM).runFrames(...)` is our engine replaying the ROM. It earns
`[code]`. This is stated twice in this document on purpose.

★ **A read tap counts the debugger's own reads.** A Lua `read_u8` from a frame notifier goes through
the tap like any other access, and the program counter it is attributed to is wherever the CPU
happens to be parked — so a per-frame sample of three cells produced three IDENTICAL, plausible
program-counter histograms concentrated in the command-ring drain loop, a routine that reads none of
the three. Two things caught it: the counts summed to exactly the frame count, and the loop's own
disassembly reads `0xACxx`. Guard every debugger-initiated access with a flag the tap checks, or the
instrument reports its own footprints as the game's.

★ **A dip override can read back as not-taken on the frame it is set.** Setting the cabinet dip and
reading `0xC200` in the same notifier call returned the unchanged default, and the field's own value
also read unchanged — yet the override had taken: later in the same run the port read with the bit
set, the field reported the new value, and the game's cocktail cell was non-zero for a quarter of
the run. Read a dip back on a LATER frame. An immediate read-back is a false negative, which is the
failure mode most likely to make someone abandon a working experiment.

### ★ MAME persists DIP positions between runs, and `-nowriteconfig` does not stop it

MAME writes `cfg/<game>.cfg` regardless of `-nowriteconfig`, which covers the `.ini` files and
not the per-game configuration. DIP positions therefore **survive from one process to the next**,
and with two runs going at once the last to exit wins.

This is not hypothetical here. Run from a fresh configuration directory this machine's dip ports
read `0xFF` and `0x4B`; run from the repository's own directory they read `0x7E` and `0x4A`,
because a saved switch configuration there leaves three switches off their defaults —
both coin settings and the life count. A grounding run launched from there
inherits that cabinet and records its ports faithfully, and nothing flags that they are not
the defaults. Nothing measured that way is wrong; it is just a measurement of a machine nobody
chose. **Pass `-cfg_directory` per run.** `[seen]`

### ★ A DIP switch can be driven, but not by the obvious call

`field:set_value()` is a digital override. On a multi-position DIP it **returns success and does
nothing** — the port reads back unchanged, which is the exact shape of a check that cannot fail.
`field.user_value = n` does move it: driven through all eight positions, this machine's
difficulty switch read back as eight distinct port values in the right bits.

One trap comes with it. Applied on the first frame, the write lands before the port defaults are
seated and drags **other fields on the same port** with it — setting difficulty took the life
count from 2 to 0. From frame sixty on, the neighbours hold. Read both ports back after the write,
every run, and print them. `[seen]`

### ★ A duplicated tap doubles a count and passes its own assert

An instrument that lists an address twice installs two write taps on it and counts every write
twice. Its count-assert passes, because the list really does contain that many entries. What catches it is arithmetic against a neighbour: a routine dispatched 22 times stores
two cells in the same breath, and such a tap reports 22 for one and 44 for the other. The general
form is the one this section already records — **a broken instrument returns a believable number,
never an error** — and the defence is to cross-derive every count against something that must
agree with it.

### ★ Two routines the memory-equivalence contract cannot express

Memory-equivalence drops the T-state clock deliberately: a rewrite is judged on the bytes it leaves
in RAM, never on how long it took. Two routines on this machine fall outside that. They are facts
about how the machine works, not unfinished work, and neither is waiting on anyone.

**0x0F97 (`multiplexSpriteSlotsSkipping`), the non-spinning twin of `multiplexSpriteSlots`** (0x10FD, `spinRemainingSpriteMultiplexSlots`, is the spinning reused-entry twin over its five higher slots). Its eight blocks each test one slot's
request byte against the LIVE RASTER COUNTER at 0xC000, and that counter advances with the T-states
the routine itself spends — so each read the ROM makes sees a later beam position than the read
before it. A rewrite that charges nothing sees the entry position every time, and the two part
company wherever the beam crosses a block's threshold mid-routine. This is measured, not argued: run
against the frozen layer on real dispatches, under the driven tape and under undriven attract alike,
a cycle-free rewrite diverges on a MINORITY of them. That minority is the dangerous shape — a spot
check of one entry finds the two identical, and the first cell to part company is a sprite-RAM byte
the oracle displaced by half a screen while the rewrite left it alone. `[code]`, and emphatically
so: both arms of that comparison are ours.

**0x0B93, the foreground command-ring drain.** It is a loop with no exit of its own; the ring is
refilled from outside it, by the interrupt. The engines that drive this port schedule that interrupt
on something the running code produces — the T-states it charges, or its arrival at a declared poll
address — and a cycle-free JavaScript loop produces neither, so the ring is never refilled and the
loop spins for ever. Measured under the poll-PC engine `runCycleFree`: with the oracle in that path
the run reaches its whole frame budget in milliseconds; with a cycle-free rewrite there it reaches
the first frame boundary, never reaches a second, and has to be killed. Under the cycle-driven
harness the two arms look identical instead, which is not a contradiction — a short capture there
does not dispatch this routine at all, so that harness settles nothing either way. `[code]`

★ **The discriminating rule, because it is the transferable part.** The test is not *"does this
routine read a timing register"* — it is **"does this routine's behaviour depend on time IT ITSELF
consumes"**, including "does it make progress only because time passes". A routine that WAITS on the
raster converges however long it takes; one that SKIPS on a raster test does not. The waiting twin
`multiplexSpriteSlots` is already idiomatic, dispatched, and a transparent swap under the
whole-machine gate — same register, opposite outcome. That contrast is what shows the rule
discriminates rather than merely excusing the two routines it excuses.

---

## §11 What is still open, sorted by what would close it

★ **Transcription is essentially complete; understanding is not.** An audit of the untranscribed
remainder of the ROM found **almost no established real code in it** — what is left is very largely
data tables, among them several of the velocity tables. Not all of those tables are outside the
transcription: the lowest one is transcribed in full, by the file this section later holds up as the
model. And "no code at all" would overstate it, because one short block in the remainder decodes
cleanly and calls the quota decrement. The distance between "we have the ROM in JavaScript" and "we
know what the game does" is **not a lifting gap.** It is a reading gap and a grounding gap, and
sorting the open questions by which one they need is the most useful thing this section can do.
`[code]`

### (i) Answerable from code already lifted — just read or trace it

These need someone's attention, not a new capture and not a new lift.

- The meaning of the in-round sub-state cell `SEQUENCE_SUBSTEP` (0xa9ac) that most per-frame handlers
  key on — which sequence(s) it steps (attract, round intro, or both) is consistent across many
  routines as an index but is not established from the code alone. (§2)
- The roles of most handlers on the gameplay call list. Their slot bank and dispatch key are known;
  what they *are* is not. (§4)
- What the two paired display lists hold. The mechanism is clear, the content is not — and which
  producers feed the pending list beyond `queueTileStampForObject` is not enumerated. (§8)
- Which enemy class each velocity shim serves. The ladder and its call sites are mapped; the
  classes are not, beyond the two identified for the shared sprite picker (the first two eras'
  common craft), so which physical era/enemy each animator serves is not decidable from code alone. (§4, §5)
- Where `PLAYER_STATE` (0xa800) is walked `0xf0 → 0x00` — the player death countdown that actually
  triggers `loseLifeAndHandOver` — and, from the other end, the life-start routine that seeds
  `PLAYER_STATE` to `0xff`. Both are outside §5/§6's scope; the likely home is the player-state
  frame dispatcher. (§5, §6)
- The meaning of the `SEQUENCE_DELAY = 90` stamp and the `HANDOVER_SUBSTEP_SEED` reseed in
  `loseLifeAndHandOver` — the post-death hand-off timing, belonging to the round/sequence
  subsystem. (§6)
- `record+4`'s overload — flutter quadrant seed vs animation shape-block base vs the Mother-Ship
  seven-hit counter — and whether any single object kind uses more than one of those meanings at
  once. (§4)
- The publish path from the work-RAM entry shadow to the hardware sprite banks. Only part is visible
  (`spinRemainingSpriteMultiplexSlots`); the shadow-to-hardware copy step was not read. (§4)
- `velocityForHeading`'s axis mapping — which member of the returned pair is screen-across vs
  screen-down is decided by the caller/consumer, not settled where the pair is produced. (§5, §12)
- `applyEraRungSettings`'s twelve scattered destinations. It fans a ten-byte row over twelve cells;
  the full role of every cell is not closed — two aim-window cells (e.g. 0xa8e6) have non-window
  readers besides the launch gate. (§3)
- Which counter drives `drawCountAsPictogramStrip` (the caller's `A`, a parachutist/pilot count in
  gameplay vocabulary), and whether the four sprite slots `hideCaptionSprites` clears are the
  copyright-strip pieces or a distinct caption-sprite set. (§8)
- The 'tamper' cells that divert `advancePlayerAnimationStrip` into `loc_1f2e`, read here only as
  gate conditions; their broader role belongs to another subsystem. (§5)
- `flyDemoShipByScript`'s scripted-flight mechanism — dispatched from the player frame but not
  decompiled in the player-input pass. (§5, §12)
- Whether `pickScriptAtRandomOrInTurn`'s returned selector lands in `PLAYER_ONE_ERA_INDEX`, the cell
  `seedDemoAutopilotScript` keys the script choice on — plausibly the same selector chain, but the
  store between them was not traced. (§12)
- Whether the non-arm slots of the phase-0 inline table (and the extra phase-2 slots) are deliberate
  idle rungs or filler for indices the machine never produces — not settled by the code; both
  shipped tapes never present those sub-steps. (§2)

★ **A conflict flagged for the LEAD.** `steerEnemyTowardShip` (enemy-AI subsystem) writes
`ERA_INDEX` = 0 then reseats it to 4 as a transient turn-rate index — verified in the routine body,
which forces the shared rate index to zero while turning and back to four otherwise — which appears
to clobber the era cell, yet §3's account (and `ERA_INDEX`'s registry entry) describes clean wrapping
and does not mention this. The likely reconciliation is frame-ordering (the era has already been
consumed for scroll/scenery that frame), but this was not verified and must be checked against the
code before the doc is committed. (§3)

### (ii) Answerable only from code or data not yet read

- **Formation composition, spawn rates, and the bonus window.** The per-era, per-difficulty spawn
  parameter table is a large untranscribed data block. Enemy counts and speeds live there. This is
  where `gameplay.md`'s questions 8 and 9 go, and neither can be answered without decoding it. (§3)
- **What the difficulty DIP actually changes.** Nothing on the player's path reads it — not speed,
  not turn rate, not the quota. It must act through the spawn parameters, which is the same block. (§3)
- The one ring command whose handler is real code with no transcribed file. Several other commands
  also lack a file, but they all resolve to the same bare `ret` that §7 already accounts for.
- The exact peak amplitudes of the three era speed tables (`OPENING` 0x5e00, 0x2e3e, 0x08fa) —
  asserted to be one curve scaled to roughly 256/306/331, but the ROM bytes were not re-read; tagged
  `[code]` pending a data read. (§3, §12)
- The contents of the 0x1f2e joystick direction-table (8-way nibble → target-heading byte) — only
  the lookup mechanism was confirmed, not the bytes. (§12)
- The contents of the two bonus-life mark ROM tables (0x4e1b / 0x4e30) — the mapping to the
  documented award ladder is inferred from the exact-top-byte match logic, not read from the ROM. (§7)
- The board-record byte layout beyond score and initials (whether `+7` is used) — inferred from
  `fileScoreIntoHighScoreTable`'s pointer arithmetic, not independently grounded. (§7)
- The demo era selector → which stages the three autopilot scripts drive — the selector→script table
  is a ROM-identity fingerprint, but the script bytes were not decoded. (§12)

### (iii) Answerable only on the real machine

- Whether the per-era speed-up is **perceptible**.
- The Mother-Ship's entry edge, and whether it fires.
- ★ **Whether the Mother-Ship takes seven hits or eight.** The arithmetic that gives the 1940 bomber
  four hits from a counter of three gives the Mother-Ship eight from a counter of seven, which
  contradicts the manufacturer. One capture settles it; until then, do not repeat either number as
  established.
- The `MOTHER_SHIP_ARMED`-set arms of the collision sweeps (5-slot craft runs, mother-ship passes).
  Every taped run read `MOTHER_SHIP_ARMED` as zero on every dispatch, so only the unarmed arms are
  MAME-observed. Likewise `destroyFixedTargetReachedByPlayer`'s three stores never fired on any
  driven tape, so its four-test conjunction is untested against MAME. (§6)
- Attract-mode composition — which eras the demo shows. A partial observation says the demo ship
  lives in the second era, consistent with the claim that this set never demos the first, but a
  single short capture is not a whole attract cycle.
- Whether the ship's **nose** is drawn along its direction of travel. The travel direction itself is
  settled (§5); which way `spriteForHeading` points the sprite for a given heading is not, and a
  16×16 sprite eyeballed off a snapshot is not the instrument for it.
- `COCKTAIL_MODE`'s exact screen-flip polarity, and the service-bit identity of `IN0` bit 2
  (`SERVICE_CREDIT_DEBOUNCE`) — both MAME-pending, flagged in `names.js`. (§2)
- The sprite-entry attribute byte semantics at `entry+0x30`/`+0x32` (colour vs flip vs bank-select
  bits) — not derivable from the routines that treat it as an opaque per-shape byte. (§4)
- Whether ring command 5 (posted by `awardBonusLifeAtScoreMark`) is the life-emblem strip painter,
  as cross-references suggest — the handler body was not read to confirm it repaints life icons —
  and the glyph-plane geometry of `HIGH_SCORE_INITIALS_CELL_BASE` 0xa531, which carries `[guess]` in
  `names.js`. (§7)
- `paintSelfTestScreenPhaseThenStepSequence` (0x4a0f) is unreached by either shipped tape; its
  self-test-screen role is code-derived only. (§2)
- Most object routines carry `[code]`, not `[seen]`; a MAME-grounding pass would be needed to promote
  any of them. (§4)
- **The per-player colour byte at `0xAD0C`, now named `PEN_COLOUR` from code.** Every reader treats it as a
  colour — three caption handlers at offsets 0, 5 and 10, the round-number digits, a colour-plane fill, a
  straight store into the colour plane — and it is byte 12 of the sixteen-byte per-player context block,
  `[seen]` saved and restored by the two block copies. The two writers that read it back first
  (`erasePenRouteThenAdvanceStep`, `seatCaptionPenFromEraFoldingTamperIntoPhase`) test whether it already
  holds the value they are about to store, gating a sequence step on it — still the pen colour, only used as
  a has-it-changed signal. It takes four values in an attract loop and two in a driven game, never
  approaching the wrap its four-bit mask implies. `PEN_COLOUR` survives every use; the naming is `[code]`, the
  value observations `[seen]`. Its saved per-player copies are `PLAYER_ONE_PEN_COLOUR`/`PLAYER_TWO_PEN_COLOUR`.

### The states no instrument has visited

The difficulty tiers, deliberate death, the later eras (and the ERA4 scenery seed / the era-4-only
scenery drift, seen only under an era-held sweep, never by playing through) and the loop wrap. Each
is a hole of the same shape: code serving it reads as dark.

High-score initials entry is no longer on that list. The recipe is worth recording, because poking
its own sub-step does not get there: the screen's cursor words are written by the qualification
check, on the path where the score does make the table, so a machine dropped straight into the
screen paints through whatever those words happened to hold. Set the active player's score high and
the sub-step to the qualification step once, and the ROM does the rest — it spends its own delay,
runs the screen's setup, and arrives at the entry loop by its own advance. Driven that way with a
panel bit held, the entry loop runs and one unbroken press steps the letter index over and over,
which is the auto-repeat. `[seen]`

Two-player alternating play is no longer on that list. A driven MAME run that presses the second
start button reaches it: both save blocks arm, the active-player index alternates,
and the routines that serve the hand-over execute. What the run did NOT reach is a hand-over
*between eras* — both players stayed in the first two — so the interaction between a swap and an
era change is still dark. `[seen]`

- **The high half of the sequence sub-step table.** The dispatcher masks the sub-step to four bits
  and jumps through sixteen words, but a tap on its own dispatch byte recorded only nibbles 0-7
  across boot, attract, the demo, the credit state and a driven game. Slot 15 is a bare `ret`
  reached by nothing else in the image; whether it is a deliberate idle rung or a filler for an
  index the machine never produces is not decidable from any state we have driven, which is why
  `loc_15b5` keeps its address.

★ **And the fix is cheap and already demonstrated.** Poking the stage cell is a working grounding
technique on this game — exactly as poking board state was on Donkey Kong. A driver that sweeps the
stage cell through each of its values with the reach sweep running would convert most of this list
into real evidence for the cost of one MAME run. That is the single highest-value instrument left
unbuilt.

### A defect the coverage audit turned up in passing

Several files in the translated layer transcribe **data as code** — velocity tables reached only by
anti-tamper traps, and caption records sitting a few bytes from a real routine. No exhaustive
determination of the set has been made. They
are not wrong about any byte; the lift is faithful. They present data as routines, which will
mislead anyone reading them as behaviour, and it already has: see §8 and §10. Several sibling files
get it right — they declare themselves data in the header and throw if called, and one of them
covers a kind the bad set does not, records of tile and attribute pairs. That is the convention the
others should follow. Recorded here
rather than fixed, because fixing it is a lift change and this is a map. `[code]`

---

## §12 How the heading is set, and what actually reaches the world-scroll routine

Time Pilot's ship never moves on the glass. Its sprite is seated once per round by
`resetPlayfieldAndArmNewRound` (0x19F0) [seen] at `PLAYER_ENTRY 0xAA10` = 0x84 and `PLAYER_SPRITE_Y 0xAA41`
= 0x78 [seen], and nothing on the steering path writes either byte again. What the joystick changes is a single
byte, `PLAYER_HEADING 0xA802` [seen], and what the world sees of it is a pair of 16-bit words,
`WORLD_SCROLL_Y 0xA808` and `WORLD_SCROLL_X 0xA80A` [seen], rewritten from that heading on each pass through
the player's frame step. Everything in between is a short, fixed chain: read a panel, turn the stick into a
target heading, walk the live heading toward it, look the heading up in a velocity table chosen by the era,
negate the result into the scroll pair, and dress the ship's sprite to match. This section follows that
chain from the stick to the scroll cells, and then says exactly which inputs survive to the end of it.

### Where the frame step runs, and when it steers at all

The chain starts in `dispatchPlayerFrameByState` (0x1EDF) [seen]. Three callers run it: the round engine's
per-frame service list `serviceRoundThenResolvePlayerState` (0x1199) [seen], and two sequence sub-steps that
fly the ship over the scenery outside ordinary play, `flyRoundIntroFlashingEraYearThenEraseIntroCaptions`
(0x16AF) [code] and `flyEnemyFreeLeadInThenStepSequence` (0x5694) [code]. So the ship turns and the world
scrolls through the same code whether the round is under way or the game is between phases.

The dispatcher points its record registers at the player's own record, whose head byte is `PLAYER_STATE
0xA800` [seen] and whose paired sprite entry is `PLAYER_ENTRY 0xAA10`, and then branches on that head byte.
Zero means there is no live ship this pass, and the routine leaves at once. Any value other than zero or 0xFF
means the record is mid-animation: the contact routines that destroy the ship write 0xF0 there, and
`advancePlayerAnimationStrip` (0x2010) [seen] clamps that to 0xB4 on its first pass and then counts it down,
blitting a tile strip into video memory whenever the count lands on one of seven keyframes. Only when the byte
is 0xFF — the value the round reset leaves — does the ship fly. It then takes one of three routes, and all
three end in the same world-scroll routine:

- If `PLAY_ACTIVE 0xAD30` [seen] is clear, the attract demo is showing and the demo pilot steers
  (`flyDemoShipByScript`, below).
- Otherwise the stick is read, and its low nibble decides: non-zero means turn toward it
  (`turnShipTowardTargetHeading`); zero means the stick is centred and the dispatcher goes straight to
  `scrollWorldAtTheEraPace` with the heading untouched.

Those are the only ways in. `scrollWorldAtTheEraPace` has no caller outside this chain: the dispatcher's
centred-stick route, the turn, the snap and the demo pilot are the only code that reaches it [code]. Three of
the routes arrive without writing the heading at all — a centred stick, a held stick that already names the
current heading, and a demo-script step that says fly straight — and each of them simply re-uses the value the
last pass left. That persistence is deliberate: the heading is state, not a per-pass input, and the world
scroll is re-derived from it on every pass whether or not anything changed it [code].

One consequence follows directly and matters for the rest of the section: while the record is animating,
nothing rewrites the scroll pair. By name the two words are written by exactly two routines — the round reset,
which zeroes both, and the negation step at the end of this chain. The only other stores that reach them are
block clears that never name the cells: the power-on clear in `clearWorkRamAndSpriteBanksThenColdInit`
(0x0069) [seen], which zeroes 0xA800–0xAFFF, and the attract-demo round-start clear of 0xA800–0xA97F in
`armRoundStartThenStepSequence` (0x27B1) [seen], which the real game's start skips. So for the whole of the post-hit countdown the
world keeps sliding past at whatever velocity was last stored before the ship was struck [code].

### Reading the stick

`readPlayerControls` (0x1ED1) [seen] hands back one byte: the panel that faces the picture. The vertical-blank
service mirrors both input ports into work RAM every frame, complemented so that a pressed control reads as a
1 — `IN1_PORT 0xC320` [code] into `IN1_MIRROR 0xA9AF` [code] and the cocktail player's `IN2_PORT 0xC340`
[code] into `IN2_MIRROR 0xA9B0` [code]. `SCREEN_UNFLIPPED 0xA987` [seen] chooses between them: non-zero reads
the upright panel, zero reads the turned-round cocktail panel. The dispatcher keeps only the low nibble, which
under the board's input map is left (bit 0), right (bit 1), up (bit 2) and down (bit 3) [code]. The fire
button sits above that nibble and is masked off with it, so firing while steering never changes the target
the stick names [code]. The same panel read serves two other routines outside this chain —
`fireAndSweepPlayerShots` (0x23E3) [seen], which wants the fire bit, and the initials entry,
`stepHighScoreInitialsEntry` (0x18C3) [code].

### From stick nibble to target heading

`turnShipTowardTargetHeading` (0x1F01) [seen] uses the nibble as an index into a sixteen-byte table at
`loc_1f2e_ADDR 0x1F2E` [code], fetched through `fetchTableByte` (0x0008) [seen]. The table's contents are the
eight compass headings, each a multiple of 0x20 on a 256-step circle:

| stick | left | down-left | down | down-right | right | up-right | up | up-left |
|---|---|---|---|---|---|---|---|---|
| nibble | 0x1 | 0x9 | 0x8 | 0xA | 0x2 | 0x6 | 0x4 | 0x5 |
| target | 0x00 | 0x20 | 0x40 | 0x60 | 0x80 | 0xA0 | 0xC0 | 0xE0 |

Every other nibble — the combinations that press opposite directions together (0x3, 0x7, 0xB, 0xC–0xF) —
also reads 0x00, so an impossible stick reads as "left" [code]. The heading therefore runs counter-clockwise
on the glass as it increases: left, down, right, up. That orientation is not an assumption from the table
alone; it is the one the velocity tables and the scroll axes independently agree with (see the last
subsection). The round reset seats `PLAYER_HEADING 0xA802` at 0x80, so every life starts facing right [code].

The stick is therefore absolute, not relative. It does not rotate the ship; it names one of eight directions,
and the ship turns toward that direction over the following passes. The byte beside the heading, 0xA801
(`loc_a801`), is cleared by the same round reset, but nothing on the steering path reads it: the target is
looked up from the stick table afresh on every pass and never stored [code].

The same sixteen bytes are also valid machine code, and the ROM does execute them in one place:
`advancePlayerAnimationStrip`, on the opening frame of its countdown, checks the sampled copyright-caption
glyph `TAMPER_GLYPH_STRIP 0xABFE` [seen] against 0xA5 and its colour `TAMPER_COLOUR_STRIP 0xABFF` [seen]
against 0x05 and 0x10, and on a mismatch — a tampered image — jumps into 0x1F2E (`loc_1f2e`) [code] with the
compared byte in A. Decoded as instructions, the table adds B into A and returns unless the sum wraps to zero
with overflow, which only A = B = 0x80 does; that single pair ANDs B into the zero sum (so the table's decoded
branch toward 0x1F99 is never taken from here), falls out of the table's end into the heading snap below,
writes 0x80 as the heading and scrolls the world [code]. The entry is one static jump, `jp 0x1f2e` at 0x2063,
reached from the two failed comparisons at 0x202F and 0x203D. A genuine image never takes this path, but the
path exists — the bytes are reachable as code, not dead. Apart from the turn, the only other reader of these
sixteen bytes is the boot sweep in `clearScreenRamAndVerifyImageThenColdInit` (0x5866) [seen], which sums the
whole program image [code].

### Walking the heading toward the target

The live heading does not jump to the target; it steps toward it. The turn routine subtracts the target from
`PLAYER_HEADING 0xA802` and acts on the difference:

- **Already there** (difference zero): the heading is left alone.
- **Within one notch** (difference of 0xFF, 0x00 or 0x01): the heading is snapped exactly onto the target.
  This arm is its own entry, `snapHeadingOntoTheTurnTarget` (0x1F3E) [seen].
- **Otherwise** the heading moves by a fixed step the short way round the circle: up when the difference is
  0x80 or more, down when it is less.

The step is 3 while the low digit of `ERA_INDEX 0xAD04` [seen] is below 3, and 4 from there on; since
`ERA_INDEX` only ever holds 0–4, that is 3 in the first three eras and 4 in the last two [code]. The snap arm
exists because 3 does not divide the 0x20 spacing of the targets. Walking by 3 from one compass point toward
the next lands two short of the target, which fails the within-one-notch test, so the next step overshoots to
one past it, and only then does the snap pull the heading back onto the target. The snap is therefore only
ever a one-notch correction, +1 or −1, never a general assignment. An eighth of a turn takes twelve passes at
step 3 (ten steps, the overshoot, the snap) and eight at step 4. At step 4 the walk lands exactly on each
compass point, because 4 divides 0x20, so in the last two eras the snap arm never runs: the turn leaves by
the already-there route instead [code].

The same arithmetic settles the ship's about-face. A target exactly opposite the current heading gives a
difference of 0x80, which counts as "the short way is up", so a reversal is always a counter-clockwise sweep
through every intermediate heading, never a flip: forty-four passes at step 3 and thirty-two at step 4 [code].
Because a centred stick leaves the heading exactly where it is, letting go mid-turn leaves the ship flying on
whatever intermediate heading it had reached; the eight table values are the only headings the turn *seeks*,
not the only ones it can *hold* [code].

### The demo pilot's heading

In attract mode `flyDemoShipByScript` (0x214B) [seen] replaces the stick with a script in ROM.
`seedDemoAutopilotScript` (0x210E) [seen] picks one of three scripts by the byte at `PLAYER_ONE_ERA_INDEX
0xAD14` [seen] — `DEMO_AUTOPILOT_SCRIPT_FIRST 0x218C` [code] for 0 or 3, `DEMO_AUTOPILOT_SCRIPT_SECOND
0x2251` [code] for 1, `DEMO_AUTOPILOT_SCRIPT_THIRD 0x22FA` [code] otherwise — and seats the cursor
`DEMO_SCRIPT_POINTER_LO 0xADF3` / `DEMO_SCRIPT_POINTER_HI 0xADF4` [code] on it, with the first entry plus one
in `DEMO_SCRIPT_DWELL 0xADF2` [code].

Each script byte packs a dwell count in its low six bits and a turn command in its top two. Every pass the
pilot decrements the dwell byte, keeping the command bits; when the dwell is spent it steps the cursor,
reloads from the next byte and looks again, so an entry with a dwell of zero is skipped at once and an entry
with dwell *d* holds its command for *d* passes. The command then nudges the heading: `01` subtracts 3 (a
clockwise nudge), `10` or `11` adds 3, `00` leaves it. There is no target and no snap on this path, and the
step is 3 in every era, so the demo ship's heading can come to rest anywhere on the 256-step circle [code].
The first script opens with four 0x3C entries — straight flight for 4 × 60 passes — before its first turns
[code].

### From heading to velocity: the era's table

Every route — turn, snap, centred stick, demo pilot, and the tamper fall-through — ends in
`scrollWorldAtTheEraPace` (0x1F42) [seen]. It decides nothing about direction; it reads the heading that the
earlier steps left in the player record and chooses only a table, by `ERA_INDEX 0xAD04` alone:

| ERA_INDEX | table | peak |
|---|---|---|
| 0 | `OPENING_ERA_VELOCITY_TABLE 0x5E00` [code] | ±256 |
| 1, 2 | `loc_2e3e 0x2E3E` [code] | ±306 |
| 3, 4 | `VELOCITY_TABLE_08FA 0x08FA` [code] | ±331 |

So the ship's speed changes at a different era boundary ({0}, {1,2}, {3,4}) from its turn rate ({0,1,2},
{3,4}) [code].

`velocityForHeading` (0x596E) [seen] then does the lookup. It is shared with the flying actors' movers (`flyAlongHeading` and
its doubled sibling look headings up through it too): it reads the heading at offset +2 of the record the dispatcher pointed at, which for the ship is `PLAYER_STATE 0xA800`
+ 2 = `PLAYER_HEADING 0xA802`. Each table is 256 signed 16-bit samples, one per heading step. The routine
takes the sample *at* the heading as the first component and the sample a quarter-turn (0x40 steps) *behind*
it as the second, so the two are perpendicular partners on the same curve, and the table's size is the
speed [code].

The three tables are one curve at three sizes. Each peaks at index 0 and 255, bottoms at 127 and 128, and
crosses zero at 63–64 and 191–192, so the eight compass headings produce clean pairs [code]:

| heading | 0x00 | 0x20 | 0x40 | 0x60 | 0x80 | 0xA0 | 0xC0 | 0xE0 |
|---|---|---|---|---|---|---|---|---|
| era 0 pair (first, second component) | 256, 0 | 178, 181 | 0, 256 | −181, 178 | −256, 0 | −178, −181 | 0, −256 | 181, −178 |

The eras 1–2 and 3–4 tables give the same pattern scaled to 306 and 331. The pairs are 8.8 fixed point, so
the opening era moves the world one whole pixel per pass on a compass axis, about 1.20 pixels in eras 1–2 and
about 1.29 in eras 3–4, and the diagonals come out within one percent of the same length [code].

The curve is not perfectly smooth, and the roughness is in the ROM data itself, at the same indices in all
three tables: indices 63 and 64 both read 0, index 67 reads 0 where its neighbours run −16 and −32 (in the
opening table), index 83 dips back against the trend, and the pairs at 98–99, 210–211, 226–227 and 242–243
repeat or step backwards [code]. None of these sits on a compass heading, so steady flight never sees them, but a
step-3 turn passes through them: turning off heading 0x40 by 3 lands on 0x43, where the first component reads
0 instead of about −24, and turning off 0x80 lands on 0x83, where the second component does the same. The
ship's across-component stutters to zero for one pass mid-turn [code]. At step 4 (eras 3–4) the walk lands on
0x44 and 0x84 and misses those samples.

The two later tables sit in the image at addresses that also serve as traps. The image checks in
`erasePenRouteThenAdvanceStep` (0x074B) [seen] and `buildCopyrightScreenThenVerifyImage` (0x083E) [seen] jump
to 0x08FA when their sums fail, and `showCreditLine` (0x2D3F) [seen] jumps to 0x2E3E on its failure arm, so a
tampered image ends up executing velocity data as code [code]. The 0x2E3E table fills exactly the 512 bytes
between `displaceByFiveQuarters` (0x2E31) [seen] and `displaceByThreeQuarters` (0x303E) [seen], and the
0x5E00 table fills the last 512 bytes of the program image [code].

### Into the scroll cells, and the sprite

`negateVelocityIntoWorldScrollThenDressSprite` (0x1F55) [seen] negates each component as a 16-bit quantity:
the first becomes `WORLD_SCROLL_Y 0xA808` and the second `WORLD_SCROLL_X 0xA80A` [seen]. The world is moved
the opposite way to the ship, which is what makes a stationary sprite read as forward flight.

Those names describe the native raster fields each word lands in, not the glass. The board is rotated 90°, so
`WORLD_SCROLL_Y` moves things horizontally on the display (a positive value slides the world left) and
`WORLD_SCROLL_X` moves them vertically (a positive value slides the world down) [seen]. This is where the
chain's orientation closes: heading 0x00 gives `WORLD_SCROLL_Y` = −256, sliding the world right, so the ship
flies left — the direction the stick table maps to 0x00; heading 0x40 gives `WORLD_SCROLL_X` = −256, sliding
the world up, so the ship flies down — the direction the table maps to 0x40 [code].

The step then finishes in `dressPlayerSpriteForHeading` (0x20AF) [seen], which rounds the heading to the
nearest of 32 sectors (adding 4 and dividing by 8) and copies the shape byte from `PLAYER_HEADING_SHAPE_TABLE
0x20CE` [code] into `PLAYER_SPRITE_CODE 0xAA11` [seen] and the attribute byte 32 entries further on into
`PLAYER_SPRITE_ATTRIBUTE 0xAA40` [seen]. So the ship is drawn in 32 facings: the eight it rests on plus the
intermediate headings a turn passes through.

Nothing in this step reads the scroll pair back. Its consumers are elsewhere: `driftWithWorldScroll` (0x2B60)
[seen] adds the pair to world-fixed objects whole, the scenery layers add it at one half, three quarters or
five quarters through `displaceByHalf` (0x304D) [seen], `displaceByThreeQuarters` (0x303E) [seen] and
`displaceByFiveQuarters` (0x2E31) [seen], and the flying actors' movers (`flyAlongHeading` 0x58BC [seen],
`flyAlongHeadingAtDoubleVelocity` 0x58FE [seen], `flyAlongStoredVelocity` 0x3E05 [seen], `flyAlongBallisticArc`
0x4017 [seen]) add it on top of their own velocity, so every object in the airspace shares the camera's
motion.

### What actually reaches the world-scroll routine

Tracing the inputs through to the scroll cells, only two things decide what lands there: the heading byte
`PLAYER_HEADING 0xA802` as the earlier steps left it, and `ERA_INDEX 0xAD04`. The stick nibble is still in
hand when the dispatcher enters the world-scroll routine on the centred-stick route, but that routine never
reads it; the stick's only influence on motion is through the heading it steers [code]. Several consequences
follow, each of them a statement about the code as it stands:

- **There is no throttle and no stop.** A centred stick scrolls the world at full era pace along the current
  heading, every pass, exactly as a held stick does. The speed is set by the era's table and nothing else
  [code].
- **Speed is era-keyed and loops.** Because `ERA_INDEX` wraps from 4 back to 0 when the game returns to the
  first era, the second loop's first era flies at the opening pace of 256 again [code].
- **The heading need not be a compass point.** Letting go mid-turn, and every heading the demo pilot reaches,
  are looked up as they stand, so off-axis velocities — including the handful of rough samples above — reach
  the scroll cells whenever the heading rests there [code].
- **A struck ship leaves the world sliding.** From the pass the player record leaves 0xFF until the round
  reset next zeroes the pair, the scroll cells keep their last value and every consumer keeps applying it [code].

One warning about the heading cell itself. A search of the image for instructions that name `PLAYER_HEADING
0xA802` finds the turn's two step stores, the snap, the demo pilot's two nudges and the round reset — and
misses the two block clears above, which zero it without ever naming the address. The same holds for the
scroll pair. No claim that "nothing else writes" a cell in this game is safe from an operand search alone
[code].
