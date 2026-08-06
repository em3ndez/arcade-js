// SPDX-License-Identifier: GPL-3.0-only

/**
 * Time Pilot work-RAM constants for the idiomatic layer.
 *
 * Maps this game's work RAM (0xA800-0xAFFF) to meaningful names. Addresses stay hex in
 * `../translated/` on purpose — that layer is the oracle; this file is a naming convenience for
 * the idiomatic rewrite and is NEVER the source of truth for behaviour.
 *
 * ★ PROVENANCE / CONFIDENCE (be honest — a wrong name is the sprite-record trap, worse than a
 * neutral hex address). Every name carries an evidence-source tag saying HOW we know the role:
 *   [seen]  — observed under MAME: a capture watched THIS address and confirmed what it does.
 *   [code]  — understood from the routines that touch it: consistent across them, but the cell
 *             itself was not observed.
 *   [guess] — one plausible reading, not confirmed; treat as a hint and verify.
 *   keep-hex — no confident name, so no const exists; the absence of an entry IS the signal.
 * The pixel gate, not the name, remains the correctness authority.
 */

/**
 * INNER index of the two-level sequence machine. [code]
 *
 * One reader masks this to its low nibble and dispatches through a word table on the result, so
 * it is an index rather than a count. One routine's only job is to increment it; another clears
 * it to restart the sequence. Touched across nineteen transcribed routines, consistently as an
 * index. Not yet observed under a capture, so the *identity* is code-derived: which sequence it
 * steps (attract, round intro, or both) is NOT established and this name does not claim it.
 */
export const SEQUENCE_SUBSTEP = 0xa9ac;

/**
 * OUTER phase of the same two-level machine: the machine's top-level MODE. [seen]
 *
 * The vblank service masks this to its low two bits and dispatches a jump table on the result;
 * inside those arms the inner index is consumed with several different masks,
 * which is what a per-phase table size looks like. Every phase-entry site writes the pair in one
 * idiom -- set this to a small constant, zero the inner one -- and the routine that steps this is
 * that same idiom with an increment in place of the store.
 *
 * Four values occur and no more. Watched under two independent MAME captures: 0 is the boot wipe,
 * 1 the attract sequence, 2 the credit / push-start state, and 3 the round engine.
 *
 * ★ Phase 3 is NECESSARY for play and NOT SUFFICIENT: the attract demo runs the same round engine
 * with the play flag clear, so the demo executes real game logic rather than replaying a recording.
 * Anything treating this cell alone as a play detector counts the demo as a game -- and the demo
 * is where most attract-mode dispatches come from, so that error silently corrupts any dispatch
 * attribution keyed on it.
 *
 * It is also routed through several ROM checksums whose trailing constants net to zero on a
 * genuine image, so a patched ROM corrupts the phase instead of failing cleanly. Same cell, same
 * meaning, booby-trapped.
 */
export const SEQUENCE_PHASE = 0xa9ab;

/**
 * Mirror of the IN0 input port, rewritten every frame from the port itself. [seen]
 *
 * The vblank service reads the port, complements it (the hardware is active-low) and stores the
 * result here, unconditionally — so this cell reflects what the panel is asserting, not what the
 * machine decided to do about it. Bit 0 is coin 1, bit 3 is 1-player start; watched under a
 * capture, it carries exactly the bits a driven tape held, for exactly the frames it held them.
 * Because the write is unconditional, a non-zero value proves a button was down and nothing more.
 */
export const IN0_MIRROR = 0xa9ae;

/**
 * Coin-counter pulses the machine still OWES the mechanical counter. [seen]
 *
 * Reads zero for the whole of an undriven run, and goes non-zero on the frame a driven coin is
 * taken, holding for a short spell before clearing. Unlike the port mirror this is downstream of
 * the machine's own decision: a debounce has to see idle-then-pressed before this is bumped.
 *
 * It is a COUNT, not a boolean — two coins in quick succession take it to two — and the pulse
 * driver decrements it as each solenoid pulse finishes.
 *
 * ★ What it does NOT mean: that a credit was banked. Credits live in a different, BCD cell and
 * are reached only after the coinage arithmetic, so on any setting that charges more than one coin
 * per credit these two diverge.
 */
