const { spawn } = require("child_process");
const path = require("path");

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
			watchFile(args[0], () => {
				unwatchFile(args[0]);
				start();
			});
		});
}

start();
