import { menuSelfData, menuShowLink, toprightReconnect, toprightText } from "../stores"
import Cookies from "js-cookie"
import { UiSys } from '../sys/UiSys'
import { EventSys } from "./EventSys"
import { WorldSys } from "./WorldSys"
import { LoaderSys } from "./LoaderSys"

export class SocketSys {

	static ws
	static scene
	static babsReady = false

	static urlSocket
	static urlFiles


	static pingSeconds = 30


	static Start(scene, urlSocket, urlFiles) {

		this.urlSocket = urlSocket
		this.urlFiles = urlFiles

		this.scene = scene

		toprightText.set('Connecting...')
		document.getElementById('topleft').style.visibility = 'hidden'
		this.ws = new WebSocket(this.urlSocket)
		this.ws.binaryType = 'arraybuffer'


		this.ws.onopen = (event) => {
			const existingSession = Cookies.get('session')
			console.log('existingSession', existingSession)
			if(existingSession){
				this.Auth(existingSession)
			}
			else { // No cookie, so indicate visitor
				this.Visitor()
			}
		}
		this.ws.onmessage = (event) => {
			console.log('Socket rec:', event.data)
			if(event.data instanceof ArrayBuffer) { // Locations
				// const players = []
				// const playerMoves = new Uint8Array(event.data) // byte typedarray view
				// for(let mi=0; mi <playerMoves.length; mi++) {
				// 	players
				// 	playerMoves[mi]
				// }

        		// console.log(view.getInt32(0));
			}
			else {
				const payload = JSON.parse(event.data)
				this.Process(payload)
			}
		}
		this.ws.onerror = (event) => {
			console.log('Socket error', event)
			UiSys.OfferReconnect('Connection error.')
		}
		this.ws.onclose = (event) => {
			console.log('Socket closed', event)
			UiSys.OfferReconnect('Server connection closed.')
		}
	}

	static Visitor() {
		this.Send({
			auth: 'visitor'
		})
	}
	static Auth(session) {
		this.Send({
			auth: session
		})
	}
	static Enter(email, pass) {
		this.Send({
			enter: {
				email,
				pass,
				session: Cookies.get('session'),
			}
		})
	}

	static async Send(json) {
		if(!json.ping && !json.move) console.log('Send:', json)
		if(this.ws.readyState === this.ws.OPEN) {
			await this.ws.send(JSON.stringify(json))
		}
		else {
			console.log('Cannot send; WebSocket is in CLOSING or CLOSED state')
			UiSys.OfferReconnect('Cannot reach server.')
		}
	}

	static Process(payload){
		Object.entries(payload).forEach(async ([op, data]) => {
			switch(op) {
				case 'auth':
					document.getElementById('charsave').disabled = false
					// Handle failed login/register here
					if(data === 'userpasswrong') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Username/password does not match.')
					}
					else if(data === 'emailinvalid') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Email is invalid.')
					}
					else if(data === 'accountfailed') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Account creation error.')
					}
					else if(data === 'passtooshort') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Password too short, must be 8.')
					}
				break;
				case 'visitor':
					this.session = data
					Cookies.set('session', this.session, { 
						domain: SocketSys.baseDomain,
						secure: SocketSys.isProd,
						sameSite: 'strict',
					}) // Non-set expires means it's a session cookie only, not saved across sessions
					toprightText.set('Visiting...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'session':
					this.session = data
					Cookies.set('session', this.session, { 
						expires: 365,
						domain: SocketSys.baseDomain,
						secure: SocketSys.isProd,
						sameSite: 'strict',
					})
					toprightText.set('Entering...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'alreadyin':
					// Just have them repeat the auth if this was their second login device
					
					UiSys.OfferReconnect('Logged out your other session.  Try again! ->')
					
				break;
				case 'load':
					window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
						this.Send({ping:'ping'})
					}, SocketSys.pingSeconds * 1000)

					const pself = data.self
					const zones = data.zones
					const zone = zones.find(z => z.id == pself.idzone)
					console.log('Welcome to', pself.idzone, pself.id, pself.visitor)
					toprightText.set(UiSys.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'
					
					if(pself.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						menuShowLink.set(true)

						menuSelfData.set(pself)
					}

					this.babsReady = true
					await WorldSys.LoadStatics(this.urlFiles, this.scene, zone)

					if(pself.visitor !== true) {
						document.getElementById('topleft').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}


					EventSys.Dispatch('load-self', pself)


					this.Send({
						ready: pself.id,
					})


				break;
			}
		})
	}


}

