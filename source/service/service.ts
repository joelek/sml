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

let key: CryptoKey | undefined;

function bufferFromHex(hex: string): Uint8Array {
	return new Uint8Array((hex.match(/[0-9a-f]{2}/gi) ?? []).map((group) => {
		return parseInt(group, 16);
	}));
}

async function sendMessage(event: any, message: any): Promise<void> {
	// @ts-ignore
	let client = await self.clients.get(event.clientId);
	if (is.absent(client)) {
		return;
	}
	client.postMessage(message);
}

self.addEventListener("install", (event: any) => {
	// @ts-ignore
	self.skipWaiting();
});

self.addEventListener("activate", (event: any) => {
	// @ts-ignore
	event.waitUntil(self.clients.claim());
});

self.addEventListener("message", async (event: any) => {
	console.log("Service", event);
	let message = as.record(event.data);
	let type = as.string(message.type);
	let data = as.record(message.data);
	if (type === "SetKey") {
		try {
			let raw = bufferFromHex(as.string(data.key));
			key = await crypto.subtle.importKey("raw", raw, "AES-CBC", false, ["encrypt", "decrypt"]);
			event.ports[0].postMessage({ type: "Status", data: {
				success: true
			}});
		} catch (error) {
			event.ports[0].postMessage({ type: "Status", data: {
				success: false
			}});
		}
	}
});

type RangeResponse = {
	status: number,
	offset: number,
	length: number
	file_size: number
};

function parseRange(header: string | undefined | null, file_size: number): RangeResponse {
	if (is.absent(header)) {
		return {
			status: 200,
			offset: 0,
			length: file_size,
			file_size: file_size
		};
	}
	let s416 = {
		status: 416,
		offset: 0,
		length: 0,
		file_size: file_size
	};
	let parts: RegExpExecArray | undefined;
	parts = /^bytes[=]([0-9]+)[-]$/.exec(header) ?? undefined;
	if (is.present(parts)) {
		let one = Number.parseInt(parts[1], 10);
		if (one >= file_size) {
			return s416;
		}
		return {
			status: 206,
			offset: one,
			length: file_size - one,
			file_size: file_size
		};
	}
	parts = /^bytes[=]([0-9]+)[-]([0-9]+)$/.exec(header) ?? undefined;
	if (is.present(parts)) {
		let one = Number.parseInt(parts[1], 10);
		let two = Number.parseInt(parts[2], 10);
		if (two < one) {
			return s416;
		}
		if (one >= file_size) {
			return s416;
		}
		if (two >= file_size) {
			two = file_size - 1;
		}
		return {
			status: 206,
			offset: one,
			length: two - one + 1,
			file_size: file_size
		};
	}
	parts = /^bytes[=][-]([0-9]+)$/.exec(header) ?? undefined;
	if (is.present(parts)) {
		let one = Number.parseInt(parts[1], 10);
		if (one < 1) {
			return s416;
		}
		if (file_size < 1) {
			return s416;
		}
		if (one > file_size) {
			one = file_size;
		}
		return {
			status: 206,
			offset: file_size - one,
			length: one,
			file_size: file_size
		};
	}
	return s416;
}

type ContentRangeResponse = {
	offset: number,
	length: number,
	file_size: number
};

function parseContentRange(header: string | undefined | null): ContentRangeResponse {
	if (is.absent(header)) {
		throw `Expected a content-range header!`;
	}
	let parts: RegExpExecArray | undefined;
	parts = /^bytes ([0-9]+)[-]([0-9]+)[/]([0-9]+)$/.exec(header) ?? undefined;
	if (is.present(parts)) {
		let first_byte = Number.parseInt(parts[1], 10);
		let last_byte = Number.parseInt(parts[1], 10);
		let file_size = Number.parseInt(parts[3], 10);
		if (first_byte > last_byte) {
			throw `Expected a valid content-range header!`;
		}
		if (first_byte >= file_size) {
			throw `Expected a valid content-range header!`;
		}
		if (last_byte >= file_size) {
			throw `Expected a valid content-range header!`;
		}
		return {
			offset: first_byte,
			length: last_byte - first_byte + 1,
			file_size: file_size
		};
	}
	parts = /^bytes [*][/]([0-9]+)$/.exec(header) ?? undefined;
	if (is.present(parts)) {
		let file_size = Number.parseInt(parts[1], 10);
		return {
			offset: 0,
			length: 0,
			file_size: file_size
		};
	}
	throw `Expected a valid content-range header!`;
}

async function decryptBlocks(encrypted_blocks: Uint8Array, previous_encrypted_block: Uint8Array, key: CryptoKey, final: boolean): Promise<Uint8Array> {
	if (final) {
		return new Uint8Array(await crypto.subtle.decrypt({
			name: "AES-CBC",
			iv: previous_encrypted_block
		}, key, encrypted_blocks));
	}
	let last_block = encrypted_blocks.slice(-16);
	let padding = new Uint8Array(await crypto.subtle.encrypt({
		name: "AES-CBC",
		iv: last_block
	}, key, new Uint8Array(0)));
	let padded = new Uint8Array(encrypted_blocks.length + 16);
	padded.set(encrypted_blocks, 0);
	padded.set(padding, encrypted_blocks.length);
	return new Uint8Array(await crypto.subtle.decrypt({
		name: "AES-CBC",
		iv: previous_encrypted_block
	}, key, padded));
}

