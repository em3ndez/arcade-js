# Tempest — mechanisms

A code-grounded model of how Tempest actually runs, built from the translated 6502 lift and the idiomatic
rewrite and confirmed against the real ROM under MAME. It covers the subsystems reached by the idiomatic
decompile so far — the motion-script engine, the vector pipeline, enemy spawning and the pursuit AI, the
mathbox projection, sound, and the EAROM — down to the caller routines that drive them; the frozen-oracle
remainder (deeper callers and the computed-jump dispatcher spine) is noted at the end. The machine is a
colour vector game: the 6502 builds a display list in AVG vector RAM (`0x2000-0x2FFF`) each frame and the
Analog Vector Generator draws it, with the vblank interrupt as the per-frame heartbeat and a game-state
index driving a computed-jump dispatch that selects the mode handler (attract, coin-in, play, transitions).

**Confidence tags.** `[seen]` — a role-defining observation on the real ROM under MAME (a watched write, a
value change, confirmed reachability). `[code]` — derived from the faithful lift's behaviour, mechanically
exact but the role is inference. `[guess]` — plausible, unverified. A `[code]` routine is real code whose
game-purpose is not yet pinned; where the purpose is genuinely open the identifier stays `loc_<addr>`.

## The object motion-script engine

Each moving object on the tube is animated not by hand-written per-object code but by a small bytecoded program — a *motion script* — that a driver interprets one opcode at a time. The driver (loc_9b1e) walks the script and, for each byte it fetches, hands control to an opcode handler through a computed-dispatch table (loc_9b98's RTS-trick table); the handlers described here are the instruction set of that machine. Three zero-page cells hold the machine's state across a step: `loc_10b` ($010b) is the script *instruction pointer* — the running index into the program — `loc_10c` ($010c) is the *branch flag* that the conditional opcodes read, and `loc_10a` ($010a) is the driver's *loop-continuation flag* that keeps the inner walk running. The program bytes themselves live in the adjacent tables `loc_a0f7` ($a0f7) and `loc_a0f8` ($a0f8): because $a0f8 = $a0f7 + 1, reading `loc_a0f8[i]` yields the byte that immediately *follows* `loc_a0f7[i]`, i.e. the operand sitting one slot past a given opcode. The object being animated is addressed by the X register, which indexes the per-slot animation cells based at `loc_298` ($0298,x).

**Emitting values into the object (loc_9bd0, loc_9bdd).** Two opcodes write a fresh value into the current object's slot. loc_9bd0 ([seen]) is the *immediate store*: it advances the instruction pointer `loc_10b` by one (wrapping to a byte) and copies the newly-selected program byte `loc_a0f7[loc_10b]` straight into the object's slot `loc_298 + x` — the write-tap confirms both the pointer step and the slot store landing across the object slots in the $0298 band. loc_9bdd ([seen]) is the *indirect store*: it likewise advances `loc_10b` with the same byte-wrapping step, but treats the selected program byte `loc_a0f7[loc_10b]` as a **zero-page address**, dereferences it through `loc_00` ($0000 + ptr) to read a live variable, and stores *that* into `loc_298 + x`. The immediate form bakes a constant into the script; the indirect form lets the script pull whatever a chosen zero-page cell currently holds, so the emitted value tracks a running game variable rather than a literal.

**Control flow driven by the branch flag (loc_9bee, loc_9bfa, loc_9c17).** loc_9bee ([seen]) is a *conditional skip*: when the branch flag `loc_10c` is nonzero it does nothing, and only when the flag is clear does it advance `loc_10b` by two, stepping the pointer past a two-byte operand — a way to jump over the next scripted instruction when a condition is not met. loc_9bfa ([seen]) is a *conditional jump*: it first bumps `loc_10b` by one, then, if `loc_10c` is nonzero, leaves the pointer there and continues; but when the flag is clear it reloads `loc_10b` from `loc_a0f7[loc_10b]`, i.e. replaces the instruction pointer with the operand target and jumps elsewhere in the script. loc_9c17 ([seen]) is the *unconditional goto*: it reloads `loc_10b` from `loc_a0f8[loc_10b]` — the operand byte following the current opcode — with no flag test, and this reload is heavily exercised (the write-tap shows the pointer pulsing across a range of low values on essentially every pass). Together these three give the script the skip/branch/jump vocabulary it needs to loop and choose.

**Timed dwell (loc_9c0c).** loc_9c0c ([seen]) folds a per-object countdown into the state stepping. It decrements the object's timer cell at `loc_298 + x`; while that timer is still nonzero it delegates to loc_9c17, letting the table-driven goto step the pointer through `loc_a0f8`, so the object keeps cycling its current animation state. Only when the timer reaches zero does it instead bump the shared counter `loc_10b` by one, letting the script fall through to whatever comes next. In effect the opcode holds the object in a state for a fixed number of ticks and then releases it — the countdown is observed running to expiry in the trace.

**Test opcodes that produce the branch flag (loc_9c21, loc_9c3b).** Two opcodes exist to *compute* the branch flag `loc_10c` that the conditional opcodes above consume, though neither's own store to `loc_10c` appears in the captured window (both carry the [code] tag; during capture the flag was written by other producers). loc_9c21 ([code]) tests position against a segment boundary: it reads the object's segment from `loc_2b9` ($02b9,x), looks up that segment's boundary in `loc_3ac` ($03ac[segment]) — treating a zero entry as the maximum 0xff — and sets `loc_10c` to 1 when the boundary is at or beyond the object's depth coordinate `loc_2df` ($02df,x), else 0. This is the test an object uses to know whether it has reached the edge of its lane's travel. loc_9c3b ([code]) tests a phase accumulator instead: it computes `((loc_147 << 2) + loc_148) & loc_148 & 0x80`, all byte-wrapped, then inverts bit 7 of that result and stores it — so `loc_10c` becomes 0x00 when the selected high bit is set and 0x80 when it is clear. `loc_148` ($0148) is the signed phase accumulator that the driver's tail advances by `loc_147` ($0147); this opcode therefore turns the sign/high-bit state of that accumulator into a branch decision.

**Housekeeping opcode (loc_9bca).** loc_9bca ([seen]) is a leaf handler that simply clears the driver's loop-continuation flag `loc_10a` to zero. The driver sets `loc_10a` to 1 before entering its inner walk and keeps looping while it stays nonzero; a script that reaches this opcode therefore *ends* the current walk — the write-tap confirms the store of zero to $010a occurring frequently.

**Packed-record skip (loc_96c7).** loc_96c7 ([code]) belongs to the list-cursor machinery rather than the branch/store opcodes: it advances a list cursor held in the Y register by a fixed run to step past a packed record without reading it. The first entry point steps Y forward by three (it reaches the second with Y already bumped by one), and the second entry point steps by two; it is register-only and produces no memory writes, which is why its role could not be corroborated from the write-tap and it keeps the [code] tag. It is reached as a computed-dispatch target of the $969d table (via loc_9683's RTS-dispatch on $015e), where different table entries select how many bytes of a variable-width list record to skip over.

## Vector coordinate lists and the display cursor

Tempest draws everything — the tube, the enemies, the Blaster, the score and text — as an Analog Vector Generator display list built in vector RAM ($2000–$2fff). Two distinct cursors govern this work and this section covers both. One is a **read** pointer at $2c/$2d that walks packed coordinate lists held in ROM; the other is a **write** cursor at $74/$75 that appends words into the vector-RAM display list. A single scratch cell, $29, is threaded between the readers, and a companion cell $2b holds the currently-selected list index.

### The display-list write cursor and its advance

Every producer that lays bytes into vector RAM funnels its cursor bookkeeping through `loc_df5f` [seen], the shared cursor advance. It takes a stride in Y and does `$74 = $74 + Y + 1`, carrying into the high byte $75 when the low byte overflows — the `sec` before the add forces the +1, so the new pointer is `$74/$75 + (Y+1)`. The write-tap shows $74 pulsing across essentially the whole low-byte range as the display list is filled and $75 stepping through the $2x page, confirming this is the live sweep of the vector-RAM write head. Because callers hand it different strides, one word-emit passes Y=1 (advancing two bytes), a six-byte object vector passes Y=5 (advancing six), and so on.

The lowest-level emitter is `loc_df59` [seen]. Given a pair {A,X} and an offset Y, it fetches the 16-bit cursor from $74/$75, stores A at cursor+Y and X at cursor+(Y+1), then advances via `loc_df5f` by (Y+1) — i.e. past the two bytes just written. Its stores are observed writing real vector data into $2000–$2fff across a very wide value range, which is what makes this the role-defining append-a-word primitive of the display list.

Several thin producers sit atop that emitter, each shaping the word before it lands:

- `loc_df53` [seen] writes the fixed header word {0x40, 0x80} at the cursor and steps past it. The write-tap catches the 0x40/0x80 pair going down as adjacent bytes in the vector stream. 0x40/0x80 is the AVG header word that precedes an absolute-position vector.
- `loc_df19` [seen] copies one entry out of the ROM word table at $31e4. It derives the table index from the low nibble of A: with carry set and that nibble zero the index is 0, otherwise it is (nibble+1); the index is doubled to address the 2-byte entry, and both bytes are copied into the list, followed by a two-byte advance. Its stores land real AVG opcode bytes into $2000–$2fff.
- `loc_df1f` [seen] is the same emit with a simpler index rule — it forces index = (A&0x0f)+1 and then shares `loc_df19`'s copy-and-advance tail (the `loc_df24` body: read $31e4[idx], write two bytes, advance). Its own index arm performs no memory write, so it is grounded as reached-and-consumed through the shared emit rather than by a write of its own.

### Object-position and text vectors

`loc_c772` [seen] is the heavily-exercised producer that draws an object at an absolute tube position. Entering at `loc_c772` starts the cursor offset at 0; the body lays six bytes at the current $74/$75 cursor: the fixed header {0x40, 0x80}, then an X coordinate word and a Y coordinate word. X is read from the zero-page pair ($02, $03) indexed by X-register, Y from the pair ($00, $01) indexed by X-register; the high byte of each coordinate is masked to five bits (`& 0x1f`) before being written, so only the low 13 bits of each axis reach the AVG. As it emits, it caches the four raw coordinate bytes into $6a (Y-lo), $6b (Y-hi), $6c (X-lo), $6d (X-hi) — the "previous point" anchor that stroke-drawing code elsewhere subtracts its deltas against. It closes by advancing the cursor six bytes through `loc_df5f`. This is the entry that other draw sites reach after first laying their own header word, so it functions as the position-stamp step of a larger object draw.

`loc_aef8` [seen] emits text into the display list. It walks the character buffer at $0606 (indexing it down through the counter cached in $38, with $39 counting three iterations), clamps each code that is 0x1e or higher down to 0x1a, doubles the code to index the glyph word table at $31fa, and copies that glyph's two bytes into the buffer at the $74 cursor. Three glyph words are copied per call, after which it advances the cursor past what it wrote via `loc_df5f`. The write-tap shows its glyph stores going into the $23xx–$2bxx region with high byte 0xa8 (the vector-draw opcode for these glyph words), and it hands off to `loc_df5f` on the way out.

### The ROM coordinate-list read pointer

The second cursor is the $2c/$2d indirect pointer into packed coordinate lists in ROM, selected and walked by a small family that shares scratch cell $29.

`loc_9aee` [seen] selects which coordinate list is active. Indexed by Y, it loads the list pointer from two parallel ROM tables — the low byte from $9b02[Y] into $2c and the high byte from $9afd[Y] into $2d — records the chosen index in $2b, and reloads A from the shared scratch $29. All three of its writes ($2c, $2d, $2b) are observed, with $2d settling on 0x07 (a ROM page) and $2c on a page offset. After this call the walkers below chase $2c/$2d.

`loc_96cb` [seen] steps the read cursor by an inter-entry delta. It reads the list entry at ($2c),Y and its predecessor at ($2c),Y-1, stores their difference at $29 as the step delta, and advances Y by (delta+2). The write-tap confirms $29 taking real step values in the range 0x01–0x0f, matching genuine gaps between packed coordinate entries, which is what grounds it as the list-walk step.

`loc_96ab` [seen] is a coordinate helper reached through the computed-dispatch path over these lists. It comes in two flavours that differ only in the seed value: `loc_96ab` uses `((($2b)-1) & 0x0f) + 1` (a wrap of the selected index), while the sibling entry `loc_96b7` uses the raw $2b. Both stash the incoming Y at $29, then compute a new index as `seed − (list entry two positions back, at ($2c),Y-2) + (the stashed Y)`, and finally fetch the list entry that new index points to, returning it in A with the index in Y. Its only own write is the $29 scratch, so it is grounded as a reached compute helper whose output feeds the computed-jump coordinate generator; the companion `loc_96c4` in the same file is a plain fetch of ($2c),Y with no adjustment.

`loc_96db` [code] resolves a list entry to an absolute coordinate: it reads the byte at ($2c),Y and adds the base value held at $0160, returning the sum (masked to 8 bits) in A. It performs no memory write of its own, so the write-tap cannot observe it, and its reach — through the computed jump table — cannot be confirmed from writes; its role as the entry-to-absolute-coordinate resolver is read from the code, and its tag stays [code] because no [seen] consumer of its A output has been pinned down.

## Draw-pointer setup and vector emission

Tempest draws on an Atari analog vector generator (AVG) whose display list lives in the vector RAM at `loc_2000`–`loc_2fff`. Every emitter in this subsystem writes into that RAM (or into the intermediate stroke buffer at `loc_2f60`) through a small family of zero-page indirect pointers, and the recurring convention is that each 16-bit word's low byte carries raw data while its high byte is masked to five bits and OR'd with an opcode tag (`0x70`/`0x71` headers, `0xa0` for a delta vector, `0xc0` as a list terminator). Two cursor disciplines coexist: some routines carry a running byte offset in `loc_a9` and add it to a fixed base pointer, while others advance the base pointer `loc_74`/`loc_75` itself as they write.

### Selecting and publishing the draw pointer

The list producers all resolve a 16-bit pointer out of a ROM table and stamp it into a zero-page slot. `loc_b2be` ([seen]) is the per-subsystem entry: it takes a selector in A, forms a two-byte stride `(A<<1)&0xff`, and — reading the per-index flag byte at `loc_415`+A — picks table `loc_ce68` when that flag is nonzero or `loc_ce7a` when it is zero, copies the little-endian pointer into the working draw pointer `loc_74`/`loc_75`, and clears the running cursor `loc_a9` so the next emitter starts a fresh list at offset zero. `loc_b2de` ([seen]) is the sibling that feeds the glyph/text path instead: same stride and same flag at `loc_415`, but with the table sense reversed (`loc_ce7a` when nonzero, else `loc_ce68`), publishing into `loc_3b`/`loc_3c` and again clearing `loc_a9`. `loc_91b5` ([seen]) does the same shape for a third slot, doubling its selector into a word index, zeroing the paired flag byte `loc_29`, and copying the little-endian pointer from the in-ROM table `loc_91c6`/`loc_91c7` into the general indirect pointer `loc_2a`/`loc_2b`.

`loc_b332` ([seen]) sits at the head of a list and doubles as a frame-change guard. It compares a source byte `loc_cec4` against the checkpoint cell `loc_2000`: if they differ it latches the new value into `loc_2000` and returns carry set, signalling its caller to restart the frame. On the matching path it clears `loc_16e`, chooses record slot `0x08` or `0x02` by the mode flag `loc_415`, copies a two-byte word from `loc_ce9e`+slot through the current `loc_74`/`loc_75` pointer, then reloads that pointer from `loc_ce68`+slot and returns carry clear — in effect emitting one link word and re-pointing the cursor at the next segment of the list.

Two more selectors are code-readable only, because their sole driver `loc_b8ba` (the object-draw loop) did not run in the capture. `loc_b944` ([code]) swaps the pointer pair `loc_74`/`loc_75` with `loc_76`/`loc_77`, so the shared cursor can be re-aimed at an alternate structure and back. `loc_b967` ([code]) selects a pointer pair by the flag `loc_415`: when it is zero it returns (A=`loc_ce87`, X=`loc_ce86`), otherwise (A=`loc_ce6f`, X=`loc_ce6e`) — the raw material its caller stores as a draw-struct pointer. The flag itself is exercised elsewhere; these two bodies are not.

### Low-level append primitives

`loc_b56a` ([seen]) appends a bare four-byte record — `0, 0, 0, A` — at the `loc_74`/`loc_75` cursor and then advances that pointer by four with carry into the high byte, so the caller's A rides out as the meaningful (opcode) byte of an otherwise empty word. `loc_b896` ([code]) writes the top-of-RAM tail record: it lays the 16-bit cursor `loc_139`/`loc_13a` into vector RAM as `loc_2ffc`=low (raw), `loc_2ffd`=high OR'd with the `0x70` opcode tag, and `loc_2fff`=`0xc0` as the list terminator, then steps the cursor down by `0x20` with a 16-bit borrow and masks the low byte to `0x7f`. Its five targets never received a write in this capture, so the routine's role rests on the code alone.

### Tube and object geometry

The geometry emitters share a "current point in `loc_61`–`loc_64`, previous point mirrored in `loc_6a`–`loc_6d`" arrangement. `loc_c43c` ([seen]) is the gatherer: it reads the slot index `loc_37` and copies that column of four parallel object-attribute tables into the working block — `loc_61`=`loc_36a`[x], `loc_62`=`loc_35a`[x], `loc_63`=`loc_38a`[x], `loc_64`=`loc_37a`[x] — so `loc_61`/`loc_62` and `loc_63`/`loc_64` become two 16-bit coordinate pairs (low:high) for the addressed object.

`loc_c66d` ([seen]) forms a rim vertex. Taking slot `loc_38` and its wrap-around neighbour `(loc_38+1)&0x0f` — the sixteen segments of the tube ring — it computes the round-up signed average (halve, sign-preserving) of the two slots' coordinate pairs from the same `loc_35a`/`loc_36a`/`loc_37a`/`loc_38a` tables, storing the two midpoints in `loc_61`/`loc_62` and `loc_63`/`loc_64`. It then appends those four midpoint bytes through the `loc_74` pointer at the running cursor `loc_a9` (each high byte masked to `0x1f`, the vector opcode field) and mirrors all four into the previous-point block `loc_6a`–`loc_6d`. `loc_c73c` ([seen]) draws the connecting stroke: it emits two 16-bit differences through `loc_74`/`loc_75` at cursor `loc_a9`, first `(loc_63:loc_64) − (loc_6c:loc_6d)` then `(loc_61:loc_62) − (loc_6a:loc_6b)`, sending each low byte raw and each high byte masked to five bits, with the second high byte additionally OR'd with `0xa0` — the delta-vector opcode — before advancing `loc_a9` by four. Because `loc_6a`–`loc_6d` hold the previously emitted point, the pair encodes the move from the last vertex to the current one.

`loc_c772`/`loc_c774` and their alt entry `loc_c765` ([seen]) lay a "move-to" record from the zero-page pen coordinates. `loc_c774` writes a fixed `0x40,0x80` opcode word, then the X pair from `loc_2`/`loc_3`+x (caching into `loc_6c`/`loc_6d`, high byte masked `0x1f`) and the Y pair from `loc_00`/`loc_1`+x (caching into `loc_6a`/`loc_6b`, high masked `0x1f`), and steps the base pointer past the bytes it wrote. `loc_c772` starts that build at cursor offset zero; `loc_c765` first lays the `0x00,0x71` header word at the cursor start and then resumes the shared build from offset two. The caching into `loc_6a`–`loc_6d` seeds the "previous point" that `loc_c73c` later differences against.

`loc_bd3e` ([seen]) drives the AVG math box (the perspective coprocessor at the `loc_6000` block) and appends a normalized magnitude word. For a small input (`loc_57` < `0x10`) it uses the trivial pair (mantissa `0x01`, exponent `0x00`); otherwise it loads the 16-bit difference `loc_57`−`loc_5f` (with the negated borrow of `loc_5b`) into operand registers `loc_6095`/`loc_6096`, issues the command via `loc_608c`=`0x18`, `loc_608e`=`loc_a0`, `loc_6094`=`loc_a0`, spins until the busy bit `bit7` of `loc_6040` clears, and reads results `loc_6060`→`loc_79` and `loc_6070`→`loc_7a`. It then normalizes: decrement the result (flooring at 1) and roll `loc_79` leftward into it until a one bit rolls out, yielding a mantissa shift count (left in `loc_78`) and an exponent. It writes the exponent at (`loc_74`)+`loc_a9` and the shift-count OR'd with the `0x70` tag at the next byte, but it does not itself advance `loc_a9`.

`loc_c6c7` ([seen]) is the per-enemy-slot list builder, invoked once per slot by its caller so a frame accumulates the enemy display entries. For an inactive slot — kind byte `loc_3ac`[loc_38] equal to zero — it appends four blank `0x00,0x71` pairs at cursor `loc_a9` and returns. For an active slot it seats the scratch inputs (`loc_57`=`loc_3ac`[x], then `loc_56`=`loc_435`[x], `loc_58`=`loc_445`[x] around the depth-clamp `loc_c453` and the math-box transform `loc_c098`), runs `loc_c73c` to emit the delta pair, and then chooses its trailing word by the type flag `loc_39a`[loc_38] & `0x40`: if set it runs `loc_bd3e` and overwrites the two cursor bytes with a randomly chosen table word — an even offset `(loc_60ca & 0x02) + 0x1c` selecting one of two adjacent entries in `loc_cec8`/`loc_cec9` — advancing `loc_a9` by two; if clear it lays a fixed marker word `0x00, 0x68, loc_3db2, loc_3db3` and advances by four. (In this randomized branch the bytes `loc_bd3e` deposited at the cursor are replaced by the random word, so there the math-box call serves mainly to leave the shift count in `loc_78`.)

### Glyph and number strokes

Two chains turn packed nibbles into stroke-vector words. `loc_a9fc` ([seen]) is the innermost writer: it maps A's low nibble to a table index — zero when the nibble is zero and carry is set, otherwise nibble+1 — reads a single byte from the font/stroke table `loc_31e4` at the even offset `2*index`, stores that one byte at `loc_2f60`+X, and advances X by two — the odd byte of each stroke slot is left untouched (its high byte comes from elsewhere). `loc_a9d7` ([seen]) drives it across three source bytes: it seeds a pass counter in `loc_2a` (2 down through 0), and for each byte read through the source pointer `loc_3b`/`loc_3c` it emits the high nibble then the low nibble, walking `loc_3b` backward one byte per pass. Its carry chaining — carry stays set only while nibbles remain zero, and is forced clear on the final pass — implements leading-zero blanking of the emitted number.

`loc_a97f` ([seen]) assembles a marker row and then hands off to that emitter. It records the row selector in `loc_2b`, computes a head value (zeroed only when the selector equals the marker index `loc_3d` and `loc_5` has its top bit set) OR'd with the `0x70` tag, and writes it into `loc_2f60` at the base offset `loc_cdde`[y]. It reads the row count `loc_48`[y] into `loc_38` (one short when at the marker index) and fills six row cells, choosing the "filled" glyph `loc_3284` while the row index stays within the count and the "empty" glyph `loc_3286` beyond it — the filled/empty marker row that renders a countable status indicator. Unless it takes the early out (state `loc_00` equal to 4 while off the marker index), it then seeds the glyph source pointer `loc_3b`=`loc_a97d`[y], `loc_3c`=0 and runs `loc_a9d7` to emit the row's associated packed string.

`loc_dfb1` ([seen], heavily exercised) renders a packed multi-digit run into the `loc_74` list. It sets the byte counter `loc_ae` to y−1 and the source index `loc_af` to the top of the run (`a+count`), then walks downward: for each zero-page byte at `loc_0`+index it emits the high nibble then the low nibble through `loc_df19` — its only caller — chaining carry so that only the final low nibble sees carry cleared (the leading-zero blank again). `loc_df19` picks the table index from the nibble (0 when carry is set and the nibble is zero, else nibble+1), copies that entry's two bytes from `loc_31e4` through the (`loc_74`) cursor, and steps the cursor past them. Where `loc_a9fc`/`loc_a9d7` fill the fixed stroke buffer at `loc_2f60`, this chain writes directly through the advancing draw pointer.

### An adjacent EAROM aside

Two routines grouped here by address belong not to vector emission but to the high-score EAROM (NVRAM) state machine, and are described only for completeness. `loc_dded` ([code]) is a trampoline into `loc_ddf3`→`loc_ddff` carrying mask `0x03`: it stamps `loc_1c6` with `0xff` and OR's `0x03` into the request flags `loc_1c7` and `loc_1c8`, i.e. it queues EAROM operation mask 3. It was not reached in the capture — no write from its body fired, and neither the `0xff` stamp nor the `0x03` mask was observed — so its role rests on the code. `loc_db5a` ([code]) starts an EAROM sequence only when idle: if either guard `loc_1ca` or `loc_1c7` is nonzero it returns, otherwise it seeds the state machine (via `loc_de11`, which sets `loc_1c7`=`0x07`, `loc_1c8`=0 and runs the walk) and stamps `loc_7c`=`loc_1c9` and `loc_0`=`0x02`. In the capture the guard was never clear when it was reached, so its write path did not run and the role rests on the code.

## Enemy spawning and lane selection

This subsystem decides *where* new hostiles enter the tube, hands each a free slot in the parallel per-object arrays, and runs a second, timed spawn queue that drips objects in over frames. Two distinct object tables live side by side here: the 16-entry enemy table keyed on the depth array `loc_2df` (with segment `loc_2b9`, successor segment `loc_2cc`, flags `loc_283`/`loc_28a`/`loc_291`, phase `loc_2a6`), and a smaller 8-entry timed table keyed on `loc_30a` (with type `loc_302`, lane `loc_2fa`, counter `loc_312`).

### Choosing a lane to feed from

`loc_9246` [seen] lays down the per-slot random tag table that later lane picks read against. It first wipes the 64-byte block `loc_243`..`loc_282` to zero, then walks the active slots — index `x` running from `mem[loc_3ab] - 1` down through 0 — and for each one draws a POKEY random nibble `mem[loc_60ca] & 0x0f`, stores that nibble at `loc_203 + x`, and packs the slot index with it into a tag `(x << 4) | nibble` written to `loc_243 + x`, substituting `0x0f` whenever that packed value would be zero so no live slot ever carries a zero tag. Both the raw-nibble row and the packed-tag row fill with real varying values, which is what grounds it as [seen].

`loc_9abb` [seen] is the lane chooser proper. It seeds a wrapping index from a POKEY random start, `mem[loc_60ca] & 0x03`, and arms a four-step countdown by writing `0x04` into `loc_2b` (with the caller's X stashed in `loc_39`). Each turn of the loop first decrements the `loc_2b` countdown and bails with A = 0 the moment it underflows past zero (its high bit sets); otherwise it steps the index down by one, wrapping back to `0x03` on underflow, reads a candidate lane id from the four-entry table `loc_149 + y`, remaps id `0x03` to `0x05`, and accepts the lane only when its occupancy cell `loc_13c + idx` is non-empty. On a qualifying lane it forms the list id `mem[loc_149 + y] | 0x40` into `loc_2c`, pulls the matching list-high byte from ROM table `loc_9afd` (at Y = 2) into `loc_2d`, records the selected index 2 in `loc_2b`, and returns the id held in `loc_29`. The `loc_2c`/`loc_2d` pair it builds and the `loc_29`/`loc_2b` scratch it leaves are exactly the fields the slot allocator reads when it commits a spawn.

### Committing an enemy to a slot

`loc_994d` [seen] is the enemy-slot allocator. It stashes the caller's Y into `loc_36`, then scans the depth array downward from the count index in `loc_11c`, looking for a free (zero) entry in `loc_2df`; if the scan walks below index 0 it reports failure with A = 0x00. On finding a free entry `y` it seeds the whole parallel record for that slot: the depth `loc_2df + y` takes the seed value from `loc_29`; the segment `loc_2b9 + y` takes `loc_2a`, except that a requested segment of `0x0f` combined with bit 7 set in gate `loc_111` triggers a fresh POKEY draw `mem[loc_60ca] & 0x0e` (an even segment) instead; the successor segment `loc_2cc + y` becomes `(segment + 1) & 0x0f`; the phase field `loc_2a6 + y` clears to 0; the two flag/pointer fields `loc_28a + y` and `loc_291 + y` take `loc_2c` and `loc_2d` (the list pointer the lane chooser prepared); the flag byte `loc_283 + y` takes `loc_2b`. It bumps the active-object count `loc_108` and, using the low three bits of `loc_2b` as a lane number, bumps that lane's per-lane tally `loc_142 + lane`, finally restoring X into `loc_36` and reporting success with A = 0x10. The observed writes across depth, segment, the two coordinate/flag fields, and the count are what carry the [seen] tag.

### Picking and tracking the target column

`loc_a028` [code] chooses the segment an enemy should aim for by finding the deepest occupied column. It clears the running-max cell `loc_2d`, primes a 16-step counter in `loc_140` to `0x0f`, and scans the 16-column depth table `loc_3ac` starting from a random column `mem[loc_60da] & 0x0f` (POKEY 2's random source), stepping the column index down with `& 0x0f` wrap each pass. A column's depth of 0 is treated as `0xff` (maximal, i.e. wholly empty), and the current column wins the running max held in `loc_2d` (its index kept in `loc_29`) on a `>=` comparison, so ties favor the later-scanned column; column `0x0f` is skipped entirely while gate `loc_111` is non-zero. When the counter underflows it commits the winner: the slot's segment `loc_2b9 + x` takes the winning column, the successor `loc_2cc + x` takes `(winner + 1) & 0x0f`, and bit 7 of the flag `loc_28a + x` is cleared. In this capture the conditional stores were not exercised, so it carries [code]; the mechanism is fully readable from the body.

`loc_9fc4` [seen] is the per-slot approach step, and it is the caller that drives `loc_a028`. It raises `loc_10c` to 1, reads the slot's current column from `loc_2b9 + x`, and if that column's depth cell `loc_3ac + col` is empty seeds it to `0xf1`. It then keeps that column as a running minimum of the slot's own depth `loc_2df + x`: when the slot is shallower than the recorded column depth it overwrites the column with the slot depth and tags a fresh minimum by writing `0x80` into `loc_39a + col`. The slot depth then decides the outcome — a depth below `0x20` is too shallow, so it sets bit 7 of `loc_28a + x` and clamps the depth up to `0x20` and returns; a mid-range depth (below `0xf2`) returns with nothing more; and a depth of `0xf2` or greater means the object has run past the far limit, so it calls `loc_a028` to pick a new column, reparks the depth at `0xf0`, and — only when the header `loc_3ab` is zero — rewrites the slot's flag fields, forcing the low bits of `loc_28a + x` to `0x01` and of `loc_283 + x` to `0x02` and clearing `loc_10c` back to 0. The observed column-min tracking and clamp writes ground it as [seen].

### Flip-direction bookkeeping

`loc_9eab` [code] maintains bit 6 of a slot's flag byte, and only while the global gate `loc_111` is non-zero (it returns immediately otherwise). Reading the slot's flag `loc_283 + x` and its segment/column value `loc_2b9 + x`, it clears bit 6 (`& 0xbf`) once that value reaches `0x0e` when bit 6 is currently set, and sets bit 6 (`| 0x40`) only while that value is 0 when bit 6 is currently clear — a hysteresis latch on the flag tied to how far around the ring the slot sits. Neither conditional write fired in the capture, so it is [code].

`loc_9ed7` [code] is the direction-lookup helper that pairs with that flag. Given an index in Y it returns the ring-table byte `mem[loc_3ee + y] | 0x80`; but when bit 6 of the caller's A is set it takes the half-turn variant instead, first stepping the index back within the 16-slot ring, `y = (y - 1) & 0x0f`, then returning `((mem[loc_3ee + y] + 8) & 0x0f) | 0x80`. It writes no memory of its own and was not reached in this capture, hence [code]; the body cleanly encodes "look up a heading, and optionally reverse it half a turn."

### The timed spawn queue

A second, smaller spawn path drips objects into the 8-entry table over time. `loc_a3d4` [code] is the thin front door: it stores the caller's A into the scratch field `loc_2c` (the object type to place) and then runs the insertion body of `loc_a3d6`. Its own single write to `loc_2c` stayed constant in the capture, so it carries [code].

`loc_a3d6` [seen] performs the insertion into the 8-slot table. It saves X and Y into `loc_35`/`loc_36` and clears the eviction trackers `loc_2a`/`loc_2b`, then scans slots 7 down to 0: the first slot whose position `loc_30a + i` is zero is taken as free and ends the scan, but along the way it also remembers the slot holding the largest counter value `loc_312 + i` (age kept in `loc_2a`, its index in `loc_2b`). If no slot was free it evicts that oldest/largest-counter slot, dropping the live count `loc_116` by one first. Into the chosen slot it writes the four parallel fields — counter `loc_312` reset to 0, type `loc_302` from `loc_2c`, position `loc_30a` from `loc_29`, lane `loc_2fa` from `loc_2d` — and bumps the live count `loc_116` back up. The real, varying field writes ground it as [seen].

`loc_a416` [seen] ages that timed table each pass. If the pending flag `loc_116` is zero it does nothing; otherwise it clears the flag and, for every occupied slot (`loc_30a + i` non-zero), advances the slot's counter `loc_312 + i` by the per-type step drawn from ROM table `loc_a44e` indexed by the slot's type `loc_302 + i`. A slot whose advanced counter reaches its per-type limit from ROM table `loc_a448` is freed by zeroing its position `loc_30a + i`; any slot still short of its limit re-raises `loc_116` so the queue is revisited on the next pass. The observed counter advance and the flag toggle carry the [seen] tag.

## Enemy motion and the pursuit AI

The enemies that climb the tube carry their state in a bank of parallel per-slot
arrays indexed by the slot number `x`: a depth into the tube (`loc_2df`), a target
rim segment (`loc_2b9`), a phase counter (`loc_2cc`), and a flag/coordinate byte
(`loc_283`). Two quite different styles of motion are driven off these arrays — a
free three-axis integrator for objects that drift through the well, and a
segment-by-segment rim pursuit for objects that chase the player around the
perimeter — and this section covers both, the geometry helper they share, the
timers that pace them, and the routines that turn a slot's state into a point on
the vector screen.

### Free three-axis motion

`loc_a6a9` ([code]) is the position integrator for an object moving freely on
three axes. For its slot it folds each axis's low velocity byte into a position
fraction and then folds the resulting carry plus the axis's whole velocity byte
into a whole coordinate. The three axes read velocity-low from `loc_2e3`/`loc_2c3`/`loc_303`,
velocity-whole from `loc_343`/`loc_323`/`loc_363`, position-fraction from
`loc_223`/`loc_203`/`loc_243`, and whole coordinates from `loc_283`/`loc_263`/`loc_2a3`.
Because the whole velocity is a signed byte, its top bit selects which end of the
tube ring is the limit: a rising axis (velocity ≥ 0) resets its whole when the sum
reaches `0xf0` (the far end), a falling axis (velocity < 0) resets when it drops
below `0x10` (the near rim). Axis 0's result (`loc_283`) is the primary coordinate,
and it is forced to zero if *any* of the three axes overflowed its ring limit — so
an object that runs off one axis is collapsed on the coordinate axis 1 and 2 still
store into `loc_263`/`loc_2a3`.

The velocities themselves are bled toward rest by `loc_a721` ([code]). It seeds a
saturation counter `loc_29` to `0xfd` and then steps each of the three axes' 16-bit
velocities one increment toward zero through `loc_a75d`, storing the stepped low and
whole bytes back into the same six cells `loc_a6a9` reads. `loc_a75d` ([code]) does
the per-axis work: it takes the whole byte in `y` and low byte in `a`, adds the
fixed increment held at `loc_a788` (0x20) when the velocity is negative or subtracts
it otherwise, and on crossing zero it snaps the velocity to zero and bumps `loc_29`.
Since the counter starts three short of wrapping, it reaches zero only when all
three axes have saturated at rest in the same pass, and `loc_a721` reacts to that by
zeroing the slot's whole coordinate `loc_283` — the object has fully stopped. The
initial velocities for such an object come from `loc_a69b` ([code]), which reads a
POKEY-2 random magnitude (`loc_60da & 0x07`, 0–7) and negates it when its caller's
incoming value has bit 0 set, yielding a signed nudge in [−7, +7] that a spawn path
distributes across an object's velocity/delta cells. None of these four ran in the
captured window; the tags are honest [code], and which specific enemy uses this
free integrator (as opposed to the rim-walk path below) is not settled from the code
alone, since the same cell `loc_283` also serves as a flag byte in the pursuit
routines.

### The one-dimensional fractional integrator

A separate, simpler integrator advances a single clamped position. `loc_adce`
([code]) is a fixed-point sub-step folder: it takes the signed step in `loc_50`,
shifts it left three (times eight), adds it into the fractional accumulator `loc_51`,
and returns the whole-step carry into the accumulator register — sign-extending a
negative step to `0xff` as the high byte — then clears `loc_50`. `loc_b0ab` ([code])
wraps it to move the shared rim-position cell `loc_200`: it integrates the step into
the current `loc_200`, floors a negative result to zero, clamps a large one to the
ceiling in `loc_127`, and publishes the clamped value back to `loc_200` and out
through both live-out registers. `loc_200` is the position the pursuit logic below
reads as the target segment, and `loc_127` holds its upper bound. In this capture
`loc_50` was zero and `loc_200` never moved, so both routines are reached-but-idle
[code] — the mechanism is legible but its effect on the value was not exercised.

### Rim pursuit and the shared segment-delta helper

The heart of the chase is `loc_a7a6` ([seen]), which computes the signed rotational
distance between two segments. It subtracts its two arguments, stashes the raw
difference at `loc_2a`, and then consults the geometry flag `loc_111`: if that
flag's top bit is set it keeps the full signed byte (an open/line tube where
distance does not wrap), otherwise it masks to the low nibble and sign-extends bit 3,
giving a wrap-around distance in [−8, +7] for a circular tube. It is heavily
exercised and feeds every routine that needs to know "which way, and how far,
around the rim."

`loc_97c5` ([seen]) is the pursuit/auto-aim scan. It walks the depth table
`loc_2df` from index `loc_11c` down to zero, tracking the smallest *nonzero* depth
in `loc_29` and its slot index in `loc_2a` — i.e. the nearest enemy. If no enemy is
present it returns the last byte read; otherwise it takes that slot's segment from
`loc_2b9`, differences it against the shared rim position `loc_200` through
`loc_a7a6`, and returns a rotation code by the sign of the result: `0x00` when
already aligned, `0x09` to turn one way, `0xf7` (−9) to turn the other. Its caller
consumes that as a spinner delta, steering the Blaster toward the closest climbing
enemy.

The same segment-delta drives which way a rim-walking enemy turns. `loc_9d67`
([code]) reads a slot's target segment from `loc_2b9`, differences the shared byte
`loc_200` against it through `loc_a7a6`, and records the side the target lies on in
bit 6 of the slot's flag byte `loc_283` — clearing bit 6 when the difference is
negative, setting it otherwise. `loc_9c4f` ([seen]) is the plain toggle of that
same bit 6 (`loc_283[x] ^= 0x40`), flipping the enemy's travel direction along the
rim. `loc_9d67`'s write is reached but adversarially tagged, so it stays [code];
`loc_9c4f`'s toggle is observed running — the write-tap catches the XOR both setting
and clearing bit 6 of `loc_283` — so it is [seen].

`loc_9d06` ([seen]) settles an object once it has reached its target depth. It first
stamps the shared target depth `loc_202` into the slot's depth cell `loc_2df`, then
branches on the object's kind. A kind-1 object with the header gate `loc_3ab` set
merely flips bit 7 of a second flag byte `loc_28a` and stops; a slot already flagged
negative (bit 7 of `loc_283`) just bumps its stashed depth and stops. Otherwise it
decrements the counter `loc_108` and, on the first such settle (`loc_109 == 1`),
scans slots 6..0 for a non-empty neighbour whose stashed depth matches the shared
one, recording the scan index in `loc_38` and copying that neighbour's bit 6
inverted into this slot's `loc_283` — so a newly settled flipper takes the opposite
rim direction from its matched sibling. When it is not that first settle it instead
calls `loc_9d67` to face the target directly. Either way it arms the object's motion
script by writing `0x41` into `loc_10b` and advances `loc_109`.

### The rail remap of the descending column

`loc_a7d2` ([seen]) marches an eight-entry table `loc_3fe` toward a rail each frame,
gated and signed by the reference `loc_115`; if that reference is zero it returns
untouched. Working from entry 7 down, it shrinks any large entry (≥ 0x17) by a fixed
7, snaps a mid-range nonzero entry to a rail — `0xf0` or `0` chosen by the sign of
`loc_115` — and lets a zero entry adopt `0xf0` from its next neighbour only when that
neighbour is nonzero and below `0xd5` (and only while `loc_115` is negative). Every
result is OR-folded into `loc_29`, `loc_37` is stamped `0xff`, and if the whole table
has collapsed to zero the reference `loc_115` is itself cleared, disarming the
process. This is the per-frame stepping of the moving spike/pulsar column toward the
rim; the mechanism is precise, though the mapping of the eight entries to a specific
on-screen shape rests on the caller (`loc_97f8`) rather than on this routine.

### Turning slot state into a screen point

Two routines project a slot's motion state to the display. `loc_b634` ([seen])
builds an on-screen point for a slot: it takes the slot's segment from `loc_2b9` to
index the level's base tube-vertex coordinate tables `loc_3ce` and `loc_3de` into
`loc_56`/`loc_58`, then offsets each by a signed per-phase delta — the phase is the
low nibble of `loc_2cc` indexing the delta tables `loc_b68b` and `loc_b687` — using a
0x80-biased signed-saturating add, landing the final X at `loc_2e` and Y at `loc_30`
(with `loc_2f` mirrored from `loc_57`). It finishes by loading a style-byte pair from
`loc_bcdc`/`loc_bcec` indexed by `loc_112` into `loc_59`/`loc_5a`. It is heavily
exercised [seen] — this is where an enemy's segment-and-phase state becomes its
drawn position as it climbs and flips. `loc_b6fa` ([code]) is the fractional scaler
that supports such perspective work: it stashes the input in `loc_29`, takes the low
three bits of the slot's phase counter `loc_2cc` as a fraction in `loc_2c`, and over
three rounds performs a sign-preserving shift-add of the input, consuming the
fraction LSB-first, returning the scaled value. It did not run in this capture,
so [code].

### Slot timers that pace the motion

A small timer subsystem meters the active object's cadence. `loc_c9af` ([seen])
ticks the active slot: it clears `loc_4`, decrements the active slot's countdown at
`loc_48 + loc_3d`, and when the base pair `loc_48`/`loc_49` is fully spent it hands
off to `loc_c9f1` to finalize. Otherwise, if the active slot's countdown has hit
zero it seeds `loc_1 = 0x0c` and `loc_4 = 0x28`, then advances to the next armed
slot by toggling `loc_3f` (only while the gate `loc_3e` is nonzero) until it finds a
non-empty countdown, and arms the next-frame cells `loc_2` (0x1c or 0x02 depending
on whether `loc_46[x] + 1` wrapped) and `loc_0 = 0x0a`. `loc_c9f1` ([seen]) is the
finalizer: it scans the zero-page window `loc_46 .. loc_46 + loc_3e` for its maximum,
stores that decremented (when nonzero) into `loc_126`, and sets the frame timer
`loc_0` to `0x10` when the status byte `loc_5` is negative or `0x14` otherwise. Both
are reached via a dispatch path rather than a textual caller.

`loc_c81b` ([seen]) applies a pending step and books it in a tally, and its exact
game role is not settled — the tag is honest and the vocabulary is flagged. From the
two-bit gate in bits 5–6 of `loc_4e` and a "≥ 2" test on the counter `loc_6` it
derives a step of 0, 1, or 2, draining `loc_6` by that amount, and clears `loc_4e`.
When the gate is clear it may seed four intro cells (`loc_1`, `loc_4`, `loc_0`,
`loc_2`) and clear `loc_50`/`loc_123`, guarded by `loc_50 != 0` and `loc_5` being
non-negative. When the step is nonzero it records it in `loc_3e`, sets bits 6–7 of
`loc_5`, zeros `loc_16`/`loc_18`/`loc_0`, bumps a 16-bit tally at `loc_40c`/`loc_40d`
(index 0 or 3 by whether the step was 2), and folds the step into `loc_100`, clamping
that value to `0x63`. The arithmetic is exact and observed, but what the tally and
the `0x63`-capped `loc_100` mean in the game's terms is not resolved here.

### An unreached triad rotator

`loc_b875` ([code]) rotates the three-entry array `loc_22 .. loc_24` down by one with
wrap-around, threading the displaced entry through, and mirrors each new value into
the paired array `loc_809 .. loc_80b`. It has no caller found and did not run, so its
role in the game is unconfirmed; the mechanism (a wrap rotation of a mirrored triad)
is all the code supports.

## The mathbox: projection and level tables

Tempest draws its tube in perspective, and the arithmetic that turns a lane's stored geometry into on-screen coordinates runs through a hardware math coprocessor addressed at `loc_6080`–`loc_6096`. The registers divide into a control/input bank the code writes (`loc_608c` control, `loc_608e`/`loc_6094` and `loc_6095`/`loc_6096` operands), a busy flag `loc_6040` whose bit 7 stays set while the unit works, and two result registers `loc_6060`/`loc_6070` the code reads back. This subsystem prepares that hardware, feeds it lane geometry point-by-point, and unpacks the packed per-level shape/colour tables that supply the geometry in the first place.

### Priming the coprocessor

`loc_c1c3` [seen] clears the working state before a projection run. It zeroes a cluster of zero-page scratch cells (`loc_81`, `loc_91`, `loc_80`, `loc_78`, `loc_90`, `loc_88`) and then blanks the coprocessor's entire input bank — `loc_6080`, `loc_6081`, `loc_6083`, `loc_6084`, `loc_6085`, `loc_6086`, `loc_6087`, `loc_6089`, `loc_608d`, `loc_608e`, `loc_608f`, `loc_6090` — leaving control register `loc_608c` alone until the end, where it drops in the value `0x0f`. It is reached on essentially every setup pass. One honesty caveat carried from grounding: in the write-tap capture every one of these transitions was constant (the targets were already zero, and `loc_608c` went `0x0f`→`0x0f`), so the write sites are all confirmed present but their *clearing* effect was not itself observed changing a non-zero cell.

### The projection driver

`loc_c098` [seen] is the point projector. It forms a 16-bit delta from the pair `loc_57`/`loc_5b` relative to reference `loc_5f`: the low byte is `loc_57 − loc_5f` written to `loc_6095`, and the high byte is `(0 − loc_5b − borrow)` written to `loc_6096`, where a negative 16-bit result is clamped up to exactly `+1` (`loc_6096`=0, `loc_6095`=1). It then computes an unsigned horizontal magnitude `|loc_58 − loc_60|` with its direction recorded in sign flag `loc_33` (`0xff` when `loc_58 < loc_60`, else `0`), driving that magnitude into the coprocessor inputs `loc_608e`/`loc_6094`, and a vertical magnitude `|loc_56 − loc_5e|` whose sign it parks in `loc_34` with the magnitude in `loc_32`.

Having loaded the horizontal operand, it spins on `loc_6040` bit 7 until the coprocessor finishes, reads the two result bytes `loc_6060`/`loc_6070` into the accumulator pair `loc_63`/`loc_64`, reloads the coprocessor inputs with the vertical magnitude from `loc_32`, and folds an offset pair `loc_68`/`loc_69` into `loc_63`/`loc_64` — subtracting when `loc_33` is negative, adding otherwise — as a saturating 16-bit operation (subtract overflow pins the pair to `0x0080`, add overflow to `0x7fff`). It waits on the busy flag a second time, reads the next result into the second accumulator `loc_61`/`loc_62`, and folds the other offset pair `loc_66`/`loc_67` in or out under the vertical sign flag `loc_34` with the same saturating limits. The two accumulators `loc_61`/`loc_62` and `loc_63`/`loc_64` are the projected X/Y that its callers harvest.

### Projecting a whole tube's lanes

`loc_c473` [seen] is the caller that runs `loc_c098` across all sixteen lanes of a tube. It seeds `loc_57` from its A argument and `loc_38` from its X argument, clears the clamp tally `loc_59`, and counts `loc_37` down from `0x0f` to `0`. On each pass it loads that lane's base coordinates — `loc_3ce`+index into `loc_56` and `loc_3de`+index into `loc_58` — invokes the projection driver, and then saturates each of the two returned signed value/sign pairs into the window −4..+3 (`0xfc`..`0x03`): a value with bit 7 set below `0xfc` snaps to `0xfc`/sign `0x01`, a non-negative value at or above `0x04` snaps to `0x03`/sign `0xff`, and anything already inside passes through. The first pair lands in the screen-slot coordinate tables `loc_31a`+out (value) and `loc_32a`+out (sign); the second lands in `loc_33a`+out and `loc_34a`+out; both are indexed by the descending cursor `loc_38`. Every clamp bumps `loc_59`, which it returns — so the count of lanes whose projection saturated is handed back to the caller. It is heavily exercised, filling these slot tables on each geometry pass.

### Snapping a coordinate to its reference

`loc_c453` [seen] adjusts the same coordinate operands the projector consumes. Guarded on `loc_5b` (it returns immediately when `loc_5b` is non-zero) and on the gap being small (it returns when `loc_57 − loc_5f` is already `0x0c` or more), it otherwise raises `loc_57` to `loc_5f + 0x0f`, ceilinged at `0xf0`. In the capture this fired as a large upward jump of `loc_57` (e.g. `0x14`→`0xe7`), pulling a lagging coordinate up to just past its reference before the next projection. Because `loc_57`, `loc_5b`, and `loc_5f` are exactly the operands `loc_c098` reads, this behaves as a pre-projection convergence nudge on the tube coordinate.

### Unpacking the per-level nibble tables

`loc_c196` [seen] expands one level's packed shape/colour data. It takes the level selector `loc_9f & 0x70`, clamps it to at most `0x5f`, and forms a ROM index `X = (selector >> 1) | 0x07`. Walking `y` from 7 down to 0, it reads a packed byte from `loc_c1fd`+X and splits it: the low nibble goes both to zero-page `loc_19`+y and to its colour-RAM mirror `loc_800`+y, while the high nibble goes to `loc_21`+y and mirror `loc_808`+y, with X decrementing each step. One pass thus populates two eight-entry table regions and their display mirrors, and grounding saw all four regions filled with real, varying per-level values.

`loc_b888` [code] wraps that unpack: it calls `loc_c196` to rebuild the nibble tables and then seats a two-byte vector-tail value, writing `0x7f` to `loc_139` and `0x04` to `loc_13a`. This routine was **not reached** in the capture — its two own-cell writes at `loc_139`/`loc_13a` never fired and no direct caller was found, consistent with it being a computed-dispatch target — so its role here is read from the code, not confirmed running.

### Packing a value back into a table byte

`loc_c2e8` [seen] is the inverse-shaped helper the geometry builder leans on. Given an input byte, values of `0x62` or greater are replaced by a masked hardware value `loc_60ca & 0x5f` (a random/timer fallback). It splits the byte into a quotient `value >> 4` and a remainder `value & 0x0f`, looks the remainder up in ROM table `loc_bc7c`, stores that table entry to `loc_112`, and returns a packed byte `(entry << 4) | 0x0f` in A with the quotient in X and the remainder in Y. The stored `loc_112` becomes the row index the tube builder uses to reach the level-geometry ROM tables.

### Building a level's tube coordinates

`loc_c235` [seen] assembles the current level's lane geometry, running once per level setup. It first packs a seed through `loc_c2e8`, feeding it the byte from `loc_46`+`loc_3d`; the returned packed value becomes a neighbour cursor and the stored `loc_112` becomes the ROM row `y`. From that row it derives the span: `neg = −{loc_bc8c+y}` written to both `loc_5f` and `loc_5d`, its complement `0x10 − neg` to `loc_a0`, a guard `0xff` into `loc_5b`, `{loc_bc9c+y}` into `loc_60`, and `{loc_bccc+y}` into `loc_111`. The offset pair is then set one of two ways: when `loc_2` equals `0x1e` it copies `{loc_bcac+y}`/`{loc_bcbc+y}` straight into `loc_68`/`loc_69`, otherwise it takes the signed 16-bit difference `{loc_bcbc:loc_bcac} − {loc_69:loc_68}`, shifts it right four places keeping the low byte, and stores that into the level-scale cell `loc_121`. It clears the running accumulators `loc_66`/`loc_67`, the pair `loc_10f`/`loc_110`, and writes `0x2c` to `loc_113`.

It then seeds six per-column arrays top-down over indices `0x0f`..`0`, with the neighbour cursor walking down from the seed: base coordinates from ROM tables `loc_b97c`→`loc_3ce` and `loc_ba7c`→`loc_3de`, a third geometry table `loc_bb7c`→`loc_3ee`, and zeroed slots `loc_31a`, `loc_33a`, `loc_39a`. Finally it produces the rotate-averaged neighbour midpoints: for each column it rounding-averages that column with its next (wrapping) neighbour — add the two bytes plus one, then rotate right carrying the ninth bit into bit 7 — writing the `loc_3ce` midpoints to `loc_435` and the `loc_3de` midpoints to `loc_445`. The result is the full symmetric set of tube-vertex coordinates and their inter-vertex midpoints that `loc_c473` later projects.

### A mode flag and scale

`loc_ca48` [seen] sets a mode flag bit and a paired scale from two zero-page gates. It defaults to `(a, y) = (0, 0x10)` and switches to `(0x04, 0x08)` only when both `loc_117` and `loc_3d` are non-zero; it then folds bit 2 of the chosen `a` into flag `loc_a1` while preserving every other bit, and stores `y` into `loc_b4`. Both write sites are confirmed, but only the default branch was exercised in the capture — `loc_a1` was observed staying `0x3`→`0x3` (bit 2 already clear) and the alternate `a = 0x04` path was never taken — so the flag/scale writes are real but the mode-switch effect on `loc_a1`/`loc_b4` is unconfirmed. The code supports a "flag bit and scale byte" role; its precise game meaning beyond that is not settled by what ran.

## Sound, POKEY and the interrupt heartbeat

The machine keeps two POKEY sound chips at `$60c0`/`$60d0` and drives them from a bank of sixteen software voice slots kept in the paired zero-page arrays `$c0..$cf` (loc_c0, the per-slot frame/pattern byte), `$d0..$df` (loc_d0, the level byte actually pushed to hardware), `$e0..$ef` (loc_e0, a fast per-slot timer) and `$f0..$ff` (loc_f0, a slow per-slot timer). A single sentinel cell `$bf` (loc_bf) marks whichever slot is being reserved mid-update. The whole sound engine runs off the interrupt, so its two moving parts — the input-counter stepper and the voice advancer — are described here as the per-frame heartbeat, alongside the code that loads sounds, resets the hardware, and reads the option/coin switches.

### The IRQ heartbeat: loc_cf24 then loc_cd0a

Every interrupt (the handler reads the hardware input latch `$0c00` into control byte `$08` (loc_8), folds coin/switch bits, then calls the two routines in immediate succession) the machine first runs **loc_cf24 [seen]** and then **loc_cd0a [seen]**. loc_cf24 walks three parallel lanes with `x` counting `2..0`, and for each lane shifts a distinct bit out of `$08` (lane 1 consumes two shifts, lane 0 three, lane 2 one) so that each lane is gated by its own control bit. When a lane is enabled it advances that lane's position byte `$0d`/`$0e`/`$0f` (loc_d + x), which is held to the low five bits and wrapped/clamped around the `0x1b`/`0x1f`/`0x20` boundary so the position rolls within a 32-step ring; it reloads the per-lane hold timer at `$10..$12` (loc_10 + x) with `0x78` on a wrap and, when the lane actually steps, bumps the per-lane counter at `$13..$15` (loc_13 + x). The lane steps are then summed into the running accumulator pair `$16`/`$17` and the third accumulator `$18` (loc_16/loc_17/loc_18) with a small threshold table lookup at `$cfd9` (loc_cfd9) indexed by the high bits of `$09`, folding carries between `$17` and `$18` and nudging `$06` (`$07` is only read here, as a gate). Two tail passes then clamp the `$13..$15` counter triple back under `0x10` (the first pass subtracts `0x10` from any over-range entry, the second `0x11`). The routine is heavily exercised — the position wrap at `$0d` and the timer/counter cells all move under MAME — so it is grounded [seen], but the code establishes only the mechanism (three input-gated counters integrating into accumulators through a threshold table); it does not by itself settle which player-facing quantity (spinner rotation, timing) each lane represents, so the role is named for what the counters do, not for a game object.

Immediately after, **loc_cd0a [seen]** advances the sixteen voice slots and pushes their levels to the POKEY chips. Iterating `x` from `0x0f` down to `0`, it skips any slot whose frame byte `$c0,x` is zero (idle) and the one slot currently equal to the reserve sentinel `$bf`. For an active slot it counts down the fast timer `$e0,x`; only when that reaches zero does it count down the slow timer `$f0,x`. If the slow timer is still running it takes a single step through the animation tables (`$cbcc`/`$cbcd` (loc_cbcc) or, when the frame byte's high bit is set, `$cccc`/`$cccd`), reloading `$e0,x` from the table and folding the table value into the level byte `$d0,x`. If the slow timer has also expired it walks the table — advancing the frame byte `$c0,x` by two each pass, choosing `$cbcb`/`$cbce` (loc_cbcb) or `$cccb`/`$ccce` (loc_cccb) by the frame's high bit — until it lands on a nonzero frame, reloading both timers along the way. Finally it publishes `$d0,x` to a POKEY register: slots `0..7` write the eight audio registers of the first chip at `$60c0..$60c7` (loc_60c0 + x) and slots `8..15` write the second chip's audio registers at `$60d0..$60d7` (loc_60c8 + x, i.e. `$60c8+8` = `$60d0`). Odd slots take a special path that keeps the previous high nibble of the level byte and updates only the low nibble — consistent with POKEY's alternating AUDF (frequency, even registers) and AUDC (control/volume, odd registers) layout, where the control nibble is preserved while volume steps. MAME shows the POKEY audio registers being written with real, changing values, so this is grounded [seen] as the per-frame voice-to-hardware engine.

### Loading a sound: loc_ccc7 and its gate and trampolines

A sound is armed into the slot arrays by **loc_ccc7 [seen]**. Given a sound id in `A`, it stashes the caller's X/Y in `$31`/`$32`, then scans all sixteen slots `x = 0x0f..0` while walking the id backward as an index into the ROM row table at `$cb01` (loc_cb01). Each nonzero table byte claims that slot: it briefly writes the slot number into the reserve sentinel `$bf`, stamps the byte into the frame array `$c0,x`, arms both timers (`$e0,x = 1`, `$f0,x = 1`), then restores `$bf` to `0xff`. MAME shows `$bf` pulsing to a slot and back to `0xff` and the channel arrays taking real values, so it is grounded [seen] as the sound-request loader; a sound id therefore selects a row of per-register seed bytes and each nonzero entry claims one voice slot.

Requests normally pass through the enable gate **loc_ccc3 [code]**, which tests the high bit of the sound-enable flag `$05` (loc_5) and returns without doing anything when it is clear, otherwise falling into loc_ccc7 to register the id in `A`. Its own body writes nothing (it only vectors), so a write-tap cannot witness its gating and it stays [code]; its handler loc_ccc7 is the observed [seen] party. A family of thin fixed-id triggers feeds it, each supplying one constant sound id and carrying the caller's X/Y through: **loc_ccb0 [code]** (id `0x5f`, via the gate), **loc_ccc1 [code]** (id `0x1f`, via the gate), **loc_ccee [code]** (id `0x6f`), **loc_ccf2 [code]** (id `0x7f`), **loc_ccf6 [code]** (id `0x9f`), and **loc_cd06 [code]** (id `0xcf`). Two members skip the enable gate entirely and register unconditionally through loc_ccc7: **loc_ccfa [code]** (id `0xaf`) and, as noted, the direct handler path. All of these trampolines make no memory write of their own — a tail transfer of a constant into the shared registrar — so their individual reach is not attributable in a write-only capture and they carry the [code] tag, while the effect they produce (a row of the `$cb01` table claiming voice slots) is the [seen] loc_ccc7. Which in-game event each specific id denotes is not settled by the code; the ids are named by their literal value.

### Resetting the chips: loc_cd95

**loc_cd95 [seen]** is the dual-POKEY power-up/reset. It first clears the two SKCTL registers `$60cf`/`$60df` (loc_60cf/loc_60df) and the random latch `$0720` (loc_720). It then samples the two RANDOM registers `$60ca`/`$60da` (loc_60ca/loc_60da) once and polls five more times, latching the first sample into `$0720` the moment either RANDOM register is seen to change — a self-test that the LFSR-driven RANDOM generators are actually running. Afterward it writes the canonical SKCTL init value `7` into `$60cf`/`$60df`, and in a `x = 7..0` loop zeroes the eight audio registers of each chip (`$60c0..$60c7` and `$60d0..$60d7`) together with the low eight software slots' frame and level bytes (`$c0..$c7`, `$d0..$d7`); finally it clears both AUDCTL registers `$60c8`/`$60d8`. All of these writes are observed, so it is grounded [seen] as the textbook two-chip audio reset.

### Reading the option/coin switches: loc_d6bb and loc_dbe0

**loc_d6bb [seen]** decodes the operator option switches into the live game configuration. It reads the switch input port `$0e00` (loc_e00) into `$0a` (loc_a) and slices it three ways: bits 5-3 index the ROM table `$d6f7` (loc_d6f7) into config cell `$0156` (loc_156); bits 7-6 index `$d6ff` (loc_d6ff) into `$0158` (loc_158); bits 2-1 index the paired tables `$d6b3`/`$d6b4` (loc_d6b3/loc_d6b4) into `$ac`/`$ad` (loc_ac/loc_ad). It also reads the second input port `$0d00` (loc_d00), stores it XOR `0x02` into `$09` (loc_9), and folds `$ad` through the bit-packer loc_dbe0, recording the packed result into `$016a` (loc_16a). Its writes to the config cells are observed in the capture — constant here, since the operator switches are fixed during a run, but real role-defining decoded config values — so it is grounded [seen]. Its helper **loc_dbe0 [code]** stores the incoming value into POKEY register `$60db` (loc_60db), copies the low three bits of the POKEY read register `$60d8` (loc_60d8) into both a scratch byte `$37` (loc_37) and `$60cb` (loc_60cb), and returns those three bits merged with one relocated bit (bit 5) of `$60c8` (loc_60c8). In this capture every value flowing through it happened to be constant, so the packing itself was not exercised and it stays [code]; the mechanism (a four-bit selector assembled from two POKEY input/control registers) is nonetheless clear from the code.

### Two routines that live in this neighborhood but are not the sound engine

Two more assigned routines sit adjacent in the ROM but the code ties them to a separate slot/request scheduler, not to POKEY, so their tags and roles are kept honest to what the code supports.

**loc_dce6 [code]** primes the math coprocessor rather than the sound chips: it zeroes `$73`/`$0414`/`$6090` (loc_73/loc_414/loc_6090), loads the operand pair from `A`/`X` into `$608e`/`$608f` (loc_608e/loc_608f), sets the count registers `$608c`/`$6094` (loc_608c/loc_6094) to `0x10`, then scans a sixteen-step window of the math box's `$6040` (loc_6040) status port for the first slot whose high bit is clear (ready) and hands back that slot's low/high result from `$6060`/`$6070` (loc_6060/loc_6070), or exits with the counter run past the end. No body PC appears in the capture, so it is [code], accounted not exercised; it is a math-box helper, unrelated to sound.

**loc_ac3f [seen]** sorts a per-channel record table and derives a request. It masks the top bits of `$05`, optionally pre-clears the scratch block via loc_ca62 when `$09` matches a bit pattern, primes a request through loc_ddfb, and clears `$0601` (loc_601). It then selects a channel (0 or 3, from `$3e` / loc_3e), seeds the key triple `$2c`/`$2d`/`$2e` (loc_2c/loc_2d/loc_2e) from the staging cells `$40`/`$41`/`$42`, and bubble-sorts the row records `$0620`/`$061f`/`$061e` (loc_620/loc_61f/loc_61e) against that key lexicographically — swapping the parallel payload `$0520`/`$051f`/`$051e` (loc_520/loc_51f/loc_51e) alongside for high cursor positions — while counting the settling passes into `$0605` (loc_605) and recording the per-channel count into `$0600,channel` (loc_600). It nudges the running total `$0601` when it meets the recorded count, then packs a request byte from flag `$3d` (loc_3d) into `$0603` (loc_603) and hands off to the request walker loc_ad22. Its pass counter and per-channel stores are observed changing, so it is grounded [seen]; the code shows a priority sort over channel records feeding a request queue, but does not by itself establish that these "channels" are audio voices, so the role is named for the sort-and-request mechanism rather than asserted as sound. Its sibling **loc_ad6e [code]** is the per-frame tick of the active slot in that same scheduler: it sets `$01` to `6`, and when the frame gate `$03 & 0x1f` is idle counts down `$0605` and, on expiry, resets `$00` to `0x14` and returns. Otherwise it clamps the active slot's value `$0606,slot` (loc_606) to the `0x00..0x1a` rail via loc_adce, gates on bits 3-4 of mode byte `$4e` (loc_4e) while clearing them, then decrements both `$0602` (loc_602) and the step counter `$0604` (loc_604); when the step goes negative it re-arms (routing through loc_ddf7 when the channel count `$0600,$3d` is low) and calls loc_ad22, otherwise it retires the neighboring slot by zeroing `$0606,slot-1`. No body PC appears in this capture, so it is [code], accounted not exercised; the mechanism is a countdown-driven slot tick that re-arms or retires against the same `$0600`-block request queue as loc_ac3f.

## The EAROM high-score store

The cabinet keeps its high-score table (and its companion bookkeeping blocks) in an ER-2055 electrically-alterable ROM, a small non-volatile store that survives power-off. Because that part talks over a slow bit-at-a-time handshake rather than a memory bus, the game never reads or writes it directly. Instead a request-and-service pair sits between ordinary RAM and the chip: a family of small setters posts a request describing which blocks to move and in which direction, and a single-step state machine drains that request one entry at a time across many game passes so the handshake never blocks the frame.

### The request block: `loc_1c6`–`loc_1c8`

Three zero-page-adjacent bytes hold the standing request. `loc_1c7` is the region request-pending bitmask — one bit per transfer block, set to ask for that block to move and cleared by the service routine as each block completes. `loc_1c8` is the parallel direction bitmask: a set bit means *write that block out to the EAROM* (save), a clear bit means *read that block in* (load). `loc_1c6` is the index/blank-mode byte; when it is non-zero the service routine zeroes each source RAM cell as it transfers it, so the block is wiped out of RAM in the same pass it is committed.

The setters all merge into one shared tail (`loc_ddff`) that stamps `loc_1c6` from its Y argument and *ORs* its A argument into both `loc_1c7` and `loc_1c8`, so a new request accumulates on top of any still-pending bits rather than replacing them. `loc_ddf1` **[code]** is the fixed all-blocks save entry: it forces `loc_1c6 = 0xff` (blank mode) and ORs `0x07` — all three block bits — into both masks, i.e. write out every block and clear it from RAM afterward, the shape used when the machine is committing its state and abandoning the working copy. It was not reached in the capture — neither the `0xff` stamp nor the `0x07` mask was observed (only the `loc_ddfb` mask-4 path ran) — so its role rests on the code. `loc_ddfb` **[seen]** is the single-block entry, supplying mask `0x04` (block bit 2) with a zeroed index byte through `loc_ddfd`; grounding confirms this mask-4 path is the one actually exercised, with `0x04` observed OR-ing into `loc_1c7` and `loc_1c8`. `loc_ddf3` **[code]** is a trampoline that forces the index byte to `0xff` and runs the shared merge with a caller-supplied mask, requesting a blank-mode write of whatever regions the caller names; it is not reached in the capture. `loc_ddf7` **[code]** is a constant-supplier that hands mask `0x03` (blocks 0 and 1) with a zeroed index into `loc_ddfd`; the write-tap never sees value `0x03` at the merge points, so this two-block path is likewise unexercised.

`loc_de11` **[seen]** is the load counterpart and the odd one out: rather than OR-ing, it directly *sets* `loc_1c7 = 0x07` and `loc_1c8 = 0x00` — all three blocks requested, all in read direction — then falls straight into the service routine. Because `loc_1c8` is cleared outright, this is the "pull every block in from the EAROM" path, the shape used to recover the saved high scores. Both stores are grounded: `loc_1c7 = 0x07` and `loc_1c8 = 0x00` are seen written from this routine's own body.

### The service state machine: `loc_de1b`

`loc_de1b` **[seen]** is the ER-2055 transfer engine, reached on essentially every service pass and heavily exercised. It runs one small step and yields, driven by a set of cursor cells: `loc_1ca` is the active-mode byte (0 = idle, and it walks through the read/write sub-phases `0x20`/`0x80`/`0x40` during a transfer), `loc_1cb` is the entry index within the current block, `loc_1cc` is the running port cursor (an offset added to the `loc_6000` data-port base), `loc_1cd` is that block's entry-count limit, `loc_1ce` holds the single walking bit identifying the block being serviced, and `loc_1cf` is the running checksum folded across the block. `loc_bd`/`loc_be` form the 16-bit pointer into the RAM buffer that mirrors the block.

When a step finds the machine idle but a request pending (`loc_1ca == 0` and `loc_1c7 != 0`) it starts a fresh block. It clears the entry index, checksum, and mask cells, then rotates `loc_1c7` through an eight-step loop to isolate its highest set bit into `loc_1ce` — the one block this pass will handle — counting positions in X as it goes. It chooses the direction by testing that bit against `loc_1c8` (`0x80` write vs `0x20` read) and stows the choice in `loc_1ca`, then clears the block's bit out of the pending mask with `loc_1c7 = loc_1ce ^ loc_1c7` so the request shrinks as blocks are consumed. The position count (doubled into a table index) selects the block's parameters from four packed ROM tables: `loc_dddd` seeds the port cursor `loc_1cc`, `loc_ddde` the entry limit `loc_1cd`, and `loc_dde3`/`loc_dde4` the low/high bytes of the RAM pointer `loc_bd`/`loc_be`.

Each subsequent step services one entry. It clocks the EAROM through the control port `loc_6040`: the read handshake drives the `0x08 → (address to `loc_6000+cursor`) → 0x09 → 0x08` strobe sequence and then samples the returned byte from the read-back port `loc_6050`, while the write path presents the source byte at `loc_6000+cursor` and steps the mode byte through its `0x80 → 0x40` sub-phases, honoring `loc_1c6` by zeroing the source cell first when blank mode is armed. On a read the byte is stored through the `loc_bd`/`loc_be` pointer into the RAM buffer; on a write the RAM byte (or, at the block's end, the accumulated checksum in `loc_1cf`) is pushed out. Every entry is folded into `loc_1cf` and both the entry index `loc_1cb` and port cursor `loc_1cc` advance. At the end of a block the machine compares the final read-back byte against the running checksum; if they match it retires the block cleanly, but on a mismatch it walks back through the RAM pointer zeroing every entry it just read — discarding a block whose stored image is corrupt — and records the failure by OR-ing that block's walking bit into `loc_1c9`, the completed/failed-region marker that the idle-time starter (`loc_db5a`) later samples. Each step finishes by writing the next control strobe to `loc_6040` and returning to yield the CPU; only when a phase leaves the strobe zero does it loop straight into the next entry within the same pass. When the mode byte comes back clear the machine has drained the request and simply returns.

## State-reset, init and per-frame update chains

This subsystem is the machine's cold-start and per-state scaffolding: a family of straight-line **seed leaves** that stamp fixed constants into the work-RAM scalars a state is about to run under, a family of **reset leaves** that blank arrays and flag cells back to baseline, one **wave-init** routine that measures the freshly built tube, one **queue-drain** initializer that pulls the next requested object into a slot, and the **per-frame housekeeping** routine that ages shots and steps the round clock. Several routines converge on the same handful of low zero-page scalars — `loc_0` ($0000, the shared next-state timer/mode byte), `loc_1`, `loc_2`, `loc_4` — so whichever seeder ran last decides the value the following state sees.

### Constant-seed leaves

`loc_921b` **[seen]** is one link of the boot chain (`loc_9025` runs it directly as its first boot action, before falling into `loc_902b`). It seeds five state cells with fixed values and nothing else: `loc_200`=0x0e, `loc_51`=0xf0, `loc_106`=0x00, `loc_201`=0x0f, `loc_202`=0x10. Because `loc_200` (player segment) and `loc_51` are live cells that vary elsewhere, this is a genuine reset of them to a known start, not a decorative write.

`loc_b0e7` **[seen]** is the startup work-cell seeder: `loc_0`=0x0a, `loc_2`=0x00, `loc_4`=0xdf, `loc_1`=0x12, plus the pair `loc_14e`=0x19 and `loc_14d`=0x18. `loc_c97b` **[seen]** and `loc_ca18` **[seen]** are the same shape but for later state-entry transitions, reached as computed-dispatch targets rather than from a fixed caller. `loc_c97b` writes `loc_2`=0x04, `loc_1`=0x00, `loc_0`=0x0a, `loc_4`=0x14. `loc_ca18` first masks `loc_5` down to its low six bits (`loc_5 &= 0x3f`, clearing the two top flag bits) and then seeds `loc_3e`=0x00, `loc_2`=0x1a, `loc_0`=0x0a, `loc_4`=0xa0, `loc_16b`=0x01, `loc_1`=0x0a. All three overlap on `loc_0`/`loc_1`/`loc_2`/`loc_4`, so they are alternative "arm the next state" prologues that differ only in the constants they leave behind (note the differing `loc_4` values: 0xdf vs 0x14 vs 0xa0, and `loc_2`: 0x00 vs 0x04 vs 0x1a).

`loc_9234` **[seen]** seeds a 17-cell parameter block rather than scalars, and it takes its values from RAM instead of immediates. It copies the current `loc_15b` into the header `loc_3ab`, then fills the 16-entry per-lane array `loc_3ac`..`loc_3ac`+0x0f (walking x from 0x0f down to 0) with a single value read once from `loc_15a`. It is driven by the reset sequences `loc_9009` and `loc_90c4`. `loc_3ab` is a live cell that drains elsewhere as the level progresses, so this establishes the header's starting count and blanks (or uniformly fills) the per-lane column table for the level about to run.

### Reset leaves (blank an array plus its flags)

Three leaves run consecutively off the boot reset at `loc_902b`, each zeroing one array and its satellite flags. `loc_926f` **[seen]** zeroes the 7-byte block `loc_2df`..`loc_2df`+6 and then clears seven scattered flag cells: `loc_108`, `loc_109`, `loc_145`, `loc_142`, `loc_144`, `loc_143`, `loc_146`. `loc_928f` **[seen]** zeroes the 12-byte block `loc_2d3`..`loc_2d3`+0x0b and clears `loc_135` and `loc_a6`; besides the boot path it is also invoked mid-play by `loc_a504` and by the spike/pulsar step `loc_97f8`, i.e. it doubles as a mid-round "wipe this working set" primitive. `loc_929f` **[seen]** zeroes the 8-byte table `loc_30a`..`loc_30a`+7 and clears `loc_116`. Each of these targets holds real non-zero state elsewhere, so all three are meaningful resets rather than no-ops.

`loc_92ad` **[seen]** is the smallest of the family: it clears the single scalar `loc_50` to 0. It is reached both from the `loc_902b` boot chain and from `loc_90c4`, and `loc_50` is a heavily-churned cell elsewhere, so this is a deliberate reset of that one byte at (re)init.

`loc_a831` **[seen]** clears the pair `loc_3aa`=0 and `loc_125`=0 in one shot, run by the reset sequences `loc_9009` (which follows its four reset calls with `loc_5b`=0xfa and clears of `loc_106`/`loc_5f`/`loc_1`) and `loc_90c4`. Clearing `loc_125` here matters because that cell is a latch armed to 0xff elsewhere, so this returns it to its disarmed state.

`loc_ca62` **[seen]** zeroes the 6-byte scratch block `loc_40`..`loc_45`. It is an optional pre-clear ahead of a staging operation: `loc_ac3f` and `loc_c90c` call it before reading `loc_40`/`loc_41`/`loc_42` back as 3-byte staging entries, so it wipes that scratch to a known-empty state before the caller repopulates it.

`loc_a789` **[code]** is the deepest of the reset leaves: it zeroes the 16-byte per-slot state/flags table `loc_283`..`loc_283`+0x0f, then reseeds scalars `loc_10e`=0x20, `loc_10d`=0x20, `loc_1`=0x04, and clears `loc_68`=`loc_69`=0. Its caller is the queue-drain `loc_ad22` (below), which runs it as part of arming a new active slot. It carries the **[code]** tag because none of its own write PCs fired in the capture — the arming path that reaches it was not exercised — so its slot-table-plus-scalar reset role is read from the body, not witnessed.

`loc_a7bd` **[seen]** is the spike-table reset. It zeroes the 8-entry table `loc_3fe`..`loc_3fe`+7, overwrites the last slot `loc_405`=0xf0, and arms the flag `loc_115`=0xff. Its caller is the moving spike/pulsar per-frame step `loc_97f8`, which invokes it once the descending object passes a depth threshold (`loc_202` crossing while `loc_115` is still clear) — i.e. when the object arrives it lays down a fresh, fully-extended spike column (the 0xf0 seed at the far slot) and arms the flag that the remap step downstream consumes.

### Wave init and its measurement

`loc_a5cb` **[seen]** is the per-wave setup that runs once the tube geometry is in place. It resets a batch of bytes — `loc_0`=0x20, sets bit7 of `loc_106` (`loc_106 |= 0x80`), clears `loc_104`, `loc_107`, `loc_5c` and `loc_123`, and sets `loc_105`=0x02 — then performs its one real measurement: it walks the 16-entry lane table `loc_3ac`[0..0x0f] and counts how many entries are nonzero into `loc_123` (in the game's terms, how many lanes/segments carry a spike or occupant at wave start). If that tally is nonzero **and** the level `loc_9f` is below 0x07 (an early-level branch), it loads an intro parameter block — `loc_4`=0x1e, `loc_0`=0x0a, `loc_2`=0x20 — and then overwrites `loc_123` with the marker 0x80. In every case it finishes by arming `loc_125`=0xff. So `loc_123` carries a real count only when the early-level intro branch is skipped; otherwise it is reused as a flag. `loc_a5cb` is invoked from the per-frame routine `loc_a504`.

### The per-frame update chain

`loc_a504` **[seen]** is the frame housekeeper, run at the tail of the dispatcher `loc_970b` on every frame (and again from `loc_9729` when `loc_201` is negative). Its two arms are selected by the sign of the control byte `loc_201`.

The **positive arm** (`loc_201` < 0x80) does timer and shot-state bookkeeping. When gate `(loc_455 | loc_11b)` is nonzero and `loc_42` has exceeded 0x17, it bumps the per-slot timer cell `loc_0`+`loc_40` by one. It returns early if `loc_106` is set. Otherwise, when `(loc_3ab | loc_116)` is zero, it scans the shot/depth table `loc_2df` downward from index `loc_11c` looking for any live entry that has already grown past 0x11; only if no shot is that big does it re-init the wave via `loc_a5cb` followed by the `loc_928f` wipe. Finally it passes three gates in series — `(loc_4d & 0x60)` must be set, `loc_5` bit7 must be set, and `(loc_9 & 0x43)` must equal exactly 0x40 — and if all hold it calls `loc_a5cb` again.

The **negative arm** (`loc_201` ≥ 0x80, the one exercised in capture) first bails if any of `loc_135`, `loc_a6` or `loc_116` is set. Then it ages the shot/depth table: for each entry `loc_2df`[x] from x=`loc_11c` down to 0, a nonzero entry advances by +0x0f and snaps to 0x00 the moment it would reach or pass 0xf0 — the model where objects/shots travelling toward the far end expire at the ceiling. Next it steps the round pacing off `loc_3d`: if `mem8[loc_48 + loc_3d]` is not 1 it advances `loc_202` by 0x0f and proceeds once that reaches 0xf0; otherwise it clears `loc_10f`=0 and sets `loc_114`=1, then steps the 16-bit countdown clock `loc_5b`:`loc_5f` down by 0x20 (low byte `loc_5f -= 0x20` with a borrow into `loc_5b`) and proceeds only when the high byte `loc_5b` lands exactly on 0xfa. When it proceeds it sets the next-state byte `loc_0`=0x06, runs the `loc_928f` wipe, and folds `loc_108`+`loc_109`+`loc_3ab` into `loc_3ab`, clamping the sum to a ceiling of 0x3f.

### Queue-drain slot init

`loc_ad22` **[seen]** drains the packed request word `loc_603` two bits at a time to arm the next object slot; it is tail-reached from `loc_ac3f` after that routine has built the request. Each iteration takes the low two bits as a slot index (`loc_3d = (loc_603 & 3) - 1`) and shifts the request word right twice to consume them. It reads that slot's byte `n` = `loc_600`+index; a slot whose byte is 0 or ≥ 0x09 is out of range and skipped. For an in-range slot it computes a paired value into `loc_602` by tripling the byte, complementing it, and offsetting: `a = (3·n) XOR 0xff`, then `a - 0xe5`. It then arms two subsystems — `loc_ca48` (**[seen]** — folds a mode bit into `loc_a1` and sets scale byte `loc_b4`) — seeds `loc_605`=0x60, `loc_4e`=0x00, `loc_50`=0x00, `loc_604`=0x02, runs the slot-table reset `loc_a789`, marks the next-state byte `loc_0`=0x24 (armed) and returns. If the request word is already empty on entry it simply writes `loc_0`=0x14 (idle) and exits. So this is the "pull one queued spawn request into a working slot and arm it, or go idle" step.

### Geometry-rebuild request

`loc_ac20` **[code]** is a lightweight change-detector for the display geometry, called from `loc_abac`/`loc_aba2`. It first refreshes the live control snapshot via `loc_d6bb`, then compares two masked live inputs against their cached targets: `(loc_a & 0xf8)` against `loc_71e` and `(loc_16a & 0x03)` against `loc_71f`. When both still match it tail-calls the shared no-op return `loc_ac3e`; on any mismatch it falls to `loc_ac36`, which ORs 0x03 into `loc_1c9` to raise both pending-rebuild request bits. It carries the **[code]** tag because in the capture only the matching (no-op) path executed — the mismatch/request path was never taken — so the rebuild-request behaviour is read from the body while only the "nothing changed" branch was witnessed.

## Utilities and shared tails

This subsystem collects the small, reusable leaves that the rest of the machine leans on: a pair of arithmetic helpers that reshape a byte, a few fixed-value seeders and table shufflers, and a family of bare return points — some of which do real bookkeeping on their way out, others of which exist only to give a branch somewhere to land.

### Byte-reshaping compute helpers

`loc_aaf5` **[seen]** is the game's binary-to-BCD converter, and it is heavily exercised. It takes the byte in A and runs the classic double-dabble: eight passes, each shifting the top bit out of the working source and doubling a BCD accumulator in decimal arithmetic so that bit folds into the low BCD digit. The idiomatic body models the decimal-mode doubling exactly — for each nibble it doubles, adds the incoming carry, and applies the +6 / +0x60 corrections that keep both nibbles in the 0–9 range. The finished packed-BCD result is written to both `loc_29` (0x0029) and `loc_2c` (0x002c) and returned in A. The write-tap confirms the role directly: both `loc_29` and `loc_2c` are seen ranging across the full BCD span (0x00 up to 0x99), exactly the packed digits this loop produces. In the game's terms this is the routine that turns an internal counter into displayable score/count digits before they are drawn.

`loc_93e0` **[seen]** is a companion bit-splitter, reached exclusively from the geometry helper `loc_92c5` (from its three call sites). It seeds an accumulator to 0xff and folds the top three bits of A into it MSB-first, shifting A left once per pass. The seed is stashed to `loc_29` (0x0029) as scratch, and the routine hands back three live results: A holding the input shifted left three times (the fine value), Y holding the 0xf8|top3 seed, and X derived from the seed's complement as `((seed ^ 0xff) + 0x0d) >> 1`, which lands in the small range {6..10} and serves as a coarse index. The grounded evidence pins the seed write (0xff, then 0xfe after the first rol) and confirms the routine partitions one byte into a fine value plus a coarse table index for its caller. Note the pha/pla in the original preserves the *shifted* A, not the original input — the code decides the live-out here, and the idiomatic form carries that faithfully.

### Fixed-value seeders and table shufflers

`loc_92b2` **[code]** swaps two parallel 18-entry tables slot for slot: for x from 0x11 down to 0, it exchanges `loc_3aa`[x] (0x03aa) with `loc_3bc`[x] (0x03bc), so each slot ends up holding what its sibling held, then returns. The two arrays are paired parallel tables and this is a wholesale exchange between them. The tag is honest — neither store PC (0x92bd, 0x92c1) fired in the capture, so the routine was not reached across attract, coin, start, or play; `loc_3aa`/`loc_3bc` appear in the trace only as constant zero at unrelated points. The role is read cleanly from the straight-line code but cannot be confirmed live.

`loc_b85f` **[code]** is a straight-line seeder for two paired three-entry arrays. It writes the fixed triple 0x00, 0x04, 0x0c into both `loc_22`/`loc_23`/`loc_24` (0x0022–0x0024) and `loc_809`/`loc_80a`/`loc_80b` (0x0809–0x080b), leaving A = 0. No own-cell write was observed in the capture, so it is accounted "not exercised here"; the initializing role is legible from the code but ungrounded.

`loc_b955` **[code]** is a register-only leaf that always returns the constant pair A = 2, Y = 0, touching no memory. This one carries a proposer trap: the original reads `loc_57` (0x0057), shifts it right by four and runs an iny/lsr/bne bit-count loop — but the loop's result is discarded, because the trailing `clc`/`adc #2` starts from a cleared accumulator (A = 0 + 2 = 2) and `ldy #0` resets Y. So despite the bit-counting machinery, the output is the constant pair regardless of `loc_57`. A blind reader could easily mis-name this as "log2 / popcount of `loc_57`"; the code says otherwise, and the idiomatic form collapses it to the constant it truly returns.

### The rebuild-request tail chain

`loc_ac36` **[seen]** is the "request both block rebuilds" utility: it ORs 0x03 into `loc_1c9` (0x01c9), setting the two low pending-rebuild request bits, and returns the merged value in A. The role write is observed in the body (`loc_1c9` taking value 0x07, i.e. bits 0–1 present alongside an existing bit). It is driven from the geometry-watcher `loc_ac20` **[code]**, which first refreshes the live control snapshot (via `loc_d6bb`) and then compares the masked live state — `mem8[loc_a] & 0xf8` against the cached latch `loc_71e` (0x071e), and `mem8[loc_16a] & 0x03` against `loc_71f` (0x071f). When the live geometry no longer matches the cached targets, `loc_ac20` falls into `loc_ac36` to raise the rebuild request; when it already matches, it takes the shared no-op tail instead. Those request bits are later consumed elsewhere to copy the affected blocks. In the capture, `loc_ac20` was reached but only its match path fired, so the request-raising branch is grounded through `loc_ac36`'s own observed store rather than through `loc_ac20`.

`loc_ac3e` **[code]** is the shared return tail for that same watcher: a lone RTS that `loc_ac20` takes when the live geometry state already matches the latch and no rebuild is needed. `loc_ac07` **[code]** is the sibling "nothing to rebuild" leaf on the neighboring path, a bare RTS taken when the guarding condition (its caller's `& 3 == 0` test) says there is no work to do. Neither writes anything, so both stay [code] no-op return leaves — real control-flow join points, but with no role-defining side effect to ground.

### Pure no-op landing points

Two more bare returns exist purely as branch targets. `loc_af6e` **[code]** is the exposed RTS tail of the `loc_af3f` draw routine: its caller tail-branches here when both draw slots `loc_600` (0x0600) and `loc_601` (0x0601) are empty — nothing to draw, so unwind. `loc_9bcf` **[code]** is a do-nothing handler slot in a computed-dispatch table: a single RTS that returns immediately, letting the caller's own return unwind. Both are readable in role but unexercisable through a write-tap, since a routine that writes nothing leaves no trace to reach; their tags stay honest at [code].

## Still on the frozen oracle

The subsystems above are the idiomatic layer's decompiled set — the leaves and the caller routines that
drive them; the rest of the reachable call graph still runs as the frozen translated oracle and is not
described here: the deeper callers whose callees are not yet decompiled, and the computed-jump dispatchers
that form the game's spine (each is decompiled only once all of its jump-table targets are idiomatic).
Naming compounds as the graph is climbed: the routines decompiled so far keep `loc_<addr>` identifiers this
pass. The first computed-jump dispatcher, `loc_b84e`, is now idiomatic (its four jump-table targets were all
decompiled), a function-reference table replacing the RTS trick; the rest of the spine follows as its targets
land. Deferred to dedicated commits: `loc_9e5c` (a caller that falls into the shared mid-entry `loc_9e5f`,
a 2-entry split); `loc_c891` (whose call to `loc_ccfa` needs the X/Y left by intervening leaves threaded
through as returns); and `loc_b69b`/`loc_bd09` (whose call to `loc_bd3e` has the same intervening-clobber
register thread — the value it consumes is left by a prior frozen call, so it needs a coordinated callee
return rather than a direct dissolve). Deep-tail roles tagged `[code]` lift to `[seen]` once a capture drives
the states that exercise them. The routines added in the latest decompile batch are described by mechanism
above; their full grounding-tagged write-up lands in the next understanding pass.

