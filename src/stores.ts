import { writable } from 'svelte/store'

export const toprightText = writable('')
export const topmenuAvailable = writable(false)
export const menuSelfData = writable({})
export const socketSend = writable({})
export const toprightReconnect = writable('')
export const topmenuUnfurled = writable(false)
export const isProd = writable(false)
export const baseDomain = writable('')
export const rightMouseDown = writable(false)
export const debugMode = writable<boolean>()
export const dividerOffset = writable<number|object>()
export const urlFiles = writable()
export const nickTargetId = writable() // Temporary state when naming someone via chatbox
export const uiWindows = writable([])
export const settings = writable({})