async function getPaddingLength(encrypted_tail: Uint8Array, iv: Uint8Array, key: CryptoKey): Promise<number> {
	let length = encrypted_tail.byteLength;
	if (length % 16 !== 0) {
		throw `Expected an even number of blocks!`;
	}
	if (length >= 32) {
		iv = new Uint8Array(encrypted_tail.buffer, length - 32, 16);
	}
	encrypted_tail = new Uint8Array(encrypted_tail.buffer, length - 16, 16);
	let decrypted_tail = await crypto.subtle.decrypt({
		name: "AES-CBC",
		iv: iv
	}, key, encrypted_tail);
	return 16 - decrypted_tail.byteLength;
}

type DataProvider = (offset: number, length: number) => Promise<Uint8Array>;

class RequestHandler {
	private iv: Uint8Array;
	private key: CryptoKey;
	private block_count: number;
	private decrypted_length: number;
	private data_provider: DataProvider;

	constructor(iv: Uint8Array, key: CryptoKey, encrypted_length: number, decrypted_length: number, data_provider: DataProvider) {
		this.iv = iv;
		this.key = key;
		this.block_count = Math.ceil(encrypted_length / 16);
		this.decrypted_length = decrypted_length;
		this.data_provider = data_provider;
	}

	getDecryptedLength(): number {
		return this.decrypted_length;
	}

	async requestDecryptedRange(offset: number, length: number): Promise<Uint8Array> {
		let first_block = Math.floor((offset) / 16);
		let last_block = Math.floor((offset + length - 1) / 16);
		let block_offset = first_block > 0 ? first_block - 1 : first_block;
		let block_length = last_block - block_offset + 1;
		let data = await this.data_provider(block_offset * 16, block_length * 16);
		let previous_encrypted_block = first_block > 0 ? new Uint8Array(data.buffer, 0, 16) : this.iv;
		let encrypted_blocks = first_block > 0 ? new Uint8Array(data.buffer, 16) : data;
		let decrypted_blocks = await decryptBlocks(encrypted_blocks, previous_encrypted_block, this.key, last_block === this.block_count - 1);
		let decrypted = new Uint8Array(decrypted_blocks.buffer, offset % 16, length);
		return decrypted;
	}

	getDecryptedReader(offset: number, length: number): ReadableStream {
		return new ReadableStream({
			pull: async (controller) => {
				if (length > 0) {
					let bytes_to_request = Math.min(length, offset > 0 ? 1024 * 1024 : 256 * 1024);
					let blocks = await this.requestDecryptedRange(offset, bytes_to_request);
					controller.enqueue(blocks);
					offset += bytes_to_request;
					length -= bytes_to_request;
				} else {
					controller.close();
				}
			}
		});
	}

	private static INSTANCES = new Map<string, RequestHandler | undefined>();

	static async get(url: string, iv: Uint8Array, key: CryptoKey): Promise<RequestHandler> {
		let instance = this.INSTANCES.get(url);
		if (is.present(instance)) {
			return instance;
		}
		let headers = new Headers();
		headers.append("range", "bytes=-32")
		let request = new Request(url, {
			headers
		});
		let response = await fetch(request);
		if (response.status === 200) {
			let encrypted_blocks = new Uint8Array(await response.arrayBuffer(), 0);
			let encrypted_length = encrypted_blocks.byteLength;
			let decrypted_length = encrypted_length - await getPaddingLength(encrypted_blocks, iv, key);
			instance = new RequestHandler(
				iv,
				key,
				encrypted_length,
				decrypted_length,
				async (offset, length) => {
					return new Uint8Array(encrypted_blocks.buffer, offset, length);
				}
			);
			this.INSTANCES.set(url, instance);
			return instance;
		}
		if (response.status === 206) {
			let content_range = parseContentRange(response.headers.get("content-range"));
			let encrypted_blocks = new Uint8Array(await response.arrayBuffer());
			let encrypted_length = content_range.file_size;
			let decrypted_length = encrypted_length - await getPaddingLength(encrypted_blocks, iv, key);
			instance = new RequestHandler(
				iv,
				key,
				encrypted_length,
				decrypted_length,
				async (offset, length) => {
					let headers = new Headers();
					headers.append("range", `bytes=${offset}-${offset+length-1}`);
					let response = await fetch(url, {
						headers: headers
					});
					return new Uint8Array(await response.arrayBuffer());
				}
			);
			this.INSTANCES.set(url, instance);
			return instance;
		}
		throw `Expected a 200 or 206 status from server!`;
	}
}

self.addEventListener("fetch", (event: any) => {
	let request = event.request as Request;
	let parts = /[/]content[/]([0-9a-f]{32})$/.exec(request.url) ?? undefined;
	if (is.absent(parts)) {
		return event.respondWith(fetch(request));
	}
	if (is.absent(key)) {
		return event.respondWith(new Response(null, {
			status: 401
		}));
	}
	let iv = bufferFromHex(parts[1]);
	return event.respondWith(RequestHandler.get(request.url, iv, key).then(async (requestHandler) => {
		let range = parseRange(request.headers.get("range"), requestHandler.getDecryptedLength());
		let headers = new Headers();
		headers.append("content-type", "audio/mp4");
		headers.append("accept-ranges", "bytes");
		headers.append("content-length", `${range.length}`);
		if (range.length === 0) {
			headers.append("content-range", `bytes */${range.file_size}`);
			return new Response(null, {
				status: range.status,
				headers: headers
			});
		} else {
			headers.append("content-range", `bytes ${range.offset}-${range.offset+range.length-1}/${range.file_size}`);
			let body = requestHandler.getDecryptedReader(range.offset, range.length);
			return new Response(body, {
				status: range.status,
				headers: headers
			});
		}
	}));
});
