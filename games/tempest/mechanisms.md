# Tempest — mechanisms

A code-grounded model of how Tempest actually runs, built from the translated 6502 lift and the idiomatic
rewrite and confirmed against the real ROM under MAME. It covers the subsystems reached by the idiomatic
decompile so far — the motion-script engine, the vector pipeline, enemy spawning and the pursuit AI, the
mathbox projection, sound, and the EAROM — down to the caller routines that drive them and the first
computed-jump dispatcher; the frozen-oracle remainder (deeper callers and the rest of the dispatcher spine)
is noted at the end. The machine is a colour vector game: the 6502 builds a display list in AVG vector RAM
(`0x2000-0x2FFF`) each frame and the Analog Vector Generator draws it, with the vblank interrupt as the
per-frame heartbeat and a game-state index driving a computed-jump dispatch that selects the mode handler
(attract, coin-in, play, transitions).

**Confidence tags.** `[seen]` — a role-defining observation on the real ROM under MAME (a watched write, a
value change, confirmed reachability). `[code]` — derived from the faithful lift's behaviour, mechanically
exact but the role is inference. `[guess]` — plausible, unverified. A `[code]` routine is real code whose
game-purpose is not yet pinned; where the purpose is genuinely open the identifier stays `loc_<addr>`.

## The object motion-script engine

Tempest drives the motion of its on-tube objects through a tiny bytecode interpreter. Each object being animated is addressed by the slot index held in the X register, and its per-slot state lives in parallel arrays: the motion-output cell at `loc_298 + x`, the object's lane at `loc_2b9 + x`, and its depth along that lane at `loc_2df + x`. The program those objects run is a stream of one-byte opcodes and operands packed into the table region beginning at `loc_a0f7`, walked by a script instruction pointer kept in `loc_10b`. Because the opcode fetch reads `loc_a0f7[loc_10b]` and the sibling fetch reads `loc_a0f8[loc_10b]` (with `loc_a0f8` sitting exactly one byte past `loc_a0f7`), a script's operand is simply the byte that follows its opcode. Each routine below is one opcode handler, reached when the driver fetches a script byte and hands control to the matching table entry; two shared control cells thread through them — the branch flag `loc_10c`, which conditionals consult, and the walk-continuation flag `loc_10a`, which keeps the driver's per-entry loop alive.

The two load opcodes deposit a value into the object's output cell. `loc_9bd0` (**scriptAdvanceStoreImmediateToSlot**, [seen]) first bumps the instruction pointer with `loc_10b = (loc_10b + 1) & 0xff`, then treats the freshly-selected table byte `loc_a0f7[loc_10b]` as an immediate constant and copies it straight into `loc_298 + x`; the IP-advance and the writes into the object cells (observed landing at `0x29b`–`0x29e` as X selects successive slots) are both on record. `loc_9bdd` (**scriptAdvanceStoreIndirectToSlot**, [seen]) is its indirect twin: it likewise advances `loc_10b`, but the table byte it fetches is used as a zero-page address, and the live variable read from `loc_00 + ptr` — not the operand byte itself — is what lands in `loc_298 + x`. So `loc_9bd0` writes a literal into the object's motion cell while `loc_9bdd` writes whatever a named game variable currently holds, letting a script feed dynamic state into the object it is driving.

Control flow within a script is handled by a family of jump opcodes keyed off `loc_10c`. `loc_9bee` (**scriptSkipTwoWhenFlagClear**, [seen]) is a conditional skip: when `loc_10c` is nonzero it returns immediately and does nothing, and only when the flag is clear does it step `loc_10b` forward by two (`(loc_10b + 2) & 0xff`), passing over a two-byte operand — both increments of that step are observed changing. `loc_9bfa` (**scriptJumpToTargetWhenFlagClear**, [seen]) is the conditional goto: it always advances `loc_10b` by one first, then, if `loc_10c` is nonzero, falls through unchanged; otherwise it reloads `loc_10b` from `loc_a0f7[loc_10b]`, jumping the script to the operand-named target — the advance and the table-reload writes are both seen. `loc_9c17` (**scriptGotoTarget**, [seen]) is the unconditional counterpart, reloading `loc_10b` from `loc_a0f8[loc_10b]` (the byte just past the current opcode) with no flag test; it is heavily exercised, its IP-reload pulsing across a range of low table indices.

`loc_9c0c` (**tickSlotTimerElseAdvanceState**, [seen]) gives a script its sense of dwell time. It reads the object's cell at `loc_298 + x` as a countdown timer, decrements it once, and branches on the result: while the timer remains nonzero it delegates to `loc_9c17`, reloading the instruction pointer from `loc_a0f8[loc_10b]` so the object stays in — or loops back through — its current motion state; only when the timer reaches zero does it instead bump `loc_10b` by one, letting the script fall through to the next opcode. This handler and the goto it calls are among the busiest in the engine, running on essentially every animation pass. `loc_9bca` (**clearListWalkContinueFlag**, [seen]) is the terminator: a leaf handler that simply stores zero into `loc_10a`. Since the driver's inner walk raises `loc_10a` and keeps dispatching one script entry after another only while that flag stays nonzero, this opcode is how a script tells the walker to stop for this pass; the single write of `0` to `loc_10a` is observed.

Two TEST opcodes set the branch flag `loc_10c` that the conditional jumps later read, and both are present in the ROM but did not fire during the capture window. `loc_9c21` (**scriptTestSegmentBoundaryVsPosition**, [code]) reads the object's lane from `loc_2b9 + x`, looks up that lane's boundary in `loc_3ac + segment` — a zero entry is treated as the maximum by promoting it to `0xff` — and sets `loc_10c` to 1 when the boundary is at or beyond the object's depth `loc_2df + x`, else 0; it lets a script ask "has this object reached the edge of its lane?" Its store to `loc_10c` is absent from the trace (the flag during that window was produced elsewhere), so its game role rests on the code, not observation. `loc_9c3b` (**scriptTestAccumulatorPhase**, [code]) instead derives `loc_10c` from the phase-accumulator pair: it forms `((loc_147 << 2) + loc_148) & loc_148 & 0x80`, all wrapping to a byte, then inverts bit 7, yielding `0x00` when that high bit was set and `0x80` when it was clear. `loc_148` is the signed phase value the engine's tail advances by `loc_147`, so this opcode branches on the sign/phase of that accumulator. Its store to `loc_10c` is likewise absent from the trace, keeping the tag honest at [code].

Finally, `loc_96c7` (**skipPackedListRecord**, [code]) is a register-only cursor helper that belongs to the same script-walking machinery but touches no memory at all. Entered at `loc_96c7` it advances the list cursor Y by three (stepping it once, then handing off to the `loc_96c8` entry with Y already bumped, which adds two more); entered directly at `loc_96c8` it advances Y by two. It skips over a packed record without decoding it, and is reached only through the computed dispatch off the `loc_969d` table (via the `loc_15e`-keyed RTS dispatch in `loc_9683`). With zero writes of its own there is nothing to observe, so it carries the [code] tag.

## Vector coordinate lists and the display cursor

Tempest paints its tube and everything on it by filling a display list in vector RAM (roughly `$2000`–`$2fff`) with words the color vector generator later strokes. Two cursors govern that work. The first is the **coordinate-list pointer** held little-endian in `loc_2c`/`loc_2d`, with the currently selected index kept in `loc_2b` and a shared delta/holding scratch cell in `loc_29`; it walks packed lists of shape coordinates baked into ROM. The second is the **display-list write cursor** in `loc_74`/`loc_75`, the moving tail of the vector RAM the machine appends drawing words to. This section covers how a coordinate list is selected and walked, and how words get emitted through the write cursor.

### Selecting a coordinate list

`loc_9aee` [seen] chooses which ROM coordinate list to chase. Indexed by Y, it loads the low byte of the list pointer from the table at `loc_9b02` into `loc_2c` and the high byte from the table at `loc_9afd` into `loc_2d`, records the chosen index by stashing Y into `loc_2b`, and reloads A from the holding cell `loc_29` before returning. The two tables sit five bytes apart so a single Y indexes matching lo/hi entries; the observed high-byte writes cluster in the `$07` range (a ROM address), consistent with pointing the `loc_2c`/`loc_2d` indirect at a table living in program ROM. All three of its stores are observed.

`loc_9a9d` [code] is the fixed-seed sibling used to point the pointer at the first list unconditionally: it copies the zeroth low byte `loc_9b02` into `loc_2c`, clears the index `loc_2b` to zero, takes the high byte from the source cell `loc_15d` into `loc_2d`, and likewise reloads A from `loc_29`. Its distinctive path (the `loc_15d`-sourced high byte and the zeroed index) rests on the code rather than an observed write, so it carries the [code] tag.

### Walking the packed coordinate list

Once the pointer is set, three helpers step through the list, each reading through the `loc_2c`/`loc_2d` indirect at an offset in Y.

`loc_96cb` [seen] advances the cursor by an inter-entry step. It reads the entry at the pointer plus Y and the predecessor entry at the pointer plus (Y−1), takes their difference `(cur − prev) & 0xff`, and stores that as the step delta in `loc_29` (observed moving across `0x01`..`0x0f`, real inter-entry steps from the list). It then returns A = `(Y−1 + delta + 1) & 0xff` and leaves Y advanced to `(A + 2) & 0xff` — so the cursor moves forward by `delta + 2` from its starting position, threading past this entry pair to the next.

`loc_96ab` [seen] re-indexes into the same list by a computed offset. Its entry point forms the working value `((loc_2b − 1) & 0x0f) + 1` from the selected index (a companion entry `loc_96b7` starts instead from the raw `loc_2b`), then the shared body stashes the incoming Y into `loc_29`, subtracts the entry two positions back — the byte at pointer + (Y−2) — from that value, adds the stashed Y back in, and finally reads the list entry the resulting index points at, returning it in A with Y set to that same index. Its only own write is the `loc_29` scratch stash, so it is grounded as a reached compute helper whose output feeds the coordinate generators. (A trivial sibling `loc_96c4` in the same body simply reads pointer + Y with no re-indexing.)

`loc_96db` [code] resolves a list entry to an absolute coordinate: it reads the byte at the pointer plus Y and adds the base value held in `loc_160`, returning the `& 0xff` sum in A. It performs no memory write of its own, so the write-tap cannot confirm it and its role rests on the code; it is a pure compute leaf reached through the coordinate-dispatch machinery.

### The display-list write cursor

`loc_df5f` [seen] is the shared cursor-advance shared by every emitter below. Given a stride in Y, it computes `loc_74 + Y + 1` (the +1 comes from the machine forcing a carry into the add), writes the low byte back to `loc_74`, and on overflow increments the high byte `loc_75`. It is exercised on essentially every append; the low byte `loc_74` is heavily pulsed across its full range and `loc_75` steps through the `$25`..`$2a` page range as the cursor sweeps the vector RAM. Every producer in this subsystem finishes by calling it to leave the cursor pointing just past the bytes it wrote.

`loc_df59` [seen] is the core two-byte emitter. It fetches the current cursor from `loc_74`/`loc_75`, stores A at cursor + Y and X at cursor + (Y+1), then advances the cursor by (Y+1) through `loc_df5f`. Its two stores are observed writing real vector words into the `$2xxx` display RAM across a wide value range (for example `$2202` ← `0x3c`, `$2203` ← `0x72`), which is what grounds the whole emit path as [seen].

`loc_df53` [seen] writes the fixed two-byte header pair `{0x40, 0x80}` at the cursor and then steps past it. Both bytes are observed in the emit stream — a `0x40` store followed by a `0x80` store into the `$2xxx` region, with an adjacent `0x40`/`0x80` pair seen at `$224a`/`$224b`.

`loc_df19` [seen] and `loc_df1f` [seen] append a word chosen from the ROM word-table at `loc_31e4`. In `loc_df19` the index comes from the low nibble of A: when the carry is set and that nibble is zero the index is 0, otherwise it is `nibble + 1`; the index is doubled to address a two-byte entry, whose bytes are copied to the cursor and cursor+1, and then the cursor advances by one word. `loc_df1f` is the thin wrapper that forces the index to `(A & 0x0f) + 1` and shares the same copy-and-advance tail, so its own arm computes only and leaves no write while the shared emit tail is grounded by the same `$31e4`→vector-RAM stores.

