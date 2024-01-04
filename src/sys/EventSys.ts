
import type { WorldSys } from './WorldSys'

type FeSubscriberClasses = WorldSys
export class EventSys {
	static subscribers = new Set<FeSubscriberClasses>
	static Subscribe(subscriber :FeSubscriberClasses) {
		EventSys.subscribers.add(subscriber)
	}
	static Dispatch(type :string, data :object) {
		console.debug('** Event:', type)
		for (let subscriber of EventSys.subscribers){
			subscriber.Event(type, data)
		}
	}
}