import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'

export class Appearance {
	
	static LoadFbx(socket, path) {
		const loader = new FBXLoader()
		return new Promise( (resolve, reject) => {
			console.log('loading', socket.urlFiles, path)
			loader.load(
				`${socket.urlFiles}${path}`, // resource URL
				(group) => { // onLoad callback
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
	init(one, two, three) {

	}


    animControls(delta, scene) {

	}
}