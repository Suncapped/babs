import { writable } from 'svelte/store'
import { Socket } from './Socket'

export const toprightText = writable('')
export const menuShowLink = writable(false)
export const menuSelfData = writable({})
export const toprightReconnect = writable('')
export const babsSocket = writable()
export const topmenuVisible = writable(false)
