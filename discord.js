import webhook from 'webhook-discord'
import fs from 'fs'
import { env } from 'process'

// Send Discord a message (eg for when we do a deploy)

let hook

const envs = fs.readFileSync('.env').toString()
const lines = envs.split('\n')

for(let line of lines) {
	const parts = line.split('=')
	if(parts[0] === 'DISCORD_WEBHOOK') {
		hook = new webhook.Webhook(parts[1])
	}
}

if(hook) {
	hook.success('Avialle', 'A new version of First Earth has been deployed!')
}

