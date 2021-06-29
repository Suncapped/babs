import { Com } from "./Com"

/** @class {Ent} - Entity */
export class Ent{
	id

	coms: {[key:string]: any}

	static Create(coms: {[key:string]: any}) {
		console.log('CREATE:', coms)

		// let ent = new Ent
		// ent.coms = coms
		// return ent

		let ent = new Ent
        Object.defineProperty(ent, 'location', { //<- This object is called a "property descriptor".
            //Alternatively, use: `get() {}`
            get: function() {
                return this.coms['location'];
            },
            //Alternatively, use: `set(newValue) {}`
            // This isn't called on com.location.x; because that's a 'get' of location.  This is on com.location =
            set: function(newValue) {
                this.coms['location'] = newValue;
            }
        });
		// ent.location
		return ent

	}

	
}