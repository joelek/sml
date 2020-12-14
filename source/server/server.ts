import * as libfs from "fs";
import * as libhttp from "http";
import * as libhttps from "https";

namespace is {
	export function absent<A>(subject: A | null | undefined): subject is null | undefined {
		return subject == null;
	};

	export function present<A>(subject: A | null | undefined): subject is A {
		return subject != null;
	};
};

const CONTENT_TYPES = {
	"css": "text/css",
	"html": "text/html",
	"js": "text/javascript",
	"json": "application/json",
	"png": "image/png",
	"*": "application/octet-stream"
};

function getContentType(url: string): string {
	let ext = url.split(".").pop() as string;
	return (CONTENT_TYPES as Record<string, string | undefined>)[ext] ?? CONTENT_TYPES["*"];
}

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

function handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
	let method = request.method ?? "GET";
	let url = request.url ?? "/";
	console.log(`${method}:${url}`, request.headers.range);
	let headers: libhttp.OutgoingHttpHeaders = {};
	try {
		let path = `./public${url}`; // TODO: Fix security issue.
		if (!libfs.existsSync(path)) {
			response.writeHead(404, headers);
			return response.end();
		}
		let stat = libfs.statSync(path);
		if (stat.isDirectory()) {
			headers["location"] = "/index.html";
			response.writeHead(303, headers);
			return response.end();
		}
		if (stat.isFile()) {
			let range = parseRange(request.headers.range, stat.size);
			headers["content-type"] = getContentType(url);
			headers["accept-ranges"] = "bytes";
			headers["content-length"] = `${range.length}`;
			if (range.length === 0) {
				headers["content-range"] = `bytes */${range.file_size}`;
				response.writeHead(range.status, headers);
				return response.end();
			}
			headers["content-range"] = `bytes ${range.offset}-${range.offset+range.length-1}/${range.file_size}`;
			response.writeHead(range.status, headers);
			libfs.createReadStream(path, {
				start: range.offset,
				end: range.offset + range.length - 1
			}).pipe(response);
			return;
		}
		response.writeHead(404, headers);
		return response.end();
	} catch (error) {
		response.writeHead(500, headers);
		return response.end();
	}
}

libhttps.createServer({
	key: libfs.readFileSync("./public/certs/localhost/key.pem"),
	cert: libfs.readFileSync("./public/certs/localhost/cert.pem")
}, handleRequest).listen(443);

libhttp.createServer(handleRequest).listen(80);
