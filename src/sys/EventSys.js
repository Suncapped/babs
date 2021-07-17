import { log } from './../Utils'

export class EventSys {
	static subscribers = new Set
	static Subscribe(subscriber) {
		this.subscribers.add(subscriber)
	}
	static Dispatch(type, data) {
		log.info('** Event:', type)
		for (let sub of EventSys.subscribers){
			sub.Event(type, data)
		}
	}
}