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


