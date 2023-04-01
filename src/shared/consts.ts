import * as Utils from '../Utils'

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

export const StringifyLandcover = Utils.objectFlipKeyValue(FE_LANDCOVERS)

export const LandcoverSpawns = {
	'SnowIceTundra': [
		{ 'dirt': 100 },
	],
	'BarrenRockSandClay': [
		{ 'dirt': 100 },
	],

	'ForestDeciduous': [
		{ 'carnation flowers': 5 },
		{ 'weed': 15 },
		{ 'grass': 80 },
	],
	'ForestEvergreen': [
		{ 'carnation flowers': 5 },
		{ 'ember': 15 },
		{ 'grass': 80 },
	],
	'ForestMixed': [
		{ 'carnation flowers': 5 },
		{ 'weed': 15 },
		{ 'grass': 80 },
	],

	'ShrubAndScrub': [
		{ 'carnation flowers': 5 },
		{ 'weed': 15 },
		{ 'grass': 80 },
	],
	'Grassland': [
		{ 'carnation flowers': 5 },
		{ 'weed': 15 },
		{ 'grass': 80 },
	],

	'WetlandWoody': [
		{ 'carnation flowers': 5 },
		{ 'weed': 15 },
		{ 'grass': 80 },
	],
	'WetlandHerbacious': [
		{ 'carnation flowers': 5 },
		{ 'weed': 15 },
		{ 'grass': 80 },
	],

	'Lake': [
		{ 'reeds': 10 },
		{ 'mud clay': 20 },
		{ 'fish': 70 },
	],
	'Lakeshore': [
		{ 'lotus flower': 5 },
		{ 'reeds': 45 },
		{ 'mud clay': 50 },
	],
	'River': [
		{ 'mud clay': 40 },
		{ 'fish': 60 },
	],
	'RiverShore': [
		{ 'lotus flower': 5 },
		{ 'fish': 10 },
		{ 'mud clay': 85 },
	],
	'StreamSmall': [
		{ 'lotus flower': 5 },
		{ 'reeds': 20 },
		{ 'mud clay': 75 },
	],
	'StreamMedium': [
		{ 'reeds': 10 },
		{ 'fish': 30 },
		{ 'mud clay': 60 },
	],
	'StreamLarge': [
		{ 'reeds': 10 },
		{ 'mud clay': 20 },
		{ 'fish': 70 },
	],
	'StreamShore': [
		{ 'lotus flower': 5 },
		{ 'reeds': 10 },
		{ 'mud clay': 85 },
	],

	'Cliff': [
		{ 'ember': 1 },
		{ 'small rock': 24 },
		{ 'dirt': 75 },
	],
}

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

export type WobId = {
	idzone :number,
	x :number,
	z :number,
	blueprint_id :string,
}
export function isWobId(item :any): item is WobId {
	return (item as WobId).idzone !== undefined
	&& (item as WobId).x !== undefined
	&& (item as WobId).z !== undefined
	&& (item as WobId).blueprint_id !== undefined
}

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
			
			meta :{
				mousedevice :string,
				debugmode :boolean,
			},
			char :{
				gender :string,
			},
		},
		zones :Array<Zoneinfo>,
		blueprints :BlueprintList,
		uis :Ui[],
	},
}

export type SendPlayerDepart = {
	playerdepart :number,
}

export type PlayerArrive = {
	id :number,
	idzip :number,
	idzone :number,
	visitor :boolean
	x :number,
	z :number,
	r :number,
	movestate :number,
	meta :{},
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

export type SendJournal = {
	journal :{
		text :string,
	},
}

export type SendCraftable = {
	craftable :{
		wobId :WobId,
		options :Array<string>,
	},
}
export type SendAskTarget = {
	asktarget :{
		sourceWobId :WobId,
	},
}
// export type SendWobsRemove = {
// 	wobsremove: {
// 		wobs: [wob],
// 	}
// }

export type SendAlreadyIn = {
	alreadyin :true,
}
export type SendServerRestart = {
	serverrestart :true,
}

export type SendFeTime = {
	fetime: {
		secondsSinceHour :number,
		hoursSinceBeginning :number,
	}
}

export type Sendable = SendLoad|SendPlayerDepart|SendPlayersArrive|SendNickList|SendAlreadyIn
	|SendZoneIn|SendWobsUpdate|SendSaid|SendEnergy|SendJournal|SendCraftable|SendAskTarget|SendServerRestart
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