import Cookies from "js-cookie"
import { BABS } from "./Babs"
import { babsSocket, menuSelfData, menuShowLink, toprightReconnect, toprightText } from "./stores"
import { Ui } from "./Ui"

export class Socket {
	urlFiles
	urlSocket
	ws
	world
	scene

	static isProd = window.location.href.startsWith('https://earth.suncapped.com')
	static devDomain = 'localhost'
	static baseDomain

	static Create(scene, world) {
		let socket = new Socket
		socket.scene = scene
		socket.world = world
		if (Socket.isProd) {
			socket.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			socket.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
			Socket.baseDomain = 'suncapped.com'
		}
		else {
			socket.urlSocket = `ws://${Socket.devDomain}:2567` /* Proxima */
			socket.urlFiles = `http://${Socket.devDomain}:3000` /* Express (Snowpack dev is 8081) */
			Socket.baseDomain = `${Socket.devDomain}`
		}

		babsSocket.set(socket)

		toprightText.set('Connecting...')
		document.getElementById('topleft').style.visibility = 'hidden'
		socket.ws = new WebSocket(socket.urlSocket)


		socket.ws.onopen = (event) => {
			const existingSession = Cookies.get('session')
			console.log('existingSession', existingSession)
			if(existingSession){
				socket.auth(existingSession)
			}
			else { // No cookie, so indicate visitor
				socket.visitor()
			}
		}
		socket.ws.onmessage = (event) => {
			console.log('Rec:', event.data)
			const payload = JSON.parse(event.data)
			socket.process(payload)
		}
		socket.ws.onerror = (event) => {
			console.log('socket error', event)
			offerReconnect('Connection error.')
		}
		socket.ws.onclose = (event) => {
			console.log('socket closed', event)
			offerReconnect('Server connection closed.')
		}
		
		return socket
	}

	visitor() {
		this.send({
			auth: 'visitor'
		})
	}
	auth(session) {
		this.send({
			auth: session
		})
	}
	enter(email, pass) {
		this.send({
			enter: {
				email,
				pass,
				session: Cookies.get('session'),
			}
		})
	}

	async send(json) {
		if(!json.ping) console.log('Send:', json)
		if(this.ws.readyState === this.ws.OPEN) {
			await this.ws.send(JSON.stringify(json))
		}
		else {
			console.log('Cannot send; WebSocket is in CLOSING or CLOSED state')
			offerReconnect('Cannot reach server.')
		}
	}

	process(payload){
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
						domain: Socket.baseDomain,
						secure: Socket.isProd,
						sameSite: 'strict',
					}) // Non-set expires means it's a session cookie only, not saved across sessions
					toprightText.set('Visiting...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'session':
					this.session = data
					Cookies.set('session', this.session, { 
						expires: 365,
						domain: Socket.baseDomain,
						secure: Socket.isProd,
						sameSite: 'strict',
					})
					toprightText.set('Entering...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'load':
					const pself = data.self
					const players = data.players
					const zones = data.zones
					const zone = zones.find(z => z.id == pself.idzone)
					console.log('Welcome to', pself.idzone, pself.id, pself.visitor)
					toprightText.set(Ui.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'
					
					if(pself.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						menuShowLink.set(true)

						menuSelfData.set(pself)
					}

					BABS.run()
					await this.world.loadStatics(this.urlFiles, this.scene, zone)

					if(pself.visitor !== true) {
						document.getElementById('topleft').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}
					this.send({
						ready: pself.id
					})


					window.setInterval(() => {
						this.send({
							ping:'ping'
						})
					}, 10_000)

				break;
			}
		})
	}


}


export function offerReconnect(reason) {
	toprightReconnect.set(reason)
}