import {
    Vector3,
    Scene,
    BoxGeometry,
    WebGLRenderer,
    PerspectiveCamera,
    Mesh,
    sRGBEncoding,
    MeshPhongMaterial,
    AxesHelper,
} from 'three'
import { World } from './World'
import { Socket } from './Socket'
import { Ui } from './Ui'
import { ComControllable } from './ComControllable'
import { ECS } from './ECS'
class Babs {
	camera
	renderer
	idPlayer
	cube
	ui
	socket

	init() {
		// Connect immediately to check for existing session
		this.scene = new Scene()
		this.world = new World(this.scene)
		this.socket = Socket.Create(this.scene, this.world)
	}

	async run() {
		this.camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 )

		document.getElementById('enterbutton').addEventListener('click', (ev) => {
			ev.preventDefault()
			this.socket.login(
				document.getElementById('email').value, 
				document.getElementById('password').value
			)
		})

		this.idPlayer = ECS.CreateEnt(1)
		ECS.AddCom(ComControllable, this.idPlayer)

		// Components init
		ECS.GetComsAll(ComControllable).forEach(async com => {
			await com.init(this.scene, this.camera, this.socket) // make 'em wait! // Should I have to pass to each?
		})

		this.cube = this.makeCube(this.scene)
		this.world.dirLight.target = this.cube
		this.scene.add( this.world.dirLight.target )

		window.addEventListener('resize', function () { 
			this.camera.aspect = window.innerWidth / window.innerHeight
			this.renderer.setSize( window.innerWidth, window.innerHeight )
			this.camera.updateProjectionMatrix()
			this.renderer.render( this.scene, this.camera )
		})

		this.ui = new Ui(document)
		this.ui.createStats('fps').createStats('mem')

		this.renderer = new WebGLRenderer( { antialias: true } )
		this.renderer.setPixelRatio( window.devicePixelRatio )
		this.renderer.setSize( window.innerWidth, window.innerHeight )
		this.renderer.setAnimationLoop( (p) => {
			this.animation(p)
		} )
		document.body.appendChild( this.renderer.domElement )
		this.renderer.outputEncoding = sRGBEncoding // todo?
		this.renderer.shadowMap.enabled = true

		// add an AxesHelper to each node
		this.scene.children.forEach((node) => {
			const axes = new AxesHelper(10)
			axes.renderOrder = 1
			axes.position.add(new Vector3(-0.2,0.2,-0.2))
			node.add(axes)
		})

		/** @type {HTMLCanvasElement} */
		const canvas = this.renderer.domElement
		canvas.id = 'canvas'
	}

	prevTime = performance.now()
	delta
	animation(time) {
		this.ui['fps'].begin()
		this.ui['mem'].begin()
		this.delta = (time -this.prevTime) /1000

		this.cube.rotation.x = time /4000
		this.cube.rotation.y = time /1000
		
		ECS.GetComsAll(ComControllable).forEach(com => {
			com.animControls(this.delta, this.scene)
		})

		this.world.animate(this.delta, this.camera, this.idPlayer)
		
		this.prevTime = time
		this.renderer.render( this.scene, this.camera )

		this.ui['fps'].end()
		this.ui['mem'].end()
	}

	makeCube() {
		const geometry = new BoxGeometry( 10, 10, 10 )
		const material = new MeshPhongMaterial()
		const cube = new Mesh(geometry, material)
		cube.name = 'this.cameracube'
		cube.position.copy(new Vector3(0,200,0))
		cube.castShadow = true
		cube.receiveShadow = true
		return cube
	}

}

export const BABS = new Babs
BABS.init()