import { log } from './../Utils'

export class State {
	constructor(parent) {
		this._parent = parent
	}

	Enter() { }
	Exit() { }
	Update() { }
}


export class DanceState extends State {
	constructor(parent) {
		super(parent)

		this._FinishedCallback = () => {
			this._Finished()
		}
	}

	get Name() {
		return 'dance'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['dance'].action
		const mixer = curAction.getMixer()
		mixer.addEventListener('finished', this._FinishedCallback)

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.reset()
			curAction.setLoop(THREE.LoopOnce, 1)
			curAction.clampWhenFinished = true
			curAction.crossFadeFrom(prevAction, 0.2, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	_Finished() {
		this._Cleanup()
		this._parent.SetState('idle')
	}

	_Cleanup() {
		const action = this._parent._proxy._animations['dance'].action

		action.getMixer().removeEventListener('finished', this._CleanupCallback)
	}

	Exit() {
		this._Cleanup()
	}

	Update(_) {
	}
}



export class RunState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'run'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['run'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.enabled = true

			if (prevState.Name == 'walk') {
				const ratio = curAction.getClip().duration / prevAction.getClip().duration
				curAction.time = prevAction.time * ratio
			} else {
				curAction.time = 0.0
				curAction.setEffectiveTimeScale(1.0)
				curAction.setEffectiveWeight(1.0)
			}

			curAction.crossFadeFrom(prevAction, 0.5, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		// if (input._keys.forward || input._keys.backward) {
		// 	if (input._keys.shift) {
		// 		this._parent.SetState('walk')
		// 	}
		// 	return
		// }

		this._parent.SetState('idle')
	}
}

export class BackwardState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'backward'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['backward'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.enabled = true

			if (prevState.Name == 'run') {
				const ratio = curAction.getClip().duration / prevAction.getClip().duration
				curAction.time = prevAction.time * ratio
			} else {
				curAction.time = 0.0
				curAction.setEffectiveTimeScale(-1.0)
				curAction.setEffectiveWeight(1.0)
			}

			curAction.crossFadeFrom(prevAction, 0.5, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		// if(input._keys.backward) {
		// 	return
		// }
		// else if (input._keys.forward) {
		// 	if (input._keys.shift) {
		// 		this._parent.SetState('walk')
		// 	} else {
		// 		this._parent.SetState('run')
		// 	}
		// }
		// else {
			this._parent.SetState('idle')
		// }
	}
}


export class WalkState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'walk'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['walk'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.enabled = true

			if (prevState.Name == 'run') {
				const ratio = curAction.getClip().duration / prevAction.getClip().duration
				curAction.time = prevAction.time * ratio
			} else {
				curAction.time = 0.0
				curAction.setEffectiveTimeScale(1.0)
				curAction.setEffectiveWeight(1.0)
			}

			curAction.crossFadeFrom(prevAction, 0.5, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		// if (input._keys.forward || input._keys.backward) {
		// 	if (!input._keys.shift) {
		// 		this._parent.SetState('run')
		// 	}
		// 	return
		// }

		this._parent.SetState('idle')
	}
}


export class IdleState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'idle'
	}

	Enter(prevState) {
		const idleAction = this._parent._proxy._animations['idle'].action
		log.info('idleenter', prevState, idleAction)


		const mixer = idleAction.getMixer()
		mixer.addEventListener('finished', (stuff) => {
			log.info('finished?', stuff)
		})

		idleAction.getClip().duration = 5 // via diagnose below

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action
			idleAction.time = 0.0
			idleAction.enabled = true


			// // Diagnose and find bad track 
			// const clip = idleAction.getClip()
			// let count = 0
			// clip.tracks.map(track => {
			// 	log.info('track', count)
			// 	count++
			// 	const maxValueObject = track.times.filter(time => {
			// 		return time > 8 // Too long for this anim
			// 	})
			// 	log.info('max', maxValueObject)
			// })
			// log.info('duration', idleAction.getClip().duration)
			// idleAction.getClip().resetDuration()
			// log.info('after', idleAction.getClip().duration)

			idleAction.setEffectiveTimeScale(1.0)
			idleAction.setEffectiveWeight(1.0)
			idleAction.crossFadeFrom(prevAction, 0.5, true)
			idleAction.play()
		} else {
			idleAction.play()
		}
	}

	Exit() {
	}

	Update(_, input) {
		// log.info('idleup', _)
		// if (input._keys.forward) {
		// 	this._parent.SetState('run')
		// } else if (input._keys.backward) {
		// 	this._parent.SetState('backward')
		// } else if (input._keys.space) {
		// 	this._parent.SetState('dance')
		// } else {
		// 	return
		// }
	}
}
