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
function element(selector, ...children) {
    var _a, _b, _c;
    let parts = (_a = selector.match(/([a-z][a-z0-9_-]*|[.][a-z][a-z0-9_-]*|[\[][^=]+[=][^\]]*[\]])/g)) !== null && _a !== void 0 ? _a : [];
    let tag = parts.shift();
    let classNames = parts.filter((part) => /[.][a-z][a-z0-9_-]*/.test(part));
    let attributes = parts.filter((part) => /[\[][^=]+[=][^\]]*[\]]/.test(part));
    let element = document.createElement(tag);
    for (let className of classNames) {
        let parts = (_b = /^[.]([a-z][a-z0-9_-]*)$/.exec(className)) !== null && _b !== void 0 ? _b : [];
        element.classList.add(parts[1]);
    }
    for (let attribute of attributes) {
        let parts = (_c = /^[\[]([^=]+)[=]([^\]]*)[\]]$/.exec(attribute)) !== null && _c !== void 0 ? _c : [];
        element.setAttribute(parts[1], parts[2]);
    }
    for (let child of children) {
        element.appendChild(child);
    }
    return element;
}
function text(string) {
    return document.createTextNode(string);
}
function on(element, type, listener) {
    element.addEventListener(type, listener);
    return element;
}
function getServiceWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        let regstration = yield navigator.serviceWorker.register("service.js");
        yield regstration.update();
        function request(type, data, parse) {
            var _a;
            let messageChannel = new MessageChannel();
            messageChannel.port1.start();
            (_a = navigator.serviceWorker.controller) === null || _a === void 0 ? void 0 : _a.postMessage({
                type: type,
                data: data
            }, [messageChannel.port2]);
            return new Promise((resolve, reject) => {
                messageChannel.port1.addEventListener("message", function onmessage(event) {
                    messageChannel.port1.removeEventListener("message", onmessage);
                    console.log("Client", event);
                    try {
                        let message = as.record(event.data);
                        let type = as.string(message.type);
                        let data = as.record(message.data);
                        resolve(parse(type, data));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        ;
        return request;
    });
}
function duration(ms) {
    let s = Math.floor(ms / 1000);
    ms -= s * 1000;
    let m = Math.floor(s / 60);
    s -= m * 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
let track;
let audio = element(`audio.player__audio[controls=][playsinline=]`);
let title = element("div.player__title[single-line=]", text(""));
let artist = element("div.player__artist[single-line=]", text(""));
let player = on(element("div.player", element("div.player__content", audio, title, artist)), "click", () => {
    if (is.present(track)) {
        if (audio.paused) {
            audio.play();
        }
        else {
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
function play(playlist, index) {
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
getServiceWorker().then((request) => __awaiter(void 0, void 0, void 0, function* () {
    let response = yield fetch("playlist.json");
    let json = yield response.json();
    let playlist = as.array(json).map((entry) => ({
        file: as.string(entry.file),
        artist: as.string(entry.artist),
        title: as.string(entry.title),
        duration_ms: as.number(entry.duration_ms)
    }));
    let app = element("div.app", element("div.app__scroll[scroll-container=]", element("div.app__content", element("div.header", element("img.header__image[src=logo.png]")), element("div.text", element("div.text__title", text("Succén från ZTV fortsätter i det här digitala HD-kassettbandet från Track Tape AB.")), element("div.text__subtitle", text("För att få lyssna behöver du en speciell krypteringsnyckel. Har du ingen nyckel kan du delta i vår lyssnartävling!")), element("div.text__subtitle", text("Samla ett godtyckligt antal QR-koder från Dafgårds renskav och skicka dem till Rosenbad. Portot står vi för!"))), element("div.auth", on(element("input.auth__input[type=password][spellcheck=false]"), "input", (event) => __awaiter(void 0, void 0, void 0, function* () {
        let target = event.target;
        let response = yield request("SetKey", { key: target.value }, (type, data) => {
            let success = as.boolean(data.success);
            return {
                success
            };
        });
        if (response.success) {
            key.textContent = "Nyckeln matades in korrekt.";
        }
        else {
            key.textContent = "Det är något fel på nyckeln. Ring mamma och fråga efter hennes bästa krypteringsnyckel. Om mamma ställer svåra frågor om krypteringsalgoritmer och bitlängder uppger du lungt och sansat AES-CBC, 128 bitar.";
        }
    })), key), element("div.playlist", ...playlist.map((track, index) => on(element("div.track", element("div.track__title[single-line=]", text(track.title)), element("div.track__artist[single-line=]", text([track.artist, duration(track.duration_ms)].join(" \u00b7 ")))), "click", () => {
        play(playlist, index);
    }))))), element("div.app__player", player));
    document.body.appendChild(app);
}));