`loc_c772` [seen] is a producer that emits an object's absolute position as a header plus two coordinate words. Starting the cursor offset at zero, it writes the fixed header `0x40` then `0x80`, then the X word — low byte read from `loc_2` indexed by X and cached in `loc_6c`, high byte read from `loc_3` indexed by X, cached raw in `loc_6d`, and written to the list masked to five bits (`& 0x1f`) — then the Y word — low byte from `loc_00` indexed by X, cached in `loc_6a`, high byte from `loc_1` indexed by X, cached raw in `loc_6b`, written masked to five bits. The four raw bytes cached in `loc_6a`–`loc_6d` serve as the "previous point" other stroke code can subtract from. After the six bytes it advances the cursor through `loc_df5f`.

`loc_aef8` [seen] emits text as glyph words. It sets up a countdown — the source index `loc_38` starts at `A + 2` and the counter `loc_39` at `0x02` — and loops three times over the character buffer based at `loc_606`: each character byte is read, and if it is `0x1e` or greater it is treated as `0x1a` (the code's clamp), otherwise used as-is; that value is doubled to index the glyph word table at `loc_31fa`, and the two bytes of the glyph word are copied into the display list through the cursor. The source index and counter both decrement each pass, walking the characters backward, until the counter goes negative. The stores land as vector-draw words in the `$2xxx` region (the high byte `0xa8` being the draw opcode), after which the cursor is advanced past everything written via `loc_df5f`.

## Draw-pointer setup and vector emission

Tempest paints its tube, ships, enemies and text as lists of records in the color-vector RAM at $2000-$2fff, which the AVG (Analog Vector Generator) walks each frame. This subsystem is the machinery that (a) chooses where in that RAM the current draw stream is being written, (b) turns object attributes and coordinates into the AVG record bytes, and (c) closes the stream off. Two indirect cursors thread through nearly everything: the primary write pointer $74/$75 (a 16-bit little-endian address into vector RAM) together with its running byte-offset $a9, and a secondary pointer pair $76/$77.

### Selecting and publishing the draw cursor

The setup routines pick a ROM-resident vector-record address and stamp it into one of the cursors. loc_b2be [seen] takes a subsystem selector in A, forms a two-byte table stride `off = (A<<1)&0xff`, and reads a pointer out of one of two parallel ROM tables — $ce68 when the per-index flag `$0415[A]` is nonzero, $ce7a when it is zero — publishing the low byte to $74 and the high byte to $75, then zeroing $a9 so the write cursor restarts at offset zero. Its sibling loc_b2de [seen] does the mirror-image selection into a different cursor: it reads from $ce7a when `$0415[idx]` is nonzero and $ce68 when zero (the opposite table order to loc_b2be), lands the pointer in $3b/$3c, and likewise clears $a9. Both are grounded by their pointer writes changing across the capture (real, varying addresses rather than constants). loc_91b5 [seen] is the analogous producer for a zero-page working pointer that is not the vector cursor: it doubles A into a word index, clears the paired flag byte $29, and copies the little-endian pointer at the in-page ROM table $91c6/$91c7 into $2a/$2b (observed producing $0540).

loc_b332 [seen] combines a frame-consistency check with a cursor reload. It compares the source byte $cec4 against the checkpoint held at $2000; if they differ it latches the new value into $2000 and returns carry set, which the display-state caller reads as "the frame changed underneath us, restart." When they match it takes the emit path: it clears the status cell $016e, emits one two-byte record from `$ce9e[x]` through the ($74) cursor (x = 8 when `$0415` is nonzero, else 2), then reloads $74/$75 not by advancing but from a fresh entry `$ce68[x]`, and returns carry clear. Both paths were exercised with the pointer writes observed changing.

Two pointer-shuffle helpers sit in the object-draw loop but did not run in this capture, so they are grounded only at the code level. loc_b944 [code] swaps the whole 16-bit pointer $74/$75 with $76/$77 (via saved low/high temporaries) so the shared cursors address the alternate structure. loc_b967 [code] selects an (A,X) pointer pair by the RAM flag $0415 alone — when $0415 is zero it returns (A=$ce87, X=$ce86), otherwise (A=$ce6f, X=$ce6e); its consumer stores A into $77 and X into $76, i.e. it seeds the secondary pointer. The flag $0415 itself is exercised elsewhere, but the bodies of loc_b944 and loc_b967 never executed here.

loc_b84e [code] is a computed dispatcher over four draw-pointer targets: the caller passes Y as a byte offset (0,2,4,6) into a two-entry-stride table and loc_b84e tail-calls entry `Y>>1` of {loc_b85f, loc_b875, loc_b888, loc_b896}. It performs no write of its own.

### Closing the vector stream

loc_b896 [code] writes the trailing record of a stream. It stores the 16-bit cursor held in $0139/$013a into the vector-RAM tail — $2ffc gets the low byte raw, $2ffd gets the high byte OR'd with 0x70, and $2fff gets the 0xc0 terminator — then steps that cursor down by 0x20 with a 16-bit borrow (decrementing $013a when the subtraction underflows) and masks the low byte to 0x7f. It was not exercised in this capture; the tail slots and cursor writes are code-readable only, so the mask and terminator values (0x70, 0xc0) are not directly observed.

### Emitting coordinate and delta records

A family of routines turns object coordinates into the AVG's packed word records, where each 16-bit value goes out as a raw low byte followed by a high byte kept to five bits (the AVG opcode/magnitude field), sometimes OR'd with an opcode pattern. loc_c43c [seen] is the gatherer that feeds them: reading the slot index $37, it copies that column of four parallel object-attribute tables ($036a→$61, $035a→$62, $038a→$63, $037a→$64) into the working coordinate block $61-$64. loc_c423 [seen] is the same idea against a different table set ($032a→$61, $031a→$62, $034a→$63, $033a→$64) indexed by $37, and then it drives the delta emitter.

loc_c3ba [seen] computes two 16-bit differences of the working block against the cached previous block — ($61/$62)-($6a/$6b) into $6e/$6f and ($63/$64)-($6c/$6d) into $70/$71, each with a borrow — hands the four delta bytes at $6e to loc_df92 to emit, then latches the current block ($61-$64) into the previous block ($6a-$6d) and flags the record ready by writing 0xc0 into $73. loc_c73c [seen] emits two 16-bit differences directly through the ($74) pointer at the running cursor $a9: first ($63:$64)-($6c:$6d), then ($61:$62)-($6a:$6b); each difference's low byte goes out raw and its high byte is masked to five bits, with the second high byte additionally OR'd with 0xa0 (a vector-generator opcode), after which $a9 is advanced by four.

loc_df92 [seen] is the lower-level record writer that several of the above rely on. It lays a four-byte record through the ($74) cursor from four zero-page slots offset by the index in X: `$02+x` and `$00+x` supply two coordinate bytes, `$03+x` a five-bit-masked byte, and the fourth byte is a key-folded five-bit value `(($01+x ^ $73) & 0x1f) ^ $73` using the key latched in $73. It then chains into a tail that stores one more byte at the next cursor slot and either continues the shared build or, if the slot index wrapped to zero, runs the terminating byte-run emitter.

loc_df75 [seen] is the entry that scales coordinates before emission: it widens two inputs by four with sign extension (`low=(v<<2)&0xff`, `high=((signHi<<1)|((v>>6)&1))&0xff`) into the little-endian delta pairs $6e/$6f and $70/$71, then hands off to loc_df92 to emit the record they anchor. loc_df73 [code] is a thin wrapper that first stashes its key byte into $73 (so df92's fold uses it) and then tail-calls the df75 scale-and-emit; its own role rests on the code, no defining write of its own having been observed.

loc_c66d [seen] builds a tube-slot midpoint vertex. For slot $38 and its wrap-around neighbour `($38+1)&0x0f` it takes the round-up signed average of each of the two coordinate pairs ($036a/$035a and $038a/$037a across the two slots), stores the two midpoints into $61/$62 and $63/$64, appends the four midpoint bytes through the ($74) pointer at cursor $a9 with the high bytes masked to 0x1f, and mirrors all four into the scratch block $6a-$6d.

### The math box for perspective and the per-enemy entry

loc_bd3e [seen] appends a normalized (mantissa, exponent) pair using the hardware math box in the $6000 block. For a small input (`$57 < 0x10`) it emits the trivial pair (mantissa 1, exponent 0). Otherwise it forms the 16-bit difference `$57-$5f` (with borrow into `0-$5b`) into the math-box operand registers $6095/$6096, issues the operation via $608c/$608e/$6094, spins on $6040 bit7 until done, reads the results $6060/$6070 into $79/$7a, then normalizes by rolling bits left until a 1 falls out — the shift count becoming the mantissa in $78 and the roll count the exponent. The finished pair is written through the ($74) cursor at $a9 as two bytes: the raw exponent first, then the mantissa OR'd with 0x70.

loc_c6c7 [seen] emits one enemy slot's vector-list entry, called by the per-frame enemy display-list builder. It reads the slot's kind byte `$03ac[$38]`: when that is zero (inactive slot) it appends four blank+0x71 pairs (0x00,0x71 repeated) from the current cursor and returns. For an active slot it seats the scratch inputs ($57 from `$03ac[x]`, then $56 from `$0435[x]` and $58 from `$0445[x]`), runs the depth clamp (loc_c453) and the math-box step (loc_c098), emits the delta pair via loc_c73c, then branches on the type bit `$039a[$38] & 0x40`: if set it runs the math-box normalizer loc_bd3e and appends a randomized word — a random even offset `idx = ($60ca & 0x02) + 0x1c` (from the POKEY random cell) selecting adjacent words from the $cec8/$cec9 tables — advancing the cursor two; if clear it appends the fixed marker word {0x00, 0x68, $3db2, $3db3}.

### Header words and the shared six-byte build

loc_c765 [seen] is the "with header" entry into the shared coordinate build: it lays the fixed two-byte header {0x00, 0x71} at cursor offsets 0 and 1 of the ($74) list, then resumes the shared builder (loc_c774) starting at slot two. The builder proper emits a {0x40, 0x80} lead word followed by two coordinate words drawn from zero-page pairs, each high byte clamped to five bits and the raw bytes cached into $6a-$6d, before advancing the cursor past the six emitted bytes. loc_c765 is reached from the several vector-draw sites (via loc_bda0/b498/b69b/b7eb/bd09) and its two header stores are observed landing at thousands of distinct cursor addresses across the $2xxx display RAM.

### Glyph and digit runs into the text buffers

A second cluster emits text and score digits as glyph strokes. loc_a9fc [seen] maps A's low nibble to a font word: with the carry-dance the index is `y = 0` for a zero nibble with carry set, otherwise `nibble+1`, and it stores a **single byte** — the byte read from `$31e4 + 2*y` (only the low half of that word-table entry, leaving the odd destination slot unwritten) — at the $2f60 buffer cursor $2f60+x, then advances x by two. loc_a9d7 [seen] drives it: it runs a three-pass loop (counter in $2a from 2 down through the 0xff underflow) over three source bytes, emitting each byte's high nibble then its low nibble through loc_a9fc, walking the packed-string source pointer $3b backward one byte per pass and chaining the carry so only a zero nibble preserves it. Its only own writes are the loop state ($2a, $3b); the glyph bytes themselves are written by loc_a9fc.

loc_a97f [seen] is the marker-row producer that feeds loc_a9d7. Keyed by y (saved into $2b), it lays a 0x71-tagged header value into the $2f60 buffer at a base index from `$cdde[y]`, fills a six-entry glyph run at the base from `$cde0[y]` (using $3284 up to the count in $48[y] and $3286 beyond it, with the count trimmed by one at the marker index $3d), and — unless it is on display state 4 away from the marker, in which case it returns early — seeds the glyph source pointer $3b/$3c from `$a97d[y]` and hands off to loc_a9d7 for the nibble emission.

loc_dfb1 [seen] is the heavily exercised digit-run driver, the sole caller of loc_df19. It emits a run of `$ae+1` zero-page bytes (count seeded from `y-1` into $ae) starting at source index `(A + count) & 0xff` in $af and walking downward: for each byte it emits the high nibble then the low nibble via loc_df19, chaining carry so that only the very last low nibble sees carry forced clear (the terminator marker). loc_df19 in turn looks up `$31e4[idx*2]` (idx = nibble+1, or 0 when carry-set and nibble zero), copies that word's two bytes into the ($74) list, and steps the cursor past them.

Several thin callers front loc_dfb1 for specific values. loc_aa9e [code] increments the slot index in X, publishes it through the pointer byte $61, and emits that one byte as a nibble run (`dfb1(0x61, 1)`). loc_af77 [code] converts the incoming byte to packed BCD through the double-dabble converter (which writes the same BCD result into both $29 and $2c, each therefore ranging 0x00..0x99) and then emits the single byte $29 as nibbles. loc_b0c6 [code] selects a pointer from the table by index via loc_91b5 and then emits a three-byte zero-page run (`dfb1(0x29, 3)`). loc_d8a9 [code] stashes A into $29, scales the two coordinates into the vector work pair via loc_df75, then emits that one stashed byte as a single-entry run. loc_dd2b [code] scales the coordinates via loc_df75, then shifts the stashed byte $35 out MSB-first over eight passes ($37 from 7 down through the 0xff underflow), emitting each bit as one vector digit through loc_df1f. These callers each rest on the code: their own writes were constants in this capture rather than role-defining values.

### EAROM helpers sharing this ROM neighborhood

Two routines assigned here are, on inspection of the code, not part of vector emission at all — they belong to the $6000-block EAROM/high-score NVRAM state machine and merely sit in the adjacent ROM. loc_db5a [code] reads the two guard bytes $1ca and $1c7 and, only when both are clear, calls the walk seeder loc_de11 (which sets $1c7=7, $1c8=0) and then stamps $7c from $1c9 and $00=2; in this capture the guard was never clear when it was reached, so none of that write path ran. loc_dded [code] is a branch-only trampoline — `lda #3` then an always-taken branch into the shared flag-merge (loc_ddf3→loc_ddff), which forces $1c6=0xff and OR-merges the mask into $1c7 and $1c8 (the EAROM op-request flags). loc_dded itself performs no write, and its mask value 0x03 is not directly observed, so it is grounded only at the code level; the downstream flag cells $1c7/$1c8 are what change, in the merge routine rather than here.

## Enemy spawning and lane selection

This subsystem decides *which* lane a new adversary enters, *where* along the tube it takes hold, and the bookkeeping that turns a pending source entry into a live climbing enemy. It works over several parallel per-slot arrays: the depth byte `loc_2df`, the target segment `loc_2b9` and its successor `loc_2cc`, the per-slot spawn timer `loc_2a6`, the flag bytes `loc_28a` (bit7/bit6) and `loc_283` (lane bits plus bit6/bit7), the coordinate hi byte `loc_291`, the active-slot count `loc_108`, and the per-lane occupancy counter `loc_142`.

**Choosing a candidate lane.** `loc_9246` [seen] lays the groundwork each pass by clearing the 64-byte tag table `loc_243`..`loc_282` to zero, then walking the active slots from `loc_3ab`-1 down to 0. For each slot index `x` it draws a POKEY random nibble (`loc_60ca & 0x0f`) into `loc_203`,x and packs `(x<<4)|nibble` into `loc_243`,x, substituting `0x0f` when that packed byte would otherwise be zero so no live tag reads as empty. `loc_9abb` [seen] then makes the actual pick: it seeds a wrapping start position from `loc_60ca & 0x03`, loads a four-try countdown into `loc_2b` (0x04) and stashes the caller's X into `loc_39`. On each try it decrements the `loc_2b` countdown — underflowing to a returned 0 (no lane found) once it passes below zero — steps the index down with a wrap back to 3 when it goes negative, and reads a candidate from the four-entry table `loc_149`, remapping the raw value `0x03` to `0x05`. A candidate qualifies when its lane-occupancy entry `loc_13c`,idx is non-zero; on that hit it builds `loc_2c = loc_149[y] | 0x40` (the selected lane with bit6 set), loads `loc_2d` from the list-hi table `loc_9afd`+2, leaves 0x02 in `loc_2b`, and reports `loc_29`.

**Allocating and seeding the slot.** `loc_994d` [seen] is the allocator that consumes those staged `loc_29`/`loc_2a`/`loc_2b`/`loc_2c`/`loc_2d` scratch fields. It scans the depth table `loc_2df` downward from the index in `loc_11c`, looking for a free (zero) entry; running off the bottom (index turning negative) returns 0x00 to signal "no room". On a free slot `y` it writes the whole parallel record: depth `loc_2df`,y from `loc_29`; the target segment `loc_2b9`,y from `loc_2a`, except that a value of `0x0f` while `loc_111` bit7 is set is replaced by a fresh random segment `loc_60ca & 0x0e`; the successor `loc_2cc`,y = `(seg+1)&0x0f`; the timer `loc_2a6`,y cleared to 0; the coordinate pair `loc_28a`,y from `loc_2c` and `loc_291`,y from `loc_2d`; and the lane/flags byte `loc_283`,y from `loc_2b`. It bumps the active count `loc_108`, derives the lane as `loc_2b & 0x07`, and increments that lane's occupancy counter `loc_142`+lane, reporting 0x10 for success. (`loc_36` is used only as scratch to shuttle the incoming Y then X through the routine.)

**Picking the target segment by tube depth.** `loc_a028` [code] chooses a segment for slot `x` by surveying the 16-column depth map `loc_3ac`. It starts from a random column (`loc_60da & 0x0f`), and over sixteen steps (counter `loc_140` from 0x0f down through underflow) keeps the column holding the greatest depth, treating an empty (zero) column as maximal `0xff`; column `0x0f` is skipped while the gate `loc_111` is non-zero. The winning column is recorded as the slot's target `loc_2b9`,x with successor `loc_2cc`,x = `(winner+1)&0x0f`, and bit7 of `loc_28a`,x is cleared. Its own-cell writes were not exercised in the capture, so it is [code]. `loc_9fc4` [seen] is the per-slot approach step that drives `loc_a028`: it raises `loc_10c` to 1, then reads the slot's current column `loc_2b9`,x and, in the column map `loc_3ac`+col, seeds an empty column to `0xf1` and keeps `loc_3ac`+col as the running *minimum* of the slot's depth `loc_2df`,x — tagging `loc_39a`+col = `0x80` whenever a fresh minimum is set. It then acts on the depth: below `0x20` it forces bit7 of `loc_28a`,x and clamps the depth up to `0x20`; between `0x20` and `0xf1` it does nothing further; at `0xf2` or above it calls `loc_a028` to pick a new column, reparks the depth at `0xf0`, and — only when `loc_3ab` is zero — rewrites the slot's low fields, setting `loc_28a`,x low two bits to `01` (`&0xfc | 0x01`) and `loc_283`,x low three bits to `010` (`&0xf8 | 0x02`) and dropping `loc_10c` back to 0.

**Per-slot flag maintenance.** `loc_9eab` [code] conditionally toggles bit6 of `loc_283`,x, but only while the gate `loc_111` is non-zero: with bit6 already set it clears it (`&0xbf`) once the slot's `loc_2b9`,x byte reaches `0x0e` or more, and with bit6 clear it sets it (`|0x40`) only while that byte is exactly 0. Neither conditional write path fired in the capture — the gate/threshold conditions were never met together — so it stays [code], with its mask values (0x40 set, 0xbf clear) read from code rather than observed. `loc_9ed7` [code] is a pure direction-lookup helper with no own write: it returns `loc_3ee[y] | 0x80`, or, when bit6 of the caller's A is set, a half-turn — stepping the index back one within the 16-slot ring (`y = (y-1)&0x0f`) and returning `(loc_3ee[y] + 8) & 0x0f`, still with bit7 forced on. Having no memory write, its role rests on the code and it is [code].

**Promoting a pending source into a live enemy.** `loc_a2a6` [seen] is the spawn/timer loop that moves an armed source slot into an active enemy entry. It does nothing while `loc_201` bit7 is set. Otherwise it walks source slots `x` from 6 down to 0, considering only those whose depth `loc_2df`,x is non-zero and at least `0x30` and whose flag `loc_28a`,x has bit6 set. For such a slot it decrements the spawn timer `loc_2a6`,x and acts only when that decrement underflows (bit7 becomes set), immediately restoring the timer by one; it then skips the slot if `loc_283`,x bit7 is set, and gates on chance — the POKEY random `loc_60ca` must reach the per-population threshold `loc_a304`[`loc_a6`] (the live-enemy count `loc_a6` indexing a spawn-rate table), otherwise it holds off. When all of that passes it scans destination slots from `loc_11a` downward for a free entry (`loc_2db`,y == 0) and fills it: the active depth `loc_2db`,y from the source depth `loc_2df`,x, the segment `loc_2b5`,y from `loc_2b9`,x, and the successor `loc_2c8`,y from `loc_2cc`,x. It reseeds the source timer `loc_2a6`,x from `loc_119`, cues the spawn sound, bumps the live count `loc_a6`, and ends the free-slot scan.

**The eight-slot timed-object table.** A separate object table of eight parallel slots — lane `loc_2fa`, type `loc_302`, presence/position `loc_30a`, and an advancing counter `loc_312` — carries short-lived spawn-related objects keyed to a lane; the exact on-screen object is not settled by this code alone. `loc_a3d6` [seen] inserts one: it saves X/Y into `loc_35`/`loc_36`, scans slots 7..0 for the first empty entry (`loc_30a`,i == 0), and failing that evicts the slot holding the largest counter (tracked in `loc_2a`/`loc_2b`) while dropping the live count `loc_116` by one. Into the chosen slot it clears the counter `loc_312`, and writes type `loc_302` from `loc_2c`, presence `loc_30a` from `loc_29`, and lane `loc_2fa` from `loc_2d`, then bumps `loc_116`. `loc_a3d4` [code] is the thin front door that stages A into `loc_2c` before falling into `loc_a3d6`; its sole own write (`loc_2c`) held constant across the capture, so it is [code]. `loc_a416` [seen] ages the table: if the pending flag `loc_116` is zero it returns, otherwise it clears `loc_116` and, for each live slot, advances the counter `loc_312`,i by the per-type step `loc_a44e`[type] — freeing the slot (`loc_30a`,i := 0) once the counter reaches the per-type limit `loc_a448`[type], or re-raising `loc_116` for another pass when it is still short.

**Drivers of the object table.** Several handlers drive that table by staging fields and calling the insert directly. `loc_a34b` [seen] primes a fresh top-priority object: it writes `loc_13b` = 0xff and a type of `0x01` into `loc_2c`, seeds the presence `loc_29` from `loc_202` and lane `loc_2d` from `loc_200`, fires the sound gate, inserts the object, and raises the ready flags `loc_201` = 0x81 and `loc_13c` = 0x01 (the [seen] tag rests on its captured `loc_2c`/`loc_29`/`loc_2d`/`loc_201`/`loc_13c` writes). `loc_a1e4` [code] guards that priming: it acts only when the live byte `loc_200` matches slot x's target `loc_2ad`,x and the ready flag `loc_201` bit7 is not already set, then calls `loc_a34b` and latches `loc_201` = 0x81; with no role-defining own write captured it is [code]. `loc_a3ca` [seen] rings the fixed sound cue, copies the y-indexed source depth `loc_2df`,y into the scratch `loc_29`, and inserts through `loc_a3d4`. `loc_a36f` [seen] retires an active enemy in slot Y: it fires the sound gate, stages the source (`loc_29` from `loc_2db`,y) and target (`loc_2d` from `loc_2b5`,y), re-inserts a zeroed object via `loc_a3d4`, clears the active entry `loc_2db`,y, decrements the live count `loc_a6`, and flags lane X spent by writing `loc_2f2`,x = 0xff.

## Enemy motion and the pursuit AI

Each active enemy occupies one slot `x` across a family of parallel zero-page and page-2 tables, and its motion is carried as three signed 16-bit velocity/position axes. `loc_a6a9` is the integrator [code]: for each axis it adds the velocity-low byte into a fraction cell (axis 0 folds `loc_2e3` into `loc_223`, axis 1 folds `loc_2c3` into `loc_203`, axis 2 folds `loc_303` into `loc_243`), keeps the fold carry, then forms the new whole coordinate as velocity-whole plus the previous coordinate whole plus that carry — axis 0 across `loc_343`/`loc_283`, axis 1 across `loc_323`/`loc_263`, axis 2 across `loc_363`/`loc_2a3`. Whether the axis has overflowed the tube ring is decided by the *velocity-whole*'s sign bit: a rising axis (bit 7 clear) overflows when the new whole reaches `0xf0` or more, a falling axis (bit 7 set) overflows when it drops below `0x10`. Axis 1 stores its result to `loc_263`, axis 2 to `loc_2a3`, and axis 0's whole lands in `loc_283` only at the very end — and is forced to `0x00` if *any* of the three axes overflowed. So `loc_283+x` doubles as the slot's primary state byte: `loc_a6a9` writes an axis-0 coordinate there, while the rim/pursuit routines below read the same byte's bit 6 as a travel-direction flag, bit 7 as a sign/active marker, and its low three bits as the enemy kind — the code overloads one cell, and the ring clamp and the flag reads run in different phases of an enemy's life rather than simultaneously.

Velocities are bled toward rest by `loc_a721` [code], the per-slot damping step. It seeds the saturation counter `loc_29` to `0xfd` and runs each of the three velocity pairs — `loc_2c3`/`loc_323`, then `loc_2e3`/`loc_343`, then `loc_303`/`loc_363` — through `loc_a75d`, storing the stepped low and whole back. `loc_a75d` [code] moves one signed 16-bit velocity a single fixed increment held at `loc_a788` (`0x20`) toward zero: it adds `0x20` when the whole is negative and subtracts it otherwise, and when the result crosses zero it snaps the pair to zero, forces the low byte `loc_2a` to 0, and bumps `loc_29`. Because the seed is `0xfd`, three saturating axes wrap `loc_29` to `0x00`, and only then does `loc_a721` zero the slot's coordinate byte `loc_283+x` — an enemy whose motion has fully died out is retired. A companion fixed-point helper, `loc_adce` [code], folds a signed sub-step held in `loc_50` (shifted left three, i.e. times eight) into the accumulator `loc_51`, propagates the fold carry plus the step's sign-extended high byte up into A, and clears `loc_50`; in this capture the step stayed zero, so the fold was only ever observed as a no-op. `loc_b0ab` [code] rides that integrator to move the shared rim position `loc_200`: it calls `loc_adce` on `loc_200`, floors a negative result to `0x00`, clamps anything at or above the ceiling in `loc_127` down to that ceiling, and writes the clamped value back to `loc_200` (also returning it in both A and Y). `loc_200` never actually moved in the capture, so its role as the driven position rests on the code rather than an observed change. The last motion helper, `loc_b6fa` [code], is a signed fractional scaler: it stashes its input in `loc_29`, takes the low three bits of slot `x`'s phase counter `loc_2cc+x` into `loc_2c`, and over three rounds does a shift-add of the input governed by the fraction's bits, each round applying a sign-preserving right shift; it was not reached in this capture.

New enemies enter through `loc_a65b` [code]. It marks the slot live by writing `0x80` into all three coordinate-whole bytes `loc_263`, `loc_283`, and `loc_2a3`, then fills the three velocity pairs from the random sources `loc_60da` and `loc_60ca`: the low bytes come straight from the RNG (`loc_2c3`, `loc_2e3`, `loc_303`) while the wholes come from `loc_a69b` (`loc_323`, `loc_343`, `loc_363`), with the middle axis (`loc_343`) forced non-positive so that axis always launches in one direction. `loc_a69b` [code] is the signed-random-step leaf: it reads a 3-bit magnitude (0..7) from `loc_60da` and negates it when the caller's incoming value has bit 0 set, yielding a nudge in [-7, +7]. Both `loc_a65b` and `loc_a69b` were unreached in the capture, so their spawn role is read from the code. After seeding the slot, `loc_a65b` hands off to the sound cue.

The pursuit logic decides which way an enemy — or the auto-aiming player — should turn around the rim, and it all pivots on the signed segment-delta leaf `loc_a7a6` [seen]. That routine computes A minus Y, stashes the raw difference into `loc_2a`, then either keeps the full byte (when `loc_111`'s high bit is set — the open-tube geometry) or masks to the low nibble and sign-extends bit 3 into a signed byte (the closed-tube case, where segment arithmetic wraps modulo sixteen); only the raw difference is stored in `loc_2a`, while the masked/sign-extended nibble is returned in A rather than written back. `loc_97c5` [seen] is the target picker and auto-aim: it walks the slot depth table `loc_2df` for `loc_11c` entries looking for the smallest *nonzero* depth (the nearest object), tracking that minimum in `loc_29` and its slot index in `loc_2a`; if none is found it returns the last entry seen, otherwise it takes that slot's segment from `loc_2b9`, diffs it against the player segment `loc_200` through `loc_a7a6`, and returns a spinner code by the sign of the result — `0x00` when aligned, `0x09` when the target lies negative, `0xf7` when positive. `loc_9d67` [code] records the pursuit side onto an enemy: it takes slot `x`'s target segment from `loc_2b9+x`, diffs the player segment `loc_200` against it, and then clears bit 6 of the slot flag `loc_283+x` when that difference is negative or sets bit 6 otherwise — writing which rotational side the player lies on into the same travel-direction bit. `loc_9c4f` [seen] simply toggles that bit 6 of `loc_283+x` in place and returns the new byte, reversing an enemy's rim travel; this toggle is observed changing in the capture.

The flip decision itself is `loc_9d06` [seen], reached when a slot's tube-depth reaches the shared target. It first stashes the shared byte `loc_202` into the slot's depth cell `loc_2df+x`. If the slot is kind 1 with the gate byte `loc_3ab` nonzero it toggles bit 7 of `loc_28a+x` and stops; if the slot's flag byte `loc_283+x` is negative it merely bumps the stashed depth `loc_2df+x` and stops. Otherwise it decrements `loc_108` and branches on `loc_109`: when `loc_109` equals 1 it scans slots 6..0 for a non-empty, non-self entry in `loc_2df` whose stashed byte matches the shared one, recording the last non-empty index in `loc_38`, and copies that matched slot's bit 6 *inverted* into `loc_283+x` (so the enemy takes the opposite rim direction of its neighbour); when `loc_109` is not 1 it instead defers the side decision to `loc_9d67`, aiming the enemy at the player. Either way it finishes by writing `0x41` into `loc_10b` and incrementing `loc_109`.

Enemy activity is paced by a small trio of slot-timer routines. `loc_c9af` [seen] clears `loc_4`, decrements the active slot's countdown `loc_48+x` (with `x` = `loc_3d`), and — when the `loc_48`/`loc_49` pair is fully spent — finalizes through `loc_c9f1`; otherwise, if the current slot's countdown hit zero it arms `loc_1`=`0x0c` and `loc_4`=`0x28`, then walks the toggle `loc_3f` (flipping its low bit whenever `loc_3e` is nonzero) until it lands on a non-empty slot, and arms that slot's timers from `loc_46+x` (writing `loc_2`=`0x1c` when that byte+1 wrapped to zero, else `0x02`) with `loc_0`=`0x0a`. `loc_c9f1` [seen] is the peak pacer: it scans the window `loc_46+x` for `x` from `loc_3e` down to 0, keeps the maximum in `loc_126`, decrements it once when nonzero, and sets the timer `loc_0` to `0x10` when the status byte `loc_5` is negative or `0x14` otherwise. `loc_c81b` [seen] derives a pending step of 0..2 from bits 5 and 6 of the flag `loc_4e` combined with a "counter `loc_6` >= 2" test: it drains `loc_6` by the step, stores the step in `loc_3e`, and on a nonzero step sets `loc_5 |= 0xc0`, zeroes `loc_16`/`loc_18`/`loc_0`, bumps a 16-bit tally at `loc_40c`/`loc_40d` (indexed 0 for a step of 1, 3 for a step of 2), and clamps `loc_100 + step` to a ceiling of `0x63`; when the gate is clear it instead conditionally seeds four intro cells (`loc_1`=`0x10`, `loc_4`=`0x20`, `loc_0`=`0x0a`, `loc_2`=`0x14`) and clears `loc_50`/`loc_123`. MAME confirms the mechanics of `loc_c81b`, but its exact meaning in the game's vocabulary is not settled — treat it as a paced step/tally producer rather than a named gameplay event.

Two routines turn this motion state into something drawable, and one is unresolved. `loc_b634` [seen] builds a screen point for slot `x`: it takes the slot's segment `loc_2b9+x` as an index into the base coordinate tables `loc_3ce`/`loc_3de` (into `loc_56`/`loc_58`), then offsets each by a signed table delta chosen by the low four bits of the phase counter `loc_2cc+x` — `loc_b68b[idx]` on the X axis and `loc_b687[idx]` on the Y — using a `0x80`-biased signed-saturating add, landing screen X in `loc_2e` and Y in `loc_30`, copying `loc_57` into `loc_2f`, and loading a style-byte pair `loc_bcdc`/`loc_bcec` indexed by `loc_112` into `loc_59`/`loc_5a`; all of its writes are observed changing. `loc_a7d2` [seen] remaps the 8-entry table `loc_3fe` against the reference `loc_115` (returning immediately if that reference is zero): scanning `x` from 7 down to 0, an entry of `0x17` or more shrinks by 7, a mid entry (nonzero, below `0x17`) snaps to a rail — `0xf0` when `loc_115` is negative, else `0`, and a zero entry adopts `0xf0` only when `loc_115` is negative and its next neighbour is nonzero and below `0xd5`. Every result is OR-folded into `loc_29`, `loc_37` is set to `0xff`, and if the whole table collapses to zero the reference `loc_115` is cleared — a rail-ward remap of a lane/object line consistent with the tube geometry, though whether it is the spike line specifically is not settled here. Finally, `loc_b875` [code] rotates the three-entry array `loc_22`..`loc_24` down by one with wraparound and mirrors each new value into `loc_809`..`loc_80b`; it is reached only through the computed dispatch `loc_b84e` (table index 1) and never ran in the capture, so its game role is unconfirmed.

## The mathbox: projection and level tables

Tempest draws its tube in perspective by handing 2-D point deltas to the cabinet's math coprocessor — a bit-slice unit wired into the memory map at `loc_6080`–`loc_6096` (operand registers), `loc_6040` (a status port whose bit 7 reads high while a computation is in flight), and `loc_6060`/`loc_6070` (the low/high bytes of each result). This subsystem prepares that hardware, drives it point by point to project a level's lane vertices onto the screen, and builds the per-level geometry tables the projection reads from.

### Priming the coprocessor — `loc_c1c3` `[seen]`

Before a projection run, `loc_c1c3` clears the working state. It zeroes a set of zero-page accumulators (`loc_81`, `loc_91`, `loc_80`, `loc_78`, `loc_90`, `loc_88`) and then zeroes most of the coprocessor's input block: `loc_6080`, `loc_6081`, `loc_6083`, `loc_6084`, `loc_6085`, `loc_6086`, `loc_6087`, `loc_6089`, `loc_608d`, `loc_608e`, `loc_608f`, and `loc_6090`. It deliberately leaves `loc_6082`, `loc_6088`, `loc_608a`, and `loc_608b` untouched — those four cells in the range are not part of what it resets. As its last act it writes the control register `loc_608c` = `0x0f`, arming the unit for the mode this subsystem uses. In the capture every observed transition was constant (each target already held zero, and `loc_608c` moved `0x0f`→`0x0f`), so while the routine's role is confirmed the write values other than the constant control byte were not exercised against a nonzero prior state.

### The projection driver — `loc_c098` `[seen]`

`loc_c098` is the heart of the mathbox interface: it turns a pair of source-versus-destination coordinates into projected screen offsets and folds them into two running 16-bit accumulators. It first forms a signed 16-bit delta from `loc_57` − `loc_5f` (the low byte, written to the delta-input register `loc_6095`) with the high byte taken as `0` − `loc_5b` minus the borrow and written to `loc_6096`; if that high byte comes out negative (bit 7 set) the delta is clamped to a minimum magnitude of one, forcing `loc_6096` = `0x00` and `loc_6095` = `0x01`. It then derives `|dx|` = `|loc_58 − loc_60|` with the sign recorded in `loc_33` (`0xff` when `loc_58 < loc_60`, else `0x00`) and issues that magnitude to the coprocessor through both `loc_608e` and `loc_6094`. It likewise derives `|dy|` = `|loc_56 − loc_5e|`, storing the magnitude in the zero-page cell `loc_32` and the sign in `loc_34`.

With the first magnitude issued, the routine spins on `loc_6040` bit 7 until the unit is idle, reads the projected result out of `loc_6060`/`loc_6070` into `loc_63`/`loc_64`, and immediately re-issues the pending `|dy|` (from `loc_32`) to `loc_608e`/`loc_6094` to start the second computation. It then folds the first projected result into the signed 16-bit accumulator `{loc_64:loc_63}` against the offset pair `{loc_69:loc_68}`, choosing subtraction when the `loc_33` sign bit is set and addition otherwise, and saturating: a subtract overflow pins the pair to `{loc_63 = 0x00, loc_64 = 0x80}` and an add overflow to `{loc_63 = 0xff, loc_64 = 0x7f}`. A second spin on `loc_6040` bit 7 follows, after which the second projected result is read into `loc_61`/`loc_62` and folded the same way against the offset pair `{loc_67:loc_66}` under the `loc_34` sign, with matching saturation limits on `{loc_62:loc_61}`. The net effect is two perspective-scaled screen offsets, one per axis, with sign carried from the original coordinate direction.

### Projecting a level's lanes — `loc_c473` `[seen]`

`loc_c473` walks a whole level's worth of lane vertices through the driver. Called with a starting value in the accumulator (stored to `loc_57`) and an output index (stored to `loc_38`), it clears a clamp tally in `loc_59`, sets the loop counter `loc_37` to `0x0f`, and runs sixteen passes counting `loc_37` down to zero (breaking when it goes negative). Each pass loads that lane's base coordinates from `loc_3ce + loc_37` into `loc_56` and from `loc_3de + loc_37` into `loc_58`, calls `loc_c098` to project them, and then clamps the two resulting signed values into the window −4..+3 (`0xfc`..`0x03`). The clamp treats the accumulator high byte as the integer to bound and the low byte as its companion sign field: a negative value below `0xfc` is pinned to `0xfc` with sign `0x01`, a positive value at or above `0x04` is pinned to `0x03` with sign `0xff`, and anything already inside the window passes through with its original sign. The clamped value and sign for the first result are written to `loc_31a + loc_38` and `loc_32a + loc_38`, and for the second result to `loc_33a + loc_38` and `loc_34a + loc_38`; every clamp that actually fired increments `loc_59`. After each pass `loc_38` is decremented alongside `loc_37`, and the routine returns the clamp count in `loc_59`. These four indexed arrays are the projected slot coordinates the renderer consumes for the tube's lanes.

### Unpacking the level's shape and colour tables — `loc_c196` `[seen]`

`loc_c196` expands a level's packed geometry/colour data from ROM into RAM. It takes the level selector `loc_9f & 0x70`, clamps it to at most `0x5f`, and forms the ROM index `x = (selector >> 1) | 0x07`. Counting `y` from 7 down to 0 it reads the packed byte `loc_c1fd + x` and splits it: the low nibble is written both to the zero-page table `loc_19 + y` and to its display mirror `loc_800 + y`, while the high nibble is written to `loc_21 + y` and its mirror `loc_808 + y`, with the ROM index stepping down each iteration. One pass thus fills four eight-entry tables — a zero-page copy and a display-RAM copy of each of the low- and high-nibble sets — from a single packed source.

### Rebuilding tables and arming the vector tail — `loc_b888` `[code]`

`loc_b888` first calls `loc_c196` to rebuild the packed nibble tables described above, then seats the two-byte vector-list tail cursor by writing `loc_139` = `0x7f` and `loc_13a` = `0x04`. Neither of those two writes was observed firing in the capture, so the routine is tagged `[code]`: its coordinating role over `loc_c196` and the tail-cursor values are read from the code, not confirmed by the write-tap.

### Building a level's tube geometry — `loc_c235` `[seen]`

`loc_c235` populates the per-lane coordinate source tables that `loc_c473` later projects. It first derives a table selector by passing `loc_46 + loc_3d` through `loc_c2e8` (below), whose returned value becomes the seed index and whose stored `loc_112` becomes the row index `y` into a family of ROM tables. From row `y` it computes `neg = −(loc_bc8c + y)` and writes it to both `loc_5f` and `loc_5d`, sets `loc_a0 = 0x10 − neg`, forces the guard `loc_5b` = `0xff`, loads `loc_60` from `loc_bc9c + y`, and loads `loc_111` from `loc_bccc + y`. A mode gate on `loc_2` follows: when `loc_2` = `0x1e` the offset pair is taken straight from ROM as `loc_68` = `loc_bcac + y` and `loc_69` = `loc_bcbc + y`; otherwise it forms the signed 16-bit difference `{loc_bcbc+y : loc_bcac+y}` − `{loc_69 : loc_68}`, arithmetic-shifts it right four places keeping the low byte, and stores the result to the level-geometry scale `loc_121`. It then clears `loc_66`, `loc_67`, `loc_10f`, and `loc_110`, and sets `loc_113` = `0x2c`.

With those scalars in place it seeds six per-column arrays top-down over sixteen columns, walking a neighbour index `ny` down from the seed: `loc_3ce + x` from `loc_b97c + ny`, `loc_3de + x` from `loc_ba7c + ny`, `loc_31a + x` and `loc_33a + x` and `loc_39a + x` cleared to zero, and `loc_3ee + x` from `loc_bb7c + ny`. Finally it computes two rounded neighbour-midpoint tables: for each column `x`, `loc_435 + x` is the rounding average of `loc_3ce + ((x+1)&0x0f)` and `loc_3ce + x`, and `loc_445 + x` the same average of the `loc_3de` pair — where the average adds the two bytes plus one and rotates the nine-bit sum right so the carry lands in bit 7 (a wrapping midpoint around the tube's sixteen lanes). The `loc_3ce`/`loc_3de` base tables and the `loc_435`/`loc_445` midpoint tables it produces are exactly the geometry the projection loop reads.

### Packing a table byte — `loc_c2e8` `[seen]`

`loc_c2e8` reduces an input byte into a packed table entry. If the input is `0x62` or greater it substitutes a masked hardware byte, `loc_60ca & 0x5f`, as a fallback. It splits the (possibly substituted) value into a quotient `value >> 4` (returned in X) and a remainder `value & 0x0f` (returned in Y), uses the remainder to index the ROM table `loc_bc7c + remainder`, stores that looked-up entry to `loc_112`, and returns in the accumulator the packed byte `(entry << 4) | 0x0f` — the table entry in the high nibble with the low nibble forced to `0xf`. This is the seed/row selector `loc_c235` consumes.

### Snapping a coordinate up to a reference — `loc_c453` `[seen]`

`loc_c453` conditionally nudges a coordinate up toward a reference. It returns immediately if the guard `loc_5b` is nonzero, and also returns if `loc_57` already sits `0x0c` or more above the reference `loc_5f`. Otherwise it sets `loc_57` to `loc_5f + 0x0f`, capped at a ceiling of `0xf0`. The operands `loc_57`, `loc_5b`, and `loc_5f` are the same coordinate cells fed to the projection driver, so this acts as a floor-snap that keeps a near-rim coordinate a fixed step ahead of its reference.

### Setting a mode flag and scale — `loc_ca48` `[seen]`

`loc_ca48` chooses one of two `(flag-bit, scale)` pairs from two gates. By default it selects `a = 0x00`, `y = 0x10`; only when both `loc_117` and `loc_3d` are nonzero does it switch to the alternate `a = 0x04`, `y = 0x08`. It then copies bit 2 of the chosen `a` into the flag byte `loc_a1` while preserving the flag's other bits — computed as `((a ^ loc_a1) & 0x04) ^ loc_a1` — and stores the chosen scale to `loc_b4`. In the capture only the default branch ran, so `loc_a1`'s bit 2 was observed staying clear; the alternate `a = 0x04` path that would set that bit was not exercised, though both role writes themselves fired.

## Sound, POKEY and the interrupt heartbeat

Tempest's audio lives in a bank of sixteen software voice slots that are stamped by a
request front-end, animated once per interrupt, and streamed out to a pair of POKEY chips
mapped into the `0x60c0`/`0x60d0` register windows. Sitting alongside that same interrupt
tick is a small three-lane counter engine and a set of hardware-region housekeeping
routines. This section walks the request path, the per-interrupt heartbeat, the POKEY
initialisation, and the neighbouring config/coprocessor helpers that share the `0x60xx`
address space.

### The voice-slot model

The sixteen voices are four parallel zero-page arrays. `loc_c0`..`loc_cf` holds each
slot's current animation frame/value, `loc_d0`..`loc_df` its output *level* byte (the byte
that eventually reaches a POKEY audio register), `loc_e0`..`loc_ef` a fast countdown timer,
and `loc_f0`..`loc_ff` a slow countdown timer. `loc_bf` is a single reserved-slot marker:
while a slot is being stamped it briefly holds that slot index, and it otherwise rests at
its `0xff` sentinel so the per-frame stepper treats no slot as reserved.

### Requesting a sound (loc_ccc7, loc_ccc3, and the id trampolines)

Effects enter through a family of tiny fixed-id entry points, each of which loads one
sound id (the high nibble stepping through the range) and drops into the enable gate
`loc_ccc3`: `loc_ccb5` raises `0x0f`, `loc_ccc1` `0x1f`, `loc_ccea` `0x2f`, `loc_cd02`
`0x3f`, `loc_ccb9` `0x4f`, `loc_ccb0` `0x5f`, `loc_ccee` `0x6f`, `loc_ccf2` `0x7f`,
`loc_ccbd` `0x8f`, `loc_ccf6` `0x9f`, `loc_ccfe` `0xbf`, and `loc_cd06` `0xcf`. Several of
these carry the caller's X/Y through so the stamp step can preserve them. All of these are
`[code]` — none makes a write of its own, so the write-tap cannot attribute a bare id load
to a specific entry point; their effect is entirely the work of the shared consumer.
`loc_ccfa` is the one exception in shape: it loads id `0xaf` and goes *straight* to the
registrar `loc_ccc7`, bypassing the enable gate, so an `0xaf` request is always honoured
where the gated ids are not (`loc_ccfa` is `[code]` — not reached in this capture).

The gate `loc_ccc3` (`[code]`) tests `loc_5`: if bit 7 of that sound-enable flag is clear
it returns immediately and drops the request; only with bit 7 set does it fall into the
registrar. Its own vectoring was not witnessed in this capture, hence the tag.

`loc_ccc7` (`[seen]`) is where a request actually lands. It first parks the caller's X and
Y into `loc_31` and `loc_32`, then takes the sound id in A and walks the sixteen slots from
index `0x0f` down to `0`, decrementing the id in lockstep with the slot index. At each step
it reads one byte of the sound's row from the table based at `loc_cb01` (indexed by the
running id). A zero byte leaves that slot alone; a nonzero byte *claims* the slot — it sets
`loc_bf` to the slot index, stores the table byte into that slot's frame cell
`loc_c0+slot`, arms both timers with `loc_e0+slot = 0x01` and `loc_f0+slot = 0x01`, and
then restores `loc_bf` to its `0xff` sentinel. In MAME this is heavily exercised: the slot
claims and both timer arms fire across the voice table, and `loc_bf` is seen cycling to a
slot index and back to `0xff`.

### The interrupt heartbeat (loc_cf24, then loc_cd0a)

On essentially every interrupt the machine runs `loc_cf24` and then the voice stepper
`loc_cd0a`; the grounding capture confirms `loc_cf24` is entered from the interrupt handler
immediately ahead of `loc_cd0a`, and both are `[seen]`.

`loc_cf24` drives three parallel lanes indexed X = 2,1,0, each enabled by a distinct bit of
the control byte `loc_8` (bit 0, bit 1, bit 2 — extracted by the per-lane shift pattern
that feeds the running `carry`). For each lane it maintains a position in `loc_d+x`
(`loc_d`/`loc_e`/`loc_f`) that is masked to five bits and wrapped modulo `0x20` (the
saturating step at the head of the routine turns `0x20` back into `0x1f`), a per-lane
reload timer `loc_10+x` that reloads to `0x78` when it runs out, and a per-lane counter
`loc_13+x`. A gate on `loc_8 & 0x08` can force the shared cell `loc_c` to `0xf0` and, while
`loc_c` is nonzero, it decrements it and blanks that lane's `loc_d+x`/`loc_10+x`. When a
lane signals (carry set out of the timer block) the accumulator block folds a per-lane
value into the running totals: it adds into `loc_16` (plus one), adds into `loc_17` (plus
one), and increments `loc_13+x`. After the three lanes, a scoring/threshold pass derives
`y = loc_9 >> 5`, subtracts the table entry `loc_cfd9+y` from `loc_16`, and on a
non-negative result stores it back and bumps `loc_18` (with a special double-bump and wrap
guard when `y == 0x03`); the `throw` in that block is a fall-through-into-data guard that a
valid state never reaches. A second fold keyed on `loc_9 & 0x03` runs a complemented add
through `loc_17`/`loc_18` and nudges `loc_6`.

The routine finishes with two clamp passes over the `loc_13` lane triple, both gated behind
`loc_7` bit 0 being clear. **The two passes subtract different constants.** The first pass
(`loc_d00d`) only touches a lane whose `loc_13+x` is `>= 0x10`, and there it subtracts
`0x10` (implemented as `+ 0xef + carry` with carry known set), counting how many lanes it
touched. The second pass (`loc_d022`) only runs if the first touched nothing; it touches
any lane whose `loc_13+x` is nonzero and there subtracts `0x11` (the same `+ 0xef` add but
with carry clear), stopping the moment a result goes negative. It is never `0x11` for both
passes.

`loc_cd0a` is the per-frame voice engine. It scans the sixteen slots from `0x0f` down,
skipping any slot whose frame cell `loc_c0+x` is zero (idle) and skipping the one slot that
currently equals `loc_bf` (the reserved marker). For a live slot it decrements the fast
timer `loc_e0+x`; while that is still counting the slot is left alone. When the fast timer
reaches zero it decrements the slow timer `loc_f0+x` and branches on whether that is still
running. If the slow timer is still alive, it takes a *single* animation step: the frame's
high bit selects between the table pair based at `loc_cbcc`/`loc_cbcd` and the pair based at
`loc_cccc`/`loc_cccd`, reloading the fast timer from the first of the pair and folding the
second into the level via `loc_d0+x = level_delta + prior_level`; on odd slots the update
preserves the prior high nibble of the level byte
(`((prevD ^ new) & 0xf0) ^ new`). If instead both timers have expired, it walks the frame
forward in steps of two (`loc_c0+x += 2` each iteration) through the tables based at
`loc_cbcb`/`loc_cbce`/`loc_cbcc` (carry clear) or `loc_cccb`/`loc_ccce`/`loc_cccc` (carry
set), latching a new level into `loc_d0+x`, a fresh slow-timer reload into `loc_f0+x`, and a
fast-timer value into `loc_e0+x`, continuing until a nonzero frame lands (or the level
falls to zero). Whichever branch ran, the slot's level byte `loc_d0+x` is then *published*
to hardware: slots `0..7` write POKEY1 audio registers at `loc_60c0+x` (`0x60c0`..`0x60c7`),
and slots `8..15` write `loc_60c8+x`, which lands in POKEY2's audio window at
`0x60d0`..`0x60d7`. The POKEY writes are observed in MAME.

### POKEY reset and self-test (loc_cd95)

`loc_cd95` (`[seen]`) is the textbook dual-POKEY bring-up. It first clears the two SKCTL
registers (`loc_60cf`, `loc_60df`) and the self-test latch `loc_720`. It then samples the
two POKEY RANDOM registers — `loc_60ca` on POKEY1 and `loc_60da` on POKEY2 (hardware offset
`0x0a`) — and polls them across five passes; if either RANDOM value changes it latches the
first POKEY1 sample into `loc_720`, which is a random-generator self-test. It next writes
`0x07` into both SKCTL registers `loc_60cf`/`loc_60df` — `7` is the canonical POKEY SKCTL
init value — and zeroes the paired eight-entry audio arrays: `loc_60c0+x` and `loc_60d0+x`
for x = 7..0 (the eight audio registers of each chip) together with the software voice cells
`loc_c0+x` and `loc_d0+x`. Finally it clears both AUDCTL registers, `loc_60c8` and
`loc_60d8`.

### Neighbours in the 0x60xx region

Three more routines share the hardware page. `loc_dbe0` (`[code]`) is a small bit-packer:
it stores the incoming byte to `loc_60db`, copies **only the low three bits** of `loc_60d8`
into both the scratch byte `loc_37` and the output cell `loc_60cb`, and then returns those
three bits merged with a single relocated bit — bit 5 of `loc_60c8` shifted down to bit 3
(`(loc_60c8 & 0x20) >> 2`). The relocated bit rides only in the return value; the mirrored
copies in `loc_37` and `loc_60cb` carry the three low bits alone. It is tagged `[code]`
because every observed write was a constant (`loc_60cb`/`loc_37` = 0, `loc_60db` = 0xd0),
so the packing role itself was never exercised.

`loc_d6bb` (`[seen]`) is the option-switch decoder and the one caller of `loc_dbe0` here.
It reads the option port `loc_e00` into `loc_a`, slices it three ways — bits 5-3 index the
table at `loc_d6f7` into `loc_156`, bits 7-6 index `loc_d6ff` into `loc_158`, and bits 2-1
(via `a0 & 0x06`) index `loc_d6b3`/`loc_d6b4` into `loc_ac`/`loc_ad` — reads a second port
`loc_d00`, toggles it (`^ 0x02`) into `loc_9`, and folds the `loc_ad` slice through
`loc_dbe0`, recording that packed result into `loc_16a`.

`loc_dce6` (`[code]`, not exercised in this capture) primes and reads the math coprocessor
that lives just below the POKEY window. It zeroes `loc_73`, `loc_414`, and `loc_6090`,
stores the A operand into `loc_608e` and the X operand into `loc_608f`, seeds the count
registers `loc_608c` and `loc_6094` to `0x10`, then runs a sixteen-step down-count scanning
`loc_6040` for the first slot whose high bit is clear (ready); it hands back that slot's low
result `loc_6060` and high result `loc_6070`, or exits with the counter run past the end.

### Per-channel record sort and active-slot tick (loc_ac3f, loc_ad6e)

Two routines here maintain a pair of per-channel record tables and a per-frame active-slot
tick. Whether the "channels" they arbitrate are the audio voices above or another per-channel
resource is not settled by this code alone; what the code does is precise.

`loc_ac3f` (`[seen]`) clears bit 6 of `loc_5`, optionally pre-clears the six-byte scratch
block `loc_40`..`loc_45` (via `loc_ca62`, only when `loc_9 & 0x43 == 0x40`), queues an
EAROM request through `loc_ddfb`, and zeroes the running total `loc_601`. It then processes
one or two channels (starting channel is `0` when `loc_3e == 0`, otherwise `3`). For each
channel it seeds a key triple `loc_2c`/`loc_2d`/`loc_2e` from `loc_42+ch`/`loc_41+ch`/
`loc_40+ch`, records the channel parity in `loc_36`, sets the payload seeds
`loc_2b = 0`, `loc_2a = 0x1a`, `loc_29 = 0x1a`, and resets a pass counter `loc_605`. The
inner loop is a bubble sort over the row table: it walks a cursor down from `0xfd` (stepping
by two, or by three while the cursor is still high), comparing each row's key triple
`loc_620+y`/`loc_61f+y`/`loc_61e+y` lexicographically against the working key, and on an
out-of-order row swaps the row down — carrying the parallel payload triple
`loc_51e`/`loc_51f`/`loc_520` against `loc_29`/`loc_2a`/`loc_2b` for high cursor positions,
the `loc_61f`/`loc_620` pair against `loc_2d`/`loc_2c` always, and `loc_61e` against
`loc_2e` while the cursor is `>= 0x52`. Each outer step bumps the pass counter `loc_605`,
which is stored per channel into `loc_600+channel` when the channel settles. After both
channels it nudges the total: if `loc_601 >= loc_600` and `loc_601 < 0x63` it increments
`loc_601`. It then derives the request byte in `loc_603` from the flag `loc_3d`
(`request = (((flag ^ 0x01) << 2) | flag) + 0x05 + ((flag >> 6) & 0x01)`) and hands off to
the request walker `loc_ad22`. In MAME the pass counter is seen climbing and the per-channel
count being stored.

`loc_ad6e` (`[code]`, not exercised in this capture) is the per-frame tick of the active
slot. It sets `loc_1 = 0x06`, and when `loc_3 & 0x1f == 0` it expires a countdown: it
decrements `loc_605`, and if that reaches zero it sets `loc_00 = 0x14` and returns. Otherwise
it clamps the active slot value `loc_606+slot` (slot from `loc_602`) via `loc_adce` to the
`0x00`..`0x1a` rails — a positive value at or above `0x1b` folds to `0x00`, a value with bit 7
set is pinned to `0x1a` — and writes it back. It then reads the mode gate `loc_4e & 0x18`,
clears those and other bits with `loc_4e &= 0x67`, and returns if the gate was clear. With
the gate set it advances the slot cursor (`loc_602--`) and decrements the step counter
`loc_604`; if the step went negative it re-arms — when `loc_600+loc_3d < 0x04` it calls
`loc_ddf7` — and tail-calls `loc_ad22`; otherwise it retires the previous slot by writing
`loc_606+(slot-1) = 0x00`.

## The EAROM high-score store

The high-score table and its initials survive power-off in the cabinet's EAROM (the ER-2055-style non-volatile array), and this subsystem is the bit-serial engine that copies rows between that part and main RAM. It splits into two halves: a small family of setter routines that *queue* a transfer by stamping three request cells, and one state machine, `loc_de1b`, that drains that queue by walking the EAROM control/data ports at `loc_6000`, `loc_6040`, and `loc_6050`.

### The request cells and the setter family

Every request lives in three adjacent cells. `loc_1c7` holds up to three region bits (mask `0x07`) marking which blocks still need service; `loc_1c8` holds a parallel write-direction bit per region (bit set → write that region out to the EAROM, bit clear → read it back in); and `loc_1c6` is a blank flag whose nonzero value tells the engine to write zeros and erase the source RAM instead of copying live data.

The setters all converge on a shared tail, `loc_ddff`, which stores its `y` argument into `loc_1c6` and ORs its `a` argument into both `loc_1c7` and `loc_1c8`, merging new region bits into whatever is already pending. `loc_ddfb` [seen] is the plain entry: it supplies mask `0x04` and, through the intermediate `loc_ddfd` (which zeroes the index in `y`), reaches the tail to OR region bit 2 into the request/direction pair while leaving `loc_1c6` at `0`, i.e. a normal (non-blank) request. This is the observed path — the merge writes into `loc_1c7` and `loc_1c8` were seen carrying value `0x04`, which is why the chain grounds [seen].

The remaining setters are thin dispatchers whose own code paths were not exercised in the capture, so each stays honestly tagged [code]. `loc_ddf1` [code] is written as the fixed all-region-blank entry: it stamps `0xff` into `loc_1c6` and ORs `0x07` into both `loc_1c7` and `loc_1c8`, queuing all three regions in blank/erase mode; neither the `0xff` blank value nor the `0x07` all-region mask was observed at its writes, so it grounds [code] rather than [seen]. `loc_ddf3` [code] forces the index byte to `0xff` and enters the tail with the caller's mask, requesting that the named regions be written out in blank mode (`loc_1c6 = 0xff`). `loc_ddf7` [code] is a constant supplier that forces mask `0x03` and drops through `loc_ddfd` into the tail with a zeroed index; the merge points were only ever seen carrying `0x04`, never `0x03`, confirming this path is unexercised. `loc_dde9` [code] is likewise a trampoline that runs `loc_ddf3` with mask `0x04`, i.e. a blank-mode write request for region bit 2, with no observed write of its own.

### Kicking off a full read: `loc_de11`

`loc_de11` [seen] is the one setter that *sets* rather than *merges*: it writes `loc_1c7 = 0x07` and `loc_1c8 = 0x00` outright — all three regions requested, all in the read direction — and then falls straight into the state machine. Both of those stores were observed, which is what distinguishes it from the OR-based merge family and grounds it [seen]. This is the load path that pulls every stored high-score region back into RAM (the sequence a caller starts when the machine is otherwise idle).

### Draining the queue: `loc_de1b`

`loc_de1b` [seen] is the workhorse of the subsystem, exercised heavily. It runs as a re-entrant loop keyed on a mode byte, `loc_1ca`: when that byte is clear and `loc_1c7` still holds a pending bit, it begins a fresh row; each pass then either performs one hardware step and yields, or loops on to the next entry.

Starting a fresh row, it clears the entry cursor `loc_1cb`, the running checksum `loc_1cf`, and the walking-mask cell `loc_1ce`, then isolates the highest (most-significant) pending request bit: over up to eight iterations it rotates `loc_1c7` left, stopping the moment a set bit falls out of bit 7 into `loc_1ce`. The isolated bit in `loc_1ce` selects the direction — if it is also set in `loc_1c8`, the mode byte `loc_1ca` is armed to `0x80` (write); otherwise to `0x20` (read) — and that serviced bit is then cleared from `loc_1c7` by XOR. Doubling the surviving bit-position index gives an offset that selects this region's row from four parallel byte tables: `loc_dddd` supplies the starting port index into `loc_1cc`, `loc_ddde` the end limit into `loc_1cd`, and `loc_dde3`/`loc_dde4` the low and high halves of the RAM row pointer, loaded into `loc_bd`/`loc_be`. That pointer plus the entry cursor forms the effective address `(loc_be<<8 | loc_bd) + y` used to reach each RAM byte of the row.

Each service pass first resets the control port `loc_6040` to `0`, reads the mode byte, and returns immediately if it is clear (nothing queued). Otherwise it loads the entry cursor into `y`, the port index `loc_1cc` into `x`, and shifts the mode byte left so its top two bits fall out as a small state selector:

- **Write-arm (mode `0x80`):** the shifted value is zero and is stored to `loc_6000 + x`, the mode byte advances to `0x40`, and the control port is driven with `0x0e` before the routine yields — the arm half of a per-byte EAROM write.
- **Write-data (mode `0x40`):** the mode byte is set back to `0x80` for the next byte. If the blank flag `loc_1c6` is nonzero the source RAM cell at the row pointer is first zeroed, so the byte read back and written out is `0` (the erase behavior the blank setters request). The live (or zeroed) RAM byte is written to `loc_6000 + x`; but once the port index has reached the limit `loc_1cd`, the mode byte is retired to `0` and the *checksum* accumulator `loc_1cf` is written out as the row's trailing byte instead. The control port is driven with `0x0c`, the written byte is folded into `loc_1cf` and both the entry and port cursors (`loc_1cb`, `loc_1cc`) are bumped, and the routine yields.
- **Read (mode `0x20`):** it runs the read strobe — `loc_6040 = 0x08`, `loc_6000 + x = 0x08`, `loc_6040 = 0x09`, `loc_6040 = 0x08` — then takes the byte off the read-back port `loc_6050`. Below the limit, that byte is stored through the row pointer into RAM, added into the running checksum `loc_1cf`, and the cursors are advanced; the control port is left at `0` so the loop continues straight on to the next entry without yielding. At the limit the byte is the stored checksum: it is XORed against the accumulated `loc_1cf`, and on a match the row is accepted and the mode byte retired. On a mismatch the engine walks the entry cursor back down from `loc_1cb`, zeroing every RAM byte of the just-read row until the index wraps negative, so a corrupted read leaves no partial score behind, and it records the failure by ORing this region's bit (`loc_1ce`) into `loc_1c9`. That failure cell is the signal a fresh full write can later consume to rewrite the regions that failed verification.

When a pass drives the control port with a nonzero value it returns, ceding control between the real-time EAROM strobes and resuming on the next call; when the port lands at `0` the outer loop simply proceeds to the next entry or, once the mode byte is clear and no request bits remain, exits.

## State-reset, init and per-frame update chains

This subsystem is the machine's plumbing for wiping working RAM back to a known
baseline at cold start and between rounds, re-seeding the handful of scalars a fresh
mode needs, and then — once play is live — driving the per-frame bookkeeping that ages
in-flight objects, rebuilds the tube's per-lane geometry blocks when the cabinet's
option switches change, and folds points into the score.

### Cold-start and mode-reset leaves

A cluster of small routines runs off the boot/reset chain, each responsible for
blanking one array plus the scalar flags that travel with it. `loc_926f` [seen] zeros
the seven-byte block at `loc_2df` top-down (x = 6…0) and then clears seven scattered
flag cells — `loc_108`, `loc_109`, `loc_145`, `loc_142`, `loc_144`, `loc_143`,
`loc_146` — so both the table (`loc_2df`, later the per-lane object-depth table read all
over the per-frame code) and its companion flags start clean. `loc_928f` [seen] does the
same for the twelve-byte block `loc_2d3`…`loc_2de` and clears `loc_135` and `loc_a6`;
this one is not confined to reset — the per-frame update calls it too (see below).
`loc_929f` [seen] blanks the eight-byte table at `loc_30a` and clears the trailing flag
`loc_116`. `loc_92ad` [seen] is the smallest: it clears the single state byte `loc_50`
to zero. Each of these targets cells that carry non-zero values during play, so the
writes are genuine baseline resets rather than no-ops.

`loc_921b` [seen] seeds five fixed init constants in one pass: `loc_200`←0x0e,
`loc_51`←0xf0, `loc_106`←0x00, `loc_201`←0x0f, `loc_202`←0x10. Two of these,
`loc_200` and `loc_51`, are real state cells that vary elsewhere, and `loc_201` is the
sign-controlled dispatch byte the per-frame update keys on — so this routine establishes
the starting values those cells hold before the game begins mutating them.

`loc_9234` [seen] seeds a 17-cell parameter block: the header cell `loc_3ab` takes the
current value of `loc_15b`, then the sixteen per-lane body cells `loc_3ac`…`loc_3bb`
(x = 0x0f…0) are all filled with the value of `loc_15a`. The block is per-lane (sixteen
entries, matching the tube's sixteen segments), and `loc_3ab` is a real draining
counter, so this is a live parameterized fill, not a constant seed — the two source
cells decide what goes in.

Two more reset leaves each blank a small table and immediately re-arm it.
`loc_a7bd` [seen] zeros the eight bytes `loc_3fe`…`loc_405`, then overwrites the last
slot `loc_405` with 0xf0 and raises the flag `loc_115` to 0xff — the table is cleared
but seeded with a sentinel in its final slot and marked armed. `loc_a831` [seen] clears
the pair `loc_3aa` and `loc_125` together; `loc_125` is a latch that other code drives
to 0xff, so zeroing it here defines a fresh state.

`loc_a789` is the per-slot table reset: it zeros the sixteen bytes `loc_283`…`loc_292`
(x = 0x0f…0), then re-seeds scalars `loc_10e`←0x20, `loc_10d`←0x20, `loc_1`←0x04,
and `loc_68`=`loc_69`=0. In the capture only the shared insert paths of neighbouring
code touched `loc_283` and this body itself made no observed writes, so it carries the
[code] tag — its role rests on the code, run as the slot-table half of a mode/level
(re)init (its caller `loc_ad22` invokes it after seeding a slot's cells).

`loc_ca62` [seen] zeros the six-byte working block `loc_40`…`loc_45`. Those six bytes
are the two three-byte score/staging triplets (`loc_40`–`loc_42` and `loc_43`–`loc_45`)
that the scoring add below writes into, so this is the pre-clear that stages a fresh
accumulation.

### Fixed-constant state-entry seeders

Three routines seed the zero-page config block that later stages read, and they
deliberately overlap on `loc_0`…`loc_4`. `loc_b0e7` [seen] is a straight-line startup
seeder: `loc_0`←0x0a, `loc_2`←0x00, `loc_4`←0xdf, `loc_1`←0x12, `loc_14e`←0x19,
`loc_14d`←0x18. `loc_c97b` [seen] seeds a smaller set for its state entry —
`loc_2`←0x04, `loc_1`←0x00, `loc_0`←0x0a, `loc_4`←0x14. `loc_ca18` [seen] first masks
`loc_5` down to its low six bits (`loc_5 &= 0x3f`, clearing the top two flag bits) and
then writes its own init block: `loc_3e`←0x00, `loc_2`←0x1a, `loc_0`←0x0a,
`loc_4`←0xa0, `loc_16b`←0x01, `loc_1`←0x0a. The differing constants each writes into the
same `loc_0`–`loc_4` cells are how each state entry parameterizes that shared work-cell
group for what it is about to do.

### Wave initialization and spike tally

`loc_a5cb` [seen] is the per-wave setup that also measures the lane occupancy left
standing. It writes `loc_0`←0x20, ORs bit 7 into `loc_106`, clears `loc_104`,
`loc_107`, `loc_5c`, and `loc_123`, and sets `loc_105`←0x02. It then walks the sixteen
per-lane entries `loc_3ac`…`loc_3bb` and counts how many are non-zero into `loc_123` —
a tally of occupied/spiked segments (observed rising from 0 to 6 in the capture). If any
were live *and* the level `loc_9f` is below 0x07, it loads an intro/parameter block —
`loc_4`←0x1e, `loc_0`←0x0a, `loc_2`←0x20, and forces `loc_123`←0x80 — so the early
levels take a different path when segments carry over. Regardless of that branch it
finishes by marking the block ready with `loc_125`←0xff.

### Slot-request drain and spawn

`loc_ad22` [seen] drains a packed request word and spawns the first pending slot.
It loops on `loc_603`: an all-zero word means nothing is queued, so it writes the idle
exit status `loc_0`←0x14 and returns. Otherwise the low two bits pick a slot index —
`loc_3d` = `(loc_603 & 3) − 1` — and those two bits are consumed by shifting `loc_603`
right twice. It reads the slot byte `n = loc_600[loc_3d]`; a zero or out-of-range byte
(`n ≥ 0x09`) is skipped and the loop continues to the next field. For a valid slot it
scales the byte into `loc_602` by `((3n) XOR 0xff) − 0xe5` (compute `n<<1`, add `n` for
3n, ones-complement, subtract 0xe5, all byte-wide), then drives its two callees to arm
the spawn: it runs the mode-flag/scale helper, sets `loc_605`←0x60, clears `loc_4e`
and `loc_50`, sets `loc_604`←0x02, and runs the per-slot table reset `loc_a789` before
writing the armed exit status `loc_0`←0x24 and returning. The queue-drain half (walking
`loc_603`, selecting `loc_3d`, the two exit statuses) is grounded; the per-slot
spawn arithmetic into `loc_602`/`loc_604`/`loc_605`/`loc_4e`/`loc_50` is the code's
role as written.

### Per-frame update dispatch

`loc_a504` [seen] is the tail-of-frame update, dispatched on the sign of the control
byte `loc_201`. When `loc_201` is positive (`< 0x80`) it takes the housekeeping arm:
if a gate is live (`(loc_455 | loc_11b) ≠ 0`) and the limiter `loc_42` has passed 0x17,
it bumps the timer cell `loc_00[loc_40]` by one; it bails early if `loc_106` is set;
otherwise, when `(loc_3ab | loc_116) == 0`, it scans the depth table `loc_2df` downward
from `loc_11c` and, only if no live entry has already grown to or past 0x11, resets wave
state by running `loc_a5cb` then `loc_928f`. A further chain of gates —
`(loc_4d & 0x60) ≠ 0`, `(loc_5 & 0x80) ≠ 0`, and `(loc_9 & 0x43) == 0x40` — must all
hold before it re-runs `loc_a5cb` a final time.

When `loc_201` is negative (the arm actually exercised in the capture), it first bails
if any of `loc_135`, `loc_a6`, `loc_116` is set. It then **ages every live object in
the depth table**: for each entry `loc_2df[x]` (x from `loc_11c` downward) that is
non-zero, it adds 0x0f and snaps the result to 0x00 once it reaches or exceeds 0xf0 —
objects that climb past the far end expire. It then advances one of two timers depending
on `loc_48[loc_3d]`: if that per-slot byte is not 0x01 it steps the counter `loc_202` up
by 0x0f and proceeds once the pre-store value reaches 0xf0; if it is 0x01 it clears
`loc_10f`, sets `loc_114`←0x01, and steps the 16-bit countdown clock `loc_5b`/`loc_5f`
**down by 0x20** (subtract 0x20 from the low byte `loc_5f`, borrow into the high byte
`loc_5b`), proceeding when the high byte lands on the marker 0xfa. Only when the chosen
timer signals does it finish the frame's tick: `loc_00`←0x06, a call to `loc_928f`, and
a clamped running total `loc_3ab = min(0x3f, loc_108 + loc_109 + loc_3ab)`.

### Tube control-block rebuild chain

Four routines form the chain that keeps the two per-lane control blocks in sync with the
cabinet's option-switch state. The rebuilder `loc_abac` is [seen] — its full template copy
and flag writes were observed running the rebuild path — while `loc_ac20`, `loc_aba2` and
`loc_d7e1` carry [code], having no role-defining own writes in the capture. `loc_ac20` refreshes the
live snapshot by running the option-switch decoder, then tests whether it still matches
the two cached targets — `(loc_a & 0xf8) == loc_71e` and `(loc_16a & 0x03) == loc_71f`.
A match returns via the shared no-op tail; a mismatch falls to the request setter, which
ORs 0x03 into `loc_1c9` to raise both pending-rebuild bits.

`loc_abac` is the rebuilder proper. It runs `loc_ac20` first to refresh and possibly
request, sets `loc_100`←0x08, and — if all three of `loc_71b`, `loc_71c`, `loc_71d` are
idle — forces both request bits on again. It then acts on the request flags in `loc_1c9`:
bit 0 selects how much of the template block at `loc_ac08` is copied into `loc_606`
(0x18 entries when set, else 0x0f, copied top-down), bit 1 selects how far the run at
`loc_706` is filled with 0x01 (0x18 entries when set, else 0x0f); if either request bit
was set it latches the current snapshot into the caches `loc_71e = loc_a & 0xf8` and
`loc_71f = loc_16a & 0x03`; finally it clears the two request bits with
`loc_1c9 &= 0xfc`. `loc_aba2` is the guarded entry: it refreshes via `loc_ac20`, and if
the low two request bits of `loc_1c9` are clear it takes the no-op tail, otherwise it
runs `loc_abac`. `loc_d7e1` is the outermost gate: it arms two mode bytes (`loc_5`←0x00,
`loc_1`←0x02) unconditionally, then rebuilds only while the machine is idle
(`loc_1ca == 0`), enabled (bit 4 of the hardware byte `loc_c00` set), where it also
writes `loc_0`←0x00, and a request is actually pending (`loc_1c9 & 0x03 ≠ 0`) — only
then does it hand off to `loc_abac`.

### Score accumulation

`loc_ca6c` [seen] folds a points amount into the score and drives the bonus-life
threshold. It is gated off unless bit 7 of `loc_5` is set. The destination triplet is
chosen by `loc_3d`: y = 0 selects the first three-byte score cells `loc_40`/`loc_41`/
`loc_42` (which `loc_ca62` had pre-cleared), y = 3 the second triplet `loc_43`/`loc_44`/
`loc_45`. When the entry index `x < 0x08` the amount comes from the fixed BCD tables —
`loc_caf1[x]` and `loc_caf9[x]` added into the low two score bytes, with the top byte
taken as zero; otherwise it uses the live operand triplet `loc_29`/`loc_2a`/`loc_2b`.
The two low bytes are BCD-added with carry threaded, then the third BCD byte is added
into `loc_42+y`, so all three score bytes range across the BCD span. It then range-checks
the accumulated high byte against the bonus interval `loc_156` (the option-decoded
bonus-life interval): when the score qualifies — either by the direct comparison, or, for
larger intervals, by repeatedly subtracting `loc_156` and landing on an exact multiple
(with a special even-value gate when the interval is 0x02) — it awards. The award path
bumps the per-slot counter `loc_48[loc_3d]` only while it is still under six, rings the
sound cue via the audio dispatcher (cue 0x4f, threaded with this slot's index), and
raises the award flag `loc_124`←0x20. The score cells `loc_40`/`loc_41` were observed
changing, grounding the routine as the live score adder; the award path (`loc_48`/`loc_124`)
did not fire in this capture, so that half rests on the code.

## Utilities and shared tails

This subsystem gathers the small leaf helpers the rest of the machine leans on: numeric format conversions, byte-splitting math, a pair of table shuffles, and a family of bare return stubs that other routines branch to when their work turns out to be empty. They own little or no persistent state of their own, so several are grounded [code] on the strength of the readable body rather than an observed write.

### Binary-to-BCD conversion and its display path

`loc_aaf5` [seen] is the game's binary-to-packed-BCD converter, the classic double-dabble. It takes the byte in A and runs eight passes; each pass shifts the top bit out of the source and doubles the BCD accumulator in decimal-adjust arithmetic, folding the shifted-out bit in as the carry (the helper `bcdDouble` performs the decimal-mode "double plus carry" with the standard +6 low-nibble and +0x60 high-nibble corrections). The finished packed-BCD value is written to **both** `loc_29` and `loc_2c`, so the two cells hold identical output, each spanning the full packed-BCD range 0x00..0x99. (The narrower 0x00..0x63 band seen at the input side belongs to the *binary* value handed in by the caller after its clamp, not to the BCD result stored here.) This is a heavily exercised helper: it sits under the score/counter display path.

That path enters through `loc_af71` [code], a thin caller that first clamps its incoming byte to a ceiling of 0x63 (`Math.min(a, 0x63)`) and then drives `loc_af77`. `loc_af77` runs `loc_aaf5` to pack the clamped value into `loc_29`, then calls `loc_dfb1` to emit that single zeropage byte as two nibbles — high nibble then low nibble — feeding the vector digit renderer. So `loc_af71`'s role is "take a raw count no larger than 99 decimal and put it on screen as a two-digit BCD field," with `loc_aaf5` doing the numeric conversion and `loc_dfb1` doing the nibble emission. `loc_af71` writes no cell of its own, hence [code].

### Byte partition helper for the coarse/fine split

`loc_93e0` [seen] partitions a byte into a fine remainder and a coarse index, and is reached exclusively through the three call sites inside `loc_92c5`. It seeds an accumulator with 0xff and runs three passes, each shifting the input's top bit (MSB first) into the low end of the accumulator while shifting the input itself left; after three passes the accumulator equals `0xf8 | (top three bits of the input)`, and this seed is stored to `loc_29` (the routine's only own-cell write, observed in the capture — the trace shows the 0xff init and the first `rol` turning it to 0xfe). Three register live-outs then ride the return: A holds the input shifted left three (its low five bits promoted, top three discarded — the "fine value"); Y holds the seed itself; and X is the derived coarse index, computed as `((seed ^ 0xff) + 0x0d) >> 1`. Because the complement acts on the whole seed (whose high five bits are all ones), that expression works out to `(20 − topThreeBits) >> 1`, giving X in the range {6..10} as the top three bits run 0..7 — the code adds the complement of the full seed, not merely the low three bits. `loc_29` here is used as transient scratch, the same cell `loc_aaf5` reuses for its BCD output on the display path.

### Parallel-table maintenance

`loc_92b2` [code] swaps two parallel 18-entry tables slot for slot: for each index x from 0x11 down to 0, the byte at `loc_3aa + x` and the byte at `loc_3bc + x` trade places, so after the sweep each table holds what its sibling held. Neither store PC fired in this capture — the routine was not reached across attract, coin, start, or play — so it is grounded [code] on the readable body; `loc_3aa`/`loc_3bc` appear in the trace only as constant zero at unrelated points.

`loc_b85f` [code] seeds a pair of three-entry arrays to fixed constants: `loc_22`/`loc_809` receive 0x00, `loc_23`/`loc_80a` receive 0x04, and `loc_24`/`loc_80b` receive 0x0c. It is a straight-line initializer with no branching. No own-cell write was observed and no caller was found in the capture (it is reached only as a dispatch or tail target), so it too is [code], accounted for as simply not exercised here; the body itself is fully readable.

### Rebuild-request flag setter

`loc_ac36` [seen] is the rebuild requester for the geometry/block subsystem: it ORs 0x03 into `loc_1c9`, setting the two low pending-rebuild request bits, and returns the merged value. Its own write to `loc_1c9` was observed (the cell carrying 0x7, i.e. both request bits present alongside an already-set higher bit). Callers set these bits when they detect that the on-screen geometry needs regenerating; the bits are later consumed elsewhere, where bit 0 and bit 1 each gate a distinct block-copy. So `loc_ac36` is the "mark both blocks dirty" primitive rather than the rebuilder itself.

### Bare return stubs and shared tails

The remainder are return-only leaves — real code slots that exist so callers have somewhere to branch when there is nothing to do. Each is grounded [code] because a bare RTS offers no write to observe and its reach cannot be confirmed from a write-tap.

`loc_ac07` is the "nothing to rebuild" leaf: its caller tail-branches here when the relevant control-snapshot test finds no pending work. `loc_ac3e` is the shared return tail reached when the live geometry state already matches its latched copy, so no rebuild request is raised (it is the counterpart no-op to `loc_ac36`'s set-the-bits path). `loc_af6e` is the exposed RTS tail of the `loc_af3f` draw routine, taken when the indexed draw slot `loc_600`+x is empty and there is nothing to render. `loc_9bcf` is a do-nothing handler slot in a computed-dispatch table: it returns immediately, letting the caller's own return unwind, so the table can point unused entries at a harmless target.

`loc_b955` [code] looks like a bit-counter but is not — this is a proposer trap. It reads `loc_57`, shifts it right four, and runs an increment/shift/branch loop, but the loop's result is thrown away: the trailing `clc`/`adc #2` leaves A = 0 + 2 = 2 and `ldy #0` forces Y = 0, so the routine unconditionally returns the constant pair A = 2, Y = 0 regardless of `loc_57`. The read of `loc_57` and the loop are dead computation; a blind reading might mis-name this "log2/popcount of loc_57," but the code discards that work and always yields the fixed pair.

## Still on the frozen oracle

The subsystems above are the idiomatic layer's decompiled set — the leaves, the caller routines that drive
them, and the first computed-jump dispatcher (`loc_b84e`, described above). The rest of the reachable call
graph still runs as the frozen translated oracle: the deeper callers whose callees are not yet decompiled,
and the remaining computed-jump dispatchers that form the game's spine (each is decompiled only once all of
its jump-table targets are idiomatic). One register-thread caller remains deferred: `loc_c891`, whose call
to `loc_ccfa` needs the X/Y left by an intervening frozen leaf whose exit registers cannot be faithfully
modelled across its many paths, so it stays on the oracle until that leaf can be resolved. Deep-tail roles
tagged `[code]` lift to `[seen]` once a capture drives the states that exercise them.
