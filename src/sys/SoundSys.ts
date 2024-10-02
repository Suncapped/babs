import { Group, PerspectiveCamera, Vector3, Object3D, Quaternion, AudioListener } from 'three'
import { Babs } from '@/Babs'

import { Controller } from '@/comp/Controller'
import type { FeObject3D } from '@/ent/Wob'
import { settings, volumePercent } from '@/stores'

import { Audible } from '@/comp/Audible'

export class SoundSys {
	audioListener :AudioListener
	audioListenerVolume :number
	hasContextStartedRunning :boolean = false
	constructor(public camera :PerspectiveCamera, public babs :Babs) {
		// Setup AudioListener
		// Handle the browser policy for no audio until user gesture

		// Track volume changes for later, defaults to 0
		this.audioListenerVolume = 0
		settings.subscribe(sets => { // Menu becomes visible
			for (const key in sets) {
				if (key === 'volumePercent') {
					console.debug('got volumePercent', sets[key])
					this.audioListenerVolume = sets[key] / 100
					if(this.audioListener) {
						this.audioListener.setMasterVolume(this.audioListenerVolume)
					}
				}
			}
		})

		// Setup AudioListener (because it contains AudioContext) only after potential gesture events.
		// Prevents warning in console.  Event list is more than exhaustive.  
		const userGestureEvents = ['click', 'change', 'contextmenu', 'mouseup', 'mousedown', 'keydown', 'touchstart', 'pointerup', 'reset', 'submit', 'touchend']
		userGestureEvents.forEach(event => {
			document.addEventListener(event, () => {
				// console.debug('user gesture event', event)
				if(!this.audioListener) {
					this.audioListener = new AudioListener()
					this.camera.add(this.audioListener) // Todo does this work positionally for WebXR?
					this.audioListener.setMasterVolume(this.audioListenerVolume)

					// If we're running now, go ahead
					if(this.audioListener.context.state === 'running') {
						existingContinuousSoundsStartOnce('user gesture event ' + event)
					}

					// And/or monitor the `statechange` event
					this.audioListener.context.onstatechange = () => {
						console.debug('audioListener.context.state', this.audioListener.context.state)
						existingContinuousSoundsStartOnce('statechange ' + this.audioListener.context.state)
					}
				}
			})
		})

		const existingContinuousSoundsStartOnce = (reason :string) => {
			if(this.hasContextStartedRunning) return // Run only once
			this.hasContextStartedRunning = true

			console.log('Starting sounds:', reason)



			// Find from compcats ones which are Audible and play them
			const audibleComps = this.babs.compcats.get(Audible.name) as Audible[]
			audibleComps?.forEach(async (audibleComp) => {
				if(audibleComp.sharedBluestAudible.soundContinuousLoop) {
					audibleComp.playContinuous()
				}
			})
		}

		// Then instead of queuing up .play() events, we'll track when state changes to running,
		//  and then play any loaded wobs that have continuous sounds!

		// Wouldn't this be easiest by being able to get compcats with an audio component?
		// Otherwise I have to check every single wob for the blueprint blust thing?
		// Do I need to unite such blueprint bluests with bluests here?  Hmm.  I do like the idea of an audio bluest.
		// Done as said.
	}


	update() {


	}
}
