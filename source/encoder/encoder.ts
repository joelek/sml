import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as ffprobe from "./ffprobe";

const SOURCE_DIRECTORY = [
	".",
	"private",
	"content"
];

const TARGET_DIRECTORY = [
	".",
	"public",
	"content"
];

const KEY = getEncryptionKey();

function getEncryptionKey(): Buffer {
	let path = "./private/key.bin";
	let bytes = 16;
	if (!libfs.existsSync(path)) {
		let key = libcrypto.randomBytes(bytes);
		libfs.mkdirSync("./private/", { recursive: true });
		libfs.writeFileSync(path, key);
		return key;
	}
	let key = libfs.readFileSync(path);
	if (key.length !== bytes) {
		libfs.unlinkSync(path);
		return getEncryptionKey();
	}
	return key;
}

function makeDirectories(): void {
	if (!libfs.existsSync(SOURCE_DIRECTORY.join("/"))) {
		libfs.mkdirSync(SOURCE_DIRECTORY.join("/"), { recursive: true });
	}
	if (!libfs.existsSync(TARGET_DIRECTORY.join("/"))) {
		libfs.mkdirSync(TARGET_DIRECTORY.join("/"), { recursive: true });
	}
}

type JobResult = {
	file: string,
	artist: string,
	title: string,
	duration_ms: number
};

interface Job {
	run(): Promise<JobResult>
}

function getProbeResult(source: string): Promise<ffprobe.FormatResult> {
	return new Promise((resolve, reject) => {
		libcp.exec(`ffprobe -v quiet -i "${source}" -show_format -of json`, (error, stdout, stderr) => {
			try {
				let json = JSON.parse(stdout);
				return resolve(ffprobe.FormatResult.as(json));
			} catch (error) {
				return reject(error);
			}
		});
	});
}

function computeHash(string: string): string {
	return libcrypto.createHash("sha256")
		.update(string)
		.digest()
		.slice(0, 16)
		.toString("hex");
}

function getJobs(): Array<Job> {
	let jobs = new Array<Job>();
	let entries = libfs.readdirSync(SOURCE_DIRECTORY.join("/"), { withFileTypes: true });
	for (let entry of entries) {
		if (entry.isFile()) {
			let source = [...SOURCE_DIRECTORY, entry.name].join("/");
			let target = [...TARGET_DIRECTORY, computeHash(entry.name)].join("/");
			let run = () => new Promise<JobResult>(async (resolve, reject) => {
				let probe = await getProbeResult(source);
				let cp = libcp.spawn("ffmpeg", [
					"-i", source,
					"-f", "mp4",
					"-fflags", "+bitexact",
					"-movflags", "+faststart",
					"-map_chapters", "-1",
					"-map_metadata", "-1",
					"-c:a", "aac",
					"-q:a", "2",
					"-ac", "2",
					"-c:v", "libx264",
					target, "-y"
				]);
				cp.stderr.pipe(process.stderr);
				cp.on("close", () => resolve({
					file: computeHash(entry.name),
					artist: probe.format.tags.artist,
					title: probe.format.tags.title,
					duration_ms: Math.round(Number.parseFloat(probe.format.duration) * 1000)
				}));
				cp.on("error", (error) => reject(error));
			});
			jobs.push({ run });
		}
	}
	return jobs;
}

function asBase64URL(buffer: Buffer): string {
	let string = buffer.toString("base64");
	string = string.replace(/[+]/g, "-");
	string = string.replace(/[/]/g, "_");
	string = string.replace(/[=]/g, "");
	return string;
}

async function encrypt(): Promise<void> {
	makeDirectories();
	let results = new Array<JobResult>();
	let jobs = getJobs();
	for (let job of jobs) {
		try {
			let result = await job.run();
			let decrypted = libfs.readFileSync([...TARGET_DIRECTORY, result.file].join("/"));
			let cipher = libcrypto.createCipheriv("aes-128-cbc", KEY, Buffer.from(result.file, "hex"));
			let encrypted = Buffer.concat([cipher.update(decrypted), cipher.final()]);
			libfs.writeFileSync([...TARGET_DIRECTORY, result.file].join("/"), encrypted);
			results.push(result);
		} catch (error) {
			console.log(error);
		}
	}
	let string = JSON.stringify(results.map((result) => ({
		file: result.file,
		artist: result.artist,
		title: result.title,
		duration_ms: result.duration_ms
	})), null, "\t");
	libfs.writeFileSync([...TARGET_DIRECTORY, "../", "playlist.json"].join("/"), string);
}

console.log(`KEY: ${KEY.toString("hex")} ${asBase64URL(KEY)}`);
if (process.argv[2] === "enc") {
	encrypt()
		.then(() => process.exit())
		.catch((error) => console.log(error));
}
