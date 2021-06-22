// import { Schema, type, ArraySchema, MapSchema, DataChange } from "@colyseus/schema"
import { Zone } from "./BabsZone"
import type { Player } from "./BabsPlayer"

export class MyState {
    public zone: Zone = new Zone()
    public players: Array<Player> = new Array<Player>()

    constructor () {
    }

    // onChange (changes: DataChange[]) {
    //     // onChange logic here.
    // }

    // onAdd () {
    //     // onAdd logic here.
    // }

    // onRemove () {
    //     // onRemove logic here.
    // }

}
