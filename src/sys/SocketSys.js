import { menuSelfData, menuShowLink, toprightReconnect, toprightText } from "../stores"
import Cookies from "js-cookie"
import { MeshPhongMaterial } from "three"
import { DoubleSide } from "three"
import { LinearEncoding } from "three"
import { MeshBasicMaterial, sRGBEncoding } from "three"
import { Color } from "three"
import { AmbientLight } from "three"
import { DirectionalLight } from "three"
import { AnimationMixer } from "three"
import { LoopRepeat } from "three"
import { Skeleton } from "three"
import { AnimationClip } from "three"
import { SkinnedMesh } from "three"
import { LoopOnce } from "three"
import { PointLight } from "three"
import { CubeTextureLoader } from "three"
import { TextureLoader } from "three"
import { Appearance } from "../com/Appearance"
import { Gob } from "../ent/Gob"
import { MoveSys } from "./MoveSys"
import { UiSys } from '../sys/UiSys'
import * as Utils from '../Utils'
import { EventSys } from "./EventSys"
import { WorldSys } from "./WorldSys"

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

					// Let's set pself transform data
					// ECS.AddEnt(pself.id)
					// ECS.AddCom(pself.id, 'player', {self:true})
					// ECS.AddCom(pself.id, 'location', {
					// 	idzone: pself.idzone,
					// 	x: pself.x,
					// 	z: pself.z,
					// })
					EventSys.Dispatch('load-self', pself)


					this.Send({
						ready: pself.id,
					})

					// // Let's load the model?
					// // let obj = await Gob.Create('/char/model/woman-actionhero-EXPORT.fbx', this.scene, this)
					// // obj.mesh.scale.multiplyScalar(0.01 * 3.3)
					// // const player = this.scene.children.find(o=>o.name=='player')
					// // obj.mesh.position.copy(player.position)
					// // obj.mesh.position.y -= this.ftHeightHead
					// let playerGob = new Gob
					// let pMesh = await playerGob.loadChar('/char/woman-actionhero.gltf', this)
					// console.log('thing?', pMesh)
					// pMesh.position.x = 20
					// pMesh.position.z = 20
					// pMesh.position.y = 2
					// pMesh.scale.multiplyScalar(3.3)
					// pMesh.castShadow = true
					
					
					const texture = new TextureLoader().load('http://localhost:3000/files/char/female/color-atlas-new2.png');
					texture.flipY = false // quirk for GLTFLoader separate texture loading!  (not for fbx!)
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
					
					// pMesh.material = material
					// // this.scene.add(pMesh)
					// console.log('pmesh', pMesh)


					////////////////////////////////////////////////////////////
					////////////////////////////////////////////////////////////

					
					// Animation?


					// let anim = await playerGob.loadChar('/char/anim/untitled.gltf', this)
					// const anim = await Appearance.LoadFbx(this, '/char/anim/Walk_InPlace_Female.fbx') // Group.animations[0] is AnimationClip
					// console.log('anim', anim)

					// const rig = await Appearance.LoadFbx(this, '/char/anim/woman_actionhero_Rig.fbx') // children[]: 0:Line, 1:Group.children[0] is SkinnedMesh!
					// console.log('rig', rig)
					// const rigsm = rig.children[1].children[0] // This does have BufferGeometry.  But so does pmesh.  This also has Skeleton!


					// const mixer = new AnimationMixer( pMesh );
					// pMesh.animations = anim.animations
					// var action = mixer.clipAction(pMesh.animations[0]);
					// action.setLoop( LoopOnce );
					// action.play();
					// setInterval(() => {
					// 	mixer.update(1000/30);
					// }, 1000/30)
					// this.scene.add(pMesh)

					// Let's try from scratch
					// const mesh = new SkinnedMesh( pMesh.geometry, pMesh.material );
					// const skeleton = new Skeleton( rigsm.skeleton.bones );

					// const mixer = new AnimationMixer( mesh );
					// const mixer2 = new AnimationMixer( mesh );
					// rigsm.animations = anim.animations
					// mesh.animations = anim.animations
					
					// var action = mixer.clipAction(mesh.animations[0]);
					// action.setLoop( LoopRepeat );
					// action.play();
					// var action2 = mixer2.clipAction(rigsm.animations[0]);
					// action2.setLoop( LoopRepeat );
					// action2.play();

					// console.log("annnn", rigsm.animations[0])
					// setInterval(() => {
					// 	mixer.update(1000/30);
					// 	mixer2.update(1000/30);
					// }, 1000/30)


					// const mesh = new SkinnedMesh( pMesh.geometry, pMesh.material );
					// let skel = new Skeleton(rigsm.skeleton.bones)
					// mesh.bind(skel)
					// mesh.animations = anim.animations
					// this.scene.add(mesh)


					////////////////////////////////////////////////////////////
					////////////////////////////////////////////////////////////

					// Works!!  When export has everything at root
					// const actionwoman = await Appearance.LoadFbx(this, '/char/3dsout2/actionwoman.fbx') // children[]: 0:Line, 1:Group.children[0] is SkinnedMesh!
					// console.log('actionwoman', actionwoman)

					// this.scene.add(actionwoman)

					// const mesh = actionwoman.children[0].children[0].children[0]
					// const group = actionwoman.children[0].children[0]
					// actionwoman.children[1].material = material

					// const root = actionwoman.children[1].children[0]
					// console.log("ROOOOOT", root)
					// actionwoman.scale.multiplyScalar(0.1)

					// actionwoman.children[0].animations = actionwoman.animations
					// actionwoman.children[1].animations = actionwoman.animations

					// this.mixer = new AnimationMixer( actionwoman );
					// const clips = actionwoman.children[1].animations

					// const clip = clips[0]
					// const action = this.mixer.clipAction( clip );
					// action.play();

					////////////////////////////////////////////////////////////
					////////////////////////////////////////////////////////////

					// Now let's try with new export
					const fbx = await Appearance.LoadFbx('/files/char/female/female-rig-idle.fbx') 
					console.log('fbx', fbx)

					// fbx.rotateX(Utils.radians(90))

					this.scene.add(fbx) // fbx is a Group

					const skinnedMesh = fbx.children[0] // SkinnedMesh (ie mesh)
					const deformation = fbx.children[1] // DeformationSystem
					const root = deformation.children[0] // Root bone

					console.log('skinnedMesh, deformation, root', skinnedMesh, deformation, root)

					 // Override exported material (color map png) loaded one (mainly for settings)
					skinnedMesh.material = material

					fbx.scale.multiplyScalar(0.1)

					// Place base animations onto SkinnedMesh
					// Not needed if Clips use fbx.animations
					// skinnedMesh.animations = fbx.animations 

					this.mixer = new AnimationMixer( fbx );
					const clips = fbx.animations
					const clip = clips[0]
					const action = this.mixer.clipAction( clip );
					action.play();
					this.resetTime = 200
					texture.flipY = true


					// Works, mostly.  Let's try gltf

					// let playerGob = new Gob
					// let gltf = await playerGob.loadChar('/files/char/4ds/output/babylon.gltf', this)
					// console.log('scene is', gltf.scene)

					// const rig = gltf.scene.children[0]
					// const mesh = gltf.scene.children[1]
					// rig.animations =  gltf.animations
					// mesh.animations = gltf.animations

					// mesh.material = material
					// gltf.scene.rotateX(Utils.radians(90))
					// this.scene.add(gltf.scene)

					// this.mixer = new AnimationMixer( gltf.scene );
					// const clips = rig.animations
					// const clip = clips[0]
					// this.action = this.mixer.clipAction( clip );
					// this.action.setLoop( LoopRepeat );
					// this.action.play();
					// this.resetTime = 0.71
					// texture.flipY = false


				break;
			}
		})
	}


	static resetTime
	static action
	static mixer
	// once = 0
	static Update(dt) {
		// if(this.once < 10) {
		// 	this.once++
		// 	console.log(this.mixer?._actions)
		// }
		this.mixer?.update( dt );
		// console.log(this.action)
		if(this.action?.time > this.resetTime) {
			this.mixer._actions.forEach(a => a.time=0)
			this.mixer.update(0.1)
		}
	}

	// function seekAnimationTime(animMixer, timeInSeconds){
	// 	animMixer.time=0;
	// 	for(var i=0;i<animMixer._actions.length;i++){
	// 	  animMixer._actions[i].time=0;
	// 	}
	// 	animMixer.update(timeInSeconds)
	//   }


}

