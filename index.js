const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function start() {
	let args = [path.join(__dirname, "machine.js"), ...process.argv.slice(2)];
	let p = spawn(process.argv[0], args, {
		stdio: ["inherit", "inherit", "inherit", "ipc"],
	})
		.on("message", (data) => {
			if (data == "reset") {
				console.log("Restarting...");
				p.kill();
				start();
			}
		})
		.on("exit", (_, code) => {
			if (code !== 0) start();
			fs.watchFile(args[0], () => {
				fs.unwatchFile(args[0]);
				start();
			});
		});
}

start();