export const COIN_ACCEPTED = 0xa981;

/**
 * Flag set while play is active. [seen]
 *
 * A true boolean rather than a value: one routine stores all-ones into it, three others clear it
 * with an exclusive-or of the accumulator, and a reader tests it for zero and returns early when
 * it is set. Watched under captures it reads zero for the whole of two undriven runs totalling
 * over five thousand frames, goes all-ones on the frame a driven start press lands, and holds
 * for every remaining frame.
 *
 * SCOPE, since the obvious readings differ: it spans a whole CREDIT, not a life and not a round.
 * Watched through a driven game to game over, it stayed set across every life lost and cleared
 * only at teardown. Four start sites set it and two teardown sites clear it.
 *
 * ★ It is also the ONLY thing separating real play from the attract DEMO, because the demo runs
 * the same round engine with this flag clear. Anything that infers "a game is being played" from
 * the sequence phase alone counts the demo as a game.
 */
export const PLAY_ACTIVE = 0xad30;

/**
 * Which era (the manual's ROUND) is being played, 0-4. [seen]
 *
 * The single most widely read cell in the game and, until this pass, the most conspicuous one with
 * no name. Dozens of transcribed routines key on it.
 *
 * ★ It is NOT one switch. Subsystems read it against their own thresholds and therefore step at
 * different rounds: the routine that arms the player's speed splits it {0}, {1,2}, {3,4}, while the
 * scenery dispatcher splits it {0}, {1,2,3}, {4}. Anything treating "the era" as one bundle of
 * settings will predict changes that do not happen.
 *
 * Watched under MAME it advances during the attract DEMO as well as in play, which is one reason
 * the demo cannot be told from a game by watching game state alone.
 *
 * It wraps to 0 when the game loops back to the first era, so the second loop's first era runs at
 * the first loop's speed; the escalation the manual describes for later rounds lives elsewhere.
 *
 * One reader shifts this cell up by four bits and masks the low nibble away. That is not a hint of
 * hidden state -- it is building a composite index, era in the high nibble and a per-era rung in
 * the low, into a table of five eras by sixteen rungs.
 */
export const ERA_INDEX = 0xad04;

/**
 * Enemies still to destroy before the Mother-Ship appears -- the manual's 56. [code]
 *
 * Counts DOWN. Loaded from a cell that is itself loaded once at boot from a single ROM byte whose
 * value is 56, and it is not era-keyed, loop-keyed or difficulty-keyed: the quota is the same in
 * every round of every loop on every setting. The escalation the manual describes for later rounds
 * is a different cell entirely.
 *
 * Only the ordinary enemy-craft slots decrement it -- not projectiles, not the middle-size bomber,
 * not the Mother-Ship, not the pickup -- so shooting a bullet scores without advancing the round.
 *
 * The bar along the bottom of the screen is a direct rendering of this cell, which is why nothing
 * in this game times the player: the one public source calling it a "time bar" was watching the
 * kill meter fill.
 */
export const KILLS_REMAINING = 0xad02;

/**
 * Per-frame world scroll, the component that lands in a sprite entry's NATIVE-Y byte. [seen]
 *
 * 8.8 fixed point, and it is the camera rather than any object's: one routine writes the pair once
 * a frame as the negation of the player's own velocity, and another zeroes both at life start.
 * Every site that reads this one pairs it with the same coordinate — whole part at the sprite
 * entry's `+0x31`, fraction at the object record's `+3` — and never with the other. Its magnitude
 * is era-keyed, taken from one of several ROM velocity tables, so there is no fixed scroll speed.
 *
 * ★ X AND Y HERE ARE THE NATIVE RASTER AXES, NOT THE PLAYER'S — and for this board those are not
 * the same axes. The name says which sprite-record FIELD the value lands in, which is what makes
 * it checkable on the spot beside `sprite + 49`; it makes no claim about the glass. The board is
 * ROT90 (clockwise), so native Y is the display's HORIZONTAL axis, mirrored:
 * `display_x = 239 - native_y`. A positive value here therefore slides the whole world LEFT on the
 * glass. Read as "horizontal" this name gives the right direction under the wrong axis; read as
 * screen-vertical it is simply wrong.
 *
 * Grounded under MAME by forcing this cell alone while the other stayed zero: every scenery
 * object's native Y moved at its own parallax fraction and its native X moved by exactly zero,
 * and the displayed picture shifted horizontally with no vertical component.
 *
 * ★ Prose written in DISPLAY axes calls this the horizontal — or "X" — scroll. Such a reading is
 * CROSSED against this name rather than disagreeing with it; the frozen oracle's transcription of
 * ROM 0x4017 labels the pair that way.
 */
