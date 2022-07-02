const { BrowserWindow, app } = require('electron')


let mainWindow = null

function main() {
  mainWindow = new BrowserWindow()
  mainWindow.webContents.openDevTools()
  mainWindow.loadURL(`http://localhost:3001`)
  mainWindow.on('close', event => {
    mainWindow = null
  })
}

app.on('ready', main)