0003	power-on: jump into the machine boot-up sequence
0008	mid-screen raster interrupt -- save the working registers
000c	enter the mid-screen interrupt body
0010	vblank interrupt -- save the working registers
0016	stamp the raster draw-phase flag to the vblank half
001c	tick the frame-delay counter down one -- every busy-wait delay spins on it
001d	run the tilt/panic check
0020	read the coin and start input port
0022	rotate the coin-switch bit into carry
0023	coin switch idle: branch to re-arm the coin latch
0026	load the coin-switch edge latch
002a	no armed coin edge: skip crediting
002d	load the running credit tally
0030	is the credit tally at its 99 cap?
0032	credits capped: skip the increment
0037	add one credit in binary-coded decimal
0038	store the new credit tally
003b	repaint the on-screen credit count
003f	clear the coin-switch edge latch -- consume the press
0042	load the master game-active gate
0046	no game or demo live: end the interrupt here
0049	load the game-in-progress flag
004d	a game is under way: run the in-game frame work
0050	load the running credit tally
0054	a credit is banked: branch to bring up the credit screen
0057	run one attract-mode task this frame
005d	load the credit-screen-shown latch
0061	credit screen already shown: end the interrupt
0064	bring up the credit and start screen
0069	re-arm the coin-switch edge latch for the next press
006f	sound the fleet-march beat
0075	copy a per-frame status byte into its shadow cell
0078	paint the marching alien queued for this frame
007b	run the per-frame object-record table
007e	step the saucer-spawn countdown
0086	re-enable interrupts before returning from the frame
008d	stamp the raster draw-phase flag to the mid-screen half
0090	load the master game-active gate
0094	no game or demo live: end the interrupt
0097	load the game-in-progress flag
009b	a game is under way: service the mid-screen objects
009e	load the task-select flags
00a1	test the low task-select bit
00a2	that task not selected: end the interrupt
00a5	point at the mid-screen object-record table
00a8	run the mid-screen object-record table
00ab	advance the fleet -- pick the next alien to repaint
00b1	address the active player's field-save slot
00b9	publish the saved fleet reference corner into the live anchor
00bc	also seed the alien draw pointer with that corner
00c1	read back the saved per-player fleet-step delta
00c2	is the delta exactly three?
00c7	trim the delta by one when it reads three
00c8	store it as the working fleet-step count
00cb	does the delta carry the reversed-heading sentinel?
00d2	raise the flag when the leftward-heading sentinel is present
00d3	store the fleet move-direction flag
00d9	arm player one's initial fleet-step delta to two pixels
00dc	arm player two's initial fleet-step delta to two pixels
00df	blank the fixed status strip -- a no-op in two-player mode
0103	read the alien-explosion latch
0105	an alien is mid-explosion: tick its despawn timer instead of drawing
0109	load the alien draw-index cursor
010d	load the active player's alien page
0111	read the queued alien's liveness byte
0114	queued alien is dead: draw nothing, just release the pending flag
0119	read the alien's current sprite id
011b	read the two-frame walk toggle
011c	clear the low bit to select the base pose
0120	scale the sprite id into a table offset -- sixteen bytes per sprite
0124	point at the alien sprite table
0127	index to this alien's sprite
012b	alternate-frame flag set: advance to the second walk-pose bank
012e	load the queued screen address
0133	shift-blit the sixteen-row alien sprite to the screen
0137	clear the draw-pending flag -- frees the selector to queue the next alien
013e	advance the sprite pointer one bank (0x30) to the alternate walk pose
0141	load the fleet-march enable gate
0145	march disabled: do nothing this frame
0146	load the draw-pending flag
014a	previous alien not yet painted: pick none this frame
014b	load the active player's alien page
014f	load the alien scan cursor
0152	allow two full passes over the field
0154	step the scan cursor to the next alien cell
0155	reached the end of the 55-cell field?
0157	end of a pass: step the fleet and fold its drop into the reference corner
015b	read that alien's liveness byte
015d	cell not alive: keep scanning
0160	save the cursor at the alien just found
0163	resolve that alien's screen coordinate
0167	stash the packed draw coordinate for the paint pass
016b	has this alien descended into the bottom band?
016d	invasion reached the floor: arm the round-ending restart
0171	latch the alien's row span for the draw pass
0176	raise the draw-pending flag to hand off the blit
017a	zero the whole-row counter
017d	point at the fleet reference corner
0180	seed the first coordinate from the reference corner
0182	seed the second coordinate from the reference corner
0183	compare the remaining index against the 11-column row width
0185	less than one row left: switch to counting leftover columns
0188	subtract one whole row of eleven from the index
018c	step the first coordinate down one grid row (16 pixels)
0190	count one whole row consumed
0195	any leftover columns to place?
0196	no remainder: the coordinate pair is resolved
0199	step the second coordinate across one grid column (16 pixels)
019d	one fewer leftover column
01a1	count down the remaining passes
01a2	two barren passes: abandon the scan this frame
01a8	restart the scan cursor at the top of the field
01ab	read this pass's staged vertical drop
01ac	clear the staged drop
01ae	fold the drop into the reference corner -- the whole fleet steps down
01b8	toggle the two-frame walk animation for this pass
01b9	reset the scan cursor to zero
01bd	re-read the active player's page
01c0	point the wave-arm at player one's alien field
01c3	prepare to fill 55 alien cells
01c5	mark this alien alive
01c9	loop until all 55 aliens are marked alive
01cd	discard the scan's return address -- unwind to abandon the frame
01cf	the lit pixel byte for the ground line
01d1	span all 224 screen columns
01d3	start at the first playfield byte -- the bottom ground row
01d6	fill a lit pixel across the full-width floor
01da	read the record's per-step advance
01dd	add the caller's step into the first running total
01e1	add the per-step advance into the second running total
01e4	set the copy length to 0xc0 (192) bytes -- then fall into the work-RAM stamper
01e6	point the source at the work-RAM template image in ROM ($1b00)
01e9	point the destination at the base of work RAM ($2000)
01ec	block-copy the template down into work RAM
01ef	point at player 1's shield backup buffer ($2142)
01f2	fill that buffer with four fresh bunker shields
01f5	point at player 2's shield backup buffer ($2242) -- then fall into the filler
01f8	four bunker shields to lay down
01fa	point the source at one pristine shield template in ROM ($1d20)
01fd	loop top -- hold the template source so every bunker copies from the same template
01fe	one shield block = 0x2c bytes
0200	copy one pristine shield into the current buffer slot
0203	rewind the source to the template start for the next bunker
0204	one bunker done
0205	repeat until all four bunkers are stamped
0209	select save mode -- 1 = capture the on-screen shields
020b	run player 1's shield save/restore
020e	select save mode -- 1 = capture the on-screen shields
0210	run player 2's shield save/restore
0213	select restore mode -- 0 = paint the saved shields back -- then fall into player 2's shield body
0214	point at player 2's shield backup buffer ($2242)
0217	run the shared four-block shield save/restore
021a	select restore mode -- 0 = paint the saved shields back -- then fall into player 1's shield body
021b	point at player 1's shield backup buffer, then run the shared save/restore body
021e	record the save/restore direction where every pass re-reads it
0221	one bunker block is 0x16 columns wide by 2 bytes tall
0224	start at the first bunker's on-screen rectangle
0227	four bunkers to walk
022b	re-read the save/restore direction for this block
022f	on a save, capture the screen rectangle instead
0232	restore: OR the stored bunker bitmap back onto the screen
0237	count off this bunker
0238	done once all four bunkers are handled
023a	step to the next bunker -- 0x17 columns further over
0242	save: capture the bunker's screen rectangle into the backup buffer
0248	seat the in-game object table, then walk it
024b	read the record's high timer byte / table sentinel
024e	0xff ends the table
0251	0xfe marks a skipped record -- step past it
0255	read the record's low timer byte
0257	is the 16-bit frame timer still running?
0259	timer still counting -- decrement it and move on
025d	read the record's gate byte
025f	timer done but the gate byte still counting -- tick it down
0263	load the record's handler address, low byte
0265	and its high byte
026e	call this record's handler
0270	advance past the handler data to the next record
0277	tick the 16-bit frame timer down one
027c	borrow into the high byte when the low byte rolls under
027e	write the decremented timer back into the record
0281	step to the next 16-byte record
0288	tick the record's gate byte down one
0290	read the ship record's animation-mode byte
0293	0xff is the cursor-arm mode -- go move the ship
0297	count the inner frame timer down
0298	still running -- the ordinary pass, nothing more to do
029b	clear the cursor-move pacing cells
02a1	reseat the ship's startup-hold countdown
02a7	reseed the inner frame timer to 5
02aa	count the outer animation counter down
02ab	frames remain -- step one animation frame
02ae	animation done: fetch the ship's last screen position
02b3	wipe the ship's old 16-row sprite column
02be	restore the ship record from its ROM template
02c3	silence the ship's sound cues
02c6	check the warm-restart-suppress flag
02ca	suppressed -- return without restarting
02cb	is a real game in progress?
02cf	in the attract demo there is nothing to restart
02d0	reset the stack -- this frame is a player death
02d3	re-enable interrupts
02d4	drop the game-active flag
02d7	read the active player's reserve-ship count
02db	no ships left -- game over
02de	point at the other player's in-play flag
02e3	other player not in -- continue the same player on an extra life
02e6	is this a two-player game?
02ea	one-player game -- likewise continue the same player
02ed	read which player is active before the reseed clobbers it
02f1	test the active-player bit
02f2	player 1 was active -- save player 1's shields
02f5	save the outgoing player 2's shields to their page buffer
02f8	stage the outgoing player's fleet reference for their next turn
02fb	write the fleet reference coordinate into the save record
0300	and the working alien count
0302	reseed the work RAM image from ROM for the incoming player
0306	recover which player was active
0307	default the incoming player to page 0x21 with silent sound-select
030e	handing to player 2 instead: their alternate sound tone
0310	and their page 0x22
0312	publish the incoming player's page
0315	hold the round-start splash on screen
0319	idle the first object record for the new round
031d	emit the incoming player's sound-select
0320	seat the sound-port-5 shadow to match
0323	wipe the playfield
0326	spend one of the incoming player's ships and repaint the lives readout
0329	enter the incoming player's round
032c	extra-life path: spend one ship and repaint the lives readout
032f	re-enter the field without reloading the fleet -- the wave continues
0332	player 1 was active -- save player 1's shields
033e	mark the fleet-march enable
0341	is the cursor already enabled?
0348	enable the cursor once the startup hold has elapsed
034a	read the ship's current column
034e	in a real game?
0352	yes -- move by live player input
0355	attract demo -- read the scripted move direction
0358	right requested?
0359	step the ship right
035c	left requested?
035d	step the ship left
0360	no move -- just redraw
0363	read the active player's joystick
0366	right pressed?
0368	step the ship right
036b	left pressed?
036c	step the ship left
036f	point at the ship's sprite descriptor
0372	decode the ship's sprite descriptor
0375	resolve its screen address
0378	blit the ship's sprite column
037d	clear the ship's draw-pending flag
0382	at the right screen bound?
0384	yes -- hold and redraw
0387	nudge the ship one column right
038f	at the left screen bound?
0391	yes -- hold and redraw
0394	nudge the ship one column left
039b	advance one animation frame
039c	take the frame's phase bit
039e	record the animation phase
03a1	shift the phase into the sprite's low-byte offset
03a5	base at the ship's two-frame explosion sprite
03aa	point the sprite descriptor at the selected frame
03b0	cursor already enabled -- move it now
03b4	count the startup-hold down
03b5	still counting -- move the cursor this pass
03b8	hold elapsed -- enable the cursor, then move
03bb	point at the shot's raster-phase byte
03be	is this the raster half the shot belongs to?
03c2	wrong half -- skip so the shot is not torn
03c4	read the player-shot status
03c6	status 0 -- no shot in play
03c9	status 1 -- launch a new shot
03ce	status 2 -- step the shot in flight
03d4	any later status -- run the end-of-shot tally
03d7	status 3 retiring -- count the retire timer down
03d8	timer drained -- the shot is fully gone, reseed it
03de	only the 0x0f frame advances the retire animation
03e0	decode the shot's sprite descriptor
03e3	erase the shot at its current spot
03e8	step the shot to the next explosion cell
03eb	pull the shot's Y back two pixels
03ee	and its X back three
03f2	set the explosion sprite's height to eight rows
03f4	re-decode the descriptor at the moved position
03f7	OR-blit the explosion frame
03fa	bump the status to flying
03fc	read the ship's column
03ff	offset to the muzzle
0401	seat the shot's launch X at the ship's muzzle
0404	decode the shot's sprite descriptor
0407	OR-blit the new shot in
040a	decode the shot's descriptor
0410	erase the shot at its old position
0416	read the shot's per-frame Y step
0419	advance the shot up the screen
041b	store the advanced Y
041e	redraw the shot, testing for a collision
0421	did it hit something?
0425	no hit -- keep flying
0426	latch the hit for the shot resolver
042c	status 5 is the explosion state -- idle this frame
0430	point at the player shot's sprite descriptor
0433	decode it through the shared descriptor loader
0436	decode the shot's descriptor
0439	erase the spent shot
0444	reload the 7-byte shot record from its template so a new shot can fire
0447	read the saucer score-key counter
044a	advance it one step
0451	wrap the key back to its low bound at 0x63
0456	read the saucer direction-sequence counter
0459	advance it one step
045d	is a saucer already on screen?
0461	yes -- leave its movement alone
0462	read the next direction-sequence byte
0465	pick the rightward saucer movement pair
046b	or the leftward saucer movement pair
0471	publish the saucer's step low byte
0474	and its step high byte
0477	read this shot's control byte from its ROM template
047a	refresh the record's control byte each pass
047d	read the shot's step-gate countdown
0481	is the gate still zero?
0482	gate open -- run the shot
0485	still dormant -- wrap the gate word and wait
048f	lift this shot's descriptor strip into the shared scratch buffer
0495	stage this column's shot-rate cells for the shared step routine
049e	step the alien shot
04a1	is the shot mid-explosion?
04a8	yes -- write the working strip back and keep the blowup running
04b3	otherwise reseed the whole record from its ROM template
04b7	check this shot's self-disable flag
04bb	disabled once one alien remains -- do nothing
04bc	gate byte -- this shot only steps when it reads 1
04c7	lift this shot's descriptor strip into the shared scratch buffer
04cd	stage this column's shot-rate cells for the shared step routine
04d6	step the alien shot
04d9	read the firing-column cursor
04e1	wrap the cursor back to its start once it reaches 16
04e7	is the shot mid-explosion?
04ee	yes -- write the working strip back and keep the blowup running
04f9	otherwise reseed the whole record from its ROM template
04fc	how many aliens are left?
0503	just one alien left -- latch this shot off for the rest of the wave
0508	read the firing-column word
050b	stash it for the next pass
0514	lift this shot's descriptor strip into the shared scratch buffer
051a	stage this column's shot-rate cells for the shared step routine
0523	step the alien shot
0526	read the firing-column cursor
052e	wrap the cursor back to its start once it reaches 21
0534	is the shot mid-explosion?
053b	yes -- write the working strip back and keep the blowup running
0546	otherwise reseed the whole record from its ROM template
0549	carry the firing-column word forward for the next pass
0550	park the caller's marker byte where the step routine reads it back
0558	copy the 11-byte object strip into the shared scratch buffer
0560	pour the 11 scratch bytes back into the caller's record
0566	read the shot's status byte
0569	a shot is live -- step it
056c	check the task flags
0571	read the fire-enable gate
0574	task flag 4 forces an immediate launch
0578	not enabled to fire -- nothing to do
057a	reset the launch-attempt counter
057c	read the first per-column rate gate
0584	compare it against the current firing cadence
0588	too soon -- hold fire this frame
0589	read the second per-column rate gate
0591	compare it against the firing cadence
0595	too soon -- hold fire
0597	read the column-select mode
0599	mode 0 -- aim the shot at the player's column
059c	otherwise read the next firing column from the cursor list
05a2	advance the column cursor
05a5	find a live alien down that column
05a8	no alien there -- abort the launch this frame
05a9	convert that alien's grid cell to screen coordinates
05ad	offset the shot just below the alien
05b1	and just to its left
05b4	seat the shot's start coordinate
05bb	bring the shot live
05bf	bump the launch-attempt counter
05c4	is this the shot's raster half?
05c7	wrong half -- wait
05cc	already blowing up -- run the explosion animation
05d0	tick the shot's animation counter
05d1	erase the shot before moving it
05d4	read the shot's current sprite frame
05d7	step the animation by three
05e0	wrap the frame past its ceiling
05e2	store the new sprite frame
05e5	read the shot's coordinate
05e9	add the signed per-frame descent step
05ed	move the shot along its travel
05f0	redraw the shot, testing for a collision
05f3	read the shot's coordinate
05f8	reached the floor band -- blow it up
05fb	did it hit something?
05ff	no -- keep flying
0600	read the shot's coordinate
0605	hit below the shield band -- blow it up
060b	hit above the shield band -- blow it up
060f	hit within the shield band -- cancel the round-start arm
0615	flag the shot as blowing up
061b	aim mode: read the player ship's column
061e	offset to the ship's center
0621	scale it to a grid column
0627	use that column if inside the rack
062a	otherwise clamp to the last column
062f	index the column base -- caller's column minus one
0630	select the active player's alien grid page
0635	five rows to scan down this column
0637	read the alien's liveness byte
063a	found a live alien -- report it
063c	step down to the next cell in the column -- 11 bytes on
0640	keep scanning the column
0643	column empty -- no alien to fire
0647	tick the blowup countdown down one
064b	past the burst's start frame -- check whether it is over
064e	burst starting -- erase the spent shot sprite
0654	swap the descriptor over to the explosion graphic
065a	pull both coordinate bytes back two pixels to center the wider burst
0661	force the burst to six rows tall
0664	draw the explosion
0668	still bursting -- idle this frame
0669	countdown done -- erase the burst so the shot despawns
066c	point at the alien-shot descriptor
066f	decode it
0672	OR-blit the shot, latching any collision
0675	point at the alien-shot sprite descriptor ($2079)
0678	decode that descriptor -- screen address plus sprite geometry
067b	erase the shot -- AND its shifted bits back out of the screen
067e	stash the 16-bit pointer into the $2048 work cell
0683	read the saucer-path mode gate ($2080)
0686	the saucer path runs only when the gate reads 2
0689	point at the saucer object record ($2083)
068c	read the record's first byte -- 0 means no saucer armed
068e	no saucer armed -> service the record through the alien-shot step at $050f
0691	read the saucer-suppress gate ($2056)
0695	when the suppress gate is set, delegate to the alien-shot step at $050f
0698	advance to the saucer on-field flag ($2084)
0699	read whether a saucer is currently on the field
069b	a saucer is already up -> skip the launch decision
069e	read the live-alien tally ($2082)
06a1	the mystery ship only appears while at least 8 aliens remain
06a3	too few aliens left -> no saucer this pass, delegate
06a6	launch the saucer -- raise its on-field flag
06a8	draw the saucer's first frame
06ab	point at the saucer's horizontal position and step pair ($208a)
06ae	service the saucer only in the raster half matching its draw-phase bit
06b2	point at the saucer-hit flag ($2085)
06b7	the saucer was shot -> run its explosion and score sequence
06ba	point at the saucer's horizontal position accumulator ($208a)
06c0	advance the saucer one step across the top of the field
06c1	store the saucer's new horizontal position
06c4	redraw the saucer at its new spot
06cb	still within the visible band? -- low edge at 40
06cd	crossed the left edge -> retire the saucer
06d0	high edge at 225
06d2	crossed the right edge -> retire the saucer
06d6	prepare mask 0xfe -- clear the saucer whine bit
06d8	silence the saucer's continuous whine
06db	step to the hit-sequence phase counter ($2086)
06dc	tick the explosion phase counter down
06de	phase 31 -> fire the explosion tone and draw the burst
06e3	phase 24 -> award the mystery score and show its glyphs
06e8	any other nonzero phase -> hold the score display and keep counting
06ea	phase 0: prepare mask 0xef -- clear the UFO-hit tone bit
06ec	point at the port-5 sound shadow ($2098)
06f0	drop the UFO-hit tone bit from the shadow
06f2	keep only the retained fleet-march select bit
06f4	write the sound port 5 latch
06f9	resolve the saucer's screen address
06fc	blank the saucer's strip off the display
06ff	point at the saucer object record ($2083)
0702	reseed 10 record bytes
0704	restamp the saucer record from its ROM template for the next appearance
0707	mask 0xfe -- clear the saucer whine bit
0709	silence the saucer whine and mirror the shadow to sound port 3
070e	raise the pending-score flag ($20f1) so the main loop banks the value
0711	load the current saucer-score key pointer ($208d)
0714	read the live score key it points at
0715	up to four table entries to scan
0717	point at the score-sprite id table ($1d50)
071a	point at the parallel score-key table ($1d4c)
071d	read this key-table entry
071e	match it against the live key
071f	on a match, take the paired sprite id
0725	walk both tables in lockstep until the key matches
0728	read the matched score-sprite id
0729	stamp it into the saucer sprite record ($2087) for drawing
072f	multiply the key by 16 -- the saucer's point value
0733	store key*16 as the score to add ($20f2)
0736	resolve the death spot to a screen address
0739	draw the three-glyph point value at the death spot
073c	resolve the saucer record to a screen address and gfx pointer
073f	blit the saucer's column into video RAM -- byte-aligned
0742	point at the saucer sprite record ($2087)
0745	decode its five-byte descriptor -- gfx pointer plus packed coordinate
0748	fold the coordinate into a video-RAM address
074b	select bit 4 -- the UFO-explosion tone
074d	point at the port-5 sound shadow ($2098)
0751	raise the UFO-explosion tone bit
0753	latch the two high sound-select bits out to sound port 5
0756	point at the saucer-explosion graphic ($1d7c)
0759	repoint the saucer record at the burst graphic
075c	draw the burst so the bang and the flash land the same frame
075f	point the byte-mover at the ROM object template ($1b83)
0762	copy the template bytes into the caller's object record
0767	latch the credit-screen-shown flag ($2093) so it draws once
076a	reset the stack pointer to the top of work RAM ($2400)
076d	re-enable interrupts
076e	repaint the credit readout
0771	clear the play-field
077c	draw the 4-glyph push-start prompt near the top of the screen
077f	read the banked credit tally ($20eb)
0782	is exactly one credit banked?
0788	two or more credits -> also offer the two-player start
078b	point at the one-player select prompt text ($1acf)
078e	draw the one-player select prompt
0791	read the start-button input port 1
0793	one-player start button -- bit 2
0795	no start pressed -> poll again next frame
0798	one-player start: deduct one credit (0x99 = BCD -1)
079a	one-player mode flag (0)
079b	record the player-count mode ($20ce)
079e	read the credit tally
07a1	charge the started game's credits -- BCD-add the deduction
07a6	repaint the credit readout
07ac	zero player 1's score value ($20f8)
07af	zero player 2's score value ($20fc)
07b2	repaint player 1's score line
07b5	repaint player 2's score line
07b8	drop the game-active flag -- the round chain re-raises it
07bf	raise the game-in-progress flag ($20ef)
07c2	seed the per-player flag pair at $20e7 to 1/1
07c5	arm both players' extra-ship award ($20e5)
07c8	repaint the whole score panel
07cb	lay in fresh shields for player 1
07ce	lay in fresh shields for player 2
07d1	read the starting-ship count from the dip switches
07d4	store it as player 1's reserve-ship count ($21ff)
07d7	store it as player 2's reserve-ship count ($22ff)
07da	seed the per-player fleet-step cells and blank the fixed strip
07de	zero player 1's round counter ($21fe)
07e1	zero player 2's round counter ($22fe)
07e4	mark player 1's whole alien field alive
07e7	mark player 2's whole alien field alive
07ea	the fleet's starting reference corner (0x3878)
07ed	seat it as player 1's saved fleet coordinate ($21fc)
07f0	seat it as player 2's saved fleet coordinate ($22fc)
07f3	reseed work RAM from its ROM image
07f6	take the first ship into play and repaint the ships readout
07f9	play the round-start splash -- hold ~176 frames flashing the score
07fc	wipe the play-field for the new round
0801	clear the per-frame drawing-task flags ($20c1)
0804	repaint the bottom ground line
0807	read the active-player page byte ($2067)
080a	test the active-player select bit
080b	player 1 -> restore player 1's shields and enter the round
080e	restore player 2's saved shields onto the field
0811	repaint the bottom line after the shield restore
0814	reload this player's saved fleet position so the march resumes
0817	raise the master game-active flag -- play begins
081c	cue the round-start sound (port-3 mask 0x20)
081f	advance the pre-round arm step / player-shot arm
0822	step the player shot and reverse-and-drop the fleet at an edge
0825	recount the surviving aliens into the tally ($2082)
0828	fold any queued score into the player's running total
082b	read the live-alien tally
082f	wave cleared -> hand off to this player's next round
0832	pick the alien-shot cadence from how thin the fleet is
0835	grant the one-time bonus ship at the score threshold
0838	speed the alien shots when only a few aliens remain
083b	match the player-shot sound bit to whether a shot is in flight
083e	check the round-start arm trigger
0841	skip the round-start blip when the arm trigger is set
0846	play the round-start sound cue (0x04)
0849	advance the fleet-march footstep pitch and tempo
084c	kick the hardware watchdog (port 6) -- each frame or it resets
084e	drive the saucer whine on and off from its flags
0851	repeat the frame loop
0857	point at the two-player select prompt text ($1aba)
085a	draw the two-player select prompt
085d	a two-player start would deduct two credits (0x98 = BCD -2)
085f	read the start-button input port 1
0862	two-player start button -- bit 1
0863	two-player start pressed -> begin a two-player game
0866	one-player start button -- bit 2
0867	one-player start pressed -> begin a one-player game
086a	no start pressed -> poll again next frame
086d	two-player mode flag (1)
086f	enter the shared game-start init
0872	restore player 1's saved shields onto the field
0875	enter the round with the field reloaded
0878	read the working alien count ($2008)
087c	read the reference-alien coordinate word ($2009)
0880	aim at the active player's field-save slot
0886	read the active-player page byte ($2067)
0889	use it as the record's high byte
088a	pin the low byte to 0xfc -- the field-save record at page:0xfc
088d	aim at the round-start banner's on-screen position
0895	lay down the 14-glyph round-start banner
0898	read the active-player select bit
08a1	for player 2, add one more banner sprite
08a6	hold ~176 frames -- seed the vblank-drained delay timer ($20c0)
08a9	read the delay timer the interrupt drains
08ad	the splash ends when the timer reaches 0
08ae	flash phase -- bit 2 of the counter
08b0	off half -> blank the score strip
08b3	on half -> point at the active player's score record
08b6	repaint the active player's score
08b9	hold this frame and re-test the timer
08bc	score-strip width 0x20
08be	player 1's score-strip address
08c5	select the score strip for the active player
08c8	player 2's score-strip address
08cb	blank the score strip -- the off half of the flash
08ce	hold this frame and re-test the timer
08d1	read hardware input port 2 -- carries the starting-ships dip switch
08d3	keep the low two bits -- the ships-count selection
08d5	bias up by three -- a 3..6 starting-ship count
08d8	read the live-alien tally
08db	compare it against nine
08dd	leave the alien-shot step untouched while nine or more aliens remain
08de	load the fast alien-shot descent step
08e0	stamp it as the alien shots' per-frame Y step once the fleet is thin
08e4	read the two-player-game flag
08e7	test the two-player flag
08e8	in a two-player game, leave the screen strip alone
08e9	point at the fixed screen strip to blank
08ec	set the run length to 0x20 columns
08ee	hand off to the strip clearer to zero the run
08f1	fix the glyph count at three -- falls into the sprite-list driver
08f3	fetch the next sprite id from the list
08f5	draw the glyph for that id
08f9	step to the next sprite id
08fa	count down the remaining glyphs
08fb	loop until the whole run is drawn
08ff	point at the base of the 8-bytes-per-glyph sprite bitmap table
0903	clear the index high byte
0905	seat the sprite id as the low index byte
0906	double the index
0907	double it again
0908	double a third time -- id x8, eight bytes per glyph
0909	add the table base -> the glyph's eight source bytes
090c	set the column height to eight rows
090e	kick the hardware watchdog
0910	blit the glyph's eight-row column into video memory
0913	read the fleet-position anchor low byte -- the saucer-timer gate
0916	compare it against 0x78
0918	freeze the saucer timer this pass unless the anchor is below 0x78
0919	read the 16-bit saucer-spawn countdown
091d	test whether the countdown has reached zero
091e	skip the reload while the countdown is still running
0921	reload the countdown to its fixed spawn interval
0924	raise the saucer-arm flag value
0926	arm the mystery saucer so its handler may launch one
0929	count the timer down by one
092a	store the updated countdown back
092e	form the active player's page base (page<<8)
0931	address the top byte of that page -- the reserve-ship count
0933	read the reserve-ship count
0935	get the active player's flag-pair slot
0938	step back two bytes...
0939	...to the "extra ship not yet awarded" flag
093a	read that award flag
093b	test the award flag
093c	bail if the bonus ship was already granted this game
093d	default the bonus threshold to BCD 1500
093f	read input port 2 -- the bonus-score dip switch
0941	isolate the bonus-score dip bit
0943	keep the 1500 threshold when the dip is clear
0946	else select the BCD 1000 bonus threshold
0948	point at the active player's score record
094b	step to its high byte -- the top two BCD score digits
094c	read that score byte
094d	compare the score against the bonus threshold
094e	bail until the score reaches the threshold
094f	address the reserve-ship count at the top of the player's page
0952	award the extra ship -- bump the reserve count by one
0953	read the new reserve count
0955	seat the reserve-icon row base column
0958	step the icon column forward...
0959	...by two per reserve ship
095a	count down the ships
095b	walk to the new ship's icon slot
095e	set the icon column height to 16 rows
0960	point at the reserve-ship icon bitmap
0963	blit the reserve-ship icon into its column slot
0967	add the ship in play to get the lives-digit value
0968	redraw the numeric lives digit
096b	re-fetch the active player's flag-pair slot
096e	step back two bytes...
096f	...to the award flag
0970	latch the award flag off -- the bonus fires only once per game
0972	set a long one-shot window...
0974	...into the sound-off timer so the award chime rings out
0977	select sound bit 4 -- the extra-ship chime
0979	cue the award chime
097c	point at the base of the three-tier invader score table
097f	compare the invader-tier key against two
0981	select the first tier's score entry when the key is below two
0982	else advance to the second tier's entry
0983	compare the key against four
0985	select the second tier when the key is below four
0986	else advance to the third tier's entry
0988	point HL at the active player's score record
098b	read the pending score-add flag
098e	test whether a score add is queued
098f	return early when nothing is pending
0991	clear the pending flag so the next kill re-arms it
0995	read the queued two-byte score delta
099a	read the score's low BCD byte
099b	add the delta's low byte
099c	decimal-adjust to keep valid BCD digits
099d	store the updated low score byte
09a0	read the score's high BCD byte
09a1	add the delta's high byte with the decimal carry
09a2	decimal-adjust the high byte
09a3	store the updated high score byte
09a6	read the low byte of the score's stored screen address
09a8	read the high byte -- HL now points at the score on screen
09aa	repaint the new four-digit total
09ae	draw the two most-significant digits -- the score's high byte
09b1	load the low byte and fall through to draw its two digits
09b4	shift the high nibble down to the low four bits -- four rotates
09b8	isolate the high decimal digit
09ba	plot the high digit glyph
09be	isolate the low decimal digit
09c0	plot the low digit glyph
09c5	add 0x1a to reach that digit's glyph id in the sprite table
09c7	plot the digit as an 8x8 glyph
09ca	read the active-player selector
09cd	rotate the player bit into carry
09ce	point HL at player 1's score record
09d1	keep it when player 1 is active
09d2	otherwise point at player 2's score record
09d6	point at the first play-area byte -- past the two-byte bottom margin
09d9	blank the current framebuffer byte
09db	step one byte down the column
09dd	take the within-column offset -- low five bits
09df	check whether this column's play area is finished
09e1	stay in the play area until the reserved band is reached
09e7	skip the six reserved band bytes to the next column's play area
09e9	check whether the sweep has passed the end of video RAM
09eb	loop until every column is cleared
09ef	wait out the between-round handshake
09f3	drop the game-active flag for the handoff
09f6	wipe the play area
09f9	read the active-player selector before the work-RAM reseed
09fc	save the selector -- the reseed overwrites this cell
09fd	restamp work RAM from the ROM template
0a00	recover the saved selector
0a01	restore it so the same player continues
0a04	read the active player's page
0a09	address this player's round counter at page:0xfe
0a0b	read the round counter
0a0c	mask to the low three bits -- rounds 0-7
0a0e	advance to the next round
0a0f	store the bumped round index
0a10	point at the round fleet-start table
0a13	step the table pointer forward one entry per round index
0a18	read this round's fleet-start byte
0a1a	address this player's field-save record at page:0xfc
0a1c	seed the fleet reference-alien low byte for the new round
0a1e	set the fixed reference-alien high byte -- 0x38
0a21	rotate the page bit into carry to pick the player
0a22	branch to the player-1 refill when player 1 is active
0a25	load player 2's sound-select value
0a27	seed player 2's port-5 sound latch shadow
0a2a	re-stock player 2's shield buffers
0a2d	mark all of player 2's aliens alive
0a30	enter the round-start preamble
0a33	re-stock player 1's shield buffers
0a36	mark all of player 1's aliens alive
0a39	enter the round-start preamble
0a3c	poll the round-start arm trigger
0a3f	if not yet armed, wait for it to arm
0a42	load a 48-frame hold
0a44	seat the frame-delay countdown
0a47	read the frame-delay countdown
0a4b	proceed once the hold times out
0a4c	re-poll the arm trigger
0a4f	keep holding while still armed
0a52	wait for the arm trigger to read armed
0a55	loop until it arms
0a59	read the round-start arm sentinel
0a5c	test whether it holds the armed value 0xff
0a5f	read the game-in-progress flag
0a63	skip scoring and sound during the attract demo
0a67	select the invader-die sound -- port-3 bit 3
0a69	fire the invader-die tone
0a6e	look up this alien row's point value
0a71	read the point value byte
0a72	address the pending score-add packet
0a75	clear the delta's high byte -- a single-byte value
0a78	stage the point value as the pending delta
0a7a	raise the pending flag so the score is folded in later
0a7c	return the kill-explosion sprite descriptor pointer
0a80	select the attract-animation task bit
0a82	arm the interrupt-driven title animation task
0a85	kick the hardware watchdog while spinning
0a87	read the animation-done flag
0a8b	spin until the interrupt signals the animation finished
0a8f	disarm the task so the interrupt stops servicing it
0a94	read the current glyph id from the source list
0a95	draw the glyph, advancing the screen destination
0a99	load the 7-frame typing pace
0a9b	seat the frame-delay countdown
0a9e	read the frame-delay countdown
0aa2	wait the pace out -- one frame per pass
0aa5	advance to the next glyph id
0aa6	count this glyph off
0aa7	repeat until the run is drawn
0aab	point HL at the attract-animation object scratch
0ab1	load the 0x40-frame short attract delay count
0ab3	wait that many displayed frames on the frame counter
0ab6	load the 0x80-frame long attract delay count
0ab8	wait that many displayed frames on the frame counter
0abb	discard the dispatcher's return address
0abc	run the per-frame demo record tail -- draw the pending alien, tick the saucer-spawn timer -- exiting through the interrupt epilogue
0abf	read the per-frame task bitfield
0ac2	shift task bit 0 into carry
0ac3	bit 0 set -- run the demo record tail
0ac6	test task bit 1
0ac7	bit 1 set -- step one scripted-animation frame
0aca	test task bit 2
0acb	bit 2 set -- run the attract-object handler
0ace	no frame task queued -- return
0acf	point at the fixed attract-body screen destination
0ad2	set the 0x0f-glyph block length
0ad4	type the block one glyph per cadence window from the caller's source
0ad7	seed the frame-delay counter with the requested count
0ada	re-read the frame-delay counter
0add	test whether it has reached zero
0ade	keep waiting while the interrupt drains it toward zero
0ae2	point at the animation state block -- frame counter plus coordinate steps
0ae5	set the 12-byte copy length
0ae7	copy the draw sequence from the caller's source into the animation slot
0aea	clear A to silence the sound ports
0aeb	silence the discrete-sound output port
0aed	silence the fleet-march and saucer sound port
0aef	clear the per-frame task flags
0af2	enable interrupts so the frame heartbeat paces the delays
0af3	hold for the short attract delay
0af6	read the attract-screen alternator
0af9	test which of the two attract screens to show
0afa	point at the heading's screen destination
0afd	set the 4-glyph heading length
0aff	on the alternate attract screen, type the PLAY heading instead
0b02	select the default attract-heading text source
0b05	type the heading one glyph per cadence window
0b08	point at the SPACE INVADERS title-block source
0b0b	type the 0x0f-glyph title block
0b0e	short attract delay
0b11	draw the score-advance points table
0b14	long attract delay
0b17	re-read the attract-screen alternator
0b1a	test the screen mode
0b1b	skip the reveal sequence on the alternate screen
0b1e	point at the first reveal draw sequence
0b21	load it into the animation slot
0b24	arm the animation task and wait for the reveal to finish
0b27	point at the second reveal draw sequence
0b2a	load it into the animation slot
0b2d	run the second reveal
0b30	short attract delay
0b33	point at the third reveal draw sequence
0b36	load it into the animation slot
0b39	run the third reveal
0b3c	short attract delay
0b3f	point at the screen strip to clear
0b42	set the 0x0a-row clear height
0b44	blank that screen strip
0b47	long attract delay
0b4a	clear the playfield -- leaving the score band and status line
0b4d	read the starting-ships latch
0b50	test whether the reserve-ship count has been seeded
0b51	skip seeding when it is already set
0b54	read the starting-ships dip setting
0b57	store it as the reserve-ship count
0b5a	decrement the ship count and paint its readout
0b5d	reseed work RAM from the ROM image
0b60	mark a full player-1 alien wave alive
0b63	initialize the player-1 shield buffers
0b66	paint the player-1 shields
0b69	arm the demo's per-frame record task -- bit 0
0b6b	store it into the task bitfield
0b6e	draw the ground line across the bottom of the field
0b71	advance the demo/round state one step
0b74	run the fleet-edge update and the input-gated copyright draw
0b77	kick the watchdog with the result
0b79	poll the round-state arm trigger
0b7c	loop back to keep running the demo until the round-state trigger changes
0b80	clear the player-shot status
0b83	poll the arm trigger again
0b86	spin here until the round-state trigger settles before teardown
0b8a	clear the per-frame task bitfield -- nothing queued during teardown
0b8d	short settle delay
0b90	blank the play field
0b93	set the 0x0c-glyph panel length
0b95	point at the insert-coin panel screen destination
0b98	point at the insert-coin glyph-id source
0b9b	draw the sprite-list panel
0b9e	read the attract-screen alternator
0ba1	test for the first attract screen
0ba3	skip the extra glyph on the alternate screen
0ba6	point at the extra glyph's screen destination
0ba9	select sprite id 0x02
0bab	draw that single 8x8 glyph
0bae	point at the draw-record source
0bb1	fetch the next draw record -- destination plus glyph source
0bb4	type the record out glyph by glyph
0bb7	read input port 2
0bb9	shift the second-script select bit into carry
0bba	skip the extra script when that bit is set
0bbd	point at the extra draw script
0bc0	type the extra draw script
0bc3	long hold so the screen can be read
0bc6	read the attract-screen alternator
0bc9	test for the first attract screen
0bcb	skip the reveal animation on the alternate screen
0bce	point at the reveal draw sequence
0bd1	load it into the animation slot
0bd4	arm the animation task and wait for it
0bd7	run the interrupt-handshaked reveal animation
0bda	point at the attract-screen alternator
0bdd	read its current value
0bde	bump it
0bdf	keep only the low bit -- flip between the two screens
0be1	store the flipped alternator
0be2	clear the playfield
0be5	rejoin the top of the attract cycle
0be8	select the PLAY attract-heading source
0beb	type that heading
0bee	rejoin the attract setup after the heading
0bf1	resolve the in-flight player shot and update the fleet's edge and direction
0bf4	tail into the input-gated copyright draw
1401	seat the shifter offset and resolve the screen destination
1407	fetch the next source byte
1408	feed it to the hardware bit shifter
140a	read back the aligned low half
140c	merge it into the current screen byte, preserving what is already there
140d	store the merged low half
140e	point at the next screen byte -- the high half
140f	advance the source pointer
1410	zero the shifter input
1411	clock the shifter with zero to get the overflow half
1413	read that high half
1415	merge it into the next screen byte, preserving the background
1416	store the merged high half
1418	one screen-row stride
141b	step the destination down one screen row
141d	count down the rows
141e	repeat for each sprite row
1424	seat the shifter offset and resolve the screen destination
142a	clear the first screen byte
142c	clear the second, adjacent screen byte
142f	one screen-row stride
1432	step the destination down one screen row
1434	count down the rows
1435	repeat for each row of the sprite footprint
143a	read the next source byte of the sprite column
143b	write it into the current screen cell
143c	advance the source one byte
1440	drop the destination one framebuffer row (0x20) -- bytes stack into a vertical column
1442	count the row down
1443	loop until the whole column is copied
1452	seat the shift alignment and resolve the first row's screen address
1457	read the sprite's source byte for this row
1458	feed the source byte to the board's bit shifter
145a	read back the pixel-aligned first half
145c	complement it into a clear-mask
145d	AND the mask into the left screen byte -- clearing the sprite's set bits
145f	advance to the adjacent screen byte
1460	advance the source one byte
1462	feed zero to the shifter for the carried-over half
1464	read the shifted second half
1466	complement it into a clear-mask
1467	AND it into the right screen byte -- clearing the spilled bits
146d	step down one framebuffer row (0x20)
146f	count the row down
1470	repeat for each sprite row
1475	keep the low 3 bits of the coordinate -- the sub-byte pixel offset
1477	latch that offset into the board's bit shifter (port 0x02)
1479	fold the coordinate into a video-RAM byte address
147e	read a screen byte of the rectangle
147f	append it to the destination stream
1480	advance the destination stream one byte
1481	advance one byte down the screen column
1482	count down the bytes in this column
1483	loop over the column's bytes
148a	re-base to the next screen column (0x20 over)
148c	count down the columns
148d	loop over each column of the rectangle
1491	seat the shift alignment and the first row's screen address
1495	clear the collision flag before the blit
149a	read the sprite's source byte for this row
149b	feed it to the board's bit shifter
149d	read back the pixel-aligned first half
14a0	test the shifted half against what is already on screen
14a1	skip ahead if there is no overlap
14a6	set the collision flag on overlap
14aa	OR the half onto the left screen byte -- merging without erasing
14ac	advance to the adjacent screen byte
14ad	advance the source one byte
14af	feed zero to the shifter for the carried-over half
14b1	read the shifted second half
14b4	test the second half against the screen
14b5	skip ahead if there is no overlap
14ba	set the collision flag on overlap
14be	OR the second half onto the adjacent screen byte
14c4	step down one framebuffer row (0x20)
14c6	count the row down
14c7	repeat for each sprite row
14cb	select black (0) as the fill value, then fall into the row fill
14cd	write the fill byte into the screen cell
14d1	step one framebuffer column over (0x20)
14d3	count down the columns
14d4	loop across the screen width
14d8	read the player-shot state
14db	check for the exploding state
14dd	return if the shot is already exploding
14de	check for the in-flight state
14e0	return unless the shot is airborne
14e1	read the shot's Y position
14e4	compare it against the top of the play area
14e7	if the shot ran off the top, stand it down -- a clean miss
14ea	read the shot's collision latch
14ed	test whether anything was actually struck
14ee	return if the shot has hit nothing yet
14f0	compare the Y against the flying-saucer altitude band
14f2	within the saucer band -- score the saucer and retire the shot
14f5	bias the Y by +6 onto the alien-rack coordinate
14f8	read the fleet's reference-X anchor
14fb	check whether that anchor is still in range
14fd	skip the rack bounds guard when the anchor is out of range
1500	compare the anchor against the shot's rack coordinate
1501	stand down if the shot is outside the live rack
1505	scale the rack coordinate to a fleet-grid column index
1508	read the shot's companion coordinate
150c	scale that coordinate to a grid residual
150f	stash the packed grid residual for the explosion despawn
1514	commit the shot to the exploding state (5)
1517	resolve the alien's liveness cell in the active player's grid
151a	read that grid cell
151b	test whether the alien is alive
151c	stand down if the cell is already dead -- the shot hit empty space
151f	clear the cell -- the alien dies
1521	queue the invader's points and fire the invader-die sound
1524	decode the explosion sprite descriptor
1527	draw the explosion burst
152c	arm the explosion despawn timer
1532	set the shot to the stand-down state (3)
1535	clear the hit latch and silence the die tone
1538	point at the explosion despawn timer
153b	count the despawn timer down one tick
153c	return while the explosion is still showing
153d	reload the explosion's stored screen position
1542	clear the explosion sprite's sixteen-row column
1547	set the shot to its retiring state (4)
154b	clear the player-shot collision latch -- re-arm hit detection for the next shot
154e	load the AND mask that clears only the invader-die sound bit (0xf7 = all but bit 3)
1550	clear that port-3 sound bit -- silence the invader-die tone
1554	zero the grid-step counter
1556	compare the coordinate against the threshold
1557	if the coordinate already reads at/above the threshold, lift it up into range first
155a	compare the coordinate against the threshold
155b	return once the coordinate reaches or passes the threshold -- the count is the block index
155c	add one 16-pixel grid step to the coordinate
155e	bump the step count
155f	keep stepping
1562	read the fleet's reference X base
1565	put the target X coordinate into H as the threshold
1566	count 16-pixel steps from the base up to the coordinate
1569	copy the step count into B
156a	turn it into a 0-based block index
156b	back off one full 16-pixel step to leave the residual within the block
156d	mirror the residual into L
156f	read the fleet's reference Y base
1572	count 16-pixel steps from the base up to the Y coordinate
1575	back off one full 16-pixel step to leave the residual
1577	mirror the residual into H
157b	raise the saucer-hit flag -- the saucer switches into its explosion and score run
157e	retire the player shot that struck it
1581	take the alien row/block index
1582	rotate left -- x2
1583	rotate left -- x4
1584	rotate left -- x8 of the row index
1585	add the row index...
1586	...again...
1587	...again -- total x11, the grid's 11-column row stride
1588	add the column offset
1589	subtract one for the 1-based bias -- the low byte now indexes the alien in the 55-cell grid
158a	stash that grid offset as the pointer low byte
158b	read the active player's field page number
158e	form the pointer high byte -- HL now points at this alien's liveness byte
1590	count a 16-pixel step
1591	add one 16-pixel step, lifting the value toward range
1593	keep stepping while the value still reads negative (sign bit set)
1597	read the fleet's horizontal heading
159a	test the heading
159b	if sweeping left (nonzero), branch to test the left edge
159e	sweeping right -- point at the right-edge screen column
15a1	scan that column for an alien pixel
15a4	not at the edge yet -- leave the fleet state untouched and return
15a5	reached the right edge: set the new step to -2 pixels (turn to move left)
15a7	set the new heading to moving-left
15a9	publish the new heading
15ad	publish the new horizontal step
15b0	read the one-row drop delta
15b3	arm the one-row descent for the next sweep
15b7	sweeping left -- point at the left-edge screen column
15ba	scan that column for an alien pixel
15bd	not at the edge yet -- leave the fleet state untouched and return
15be	reached the left edge: fetch the rightward step size (2, or 3 when one alien remains)
15c1	set the new heading to moving-right (zero)
15c2	publish the heading and step, then arm the row drop
15c5	scan 23 bytes -- the height of the edge column
15c7	read the next column byte
15c8	test it
15c9	a nonzero byte is a lit alien pixel -- report the edge reached (carry set)
15cc	step up to the next byte in the column
15cd	count down the remaining bytes
15ce	keep scanning the column
15d3	seat the shift alignment (L's low 3 bits) and fold the coordinate into a screen address
15d9	read this source row's byte
15da	feed the source byte into the hardware bit shifter (port 4)
15dc	read back the pixel-shifted left half (port 3)
15de	store the left half to the current screen byte
15df	step to the neighbouring screen byte
15e0	advance to the next source byte
15e2	feed a zero into the shifter to fetch the spilled-over half
15e4	read back the right half the shift pushed into the next byte
15e6	store the right half one byte over
15e8	load the one-screen-row stride (0x20)
15eb	drop the destination pointer down one screen row
15ed	count down the source rows
15ee	keep drawing while rows remain
15f3	point HL at the active player's alien-field page
15f6	prime the sweep -- 0x37 (55) grid cells to scan, survivor count starts at zero
15f9	read a liveness cell
15fb	dead alien (cell zero) -- do not count it
15fe	live alien -- bump the survivor count
15ff	step to the next grid cell
1601	loop across all 55 cells
1605	publish the live-alien tally that fleet tempo and wave-end read
1608	exactly one alien left?
160a	return unless a single survivor remains
160e	raise the lone-survivor flag
1611	zero the low byte -- the page base sits at offset 0
1613	read which player's page is live (0x21 or 0x22)
1616	form page<<8 as the page base address
1618	read the round-arm sentinel
161b	is the round armed (sentinel 0xff)?
161d	return unless the round is armed
1621	read the first field-object cell
1623	read the second field-object cell
1625	return while the field is still busy (either cell nonzero)
1626	read the player-shot status
162a	return while a player shot is already in flight
162b	read the game-in-progress flag
162f	no game running -> take the scripted-demo path
1632	read the fire-button latch
1636	latch already set -> go wait for the button to release
1639	read the active player's controls
163c	isolate the fire button (bit 4)
163e	return if the fire button is not pressed
1641	arm the player's shot
1644	latch the press so it counts as a single shot
1648	read the active player's controls
164b	isolate the fire button
164d	keep waiting while the button is still held
164e	button released -- clear the fire latch so a new press can fire
1655	mark a scripted-demo shot as armed
1657	load the scripted-demo pointer
165a	step the demo pointer forward one byte
165c	past the end of the demo window?
1661	wrap the demo pointer back to the window start (0x74)
1663	store the advanced demo pointer
1666	read the byte the demo pointer now names
1667	drive the demo ship's direction from it
166b	set the carry flag -- a return-true helper
166d	clear A for the reserve-lives digit
166e	redraw the reserve-lives digit
1671	point at the active-player in-play flag
1674	clear the active player's in-play flag
1676	point at the active player's score record
1679	advance to the score's high byte
167a	point at the stored high-score record
167e	compare the player's score against the high score (high byte)
1682	high bytes equal -> compare the low byte
1685	high score still leads -> leave it
1688	player beat it -> take the new high score
168b	compare the low byte
168c	high score still leads -> leave it
168f	copy the player's score...
1690	...into the high-score record low byte
1693	read the player's score high byte
1694	...and store its high byte
1695	redraw the high-score readout
1698	read the two-player-game flag
169c	single-player game -> skip the two-player banner
169f	point at the two-player game-over banner position
16a7	type out the game-over text run
16ac	default to the player-1 number glyph
16ae	read which player is active
16b1	test the active-player bit
16b5	switch to the player-2 number glyph
16b8	draw the player-number glyph
16bb	hold for a short delay
16be	point at the other player's flag
16c1	read the other player's flag
16c3	other player is out too -> continue to game over
16c6	other player still has ships -> hand the machine to them
16c9	point at the game-over field-clear text position
16d1	type out the closing text run
16d4	hold for a long delay
16d7	clear the playfield
16db	mark the game no longer in progress
16de	silence the fleet-march sound port
16e0	set the game-active state flag
16e3	drop back into the attract cycle
16e6	reset the stack pointer to the top of RAM
16e9	re-enable interrupts
16eb	clear the round-arm sentinel
16ee	run the player-shot collision step for the death animation
16f1	select port-3 bit 2 -- the base-explosion cue
16f3	sound the base-explosion cue each pass
16f6	test the round-arm trigger
16f9	loop the death animation until the trigger clears
16fc	clear the game-active state flag
16ff	point at the reserve-ship icons screen position
1702	clear the reserve-ship icon region
1705	clear A for the reserve-lives digit
1706	redraw the reserve-lives digit
1709	mask to clear the base-explosion cue (port-3 bit 2)
170b	jump into the score-panel redraw
170e	point at the active player's score record
1711	step to the score's high byte -- the difficulty key
1712	read the difficulty key
1713	point at the score-threshold table
1716	point at the parallel fire-cadence table
1719	four score bands to test
171c	read the current band's threshold
171d	compare it against the score key
171e	threshold reaches the key -> take this band's cadence
1721	advance the cadence pointer to the next band
1722	advance the threshold pointer to the next band
1724	keep scanning the bands
1727	read the matching fire-cadence byte
1728	publish the alien-fire cadence the shot stepper reads
172c	read the player-shot status
1731	a shot is in flight -> raise the shot cue
1734	mask to clear the player-shot cue (port-3 bit 1)
1736	no shot -> silence the player-shot cue
1739	mask to set the player-shot cue (port-3 bit 1)
173b	sound the player-shot cue while the shot is live
1740	point at the note-off countdown
1743	tick the note-off countdown
1744	on zero, cut the current march note
1747	read the fleet-march enable flag
174b	march disabled -> silence and stop this tick
174e	point at the beat countdown
1751	tick the beat countdown
1752	no footstep until the beat expires
1757	sound the current march tone on port 5
1759	read the live-alien count
175d	last alien gone -> let this beat fade without re-arming
1761	read the tempo period
1763	reload the beat countdown from the tempo period
1765	ask the frame loop to step the march pitch and tempo
1769	ring this note for four ticks before the note-off timer cuts it
176d	load the port-5 sound shadow to mute the march tone from
1770	keep only the two latched high bits -- mute the four march tones
1772	drive the latched bits onto sound port 5
1775	read the march beat trigger
1779	no fresh beat -> skip to the SFX-off tick
177c	point at the fleet-rate thresholds table
177f	point at the parallel beat-period table
1782	read the live-alien count
1785	compare it against the current rate threshold
1786	count reaches the threshold -> take this band's period
1789	advance the threshold pointer to the next band
178a	advance the period pointer to the next band
178b	test the next band
178e	read the matching beat period
178f	set the march tempo the metronome reloads from
1792	point at the port-5 sound shadow
1796	hold the two latched high bits aside -- a ringing saucer-hit
179a	take the low march-tone nibble
179c	rotate the lit tone bit up one step -- the four-note march
179d	did the tone roll past the nibble?
17a2	wrap the march tone back to the first note
17a4	merge the latched high bits back in
17a5	store the stepped march tone
17a7	clear the beat trigger now that it is serviced
17aa	point at the one-shot SFX-off timer
17ad	count down the SFX-off window
17ae	still running -> leave the cue alone
17af	mask to clear the port-3 one-shot cue (bit 4)
17b1	window expired -> auto-silence that one-shot cue
17c0	read the active-player selector byte
17c3	rotate the player-1/player-2 select bit into carry
17c4	selector clear (player 2) -- go read input port 2
17c7	read player 1's control input port
17ca	read player 2's control input port
17cd	read input port 2 -- carries the tilt switch
17cf	isolate the tilt-switch bit
17d1	not tilted -- return
17d2	load the tilt-in-progress flag
17d6	tilt already being handled -- return
17d7	reset the stack pointer to the top of work RAM
17dc	blank the playfield
17e0	repeat the clear four times
17e5	raise the tilt-in-progress flag
17e8	clear the game-active flag
17eb	re-enable interrupts
17ec	point at the tilt-message glyph string
17ef	point at its screen destination
17f2	four glyphs to type
17f4	type the tilt message onto the screen at the paced cadence
17f7	wait a short delay
17fb	clear the tilt-in-progress flag
1801	jump back to the main loop
1804	point at the flying-saucer active flag
1809	no saucer on screen -- silence the saucer whine
180c	step to the saucer-hit flag
180f	saucer already shot -- leave the sound latch alone so its death tone rings
1810	select the saucer-whine sound bit
1812	hold the continuous saucer whine on
1815	point the header blit at its screen destination
1818	point at the score-advance header's sprite-id list
181b	21 sprite ids to lay down
181d	draw the score-advance header line
1822	set the typed cadence to ten frames per glyph
1825	point the cursor at the first, no-delay draw script
1828	pull the next four-byte draw record
182b	table terminator -- tail into the second, typed script
182e	blit this record as a fixed 16-row sprite column
1831	loop to the next record
1837	point the cursor at the second attract draw script
183a	pull the next draw record from the script
183d	script terminator -- done
183e	type this record's glyphs at the paced cadence
1841	loop to the next record
1845	fix the column height at 16 rows
1847	copy the 16-row sprite column down the screen
184d	read the typed-output cadence count
1851	type the record's glyphs one at a time, paced per frame
1856	read the record's first byte at the cursor
1857	test it against the 0xff table terminator
1859	arm carry as the end-of-script signal
185a	terminator reached -- return, script finished
185b	start the destination screen address -- low byte
185e	complete the destination screen address in HL
1861	start the graphics-source pointer -- low byte
1864	complete the graphics-source pointer in DE
1866	clear carry -- more records follow
1868	point at the animation frame counter
186b	bump the animation frame counter
186c	step to the coordinate step byte
186d	take the per-frame coordinate step
186e	glide the sprite's screen coordinate forward by the step
1871	keep the progress total -- the coordinate's high byte
1872	load the scripted end coordinate
1875	compare progress against the end point
1876	reached the end -- latch done and stop
1879	reload the frame counter
187c	test counter bit 2 -- the two-pose alternation timer
187e	load the base sprite-graphic pointer
1881	bit set -- keep the base pose
1884	else reach the alternate-pose bank, +0x30
1888	store the chosen sprite source into the frame descriptor
188b	point at the sprite coordinate descriptor
188e	decode the five-byte sprite descriptor
1891	move the screen coordinate into HL for the blit
1892	shift-blit the frame through the hardware bit shifter
189a	raise the animation-done handshake flag
189e	point at the attract-demo object table
18a1	point at the fixed object descriptor template in ROM
18a4	16 bytes to copy
18a6	seed the attract-demo object record from the ROM template
18ab	prime the object's mode byte
18b0	prime the alien-shot step cell
18b5	arm the per-frame interrupt task that walks the attract animation
18b8	read the animation acknowledge flag
18bb	test its handshake bit
18bd	spin until the interrupt raises the acknowledge -- step underway
18c0	reread the acknowledge flag
18c3	test its handshake bit
18c5	spin until the interrupt drops the acknowledge -- step complete
18c8	point at the revealed sprite's screen slot
18cb	select the revealed sprite id
18ce	draw the revealed sprite
18d1	settle for the long attract delay
18d4	seat the stack pointer at the top of work RAM
18d9	stamp work RAM from its baked cold-start image
18dc	paint the static score panel -- header, both scores, high score, credit line
18df	load the attract round/mode seed 0x08
18e1	seed the attract round/mode cell (0x20cf)
18e4	run the attract setup and free-running demo loop
18e7	read the active-player selector byte (0x2067)
18ea	point at the per-player flag pair's base cell (0x20e7)
18ed	rotate the player-select bit into carry
18ee	keep the base cell -- player two -- when the select bit is clear
18ef	otherwise step to the player-one slot (0x20e8)
18f1	preset the fleet's horizontal step to 2 columns
18f3	read the live alien count (0x2082)
18f6	test for exactly one alien left
18f7	keep step 2 while more than one alien remains
18f8	one alien left -- bump the step to 3 so the last alien sprints
18fa	read the port-3 sound-latch shadow (0x2094)
18fd	raise the requested cue bit(s) in the latch
18fe	store the updated latch back to its shadow
1901	write the latch to sound port 3, sounding the cue
1904	point at player two's alien field base (0x2200)
1907	fill the 55 liveness cells with a fresh full fleet
190a	resolve the player shot's collision -- miss, saucer, or alien kill
190d	then run the fleet edge turn -- reverse and drop at a boundary
1910	point at the per-player flag pair's base cell (0x20e7)
1913	read the active-player selector byte (0x2067)
1916	rotate the player-select bit into carry
1917	keep the base cell -- player one -- when the select bit is set
1918	otherwise step to the player-two slot (0x20e8)
191a	set the glyph count to 0x1c -- 28 glyphs for the header line
191c	point at the header's fixed screen slot (0x241e)
191f	point at the preset header text ids (0x1ae4)
1922	draw the 28-glyph header line through the sprite-list driver
1925	point at player one's four-byte score record (0x20f8)
1928	unpack the record and paint its BCD score
192b	point at player two's score record
192e	fall into the shared score-record drawer
1931	read the score value's low BCD byte
1933	read the score value's high BCD byte
1935	read the record's screen-address low byte
1937	read the record's screen-address high byte
1938	seat HL at the record's own screen slot
1939	draw the value as four BCD digits at that slot
193c	set the glyph count to seven -- the CREDIT letters
193e	point at the credit label's screen slot
1941	point at the CREDIT label's glyph-id list
1944	blit the seven-glyph label run
1947	read the BCD credit tally
194a	point at the credit-count screen slot
194d	draw the tally as two decimal digits
1950	point at the high-score record
1953	fall into the shared score-record drawer
1956	blank the whole video window
1959	draw the score header line
195c	repaint player one's score
195f	repaint player two's score
1962	repaint the high score
1965	draw the CREDIT label
1968	draw the credit tally
196b	mask a bit off the sound-port-3 shadow and mirror it out
1973	raise the record-0 warm-restart suppress flag
1982	store the per-frame task bitfield
1988	clear the play-field interior -- keep the score band and status strip
199a	read the one-shot input-code stage latch
199d	test whether the first stage is still pending
199e	if already latched, skip to the second code check
19a1	read input port 1
19a3	keep only the code bits -- mask 0x76
19a5	demand the first code 0x72
19a7	bail with no draw unless it matches
19a8	bump the accumulator to one -- the latch value
19a9	latch stage one so later frames skip straight to stage two
19ac	re-read input port 1 for the second code
19ae	keep only the code bits -- mask 0x76
19b0	demand the second code 0x34
19b2	bail with no draw until it is present
19b3	point at the copyright line's screen slot
19b6	point at the copyright glyph-id list
19b9	set the glyph count to nine
19bb	blit the nine-glyph copyright line
19d1	load 1 to raise the master "a game is live" flag
19d3	store the accumulator into the game-active flag
19d7	clear the accumulator to 0 to drop the game-active flag
19d8	write it through the shared flag store at $19d3
19dc	read the port-3 sound-latch shadow
19df	AND with the keep-mask -- clear the target cue's bit
19e0	store the edited latch back to the shadow
19e3	mirror it out to the sound port so the cue turns off
19e6	point at the reserve-ship icon row in video RAM
19e9	no reserve ships: skip drawing, jump to the blank sweep
19ec	point at the reserve-ship icon bitmap
19ef	16 bytes -- one ship icon
19f1	hold the remaining icon count in C
19f2	blit one ship icon, advancing the destination one slot right
19f5	recover the icon counter
19f6	one fewer icon to draw
19f7	loop until every reserve icon is drawn
19fa	16-column strip width
19fc	blank one 16-column strip from the current pointer
19ff	take the strip base's high byte
1a00	reached the terminator row at video page 0x35?
1a02	keep clearing strips until the sweep hits it
1a06	point at the current raster-half flag
1a09	load the half-frame flag -- 0x80 top half, 0x00 mid
1a0a	read the object's first byte
1a0b	isolate its phase bit (bit 7)
1a0d	compare the object's phase against the live half-frame
1a0e	return with carry clear if the object belongs to the other half
1a0f	object is in this half: set carry to signal a match
1a32	read a source byte
1a33	write it to the destination
1a34	advance the destination pointer
1a35	advance the source pointer
1a36	one fewer byte to copy
1a37	loop until the block is moved -- a count of 0 copies a full 256 bytes
1a3b	read the graphics-pointer low byte
1a3d	read the graphics-pointer high byte -- forms the sprite bitmap pointer
1a3f	read the coordinate byte
1a41	read the next descriptor field
1a43	read the last descriptor field
1a44	build the coordinate word's high byte
1a45	and its low byte -- now points at the object's coordinate word
1a48	three shift passes -- divide the coordinate by eight
1a4b	shift the high byte right, its low bit falling into carry
1a4e	pull that carry into the low byte's top -- one 16-bit right shift
1a50	one shift pass done
1a51	repeat until divided by eight -- eight pixels per byte
1a54	take the shifted high byte
1a55	mask it into the video page
1a57	force the address into the 0x2000-0x3fff video window
1a59	seat the clamped high byte back into the screen address
1a5c	point at the first byte of video memory
1a5f	blank this screen byte -- eight pixels off
1a61	step to the next screen byte
1a63	stop once the pointer reaches the end of video memory -- high byte 0x40
1a65	keep going until the whole screen is cleared
1a6a	remember where this row starts
1a6b	read a byte of the source bitmap
1a6c	merge it over what is already on screen -- the background shows through
1a6d	write the merged byte back to the screen
1a6e	advance to the next source byte
1a6f	advance to the next screen byte
1a70	count down the bytes left in this row
1a71	loop across the row
1a74	back to this row's start
1a75	load the screen row stride -- 0x20 bytes
1a78	step the destination down one screen row
1a7a	count down the rows left
1a7b	loop to blit the next row
1a7f	read the active player's remaining-ship count
1a82	test whether any ships remain
1a83	return if no ships are left
1a84	keep the full ship count aside
1a85	spend one ship -- the one entering play
1a86	store the reduced count back
1a87	repaint the reserve-ship icon row -- ships held back
1a8a	restore the full count for the lives digit
1a8b	point at the lives-digit slot on screen
1a8e	keep the count to a single digit -- low nibble
1a90	draw the digit glyph
