import Cookies from "js-cookie"
import { BABS } from "./Babs"

export class Socket {
	urlFiles
	urlSocket
	ws
	world
	scene

	static Create(scene, world) {
		let socket = new Socket
		socket.scene = scene
		socket.world = world
		if (window.location.href.startsWith('https://earth.suncapped.com')) {
			socket.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			socket.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
			socket.baseDomain = 'suncapped.com'
		}
		else {
			socket.urlSocket = `ws://localhost:2567` /* Proxima */
			socket.urlFiles = `http://localhost:3000` /* Express (Snowpack dev is 8081) */
			socket.baseDomain = 'localhost'
		}

		socket.ws = new WebSocket(socket.urlSocket)
		document.getElementById('gameinfo').textContent = 'Connecting...'

		socket.ws.onopen = (event) => {
			const existingSession = Cookies.get('session')
			console.log('existingSession', existingSession)
			if(existingSession){
				// document.getElementById('charsave').style.visibility = 'hidden'
				// document.getElementById('gameinfo').textContent = 'Entering...'
				socket.auth(existingSession)
			}
			else { // No cookie, so indicate visitor
				socket.visitor()
			}
		}
		socket.ws.onmessage = (event) => {
			const payload = JSON.parse(event.data)
			console.log('Rec:', payload)
			socket.process(payload)
		}
		socket.ws.onerror = (event) => {
			console.log('socket error', event)
			offerReconnect('Connection error')
		}
		socket.ws.onclose = (event) => {
			console.log('socket closed', event)
			offerReconnect('Connection is closed')
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
		document.getElementById('enterbutton').disabled = true
		this.send({
			enter: {
				email,
				pass,
				session: Cookies.get('session'),
			}
		})
	}

	send(json) {
		console.log('Send:', json)

		if(this.ws.readyState === this.ws.OPEN) {
			this.ws.send(JSON.stringify(json))
		}
		else {
			console.log('Cannot send; WebSocket is in CLOSING or CLOSED state')
			offerReconnect('Cannot reach server')
		}
	}

	process(payload){
		Object.entries(payload).forEach(async ([op, data]) => {
			switch(op) {
				case 'auth':
					document.getElementById('enterbutton').disabled = false
					// Handle failed login/register here
					if(data === 'userpasswrong') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Username/password does not match."
						BABS.run()
					}
					else if(data === 'emailinvalid') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Email is invalid."
						// BABS.run()
					}
					else if(data === 'accountfailed') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Account creation error."
						// BABS.run()
					}
					else if(data === 'passtooshort') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Password too short, must be 8"
						// BABS.run()
					}
				break;
				case 'session':
					this.session = data
					Cookies.set('session', this.session, { 
						expires: 31,
						domain: this.baseDomain,
					})
					document.getElementById('gameinfo').textContent = "Entering..."
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'load':
					const pself = data.self
					const players = data.players
					const zones = data.zones
					const zone = zones.find(z => z.id == pself.idzone)
					console.log('Welcome to', pself.idzone, pself.id, pself.visitor)
					
					if(pself.visitor !== true) {
						document.getElementById('gameinfo').innerHTML = '<a id="logout" href="#">Logout</a>'
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('charsave').innerHTML = 'Waking up...'
						document.getElementById('logout').addEventListener('click', (ev) => {
							Cookies.remove('session')
							window.location.reload()
							ev.preventDefault()
						})
					}

					BABS.run()
					await this.world.loadStatics(this.urlFiles, this.scene, zone)

					if(pself.visitor !== true) {
						document.getElementById('charsave').innerHTML = 'Welcome to First Earth'
					}
					this.send({
						ready: pself.id
					})
				break;
			}
		})
	}


}


function offerReconnect(reason) {
	document.getElementById('gameinfo').innerHTML = `<span title="${event}">${reason}. <a id="reconnect" href="">Reconnect?</a></span>`
	document.getElementById('reconnect').addEventListener('click', (ev) => {
		window.location.reload()
		ev.preventDefault()
	})
	document.getElementById('enterbutton').disabled = false

}