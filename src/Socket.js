
export class Socket {
    static urlFiles
    static urlSocket
    ws
    constructor () {
        // if(import.meta.env.SNOWPACK_PUBLIC_DEVONLIVE === 'true') {
        //     this.serverHost = 'new.firstearthgame.com'
        //     this.urlFiles = `https://${this.serverHost}/files`
        //     this.urlSocket = `wss://${this.serverHost}/proxima`
        // }  else
        if(window.location.href.startsWith('https://earth.suncapped.com')) {
            Socket.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
            Socket.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
        } 
        else {
            Socket.urlSocket = `ws://localhost:2567` /* Proxima */
            Socket.urlFiles = `http://localhost:3000` /* Express (Snowpack dev is 8081) */
        }
    }

    connect(){

        this.ws = new WebSocket(Socket.urlSocket)
        this.ws.onerror = (event) => {
            console.log('socket error', event)
        }
        this.ws.onclose = (event) => {
            console.log('socket closed', event)
        }
    }

    send(data) {
        this.ws.send(data)
        console.log('Send:', data)
    }

}