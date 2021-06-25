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
        if(window.location.href.startsWith('https://earth.suncapped.com')) {
            socket.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
            socket.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
        } 
        else {
            socket.urlSocket = `ws://localhost:2567` /* Proxima */
            socket.urlFiles = `http://localhost:3000` /* Express (Snowpack dev is 8081) */
        }
        return socket        
    }

    connect = () => {
        this.ws = new WebSocket(this.urlSocket)
        this.ws.onerror = (event) => {
            console.log('socket error', event)
        }
        this.ws.onclose = (event) => {
            console.log('socket closed', event)
        }

        this.ws.onopen = (event) => {
            console.log('socket onopen', event)
            this.send(`Login:adam/test`)
        }

        this.ws.onmessage = async (event) => {
            console.log('Rec:', event.data)
            if(typeof event.data === 'string') {
                const parts = event.data.split(/\:(.+)/) // split on first ':'
                if(parts.length > 1) {
                    if('Session' === parts[0]) {
                        this.session = parts[1]
                        localStorage.setItem('session', this.session)
                        this.send('Session:'+this.session)
                    }
                    else if('Join' === parts[0]) {
                        const joinZone = parts[1]
                        await this.world.loadStatics(this.urlFiles, this.scene)
                        // TODO do joining stuff then


                        this.send('Join:'+joinZone)
                    }
                    else {
                        console.log('Unknown event.data value')
                    }
                }
            }
        }
    }

    send(data) {
        this.ws.send(data)
        console.log('Send:', data)
    }


    // document.getElementById('gameinfo')
    // document.getElementById('charsave')

}