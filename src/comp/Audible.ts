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

// We did the simple version.  Here though we want an Audible component, so that we can quickly scan for all audibles and play them (after a user gesture enables audio).

import { EventSys } from '@/sys/EventSys'
import { LoaderSys } from '@/sys/LoaderSys'

import { Object3D, PositionalAudio, Vector4 } from 'three'
import { Vector3 } from 'three'
import { Comp } from '@/comp/Comp'
import { Babs } from '@/Babs'
import { Zone } from '@/ent/Zone'
import { YardCoord } from './Coord'
import type { WobId, SharedWob } from '@/shared/SharedWob'
import { CameraSys } from '@/sys/CameraSys'
import type { SharedCompAudible } from '@/shared/SharedComps'
import { Wob } from '@/ent/Wob'
import { WorldSys } from '@/sys/WorldSys'

export class Audible extends Comp {
	constructor(wob: SharedWob, babs: Babs) {
		super(wob.id(), Audible, babs)
	}

	sharedCompAudible: SharedCompAudible
	holderObject: Object3D
	continuousSound: PositionalAudio
	continuousBuffer: Promise<AudioBuffer>

	async playContinuous() {
		// console.log('playContinuous', this.idEnt)

		// Use a promised buffer to prefetch and load the file
		this.continuousBuffer = new Promise((resolve, reject) => {
			this.babs.loaderSys.audioLoader.load(`${this.babs.urlFiles}/audio/sounds/${this.sharedCompAudible.soundContinuousLoop}.mp3`, function( buffer ) {
				resolve(buffer)
			})
		})

		// Load sound player
		this.continuousSound = new PositionalAudio(this.babs.soundSys.audioListener)

		// Load into object
		const wobId = this.idEnt as WobId

		// Reconstruct wob from wobId
		// Hmmm...what if the wob has moved?  ID gets outdated.  Seems like a wider potential gotcha.
		// Basically, how do I get the "entity" associated with a comp when it could have moved?  When it moves, should I update its comp entity ids?  Probably so!
		// Ah no, because remember dear: Wobs don't actually get moved, the old one gets removed and a new one created.  So the id is always correct.
		const feim = Wob.InstancedWobs.get(wobId.blueprint_id)
		const yardCoord = YardCoord.Create({
			x: wobId.x,
			z: wobId.z,
			idzone: wobId.idzone,
			babs: this.babs,
		}) 
		let engPositionVector = feim.heightTweak(yardCoord.toEngineCoordCentered('withCalcY'))


		this.holderObject = new Object3D()
		this.holderObject.position.copy(engPositionVector)
		this.holderObject.updateMatrixWorld()
		// console.log('this.holderObject', this.holderObject.position)
		this.holderObject.add(this.continuousSound)
		this.babs.group.add(this.holderObject)

		// Play it
		const buffer = await this.continuousBuffer
		this.continuousSound.setBuffer(buffer)
		this.continuousSound.setLoop(true)
		this.continuousSound.setRefDistance(WorldSys.Plot)
		// sound.setMaxDistance(40) // Does the opposite of what you want lol
		const startOffset = Math.random() *buffer.duration // offset so that similar sounds don't sound like echoes of each other
		this.continuousSound.offset = startOffset
		this.continuousSound.play()

		// When this unloads, we gotta stop it!  That is done in Zone.removeWobGraphic which should call into this Delete()

	}
	
	static async Create(wob :SharedWob, babs :Babs, sharedCompAudible :SharedCompAudible) {
		// console.log('Flame.Create, right before FlameFires.push', wob.name)
		const com = new Audible(wob, babs)
		com.sharedCompAudible = sharedCompAudible

		return com
	}

	static async Delete(deletingWob :SharedWob, babs :Babs) {
		const audibleComps = babs.compcats.get(Audible.name) as Audible[] // todo abstract this .get so that I don't have to remember to use Flame.name instead of 'Flame' - because build changes name to _Flame, while it stays Flame on local dev.
		
		const audibleComp = audibleComps?.find(fc => {
			const compWobId = fc.idEnt as WobId
			const deletingWobId = deletingWob.id()
			return compWobId.idzone === deletingWobId.idzone
				&& compWobId.x === deletingWobId.x
				&& compWobId.z === deletingWobId.z
				&& compWobId.blueprint_id === deletingWobId.blueprint_id
		})
		if(audibleComp) {
			// Update compcats
			babs.compcats.set(Audible.name, audibleComps.filter(c => c.holderObject.uuid !== audibleComp.holderObject.uuid))

			audibleComp.continuousSound.stop()
			audibleComp.continuousSound.disconnect()
			audibleComp.continuousSound = null

			audibleComp.babs.group.remove(audibleComp.holderObject)
			audibleComp.holderObject.children = []
			audibleComp.holderObject = null
		}
	}

	update(dt) {
		// this.fire?.update(dt *Flame.settings.speed)
	}

}
