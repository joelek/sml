"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var is;
(function (is) {
    function absent(subject) {
        return subject == null;
    }
    is.absent = absent;
    ;
    function present(subject) {
        return subject != null;
    }
    is.present = present;
    ;
})(is || (is = {}));
;
var as;
(function (as) {
    function array(subject) {
        if (is.absent(subject) || subject.constructor !== Array) {
            throw ``;
        }
        return subject;
    }
    as.array = array;
    ;
    function boolean(subject) {
        if (is.absent(subject) || subject.constructor !== Boolean) {
            throw ``;
        }
        return subject;
    }
    as.boolean = boolean;
    ;
    function number(subject) {
        if (is.absent(subject) || subject.constructor !== Number) {
            throw ``;
        }
        return subject;
    }
    as.number = number;
    ;
    function record(subject) {
        if (is.absent(subject) || subject.constructor !== Object) {
            throw ``;
        }
        return subject;
    }
    as.record = record;
    ;
    function string(subject) {
        if (is.absent(subject) || subject.constructor !== String) {
            throw ``;
        }
        return subject;
    }
    as.string = string;
    ;
})(as || (as = {}));
;
let key;
function bufferFromHex(hex) {
    var _a;
    return new Uint8Array(((_a = hex.match(/[0-9a-f]{2}/gi)) !== null && _a !== void 0 ? _a : []).map((group) => {
        return parseInt(group, 16);
    }));
}
function sendMessage(event, message) {
    return __awaiter(this, void 0, void 0, function* () {
        // @ts-ignore
        let client = yield self.clients.get(event.clientId);
        if (is.absent(client)) {
            return;
        }
        client.postMessage(message);
    });
}
self.addEventListener("install", (event) => {
    // @ts-ignore
    self.skipWaiting();
});
self.addEventListener("activate", (event) => {
    // @ts-ignore
    event.waitUntil(self.clients.claim());
});
self.addEventListener("message", (event) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Service", event);
    let message = as.record(event.data);
    let type = as.string(message.type);
    let data = as.record(message.data);
    if (type === "SetKey") {
        try {
            let raw = bufferFromHex(as.string(data.key));
            key = yield crypto.subtle.importKey("raw", raw, "AES-CBC", false, ["encrypt", "decrypt"]);
            event.ports[0].postMessage({ type: "Status", data: {
                    success: true
                } });
        }
        catch (error) {
            event.ports[0].postMessage({ type: "Status", data: {
                    success: false
                } });
        }
    }
}));
function parseRange(header, file_size) {
    var _a, _b, _c;
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
    let parts;
    parts = (_a = /^bytes[=]([0-9]+)[-]$/.exec(header)) !== null && _a !== void 0 ? _a : undefined;
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
    parts = (_b = /^bytes[=]([0-9]+)[-]([0-9]+)$/.exec(header)) !== null && _b !== void 0 ? _b : undefined;
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
    parts = (_c = /^bytes[=][-]([0-9]+)$/.exec(header)) !== null && _c !== void 0 ? _c : undefined;
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
function parseContentRange(header) {
    var _a, _b;
    if (is.absent(header)) {
        throw `Expected a content-range header!`;
    }
    let parts;
    parts = (_a = /^bytes ([0-9]+)[-]([0-9]+)[/]([0-9]+)$/.exec(header)) !== null && _a !== void 0 ? _a : undefined;
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
    parts = (_b = /^bytes [*][/]([0-9]+)$/.exec(header)) !== null && _b !== void 0 ? _b : undefined;
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
function decryptBlocks(encrypted_blocks, previous_encrypted_block, key, final) {
    return __awaiter(this, void 0, void 0, function* () {
        if (final) {
            return new Uint8Array(yield crypto.subtle.decrypt({
                name: "AES-CBC",
                iv: previous_encrypted_block
            }, key, encrypted_blocks));
        }
        let last_block = encrypted_blocks.slice(-16);
        let padding = new Uint8Array(yield crypto.subtle.encrypt({
            name: "AES-CBC",
            iv: last_block
        }, key, new Uint8Array(0)));
        let padded = new Uint8Array(encrypted_blocks.length + 16);
        padded.set(encrypted_blocks, 0);
        padded.set(padding, encrypted_blocks.length);
        return new Uint8Array(yield crypto.subtle.decrypt({
            name: "AES-CBC",
            iv: previous_encrypted_block
        }, key, padded));
    });
}
function getPaddingLength(encrypted_tail, iv, key) {
    return __awaiter(this, void 0, void 0, function* () {
        let length = encrypted_tail.byteLength;
        if (length % 16 !== 0) {
            throw `Expected an even number of blocks!`;
        }
        if (length >= 32) {
            iv = new Uint8Array(encrypted_tail.buffer, length - 32, 16);
        }
        encrypted_tail = new Uint8Array(encrypted_tail.buffer, length - 16, 16);
        let decrypted_tail = yield crypto.subtle.decrypt({
            name: "AES-CBC",
            iv: iv
        }, key, encrypted_tail);
        return 16 - decrypted_tail.byteLength;
    });
}
class RequestHandler {
    constructor(iv, key, encrypted_length, decrypted_length, data_provider) {
        this.iv = iv;
        this.key = key;
        this.block_count = Math.ceil(encrypted_length / 16);
        this.decrypted_length = decrypted_length;
        this.data_provider = data_provider;
    }
    getDecryptedLength() {
        return this.decrypted_length;
    }
    requestDecryptedRange(offset, length) {
        return __awaiter(this, void 0, void 0, function* () {
            let first_block = Math.floor((offset) / 16);
            let last_block = Math.floor((offset + length - 1) / 16);
            let block_offset = first_block > 0 ? first_block - 1 : first_block;
            let block_length = last_block - block_offset + 1;
            let data = yield this.data_provider(block_offset * 16, block_length * 16);
            let previous_encrypted_block = first_block > 0 ? new Uint8Array(data.buffer, 0, 16) : this.iv;
            let encrypted_blocks = first_block > 0 ? new Uint8Array(data.buffer, 16) : data;
            let decrypted_blocks = yield decryptBlocks(encrypted_blocks, previous_encrypted_block, this.key, last_block === this.block_count - 1);
            let decrypted = new Uint8Array(decrypted_blocks.buffer, offset % 16, length);
            return decrypted;
        });
    }
    getDecryptedReader(offset, length) {
        return new ReadableStream({
            pull: (controller) => __awaiter(this, void 0, void 0, function* () {
                if (length > 0) {
                    let bytes_to_request = Math.min(length, offset > 0 ? 1024 * 1024 : 256 * 1024);
                    let blocks = yield this.requestDecryptedRange(offset, bytes_to_request);
                    controller.enqueue(blocks);
                    offset += bytes_to_request;
                    length -= bytes_to_request;
                }
                else {
                    controller.close();
                }
            })
        });
    }
    static get(url, iv, key) {
        return __awaiter(this, void 0, void 0, function* () {
            let instance = this.INSTANCES.get(url);
            if (is.present(instance)) {
                return instance;
            }
            let headers = new Headers();
            headers.append("range", "bytes=-32");
            let request = new Request(url, {
                headers
            });
            let response = yield fetch(request);
            if (response.status === 200) {
                let encrypted_blocks = new Uint8Array(yield response.arrayBuffer(), 0);
                let encrypted_length = encrypted_blocks.byteLength;
                let decrypted_length = encrypted_length - (yield getPaddingLength(encrypted_blocks, iv, key));
                instance = new RequestHandler(iv, key, encrypted_length, decrypted_length, (offset, length) => __awaiter(this, void 0, void 0, function* () {
                    return new Uint8Array(encrypted_blocks.buffer, offset, length);
                }));
                this.INSTANCES.set(url, instance);
                return instance;
            }
            if (response.status === 206) {
                let content_range = parseContentRange(response.headers.get("content-range"));
                let encrypted_blocks = new Uint8Array(yield response.arrayBuffer());
                let encrypted_length = content_range.file_size;
                let decrypted_length = encrypted_length - (yield getPaddingLength(encrypted_blocks, iv, key));
                instance = new RequestHandler(iv, key, encrypted_length, decrypted_length, (offset, length) => __awaiter(this, void 0, void 0, function* () {
                    let headers = new Headers();
                    headers.append("range", `bytes=${offset}-${offset + length - 1}`);
                    let response = yield fetch(url, {
                        headers: headers
                    });
                    return new Uint8Array(yield response.arrayBuffer());
                }));
                this.INSTANCES.set(url, instance);
                return instance;
            }
            throw `Expected a 200 or 206 status from server!`;
        });
    }
}
RequestHandler.INSTANCES = new Map();
self.addEventListener("fetch", (event) => {
    var _a;
    let request = event.request;
    let parts = (_a = /[/]content[/]([0-9a-f]{32})$/.exec(request.url)) !== null && _a !== void 0 ? _a : undefined;
    if (is.absent(parts)) {
        return event.respondWith(fetch(request));
    }
    if (is.absent(key)) {
        return event.respondWith(new Response(null, {
            status: 401
        }));
    }
    let iv = bufferFromHex(parts[1]);
    return event.respondWith(RequestHandler.get(request.url, iv, key).then((requestHandler) => __awaiter(void 0, void 0, void 0, function* () {
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
        }
        else {
            headers.append("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${range.file_size}`);
            let body = requestHandler.getDecryptedReader(range.offset, range.length);
            return new Response(body, {
                status: range.status,
                headers: headers
            });
        }
    })));
});
