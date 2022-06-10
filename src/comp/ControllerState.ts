import { log } from './../Utils'

export class State {
	constructor(parent) {
		this._parent = parent
	}

	enter() { }
	exit() { }
	update() { }
}


export class DanceState extends State {
	constructor(parent) {
		super(parent)

		this._finishedCallback = () => {
			this._finished()
		}
	}

	get name() {
		return 'dance'
	}

	enter(prevState) {
		const curAction = this._parent._proxy._animations['dance'].action
		const mixer = curAction.getMixer()
		mixer.addEventListener('finished', this._finishedCallback)

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.name].action

			curAction.reset()
			curAction.setLoop(THREE.LoopOnce, 1)
			curAction.clampWhenFinished = true
			curAction.crossFadeFrom(prevAction, 0.2, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	_finished() {
		this._cleanup()
		this._parent.setState('idle')
	}

	_cleanup() {
		const action = this._parent._proxy._animations['dance'].action

		action.getMixer().removeEventListener('finished', this._cleanupCallback)
	}

	exit() {
		this._cleanup()
	}

	update(_) {
	}
}


export class JumpState extends State {
	constructor(parent) {
		super(parent)

		this._finishedCallback = () => {
			this._finished()
		}
	}

	get name() {
		return 'jump'
	}

	enter(prevState) {
		const curAction = this._parent._proxy._animations['jump'].action
		const mixer = curAction.getMixer()
		mixer.addEventListener('finished', this._finishedCallback)

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.name].action

			curAction.reset()
			curAction.setLoop(THREE.LoopOnce, 1)
			curAction.clampWhenFinished = true
			curAction.crossFadeFrom(prevAction, 0.2, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	_finished() {
		this._cleanup()
		this._parent.setState('idle')
	}

	_cleanup() {
		const action = this._parent._proxy._animations['jump'].action

		action.getMixer().removeEventListener('finished', this._cleanupCallback)
	}

	exit() {
		this._cleanup()
	}

	update(_) {
	}
}



export class RunState extends State {
	constructor(parent) {
		super(parent)
	}

	get name() {
		return 'run'
	}

	enter(prevState) {
		const curAction = this._parent._proxy._animations['run'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.name].action

			curAction.enabled = true

			if (prevState.name == 'walk') {
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

	exit() {
	}

	update(timeElapsed, input) {
		// if (input._keys.forward || input._keys.backward) {
		// 	if (input._keys.shift) {
		// 		this._parent.setState('walk')
		// 	}
		// 	return
		// }

		// this._parent.setState('idle')
	}
}

export class BackwardState extends State {
	constructor(parent) {
		super(parent)
	}

	get name() {
		return 'backward'
	}

	enter(prevState) {
		const curAction = this._parent._proxy._animations['backward'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.name].action

			curAction.enabled = true

			if (prevState.name == 'run') {
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

	exit() {
	}

	update(timeElapsed, input) {
		// if(input._keys.backward) {
		// 	return
		// }
		// else if (input._keys.forward) {
		// 	if (input._keys.shift) {
		// 		this._parent.setState('walk')
		// 	} else {
		// 		this._parent.setState('run')
		// 	}
		// }
		// else {
			this._parent.setState('idle')
		// }
	}
}


export class WalkState extends State {
	constructor(parent) {
		super(parent)
	}

	get name() {
		return 'walk'
	}

	enter(prevState) {
		const curAction = this._parent._proxy._animations['walk'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.name].action

			curAction.enabled = true

			if (prevState.name == 'run') {
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

	exit() {
	}

	update(timeElapsed, input) {
		// No longer needed, because it's set by controller via Input or Socket
		// if (input._keys.forward || input._keys.backward) {
		// 	if (!input._keys.shift) {
		// 		this._parent.setState('run')
		// 	}
		// 	return
		// }
		// this._parent.setState('idle')
	}
}


export class IdleState extends State {
	constructor(parent) {
		super(parent)
	}

	get name() {
		return 'idle'
	}

	enter(prevState) {
		const idleAction = this._parent._proxy._animations['idle'].action
		log.info('idleenter', prevState, idleAction)


		const mixer = idleAction.getMixer()
		mixer.addEventListener('finished', (stuff) => {
			log.info('finished?', stuff)
		})

		idleAction.getClip().duration = 5 // via diagnose below

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.name].action
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

	exit() {
	}

	update(_, input) {
		// log.info('idleup', _)
		// if (input._keys.forward) {
		// 	this._parent.setState('run')
		// } else if (input._keys.backward) {
		// 	this._parent.setState('backward')
		// } else if (input._keys.space) {
		// 	this._parent.setState('dance')
		// } else {
		// 	return
		// }
	}
}
