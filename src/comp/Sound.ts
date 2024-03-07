// Hmm, for sounds, we'll want to pool the PositionalAudios and holder objects, 
// 	and then tickly pick nearest wobs, and and and move holder objects to those locations,
// 	and then if those holders have changed (so as not to restart the sound), 
// 	start playing the sound, which should have been preloaded.
// Is there a simpler version of this?  
//  The reason I'm worried is because of how many sounds there could potentially be around the world, like a lot of campfires.
//  Will it be smart enough to not play ones that are far away, just by setting volume or something?
//  And there would probably be a lot of creating/removing PositionalAudios during zoning.
//  Also the holder objects would need to be managed a bit?
// (It's quite similar to colliders, which I don't need because I'm using tiles.)
// I kind of wish I could just attach it to flames.  But there will be non-flame sounds...right?
// I think Sound.ts itself should, as a Comp, mostly be the data.  Then a SoundSys should handle pools and playing.
// Is that even worth separating?

// I guess that to do this right we need a few things:
// A cache for preloading mp3s only-once, which loads them upon zonein.
// A pool for 8 PositionalAudios and holder objects.
// Moving the holder objects during zoning.
// A way to say "this sound should be playing now" (for continuous, onApproach, onInteract)
// Find the nearest/loudest sounds that should be playing, and move a holder object to that location, and play the sound.
// When zoning away or sound is done playing or it gets deprioritized, stop it and return holder and audio to pool.

// To do it wrong?  
// Just make a PositionalAudio and holder object for every sound, and play it when it's created, and just leave it there (or destroy on finish if not repeat).
// Maybe I should test the limits of this way first.
// This is what I've done for now for campfire:
// It gets loaded in Wob.ts
// It get unloaded in Zone.ts during removeWobGraphic
// Caching (if any?) is left to the library or browser.
// And there should be an audible toggle in menu that defaults to off and is saved locally.