export const WORLD_SCROLL_Y = 0xa808;

/**
 * Per-frame world scroll, the component that lands in a sprite entry's NATIVE-X byte. [seen]
 *
 * The other half of the same vector, on the same terms as WORLD_SCROLL_Y: written and zeroed by
 * the same two routines in the same breath, read by a set of sites disjoint from that cell's, and
 * always paired with the coordinate whose whole part is the sprite entry's `+0x00` byte and whose
 * fraction is the object record's `+5`.
 *
 * ★ Under the board's ROT90 native X is the display's VERTICAL axis (`display_y = native_x`), so a
 * positive value here slides the world DOWN the glass. Same grounding run, same result with the
 * axes exchanged: forcing this cell alone moved every scenery object's native X and left its
 * native Y at exactly zero, and the displayed picture shifted vertically with no horizontal
 * component.
 *
 * The structure ends here: the two words occupy 0xA808-0xA80B. The bytes flanking them —
 * 0xA803-0xA807 below, up to the live player-record fields, and 0xA80C-0xA80F above, before a
 * different structure begins — are touched by nothing but the two bulk RAM clears, in every run we
 * have watched. That is "dead in everything observed", not "provably never used".
 */
export const WORLD_SCROLL_X = 0xa80a;

/**
 * Address -> idiomatic routine. Artifact three of the four: a module that is not in here is
 * never dispatched, so it is written-and-never-executed no matter how green its own gate is.
 *
 * `name` IS the filename (`./<name>.js`), one-to-one. `entry` overrides the export name only
 * where a routine is deliberately a pure function of its inputs rather than a `fn(m)`.
 * `cert` uses the same evidence vocabulary as the cell names above.
 */
/**
 * SETTLED IN PASS 1, kept because the shape of the answer matters. Two routines here retire an
 * object and a third site inlines the same stores; no file calls more than one, so these are
 * per-family helpers rather than versions of one. The mechanical difference is that one also
 * clears the sub-pixel remainders. Whether that is observable depends on the spawn path: some
 * reinitialise those cells immediately after marking a slot live, others have not been shown to.
 *
 * STILL OPEN: whether the two families were meant to differ here, or whether this is two habits.
 * Code cannot settle it.
 */
