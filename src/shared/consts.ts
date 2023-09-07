import * as Utils from '../Utils'
import { type WobId } from './SharedWob'
import { SharedZone } from './SharedZone'

export const NLCD = {
	// Water
	OpenWater:11,
	SnowIceTundra:12,
	// Developed
	DevelopedOpen:21,
	DevelopedLow:22,
	DevelopedMedium:23,
	DevelopedHigh:24,
	// Barren
	BarrenRockSandClay:31, //Barren Land (Rock/Sand/Clay) 
	// Forest
	ForestDeciduous:41,
	ForestEvergreen:42,
	ForestMixed:43,
	// Shrubland
	ShrubAndScrub:52,
	// Herbaceous
	Grassland:71,
	// Cultivated
	Pasture:81,
	Crops:82,
	// Wetlands
	WetlandWoody:90,
	WetlandHerbacious:95,
}

export const FE_LANDCOVERS = {
	...NLCD, // NLCD 0-100

	// But also tack on our own!  For use in Blueprints
	ForestAll: 49,
	WetlandAll: 99,

	// Pasture, Crops, Developed* will all be transformed into most common zone type not those.

	// Water 100-200
	WaterStart: 104,
	// Water,
	// Pond, PondShore,
	Lake: 108, LakeShore: 112,
	River: 116, RiverShore: 120,
	StreamSmall: 124, // From fcode StreamEphemeral
	StreamMedium: 128, // From fcodes85, 18%, 47% Stream, StreamIntermittent
	StreamLarge: 132, // From fcode StreamPerennial
	StreamShore: 136,
	// Spring, HotSpring,
	// Beach, BeachShore,
	// Ocean, SeaShore,
	// Snow, Deepsnow,
	// Glacier, Ice,
	// Glacier, snow, spring, etc could be gathered from data or deduced
	WaterEnd: 140,

	// Custom 200+
	Cliff: 200,
}

export function objectFlipKeyValue(obj) {
	return Object.fromEntries(Object.entries(obj).map(a => a.reverse()))
}

export const StringifyLandcover = objectFlipKeyValue(FE_LANDCOVERS)

export enum UiTypes {
	journal='journal',
	container='container',
	menu='menu',
	spell='spell',
	profile='profile',
}
export interface Ui {
	id ?:number
	type :UiTypes
	idplayer :number
	idobject ?:number
	x ?:number
	y ?:number
	z ?:number
	w ?:number
	h ?:number
	visible ?:boolean
	unfurled ?:boolean
	other ?:Record<string, unknown>
}

// Socket sendables

export type BlueprintList = Array<number|string>

export type SendWobsUpdate = {
	wobsupdate :{
		idzone :number,
		locationData :Array<number>,
		// blueprints? :BlueprintList, // fasttodo optimize rather than sending them all
		shownames? :boolean,
	},
}

export type Zoneinfo = {
	id :number,
	y :number,
	yscale :number,
	x :number,
	z :number,
}
export type SendLoad = {
	load :{
		self :{
			id :number,
			// idzip: player.idzip, // Happens within tick loop because it's syncly generated there
			idzone :number,
			visitor :boolean,
			x :number,
			z :number,
			r :number,
			
			email :string,
			created_at :string,
			credits :number,
			roles :string,
			reason :string,
			color :string,
			debugmode :boolean,
			divider :number,
			
			// movestate: player.movestate, // Happens within tick loop
			meta :{
				mousedevice :string,
				debugmode :boolean,
			},
			char :{
				gender :string,
				color :string,
			},
		},
		farZones :Array<Zoneinfo>,
		nearZones :Array<Zoneinfo>,
		blueprints :{blueprint_id :string, locid :number, comps :any},
		uis :Ui[],
	},
}
export type SendVisitor = {
	visitor :string,
}
export type SendSession = {
	session :string,
}

export type SendAuth = {
	auth :'userpasswrong'|'passtooshort'|'accountfailed'|'emailinvalid',
}

export type SendPlayerDepart = {
	playerdepart :number,
}

export type PlayerArrive = {
	id :number,
	idzip? :number, // Optional because of load.self
	idzone :number,
	visitor :boolean
	x :number,
	z :number,
	r :number,

	// movestate? :number, // Optional because of load.self // Deprecated
	meta :{
		mousedevice? :string,
		debugmode? :boolean,
	},
	char :{
		gender :string,
		color :string,
	},
}
export type SendPlayersArrive = {
	playersarrive :Array<PlayerArrive>
}

export type NickList = [{idtarget :number, nick :string}]
export type SendNickList = {
	nicklist :NickList,
}

export type SendSaid = {
	said :{
		id :number|undefined
		text :string,
		color :string,
		show? :boolean, // used for sending chat history
		name? :number|string // used for sending chat history
	}
}

export type SendEnergy = {
	energy :number,
}

export type SendZoneIn = {
	zonein :{
		idplayer :number,
		idzone :number,
	},
}

// export type SendJournal = {
// 	journal :{
// 		text :string,
// 	},
// }
export class FeWords {
	content :string
	idZone :number // Zone it's about
	isJournaled? :'isJournaled' = null // Whether it goes into journal
	isOoc? :'isOoc' = null // OOC/service message (different font/color)
	colorHex? :string
	targetLocation? :{x:number, z:number}
	idTargetWob? :WobId // Follows above a wob
	idTargetPlayer? :number // Follows above a player head
}
export type SendFeWords = {
	fewords :FeWords,
}

export type SendCraftable = {
	craftable :{
		wobId :WobId,
		options :Array<string>,
	},
}
export type SendAskTarget = {
	asktarget :{
		sourceWobId? :WobId,
	},
}

export type SendAlreadyIn = {
	alreadyin :true,
}
export type SendServerRestart = {
	serverrestart :true,
}

export type SendFeTime = {
	fetime :{
		secondsSinceHour :number,
		hoursSinceBeginning :number,
	}
}

export type Sendable = SendLoad|SendVisitor|SendSession
	|SendAuth
	|SendPlayerDepart|SendPlayersArrive|SendNickList|SendAlreadyIn
	|SendZoneIn|SendWobsUpdate|SendSaid|SendEnergy|SendFeWords|SendCraftable|SendAskTarget|SendServerRestart
	|SendFeTime



export function toHexString(byteArray) {
	const result = []
	for(let i in byteArray) {
		// console.log('i', i)
		if (byteArray[i] < 16) {
			result[i] = '0' + byteArray[i].toString(16)
		} else {
			result[i] = byteArray[i].toString(16)
		}
	}
	const str = result.join('')
	if(str.includes('-')) {
		console.warn('toHexString has a negative:', byteArray, result, str)
	}
	return str
}