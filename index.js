if (!globalThis.crypto) {
    globalThis.crypto = require("node:crypto").webcrypto;
}

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let p = null;
let isRestarting = false;

function start() {
	if (isRestarting) return;
	isRestarting = true;

	let args = [path.join(__dirname, "machine.js"), ...process.argv.slice(2)];
	p = spawn(process.argv[0], args, {
		stdio: ["inherit", "inherit", "inherit", "ipc"],
	});

	p.on("message", (data) => {
		if (data === "reset") {
			console.log("[ INDEX ] Restarting bot process requested via IPC...");
			cleanupAndRestart();
		}
	});

	p.on("exit", (code, signal) => {
		console.log(`[ INDEX ] Bot process exited with code ${code}, signal ${signal}.`);
		p = null;
		// Only restart if we are not already in a manual restart process
		if (!isRestarting) {
			console.log("[ INDEX ] Unexpected exit. Restarting bot in 1.5 seconds...");
			setTimeout(() => {
				isRestarting = false;
				start();
			}, 1500);
		}
	});

	// Process successfully spawned, clear restarting flag
	isRestarting = false;
}

function cleanupAndRestart() {
	if (p) {
		console.log("[ INDEX ] Sending SIGKILL to terminate the bot process...");
		p.removeAllListeners("exit"); // Remove exit listener to avoid double restart
		p.kill("SIGKILL");
		p = null;
	}
	console.log("[ INDEX ] Waiting 1.5 seconds to ensure port release...");
	setTimeout(() => {
		isRestarting = false;
		start();
	}, 1500);
}

// Watch machine.js for changes (automatic reboot for developers)
let watchTimeout = null;
fs.watch(path.join(__dirname, "machine.js"), (event, filename) => {
	if (event === "change") {
		if (watchTimeout) clearTimeout(watchTimeout);
		watchTimeout = setTimeout(() => {
			console.log("[ INDEX ] machine.js file changed. Hot-rebooting bot...");
			cleanupAndRestart();
		}, 1000);
	}
});

start();
