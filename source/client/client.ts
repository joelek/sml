namespace is {
	export function absent<A>(subject: A | null | undefined): subject is null | undefined {
		return subject == null;
	};

	export function present<A>(subject: A | null | undefined): subject is A {
		return subject != null;
	};
};

namespace as {
	export function array(subject: any): Array<any> {
		if (is.absent(subject) || subject.constructor !== Array) {
			throw ``;
		}
		return subject;
	};

	export function boolean(subject: any): boolean {
		if (is.absent(subject) || subject.constructor !== Boolean) {
			throw ``;
		}
		return subject as boolean;
	};

	export function number(subject: any): number {
		if (is.absent(subject) || subject.constructor !== Number) {
			throw ``;
		}
		return subject as number;
	};

	export function record(subject: any): Record<string, any> {
		if (is.absent(subject) || subject.constructor !== Object) {
			throw ``;
		}
		return subject;
	};

	export function string(subject: any): string {
		if (is.absent(subject) || subject.constructor !== String) {
			throw ``;
		}
		return subject as string;
	};
};

function element(selector: string, ...children: Array<Node>): HTMLElement {
	let parts = selector.match(/([a-z][a-z0-9_-]*|[.][a-z][a-z0-9_-]*|[\[][^=]+[=][^\]]*[\]])/g) ?? [];
	let tag = parts.shift() as string;
	let classNames = parts.filter((part) => /[.][a-z][a-z0-9_-]*/.test(part));
	let attributes = parts.filter((part) => /[\[][^=]+[=][^\]]*[\]]/.test(part));
	let element = document.createElement(tag);
	for (let className of classNames) {
		let parts = /^[.]([a-z][a-z0-9_-]*)$/.exec(className) ?? [];
		element.classList.add(parts[1]);
	}
	for (let attribute of attributes) {
		let parts = /^[\[]([^=]+)[=]([^\]]*)[\]]$/.exec(attribute) ?? [];
		element.setAttribute(parts[1], parts[2]);
	}
	for (let child of children) {
		element.appendChild(child);
	}
	return element;
}

function text(string: string): Text {
	return document.createTextNode(string);
}

function on<A extends keyof HTMLElementEventMap>(element: HTMLElement, type: A, listener: (event: HTMLElementEventMap[A]) => void): HTMLElement {
	element.addEventListener(type, listener);
	return element;
}

type ServiceWorkerRequest = {
	<A, B>(type: string, data: A, parse: (type: string, data: any) => B): Promise<B>;
};

async function getServiceWorker(): Promise<ServiceWorkerRequest> {
	let regstration = await navigator.serviceWorker.register("service.js");
	await regstration.update();
	function request<A, B>(type: string, data: A, parse: (type: string, data: any) => B): Promise<B> {
		let messageChannel = new MessageChannel();
		messageChannel.port1.start();
		navigator.serviceWorker.controller?.postMessage({
			type: type,
			data: data
		}, [messageChannel.port2]);
		return new Promise<B>((resolve, reject) => {
			messageChannel.port1.addEventListener("message", function onmessage(event) {
				messageChannel.port1.removeEventListener("message", onmessage);
				console.log("Client", event);
				try {
					let message = as.record(event.data);
					let type = as.string(message.type);
					let data = as.record(message.data);
					resolve(parse(type, data));
				} catch (error) {
					reject(error);
				}
			});
		});
	};
	return request;
}

function duration(ms: number): string {
	let s = Math.floor(ms / 1000);
	ms -= s * 1000;
	let m = Math.floor(s / 60);
	s -= m * 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

type Track = {
	file: string,
	artist: string,
	title: string,
	duration_ms: number
};

let track: Track | undefined;

let audio = element(`audio.player__audio[controls=][playsinline=]`) as HTMLAudioElement;
let title = element("div.player__title[single-line=]", text(""));
let artist = element("div.player__artist[single-line=]", text(""));
let player = on(element("div.player",
	element("div.player__content",
		audio,
		title,
		artist
	)
), "click", () => {
	if (is.present(track)) {
		if (audio.paused) {
			audio.play();
		} else {
			audio.pause();
		}
	}
});

audio.addEventListener("pause", () => {

});

audio.addEventListener("playing", () => {

});

audio.addEventListener("error", () => {
	track = undefined;
	title.textContent = "Kassettbandstrassel!";
	artist.textContent = "";
});

audio.addEventListener("ended", () => {
	track = undefined;
	title.textContent = "";
	artist.textContent = "";
});

let key = element("div.auth__key");

function play(playlist: Array<Track>, index: number): void {
	if (index < 0 || index >= playlist.length) {
		return;
	}
	audio.src = `content/${playlist[index].file}`;
	title.textContent = "Spolar fram...";
	artist.textContent = "";
	audio.play();
	audio.addEventListener("playing", function onplaying() {
		audio.removeEventListener("playing", onplaying);
		track = playlist[index];
		title.textContent = track.title;
		artist.textContent = track.artist;
	});
}

getServiceWorker().then(async (request) => {
	let response = await fetch("playlist.json");
	let json = await response.json();
	let playlist = as.array(json).map((entry) => ({
		file: as.string(entry.file),
		artist: as.string(entry.artist),
		title: as.string(entry.title),
		duration_ms: as.number(entry.duration_ms)
	}));
	let app = element("div.app",
		element("div.app__scroll[scroll-container=]",
			element("div.app__content",
				element("div.header",
					element("img.header__image[src=logo.png]")
				),
				element("div.text",
					element("div.text__title",
						text("Succén från ZTV fortsätter i det här digitala HD-kassettbandet från Track Tape AB.")
					),
					element("div.text__subtitle",
						text("För att få lyssna behöver du en speciell krypteringsnyckel. Har du ingen nyckel kan du delta i vår lyssnartävling!")
					),
					element("div.text__subtitle",
						text("Samla ett godtyckligt antal QR-koder från Dafgårds renskav och skicka dem till Rosenbad. Portot står vi för!")
					)
				),
				element("div.auth",
					on(element("input.auth__input[type=password][spellcheck=false]"), "input", async (event) => {
						let target = event.target as HTMLInputElement;
						let response = await request("SetKey", { key: target.value }, (type, data) => {
							let success = as.boolean(data.success);
							return {
								success
							};
						});
						if (response.success) {
							key.textContent = "Nyckeln matades in korrekt.";
						} else {
							key.textContent = "Det är något fel på nyckeln. Ring mamma och fråga efter hennes bästa krypteringsnyckel. Om mamma ställer svåra frågor om krypteringsalgoritmer och bitlängder uppger du lungt och sansat AES-CBC, 128 bitar.";
						}
					}),
					key
				),
				element("div.playlist", ...playlist.map((track, index) =>
					on(element("div.track",
						element("div.track__title[single-line=]",
							text(track.title)
						),
						element("div.track__artist[single-line=]",
							text([track.artist, duration(track.duration_ms)].join(" \u00b7 "))
						)
					), "click", () => {
						play(playlist, index);
					}),
				))
			)
		),
		element("div.app__player",
			player
		)
	);
	document.body.appendChild(app);
});
