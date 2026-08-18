0000	read the unmapped self-check source -- floats 0xff on this board
0003	the magic byte the dead self-check would need -- never present
0005	the vestigial self-check branch -- never taken, its target isn't even code
0008	the read pets the watchdog so it can't reset the board mid-boot
000b	seat the Z80 stack pointer before handing off to boot
000e	brings the whole board up, then the main loop
0018	stash the sound command
0019	read the in-play flag
001c	test it
001d	not in a game -- drop the command
001f	the sound queue's head-count byte
0022	one more queued command
0023	the new head index
0024	index to that queue slot
0025	store the command there
0027	queued
0028	read one byte from the ROM tile run
0029	poke it into the cell the write pointer is sitting on
002b	step the write pointer back one 32-cell row -- one tile up the column
002e	no borrow -- the high byte still holds, skip the fixup
0030	the subtract borrowed past a page -- carry it down into the high byte
0031	walk the source forward to the next byte
0032	one cell done -- loop for the whole count, a count of 0 copying a full 256
0034	strip drawn -- both pointers left stepped past it for the next caller
0038	E is the blank tile $10; D counts down the 32 tilemap rows
003b	the base of the tilemap
003e	thirty-two cells across one row
0040	stamp the blank tile into the cell
0044	the per-row busy-wait count -- paces the writes on real video RAM, changes nothing visible
0066	save the interrupted code's registers
006e	kick the watchdog
0072	ack the NMI and block re-entry until service completes
0075	scan coins and award credits
0078	point at the sprite shadow's lead byte
007b	and at OBJRAM's lead byte
007f	copy the lead byte straight into OBJRAM
0080	step to the first shadow pair
0082	28 two-byte sprite records to blit
0084	the record's even byte -- two swapped nibbles
0088	four rotates -- swap the byte's nibbles for the sprite-attribute encoding
0089	store the swapped byte to OBJRAM
008c	the record's odd byte -- copied straight
0090	do all 28 records
0092	default: eight four-byte sprite passes
0094	the fly / object-slot select
0098	zero: blit the fly-sprite block at 0x8040
009a	else six passes
009c	point OBJRAM at the object-slot block
009e	and the shadow at 0x8048
009f	the pass's first byte -- nibble-swapped
00a3	swap the byte's nibbles for the attribute encoding
00a4	store the swapped byte
00a7	the pass's other three bytes copy straight
00af	one pass done
00b0	do the remaining passes
00b2	point at coin-pulse timer 1
00b7	not pulsing: skip it
00b9	tick the pulse timer down
00ba	still pulsing: leave the latch up
00bd	drop coin-counter 1's hardware latch -- ends the pulse
00c0	point at coin-pulse timer 0
00c5	not pulsing: skip it
00c7	tick it down
00c8	still pulsing: leave the latch up
00cb	drop coin-counter 0's latch -- ends the pulse
00ce	read the coin / cocktail input port
00d1	isolate the cocktail / 2P-select bit
00d3	upright cabinet: no mirror
00d6	the in-play flag
00da	not in a game: skip the mirror
00dd	the active player number
00e1	player slot 0: skip the mirror
00e4	player 1 up: no flip needed
00e6	the two-pixel registration nudge
00e8	the fly sprite's Y shadow
00eb	its OBJRAM copy
00ee	read the fly Y
00ef	shift it down two pixels for the flipped view
00f0	write the mirrored fly Y
00f3	the frog sprite's Y shadow
00f6	its OBJRAM copy
00f9	read the frog Y
00fa	nudge it down two
00fb	write the mirrored frog Y
00fc	the in-play flag
0100	attract / intro: hand off the frame
0103	pop one queued sound to the hardware
0106	the board-laid-out gate
010a	board not built yet: nothing to step
010d	the start-of-life freeze timer
0112	timer drained: run the full frame
0115	tick the freeze timer down
0116	save the decremented freeze timer
0119	still frozen: move only the lanes and carry the frog
011c	advance the animation buffer
011f	then to the epilogue
0122	the mode / intro stage
0127	intro or point-table mode: pace it
012b	attract proper: step the demo sequencer
012e	run the frame update -- idle outside play
0132	scrub the demo-state flag
0135	and this per-frame scratch
0138	and the countdown-enable latch
013d	clear the difficulty-index word
0140	point at the slot / occupancy block
0146	eleven bytes to clear
0149	seed the first byte to 0
014a	propagate the zero through the whole block
014c	the NMI HL-pointer cells
014f	seed the pointer's first byte to 0x80
0155	to the epilogue
0158	point at the intro pacing timer
015d	already 0: wait at the epilogue
0160	tick the pacing timer down
0161	not drained yet: wait
0164	step to the demo-phase counter
0167	a demo phase still running: hold
016a	point at the mode / intro stage
016d	advance the intro one stage
016e	to the epilogue
0171	the playing sound-sequence timer
0176	no sequence running: skip
0178	tick the sequence timer down
0179	save the ticked sequence timer
017e	not finished yet: skip
0180	the sequence-end sound command
0182	queue it
0183	the second end-of-sequence command
0185	queue it too
0187	clear the per-turn scratch
018a	the active player number
018e	player 2 is up: its board branch
0191	player 1's filled-bay count
0196	all five bays home: board complete
0199	the reveal start-delay timer
019d	delay drained: on to the reveal
019f	tick the start-delay down
01a3	skip ahead to the status-row stage
01a6	the home-reveal countdown
01aa	reveal running: tick it
01ad	the frog-spawn ready delay
01b2	still waiting to respawn: skip play
01b4	tick the score-display countdown
01b7	run collisions and frog input
01ba	the once-per-life latch
01be	already latched: skip the one-shot arm
01c1	set the latch
01c6	arm the status-row redraw to 0xff
01c9	the board-advance-done flag
01cd	board not just finished: skip
01d0	clear the done flag
01d3	sixty-four frames
01d6	reload the sound-sequence timer
01d9	the seven-tile reveal strip in ROM
01dc	its VRAM column
01df	seven tiles
01e1	blit the strip up the column
01e2	the status-row redraw countdown
01e6	not armed: skip to the world step
01e8	tick it down
01ec	the status-row VRAM
01ef	on the drain frame: repaint the status row
01f2	scroll the lane objects
01f5	advance the animation buffer
01f8	the first lane's scroll-edge flag
01fc	no edge: leave the index
01fe	the first lane's object index
0201	roll it back one for the pre-scroll scan
0205	the second lane's scroll-wrap flag
0209	no wrap: leave the index
020b	the second lane's object index
020e	roll it back one
0212	resolve the frog move against the pre-scroll lanes
0215	the first lane's scroll-edge flag
0219	no edge: nothing to restore
021b	the first lane's object index
021e	roll it forward again
0222	the second lane's scroll-wrap flag
0226	no wrap: nothing to restore
0228	the second lane's object index
022b	roll it forward again
022f	run the frog death animation
0232	move the lanes and carry the frog
0235	update the sprite-object cluster
0238	tick the gated countdown
023b	drain the frog-spawn ready delay
023e	the home-reveal countdown, reused as a column selector
0242	stamp that home bay's frog
0245	kick the watchdog
0248	restore the interrupted code's registers
0251	re-enable the vblank NMI for the next frame
0255	return to the interrupted main loop
0257	count the reveal down one
025b	on to the status-row stage
025e	the five player-1 home-bay gates
0264	four more after the first
0267	clear the first bay gate
0268	propagate the clear across all five
026b	reset the filled-bay count
026e	run the board-complete handler
0271	to the epilogue
0274	player 2's filled-bay count
0279	not all home: normal reveal chain
027c	player 2's five home-bay gates
0282	four more after the first
0285	clear the first bay gate
0286	propagate the clear across all five
0289	reset player 2's bay count
028c	run the board-complete handler
028f	to the epilogue
0292	read the ready-delay countdown word
0296	fold the two bytes together to test the whole word for zero
0297	already drained -- nothing to tick, leave the expiry flag alone
0298	one more frame off the ready delay
0299	store the ticked-down word back
029d	test whether this tick just brought it to zero
029e	still counting -- the spawn stays held off
029f	drained: clear the expiry flag -- release the hold
02a4	mask the vblank NMI so no frame interrupt fires while RAM is rewritten
02aa	clear both screen-flip latches -- the display comes up un-flipped
02b0	the base of work RAM
02b9	seed the first byte to zero (L is already 0)
02ba	propagate the zero up through 0x87ff -- all of work RAM starts from a known 0
02bc	the base of the 256-byte sprite (OBJRAM) page
02c4	clear the whole sprite page -- no stale sprites reach the screen
02c6	read IN1 for the two difficulty DIP bits
02c9	the ROM starting-time table sits in page 0x2e
02cb	keep just the two difficulty-select bits (0..3)
02cf	the shared start-time byte -- what the time bar counts down from
02d2	read IN2 for the cabinet and coinage DIP bits
02d6	test the cabinet DIP bit (set = cocktail)
02d8	upright cabinet -- skip the cocktail flag
02dc	raise the cocktail-cabinet flag
02e0	keep just the two coinage-select bits
02e2	the coinage selector -- later indexes the per-coin credit amount
02e5	the ROM score/high-score/state defaults
02e8	the score/state block in RAM
02ee	copy the 18-byte defaults -- installs the power-on high score and the initial score cells
02f0	spin out the power-on settle, feeding the watchdog across the wait
02f5	default to a 1-player game -- the start buttons promote to 2 later
02f8	re-arm the vblank NMI -- RAM is coherent now, so the frame clock may fire
02fb	clear the screen -- fill the tilemap with the blank tile
02fd	the sprite-DMA control low byte -- 0 for normal output
0302	the sprite-DMA control high byte -- 6 for normal sprite output
0308	prime the busy-wait the main loop spins between NMI firings
030d	seed the arrival-fanfare index to its power-on value
0310	the ROM spawn-RNG ring defaults
0313	the spawn-PRNG ring page in RAM
0319	copy the 32-byte defaults -- the spawn PRNG's fixed seed pool
031e	PPI0: mode 0, all ports as inputs -- it reads the panel and DIP switches
0323	PPI1: ports A/B as outputs -- it drives the sound board
0327	the RAM shadow of the sound-control byte, mute bit set
032a	mute the live sound-control port while the audio powers up
032e	strobe sound command 0 to the sound board
0331	read the sound-control shadow back
0334	clear the mute bit
0336	store the unmuted value in the shadow
0339	unmute the live sound-control port
033e	strobe command 0xff -- sound is now live
0341	read the top-level game mode
0344	the intro and score-ranking modes sit at 2 and up
0346	step that mode's frame toward attract or play
0349	repaint the whole score row from scratch -- a re-render, never an accumulation
034c	re-read the mode for the credit-line test
034f	zero only in mode 1, the mode that paints the credit region itself
0350	draw the credit line in every other mode
0353	the once-per-life play-start setup
0356	the two-pixel per-frame hop step
0358	the frog-hop step/reload block
035b	both hop-step cells, vertical and horizontal, seeded to two
035e	the nine-frame hop-animation length
0361	reload the four direction hop animations to nine -- reseeding these constants every pass is why the drain reaches a fixed point
0368	the spin-delay count that paces one main-loop pass
036d	count one off the delay
036e	spin here until it drains -- pure pacing, no state written
0370	read the in-play flag / player count
0373	already in a game?
0374	yes -- run the per-frame board/life dispatcher
0377	read the start-already-latched flag
037b	a start's already latched -- loop back without re-reading the buttons
037d	read the port carrying the START buttons
0380	rotate START1 out into carry
0381	START1 pressed -- take the one-player start
0383	rotate START2 out into carry
0384	neither start held -- loop back and keep scanning
0386	START2 pressed -- a two-player start, two credits
038a	a one-player start, one credit
038c	read the packed-BCD credit total
038f	enough credits for that many players?
0390	too few -- loop back, no game starts
0392	spend the players' credits
0393	keep the total packed BCD
0394	store the reduced credit total
0398	record the player count for this game
03a5	wipe both players' saved work/object page banks for a fresh game
03a7	flag the game in play, holding the player count
03ac	start with player 1 active
03af	latch the start so the button scan stops
03b4	seed the on-screen life/level count
03b7	give both players their starting life count
03ba	zero both scores and fill both time bars
03bf	set a vblank-read state cell
03c2	flush any pending sound commands
03c6	clear a vblank-read state cell
03c9	queue the game-start jingle cues
03d6	seed the in-play ready countdown to 0x20
03dc	arm the sound-sequence countdown
03e2	clear frog timer A
03e5	clear the active player's work RAM
03e8	blank the whole tilemap for the fresh game
03e9	load this player's lane-difficulty parameters
03ef	clear the home-column state
03f2	clear the frog state cell
03f5	reset both players' difficulty index to zero
0402	wipe the sprite-object record block
0404	clear the hold/hit flag
0408	raise the per-player start flag -- hands into board setup
040b	read the board-layout latch
040f	already laid: a between-lives frame -- take the continue / next-life path
0412	read the frog-state / demo flag
0416	in the attract demo -- leave the score header alone
0418	read the in-play flag, which doubles as the player count
041b	one-player game? (count of one)
041c	one player: reuse the surface -- skip the wipe and page swap
041e	two-player: blank the whole 32x32 tilemap to the empty tile
041f	bank the active player's work and object pages into the live pages
0422	redraw the score header
0425	read the board-advance request
0429	board-complete pending -- run the once-per-board advance pass
042c	paint the frog scene and tick the timer -- returns the board-ready value in A
042f	latch the board-layout gate from it -- next frame takes the continue path
0432	redraw the column-30 time indicator
0435	point at the top of the three fixed board-start HUD cells
0444	two-player: raise the active player's start flag
0448	clear the board-advance request -- the advance pass is spent
044b	read the frog-state / demo flag again
044e	mirror it into the per-player reset cell for the hand-off path
0451	redraw the lives row
0454	tail-enter the play loop at the pace tail
0457	redrawn on every entry, whichever branch follows -- must stay right across a death or a player swap
045a	read the life-restart gate
045d	test it
045e	clear: nothing to rebuild -- just resume play at the pace tail
0461	puts a live frog back on the board for the incoming life
0464	so no state leaks in from the life that just ended
0468	the score-display cursor pair -- zeroed to re-home the new life's score draw
046e	clear the score-field marker byte
0471	clear the board-layout gate -- asks for a fresh layout next frame instead of another trip here
0474	point at the 14-byte per-life HUD block
047e	blank the whole block -- it must start clear for the new life
0480	the per-life restart jingle
0482	queue it -- plays as the new frog is placed
0483	read the timer-expiry / intro gate
0486	test it
0487	set: the life ended on a timeout, or this is the intro beat
0489	ordinary next life within the turn -- a no-op in a one-player game
048c	resume the play loop at the pace tail
048f	repaint the GAME-OVER banner
0492	the first game-over jingle command
0494	queue that note
0495	the second jingle command
0498	the 16-bit intro-hold countdown
049b	tick one step off the hold
04a1	spin until the whole countdown drains to zero
04a3	read the play flag -- also the player count
04a7	a one-player game -- cold-start a brand-new board
04aa	read whose turn it is
04ae	not player 1 -- take the player-2 continue setup
04b1	point at player 1's continue flag
04b4	record that player 1 has entered its continue path
04b6	step to player 2's continue flag
04b7	read whether player 2's board is already seeded
04b9	player 2 already seeded -- player 1 just needs a light bay re-clear
04bc	wipe the screen for the fresh board
04bd	hand play to the other player
04c2	mark a live board
04c5	set player 1's home tally to its starting slot
04c8	the first of the five primary home-bay gates
04d1	re-open the first bay
04d3	clear the other four -- all five bays re-open
04d5	player 1's parked work page
04de	restore player 1's lane state into the live page
04e0	player 1's parked object page
04e9	restore player 1's sprite objects
04ed	seed the OBJRAM column-3f attribute shadow
04f0	resume the main loop at its pace tail
04f3	point at the player-2-path continue flag
04f6	raise it -- player 2's side is now through setup
04f8	step back to the player-1-path continue flag
04f9	read the player-1-path continue flag
04fa	test it
04fb	player 1 already set up -- no fresh board to seed, re-enter the cold-start slot-gate clear
04fe	clear the screen -- fill the tilemap with the blank tile for the incoming board
04ff	hand the turn to the other player
0504	raise the in-play flag / player count so the pace tail routes into the in-play tree
0507	seed player 2's home tally
050a	point at the first of player 2's home-bay occupancy gates
0513	zero the first gate (B is 0) -- every home bay starts empty
0514	propagate the zero across all five occupancy gates
0516	source: player 2's saved object page
0519	destination: the live object page
051c	43 bytes of lead-sprite/object records
051f	restore player 2's objects into the live page
0523	set the OBJRAM column-$3f attribute shadow for the restored board
0526	source: player 2's saved work page
0529	destination: the live work page
052c	183 bytes of lane-walk state and per-turn work RAM
052f	restore player 2's work page into the live page
0531	resume the foreground main loop -- the seeded board picks up next frame
0535	zero player 1's filled-bay count for his new board
0538	point at the first of player 1's five home-bay gates
053e	count four for the fill -- B is zero, the byte poked in
0541	open the first bay -- seeds the zero the copy spreads
0542	spread that zero up the row -- all five of player 1's home bays re-opened
0544	skip straight to the shared cold-start finish -- bypass the player-2 clear so his board survives
0548	reset player 1's filled-bay tally to zero -- board-complete fires when it reads five
054b	point at the first of player 1's five home-bay gates
0551	four follow-on gates to clear -- bays two through five
0554	zero the first gate -- bay one open again (B is the count's zero high byte)
0555	propagate the zero across the other four gates -- all five bays open for the new board
0558	clear player 2's filled-bay count -- a new board starts with none filled
055b	point at player 2's first home-bay occupancy gate
0561	four bytes to copy -- gates two through five
0564	B holds zero here -- plant it in the first gate
0565	propagate the zero into the other four gates, re-opening all five home bays for the new board
0567	clear the whole tilemap to the blank tile -- a fresh canvas for the score-ranking page
0568	guarded frog/gate wipe -- skips in a 1-player game to keep that player's state
056b	draw the credit line
056e	rank both players' final scores into the ranking-page field
0571	redraw the hi-score / 1-up / 2-up header row
0574	the sprite/actor block -- stale sprites, lane lists, low slot/gate cells
057a	0x160 bytes of it
057d	seed a zero at the head (L is 0)
057e	smear it across the block -- every stale record evicted
0580	the five low object bytes at 0x8000 -- includes the frog-anim index
058c	the live-object page, 0x800c..0x803a
0598	the zero poked into every state byte below
0599	the frog-ready flag -- no live frog yet
059c	the in-play flag / player count -- 0 means attract
059f	rewind the attract-demo sequencer to phase 0
05a2	point at the pair of continue flags
05a5	clear the player-1 continue flag
05a7	clear the player-2 continue flag
05a8	build a zero word in HL -- the difficulty pair below needs a 16-bit clear
05aa	the flip-x screen latch -- restore upright orientation
05ad	the flip-y screen latch -- upright again
05b0	one word store clears both players' difficulty indices at once
05b3	the attract companion byte
05b6	the work-RAM shadow of the cocktail flip bit
05b9	the attract frame-pacing / drawn-state gate
05bf	re-arm the once-per-board in-play-init guard
05c2	re-arm the one-shot page-swap init guard
05c5	the two-player start flag
05c8	mode 3 -- the attract score-ranking screen
05ca	park the machine in that mode
05cd	unconditional frog/bay wipe -- clean even where the guarded one skipped
05d0	tail into the main loop's pace tail -- resume free-running
05d5	request the next board -- the between-boards setup acts on it and clears it
05d8	mark the player's frog non-live for the reveal -- the per-player start/demo flag
05db	the frog-state demo gate -- input, movement, collision and the countdown timer all freeze while it's up
05df	clear the two-player start flag so it can't leak into the handoff
05e2	clear the board-layout gate -- the next board gets built from scratch
05e7	seed the all-frogs-home sweep at 255 -- it drains per frame, dropping a frog into each bay left-to-right
05ec	the lead-in delay -- holds the finished board a beat before the sweep starts
05ef	the reveal is armed -- the sweep plays out over later frames
05f0	the first board-cleared fanfare cue
05f2	queue that sound command
05f3	the second fanfare cue
05f5	queue it too -- the pair is the board-cleared jingle
05f6	which player is up
05f9	player 1 holds 1 -- zero here flags player 1
05fa	player 2 -- ramp its difficulty index instead
05fc	point at player 1's difficulty index
05ff	one tier harder
0600	read back the bumped index
0601	reached five -- time to wrap?
0603	not yet -- the bumped index already stands
0605	wrap back to tier 0
0608	point at player 2's difficulty index
060b	one tier harder
060c	read back the bumped index
060d	reached five -- time to wrap?
060f	not yet -- the bumped index already stands
0611	wrap back to tier 0
0612	wipe and re-blit the blank score field
0615	clear the object blocks and mirror them to the screen
0618	install the new tier's lane layout
061b	seed the new board's object animation
0620	the fresh board is fully laid out
0623	the board-clear bonus -- 100 points
0626	tail into the score add, which may award an extra life
0629	clear the active player's work RAM before laying the field
062c	point at the score-display cursor's low byte
0630	rewind the cursor's low byte to the top of the field
0631	step to the cursor's high byte
0632	and clear it too -- cursor back at the field top
0633	1 -- the field-seeded flag's value
0634	mark the score field seeded
0637	thirty-two rows to tile
0639	point at the field's top-left VRAM cell
063c	stamp the row's left ten-cell run of blanks
063f	skip the two-cell gap between the runs
0641	stamp the right ten-cell run past the gap
0644	ten trailing cells to carry past to the next row
0646	step down to the next row's top-left cell
0647	one row done
0648	more rows to tile
064b	the live object page -- the clear target and the mirror's source
0651	sized to blank the whole 44-byte object page
0655	every object slot on the page goes blank
0657	back to the now-zero page -- the mirror's copy source
065a	the OBJRAM hardware object mirror -- the copy destination
065d	43 bytes -- the object head, one short of the cleared page
0660	push the zeroed head straight into OBJRAM so the video chip drops the old objects now, ahead of the once-per-frame refresh
0662	the sprite-actor scratch block the next board's lanes rebuild
0668	sized to blank the whole 99-byte sprite block
066d	no stale sprite positions carried into the next board
0670	point at home bay 1's 2x2 tile block
0673	paint the empty-home graphic (tile 0x10) back over the bay
0676	home bay 2's block
067c	home bay 3's block
0682	home bay 4's block
0688	home bay 5's block -- the last
068f	clear the home-column state cell -- back to the default sprite-DMA layout for the next board
0692	grant the player one extra life -- the board is complete
0695	the empty-home-bay marker tile painted into every cell of the block
0697	stamp the top-left cell at the base
0699	then the cell to its right -- top row of the square filled
069a	0x1f -- with the pointer already one past the base this makes the drop a full 32-cell screen row
069d	carry the pointer down one screen row to the block's bottom-left
069e	stamp the bottom-left cell
06a0	then the bottom-right cell -- the 2x2 marker block is filled
06a4	reveal bay 1's frog -- column number 192 is the first the countdown reaches
06a9	reveal bay 2's frog -- column number 144
06ae	reveal bay 3's frog -- column number 112
06b3	reveal bay 4's frog -- column number 80
06b8	reveal bay 5's frog -- column number 48, the last bay revealed
06bd	the fill-all threshold, 16 -- refill every bay to empty and award the extra life, closing the board
06c0	the selector sits between thresholds -- the common case, paint nothing
06c1	bay 1's VRAM base
06c7	bay 2's VRAM base
06cd	bay 3's VRAM base
06d3	bay 4's VRAM base
06d9	bay 5's VRAM base
06df	the frog-in-home stamp's top-left tile (252)
06e2	its top-right tile (253)
06e4	31 -- from the top-right cell, one screen row down
06e7	reach the bottom row's left cell
06e8	the stamp's bottom-left tile (254)
06eb	its bottom-right tile (255)
06ed	the bay's frog is now painted
06ee	read the active player number
06f1	player 1's number falls to zero here -- the swap-IN case
06f2	any other player -- swap the pages OUT instead
06f4	point at the live object page
06f7	destination: the other player's object save
06fa	43 bytes -- the whole object page
06fd	bank the live object page into the other player's save
06ff	point at the live work page
0702	destination: the other player's work save
0705	183 bytes -- the whole work page
0708	bank the live work page into the other player's save
070a	point at player 1's parked object page
070d	destination: the live object page
0713	restore player 1's object page into the live cells
0717	set the OBJRAM column 0x3f attribute shadow -- shows on the next vblank
071a	point at player 1's parked work page
071d	destination: the live work page
0723	restore player 1's work page into the live cells
0726	the active player's live 183-byte work page
0729	into the work-page save bank
0731	its 43-byte object page
0734	into the object save bank
073a	the outgoing player's two pages are now parked
073c	the incoming player's parked work page
073f	back into the shared live work cells
0747	its parked object page
074a	into the live object cells
0750	the incoming player's state now drives the live cells
0754	flag OBJRAM column 0x3f's attribute shadow -- copied out on the next vblank DMA
0757	read the one-shot init guard
075a	test it
075b	already armed -- the one-time init already ran
075d	clear the two-player start flag
0762	arm the guard so the start-flag clear never repeats
0766	the write pointer, at the play field's top-left cell
0769	D = 32 rows to fill, E = the blank tile stamped into every cell
076c	the 4-cell status margin skipped past each row's end -- B drains to 0 by the row's end, so BC steps exactly 4
076e	28 play-field cells across each row
0770	stamp the blank tile into the cell
0774	hop the write pointer over the status margin onto the next row's first cell
0776	back for the next row
0779	ten cells to fill (B), the blank-field tile 0x10 waiting in C
077c	stamp that tile into the current cell
077e	once all ten are stamped the counter sits at 0 and the pointer one past the run, both read back by the caller
0781	the tilemap cursor -- fixed origin of the 22-wide block
0784	D counts down the 32 rows; E is the blank background tile stamped into every cell
0787	the width of the untouched right margin -- 10 cells skipped between rows
0789	22 cells to paint across this row
078b	poke the blank tile into this cell
078f	B has drained to zero across the run, so this steps the cursor by just the 10-cell margin -- onto the next row's first painted cell
0790	one of the 32 rows finished
0794	park the command byte on the sound-data latch for the sound CPU to read
0797	the sound-control port's RAM shadow -- its only readable copy
079a	drop bit 3, the sound CPU's /INT line, keeping the other seven
079c	the falling edge on bit 3 wakes the sound CPU to read the latched byte
079f	hold bit 3 low a moment before raising it, widening the strobe
07a3	reread the shadow to rebuild the byte with the untouched bits
07a6	raise bit 3 back high, ending the /INT pulse
07a8	the /INT line idles high again -- command delivered
07ac	point at the sound queue's pending count
07af	read how many commands are queued
07b0	test it
07b1	queue empty -- issue nothing this frame
07b2	one command about to leave -- drop the pending count
07b3	hold the old count as the shift length -- one slot more than needed, but harmless
07b4	step to the front slot -- the oldest queued command
07b5	read the command at the front
07b6	hand it to the sound hardware
07ba	aim the shift at the front slot as destination
07bb	read from one slot up -- slot 2 slides down into the front
07be	slide every surviving command down one slot -- the front stays anchored at 0x8301
07c1	read the player now on the machine
07c4	is it player 1?
07c5	player 1 delegates to the guarded raise
07c8	any other player -- raise the flag directly
07ca	raise the plot-suppression start flag -- parks the frog off-board while the board lays out
07ce	read the board-advance-pending flag
07d1	test it
07d2	no advance under way -- leave the start flag as it found it
07d5	raise the start flag -- keeps the frog sprite off the board-advance reveal
07d9	point at the count byte, the head of the sound ring
07dc	one byte up: the first command slot, where the fill lands
07df	forty-seven command slots to scrub
07e2	B is zero -- poke it into the count byte, the ring now reads empty
07e3	smear that zero up through every slot, clearing any stale command
07e6	read the in-play flag -- also the player count
07e9	a lone player holds 1 here -- Z marks it
07ea	one player keeps its work RAM intact -- otherwise fall into the force-clear
07eb	clear A -- the zero poked into every gate byte
07ec	point at the frog object block base FROG_X
07ef	the fill destination, one byte above the source
07f2	31 more bytes past the seeded first -- the 32-byte frog block
07f5	seed the first byte with zero -- B is the count's zero high byte
07f6	fan the zero through the whole frog object block
07f8	point at the home-bay gate block
07fb	its fill destination, one byte up
07fe	eleven more bytes -- the 12-byte gate block, B still zero
0800	seed the first gate byte with zero
0801	clear every gate byte -- all five home bays reopen
0804	point HL at the frog object block base -- its X byte
0807	clear A -- the zero that blanks both frog sub-fields
0808	mark the frog object active -- the sentinel 1, not a real spawn X
080b	clear the frog's sprite code -- drop any stale graphic from the last life
080e	clear the frog's row -- the spawn path parks it at the real start Y
080f	read the session-kind flag
0812	a two-player game?
0814	one- or no-player game -- done after the three object bytes
0815	the start-of-life timer count (0x40)
0818	seed the frog's settle-in hold-off timer
081e	seed its companion timer
0823	clear the per-turn scratch cell -- wiped on every hand-off, even a one-player game
0826	read the live game's player count
0829	a one-player game (count 1) falls to zero
082a	no other player to hand to -- return before touching any player state
082b	read the active player number, 1 or 2
082e	flip it 1<->2 -- the swap to the other player
0830	the incoming player is now the active one
0833	point at player 1's saved life count
0836	incoming player 1 falls to zero
0837	player 1 -- keep the pointer on player 1's slot
0839	player 2 -- step on to player 2's life count
083a	read the incoming player's saved lives
083b	bring them to the front as the live count the rest of the game reads
083f	clear the incoming player's reset cell
0843	raise the start flag so the dispatcher lays out a fresh start for this player
0846	read the cocktail-cabinet flag
0849	test it
084a	upright cabinet -- nothing to flip, done
084b	read the screen-flip shadow
084e	invert the flip bit
0850	the new flip state
0854	mirror it out to the flip-X hardware latch
0857	and the flip-Y latch -- both flips turn the raster 180 degrees for the player now up
085b	the top cell of the no-more-frogs column
085e	source of the lower four-tile strip
0861	four tiles
0863	blit the strip up the column
0864	source of the upper five-tile strip
0867	five tiles
0869	stack it on top -- HL carries on from where the first strip stopped
086c	raise the hold flag -- freeze the countdown so the finished label holds on screen
0870	read the demo/attract flag
0873	test it
0874	attract or demo -- the countdown stays inert, bail
0875	read the freeze/hold flag
0878	test it
0879	gameplay frozen -- bail
087a	read the countdown-started latch
087d	test it
087e	already started -- skip the start tone
0881	raise the latch so the start tone fires only once
0884	the countdown-starting tone
0886	queue it
0887	lay out the field and seed the counters, once
088a	read the bonus-strip arm select
088d	test it
088e	armed -- cash the whole bonus at once instead of draining the bar
0890	point at the per-step pace byte
0893	tick one frame off the pace
0894	not yet -- wait for the next frame
0895	step is due -- reload the pace to 32 frames
0897	point at the step count
0899	test the step count
089a	bar fully drained -- draw the closing strip and freeze
089d	one fewer step to go
089e	store it back
089f	point at the visible bonus number
08a1	knock one off the bonus
08a2	back to packed BCD -- 0x20 becomes 0x19
08a3	store the ticked-down bonus
08a4	point back at the step count
08a5	did the bonus just reach BCD 10?
08a7	no -- skip the low-time warning
08a9	the low-time warning tone
08ab	queue it
08ad	clear the col-0x3f attribute shadow -- changes how the field renders for the final stretch
08b0	reread the step count -- it picks both the cell and its fill
08b2	keep the low two bits -- the partial-fill amount
08b4	stash the fill amount
08b5	drop the fill bits -- the six-bit cell selector
08b7	rotate the selector left twice into the cell index
08bb	double for the two-byte cell stride
08bc	the drain bar's base VRAM cell
08bf	HL now points at this step's bar cell
08c0	the full-bar tile
08c2	step it down by the fill amount -- 0x10, 0x0f, 0x0e, 0x0d
08c3	stamp the partial-fill tile into the cell
08c5	read the one-shot arm guard
08c8	test it
08c9	already armed -- the strip and payout already ran, return
08cb	mark it armed, so the strip draws and the bonus pays exactly once
08ce	the no-more-frogs VRAM column the bonus strip climbs
08d1	the 5-tile bonus strip in ROM
08d4	five tiles to copy up the column
08d6	blit the strip up the column
08d7	the leftover time-bonus figure -- printed next, then added to the score
08dd	print the bonus as two BCD digits, then fall through to bank it into the score
08e0	read the in-play flag
08e4	no game in play -- score nothing
08e5	which player is active (1 or 2)
08e9	player 1 takes its own score word
08eb	player 2's score word
08f0	player 1's score word
08f3	the delta's low byte
08f4	add it into the score's low byte
08f5	re-normalise the sum to packed BCD
08f7	keep the new low byte in DE for the compares
08f9	the delta's high byte
08fa	add with the decimal carry out of the low byte
08fd	DE now holds the new score
0902	player 2 takes its own award latch
0904	player 1's extra-life-awarded latch
0909	already awarded -- skip the bonus
090d	player 2's award latch
0912	already awarded -- skip the bonus
0914	the 20000-point extra-life threshold
0917	threshold minus the new score
0919	exactly at the threshold -- award it
091b	still short of it -- skip the bonus
091d	clear the expiry scratch byte (A is 0 here)
0921	latch the award so it fires only once this game
0922	walk BC back two bytes to the active player's time-remaining counter
0925	one more -- lengthens the time bar
0927	top of the HUD bonus column
092a	-0x20 -- one screen row up per step
092d	walk up one row
092e	one step per unit of the count
0931	stamp the bonus marker tile at the row reached
0933	the tile-update command
0935	queue it so the display flushes the stamped cell
0936	the running high score
0939	clear carry for the compare
093a	high score minus the new score
093c	high score still leads -- done
093d	the new score becomes the high score
0943	clear the life-restart hand-off at the top of the frame
0946	read the demo gate
094a	in the demo -- leave the timer-expiry flag standing
094d	clear the timer-expiry flag -- caught fresh each frame
0950	read the in-play flag -- also the player count
0954	not in a game -- bail to the attract/demo exit
0956	read the active player number
095a	player 2 -- point at its timer byte instead
095c	point at player 1's timer byte
0961	point at player 2's timer byte
0964	read the demo gate again
0968	in the demo -- don't move the clock
096a	one tick off the active player's clock
096b	time still on the clock -- skip the expiry flag
096f	clock ran out -- raise the timer-expiry flag
0972	render the frog and its object banner -- every in-play frame
0975	read the demo gate
0979	in the demo -- skip the status/home-marker column
097c	set the countdown-enable mirror to 1 -- transient, only lives across the blit
097f	point at the status-row VRAM base
0982	blit the four-tile status/home-marker column
0985	read the countdown-enable flag
0988	take its bit-complement for the mirror
098a	store it into the countdown-enable mirror -- this write survives the frame
098d	read the active player number
0991	player 2 -- stamp from the alternate home bank
0994	point at player 1's home-occupancy list
0997	stamp the home bays already filled this board
099a	read the player-start flag
099e	nothing to arm -- fall straight to the frog reset
09a0	load the active player's lane parameters
09a3	arm the frog's animation
09a7	clear the player-start flag so the arming runs once
09aa	point at the frog's object block
09ad	the frog's home starting column, mid-field
09b0	the up-facing rest sprite -- a frog sitting still
09b3	the colour/attribute byte for a live frog -- death later drives it to 7
09b6	the home starting row at the bottom of the field -- Y counts down as the frog climbs
09b9	clear the demo/frozen gate -- the fresh frog is live and interactive again
09bc	re-arm the one-shot display-field layout
09bf	release the sprite-object motion gate -- the lane objects move again
09c2	reset the row-progress high-water mark -- the new frog scores fresh from the bottom
09c5	the frog-ready value, also handed back to the caller in A
09c6	raise the frog-ready flag -- the frog is fully spawned
09ca	read the demo gate
09ce	pure attract -- return A=0 for the caller's board-layout gate
09cf	a demo frame -- keep the demo frog animating via the reset
09d2	point at player 2's home-occupancy list
09d5	stamp the home bays already filled this board
09d8	rejoin the shared exit
09dc	test bay 1's occupancy gate -- the active player's home-win-flag list, walked bay by bay
09dd	bay 1's home VRAM base -- the highest bay's slot address
09e0	bay 1 is won -- stamp the resting-frog quad into it
09e3	on to bay 2's gate
09e5	test bay 2's gate
09e6	bay 2's home VRAM base
09e9	bay 2 is won -- stamp it
09ee	test bay 3's gate
09ef	bay 3's home VRAM base
09f2	bay 3 is won -- stamp it
09f7	test bay 4's gate
09f8	bay 4's home VRAM base
09fb	bay 4 is won -- stamp it
0a00	test bay 5's gate
0a01	bay 5's home VRAM base -- the lowest bay's slot address
0a04	bay 5 empty: nothing more to draw, return -- otherwise fall straight into the stamp
0a05	aim HL at this bay's VRAM base
0a06	top-left tile: frog resting in home (108)
0a09	top-right tile (109)
0a0b	the step from the top-right cell down to the bottom-left, one tilemap row below
0a0e	drop to the row below
0a0f	bottom-left tile (110)
0a12	bottom-right tile (111)
0a15	quad stamped -- back to the caller
0a16	read the time byte -- doubles as the bar's disabled sentinel
0a19	0xFF turns to zero -- flags the no-bar sentinel
0a1a	sentinel set: no bar on this screen, draw nothing
0a1b	read the in-play flag
0a1e	test it
0a1f	in play: use the active player's own counter
0a21	not in play: the shared byte is the source
0a26	read which player is up
0a29	player 1? (1 decrements to zero)
0a2a	not player 1: take player 2's counter instead
0a2c	player 1's time-remaining count
0a31	player 2's time-remaining count
0a34	the bar length -- the remaining-time count
0a37	the bar-segment tile
0a39	step one screen row UP between segments
0a3c	the time column's base cell in VRAM
0a3f	zero count: skip the segments, straight to the cap
0a41	stamp a bar segment
0a43	one segment stamped per unit of time
0a45	the cap tile past the top -- also blanks the cell a shrinking bar just vacated
0a48	the life/level count -- how many life markers to draw
0a4b	point at the top cell of the lives/level column
0a4e	one tilemap row -- the step down the column after each marker
0a51	the visible cap is fifteen markers
0a53	under the cap -- draw the true count
0a55	at or over: clamp the drawn row to fifteen
0a57	the marker count -- one per remaining life
0a58	the life-marker tile
0a5a	stamp a life marker into this cell
0a5b	step down to the next row's cell
0a5c	one marker per life -- loop until the row is drawn
0a60	clear the score-field-seeded scratch flag
0a63	point at player 1's life count
0a66	read the active player number
0a69	1 for player 1 -- decrement to test that case
0a6a	player 1 -- leave the pointer on its cell
0a6c	player 2 -- step to its life cell
0a6d	one more life for the active player
0a6e	read the bumped count
0a6f	mirror it into the on-screen lives count
0a72	16 fills the lives row
0a74	row full -- done; the life is already counted
0a77	the top of the lives row in tile RAM
0a7a	count*32 -- one screen row lower per life
0a80	point at this life's slot in the row
0a81	stamp the frog lives-marker tile
0a84	five ranked slots to walk
0a86	start at the top slot's key-high byte
0a89	the new key's high byte
0a8a	against this slot's high byte
0a8b	new key ranks lower here -- drop to the next slot
0a8d	high bytes tie -- break it on the low bytes
0a8f	B still holds slots-remaining -- carry it into the rank math
0a90	the number of entries that must slide down
0a91	none below -- store without shifting
0a93	two bytes per entry -- into a byte count
0a98	destination: the bottom slot -- the loser falls off here
0a9b	source: the second-to-last slot
0a9e	slide the tail down one slot, opening the gap
0aa0	HL now addresses the freed slot
0aa2	drop the new key's high byte into the gap
0aa3	down to the slot's low byte
0aa4	and its low byte
0aa5	build the rank code -- four per rank the key beat
0aa6	the +1 that marks a real insertion
0aa8	down to this slot's low byte
0aa9	the slot's stored low byte
0aab	against the new key's low byte
0aac	new key wins the tie -- insert here
0aae	new key is lower -- move down a slot
0ab0	an exact duplicate -- the current scan depth
0ab1	zero means the bottom slot
0ab2	duplicate at the bottom -- reported as placed, nothing stored
0ab4	on to the next slot -- two bytes down
0ab6	more slots to check -- rescan
0ab8	off the bottom -- the key ranks below all five
0aba	read the once-per-board layout guard
0abd	test it
0abe	field already laid out this board -- bail
0ac0	latch it set so the body never re-runs this board
0ac3	the attribute that colours the bonus field's column
0ac5	the col-0x3f attribute shadow -- DMA'd each frame to the far-right colour column
0ac9	re-arm the one-shot bonus-strip so it can fire again this board
0acc	top of the field's tile column
0acf	the fixed four-tile strip in ROM
0ad2	four tiles
0ad4	blit the strip up the column
0ad5	start of the solid fill, one row below the strip
0ad8	one row down per step
0adb	fifteen rows of fill tile 12
0ade	stamp the fill tile
0ae0	on down the whole column
0ae2	the countdown seed -- sixty steps of thirty-two frames each
0ae5	the step pace and step count the countdown consumes
0ae8	the starting time-bonus, shown as 60
0aea	the displayed bonus the countdown drains toward zero
0af0	point at the ring's cursor cell at the base
0af3	step the cursor back one cell
0af4	still above the control cell -- keep this cursor
0af6	underflowed onto cell 0 -- wrap the cursor up to the top data cell 31
0af9	DE now points at the cursor's own cell
0afb	reach the fold partner a fixed 13 cells ahead
0afd	did the partner run off the end of the 32-cell ring?
0aff	inside the ring -- take the partner as-is
0b01	fold the partner back into the data cells -- lands in 1..31, never cell 0
0b03	point HL at the partner cell
0b04	read the cursor cell's byte
0b05	fold it into the partner by XOR
0b06	write the mixed byte back -- the ring evolves each draw
0b09	hand A back -- this frame's spawn random byte
0b0a	zero, reused to clear the three word cells below
0b0d	wipe player 1's running score
0b10	wipe player 2's running score
0b13	clear both extra-life-awarded latches -- re-arm the once-per-game award
0b16	read the configured starting time
0b1b	fill both players' time bars from it -- both begin full
0b1f	the "HI-SCORE" label strip in ROM
0b22	the HI-SCORE label column
0b25	the label is eight tiles
0b27	blit the label up the column
0b28	the HI-SCORE value column
0b2b	the current high score
0b2f	print it as a five-cell score field
0b32	the numeral "1" for the 1-UP column
0b34	the 1-UP digit cell
0b37	stamp the "1", stepping up to the "-UP" strip
0b3a	the shared "-UP" strip in ROM
0b3d	the "-UP" strip is three tiles
0b3f	blit "-UP" up the column
0b40	player 1's score column
0b43	player 1's score
0b47	print it as a five-cell score field
0b4a	the number of players
0b4e	one player -- no 2-UP column, done
0b4f	the numeral "2" for the 2-UP column
0b51	the 2-UP digit cell
0b54	stamp the "2", stepping up to the "-UP" strip
0b5c	blit "-UP" up the column
0b5d	player 2's score column
0b60	player 2's score
0b64	print it as a five-cell score field and return through it
0b67	read the one-time credit-column-clear latch
0b6a	test the latch
0b6b	already cleared once -- skip straight to the label
0b6e	latch it -- the column clear runs exactly once
0b71	point at the top cell of the credit column
0b74	the row step -- +0x20 walks one cell down the column
0b77	32 cells to clear (B), the blank tile 0x10 (C)
0b7a	stamp the blank tile into this cell
0b7b	step one cell down the column
0b7c	loop until the whole 32-cell column is blank
0b7e	the ROM "CREDIT" label strip
0b81	where the CREDIT label lands on screen
0b84	"CREDIT" is 6 tiles wide
0b86	blit the 6-tile label up the column via the shared copy
0b89	set the credit column's attribute
0b8c	where the two-digit count prints
0b8f	the running credit total, packed BCD
0b92	hand off to the BCD-byte printer -- stamps the count as two numerals
0b95	the score word's four decimal digits, most-significant first
0b98	the fixed ones-place zero every score field ends with -- scores are stored as value/10, so the units column always shows 0
0b99	stamp that trailing zero into the fifth cell, completing the five-digit readout
0b9b	the packed word's high byte -- its top two decimal digits, printed first
0b9c	prints that byte's two digits and steps the write pointer up two rows for the low byte
0b9f	the low byte -- the last two digits, printed by the fall-through into the two-digit routine
0ba0	stash the packed byte -- the rotate wrecks A, but its low nibble is still the ones digit
0ba4	bring the high digit down into the low nibble
0ba5	stamp the tens digit and step the pointer up one 32-cell row
0ba8	back to the whole byte -- the fall-through stamps its low nibble as the ones digit
0ba9	isolate the BCD digit -- it doubles as its own char-ROM glyph tile
0bab	stamp the digit into the tilemap cell
0bad	subtract 32 -- step the pointer up one row to the next digit along the readout
0bb0	no borrow -- the stepped-up pointer is ready, hand it back
0bb1	borrow into the high byte -- carry the 16-bit step
0bb3	point at the attract pacing gate
0bb6	tick the intro pacer down one -- drains toward the mode advance
0bb7	step back to the demo-phase counter
0bb9	zero the phase counter -- arms the advance condition
0bba	clear the start-latched flag -- re-arms START to break out of attract
0bbd	flood the page with the blank background tile
0bc2	seed the object work cell = 3
0bc5	point at the demo-object work block
0bc8	five cells to wipe
0bcb	zero this cell -- clears a parked demo object
0bcc	stride four cells to the next slot
0bd0	next of the five
0bd2	stamp each placed player's rank marker
0bd5	the header's VRAM column
0bd8	the SCORE RANKING header strip
0bdb	the header runs thirteen tiles
0bdd	blit the header up the column
0bde	start at rank 1
0be0	the rank-digit VRAM page
0be2	keep the rank number aside in I
0be4	two cells per rank row
0be5	offset to this rank's row in the digit column
0be8	the rank number is also the digit to draw
0bea	draw the rank numeral, pointer steps past it
0bed	the rank, tucked into the alternate A for later
0bf0	three-tile fixed strip beside the digit
0bf2	blit the strip up from the digit
0bf3	set the score work aside so the strip cursor survives
0bf4	point just below the high-score table
0bf8	rank sets the step count
0bf9	step two cells per rank
0bfb	lands on this rank's score word
0bfd	low byte of the packed-BCD score
0bff	high byte of the score
0c00	the score-field VRAM page
0c02	two cells per rank row
0c03	offset to this rank's row in the score column
0c06	draw the five-digit score, pointer steps past it
0c09	the four-tile " PTS" suffix
0c0c	the suffix runs four tiles
0c0e	blit " PTS" up from the score field
0c0f	recover the rank number
0c12	on to the next rank
0c13	past rank 5?
0c15	not yet -- draw the next row
0c17	the ROM tile run the final strip is copied from
0c1a	the VRAM column base the strip is painted up from
0c1d	fifteen tiles tall -- the blit's run length
0c20	clear the mode-3 strip-state cell so the next pass starts clean
0c23	blit the strip up the column -- the closing brushstroke on the score-ranking page
0c3d	the work-RAM page the two markers land in -- not a tilemap page
0c3f	both players' rank codes -- larger score's into C, smaller's into B
0c43	the row base 48 in D, the constant marker tile in E
0c46	stamp the higher score's marker -- its rank code picks the row, a zero code stamps nothing
0c49	the smaller score's rank code into C, then fall through to stamp its marker too
0c4a	the row base the rank code steps down from
0c4b	step down by the rank code to pick the target row
0c4c	the difference back against the base -- equal only when the code was zero
0c4d	empty rank slot -- stamp nothing, leave the cell alone
0c4e	the low byte of the destination -- the chosen row
0c4f	stamp the marker tile into that work-RAM cell
0c6d	the drawn/idle gate -- the phase counter is the byte just below it
0c70	down one to the phase counter
0c71	read the marquee phase counter
0c72	test it
0c73	still counting -- keep the value
0c75	drained -- reload 5 to restart the five-phase cycle
0c77	one phase down -- the value left is the phase painted this call, so calls cycle 4,3,2,1,0
0c78	the phase just selected
0c79	two bytes per jump-table entry
0c7a	base of the phase jump table
0c80	index this phase's entry
0c81	jump into this phase's arm
0c8a	the ATTR/Y value for all four sprite records
0c8c	record 0's ATTR/Y field
0c8f	record 1's ATTR/Y field
0c92	record 2's ATTR/Y field
0c95	record 3's ATTR/Y field
0c98	the CODE value for all four records -- the frog icons beside the point values
0c9a	record 0's CODE field
0c9d	record 1's CODE field
0ca0	record 2's CODE field
0ca3	record 3's CODE field
0ca6	the "10" point value -- packed BCD, one digit per nibble prints straight to screen
0ca8	the points-value column base
0cab	prints it as two digits, pointer left stepped two rows up
0cae	the " PTS" suffix strip
0cb3	blit the 4-tile " PTS" run up the column after the value
0cb4	the phase-4 column artwork
0cb9	fourteen more tiles up the same column
0cba	point at the drawn/idle gate
0cbd	mark it drawn (0x80) so the attract pacer advances
0cc0	the drawn/idle gate
0cc3	park it idle (0xC0) -- phase 0 painted nothing this cycle
0cc6	the phase-3 points-value column base
0cc9	the "50" point value
0ccb	prints it as two digits, pointer left stepped two rows up
0cce	the " PTS" suffix strip
0cd3	blit the 4-tile " PTS" run up the column after the value
0cd4	the phase-3 value column artwork
0cd9	ten more tiles up the same column
0cda	a shared strip source
0cdf	five more tiles, still climbing the column
0ce0	a separate second column base
0ce3	the phase-3 second-column artwork
0ce8	stamp a 19-tile strip up the second column
0ce9	into the shared drawn-tail
0ceb	the phase-2 points-value column base
0cee	the "1000" point value
0cf1	prints it as four digits up the column
0cf4	the " PTS" suffix strip
0cf9	blit the 4-tile " PTS" run up the column after the value
0cfa	the phase-2 value column artwork
0cff	ten more tiles up the same column
0d00	a shared strip source
0d05	six more tiles, still climbing the column
0d06	a separate second column base
0d09	the phase-2 second-column artwork
0d0e	stamp a 15-tile strip up the second column
0d0f	into the shared drawn-tail
0d11	the attract slideshow's frame-pacing gate
0d15	still counting down -- nothing to draw this frame
0d16	the current slide number
0d1b	mode 3 -- draw the SCORE RANKING board
0d1e	the on-screen credit total
0d22	a coin's credited -- lay the in-play board and start the game
0d25	back to the slide number
0d2a	mode 4 -- draw the POINT TABLE screen
0d2f	mode 2 -- draw the title / intro screen
0d34	not the coin/reset mode -- done for this frame
0d38	reseed the pacing gate -- restart the slideshow countdown
0d3a	step down to the slideshow sub-phase counter
0d3c	clear it for the next slide
0d3d	clear the object-animation scratch cell
0d40	the reset strip's ROM source
0d46	13 tiles tall
0d48	blit the reset strip up its VRAM column
0d49	tail into the shared final strip -- back to the top of the slideshow
0d4c	clear the active player's work RAM -- fires on every entry, ahead of the guard
0d4f	the once-per-board build guard
0d52	test the guard
0d53	already built -- skip the whole world-build
0d56	clear both players' difficulty/level indices
0d59	reset the animation-frame cursor to frame 0
0d5c	clear the two-player-start flag
0d5f	clear the per-board state byte
0d63	latch the guard -- this board's world-build never runs again
0d66	copy this level's lane-parameter block into the active slot
0d69	mark the frog active and clear its position cells
0d6c	fill the 28x32 playfield with the blank tile
0d6f	zero the live object/sprite blocks and mirror them into OBJRAM
0d74	seed the shared intro/anim counter to 4
0d79	seed the point-table sprite's attribute cell to 6
0d7c	the first board-HUD column in VRAM
0d82	four tiles
0d84	copy them up the column
0d85	the second HUD column
0d88	nudge only the source's low byte -- skip one tile, no carry into the high byte
0d89	twelve tiles
0d8c	draw the one-or-two-player prompt line
0d8f	the base column for the chained strips
0d95	three tiles
0d9b	six tiles
0da1	five tiles
0da4	step the source on by one -- a full 16-bit bump this time
0da5	seven tiles
0da8	where the extra-life target score prints
0dab	the extra-life threshold, a packed-BCD score word
0daf	print it as four digits plus a trailing zero, climbing the column
0db2	the ' PTS' suffix tiles
0db5	four tiles
0db7	copy the suffix above the score
0db9	read the banked credit count
0dbc	the shared tile source for both prompts' first column
0dbf	zero now means exactly one credit
0dc0	one credit only -- go paint the single-player line
0dc4	mark the two-player prompt up -- the one-credit arm skips this
0dc7	the VRAM column for the 'ONE OR TWO PLAYERS' line
0dca	four tiles for the first column
0dcc	stamp the first column up its VRAM column
0dcd	thirteen more tiles, resuming where the first stopped
0dcf	stamp the second column -- together they read 'ONE OR TWO PLAYER'
0dd0	cap it with the 'S' tile -> 'ONE OR TWO PLAYERS'
0dd3	the VRAM column for the 'ONE PLAYER ONLY' line
0dd6	four tiles for the first column -- still off the shared source
0dd8	stamp the first column up
0dd9	switch to the one-credit-only tile source
0ddc	eleven tiles for the second column
0dde	stamp the second column -- 'ONE PLAYER ONLY', no cursor cap
0de0	the scroll-state value re-asserted to both demo scroll cells every frame
0de2	re-arm the background animator's scroll state
0de5	and the demo scroll register -- keeps the river scrolling while dwelling
0de8	read the between-cells dwell counter
0deb	one frame off the dwell
0dec	store the ticked count
0def	still dwelling -- no cell placed this frame
0df0	dwell expired -- 32 frames of pause before the next cell
0df2	rearm the dwell
0df5	read the phase counter -- seven down to one, which cell to place
0df8	two table bytes per phase
0dfc	the per-phase jump table's base
0dff	index this phase's slot
0e00	branch into this phase's cell setup
0e0d	the tilemap corner for this phase's cell -- the far end of the row
0e13	base tile 212 for the 2x2 quad
0e17	the tilemap corner for this phase's cell
0e1d	base tile 216 for the 2x2 quad
0e21	the tilemap corner for this phase's cell
0e27	base tile 220 for the 2x2 quad
0e2b	the tilemap corner for this phase's cell
0e31	base tile 244 for the 2x2 quad
0e35	the tilemap corner for this phase's cell
0e3b	base tile 244 for the 2x2 quad
0e3f	the tilemap corner for this phase's cell
0e45	base tile 248 for the 2x2 quad
0e49	the tilemap corner for this phase's cell -- the base of the row
0e4f	base tile 216 for the 2x2 quad
0e51	the +31 that, once the column is stepped, drops to the row below
0e54	top-left tile of the 2x2 quad
0e57	top-right tile
0e59	drop down to the row below
0e5a	bottom-left tile
0e5d	bottom-right tile
0e5e	switch to this cell's object block
0e5f	four bytes to clear, zero fill held in C
0e62	zero one object byte
0e64	wipe the cell's stale animator sprite block
0e69	one cell placed -- step the phase counter down
0e6a	cells remain -- place the rest on later frames
0e6b	last cell down -- reload the phase counter to seven for the next demo run
0e6e	clear the sequencer phase byte -- restart the attract state machine
0e71	clear its companion cell alongside
0e74	the attract-idle mode number -- demo done, hold at the idle screen
0e76	force the top-level game-mode selector to attract-idle -- park the attract loop at the idle screen
0e7a	read the on-screen credit total (packed BCD)
0e7d	test it
0e7e	a coin is banked -- abandon the demo and park at the attract-idle screen
0e80	point at the demo stage number
0e83	read the stage
0e85	past the seed stage -- run the state machine
0e87	phase 0: paint the fake gameplay backdrop
0e8a	wipe any stale sprite/object blocks for a clean slate
0e8d	point at the first river-cell record (the fly/goal sprite block, reused in attract)
0e90	seven cells to lay out, 0x03 the fixed object attribute
0e93	0x81 the second position byte, 0x00 the starting X
0e96	cell +0 = 0x00 -- the X, scrolled in during phase 1
0e99	cell +2 = 0x03 -- the fixed object attribute
0e9b	cell +3 = 0x81 -- the second position byte, retracted in phase 2
0e9d	lay out all seven cells
0e9f	the frame-timer seed: 4 counts the first frame, 5 the initial frame cursor
0ea2	seed the attract frame clock
0ea5	point at the active-cell counter
0ea8	arm the animator with seven cells -- it walks 7 down to 1
0eaa	point at the per-cell dwell
0ead	32-frame dwell for the later per-cell stamp
0eaf	point at the demo stage number
0eb2	advance to the next stage
0eb4	peel phase 1 off the stage number
0eb5	not phase 1 -- try phases 2 and up
0eb7	phase 1: read the active-cell counter (1..7)
0eba	two bytes per jump-table entry
0ebe	base of the arm jump table -- it overlaps the ADD that follows
0ecf	counter 7's arm: the first cell record
0ed2	its X floor 0x31 -- where the cell comes to rest
0ed6	counter 6: the second cell record
0ed9	its X floor 0x49
0edd	counter 5: the third cell record
0ee0	its X floor 0x61
0ee4	counter 4: the fourth cell record
0ee7	its X floor 0x79
0eeb	counter 3: the fifth cell record
0eee	its X floor 0x91
0ef2	counter 2: the sixth cell record
0ef5	its X floor 0xa9
0ef9	counter 1: the seventh (last) cell record
0efc	its X floor 0xc1
0efe	tick the per-cell frame clock -- skips this cell while the frame is still held
0f01	keep this frame's tile
0f02	scroll the cell's X left...
0f05	...four pixels this frame
0f06	read the scrolled X
0f08	write this frame's tile
0f09	reached its resting floor yet?
0f0a	still right of the floor -- keep scrolling next frame
0f0b	at the floor -- clamp to the resting tile 0x1e
0f0d	point at the active-cell counter
0f10	retire this cell
0f11	cells remain -- next frame animates the next one
0f12	all seven in -- reload the counter to 20 for phase 2's rewind
0f14	advance to phase 2
0f16	peel phase 2 off the stage number
0f17	phase 3+ -- hand off to the per-cell board-demo painter
0f1a	phase 2: tick the per-cell frame clock -- skip while the frame is held
0f1d	the rewind tile: this frame's tile stepped back three
0f1f	keep the rewind tile
0f20	read the rewind step counter
0f24	rewind drained -- re-arm the animator, looping the demo motion
0f27	seven cells to retract
0f29	+6 stride from one cell's +3 byte to the next's
0f2c	the first cell's +3 (second position) byte
0f2f	retract this cell's second position...
0f32	...four back
0f35	write the rewind tile
0f36	advance to the next cell's +3
0f37	retract all seven cells
0f39	count off one rewind step
0f3a	store the rewind counter
0f3f	point at the frame-clock timer
0f42	tick one frame off the clock
0f43	not elapsed yet -- tell the caller to skip this cell
0f45	elapsed -- hold the next frame for 8 ticks
0f47	step to the frame cursor
0f48	advance the animation frame
0f49	not zero yet -- keep the new cursor
0f4b	wrapped -- reload the cursor to 4 for a four-frame cycle
0f4d	read the frame cursor
0f4e	base of the attract tile table
0f51	index it by the cursor -- low byte only, so the read stays on the table's page
0f53	fetch the current frame's tile
0f55	elapsed -- return with the fresh frame ready
0f56	discard the saved HL
0f57	discard the caller's return address
0f58	so the caller's scroll-and-draw is abandoned
0f59	the status-row column -- blanked first so the banner lands on a clean strip
0f5c	repaint it with the blank background, clearing the last round's HUD off the line
0f5f	the VRAM column the GAME OVER banner fills
0f62	the ROM 'GAME OVER' glyph run
0f65	nine glyph tiles -- the width of GAME OVER
0f67	run the string up the column, one tilemap row per glyph
0f69	read player 1's final score
0f6d	read player 2's final score
0f70	keep a copy of player 2's score, the compare will clobber HL
0f72	clear carry before the score compare
0f73	player 2's score minus player 1's -- borrow marks player 1 as the larger
0f75	player 1 is the larger -- rank it first, already sitting in DE
0f77	player 2 wins the ordering; stash player 1, the smaller, for its later turn
0f79	load player 2, the larger, to rank first
0f7c	player 1 won; stash player 2, the smaller, for its later turn
0f7d	file the larger score into the ranking table
0f80	recover the smaller score for its turn
0f81	save the larger's rank code
0f82	file the smaller score -- now against the table that already holds the larger
0f85	the smaller's rank code becomes the packed high byte
0f86	recover the larger's rank code
0f87	the larger's rank code becomes the packed low byte
0f88	store the packed rank-code pair for the ranking screen
0f8c	read the one-shot repaint trigger
0f8f	test it
0f90	clear -- nothing armed, return without painting a cell
0f91	point at the top cell of the VRAM column to paint
0f94	eight rows -- one full tile column
0f96	the fixed ROM tile-pair pattern to copy down
0f99	read this row's first pattern byte
0f9a	paint it into the column's left cell
0f9d	read the pair's second byte
0f9e	paint it into the cell beside it
0fa1	the remaining +0x1f -- with the byte step it makes a full +0x20 row stride
0fa5	step the destination down one framebuffer row
0fa8	back for the next of the eight rows
0fab	clear the trigger -- the blit fires once per arming, not every frame
0faf	the anim-index cell -- which render arm runs this frame
0fb2	base of the eleven-arm jump table
0fb5	clear the stray high byte -- only the low byte is the arm index
0fb7	two bytes per table entry
0fb8	index this arm's pointer in the table
0fb9	fetch the arm's address, low byte
0fbb	then its high byte
0fbd	enter the selected arm
0fd4	point at arm 0's parameter triple in the active lane block
0fd7	the column stride -- how far the destination steps between columns
0fd9	the row count -- tile-pairs copied down each column
0fdb	the column count -- how many columns this arm stamps
0fdc	arm 0's VRAM paint origin, from the ROM pointer table
0fdf	arm 0's tile-source base
0fe2	the plot cursor that stamps each column's sprite X into the lane object list
0fe6	the second cursor -- it bumps the list's leading count byte
0fea	park the column stride where the render loop rereads it each column
0fed	park the tile-source base so every column restarts its copy from it
0ff4	reconstruct the on-screen column this VRAM address sits in -- the tilemap is stored rotated
0ff7	read the plot-suppress flag -- set during the 2-player swap-in repaint
0ffa	test it
0ffb	flag set -- skip the object plot, straight to the tile copy
0ffd	the column index just computed, about to become a sprite X
0ffe	negate it -- a hardware sprite X is 256 minus the column
1000	drop the sprite X into the object list's next slot
1003	step the plot cursor to the next slot
1005	one more object in the list -- bump its count byte
100c	park the row count -- each column reloads it here
100f	read the first byte of this row's tile pair
1010	stamp it into the VRAM cell the player sees
1013	read the pair's second byte
1015	back to the row's left cell before stepping down
1017	one tilemap row is 0x20 cells wide
101a	drop the cursor straight down one screen row
101c	another row to copy -- around via the source step
101e	read the column stride to reach the next column
1022	the stride is a single byte -- clear the high half for the add
1024	advance the destination onto the next column's top cell
1025	one column drawn -- count it off
1026	columns remain -- reload and loop; the last one falls into the index advance
1029	point at the frog-animation index cell
102c	step the index on to the next arm
102d	read the bumped index back to test it
102e	compare against the arm count -- eleven arms, indices 0..10
1030	still below the count -- re-enter the dispatcher to draw the next arm
1033	the wrap value 0 -- every arm has been drawn this frame
1034	wrap the index back so the next frame's sweep restarts at arm 0
1038	step the source to the next tile pair
103c	reload the tile source from the arm's base -- every column restarts there
1040	reload the parked row count
1043	back into the row counter for the next column
1044	around again for the next column
1048	the settle count -- passes to burn while the hardware comes up
104b	read the watchdog port -- the read itself feeds the dog, the byte is thrown away
104e	one pass off the count -- the 16-bit decrement leaves the flags alone, so the zero test comes in two halves below
1050	test the count's high byte
1051	high half still nonzero -- back for another pass
1054	and the low byte
1055	low half still nonzero -- back for another pass
1057	settle done -- the watchdog was fed on every pass, memory untouched
1058	the guarded pre-blit -- repaints the dive column once, only while its trigger is armed (arm 1 alone)
105b	point at arm 1's three-byte render triple in the lane parameter block
105e	the stride byte -- doubles as the loop's between-column destination advance
1060	rows to copy per column
1062	columns this arm stamps -- the render loop's outer counter
1063	arm 1's VRAM destination base, fetched from its ROM pointer word
1066	the tile-source base every column restarts its row copy from
1069	point the first plot cursor at arm 1's lane object list -- the list the move resolver scans back
106d	the second plot cursor -- both start at that same list
1071	park the stride into the render loop's scratch cell
1074	park the tile source into the render loop's scratch pointer
1078	enter the shared tile-column render loop -- it tail-calls onward, so control never returns here
107b	point at arm 2's parameter triple in the active lane block
107e	the row-advance -- parked below as the inter-column step
1080	the tile-rows to copy down each column
1082	the column count -- 0 would run the full 256
1083	arm 2's VRAM destination -- where the loop starts stamping tiles
1086	arm 2's tile-source base in ROM
1089	aim the X-slot plot cursor at lane 5's object list
108d	aim the count-byte cursor at the same list
1091	park the column stride the loop reloads each column
1094	park the tile source every column restarts from
1098	hand off to the shared tile-column render loop
109b	point at arm 3's parameter triple in the per-life lane-difficulty block
109e	the between-column stride, first of the triple
10a0	the row count -- tile-pairs copied straight down each column
10a2	the column count -- columns this arm stamps (a count, so 0 wraps to 256)
10a3	arm 3's fixed VRAM destination base, from the per-arm ROM pointer table
10a6	arm 3's tile-source base
10a9	seed the plot cursor at arm 3's lane object list
10ad	and the count cursor at the same list -- this render also rewrites the object list the collision test reads back
10b1	publish the column stride -- the loop rereads it to step the destination between columns
10b4	publish the tile-source base -- every column restarts its row copy from here
10b8	hand off to the shared render loop -- its result is the arm's result
10bb	point at arm 4's parameter triple
10be	the column stride -- how far the destination advances between columns
10c0	the row count -- tile-pairs copied down each column
10c2	the column count -- how many columns this arm stamps
10c3	arm 4's VRAM paint origin -- where the loop starts stamping
10c6	arm 4's tile-source base -- where each column's row copy starts
10c9	seed one plot cursor to arm 4's lane object list
10cd	the second plot cursor, same list
10d1	stash the column stride where the loop rereads it each column
10d4	park the tile-source base so every column restarts its copy from it
10d8	hand off to the shared render loop -- it stamps every column then steps to the next arm
10f8	point HL at arm 6's parameter triple
10fb	the triple's stride byte -- the loop's per-column destination step
10fd	rows to copy per column
10ff	columns to draw -- 0 runs 256
1100	deref this ROM pointer -> arm 6's VRAM destination base
1103	arm 6's tile-source base in ROM
1106	the IX plot cursor -> lane 9's object list, the very list the collision resolver scans back
110a	the IY plot cursor -> the same lane-9 object list, bumped per column
110e	stash the stride where the render loop rereads it atop each column
1111	publish the tile source for the loop's per-column restart
1115	into the shared tile-column render loop
1118	point at arm 7's parameter triple in the lane-parameter table
111b	the between-column stride
111d	rows per column
111f	columns to stamp across
1120	arm 7's VRAM destination base, from its ROM pointer slot
1123	arm 7's tile-source base in ROM
1126	one plot cursor onto lane nibble 10's object list
112a	the other cursor onto the same list -- what the horizontal-move resolver scans for a blocker
112e	park the stride the render loop reloads at the top of each column
1131	park the tile source the loop restarts each column
1135	into the shared tile-column render loop -- control never comes back here
1138	point at arm 8's parameter triple in the active lane block
113b	the column-stride byte -- the destination's per-column advance
113d	rows per column -- tile-pairs copied straight down each column
113f	columns to paint -- the shared loop's outer counter
1140	arm 8's VRAM destination base, a per-arm ROM pointer word
1143	arm 8's ROM tile-source base
1146	the X-plot cursor -- arm 8's lane object list, the same list the move resolver scans
114a	the count-cursor onto that same object list
114e	seed the shared loop's column stride
1151	seed the shared loop's tile-source base so every column re-reads it
1155	into the shared tile-column copy loop -- it stamps the tiles then steps the anim-index to the next arm
1158	point at arm 9's parameter triple, packed near the tail of the lane-param block
115b	the column stride -- how far the destination steps between columns
115d	the row count -- tile-pairs copied straight down each column
115f	the column count -- how many columns this arm stamps
1160	arm 9's VRAM destination base
1163	arm 9's tile-source base
1166	plot cursor onto arm 9's lane object list -- writes each column's negated index as the sprite X
116a	second cursor onto the same list -- bumps its leading count byte
116e	park the stride where the shared loop rereads it each column
1171	park the source so every column restarts its row copy from the same base
1175	hand off to the shared column loop -- a tail jump, nothing here runs after
1178	point at arm 10's parameter triple -- the last three-byte slot in the lane parameter block
117b	the column stride -- how far the VRAM destination steps between columns
117d	the row count -- tile-rows copied down each column
117f	the column count -- columns to render, 0 wrapping to 256
1180	arm 10's fixed VRAM destination pointer
1183	arm 10's tile-source base in ROM
1186	arm 10's lane object list -- the plot cursor the move resolver later reads back
118a	the second plot cursor into the same list
118e	park the column stride where the shared loop reloads it each column
1191	park the tile source where the loop reloads it after each column
1195	hand the whole job to the shared tile-column render loop
1198	the VRAM base, subtracted next to turn the pointer into a tilemap offset
119b	HL becomes the tilemap offset -- the incoming borrow rides in
119e	B counts the six fold passes, C is the column accumulator, cleared to zero
11a1	keep only the three top bits of the offset's low byte -- the column-bearing bits, row bits dropped
11a5	test bit 2 of the offset's high byte -- the address bit folded this pass
11a7	bit clear -- skip the fold this pass
11aa	rotate the accumulator left, opening bit 0
11ac	fold a 1 into bit 0 -- deposit this column bit
11b0	just rotate the accumulator left, no bit deposited
11b2	rotate the column bits left, the exiting top bit into carry
11b4	shift the high byte left, feeding that carry in -- next pass probes the following bit
11b6	loop back through all six fold passes
11b8	three more rotates, no fold -- seat the assembled bits as the 0..31 column
11be	the column index comes back in register C
11bf	the demo/attract flag -- raised for the scripted demo frog
11c3	demo frog can't collide -- done
11c4	the move-already-resolved hold flag
11c8	frog already hit this frame -- one verdict per frame, done
11c9	point at the frog's row byte
11cd	stash the whole row -- its high nibble picks the lane
11ce	isolate the low nibble -- the frog's sub-row position
11d0	between lane rows?
11d2	sub-row >= 9: no lane here -- hand to the upper half
11d5	back to the whole row byte
11d6	isolate the high nibble -- names the lane
11d8	shift it down to a 0-15 lane index
11df	base of the 16-entry lane-arm address table
11e2	two bytes per entry
11e3	point at this lane's table slot
11e4	the arm address, low byte
11e6	...and its high byte
11e8	enter the chosen lane arm
12d0	the hit/held mark
12d2	raise the hold/kill flag -- stops any further lane scan this frame
12d5	read the frog's row
12da	road band (Y>=$80): flag the hold only -- leave the drown cell alone
12dd	top home-bay strip (Y<$30): flag the hold only -- leave the drown cell alone
12e0	raise the mid-river drown cell -- the death driver plays a water death
12e4	read the move-resolved latch
12e7	test it
12e8	the hop is already settled this frame -- leave the lanes alone
12ec	the frog's row
12ed	bias the row up by 15 onto its band boundary
12f0	the low nibble -- the sub-row within the band
12f4	sub-row below 5 -- no lane here, allow the move
12f8	keep the high nibble -- the lane selector
12fd	slide the high nibble down to a 0..15 lane index
1301	the base of the per-lane arm-pointer table
1304	two bytes per arm entry
1305	index this lane's arm
1306	the arm address, low byte
1308	its high byte
130a	jump into the selected lane's scan arm
132b	no lane in this band -- allow the move
1334	the first river lane's obstacle list
1337	its overlap-band width, 60 px
1339	into the shared band scan
133c	the next river lane's obstacle list
133f	its overlap band, 31 px
1344	the next river lane's obstacle list
1347	its overlap band, 92 px
134c	the next river lane's obstacle list
134f	its overlap band, 44 px
1354	the last river lane's obstacle list
1357	its overlap band, 47 px
135c	no lane -- the river/road gap, allow the move
1364	the first road lane's obstacle list
1367	its overlap band, 34 px
136c	the next road lane's obstacle list
136f	its overlap band, 18 px
1374	the next road lane's obstacle list
137c	the next road lane's obstacle list
1384	the last road lane's obstacle list
138c	no lane in this band -- allow the move
138f	read the window-offset selector
1394	selector under 128 -- take the wider 12-px offset
1397	the frog's X
139a	offset the window's left edge in by 3 px, onto the frog's body
139c	the window's low edge
139d	add the band width to reach the high edge
139f	the lane's obstacle count -- the scan trip count
13a0	the window overflowed past 0xFF -- use the split-interval scan
13a3	step to the next obstacle X
13a4	this obstacle's X
13a6	left of the window -- a miss, try the next obstacle
13aa	at or past the high edge -- a miss, try the next
13ad	an obstacle overlaps the hop -- read the frog's row
13b0	the road/river divide
13b2	river -- the obstacle is a log, ride it and leave the frog moving
13b5	road -- the obstacle is a car, latch the hold flag and stop the hop
13b9	the frog's X
13bc	offset the window's left edge in by 12 px, onto the frog's body
13be	into the window build
13c1	step to the next obstacle X
13c4	at or above the low edge -- inside the wrapped window, a hit
13c8	above the high edge too -- a miss, try the next
13cb	an obstacle overlaps the hop -- read the frog's row
13ce	the road/river divide
13d0	river -- the obstacle is a log, ride it
13d3	road -- the obstacle is a car, latch the hold flag and stop the hop
13d7	more obstacles -- keep scanning
13d9	lane scanned clear -- read the frog's row
13dc	the road/river divide
13de	river -- a clear lane is open water, drown the frog
13e1	return -- the move stands (no lane, or a clear road)
13e2	more obstacles -- keep scanning the wrapped window
13e4	lane scanned clear -- read the frog's row
13e7	the road/river divide
13e9	river -- a clear lane is open water, drown the frog
13ec	road -- a clear lane is safe, the move stands
14b7	read the walk index -- which lane object gets moved this turn
14ba	base of the eleven-entry object-handler table
14bf	two bytes per table entry
14c1	point at this object's table slot
14c2	fetch its handler address, low byte
14c4	then the high byte
14c6	jump into this object's mover setup
14dd	object 0's lane control byte -- low nibble speed, bit4 sub-rate
14e0	its sprite run -- length byte then the run of sprite Xs
14e3	its lead sprite X, mirrored at +0/+2
14e7	its phase countdown
14eb	rightward mover
14ee	object 1's lane control byte
14fc	leftward mover
14ff	object 2's lane control byte
1509	rightward mover
1510	object 3's lane control byte
151e	rightward mover
1521	object 4's lane control byte
152f	leftward mover
1532	object 5 is a spacer -- no sprites to move, just advance the walk
1543	object 6's lane control byte
1551	leftward mover
1554	object 7's lane control byte
1562	rightward mover
1565	object 8's lane control byte
156f	leftward mover
1576	object 9's lane control byte
1584	rightward mover
1587	object 10's lane control byte
1595	leftward mover
1598	read this object's phase countdown
159c	is a countdown already running?
159d	already counting -- hand to the throttle to tick it down
15a0	read the lane control byte
15a2	isolate the low-nibble pixel speed
15a4	the shift amount
15a6	test the sub-rate flag (bit4)
15a8	set -- throttle instead of a full step, seeding the countdown from the speed
15ab	the sprite run's length byte
15ac	loop count -- 0 means a full 256
15ae	read a sprite X
15af	nudge it right by the speed
15b0	write it back
15b1	next sprite in the run
15b3	the lead sprite's X
15b6	shift it right too
15b7	store it
15ba	and its mirror cell
15bd	read the frog's row
15c0	below the lane band?
15c2	above the road -- nothing to carry, advance the walk
15c8	past the bottom of the band?
15ca	below the lanes -- no carry
15ce	the row's low nibble -- where the frog sits against the cell edges
15d2	on the low edge -- try the low-edge carry
15d7	on the high edge -- carry into the next column
15da	clear this object's phase countdown
15de	the walk index
15e1	step to the next lane object
15e3	past the last of the eleven?
15e5	no -- loop on to the next object
15e8	yes -- wrap the index back to object 0 for next frame
15eb	the saved frog row
15ec	its high-nibble band offset
15f0	measure it from the top of the band
15f2	swap nibbles for the object column the frog sits in
15f7	the object being moved
15fb	the frog isn't on THIS object -- no carry
15fe	the frog's row
1603	above the band -- not really riding -- no carry
1606	the frog's X
1609	ride it right by the object's speed
160a	store the carried X
160f	carried off the left edge -- lost
1614	still on-screen -- done
1619	raise the lost-frog flag -- the ride carried it off-screen
161f	the saved frog row
1620	its band offset
1622	bump to the next column down
1626	measure from the top of the band
1628	swap nibbles for the object column
162d	the object being moved
1631	not this object -- no carry
1634	the frog's X
1637	carry it right into the next column
1638	store it
163e	read this object's phase countdown
1642	already counting down?
1643	hand to the throttle to tick it down
1646	read the lane control byte
1648	isolate the low-nibble pixel speed
164a	the shift amount
164c	test the sub-rate flag (bit4)
164e	set -- throttle instead, seeding the countdown from the speed
1651	the sprite run's length byte
1652	loop count -- 0 means a full 256
1654	read a sprite X
1655	nudge it left by the speed
1656	write it back
1657	next sprite in the run
1659	the lead sprite's X
165c	shift it left too
165d	store it
1660	and its mirror cell
1663	read the frog's row
1666	past the bottom of the band?
1668	below the lanes -- no carry
166c	the row's low nibble -- position against the cell edges
1670	on the low edge -- try the low-edge carry
1675	on the high edge -- carry into the next column
1678	clear this object's phase countdown
167c	the walk index
167f	step to the next lane object
1681	past the last of the eleven?
1683	no -- loop on to the next object
1686	yes -- wrap back to object 0 for next frame
1689	the saved frog row
168a	its band offset
168e	measure from the top of the band
1690	swap nibbles for the object column
1695	the object being moved
1699	not this object -- no carry
169c	the frog's X
169f	ride it left by the object's speed
16a0	store the carried X
16a5	carried off the left edge -- lost
16aa	still on-screen -- done
16af	raise the lost-frog flag -- carried off-screen
16b5	the saved frog row
16b6	its band offset
16b8	bump to the next column down
16bc	measure from the top of the band
16be	swap nibbles for the object column
16c3	the object being moved
16c7	not this object -- no carry
16ca	the frog's X
16cd	carry it left into the next column
16ce	store it
16d4	the running countdown
16d5	is this the final tick?
16d7	no -- the lane holds still this frame
16da	final tick -- release a single one-pixel step
16dc	into the shift with speed 1
16df	one frame off the countdown
16e0	store it -- the lane stays put this frame
16e6	the running countdown
16e7	is this the final tick?
16e9	no -- the lane holds still this frame
16ec	final tick -- release a single one-pixel step
16ee	into the leftward shift with speed 1
16f1	one frame off the countdown
16f2	store it -- the lane stays put this frame
16f8	read the frog's hold/kill flag
16fb	test it
16fc	clear -- an idle frog returns at once, no death to drive
16fd	read the diver figure's anim-step gate
1700	is a diver figure mid-animation this frame
1702	no -- skip the blit one-shot
1706	fire the frog-anim blit one-shot for this frame
1709	read the bay a creature is surfacing in
170c	any creature surfacing
170d	none -- skip the republish
170f	republish it as the bay slot to erase
1712	erase the creature tile from that bay
1715	clear any collision latched by the kill
1718	read the death-frame dwell counter
171b	one more frame held on this death sprite
171f	reached the 16-frame dwell?
1721	not yet -- keep holding this sprite
1722	dwell elapsed -- reset the counter to 0
1727	re-assert the frog object's attribute byte
172a	point HL just below the frog sprite-code cell
172d	read the death-phase index
1730	advance to the next death phase
1735	read the mid-river drown flag
1738	drowning?
1739	set -- run the shorter drown sequence
173d	phase 6 -- the squash sequence's terminal reset?
173f	not yet -- stamp this phase's death sprite
1741	bring the frog back for the next life
1745	clear the death-phase index
1748	drop the hold flag -- the frog takes input again
174b	zero the dwell counter
174e	reset the row-progress high-water mark
1751	clear the mid-river drown flag
1754	point at the hop-direction state block
175a	eleven bytes -- every hop direction's flags and counters
175e	clear the block so the next life starts every hop from rest
1761	arm the next-life restart flag
1764	read the game mode
1767	attract mode?
1768	a coined game -- done, just begin the next life
176a	read the play flag
176d	still no credited game?
176e	a game is running -- done
1770	drop back to attract mode
1773	reset the demo hop-dwell
1776	reset the demo board-state byte
1779	clear the 2-player start flag -- the scripted demo restarts clean
177e	phase 5 -- the drown sequence's terminal reset?
1780	not yet -- stamp this drown frame
1782	the drown ending -- run the shared reset
1785	which sequence -- read the drown flag again
1788	drowning?
1789	yes -- stamp a drown sprite
178c	point at the frog sprite-code cell
178d	read the death phase
1791	first squash frame
1794	second squash frame
1797	third squash frame
179a	fourth squash frame
179c	otherwise the final squash frame
179e	stamp the first squash sprite
17a3	zero the sound-sequence countdown
17a6	queue sound command 0
17a7	the road-death jingle id
17a9	fire the squash jingle
17ab	hold the squash sprite
17ae	next squash frame
17b1	next squash frame
17b4	the common end-of-death sprite
17b7	clear the countdown-expiry flag
17ba	clear the two-player frame cells
17c0	reload the sound-sequence countdown to pause before the next life
17c4	point at the frog sprite-code cell
17c5	read the death phase
17c9	first drown frame
17cc	second drown frame
17cf	third drown frame
17d1	otherwise the final drown frame
17d3	stamp the first drown sprite
17d8	zero the sound-sequence countdown
17db	queue sound command 0
17dc	the drown jingle id
17de	fire the drown jingle
17e0	next drown frame
17e3	next drown frame
17e6	the common end-of-death sprite
17e9	clear the countdown-expiry flag
17ec	reset the scroll stamp phase
17ef	clear the scroll edge flag
17f2	reset the scroll stamp row-count
17f5	reset the scroll band row-span
17f8	clear the two-player frame cells
17fe	reload the sound-sequence countdown to pause before the next life
1802	read the first sprite-frame busy latch
1806	held by another owner -- leave the buffer untouched
1807	the second busy latch
180b	still held -- yield without stepping
180c	the frame countdown
1810	still running -- go tick it down
1813	index is 8-bit -- zero the high byte
1814	the current frame index
1818	base of the frame-source pointer table
181b	double it -- two bytes per table entry
181c	point at this frame's table entry
1820	assemble the frame's source address
1821	hold the source in DE for the copy
1822	point back at the frame index
1825	advance to the next frame
1826	read the advanced index
1828	reload the countdown to 21
182a	reached the tenth frame? -- test for wrap
182c	not the wrap -- go copy the new frame in
1830	wrap the ring back to frame 0
1831	wrapped -- nothing copied this pass
1952	the top of the first frog tile-column in VRAM
1955	five frog-tile columns to copy
1957	point at the 4-tile group -- reloaded at the top of every column
195a	four tiles down this column
195c	read the next group tile
195d	stamp it into the VRAM column
1960	one screen row (0x20) down
1965	next tile down the column
1967	the gap on to the next column's top
196c	more columns to fill
196f	the top of the second frog tile-column block
1972	four columns this pass
1974	point at the second 4-tile group
1977	four tiles down this column
1979	read the next group tile
197a	stamp it into the VRAM column
1980	one screen row down
1982	next tile down the column
1984	the gap on to the next column's top
1989	more columns to fill
198c	the top of the third frog tile-column block
198f	four columns this pass
1991	point at the third 4-tile group
1994	four tiles down this column
1996	read the next group tile
1997	stamp it into the VRAM column
199a	one screen row down
199f	next tile down the column
19a1	the gap on to the next column's top
19a6	more columns to fill
19a9	the top of the side-banner column
19ac	four banner pairs to stamp
19ae	stamp the banner tile
19b0	one screen row down
19b4	stamp the banner tile again, one row below
19b6	five rows on to the next pair
19ba	next banner pair
19bc	the goal box's top-left corner
19bf	stamp the top-left corner tile
19c2	stamp the top-right corner tile
19c4	the span down to the box's bottom corners
19c8	stamp the bottom-left corner tile
19cb	stamp the bottom-right corner tile
19cd	point at the home-marker column
19d0	paint the home-marker strip down the column
19d3	the first object-ready flag
19d6	the mark that arms each object-ready flag
19d8	flag object 0 ready -- also the sprite-shadow DMA lead byte
19da	step past to object-ready flag 1
19db	flag object 1 ready
19dd	step past to object-ready flag 2
19de	flag object 2 ready
19df	tail-jump into seeding the objects' animation counters -- never returns here
19e2	fourteen 2x2 pairs down the column
19e4	the pair's top-left tile
19e7	its top-right tile, beside it
19e9	down a row and back a column -- lands on the bottom-left cell
19ed	the pair's bottom-left tile
19f0	its bottom-right tile, beside it
19f3	on to the next pair down
1a02	the starting phase for the first pair of lane objects
1a04	seed the first of them
1a0a	phase 4 for the next pair
1a0c	seed one of the pair
1a12	phase 7 for the next pair
1a14	seed one of the pair
1a1a	phase 6 -- shared by the block's first and last pairs
1a1c	the block's very first object
1a22	and its last pair, back at phase 6
1a28	phase 5 again -- now for the second object block
1a2a	ten objects in that block
1a2c	point at the second block's base
1a2f	seed this object at phase 5
1a31	step two bytes to the next object -- the byte between is left alone
1a32	walk all ten
1a34	back in the first block -- more objects at phase 5
1a3a	and another phase-5 pair
1a40	phase 2 -- the slow-starting objects
1a42	override the second block's opening cells to phase 2
1a48	more of that block dropped to phase 2
1a4e	and the last of the phase-2 overrides
1a55	read the in-play / player-count flag
1a59	not in a game -- skip the whole collision/creature body straight to the shared exit
1a5b	frog-vs-diver box test -- ride the surfacing diver or die
1a5e	advance the diver figure's 2x2 tile animation
1a61	the dive-animation driver -- paints the descending column
1a64	the tongue / fly-eat collision state machine
1a67	queue the lane-scroll sound when a lane wraps
1a6a	read the goal-sprite timing arm
1a6e	only while armed, tick the goal-sprite timer down
1a71	step the home-bay slot cursor -- which bay the empty-bay creature draws into
1a74	read the level / life count
1a77	its low bit picks the empty-bay creature -- gator or fly
1a79	bit clear -- take the gator path
1a7c	the free-running frame counter that drives the fly arm
1a7f	one more frame
1a83	did it just wrap to 0?
1a84	on the wrap, stamp the fly-bonus tiles into the cursor's bay
1a8a	reached the fly-erase mark?
1a8c	erase the fly back to the empty home tile
1a8f	read the frog's Y / row
1a92	is the frog up in the home-bay region?
1a94	on the top home row -- hand to the goal-bay dispatcher
1a9b	play ended mid-frame -- nothing to scan, return
1a9c	scan the joystick and dispatch a hop
1a9f	one less frame on the goal-sprite timer
1aa3	reached the fire mark, one frame before it disarms at 0?
1aa6	tear down the finished celebration -- zero the floating-score record
1aa9	and zero the goal-sprite descriptor
1aad	the same frame counter, gator path
1ab0	one more frame
1ab4	did it just wrap to 0?
1ab5	on the wrap, stamp the just-surfacing gator
1abb	reached the fully-surfaced mark?
1abd	promote it to the fully-surfaced gator
1ac3	reached the erase mark?
1ac5	erase the gator back to the empty home tile
1ac8	into the shared exit
1acb	read the gated-countdown lockout flag
1ace	test it
1acf	a countdown phase is running -- freeze the frog, bail
1ad0	read the hop-input hold-off timer
1ad4	drained -- input is live this frame
1ad6	tick one frame off the input lock
1ada	step the home-bay slot cursor while input stays locked
1add	still locked -- done for the frame
1ade	read the hit/hold flag
1ae2	the frog is held or dead -- take no input
1ae3	point HL at the frog's X cursor
1ae6	and DE at the frog's Y cursor
1aec	test the cocktail-cabinet bit
1aee	upright or single-player -- use player 1's stick
1af0	read the active player
1af3	is it player 1?
1af4	player 2 is up -- route to its wiring
1af7	read player 1's main port (IN0)
1afa	keep the horizontal stick in C for the RIGHT/LEFT tests
1afb	read the down-hop-active flag
1aff	a down-hop is mid-flight -- advance it and return
1b07	1P -- take DOWN from IN2 bit 6
1b0d	player 2 -- its DOWN is on IN2 bit 0
1b13	player 1's DOWN, IN2 bit 6
1b15	DOWN pressed (active-low) -- begin a down-hop
1b19	DOWN idle -- clear its arrival latch
1b1f	read the up-hop-active flag
1b23	an up-hop is mid-flight -- advance it and return
1b26	read the right-hop-active flag
1b2a	read the left-hop-active flag
1b2d	sum the two horizontal-hop flags
1b2e	a left/right hop is in flight -- UP can't start, skip to RIGHT
1b35	1P -- take UP from IN2 bit 4
1b3b	player 2 -- its UP crosses to IN0 bit 0
1b41	player 1's UP, IN2 bit 4
1b43	UP pressed -- begin an up-hop
1b47	UP idle -- clear its arrival latch
1b4d	read the right-hop-active flag
1b51	a right-hop is mid-flight -- advance it and return
1b54	RIGHT, bit 4 of the horizontal stick
1b56	RIGHT pressed -- begin a right-hop
1b5a	RIGHT idle -- clear its arrival latch
1b60	read the left-hop-active flag
1b64	a left-hop is mid-flight -- advance it and return
1b67	LEFT, bit 5 of the horizontal stick
1b69	LEFT pressed -- begin a left-hop
1b6d	LEFT idle -- clear its arrival latch
1b73	no direction acted -- done for the frame
1b74	read player 2's main port (IN1)
1b78	rejoin the shared direction scan
1b7e	player 2's DOWN, IN2 bit 0
1b80	rejoin the DOWN press test
1b86	player 2's UP, IN0 bit 0
1b88	rejoin the UP press test
1b8b	read the frog's Y position
1b8e	the bottom edge -- a down-hop past here isn't allowed
1b90	already at the bottom -- no down-hop
1b91	the down-hop animation counter
1b94	test it -- nonzero means a down-hop is already in flight
1b95	hop already running -- skip the fresh-press chirp and sprite
1b97	the hop chirp command
1b99	queue the hop chirp
1b9a	point at the frog's sprite code
1b9b	read the current frog sprite
1b9d	the down rest sprite -- is the frog already sitting in the down pose?
1b9f	already at rest -- re-prime and advance, skip the counter bump
1ba2	the down rest sprite code
1ba4	so the hop starts visibly from rest
1baa	bump the counter -- only a wrap past 0xFF bails
1bae	did the bump wrap to zero?
1baf	wrapped -- bail with the counter left at zero
1bb4	the down-hop reload length
1bb7	prime the counter, then fall into the advance -- the hop animates that many frames
1bba	read the down-hop arrival latch
1bbd	test it
1bbe	hop already landed -- return without moving, so one press is one hop
1bc0	raise the down-hop active flag -- a hop is now in flight
1bc3	the down-hop animation counter -- frames left in this hop
1bc6	tick one frame off the hop
1bca	still mid-hop -- go step the frog down this frame
1bcd	drained: clear the active flag
1bd1	set the arrival latch -- the hop has landed
1bd4	point at the frog sprite code
1bd5	stamp the down rest sprite -- frog sits still on its new tile
1bd8	swap to the frog-Y pointer
1bd9	the vertical hop step
1bdc	add it to the frog's Y
1bdd	nudge the frog down one step -- down is increasing Y
1be2	stamp the down moving sprite -- frog mid-hop
1be4	read the up-hop animation counter -- zero means no up-hop is yet in flight
1be7	a genuinely fresh press?
1be8	a hop's already running -- skip the fresh-start chirp and sprite, jump to the counter bump
1bea	the hop chirp -- sound command 0x04
1bec	enqueue it, announcing the fresh hop
1bee	read the frog's current sprite pose
1bf0	already showing the up rest pose?
1bf2	already at rest -- skip the sprite stamp and go straight to re-priming the counter
1bf5	the up rest pose
1bf7	stamp it so the hop visibly starts from rest
1c01	did the counter bump wrap 0xFF->0?
1c02	counter was already maxed -- bail, leaving it at zero
1c07	the up-hop animation length (=9)
1c0a	prime the counter -- then fall into the up-advance to take the hop's first frame
1c0d	step the home-bay slot cursor one frame -- its result is discarded here
1c10	read the up-hop arrival latch
1c13	test it
1c14	already arrived this press -- leave the frog put, one hop per press
1c16	raise the up-hop active flag -- a hop is now stepping
1c19	read the hop's animation counter
1c1c	tick one frame off the hop
1c1d	store the counter back
1c20	still counting -- go step the frog up a notch
1c23	drained: clear the active flag, the hop has landed
1c27	latch arrival -- block re-entry until the stick is released
1c2b	stamp the up rest sprite -- the frog sits on its new tile
1c2e	score the row -- only a forward hop reaches a new furthest row
1c33	aim at the frog's Y
1c34	read the vertical hop step
1c39	subtract one step -- up is decreasing Y
1c3d	the up moving sprite
1c3f	show the frog mid-hop
1c41	read the frog's Y
1c44	compare against the field top
1c46	frog above the field top -- no hop
1c47	read the frog's X
1c4a	compare against the right edge
1c4c	frog at the right edge -- no right-hop
1c4d	read the right-hop animation counter
1c50	test it
1c51	a hop is already in flight -- skip the fresh-press start
1c53	the hop-start chirp command
1c55	queue the hop sound
1c57	read the frog's current sprite code
1c59	test for the right rest sprite
1c5b	already at the right rest sprite -- re-prime and advance, skip the counter bump
1c5e	the right-facing rest sprite
1c60	stamp the rest sprite in -- the hop starts from a sitting frog
1c63	re-read the animation counter
1c66	bump the counter
1c67	store the bumped counter
1c6a	test the bumped counter for a wrap to zero
1c6b	the bump wrapped -- bail with the counter left at zero
1c70	the right-hop reload length (=9)
1c73	prime the counter -- the hop animates that many frames, then continues into the advance
1c76	read the right-hop arrival latch
1c79	test it
1c7a	already arrived -- one hop per press, so bail
1c7c	raise the right-hop active flag
1c7f	read the right-hop animation counter
1c82	tick one frame off the hop
1c86	still mid-hop -- go step the frog right
1c89	counter drained -- clear the active flag
1c8d	set the arrival latch -- the hop has landed
1c90	point at the frog sprite code
1c91	stamp the sitting-still frog
1c94	read the horizontal hop step
1c99	step the frog right by the hop delta
1c9c	the moving-frog sprite code
1c9e	stamp it -- the frog shows mid-hop
1ca0	read the frog's Y
1ca3	against the top of the play field
1ca5	frog above the field top -- no hop
1ca6	read the frog's X
1ca9	against the left-edge column
1cab	frog past the left edge -- no left-hop
1cac	read the left-hop animation counter
1caf	is a left hop already in flight?
1cb0	already hopping -- skip the fresh-press start
1cb2	the hop-start chirp
1cb4	drop it on the sound queue
1cb6	read the frog's current sprite pose
1cb8	against the left-facing rest pose
1cba	already sitting in left rest -- re-prime and advance, no bump
1cbd	the left-facing rest pose
1cbf	show the frog sitting -- the hop starts from rest
1cc2	reread the left-hop counter
1cc5	bump it
1cc6	store the bumped count
1cc9	did that bump wrap 0xff->0?
1cca	wrapped -- bail, no hop this press
1ccc	clear it before the reload
1ccf	the left-hop's frame length
1cd2	prime the counter -- then fall into the left advance
1cd5	read the left-hop arrival latch
1cd8	test it
1cd9	this hop already landed -- one hop per press, hold the frog put
1cdb	raise the left-hop active flag -- a hop is now in flight
1cde	read the hop's frame counter
1ce1	tick one frame off the hop
1ce5	still counting -- go step the frog left
1ce8	counter drained -- clear the active flag, the hop has landed
1cec	latch arrival -- this press is spent
1cf0	stamp the resting frog sprite -- the hop is done
1cf3	read the per-frame hop step
1cf7	read the frog's X
1cf8	step the frog left by one hop step
1cfd	stamp the mid-hop moving frog sprite
1cff	the frog's horizontal position -- the whole input to the dispatch
1d02	bay 1's low column edge
1d04	left of the first bay, over no column
1d07	bay 1's high column edge
1d09	exactly on bay 1's high edge
1d0c	within bay 1's band
1d11	in the gap just past bay 1
1d1c	bay 2's low column edge
1d1e	still below bay 2's band
1d21	bay 2's high column edge
1d23	exactly on bay 2's high edge
1d26	within bay 2's band
1d2b	in the gap just past bay 2
1d36	bay 3's low column edge
1d38	still below bay 3's band
1d3b	bay 3's high column edge
1d3d	exactly on bay 3's high edge
1d40	within bay 3's band
1d45	in the gap just past bay 3
1d50	bay 4's low column edge
1d52	still below bay 4's band
1d55	bay 4's high column edge
1d57	exactly on bay 4's high edge
1d5a	within bay 4's band
1d5f	in the gap just past bay 4
1d6a	bay 5's low column edge
1d6c	still below bay 5's band
1d6f	bay 5's high column edge
1d71	exactly on bay 5's high edge
1d74	within bay 5's band -- any higher X falls through to the reject handler
1d77	read the frog's row -- stored top-down, so a smaller value is higher up
1d7a	against the fully-home line at row 0x2a
1d7c	not fully home yet -- back to the input scan and keep hopping
1d81	raise the hold flag -- reached the top over no bay, the frog is lost
1d84	either way, on to the input scan -- the flag just raised locks it through the death sequence
1d87	read the active player
1d8b	not player 1: take this bay's gate from the alternate bank
1d8d	player 1: read this bay's occupancy gate in the primary bank
1d91	bay already won -- nothing to award
1d92	read the frog's Y
1d95	compare against the home-row line
1d97	frog not fully onto the home row yet -- hand off to the per-frame input scan
1d9a	this bay's on-screen Y -- fly-bonus popup and goal-sprite position
1d9c	read which bay is currently showing the fly
1d9f	match it against this bay's key (bay 1)
1da1	frog landed on the bay showing the fly -- pay the fly bonus
1da4	this bay's home-tile VRAM base
1da7	stamp the 2x2 frog-in-home tiles and reset the frog for its next trip
1daa	read the latched-collision sub-flag
1dae	no latched collision -- skip the celebration sprite
1db2	arm the goal-celebration sprite at this bay
1db6	clear the collision latch so it can't carry into the next frog
1db9	read the active player again
1dbd	not player 1: mark the win in the alternate bank
1dc1	flip this bay's occupancy gate to won in the primary bank
1dc4	point at player 1's filled-bay count
1dc7	one more bay filled -- at five the board completes
1dc9	player 2: read this bay's occupancy gate in the alternate bank
1dcc	rejoin the shared body
1dd0	flip this bay's occupancy gate to won in the alternate bank
1dd3	point at player 2's filled-bay count
1dd6	one more bay filled for player 2
1dd8	read the active player
1ddb	test for player 1
1ddc	not player 1 -- read the alternate-bank gate instead
1dde	player 1 -- read this bay's primary occupancy gate
1de1	test the won/empty gate
1de2	bay already won -- nothing to award
1de3	read the frog's Y
1de6	compare against the home-row line
1de8	still short of the home row -- hand off to the input scan so the frog keeps hopping
1deb	this bay's on-screen Y for the bonus popup
1ded	read which bay is showing the fly
1df0	test against this bay's fly key
1df2	it matches -- pay the fly bonus at that popup position
1df5	point at this bay's home-tile cells
1df8	stamp the frog-in-home tiles and reset the frog for its next trip
1dfb	read the latched-collision sub-flag
1dfe	test it
1dff	no latched collision -- skip the celebration sprite
1e01	this bay's Y for the goal-celebration sprite
1e03	arm the goal-celebration sprite
1e07	clear the latch so it doesn't carry into the next frog
1e0a	read the active player again -- which bank to mark won
1e0d	test for player 1
1e0e	not player 1 -- mark the alternate bank instead
1e10	the won marker
1e12	flip this bay's primary gate to won
1e15	point at player 1's home count
1e18	one more bay filled -- at five the board is complete
1e1a	read this bay's alternate-bank occupancy gate
1e1d	rejoin the shared won/empty test
1e1f	the won marker
1e21	flip this bay's alternate gate to won
1e24	point at player 2's home count
1e27	one more bay filled for player 2
1e29	which player is up
1e2c	player 1 leaves zero
1e2d	player 2 -- read the alternate-bank gate instead
1e2f	player 1: bay 3's occupancy gate
1e32	test the gate
1e33	bay already won -- nothing to award
1e34	the frog's Y
1e37	still short of the home row?
1e39	not fully on the home row -- back to the input scan
1e3c	bay 3's on-screen Y -- the bonus-popup and goal-sprite position
1e3e	the bay currently showing the fly
1e41	landed in bay 3?
1e43	yes -- pay the fly bonus
1e46	bay 3's home-tile VRAM base
1e49	stamp the frog-in-home tiles and reset the frog
1e4c	the latched-collision sub-flag
1e4f	test the latch
1e50	nothing latched -- skip the celebration sprite
1e54	arm the goal-celebration sprite
1e58	clear the latch so it doesn't carry to the next frog
1e5b	which player again -- now to bank the win
1e5f	player 2 -- mark the alternate gate and tally
1e63	mark bay 3 won for player 1
1e66	player 1's home-bay count
1e69	one more bay home -- five completes the board
1e6b	player 2: bay 3's alternate occupancy gate
1e6e	rejoin the shared gate test
1e72	mark bay 3 won for player 2
1e75	player 2's home-bay count
1e78	one more bay home -- five completes the board
1e7a	read the active player to pick this bay's occupancy bank
1e7e	not player 1 -- read the alternate-bank gate instead
1e80	player 1: read this bay's primary occupancy gate
1e84	bay already won -- nothing to award
1e85	read the frog's Y
1e88	reached the home row yet?
1e8a	still short of the row -- defer to the per-frame input scan
1e8d	this bay's on-screen Y -- fly-bonus popup and goal-sprite position
1e8f	read the bay currently showing the fly
1e92	is it this bay -- fly key 4?
1e94	frog landed on the fly bay -- pay the bonus
1e97	this bay's home-tile VRAM base
1e9a	stamp the frog-in-home tiles and reset the frog for its next trip
1e9d	read the latched-collision sub-flag
1ea1	no collision latched -- skip the celebration sprite
1ea5	arm the goal-celebration sprite
1ea9	clear the collision sub-flag so it doesn't carry to the next frog
1eac	read the active player again to pick the bank
1eb0	not player 1 -- mark the alternate bank
1eb4	flip player 1's occupancy gate to won
1eb7	point at player 1's home-bay count
1eba	one more bay filled -- at five the board completes
1ebc	player 2: read this bay's alternate occupancy gate
1ebf	rejoin the shared already-won test
1ec3	flip player 2's occupancy gate to won
1ec6	point at player 2's home-bay count
1ec9	one more bay filled -- at five the board completes
1ecb	read which player is up
1ece	zero now means player 1 is up
1ecf	not player 1 -- take the alternate occupancy bank
1ed1	bay 5's occupancy gate in the primary bank
1ed4	test the gate
1ed5	already set -- bay 5 is won, nothing to award
1ed6	read the frog's Y
1ed9	has it climbed to the home row ($2a)?
1edb	still short of the top row -- hand off to the per-frame input scan
1ede	bay 5's on-screen Y, doubling as the bonus-popup position
1ee0	the bay currently showing the fly
1ee3	does it match bay 5's key ($05)?
1ee5	the frog landed in the fly's bay -- pay the bonus
1ee8	bay 5's home-tile VRAM base
1eeb	stamp the frog-in-home tiles and reset the frog for its next trip
1eee	read the latched-collision sub-flag
1ef1	test the latch
1ef2	no latched collision -- skip the celebration sprite
1ef4	bay 5's Y again, for the goal sprite
1ef6	frog rode a flagged creature home -- arm the goal-celebration sprite
1efa	clear the latch so it doesn't carry into the next frog
1efd	read which player is up
1f00	zero now means player 1 is up
1f01	player 2 -- take the alternate bank's tally
1f05	mark bay 5 won in player 1's bank
1f08	player 1's home tally
1f0b	one more home filled -- at 5 the board is complete
1f0d	bay 5's occupancy gate in the alternate bank
1f10	rejoin the shared occupancy test
1f14	mark bay 5 won in player 2's bank
1f17	player 2's home tally
1f1a	one more home filled -- at 5 the board is complete
1f1c	read the collision latch
1f1f	test it
1f20	no collision this arrival -- skip the fly bonus
1f22	the fly-eat bonus, in BCD
1f25	bank the extra fly bonus
1f28	tear down the fly/goal sprite block -- HL left at its last cell
1f2b	stamp the top-left home tile
1f30	drop one tilemap row down for the bottom pair
1f37	and the bottom-right -- the 2x2 frog-in-home quad complete
1f3b	the flat home-arrival bonus, in BCD
1f3e	bank the flat home bonus
1f41	refresh the on-screen score
1f44	read the in-play flag
1f47	test it
1f48	attract, not a game -- skip the sound and teardown, straight to the frog reset
1f4d	clear the sound-sequence countdown so the jingle starts at once
1f50	queue the arrival jingle
1f54	which player is up
1f57	point at player 1's home tally
1f5b	player 1: keep that cell
1f5d	player 2: step to player 2's tally
1f5e	read this player's home count
1f5f	already four home -- this arrival fills the last bay
1f61	final bay: tear the board down
1f65	queue the arrival fanfare
1f69	point at the fanfare cursor
1f6c	step to the next fanfare
1f6d	not wrapped yet
1f6f	wrap the cursor back to the top of the 20-entry table
1f71	the fanfare index
1f72	the fanfare duration-pointer table
1f75	two bytes per entry
1f76	index into the table -- low byte only, stays in-page
1f7c	seed the sound-sequence countdown with the fanfare's duration
1f7f	on to the frog reset
1f81	mirror the tally where the sprite blit picks its copy region
1f84	wipe this player's board scratch
1f87	the fly sprite block in OBJRAM
1f8a	0x18 bytes to clear, zero fill
1f8d	zero this OBJRAM byte
1f8f	across the whole fly block
1f91	clear the collision sprite block once more
1f94	0x20 frames
1f96	arm the gated countdown
1f9b	queue the frog-countdown start sound
1f9c	the frog object block
1fa0	clear the frog X
1fa2	clear the frog sprite/tile code
1fa4	clear the frog object attribute
1fa6	park the frog Y off-screen so nothing draws until the next frog spawns
1fab	clear the intro counter
1fae	ask board setup to re-lay the board for the incoming frog
1fb1	clear the up-hop arrival mirror
1fb4	clear the up-hop active flag
1fb7	clear the up-hop animation counter
1fbb	enable the gated countdown so it drains the frames armed above
1fbe	set the frog-state / demo flag
1fc1	0x10 frames
1fc3	arm the hop-input lock -- input ignored while the arrival plays
1fc7	read the frog-spawn input-lock flag
1fca	test it
1fcb	lock not armed -- nothing to tick
1fcc	point at the lock's frame countdown
1fcf	tick one frame off the lock
1fd0	still counting -- leave the flag up so the joystick stays fenced
1fd2	clear the flag -- the spawn lock is over, control is handed back next frame
1fd6	the frog's current row -- a smaller value is higher up the screen
1fd9	the top edge of the scored band
1fdb	above the band -- too high up to score, done
1fdc	the bottom edge of the scored band
1fde	keep the row for the record compare
1fdf	exactly on the bottom edge -- seed the mark before comparing
1fe1	past the bottom edge -- below the band, nothing to score
1fe2	the furthest row reached so far this life
1fe6	the record already sits higher up -- no forward progress
1fe7	the same row as the record -- nothing new to score
1fe9	stamp this as the new furthest row
1fec	a BCD 1 -- the reward for reaching a new row
1fef	the mid band row
1ff1	the mid row keeps the record but pays no point
1ff3	add the point -- and an extra life if the score crosses the threshold
1ff8	the furthest-row mark
1ffb	still its initial zero -- the frog has never been in the band
1ffc	already crossed before -- skip the seed and just compare
1ffe	a row below the whole band -- worse than any real row reached
2000	seed the mark so this first crossing counts as progress
2003	now run the record compare
2005	point IX at object A's scroll descriptor block
2009	read object A's +2 byte -- the one shadowed each frame
200c	freeze it into object A's shadow so the copy reads a value held steady for the frame
200f	object A's reveal-column phase counter
2012	advance object A's counter one per frame
2016	reached the reveal threshold (80)?
2018	at or past 80 -- stamp a reveal column
201b	point IX at object B's scroll descriptor block
201f	read object B's +2 byte
2022	freeze it into object B's band shadow for the frame
2025	object B's band phase counter
2029	stepped twice -- object B advances +2 a frame, double object A's rate
202d	still below the blit ceiling (160)?
202f	still below 160 -- blit a six-row band
2032	the master lane-restamp clock
2035	one tick each frame
2039	phase 16?
203b	phase 16 -- re-stamp both lanes from the first source pair
203e	phase 32?
2040	phase 32 -- re-stamp from the second source pair
2043	phase 48?
2045	phase 48 -- re-stamp from the third pair and wrap the clock
2049	object A's descriptor
204e	row count from its +1 field
2052	columns from the frame's frozen shadow
2053	object A's phase-16 grid source
2056	per-column stride from object A's +0 byte
2059	stamp object A's grid into VRAM
205c	object B's descriptor
2061	row count from its +1 field
2065	columns from the band shadow
2066	object B's phase-16 band source
2069	stride from object B's +0 byte
206c	on to the alt-base copy for object B
206f	object A's descriptor
2074	row count from its +1 field
2078	columns from the frozen shadow
2079	object A's phase-32 grid source
207c	stride from object A's +0 byte
207f	stamp object A's grid
2082	object B's descriptor
2087	row count from its +1 field
208b	columns from the band shadow
208c	object B's phase-32 band source
208f	stride from object B's +0 byte
2092	on to the alt-base copy for object B
2095	object A's descriptor
209a	row count from its +1 field
209e	columns from the frozen shadow
209f	object A's phase-48 grid source
20a2	stride from object A's +0 byte
20a6	wrap the master clock back to 0 -- restart the 0..48 cycle before copying
20a9	stamp object A's grid
20ac	object B's descriptor
20b1	row count from its +1 field
20b5	columns from the band shadow
20b6	object B's phase-48 band source
20b9	stride from object B's +0 byte
20bc	on to the alt-base copy for object B
20bf	take the alternate VRAM destination for object B's lane
20c2	hand the band source to the copy engine
20c7	and its row count
20ca	run the shared copy loop
20cc	the VRAM destination base -- start of the first column
20cf	stash the source block pointer -- the per-column loop reloads it
20d4	stash the row count -- reloaded at the top of each column
20d7	read the tile pair's low byte from the source block
20d8	stamp it into the destination cell
20d9	step to the pair's high byte
20db	read the tile pair's high byte
20dc	stamp it alongside the low byte
20dd	back to the pair's start
20df	one full tilemap row down -- 32 bytes
20e2	step the destination down to the next row
20e4	advance the source to the next pair
20e5	next row down this column
20e7	read the column-stride byte
20ed	step the destination sideways to the next column
20ee	reload the saved row count
20f2	reload the source -- each column restarts at the block's top
20f6	one column done
20f7	more columns -- stamp the next one
20fb	point IX at object A's scroll descriptor -- row, column and row-count fields
2101	the column field -- how many whole rows to step down
2104	add one row pitch (32 cells) per column
2106	so A ends holding 32*column, wrapped to a byte
2109	the row field -- the offset within the row
210c	step = row field + column offset, one row's address delta
2112	the row-count field -- the span loop count
2115	the span loop runs row-count minus one times
2116	pile on one step for each remaining row
2117	HL now spans step*(row-count-1)
2119	the tilemap fill base
211c	land the column in the scrolling region of VRAM
211d	two column-pairs to stamp
211f	read object A's scroll phase -- the counter that gated this call at 80
2122	phase 80?
2124	the 80/208 stamp arm
2127	phase 128?
2129	the 128/176 stamp arm
212c	phase 160?
212e	the 160 edge arm
2131	phase 176?
2133	same table as 128
2136	phase 208?
2138	same table as 80
213b	any other phase stamps nothing -- just rewrite the mirror
213e	two rows copied per stamp call
2140	the 80/208 stamp table
2143	stamp this column-pair into VRAM
2147	round again for the second column-pair
214e	the 128/176 stamp table
2151	stamp this column-pair
2157	read the edge flag
215a	test it
215b	already clear -- leave it and rewrite the mirror
215f	clear the edge flag
2167	the 160 stamp table
216a	stamp this column-pair
2172	raise the edge flag to mark where the reveal wraps
2178	read a tile pair from the stamp table
2179	poke its first tile into VRAM
217c	the pair's second tile
217d	poke it into the next cell along
2183	step the VRAM pointer down one 32-cell row
2185	next row of the column-pair
2188	the row-count field again
218b	row count minus one
218c	store the row-count mirror the scroll driver reads back
219c	point at object B's scroll descriptor -- column, units, rows
21a0	clear the stride accumulator
21a2	the unit count -- how many tilemap rows to drop the band
21a5	add one tilemap row (0x20) per unit
21a7	loop over the units
21a9	the unit part of the stride
21aa	the band's column offset
21ad	column + 0x20*units = the per-row stride
21ae	copy the stride into DE to add once per row
21b0	zero the band-offset accumulator
21b3	the band's row count
21b6	walk the stride rows-1 times
21b7	step one stride down the band
21b8	loop rows-1 times to reach the band's top row
21ba	the scroll-band video-RAM base
21bd	HL now points at the band's top cell
21be	three passes -- six rows in two-row pairs
21c0	read the scroll-phase mode
21c3	phase 0?
21c5	paint source row A
21c8	phase 48?
21ca	paint source row B
21cd	phase 80?
21cf	paint source row C
21d2	phase 96?
21d4	also source row B
21d7	phase 112?
21d9	also source row A
21dc	any other phase -- paint nothing, just shadow the row count
21df	two rows per pass
21e1	source row A texture
21e4	blit this pass's two rows down the band
21e7	one pass done
21e8	repeat for all three passes
21ea	then shadow the row count
21ed	two rows per pass
21ef	source row B texture
21f2	blit this pass's two rows down the band
21f5	one pass done
21f6	repeat for all three passes
21f8	read the wrap-latch
21fb	test it
21fc	already clear -- nothing to do
2200	clear the wrap-latch
2203	then shadow the row count
2206	two rows per pass
2208	source row C texture
220b	blit this pass's two rows down the band
220e	one pass done
220f	repeat for all three passes
2211	the raised value
2213	raise the wrap-latch -- the frog-vs-lane collision code reads the pre-scroll lane lists this frame
2216	then shadow the row count
2219	a source cell
221a	write it into the band
221d	the pair's second source cell
221e	write it beside the first
2221	row step: 0x20 down minus the cell already advanced
2224	drop to the next band row
2226	next row -- it takes the source's second pair
2229	the band's row count
222c	rows-1
222d	the row-span shadow the scroll clock reads next frame
223d	switch to the shadow register bank so the caller's registers survive the copy
223e	point at player 1's difficulty index -- the default cell
2241	the active player number, 1 or 2
2244	player 1?
2245	yes -- keep player 1's index cell
2247	otherwise player 2 -- step to the adjacent index cell
2248	read the active player's difficulty tier, 0..4
2249	the lane-parameter pointer table's base
224f	double the tier -- two bytes per table entry
2251	index to this tier's pointer slot
2252	read the little-endian pointer to this tier's ROM block
2255	HL now sources the tier's 33-byte block
2256	the active player's lane-parameter block in work RAM -- the copy target
2259	33 bytes -- eleven render triples, one per lane arm
225c	copy the block down, retuning every lane arm for the board at once
230f	read the top-level mode byte
2312	leaves zero only in active play (mode 1)
2313	any other mode has no board to lay -- bail
2314	read the once-per-life layout latch
2317	test it
2318	layout already ran this life -- bail
2319	still zero -- re-arm the credit-column clear for the next redraw
231c	lay out the static display field
231f	reset and tile the score field for the new board
2322	copy this board's lane layout
2326	clear plot-suppression so the board-init frog render actually plots
2329	render the frog and its surrounding object tiles
232c	point at the status-row tile column
232f	paint the status-row column
2332	spawn the live frog object
2335	draw the frog's first animation frame
233a	raise plot-suppression again so later per-frame renders don't re-plot
233d	raise the run flag -- board laid once, in-play per-frame update may now proceed
2341	read the top-level game-mode byte
2344	mode 1 is the active-play value -- this makes it read as zero
2345	any other mode -- fall straight through as a bare return, doing nothing this frame
2346	read the board-laid-out run flag
2349	test it
234a	board still laying out -- return before stepping the cascade
234b	begin one scripted hop of the attract-demo frog -- inert in a real game
234e	read the joystick and resolve frog collisions and home-bay goals -- the heart of the frame
2351	step any in-progress attract hop one frame further
2354	draw the frog scene and tick the time-remaining counter
2357	advance the score/bonus display one step
235a	step the background scroll objects, redrawing the river and road bands
235d	tick the animation timer and roll the next sprite frame into the buffer
2360	resolve the frog against the lane objects -- what it rides, whether it drowned
2363	step the frog death animation if it is dying
2366	tick the board-transition hold timer
2369	runs last -- shift every lane object and carry a riding frog along with it
236d	read the timed-countdown lock flag
2371	held by the timed countdown -- stand down and touch nothing
2372	read the hold flag
2376	frog held by another subsystem -- no new hop this frame
2377	read the between-hops dwell counter
237b	still pausing -- just tick the dwell down
237e	the frog Y, armed for the directional hop-begin handler
2381	the dwell reload -- 48 frames of pause before the next scripted hop
2383	re-arm the dwell
2386	the phase index -- the hop-script cursor
2389	advance to the next script phase
238d	base of the canned hop script -- one byte per phase
2390	index this phase's entry in the script
2391	read this phase's frame code -- which way to hop
2392	bump it so the 0xff end-of-script marker lands on zero
2393	end of script -- rewind the cursor and drop the flags
2396	the directional-hop jump table, biased by one so the frame code lands on its slot
2399	index this frame code's jump slot
239b	the frog X, armed for the directional hop-begin handler
239e	enter the selected directional hop-begin
23b7	point HL at the frog X -- the position base the directional advance handlers step
23ba	point DE at the frog Y, the other half of that pointer setup
23bd	the down-hop-in-flight flag -- scanned first, so down outranks the other three
23c1	a down hop is live -- advance it one frame and return
23c4	idle -- clear the down arrival mirror so the next down hop re-arms clean
23c7	the up-hop-in-flight flag
23cb	an up hop is live -- advance it, scoring the row-crossing on the drain frame
23ce	idle -- clear the up arrival mirror
23d1	the right-hop-in-flight flag
23d5	a right hop is live -- advance it one frame and return
23d8	idle -- clear the right arrival mirror
23db	the left-hop-in-flight flag -- lowest priority in the scan
23df	a left hop is live -- advance it one frame and return
23e2	idle -- clear the left arrival mirror
23e5	every direction idle -- the demo frog rests between scripted hops
23eb	read the home-bay slot cursor
23ee	step the cursor to the next home bay
23ef	store the stepped cursor
23f2	reached the end of the six-phase cycle -- five bays plus a rest?
23f4	still under six -- this bay stands, done
23f5	rolled past the last bay -- back to the rest phase
23f6	store the wrapped cursor -- 0, the rest phase
23fa	read the active player -- picks which occupancy bank to test
23fd	keep it for the per-bay bank test
23fe	read the live slot cursor -- which bay is animating (1..5)
2401	publish the pending slot -- tells the eraser which bay to blank later
2406	bay 1
240b	bay 2
2410	bay 3
2415	bay 4
241a	bay 5
241d	rest phase (0) or out of range -- nothing to stamp
241e	player 1 (C=1) takes the primary bank
241f	player 2: read the alternate bank instead
2421	bay 1 occupancy, player 1's bank
2425	bay 1 already won -- don't stamp the fly over the frog
2426	bay 1's tile-block base
2429	go stamp the fly quad
242c	bay 1 occupancy, player 2's bank
2430	filled -- bail
2431	empty -- stamp bay 1
2436	bay 2 occupancy, player 1's bank
243a	bay 2 already won -- don't stamp the fly over the frog
243b	bay 2's tile-block base
243e	go stamp the fly quad
2441	bay 2 occupancy, player 2's bank
2445	filled -- bail
2446	empty -- stamp bay 2
244b	bay 3 occupancy, player 1's bank
244f	bay 3 already won -- don't stamp the fly over the frog
2450	bay 3's tile-block base
2453	go stamp the fly quad
2456	bay 3 occupancy, player 2's bank
245a	filled -- bail
245b	empty -- stamp bay 3
2460	bay 4 occupancy, player 1's bank
2464	bay 4 already won -- don't stamp the fly over the frog
2465	bay 4's tile-block base
2468	go stamp the fly quad
246b	bay 4 occupancy, player 2's bank
246f	filled -- bail
2470	empty -- stamp bay 4
2475	bay 5 occupancy, player 1's bank
2479	bay 5 already won -- don't stamp the fly over the frog
247a	bay 5's tile-block base
247d	go stamp the fly quad
2480	bay 5 occupancy, player 2's bank
2484	filled -- bail
2485	empty -- stamp bay 5
2487	top-left fly tile
248a	top-right fly tile
248c	+31 from the top-right cell -- one screen row below the top-left
2490	bottom-left fly tile
2493	bottom-right fly tile
2496	read the active player -- picks which occupancy bank to consult
2499	keep the player number for the per-bay bank test
249a	read the rotating home-bay slot cursor (1..5)
249d	publish it to the mirror cell -- the hand-off to the full-gator stamper
24a0	the slot cursor names bay 1?
24a5	bay 2?
24aa	bay 3?
24af	bay 4?
24b4	bay 5?
24b9	cursor 0 (the rest phase) or out of range -- draw nothing
24ba	active player 1? (C still holds the player number)
24bb	player 2: consult the alternate occupancy bank
24bd	player 1: read bay 1's primary occupancy gate
24c1	bay 1 already won -- leave it alone
24c2	point at bay 1's VRAM base
24c5	stamp the emerging-gator quad there
24c8	player 2: read bay 1's alternate occupancy gate
24cc	bay 1 already won -- leave it
24cd	bay 1 empty -- go stamp it
24cf	active player 1?
24d0	player 2: the alternate bank
24d2	player 1: read bay 2's primary occupancy gate
24d6	bay 2 already won -- leave it
24d7	point at bay 2's VRAM base
24da	stamp the gator quad there
24dd	player 2: read bay 2's alternate occupancy gate
24e1	bay 2 already won -- leave it
24e2	bay 2 empty -- go stamp it
24e4	active player 1?
24e5	player 2: the alternate bank
24e7	player 1: read bay 3's primary occupancy gate
24eb	bay 3 already won -- leave it
24ec	point at bay 3's VRAM base
24ef	stamp the gator quad there
24f2	player 2: read bay 3's alternate occupancy gate
24f6	bay 3 already won -- leave it
24f7	bay 3 empty -- go stamp it
24f9	active player 1?
24fa	player 2: the alternate bank
24fc	player 1: read bay 4's primary occupancy gate
2500	bay 4 already won -- leave it
2501	point at bay 4's VRAM base
2504	stamp the gator quad there
2507	player 2: read bay 4's alternate occupancy gate
250b	bay 4 already won -- leave it
250c	bay 4 empty -- go stamp it
250e	active player 1?
250f	player 2: the alternate bank
2511	player 1: read bay 5's primary occupancy gate
2515	bay 5 already won -- leave it
2516	point at bay 5's VRAM base
2519	stamp the gator quad there
251c	player 2: read bay 5's alternate occupancy gate
2520	bay 5 already won -- leave it
2521	bay 5 empty -- go stamp it
2523	top-left cell: the empty-home tile -- only the snout has surfaced
2526	top-right cell: empty-home tile
2528	31 cells on -- one screen row down from the top-right cell
252c	bottom-left cell: the gator breaking the waterline, left half
252f	bottom-right cell: the gator's right half
2532	read the active-player number -- picks which occupancy-gate bank to test
2535	hold the active player for the per-bay bank test
2536	read the mirrored slot cursor -- the bay the emerging pose drew
2539	republish it as the pending slot so the eraser later blanks the same bay
253e	slot 1
2543	slot 2
2548	slot 3
254d	slot 4
2552	slot 5
2555	rest phase or out of range -- no bay, draw nothing
2557	player 1 uses the primary gate; any other player the alternate
2559	bay 1's player-1 occupancy gate
255d	bay already won -- don't stamp the creature over the frog
255e	bay 1's VRAM base (top-left cell)
2561	go stamp the gator quad
2564	bay 1's alternate-bank occupancy gate
2568	bay already won -- skip the stamp
2569	empty -- stamp bay 1
256e	bay 2's player-1 occupancy gate
2572	bay already won -- don't overstamp the frog
2573	bay 2's VRAM base (top-left cell)
2579	bay 2's alternate-bank occupancy gate
257d	bay already won -- skip the stamp
257e	empty -- stamp bay 2
2583	bay 3's player-1 occupancy gate
2587	bay already won -- don't overstamp the frog
2588	bay 3's VRAM base (top-left cell)
258e	bay 3's alternate-bank occupancy gate
2592	bay already won -- skip the stamp
2593	empty -- stamp bay 3
2598	bay 4's player-1 occupancy gate
259c	bay already won -- don't overstamp the frog
259d	bay 4's VRAM base (top-left cell)
25a3	bay 4's alternate-bank occupancy gate
25a7	bay already won -- skip the stamp
25a8	empty -- stamp bay 4
25ad	bay 5's player-1 occupancy gate
25b1	bay already won -- don't overstamp the frog
25b2	bay 5's VRAM base (top-left cell)
25b8	bay 5's alternate-bank occupancy gate
25bc	bay already won -- skip the stamp
25bd	empty -- stamp bay 5
25bf	top-left full-gator tile (208)
25c2	top-right tile (209)
25c4	31 more cells -- the rest of a 32-wide row after the INC already stepped one
25c7	drop to the cell directly below the top-left
25c8	bottom-left tile (210)
25cb	bottom-right tile (211)
25cd	gator quad stamped
25ce	read the active-player number
25d1	keep the player number to pick the occupancy bank
25d2	the pending home-bay selector -- 1..5 for a bay, 0 at rest
25d7	erase bay 1
25dc	erase bay 2
25e1	erase bay 3
25e6	erase bay 4
25eb	erase bay 5
25ee	selector 0 or out of range -- nothing showing, return
25ef	was the active player 1?
25f0	not player 1 -- consult the alternate-bank gate
25f2	read bay 1's player-1 occupancy gate
25f6	bay already won -- don't paint over a filled bay
25f7	point at bay 1's 2x2 tile block in VRAM
25fd	read bay 1's player-2 occupancy gate
2601	already won -- leave it
2604	was the active player 1?
2605	not player 1 -- consult the alternate-bank gate
2607	read bay 2's player-1 occupancy gate
260b	bay already won -- skip the erase
260c	point at bay 2's 2x2 tile block in VRAM
2612	read bay 2's player-2 occupancy gate
2616	already won -- leave it
2619	was the active player 1?
261a	not player 1 -- consult the alternate-bank gate
261c	read bay 3's player-1 occupancy gate
2620	bay already won -- skip the erase
2621	point at bay 3's 2x2 tile block in VRAM
2627	read bay 3's player-2 occupancy gate
262b	already won -- leave it
262e	was the active player 1?
262f	not player 1 -- consult the alternate-bank gate
2631	read bay 4's player-1 occupancy gate
2635	bay already won -- skip the erase
2636	point at bay 4's 2x2 tile block in VRAM
263c	read bay 4's player-2 occupancy gate
2640	already won -- leave it
2643	was the active player 1?
2644	not player 1 -- consult the alternate-bank gate
2646	read bay 5's player-1 occupancy gate
264a	bay already won -- skip the erase
264b	point at bay 5's 2x2 tile block in VRAM
2651	read bay 5's player-2 occupancy gate
2655	already won -- leave it
2658	stamp the blank empty-home tile -- the block's top-left cell
265b	top-right cell
265d	step to the row below -- 32 per row, less the column already advanced
2660	drop into the bottom row of the 2x2 block
2661	bottom-left cell
2664	bottom-right cell
2666	read the hold flag -- set while the game is paused on a hit
266a	held -- leave the selector pending, retry the erase next frame
266c	clear the pending home-bay selector -- this bay's cycle is done
266f	and clear its cursor mirror
269a	the home-bay goal-award "200" popup record
269e	clear the popup's live/position byte -- the "200" popup stops drawing
26a0	and the fixed tail bytes -- record left idle for the next goal
26a6	read the eat-in-progress flag
26aa	an eat is under way -- just glue the fly onto the frog
26ad	base of the fly's drift block -- the appearance clock sits one byte in
26b1	read the fly-appearance clock
26b5	on the wrap to zero, arm the fly onto the screen (self-guards to fire once)
26b8	read the tongue-phase byte
26bb	bit 0 set means retract the tongue this frame
26bd	retract phase -- hand off to the tongue reset
26c0	read the fly-on-screen latch
26c4	fly is out -- patrol it and box-test it against the frog
26c6	no fly on screen -- nothing to do this frame
26c7	re-check whether an eat already latched
26cb	already eating -- skip straight to gluing the fly on
26cd	walk the fly one step along its patrol path
26d0	read the frog's row
26d3	the bottom of the fly's catch band
26d5	frog above the band -- no catch
26d6	the top of the catch band
26d8	frog below the band -- no catch
26d9	read the fly's X
26dd	read the frog's X
26e0	the +4px right edge of the catch window
26e3	fly is right of the window -- no catch
26e4	step down to the -4px left edge
26e7	fly is left of the window -- no catch
26ea	caught it -- latch the eat as under way
26ed	the eat sound
26ef	queue the eat sound, then fall through to glue the fly on
26f0	point at the frog's live position block
26f4	point at the fly's sprite descriptor
26fb	the caught fly rides the frog's X
2707	the fly trails 2px below the frog
270d	read the fly-on-screen latch
2711	already armed this cycle -- arm only once
2715	advance the tongue phase -- its bit 0 later triggers the retract
2719	stamp the armed-fly tile code
271f	its starting screen row
2723	latch the fly as on-screen
2726	reset the patrol path to its first step
2729	60 frames of tongue-out patrol
272b	load the tongue-out timer
272f	point at the fly's dwell/attack timer
2732	read the timer
2733	test it
2734	dwell expired -- advance one path step
2736	tick one frame off the dwell
2737	the full 60-frame dwell -- its midpoint comes next
2739	halve it to 30, the midpoint
273b	at exactly the midpoint frame?
273c	not the midpoint -- re-render the fly's X
273e	drop to the travel-direction/step byte
2740	test the heading -- bit7 sets the sign
2741	the flying sprite, facing forward
2743	set the fly's sprite image
2746	heading forward -- done
2747	the same sprite, flipped to face backward
2749	set the flipped sprite image
274d	point at the direction/step byte
274f	drop bit7 -> the bare path-table index
2754	look one slot past the current waypoint
2755	index into the fly's X-offset path table
2758	fetch that waypoint's X offset
275c	add the drifting lane base so the patrol rides it
275d	write the fly's screen X
2761	point at the direction/step byte
2764	forward -- step the index up
2767	backward: two steps down...
2768	...so the shared +1 nets a step back
2769	step the path index one waypoint along
2770	index into the fly's X-offset path table
2773	fetch the path entry at the new step
2774	sort the entry: endpoint, hold, or plain offset
2776	entry 0 -- end of the route, reverse
2778	entry 1 -- hold here
277d	add the drifting lane base so the patrol rides it
277e	write the fly's screen X
2782	the travel-direction/step byte
2786	flip bit7 -- reverse heading and sprite flip at once
2788	store the reversed direction
278b	reload the dwell timer to 60 frames
278e	the turning sprite
2790	show the fly turning
2796	reload the dwell timer, leave the fly's X put
27b3	read the fly-armed / tongue-out latch
27b6	test it
27b7	no fly latched -- nothing to tear down, leave
27b9	clear the eat-in-progress sub-flag, then fall into the sprite/latch wipe
27bc	point at the bonus-fly / home-goal sprite descriptor (X, code, color, Y)
27bf	clear A -- the zero stored into every descriptor cell and into the latch
27c0	zero the fly sprite's X
27c2	its tile/shape code
27c4	its color attribute
27c6	its Y -- the descriptor is now blank, so the sprite blits empty and the fly vanishes next frame
27c7	clear the fly's collision latch -- disarms the tongue so the next fly re-arms clean instead of re-testing a hit against a gone sprite
27cb	point at the fly/goal sprite block's lead byte -- reused here for the goal flourish
27ce	the caller's bay Y row -- positions the goal graphic on the bay just filled
27d0	the sprite tile to draw
27d3	its palette
27d6	the trailing descriptor byte -- fixed tail now complete
27d8	160 frames of on-screen life for the flourish
27da	arm the countdown -- written last so the descriptor above is now live; ticks to zero, then the block gets cleared
27de	base of the four-byte fly/goal sprite descriptor -- X, code, color, Y
27e1	zero -- the value that blanks each cell
27e2	clear the sprite X
27e4	clear the sprite code
27e6	clear the color
27e8	clear the Y -- an all-zero descriptor draws nowhere, so the goal-celebration creature vanishes
27ea	the level count that selects which of three diver bands runs
27ef	below level 2 -- no diver to arm yet, return
27f4	level 5 and up -- hand to the high-difficulty arm
27f7	the figure phase -- zero only at the very top of a fresh dive
27fb	dive just starting on levels 2..4 -- fire the mid-band one-shot arm
27fe	read the dive busy latch
2801	test it
2802	no dive armed -- nothing to pace
2803	point at the reload-period cell
2807	step to the live countdown cell
2808	compare the period against the countdown
2809	still mid-interval -- step the countdown, no frame this tick
280c	aligned -- consume a tick to break the match and open the next interval
280d	the VRAM column the copier paints the dive frame into
2810	read the frame-table select gate
2813	its low bit picks which frame table to copy from
2815	even phase -- copy from the alternate arm-0 table
2818	odd phase: the main tile-pair table for the copier
281d	the dive cycle's byte index into the ROM frame table
2820	hold this frame's offset for the source read -- A goes on to become the next index
2821	step the frame index forward one whole tile pair (+2)
2823	store the advanced index for the next call
2826	source = the chosen table base + this frame's offset
282a	how far down the column this cycle has already walked
282e	destination = the VRAM column base + that offset
2830	one full screen row is 0x20 tile cells
2835	drop the column offset one row for the next call
2836	store the advanced column offset
2839	first byte of this frame's tile pair from the table
283a	paint it into the top VRAM cell of the pair
283e	and the pair's second byte into the cell just below
283f	re-read the advanced frame index
2842	past the eighth and last frame?
2844	still short of the end -- more rows to paint, return for now
2845	cycle done -- zero out the whole dive-cycle state
2846	release the busy latch -- re-enables the figure flip
284f	the surface-timer reload seed
2852	the live surface-timer -- the next dive re-seeds from scratch
2856	read the play-mode flag (0 attract, 1 one-player, 2 two-player)
2859	is it a two-player game?
285b	any other player count -- return without touching a byte
285d	clear the figure/dive busy latch -- declares no dive in progress
2860	clear the dive-cycle cursor, the frame-table byte index
2863	clear the dive cursor's destination column offset
2866	clear the surface-timer reload period
2869	clear the surface-timer live countdown
286d	the alternate arm-0 tile table -- the even variant's dive-frame source
2870	hand the actual blit to the shared dive-frame copier
2874	read the diver figure's animation phase -- zero only at the idle top of a dive
2877	test it
2878	idle -- fire the one-shot high arm that seeds the dive cycle
287b	always fall through to the shared surface-timer pacer that steps the armed dive
287e	read the busy latch -- set only while a dive cycle is already armed
2881	test it
2882	already armed this cycle -- leave the block alone
2883	the value that opens the step gate -- 1 pins bit0 on, the main tile variant
2885	open the figure step gate the animator and the collision test both read
2888	seed the surface-timer pair from the frame buffer's low nibble, then latch the cycle shut
288c	read the dive-cycle busy latch
288f	test it
2890	already armed this cycle -- leave state untouched
2891	the figure-animation step gate
2894	step it -- bit 0 alternates the dive tile-table variant each cycle
2898	seed the surface-timer pair and latch the cycle armed
289b	armed
28b0	read the dive countdown
28b1	test it
28b2	drained -- reload a fresh period
28b4	still counting -- tick one off the countdown
28b6	the full period the countdown reloads to
28b9	reload the countdown -- so it repeats instead of stopping at zero
28bb	read the diver's arm/step gate
28be	test its arm bit
28c0	no dive armed -- nothing to mount
28c1	read the level counter
28c4	against level 2, where the diver first appears
28c6	still on level 1 -- no diver yet, skip the test
28c7	read the frog's Y
28ca	bias it to the tile centre (half a 16px tile)
28cc	against the diver band's top edge (42)
28ce	frog above the band -- no vertical overlap
28cf	against the band's bottom edge (59)
28d1	frog below the band -- no vertical overlap
28d2	read the frog's X
28d5	bias it to the tile centre
28d8	read the diver's on-screen X
28dc	form the diver's right edge (+8)
28df	frog past the diver's right edge -- no overlap
28e1	form the window's left edge (diver X - 32)
28e4	frog left of the 32-wide window -- no overlap
28e6	form the inner edge (diver X - 8)
28e9	frog left of the inner edge -- a clean landing, ride it
28eb	inside the inner edge -- came down on the wrong part, kill the frog
28f1	raise the ride/hold flag -- frog held and carried on the diver's back
28f4	point at the figure's tile quad in VRAM
28f7	top-left mounted-frog tile (104)
28fa	top-right tile (105)
28fc	one screen row minus the cell just advanced
2900	bottom-left tile (106)
2903	bottom-right tile (107)
2906	read the in-play flag
2909	test it
290a	not in a game -- nothing to queue
290b	read the lane-control speed byte
290e	against the top of the animating window
2910	at or above 0x0f, past the window -- bail
2911	against the bottom of the window
2913	below 0x02, before the window -- bail
2914	read the lane-scroll counter
2917	test it
2918	scroll not back at phase 0 -- wait for alignment
2919	the frog-on-log edge-blit command
291b	queue it on the sound/tile command ring
291d	read the diver-presence gate -- 0 is idle, else it holds the diver's X
2920	test it
2921	diver present -- go step the flip cycle
2924	idle: reset the flip-cycle phase so the next dive starts fresh
2928	read the dive-armed gate
292b	test the armed bit
292d	not armed this frame -- draw nothing
292e	read the busy latch shared with the descending-dive copier
2931	test it
2932	copier owns the shared cursor -- stand down so the two don't draw over each other
2933	point at the flip-cycle phase counter
2936	advance the flip cycle one frame
2938	reached the first pose mark? (phase 64)
293a	yes -- stamp pose A
293c	reached the second pose mark? (phase 112)
293e	yes -- stamp pose B and restart the cycle
2940	between marks -- hold the last pose
2941	point at the figure's top-left VRAM cell
2944	pose A top-left tile
2947	pose A top-right tile
2949	step down one tilemap row (+31 after the INC makes +32)
294d	pose A bottom-left tile
2950	pose A bottom-right tile
2953	point at the figure's top-left VRAM cell
2956	pose B top-left tile
2959	pose B top-right tile
295b	step down one tilemap row
295f	pose B bottom-left tile
2962	pose B bottom-right tile
2965	restart the flip cycle from phase 0
2970	the life/level count that scales how many hazards run this frame
2973	level 3 -- the floor below which no drifting lane creatures appear
2975	below level 3, skip the drifting creatures -- only the rideable object runs
2977	which player is up -- selects the drifting-creature record bank
297b	not player 1 -- take the player-2 record bank
297d	player 1's first drifting-creature record
2983	player 2's first drifting-creature record
2987	the shared drifting-creature sprite slot
298b	advance the first drifting lane creature one frame
298e	re-read the level count -- now for the second-creature test
2991	level 6 -- the floor for a second drifting creature
2993	below level 6, re-run on the SAME object -- no second creature yet
2995	one record's width, 16 bytes
2998	step the record base to the second creature
299a	the second creature's sprite slot
299e	advance the second drifting lane creature one frame
29a1	which player is up -- now for the always-present object's bank
29a5	not player 1 -- take the player-2 record
29a7	player 1's rideable-object record
29ad	player 2's rideable-object record
29b1	the rideable object's sprite slot
29b5	advance the always-present object the frog can ride -- runs every frame
29b9	reveal or park this object when its spawn timer expires -- run first so a freshly armed object still animates and moves this frame
29bc	advance the creature's two-tile animation frame
29bf	drift the creature along its lane between the band edges -- frozen once a frog hit is latched
29c2	stage the object into its hardware sprite slot, recycling it on the fold-wrap
29c5	test the staged object against the frog -- run last, so it sees the final position
29c9	tick the object's frame-hold timer down one
29cc	still counting -- hold the current tile and leave the sprite untouched (the common path)
29cd	expired -- reload the hold to 12 frames
29d1	the object's phase/state byte
29d4	test it
29d5	phase 0 is idle -- draw nothing this frame
29d6	step the phase down one -- the cycle counts 4 down to 1
29d7	still in range -- skip the wrap and keep the stepped phase
29d9	phase 1 wrapped past zero -- reload the 4-frame cycle to 4
29db	store the new phase back
29e1	base of the phase-to-tile table
29e4	index it by the stepped phase
29e5	read this frame's tile code
29e6	fold in the object's horizontal-flip bit so the creature faces its travel direction
29e9	stage the tile into the slot's first stacked entry
29ec	the next tile up -- the second stacked half draws tile+1
29ed	stage tile+1 into the second entry
29f0	the first stacked entry's color/attribute byte
29f4	and the second entry's color byte -- both hardware halves share it
29f8	both tiles staged -- the machine mirrors the slot into the sprite hardware next frame
29f9	read the object's active flag
29fd	a zeroed record has nothing to move -- bail
29fe	the global sprite-object hit gate
2a02	the frog's been caught -- freeze this object with the rest
2a03	tick the move timer one frame
2a06	not time to step yet
2a07	reload the timer -- one step every 8 frames
2a0b	the sprite's on-screen row
2a0e	row 96 -- the split between the two motion modes
2a10	at/below row 96 -- take the straight vertical step
2a12	raise the has-moved flag the retire arm waits on
2a16	read the object's facing
2a1a	facing the other way -- drift the opposite direction
2a1d	the free-running counter this object drifts against
2a20	how far the counter has passed this facing's band edge
2a23	counter hasn't reached the edge -- hold, no step
2a24	compare against the lane's travel span
2a27	off the far edge -- turn and reverse
2a29	creep one pixel across the lane
2a6a	the level/slot count -- doubles as the sprite-object population dial
2a6d	against level 3, this arm's floor
2a6f	below level 3 dispatcher A is dormant -- bail
2a70	keep the count for the density threshold
2a71	tick this object's own spawn/respawn countdown one frame
2a74	still cooling down -- no spawn attempt this frame
2a75	read the slot's active/state byte
2a79	already armed -- leave it to the animate/motion arms
2a7a	roll the shared spawn PRNG for the density gate
2a82	the density threshold count*8+0x80 -- climbs with the level
2a85	roll above the threshold -- deny the spawn
2a86	a second PRNG draw for the band roll
2a8b	one time in four (both low bits clear) skip the band walk -- to the park/reveal tail
2a8d	one placement band spans 0x40 pixels -- the walk step and on-screen span
2a8f	point at the X-stride seed
2a94	rotate the seed right twice -- bits wrap to the top, none lost
2a95	+0x24 gives the per-band X stride
2a99	advance to the band-scan count (0x8278) -- the walk's budget
2a9a	load the band budget for the djnz walk
2a9b	the free-running position counter, +1 every frame -- the drift source
2a9e	start the walk 0x10 below it
2aa0	counter below 0x10 would underflow -- park instead
2aa2	drop one band pitch (0x40)
2aa3	landed inside the final band -- place it on-screen
2aa5	spend one X stride
2aa6	no room left for a stride -- park off-screen
2aa8	band budget left -- keep walking down
2aaa	flag the object "parked/fixed" (attribute >= 0x60)
2aae	the park-or-reveal coin
2ab2	odd -- reveal it on the play row after all
2ab4	even: clear the direction/flip bit
2ab8	park it off the bottom of the screen
2abe	undo the last band drop -- the landing residual
2ac3	seed the position accumulator with the free-running counter, the value the motion arms drift against
2ac6	counter minus the landing band -- the low band-edge X limit
2ac7	store the near/low edge the creature bounces off
2aca	plus one band span (0x40)
2acb	store the far/high edge
2ace	mark it an on-screen "moving" object (attribute < 0x60)
2ad2	set the direction / horizontal-flip bit
2ad6	put it on the play row
2ada	arm the slot: idle -> live
2ade	seed the animation-frame timer
2ae2	seed the motion timer, then fall into the shared spawn tail
2ae6	read the per-turn spawn-sound one-shot
2ae9	test the latch
2aea	already fired this turn -- one chirp per turn, so leave untouched
2aec	latch it up front -- holds even if the sound is later dropped
2aef	the sprite-object spawn-sound command
2af1	hand it to the sound ring -- dropped when no game is in play
2af3	read the object's active/state byte
2af6	test it
2af7	idle object -- nothing to stage
2af8	fire the per-turn spawn-sound one-shot
2afb	the row/category attribute byte
2afe	0x60 splits parked from moving
2b00	parked object -- take its fixed X
2b02	the free-running position counter, not the frog X
2b05	less the object's own position accumulator -- the drifting X
2b08	keep the X for the second tile
2b09	write it to the sprite's X
2b0e	the parked object's own fixed X
2b11	write it to the sprite's X
2b14	the attribute again -- it doubles as the row/Y
2b17	Y of the first tile
2b1a	and the second tile -- both on one row
2b1d	read the facing / flip bit
2b20	test it
2b21	facing set -- second tile trails 15px left
2b23	the +15 lead for the second tile
2b25	offset from the first tile's X
2b26	the second tile's X
2b29	bump to test the right-edge wrap
2b2a	not wrapped -- still mid-lane, done
2b2b	wrapped past the right edge -- reached the fold
2b2d	the -15 offset for the trailing tile
2b2f	offset from the first tile's X
2b30	the second tile's X
2b33	the primary X again
2b34	test for the left edge
2b35	not at 0 -- still mid-lane, done
2b36	the has-moved / eligible-to-retire flag
2b39	test it
2b3a	folded but never moved -- leave it live
2b3d	aim at the record
2b40	dest one byte ahead -- the zero-propagate fill
2b41	15 more bytes
2b44	zero the first byte
2b45	wipe the whole 16-byte record
2b47	then 7 bytes for the slot
2b4c	aim at the sprite slot
2b50	zero the first byte
2b51	wipe the whole 8-byte slot -- the object vanishes
2b53	reseed the respawn timer -- a fresh object in ~0x20 frames
2b58	the object's active-state byte
2b5c	idle object -- nothing here to hit, drop out
2b5d	the object's row/category attribute
2b60	bias it up onto the frog-row scale
2b62	point at the frog's row
2b65	on the same row as the frog?
2b66	a different row can't touch the frog -- done
2b67	the direction / horizontal-flip bit
2b6b	the sprite's on-screen X
2b6e	point at the frog's X
2b71	not flipped -- take the X as drawn
2b73	flipped -- slide one sprite cell onto the creature's body
2b75	how far the object sits right of the frog
2b76	object is left of the frog -- no overlap, done
2b77	within one sprite cell of the frog?
2b79	a full cell or more clear -- no overlap, done
2b7a	the caught flag
2b7c	flag the frog caught -- halts its input and hands it to the death path
2b7f	raise the global hit gate -- freezes every drifting attacker this frame
2b83	arm a fresh steering creature when the slot is idle and the level allows
2b86	drift the object one step toward its lane target -- despawn on arrival unless the frog rides it
2b89	stage the on-screen X/Y from the freshly moved position
2b8c	test the frog against the object ahead -- a hit holds it alive and marks it mounted
2b8f	stage the sprite tile and colour from the object's current state
2b93	read the object's active flag
2b96	test it
2b97	idle object -- stage nothing this frame
2b98	the object's lane index -- the low byte of its target cell
2b9d	read the lane target it's steering toward
2b9e	minus the position accumulator -- the current on-screen X
2ba1	stage the sprite's on-screen X
2ba4	the object's row/category byte
2ba7	stage it as the sprite's Y
2bab	the object's active/state byte
2baf	idle slot -- nothing to steer
2bb0	tick the move timer down one frame
2bb3	still counting -- no step this frame
2bb4	expired -- reload the timer, one motion step every 8 frames
2bb8	the object's lane index -- low byte of the target-cell pointer
2bbb	the lane table lives in page 0x80 -- HL now points at this object's target cell
2bbd	the direction / sprite-flip bit -- picks the drift sign and goal edge
2bc1	facing clear (0x00) -- steer toward the near edge instead
2bc3	read the lane target coordinate
2bc4	distance out to the far band edge (IX+0), the goal when facing up
2bc7	compare against the object's on-screen X
2bca	reached the far edge -- retire the object
2bcc	not there yet -- step the position accumulator up one
2bd0	read the lane target coordinate
2bd1	distance in to the near band edge (IX+1), the goal when facing down
2bd4	compare against the object's on-screen X
2bd7	reached the near edge -- retire the object
2bd9	not there yet -- step the position accumulator down one
2bdd	the frog-riding hold flag
2be1	frog is riding this object -- keep it, don't yank it out from under the frog
2bec	clear the whole 16-byte record -- free it for a respawn
2bee	the object's shared hardware slot block
2bf8	clear the 4-byte slot -- the object leaves the screen next frame
2bfb	read the object's state byte -- 0 means idle
2bfe	test it
2bff	idle object -- nothing to draw, leave the slot as it was
2c00	base of the state-to-tile-code attribute table
2c03	the state byte becomes the table index
2c06	point at this state's entry
2c07	the sprite tile-code to show for that state
2c08	fold in the object's direction / horizontal-flip bit
2c0b	stage it into the slot's tile-code byte
2c0e	the fixed colour value these objects always use
2c13	the life/level count -- gates the whole object engine
2c16	level 3 is where sprite objects begin
2c18	below level 3 the engine is dormant -- no spawn
2c19	keep the count for the density threshold
2c1a	the record's active/state byte
2c1d	test it
2c1e	slot already holds a live object -- leave it
2c1f	first draw: the density roll
2c26	the level count times eight
2c27	plus 128 -- the density threshold, higher levels spawn denser
2c29	the threshold against the roll
2c2a	roll above the threshold -- no spawn this frame
2c2d	second draw: the variant pick
2c30	keep the low three bits -- eight candidate kinds
2c32	only variants 0..4 are real objects
2c34	5/6/7 -- no object, skip this frame
2c35	hold the chosen variant
2c39	swing the variant into the high nibble -- times sixteen
2c3a	plus 48 -- each kind owns its own 16-tile band
2c3c	field +4: the row/collision attribute and kind
2c3f	third draw -- value unused, pulled only to step the ring
2c44	two bytes per variant entry
2c48	the variant table: primary span and lane index per kind
2c4c	the even byte: the primary placement span
2c4e	the odd byte: the object's lane index
2c4f	the lane table sits in page 0x80
2c51	field +0x0b: the object's lane
2c54	the lane's starting position
2c5b	the pointer table: one address per variant
2c62	HL now aims at the variant's placement data
2c63	the raw secondary-span byte
2c65	rotate it right twice
2c66	minus 16 -- the secondary walk span
2c68	hold the secondary span
2c6a	step two cells on -- low byte only, staying in the page
2c6b	the walk's iteration count
2c6c	start the walk from the seed position
2c6d	take off one primary span
2c6e	won't fit on the lane -- abandon this spawn
2c6f	probe a secondary span
2c70	secondary span underflows -- stop, the band is found
2c72	keep striding down the lane
2c74	add the secondary span back -- the band remainder
2c7b	reload the lane's seed position
2c7c	field +2: the position accumulator, seeded
2c7f	seed minus the remainder -- the near band edge
2c80	field +1: the near edge
2c83	one secondary span up -- the far edge
2c84	field +0: the far band edge the object rides between
2c87	fourth draw: the launch direction
2c8a	its low bit into carry
2c8b	odd draw -- reveal the object on the play row
2c8d	even: field +5's flip bit set
2c91	field +3 = 0xf0 -- parked off the play row
2c95	past the on-screen case, on to arming
2c97	field +5 clear -- unflipped, on screen
2c9b	field +3 = 0 -- on the play row
2c9f	field +6 = 1: the record is armed -- the motion arms take it from here
2ca3	field +9: the motion timer seeded to 8
2ca8	read the object's state byte
2cab	test it
2cac	idle slot -- nothing here to hit-test
2cad	the object's row
2cb0	point at the frog's row
2cb3	same row as the frog?
2cb4	different row -- no vertical overlap, done
2cb5	read the object's direction bit
2cb8	which way is it facing?
2cb9	the slot X staged this frame
2cbc	point at the frog's X
2cbf	facing the other way -- project the trailing edge instead
2cc1	project the leading edge 20px ahead
2cc5	project the trailing edge back 4px
2cc7	distance past the frog's X
2cc8	projected point is behind the frog -- no catch
2cc9	within one 16px tile ahead?
2ccb	more than a tile away -- not close enough yet
2ccc	the value that marks a catch
2cce	frog has mounted the object -- freeze its input while it rides
2cd1	advance the object to the caught state -- held from despawn
2cf0	point at the coin-input latch
2cf3	read the coin latch
2cf4	already armed? -- this test, not the port read below, drives the branch
2cf5	read the coin-door input port -- active-low
2cf8	invert, so a pressed line reads 1
2cf9	latch already armed -- go check for the release edge
2cfb	mask down to the two coin slots and the service line
2cfd	arm the latch with whatever's pressed -- 0 when the door is quiet
2cff	mask the coin/service lines -- any still held?
2d01	a line is still down -- wait for the release
2d02	bump 0 up to sound command 1
2d03	play the coin-drop blip
2d06	clear A -- the 0 that disarms the latch
2d07	the coinage DIP setting -- indexes the credit tables below
2d0b	which slot? -- test the slot-2 bit of the latch
2d0d	slot 2 -- take its counter and credit table
2d10	slot 1: is this the free-play service switch?
2d12	disarm the latch
2d13	service coin -- credit it but skip the mechanical counter
2d15	raise the counter latch to 1
2d16	tick slot 1's mechanical coin counter
2d1b	arm the slot-1 counter pulse -- the NMI drops the tick four frames on
2d1e	base of the slot-1 coinage jump table
2d21	index by the coinage setting
2d22	jump into the table
2d23	coinage 0: one credit per coin
2d25	coinage 2: two coins to a credit
2d27	coinage 4: two coins to a credit
2d29	coinage 6: one credit per coin
2d2b	disarm the latch
2d2d	tick slot 2's mechanical coin counter
2d32	arm the slot-2 counter pulse the same way
2d35	base of the slot-2 coinage jump table
2d3a	coinage 0: one credit per coin
2d3c	coinage 2: two coins to a credit
2d3e	coinage 4: three credits per coin
2d40	coinage 6: six credits per coin -- the bonus slot
2d42	point at the coin-pair toggle
2d45	count this coin of the pair
2d46	odd or even count?
2d48	odd coin -- counted, but no credit until its partner
2d49	one credit to bank
2d4b	go add it in
2d51	three credits to bank
2d53	go add it in
2d55	six credits to bank
2d57	the packed-BCD credit total
2d5a	add the credits just earned
2d5b	keep the count in packed decimal
2d5c	no overflow -- store it straight
2d5e	overflow: pin the total at 99
2d60	store the new credit count
2d63	read the in-play flag
2d67	a game is already running -- just top up the credit and leave
2d68	read the current game mode
2d6b	already on the player-select screen?
2d6d	if so, refresh the insert-coin prompt
2d70	the player-select mode
2d72	drop the machine into player-select
2d76	clear the point-table draw state
2d79	the fly/object work block
2d82	seed its first byte to 0
2d83	wipe the block -- no stale attract sprite carries over
2d85	redraw the credit line and return
2d88	point at the attract pacing / drawn-state gate
2d8b	mark the page just-drawn -- hold it a full pacing interval before advancing
2d8d	blank the play field, sparing the score margin -- a clean ground for the title
2d91	zero the once-per-life board-layout flag -- re-arms that one-shot
2d94	clear any leftover attract-object animation state
2d99	seed the first intro work counter to 5
2d9e	seed the second intro work counter to 3
2da1	the main title tile strip in ROM
2da4	the VRAM cell its column climbs up from
2da9	paint its eleven tiles up the column -- one tile per row, climbing
2daa	read the shared starting-time byte
2dad	is it a low single-digit start?
2daf	10 or above -- the splash is the title alone, done
2db0	where the time digit glyph goes
2db3	stamp the units time digit -- hands back the pointer stepped up one cell
2db6	the second title strip's source
2dbb	blit its seven tiles up, resuming just past the digit
2dbc	the third title strip's source
2dc1	blit its four tiles, chaining from the last strip's end
2dc2	the fourth title strip's source
2dc7	blit the last seven tiles up the same column
