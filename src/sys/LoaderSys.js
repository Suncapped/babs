import { sRGBEncoding, Vector2 } from "three"
import { Vector3 } from "three"
import { SocketSys } from "./SocketSys"
import { EventSys } from "./EventSys"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { TextureLoader } from "three"
import { MeshPhongMaterial } from "three"
import { AnimationMixer } from "three"


export class LoaderSys {

	// static pself
	// static pselfServerUpdateLoc = false
	// static pselfGridLoc

	static urlFiles

	static Start(urlFiles) {
		this.urlFiles = urlFiles
		// EventSys.Subscribe(MoveSys)
	}

	static LoadFbx(path) {
		const loader = new FBXLoader()
		return new Promise( (resolve, reject) => {
			loader.load(
				`${this.urlFiles}${path}`, // resource URL
				(group) => { // onLoad callback
					console.log('Loaded FBX:', group)
					resolve(group)
				},
				(xhr) => { // onProgress callback
					console.log( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					console.log( 'An error happened', err )
				}
			)
		}); 
	}


	static LoadTexture(path) {

		const texture = new TextureLoader().load(`${this.urlFiles}${path}`)
		texture.flipY = false // quirk for GLTFLoader separate texture loading!  (not for fbx!) // todo flipY if loading gltf
		texture.encoding = sRGBEncoding // This too, though the default seems right
		// texture.anisotropy = 16;
		return texture 

	}


	static async LoadGltf(path) {
		const loader = new GLTFLoader()//.setPath( 'models/gltf/DamagedHelmet/glTF/' );

		return new Promise( (resolve, reject) => {
			console.log('loading', path)

			loader.load(`${this.urlFiles}${path}`,// function ( gltf ) {
				(gltf) => { // onLoad callback
					console.log('Loaded GLTF:', gltf)

					// gltf.scene.traverse( function ( child ) {
					// 	if ( child.isMesh ) {
					// 		roughnessMipmapper.generateMipmaps( child.material );
					// 	}
					// } );
					// scene.add( gltf.scene );
					// // roughnessMipmapper.dispose();
					// render();

					// let mesh = gltf.scene.children[0]

					resolve(gltf)
				},
				(xhr) => { // onProgress callback
					console.log( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					console.log( 'An error happened', err )
				}
			)

		}); 

	}

	static async LoadCharacter(char) {
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
		
		const texture = await LoaderSys.LoadTexture(`/char/${char.gender}/color-atlas-new2.png`)

		
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
		// const anim = await LoaderSys.LoadFbx(this, '/char/anim/Walk_InPlace_Female.fbx') // Group.animations[0] is AnimationClip
		// console.log('anim', anim)

		// const rig = await LoaderSys.LoadFbx(this, '/char/anim/woman_actionhero_Rig.fbx') // children[]: 0:Line, 1:Group.children[0] is SkinnedMesh!
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
		// const actionwoman = await LoaderSys.LoadFbx(this, '/char/3dsout2/actionwoman.fbx') // children[]: 0:Line, 1:Group.children[0] is SkinnedMesh!
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
		const fbx = await LoaderSys.LoadFbx(`/char/${char.gender}/female-rig-idle.fbx`) 
		console.log('fbx', fbx)

		// fbx.rotateX(Utils.radians(90))

		// this.scene.add(fbx)

		const skinnedMesh = fbx.children[0] // SkinnedMesh (ie mesh)
		const deformation = fbx.children[1] // DeformationSystem
		const root = deformation.children[0] // Root bone

		// console.log('skinnedMesh, deformation, root', skinnedMesh, deformation, root)

		// Override exported material (color map png) loaded one (mainly for settings)
		skinnedMesh.material = material

		// Fix scale
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

		return fbx


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


		// function seekAnimationTime(animMixer, timeInSeconds){
		// 	animMixer.time=0;
		// 	for(var i=0;i<animMixer._actions.length;i++){
		// 	  animMixer._actions[i].time=0;
		// 	}
		// 	animMixer.update(timeInSeconds)
		//   }

	}


}