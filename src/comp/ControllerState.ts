
import { LoopOnce } from 'three'

/**
 * The following section of the code is adapted from https://github.com/simondevyoutube/ThreeJS_Tutorial_CharacterController/blob/main/main.js, under the MIT License.
 * Copyright (c) 2020 simondevyoutube
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

class FiniteStateMachine {
	_states
	_currentState :State
	constructor() {
		this._states = {}
		this._currentState = null
	}

	addState(name: string, type: new (parent: FiniteStateMachine) => State) {
		this._states[name] = type
	}

	setState(name: string) {
		const prevState = this._currentState

		if (prevState) {
			if (prevState.name == name) {
				return
			}
			prevState.exit()
		}

		const state = new this._states[name](this)

		this._currentState = state
		state.enter(prevState)
	}

	update(timeElapsed) {
		if (this._currentState) {
			this._currentState.update(timeElapsed)
		}
	}
}


export class CharacterFSM extends FiniteStateMachine {
	_proxy
	constructor(proxy) {
		super()
		this._proxy = proxy

		this.addState('idle', IdleState)
		this.addState('run', RunState)
		this.addState('backward', BackwardState)
		this.addState('walk', WalkState)
		this.addState('jump', JumpState)
		this.addState('dance', DanceState)
	}

}

export class State {
	
	_finishedCallback
	_parent
	_cleanupCallback

	get name() {
		return 'unnamed'
	}

	constructor(parent) {
		this._parent = parent
	}

	enter(prevState) { }
	exit() { }
	update(_) { }
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
			curAction.setLoop(LoopOnce, 1)
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
			curAction.setLoop(LoopOnce, 1)
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

	update(timeElapsed) {
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

	update(timeElapsed) {
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

	update(timeElapsed) {
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
		// console.debug('idleenter', prevState, idleAction)


		const mixer = idleAction.getMixer()
		mixer.addEventListener('finished', (stuff) => {
			console.debug('finished?', stuff)
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
			// 	console.debug('track', count)
			// 	count++
			// 	const maxValueObject = track.times.filter(time => {
			// 		return time > 8 // Too long for this anim
			// 	})
			// 	console.debug('max', maxValueObject)
			// })
			// console.debug('duration', idleAction.getClip().duration)
			// idleAction.getClip().resetDuration()
			// console.debug('after', idleAction.getClip().duration)

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

	update(_) {
		// console.debug('idleup', _)
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