export const ROUTINES = {
  0x0008: {
    name: "fetchTableByte",
    role: "step a table pointer on by an index and return the byte it lands on, leaving the pointer at that entry",
    cert: "code",
    why: 'most call sites consume the returned byte immediately (ld (iy+n),a, ld (de),a) while only a few read on through the surviving pointer, so the fetch is the product. Siblings 0x0010 and 0x018c already read as "fetch what an index selects", and this is the byte-table member of that family',
  },
  0x0018: {
    name: "offsetAddress",
    role: "move a 16-bit address forward by an unsigned byte offset, echoing the low half of the result back",
    cert: "code",
    why: "loc_20af hands it a table base and an index and then does its OWN ld a,(hl), so the caller owns the fetch and this must stop at the arithmetic; fetchTableWord uses it as the first half of a word-table fetch",
  },
  0x0020: {
    name: "advanceCharCursor",
    role: "step the character-cell cursor on to the next cell of the line being drawn",
    cert: "code",
    why: "loc_0d81 draws a two-digit pair as high nibble, step, low nibble, so the step is reading order; MAME's ROT90 (clockwise) maps a decreasing native row to an increasing display column, and every base feeding these drawers lies inside video RAM",
  },
  0x0038: {
    name: "postCommand",
    role: "queue a command byte and its argument in the command ring, dropping the pair when the cursor's cell is still occupied",
    cert: "code",
    why: 'loc_2511 fills the ring with 0xFF at init and loc_0b93 restores 0xFF on consumption, so "free = high bit set" is fixed by a writer and a reader outside this routine; loc_0b93 then dispatches the low nibble through a sixteen-way table, which is what makes it a command rather than a sound byte',
  },
  0x0f1a: {
    name: "advanceSequenceSubStep",
    role: "step the jump-table sequence index on by one; reached as a tail jump so the caller's own return carries it",
    cert: "code",
    why: 'advanceSequencePhase increments the outer phase and zeroes this index in one breath, which is only coherent if this is the inner half of a two-level machine -- so a name saying merely "sequence step" would claim the half that gets discarded whenever the sequence really advances',
  },
  0x2b60: {
    name: "driftWithWorldScroll",
    role: "add the frame's world-scroll displacement to one object's two split 16-bit coordinates",
    cert: "code",
    why: "loc_1f55 writes the displacement pair as the NEGATION of a velocity pair on its way into the routine that refreshes the player sprite from its heading, and gameplay.md records that the background moves opposite the plane -- so adding that pair to a world-static object is what streams it past a fixed ship",
  },
  0x2bde: {
    name: "retireSlotAndSubPixel",
    role: "take an object out of play, zeroing each coordinate WHOLE — occupancy byte, both sub-pixel remainders, and both sprite-entry coordinates",
    cert: "code",
    why: "it clears the two sub-pixel remainders as well as the coordinates, which the sibling retire helper leaves standing; spawn paths differ on whether they reinitialise those cells, so which helper retired a slot can still be visible to its next occupant",
  },
  0x2b83: {
    name: "hasReachedRetireLine",
    role: "answer whether an actor has drifted onto either of two fixed retire lines, within a narrow wrapped window, which is what makes its caller free the slot",
    cert: "code",
    why: "loc_19f0 pins the player's own sprite entry at (0x84, 0x78) and loc_20af never rewrites those two bytes, so the two lines at 0x04 and 0xF8 are each exactly +0x80 -- the antipode in a coordinate that wraps at 256; the callers that act on the carry use it to free the slot, though at least one path discards it",
  },
  0x2d6e: {
    name: "driftAtFiveQuartersWorldScroll",
    role: "move one object by the frame's world-scroll displacement and a further quarter of it, so it over-travels the world; applied to both of its split coordinates, whole part in the sprite entry and fraction in the object record",
    cert: "seen",
    why: "the displacement pair they read is written elsewhere as the negation of the player's own velocity, which gameplay.md describes independently as the background moving opposite the plane -- so it is the camera and nothing of the object's. Their only caller chain is the era-keyed dispatcher, which seats every dispatch inside the scenery slots. The fraction assignment makes a prediction its callers could refute: parallax depth should track sprite size, and each dispatched wrapper places a different number of tiles before stepping the slot -- smallest scenery on the slowest rung, largest on the fastest. Crossing any two of these names inverts that. A MAME run then watched all three addresses and matched each to its own fraction on every dispatch and the other two on none, every dispatch seated inside the scenery block. What that capture covers is the fraction and the slots; the rung ORDERING and the sprite-size correspondence stay code-derived, since it watched neither relative speed nor sprite size",
  },
  0x2d93: {
    name: "driftAtThreeQuartersWorldScroll",
    role: "move one object by three quarters of the frame's world-scroll displacement, applied to both of its split coordinates, whole part in the sprite entry and fraction in the object record",
    cert: "seen",
    why: "the displacement pair they read is written elsewhere as the negation of the player's own velocity, which gameplay.md describes independently as the background moving opposite the plane -- so it is the camera and nothing of the object's. Their only caller chain is the era-keyed dispatcher, which seats every dispatch inside the scenery slots. The fraction assignment makes a prediction its callers could refute: parallax depth should track sprite size, and each dispatched wrapper places a different number of tiles before stepping the slot -- smallest scenery on the slowest rung, largest on the fastest. Crossing any two of these names inverts that. A MAME run then watched all three addresses and matched each to its own fraction on every dispatch and the other two on none, every dispatch seated inside the scenery block. What that capture covers is the fraction and the slots; the rung ORDERING and the sprite-size correspondence stay code-derived, since it watched neither relative speed nor sprite size",
  },
  0x2df4: {
    name: "driftAtHalfWorldScroll",
    role: "move one object by half the frame's world-scroll displacement, applied to both of its split coordinates, whole part in the sprite entry and fraction in the object record",
    cert: "seen",
    why: "the displacement pair they read is written elsewhere as the negation of the player's own velocity, which gameplay.md describes independently as the background moving opposite the plane -- so it is the camera and nothing of the object's. Their only caller chain is the era-keyed dispatcher, which seats every dispatch inside the scenery slots. The fraction assignment makes a prediction its callers could refute: parallax depth should track sprite size, and each dispatched wrapper places a different number of tiles before stepping the slot -- smallest scenery on the slowest rung, largest on the fastest. Crossing any two of these names inverts that. A MAME run then watched all three addresses and matched each to its own fraction on every dispatch and the other two on none, every dispatch seated inside the scenery block. What that capture covers is the fraction and the slots; the rung ORDERING and the sprite-size correspondence stay code-derived, since it watched neither relative speed nor sprite size",
  },
  0x309b: {
    name: "advanceToNextSlot",
    role: "step the record cursor and the parallel sprite-entry cursor on to the next object slot",
    cert: "code",
    why: "placeAbuttingTile uses it to step onto a further tile of the sprite it has just placed, while loc_2d62 and loc_2d68 use it to reach a different entity -- the callers disagree about what the next slot holds, so the unit it advances is the slot index, not the object",
  },
  0x40ab: {
    name: "retireSlot",
    role: "retire an object, zeroing only the INTEGER halves — occupancy byte and both sprite-entry coordinates — leaving the sub-pixel remainders standing",
    cert: "code",
    why: "no file calls both this and the sibling retire helper -- the two caller sets are statically disjoint, which is what makes them two families' helpers rather than two versions of one; and loc_3dfb re-arms a cooldown byte after calling it, a slot going back on cooldown rather than an object deleted",
  },
  0x0010: {
    name: "fetchTableWord",
    role: "fetch the two-byte entry an index selects from a word table and hand back both the word and the address past it",
    cert: "code",
    why: "batch 1 named 0x0008 fetchTableByte and 0x0018 offsetAddress, and this routine calls 0x0018 and then reads a word -- it is the word member of that family by construction; it is reached by a one-byte restart where the wide-index sibling needs a three-byte call, which is what makes it the default form",
  },
  0x0028: {
    name: "retreatCharCursor",
    role: "step the character-cell cursor one cell back along the line being drawn, the inverse of the advance vector",
    cert: "code",
    why: "loc_0eeb calls it on a blanked digit and returns so the caller's following advanceCharCursor nets to zero -- a suppressed digit consuming no cell is only coherent if the two are exact inverses on the same axis; MAME's ROT90 maps an increasing native row to a decreasing display column, which is the direction retreat names",
  },
  0x018c: {
    name: "fetchWideTableWord",
    role: "fetch the word an index selects from a word table, with the index doubling carrying into the high byte so the table may run past the reach of its narrow sibling",
    cert: "code",
    why: "the only thing separating it from fetchTableWord is that the index doubling carries into the high byte, so this is the form a table wider than 128 entries needs -- a distinction no call site currently exercises, which is exactly why the name must carry it rather than the call sites",
  },
  0x0b06: {
    name: "stampCopyrightStrip",
    role: "stamp the four fixed pieces of the copyright caption into the display-list shadow; it reads nothing, so re-stamping changes nothing",
    cert: "code",
    why: "sibling loc_0b2b zeroes the vertical byte of exactly these four slots and nothing else, so an outside routine treats them as one addressable unit; the shapes it places decode out of the sprite ROM as the glyphs of the copyright caption, in the order it places them",
  },
  0x0f11: {
    name: "advanceSequencePhase",
    role: "advance the outer sequence phase and restart its inner step index at zero",
    cert: "code",
    why: "it executes zero times across a driven run -- every read of its entry byte is a checksum fold, none with the program counter at the address -- which corroborates from outside that all but one of its callers sit behind an anti-tamper test and are dead on a genuine image",
  },
  0x1319: {
    name: "fillCellRun",
    role: "fill a fixed-length run of character cells with one byte, stepping a cell at a time along the line",
    cert: "code",
    why: "its callers pass video-RAM starts with the blanking character and colour-RAM starts with a computed colour, so the unit it steps is the tilemap cell in both planes rather than a byte address; the stride is the one batch 1's advanceCharCursor established as one cell along a line",
  },
  0x15b6: {
    name: "hideAllSprites",
    role: "zero every slot of the vertical sprite shadow band, which parks all of them above the first visible line, hiding them without retiring any",
    cert: "code",
    why: "the slots it zeroes are exactly the ones the renderer scans, and its four-slot sibling loc_0b2b uses the identical idiom on the caption's slots alone -- one routine hiding a caption, this one hiding everything",
  },
  0x2b52: {
    name: "releaseHeldObject",
    role: "count a held object's release delay down and, when it expires, step its state code to the live one and re-arm the delay",
    cert: "code",
    why: "all five callers reach it through the same state-byte ladder and tail-jump here only when that byte is exactly the held value, so the increment is invariably held-to-live and never an open-ended bump; batch 1's retireSlot why already records other routines re-arming this same cell as a cooldown",
  },
  0x2bef: {
    name: "steerTowardAimHeading",
    role: "turn an object's heading one step toward the heading it aims at, the short way round, at a rate a small table supplies for the current mode cell",
    cert: "code",
    why: "the byte it writes is the one an object's own movement routine reads to pick a velocity -- the 0x58bc family, which carries an inlined copy of that lookup -- so this steps the heading motion follows, and the cell it steps toward is the target rather than the other way round",
  },
  0x3058: {
    name: "placeAbuttingTile",
    role: "place an object's next sprite tile flush against the current one and step both cursors onto it",
    cert: "code",
    why: "loc_2d15 chains two of these and loc_2d21 chains one plus the diagonal sibling loc_308a, both tail-jumping into advanceToNextSlot -- so a slot boundary here is a tile boundary, which is exactly why that routine's own entry declines to call the unit an object",
  },
  0x51de: {
    name: "postChainedHitScore",
    role: "post a scoring command to the ring, stepping the award up while consecutive hits keep landing inside the chain window and wrapping back round after the eighth",
    cert: "code",
    why: "loc_5205, an entry in the once-per-frame call list, ticks the chain window down and clears the step cell when it expires -- without that outside reset the argument would not restart, so the chaining is fixed by a routine other than this one; and it posts through postCommand, which drops the pair on a full ring, so it posts rather than awards",
  },
  0x5840: {
    name: "flyAtSlowestSpeed",
    role: "fly one object a single step at the slowest of the velocity-table speeds, choosing that table for the flier and deciding nothing else; reached as a call from two per-slot actor handlers and as a tail jump from a third",
    cert: "code",
    why: "every entry into flyAlongHeading is a two-instruction shim fixing one of several velocity tables whose peak magnitudes step evenly in 8.8 fixed point, so what an entry contributes is a rung on that ladder and not the act of fixing a table. Those tables are one waveform scaled -- each is the 256-peak table times its own peak to within two units of the last place, with identical off-symmetry headings -- so magnitude is the only degree of freedom a shim has, which is what makes a speed the right kind of thing to name it for. The ladder's ORDER is fixed from outside the flier: the routine that arms the player reads the era index and climbs the same tables as it rises, and an enemy shim selects the table that routine reaches at the top -- an enemy flying the player's own rung, which is what gameplay.md describes when it records the fourth era's jets as as fast and manoeuvrable as you. This entry's table sits below the slowest the player is ever given. A MAME run saw every dispatch here predicted exclusively by that table, while a sibling shim ran on the SAME slot array with a faster one, so an entry selects a speed and not an object class. cert stays code because 'slowest' is a rank over ROM tables and must stay one: two rungs of this ladder are selected only by shims whose addresses appear nowhere in the image, so no capture can ever watch the whole rank. A run reaching the later eras would put every REACHABLE rung under observation, and the name survives that ordering too",
  },
  0x596e: {
    name: "velocityForHeading",
    role: "look up the velocity vector for a heading: two perpendicular components a quarter turn apart, read from the table the caller supplies",
    cert: "code",
    why: "loc_1f55 negates the pair this returns into the very cells driftWithWorldScroll adds to every world-static object -- negated player velocity applied to everything else is the camera, which gameplay.md records independently; the selectable tables hold a near-constant magnitude around the heading circle, not an exact one, with anomalous words widening the spread",
  },
  0x0bff: {
    name: "drawTextRun",
    role: "paint one caption into the character plane and give every cell of it one colour, taking glyphs in order from a run that ends at a fixed terminating code",
    cert: "code",
    why: "the runs its callers select decode, through the board's own tile layout, into the English captions the public record independently names -- and two of them spell the exact bonus settings MAME reads off DSW1 -- so the bytes it copies are glyph codes and not a display list. NOT text in every case: two records instead select second-bank tiles with three pen levels, a shaded banner strip where a byte is a piece of a letter, which this name does not cover",
  },
  0x1098: {
    name: "multiplexSpriteSlots",
    role: "wait until the raster has passed each of eight scenery slots, then move that slot half a screen in both axes so the same sprite shows twice in one frame; a slot whose request bit is clear is left alone",
    cert: "code",
    why: "the slots it edits are exactly those the sprite DMA fills from the shadow block the era-keyed parallax dispatcher writes, and the partner it moves is that slot's X byte while the request it clears is its Y byte -- so the two writes are one object repositioned, not two objects. A near-twin performs the same edit on the same slots but SKIPS a slot whose beam has not arrived instead of spinning for it, and that contrast is what identifies the wait as this routine's purpose",
  },
  0x1ed1: {
    name: "readPlayerControls",
    role: "hand back the control word of whichever cabinet panel currently faces the picture",
    cert: "code",
    why: "the flag it selects on is the byte the vblank service latches into the LS259 bit MAME reports as flip-screen, and the two cells it chooses between are the frame mirrors of the driver's mono panel and its cocktail twin -- so which panel faces the picture is fixed by hardware outside this routine. Its callers then split the returned word three different ways (the stick nibble, the fire bit edge-detected into a burst, and, in initials entry, individual bits each shifted into their own one-bit edge history), which is what makes the whole word the product rather than any one field",
  },
  0x2a57: {
    name: "spriteForHeading",
    role: "pick the sprite shape, and the byte beside it, that show an object pointing the way it is heading, alternating between two shape banks as a frame counter's bit turns over",
    cert: "code",
    why: "its callers store the two returned bytes into a sprite entry's tile-code and control slots and nothing else, so the pair is a sprite and not a state code; the attribute table's colour field is identical in every entry while only its two flip bits vary, so that byte is a flip attribute rather than a per-sector palette pick, and it is the MIRRORING those bits give that lets a handful of shapes cover the whole circle. Two object classes use it, so it is not the player's",
  },
  0x2e31: {
    name: "displaceByFiveQuarters",
    role: "move a coordinate by a displacement and a further quarter of it, so what it carries leads what moves by the whole of it; the quarter rounds down rather than toward zero",
    cert: "code",
    why: "the sole caller of each is a byte-identical wrapper differing from the other two only in which of these it calls, and from driftWithWorldScroll only in applying a fraction -- so the fraction is the whole of what distinguishes them, while the scroll cells, the object and every memory write belong to the caller. These three read no scroll cell, touch no object and write no memory. A prediction that could have failed and did not: if each fraction has exactly one wrapper, the dispatch ratio across the era-0 handler list must be one to two to one, and it is measured at one to two to one on both attract and driven runs",
  },
  0x303e: {
    name: "displaceByThreeQuarters",
    role: "move a coordinate by three quarters of a displacement, so what it carries trails what moves by the whole of it",
    cert: "code",
    why: "the sole caller of each is a byte-identical wrapper differing from the other two only in which of these it calls, and from driftWithWorldScroll only in applying a fraction -- so the fraction is the whole of what distinguishes them, while the scroll cells, the object and every memory write belong to the caller. These three read no scroll cell, touch no object and write no memory. A prediction that could have failed and did not: if each fraction has exactly one wrapper, the dispatch ratio across the era-0 handler list must be one to two to one, and it is measured at one to two to one on both attract and driven runs",
  },
  0x304d: {
    name: "displaceByHalf",
    role: "move a coordinate by half a displacement, so what it carries keeps half the pace of what moves by the whole of it",
    cert: "code",
    why: "the sole caller of each is a byte-identical wrapper differing from the other two only in which of these it calls, and from driftWithWorldScroll only in applying a fraction -- so the fraction is the whole of what distinguishes them, while the scroll cells, the object and every memory write belong to the caller. These three read no scroll cell, touch no object and write no memory. A prediction that could have failed and did not: if each fraction has exactly one wrapper, the dispatch ratio across the era-0 handler list must be one to two to one, and it is measured at one to two to one on both attract and driven runs",
  },
  0x5211: {
    name: "destroyTargetsHitByShots",
    role: "destroy every target a live shot has reached, spending the shot with them, and post the score for each; the sweep does not stop at the first, so one shot can take several in a pass",
    cert: "code",
    why: "every caller fixes the outer array at the six-slot table loc_23e3 owns and arms only on a fire-button rising edge, and varies only the inner list -- so the sweep runs shots against targets and not the reverse. The state code it writes is the one loc_2b93 converts into a death countdown before retiring the slot, so destroy is the object's fate rather than this routine's bookkeeping. Kills also arrive through another routine's inline collision, which is why nothing here is [seen]",
  },
  0x58bc: {
    name: "flyAlongHeading",
    role: "fly one object a single step along the heading it holds, and in the same add carry it with the world: each coordinate gains its own velocity component PLUS the shared per-frame scroll pair, so nothing else may drift this object",
    cert: "code",
    why: "the pair it adds to every coordinate is the same pair driftWithWorldScroll applies to world-static objects, so this is that camera application and the object's own velocity folded into one add -- which is why none of its callers drifts the object separately, and why a reader who takes the name to mean velocity only will add a drift beside it and apply the camera twice. Its first half is byte-identical to velocityForHeading, so the module's reuse of that routine is an identity rather than an approximation",
  },
  0x0b46: {
    name: "loc_0b46",
    role: "queue one fixed command, with its one fixed argument, in the command ring -- both bytes are chosen here and whatever the caller held is discarded; the pair is dropped when the slot the write cursor names has not been consumed, and this entry never learns that",
    cert: "code",
  },
  0x0ce8: {
    name: "loc_0ce8",
    role: "an exit with nothing left to do: no cell is read or written and no register moves",
    cert: "code",
  },
  0x181d: {
    name: "loc_181d",
    role: "an arrival point with nothing to do: no cell is read or written and no register moves",
    cert: "code",
  },
  0x3ce1: {
    name: "loc_3ce1",
    role: "answer whether the byte at the head of a sprite entry has reached its wrap point, testing a four-wide window that straddles zero -- so it measures a wrapped distance rather than bounding a range, which is what lets a byte stepping several units at a time land inside the window instead of over it",
    cert: "code",
  },
  0x5854: {
    name: "loc_5854",
    role: "fly one object a single step at the pace the velocity samples based at 0x5E00 set, choosing that table and deciding nothing else",
    cert: "code",
  },
  0x594e: {
    name: "loc_594e",
    role: "hand back the perpendicular component pair an object's heading calls for, at the pace the velocity samples based at 0x5E00 set; choosing that table is all this entry does",
    cert: "code",
  },
  0x5965: {
    name: "loc_5965",
    role: "hand back the perpendicular component pair an object's heading calls for, at the pace the velocity samples based at 0x2E3E set; choosing that table is all this entry does",
    cert: "code",
  },
};
