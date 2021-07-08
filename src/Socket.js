import Cookies from "js-cookie"
import { MeshPhongMaterial } from "three"
import { DoubleSide } from "three"
import { LinearEncoding } from "three"
import { MeshBasicMaterial, sRGBEncoding } from "three"
import { Color } from "three"
import { AmbientLight } from "three"
import { DirectionalLight } from "three"
import { PointLight } from "three"
import { CubeTextureLoader } from "three"
import { TextureLoader } from "three"
import { BABS } from "./Babs"
import { ECS } from "./ECS"
import { Gob } from "./Gob"
import { MoveSystem } from "./MoveSystem"
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
	static pingSeconds = 30

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
		socket.ws.binaryType = 'arraybuffer'


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
				socket.process(payload)
			}
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
		if(!json.ping && !json.move) console.log('Send:', json)
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
				case 'alreadyin':
					// Just have them repeat the auth if this was their second login device
					
					offerReconnect('Logged out your other session.  Try again! ->')
					
				break;
				case 'load':
					window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
						this.send({ping:'ping'})
					}, Socket.pingSeconds * 1000)

					const pself = data.self
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

					// Let's set pself transform data
					ECS.AddEnt(pself.id)
					ECS.AddCom(pself.id, 'player', {self:true})
					ECS.AddCom(pself.id, 'location', {
						idzone: pself.idzone,
						x: pself.x,
						z: pself.z,
					})
					MoveSystem.evtSelfAdded(pself)


					this.send({
						ready: pself.id,
					})

					// Let's load the model?
					// let obj = await Gob.Create('/char/model/woman-actionhero-EXPORT.fbx', this.scene, this)
					// obj.mesh.scale.multiplyScalar(0.01 * 3.3)
					// const player = this.scene.children.find(o=>o.name=='player')
					// obj.mesh.position.copy(player.position)
					// obj.mesh.position.y -= this.ftHeightHead
					let playerGob = new Gob
					let pMesh = await playerGob.loadChar('/char/woman-actionhero.gltf', this)
					console.log('thing?', pMesh)
					pMesh.position.x = 200
					pMesh.position.z = 200
					pMesh.position.y = 4
					pMesh.scale.multiplyScalar(3.3)
					pMesh.castShadow = true
					
					
					const texture = new TextureLoader().load('http://localhost:3000/char/color-atlas-new2.png');
					texture.flipY = false // quirk for GLTFLoader separate texture loading!
					texture.encoding = sRGBEncoding // This too, though the default seems right
					// texture.anisotropy = 16;
					
					const material = new MeshPhongMaterial( {
						map: texture,
						// bumpMap: texture,
						// bumpScale: bumpScale,
						// color: diffuseColor,
						specular: 0.16,
						// reflectivity: 0.5, // ??
						shininess: 0.2,
						// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
					} );
					
					pMesh.material = material
					this.scene.add(pMesh)


					// Animation?


					// mixer = new THREE.AnimationMixer( mesh );
					// mixer.clipAction( gltf.animations[ 0 ] ).setDuration( 1 ).play();

					// fadeToAction( name, 0.2 );
					// mixer.addEventListener( 'finished', restoreState );




				break;
			}
		})
	}


}


export function offerReconnect(reason) {
	toprightReconnect.set(reason)
}