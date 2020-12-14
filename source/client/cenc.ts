/*
navigator.requestMediaKeySystemAccess("org.w3.clearkey", [{
	initDataTypes: ["cenc"],
	audioCapabilities: [{
		contentType: "audio/mp4; codecs=\"mp4a.40.2\""
	}]]
}]).then(async (mediaKeySystemAccess) => {
	let mediaKeys = await mediaKeySystemAccess.createMediaKeys();
	await video.setMediaKeys(mediaKeys);
	video.addEventListener("encrypted", async (event) => {
		let mediaKeySession = mediaKeys.createSession();
		mediaKeySession.addEventListener("message", async (event) => {
			let license = createLicense(event.message);
			await mediaKeySession.update(license);
		});
		await mediaKeySession.generateRequest(event.initDataType, event.initData ?? new ArrayBuffer(0));
	});
	let mediaSource = new MediaSource();
	video.src = URL.createObjectURL(mediaSource);
	mediaSource.addEventListener("sourceopen", async () => {
		URL.revokeObjectURL(video.src);
		let mime = "audio/mp4; codecs=\"mp4a.40.2\"";
		let sourceBuffer = mediaSource.addSourceBuffer(mime);
		let response = await fetch("");
		let arrayBuffer = await response.arrayBuffer();
		sourceBuffer.addEventListener("updateend", () => {
			if (!sourceBuffer.updating && mediaSource.readyState === "open") {
				mediaSource.endOfStream();
			}
		});
		sourceBuffer.appendBuffer(arrayBuffer);
	});
});

function createLicense(message: ArrayBuffer): Uint8Array {
	let string = JSON.stringify({
		keys: [{
			kty: "oct",
			alg: "A128KW",
			kid: "",
			k: ""
		}]
	});
	return new TextEncoder().encode(string);
}
*/
