import Cookies from "js-cookie"
import { BABS } from "./Babs"
import { Ui } from "./Ui"

export class Socket {
	urlFiles
	urlSocket
	ws
	world
	scene

	static isProd = window.location.href.startsWith('https://earth.suncapped.com')
	static devDomain = 'localhost'

	static Create(scene, world) {
		let socket = new Socket
		socket.scene = scene
		socket.world = world
		if (Socket.isProd) {
			socket.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			socket.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
			socket.baseDomain = 'suncapped.com'
		}
		else {
			socket.urlSocket = `ws://${Socket.devDomain}:2567` /* Proxima */
			socket.urlFiles = `http://${Socket.devDomain}:3000` /* Express (Snowpack dev is 8081) */
			socket.baseDomain = `${Socket.devDomain}`
		}

		socket.ws = new WebSocket(socket.urlSocket)
		document.getElementById('gameinfo').textContent = 'Connecting...'

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
			offerReconnect('Connection is closed.')
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
		console.log('Send:', json)

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
					document.getElementById('enterbutton').disabled = false
					// Handle failed login/register here
					if(data === 'userpasswrong') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Username/password does not match."
					}
					else if(data === 'emailinvalid') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Email is invalid."
					}
					else if(data === 'accountfailed') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Account creation error."
					}
					else if(data === 'passtooshort') {
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('gameinfo').textContent = "Password too short, must be 8"
					}
				break;
				case 'visitor':
					this.session = data
					Cookies.set('session', this.session, { 
						domain: this.baseDomain,
						secure: Socket.isProd,
						sameSite: 'strict',
					}) // Non-set expires means it's a session cookie only, not saved across sessions
					document.getElementById('gameinfo').textContent = "Entering..."
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'session':
					this.session = data
					Cookies.set('session', this.session, { 
						expires: 365,
						domain: this.baseDomain,
						secure: Socket.isProd,
						sameSite: 'strict',
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
						document.getElementById('charsave').style.visibility = 'visible'
						document.getElementById('charsave').textContent = 'Waking up...'
						document.getElementById('gameinfo').innerHTML = '<div id="linkmenu"><a href="#">Menu</a> (esc key)</div>'
						
						const togglemenu = (ev) => {
							if(ev.code == 'Escape' || ev.type == 'click') {
								const menu = document.getElementById('menu')
								menu.style.display = menu.style.display == 'block' ? 'none' : 'block'
							}
						}
						document.getElementById('linkmenu').addEventListener('click', togglemenu)
						document.addEventListener('keydown', togglemenu)

						const joinDate = new Date(Date.parse(pself.created_at))
						const joinMonth = joinDate.toLocaleString('default', { month: 'long' })
						const joinYear = joinDate.toLocaleString('default', { year: 'numeric' })

						const menul = document.querySelector('#menu > ul')
						menul.append(Ui.CreateEl(`<li>Joined in <span title="${joinDate}">${joinMonth} ${joinYear}<span></li>`))
						if(pself.nick) menul.append(Ui.CreateEl(`<li>Known as: ${pself.nick}</li>`))
						menul.append(Ui.CreateEl(`<li>What are you most excited to do in First Earth?</li>`))
						menul.append(Ui.CreateEl(`<li>
							<input id="inputreason" type="text" value="${pself.reason}" />
							<button id="savereason" type="submit" >Save</button> />
						</li>`))
						document.getElementById('savereason').addEventListener('click', async ev => {
							ev.preventDefault()
							const reason = ev.target.value
							ev.target.value = 'Saving...'
							await this.send({
								'savereason': reason,
							})
							ev.target.value = reason
						})

						menul.append(Ui.CreateEl(`<li>&nbsp;</li>`))
						menul.append(Ui.CreateEl(`<li><b>Account<b/></li>`))
						menul.append(Ui.CreateEl(`<li>${pself.email}</li>`))
						menul.append(Ui.CreateEl(`<li>Credit Months: ${pself.credits}</li>`))
						menul.append(Ui.CreateEl(`<li>Subscription: Credits</li>`)) // Free / Credits / Paid / Paid (Credits)
						menul.append(Ui.CreateEl(`<li>Until: (after release)</li>`))
						
						menul.append(Ui.CreateEl(`<li>&nbsp;</li>`))
						menul.append(Ui.CreateEl(`<li><a id="logout" href="#">Logout</a></li>`))
						document.getElementById('logout').addEventListener('click', (ev) => {
							ev.preventDefault()
							Cookies.remove('session')
							window.location.reload()
						})
					}

					BABS.run()
					await this.world.loadStatics(this.urlFiles, this.scene, zone)

					if(pself.visitor !== true) {
						document.getElementById('charsave').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}
					this.send({
						ready: pself.id
					})
				break;
			}
		})
	}


}


export function offerReconnect(reason) {
	document.getElementById('gameinfo').innerHTML = `<span title="${event}">${reason} [<a id="reconnect" href="">Reconnect?</a>]</span>`
	document.getElementById('reconnect').addEventListener('click', (ev) => {
		window.location.reload()
		ev.preventDefault()
	})
	document.getElementById('enterbutton').disabled = false
}