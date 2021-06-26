import Cookies from "js-cookie"
import { BABS } from "./Babs"

export class Socket {
	urlFiles
	urlSocket
	ws
	world
	scene

	static CookieOpts = { 
		expires: 365, 
		domain: 'suncapped.com',
	}

	static Create(scene, world) {
		let socket = new Socket
		socket.scene = scene
		socket.world = world
		if (window.location.href.startsWith('https://earth.suncapped.com')) {
			socket.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			socket.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
		}
		else {
			socket.urlSocket = `ws://localhost:2567` /* Proxima */
			socket.urlFiles = `http://localhost:3000` /* Express (Snowpack dev is 8081) */
		}

		socket.ws = new WebSocket(socket.urlSocket)

		socket.ws.onopen = (event) => {
			const existingSession = Cookies.get('session')
			console.log('existingSession', existingSession)
			if(existingSession){
				document.getElementById('charsave').style.visibility = 'hidden'
				document.getElementById('gameinfo').textContent = "Logging in..."
				socket.auth(existingSession)
			}
			else {
				BABS.run()
			}
		}
		socket.ws.onmessage = (event) => {
			const payload = JSON.parse(event.data)
			console.log('Rec:', payload)
			socket.process(payload)
		}
		socket.ws.onerror = (event) => {
			console.log('socket error', event)
			document.getElementById('gameinfo').innerHTML = `<span title="${event}">Unable to connect to server.</span>`
		}
		socket.ws.onclose = (event) => {
			console.log('socket closed', event)
		}
		
		return socket
	}

	auth(session) {
		this.send({
			auth: session
		})
	}
	login(email, pass) {
		this.send({
			login: {
				email,
				pass,
			}
		})
	}

	send(json) {
		console.log('Send:', json)
		this.ws.send(JSON.stringify(json))
	}

	process(payload){
		Object.entries(payload).forEach(async ([op, data]) => {
			switch(op) {
				case 'session':
					this.session = data
					Cookies.set('session', this.session, this.CookieOpts)
					this.auth(this.session)
				break;
				case 'join':

					const joinZone = data
					await this.world.loadStatics(this.urlFiles, this.scene)
					// TODO do joining stuff then
	
					this.send({
						join: 'testzone'
					})
				break;
			}
		})
	}

}