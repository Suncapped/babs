import { writable } from 'svelte/store'
import { SocketSys } from './sys/SocketSys'

export const toprightText = writable('')
export const menuShowLink = writable(false)
export const menuSelfData = writable({})
export const toprightReconnect = writable('')
export const topmenuVisible = writable(false)
