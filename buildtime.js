import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import os from 'os'

// This script was manually generated

function getLatestGitCommit() {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim()
	} catch (error) {
		console.error('Error getting latest git commit:', error)
		return ''
	}
}

function getCurrentDate() {
	return new Date().toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		timeZoneName: 'short'
	})
}

async function replaceInFiles(pattern, searchValue, replaceValue) {
	const files = await glob(pattern)

	files.forEach(file => {
		// const filePath = join(dirname(file), file)
		const filePath = file
		try {
			let content = readFileSync(filePath, 'utf8')
			content = content.replace(new RegExp(searchValue, 'g'), replaceValue)
			writeFileSync(filePath, content, 'utf8')
		} catch (error) {
			console.error(`Error processing file ${file}:`, error)
		}
	})
}

const latestCommit = getLatestGitCommit()
const now = getCurrentDate()

console.log('Latest commit:', latestCommit)

replaceInFiles('./dist/assets/index*.js', 'build_info', latestCommit)
replaceInFiles('./dist/assets/index*.js', 'build_time', now)
replaceInFiles('./dist/assets/index*.js', 'build_platform', os.platform())
