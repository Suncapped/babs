import { writable } from 'svelte/store'
import { SocketSys } from './sys/SocketSys'

export const toprightText = writable('')
export const menuShowLink = writable(false)
export const menuSelfData = writable({})
export const socketSend = writable({})
export const toprightReconnect = writable('')
export const topmenuVisible = writable(false)
export const isProd = writable(false)
export const baseDomain = writable('')
export const rightMouseDown = writable(false)
export const debugMode = writable(true)
