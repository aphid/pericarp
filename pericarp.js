//pericarp is the outer hull of a popcorn kernel
class Pericarp {
    // HTML5 media events reference
    static events = [
        "play", "playing", "pause", "ended", "timeupdate",
        "seeking", "seeked", "volumechange", "ratechange",
        "waiting", "canplay", "loadedmetadata", "loadstart",
        "progress", "stalled", "suspend", "durationchange", "canplaythrough"
    ];

    constructor(element) {
        let target;
        if (typeof element === "string") {
            target = document.querySelector(element);
        } else {
            target = element;
        }

        // support DOM <video>/<audio> elements and virtual clock instances
        let isValidTarget = false;
        if (target) {
            if (target instanceof HTMLMediaElement || target instanceof PericarpClock) {
                isValidTarget = true;
            }
        }

        if (!isValidTarget) {
            throw new Error("[Pericarp Error] Target must be a valid media element or PericarpClock instance.");
        }

        this.media = target;
        this.cues = [];
        this._nextCueId = 1;
        this._pendingSeek = null;

        // only listen for loadedmetadata if target is a DOM element (PericarpClock duration is known instantly)
        if (this.media instanceof HTMLMediaElement) {
            this.media.addEventListener("loadedmetadata", () => {
                if (this._pendingSeek !== null && this._pendingSeek !== undefined) {
                    this.currentTime(this._pendingSeek);
                }
            });
        }

        // monitor timing updates (works identically for media elements and PericarpClock!)
        this.media.addEventListener("timeupdate", () => this._updateCues());
        this.media.addEventListener("seeking", () => this._updateCues());
    }

    // parses "HH:MM:SS", "MM:SS", seconds, or percentage strings relative to duration
    static toSec(hms, duration = 0) {
        if (typeof hms === "number") {
            return hms;
        }

        if (typeof hms !== "string") {
            throw new Error("[Pericarp Error] Time must be a number or string (e.g. '01:30', 90, or '50%').");
        }

        // percentage-based time (e.g. "50%")
        if (hms.endsWith("%")) {
            const percent = parseFloat(hms);
            if (isNaN(percent) || percent < 0 || percent > 100) {
                throw new Error("[error] Percentage time must be between 0% and 100%.");
            }
            return (percent / 100) * duration;
        }

        const parts = hms.split(':').map(Number);
        if (parts.some(isNaN)) {
            throw new Error("[error] Invalid timecode format. Use 'HH:MM:SS', 'MM:SS', or seconds.");
        }

        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        if (parts.length === 1) {
            return parts[0];
        }

        throw new Error("[error] Use 'HH:MM:SS', 'MM:SS', seconds, or percentage% timecode format.");
    }

    // Warns in console if an event name is non-standard
    static _validateEvent(eventName) {
        if (!Pericarp.events.includes(eventName)) {
            console.warn(
                `%c[warning]%c "${eventName}" is not a standard HTML5 media event. ` +
                `Check for typos! Type %cPericarp.showEvents()%c in the console to see supported events.`,
                "color: #e67e22; font-weight: bold;",
                "color: inherit;",
                "color: #3498db; font-weight: bold;",
                "color: inherit;"
            );
            return false;
        }
        return true;
    }

    // outputs a quick-reference table of events to the developer tools console
    static showEvents() {
        const eventsTable = [
            { Event: "play", Trigger: "Playback has been requested", UseCase: "Hide play buttons or overlays" },
            { Event: "playing", Trigger: "Media has actually started playing", UseCase: "Hide loading spinners" },
            { Event: "pause", Trigger: "Playback has been paused", UseCase: "Show pause menus or interactive prompts" },
            { Event: "ended", Trigger: "Media reached the end of the timeline", UseCase: "Trigger end credits or next scene" },
            { Event: "timeupdate", Trigger: "Playback position changed", UseCase: "Update custom progress bars" },
            { Event: "seeking", Trigger: "User began scrubbing", UseCase: "Pause background animations while scrubbing" },
            { Event: "seeked", Trigger: "User finished scrubbing to a new time", UseCase: "Resync external elements" },
            { Event: "volumechange", Trigger: "Volume was adjusted or muted", UseCase: "Update volume/mute UI icons" },
            { Event: "ratechange", Trigger: "Playback speed changed", UseCase: "Display speed indicator badges" },
            { Event: "waiting", Trigger: "Playback stalled due to buffering", UseCase: "Show a buffering indicator" },
            { Event: "canplay", Trigger: "Enough data has loaded to start playback", UseCase: "Enable playback UI controls" },
            { Event: "canplaythrough", Trigger: "Enough data has loaded to start playback and not buffer.", UseCase: "Enable playback UI controls" },
            { Event: "loadedmetadata", Trigger: "Duration and dimensions are available", UseCase: "Initialize UI timeline sliders" }
        ];

        console.log("%c  pericarp media events reference", "font-weight: bold; font-size: 14px; color: #e67e22;");
        console.table(eventsTable);
    }

    _updateCues() {
        let time;
        if (typeof this.media.currentTime === "function") {
            time = this.media.currentTime();
        } else {
            time = this.media.currentTime;
        }

        let duration;
        if (typeof this.media.duration === "function") {
            duration = this.media.duration();
        } else {
            duration = this.media.duration;
        }
        if (!duration) {
            duration = 0;
        }

        for (let cue of this.cues) {
            const startSec = Pericarp.toSec(cue.rawStart, duration);
            const endSec = Pericarp.toSec(cue.rawEnd, duration);

            const shouldBeActive = time >= startSec && time < endSec;

            if (shouldBeActive && !cue.active) {
                cue.active = true;
                cue.startfn();
            } else if (!shouldBeActive && cue.active) {
                cue.active = false;
                cue.endfn();
            }
        }
    }

    // register a cue on the timeline (returns numeric ID handle)
    cue(start, end, startfn, endfn) {
        // it takes two (arguments)
        if (typeof end === "function") {
            endfn = startfn || function () { };
            startfn = end;
            end = "100%";
        }
        // the 3 argument problem
        else if (typeof startfn === "function" && typeof endfn !== "function") {
            endfn = function () { };
        }

        if (typeof startfn !== "function") startfn = function () { };
        if (typeof endfn !== "function") endfn = function () { };

        const cueId = this._nextCueId++;

        this.cues.push({
            id: cueId,
            rawStart: start,
            rawEnd: end,
            startfn: startfn,
            endfn: endfn,
            active: false
        });

        return cueId;
    }

    // remove a specific cue by ID handle
    removeCue(id) {
        this.cues = this.cues.filter(cue => cue.id !== id);
        return this;
    }

    // wipe all cues attached to this instance
    clearCues() {
        this.cues = [];
        return this;
    }

    // loop playback between two timestamps a set number of times (or infinitely)
    loopRange(start, end, times = Infinity) {
        let count = 0;
        let cueId;

        const duration = this.media.duration || 0;
        const startSec = Pericarp.toSec(start, duration);
        const endSec = Pericarp.toSec(end, duration);

        const checkLoop = () => {
            count++;
            if (count < times) {
                this.currentTime(startSec);
            } else {
                this.removeCue(cueId); // self-clearing loop trigger
            }
        };

        // cue triggers right at the boundary of endSec
        cueId = this.cue(Math.max(startSec, endSec - 0.25), endSec, checkLoop);
        this.currentTime(startSec);

        return cueId;
    }

    // getter / setter for timecode position
    currentTime(time) {
        if (time === undefined) {
            return this.media.currentTime;
        }

        const duration = this.media.duration || 0;

        // if metadata isn't ready yet, defer setting currentTime until loadedmetadata fires
        if (this.media.readyState === 0 || (typeof time === "string" && time.endsWith("%") && duration === 0)) {
            this._pendingSeek = time;
            return this;
        }

        this.media.currentTime = Pericarp.toSec(time, duration);
        this._pendingSeek = null;
        return this;
    }

    // and for playback speed
    playbackRate(rate) {
        if (rate === undefined) {
            return this.media.playbackRate;
        }
        this.media.playbackRate = Number(rate);
        return this;
    }

    // control helpers
    play() {
        const promise = this.media.play();
        if (promise !== undefined) {
            promise.catch(err => {
                console.warn("[Pericarp Warning] Playback prevented by browser policy:", err.message);
            });
        }
        return this;
    }

    pause() {
        this.media.pause();
        return this;
    }

    mute() {
        this.media.muted = true;
        return this;
    }

    unmute() {
        this.media.muted = false;
        return this;
    }

    // event listener wrapper with boolean `once` support
    on(event, callback, options = {}) {
        Pericarp._validateEvent(event);

        if (typeof callback !== "function") {
            throw new Error(`[error] callback for event "${event}" must be a function.`);
        }

        if (typeof options === "boolean") {
            options = { once: options };
        }

        this.media.addEventListener(event, callback, options);
        return this;
    }

    // convenience wrapper for one-time listeners
    once(event, callback) {
        return this.on(event, callback, { once: true });
    }

    // async event listener with built-in timeout safeguard
    waitFor(event, timeoutMs = 15000) {
        Pericarp._validateEvent(event);

        const readyStateMap = {
            "loadedmetadata": 1, // HAVE_METADATA
            "loadeddata": 2, // HAVE_CURRENT_DATA
            "canplay": 3, // HAVE_FUTURE_DATA
            "canplaythrough": 4  // HAVE_ENOUGH_DATA
        };

        const targetState = readyStateMap[event];

        if (targetState !== undefined && this.media.readyState >= targetState) {
            return Promise.resolve(new Event(event));
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.media.removeEventListener(event, handler);
                reject(new Error(`[pericarp] waited ${timeoutMs}ms for "${event}" event.`));
            }, timeoutMs);

            const handler = (e) => {
                clearTimeout(timer);
                resolve(e);
            };

            this.media.addEventListener(event, handler, { once: true });
        });
    }

    // realtime event debugger
    debug(enable = true) {
        const eventsToMonitor = ["play", "pause", "ended", "seeking", "seeked", "waiting", "playing"];

        if (!this._debugHandler) {
            this._debugHandler = (e) => {
                console.log(
                    `%c[debug] %c${e.type}%c at time: %c${this.media.currentTime.toFixed(2)}s`,
                    "color: #e67e22; font-weight: bold;",
                    "color: #2ecc71; font-weight: bold;",
                    "color: #888;",
                    "color: #3498db; font-weight: bold;"
                );
            };
        }

        for (let event of eventsToMonitor) {
            if (enable) {
                this.media.addEventListener(event, this._debugHandler);
            } else {
                this.media.removeEventListener(event, this._debugHandler);
            }
        }

        return this;
    }
}

class PericarpClock extends EventTarget {
    constructor(options = {}) {
        super();

        // support simple duration number or options object
        if (typeof options === "number") {
            options = { duration: options };
        }

        this.duration = options.duration || Infinity;
        this._time = options.currentTime || 0;
        this.playbackRateVal = options.playbackRate || 1; this.loop = options.loop || false;
        this.paused = true;

        this._lastTickTime = 0;
        this._timerId = null;

        // no sound! it can just go.
        if (options.autoplay) {
            // trigger on next microtask so event listeners attached immediately after instantiation catch 'play'
            Promise.resolve().then(() => this.play());
        }
    }

    play() {
        if (!this.paused) return;
        this.paused = false;
        this._lastTickTime = performance.now();

        this._timerId = setInterval(() => {
            const now = performance.now();
            const delta = (now - this._lastTickTime) / 1000;
            this._lastTickTime = now;

            // Update internal property reference
            this._time += delta * this.playbackRateVal;

            //at duration time(s) boundary
            if (this._time >= this.duration) {
                if (this.loop) {
                    this._time = (this._time - this.duration) % this.duration;
                    this.dispatchEvent(new Event("seeked"));
                } else {
                    this._time = this.duration;
                    this.pause();
                    this.dispatchEvent(new Event("ended"));
                    return;
                }
            }

            //at zero boundary
            if (this.playbackRateVal < 0 && this._time <= 0) {
                if (this.loop) {
                    this._time = this.duration + (this._time % this.duration);
                    this.dispatchEvent(new Event("seeked"));
                } else {
                    this._time = 0;
                    this.pause();
                    this.dispatchEvent(new Event("ended"));
                    return;
                }
            }

            this.dispatchEvent(new Event("timeupdate"));
        }, 25);

        this.dispatchEvent(new Event("play"));
        this.dispatchEvent(new Event("playing"));
    }

    pause() {
        if (this.paused) return;
        this.paused = true;
        clearInterval(this._timerId);
        this.dispatchEvent(new Event("pause"));
    }

    currentTime(time) {
        if (time === undefined) return this._time;
        this.jumpTo(Pericarp.toSec(time, this.duration));
        return this;
    }

    jumpTo(time) {
        this._time = Math.max(0, Math.min(time, this.duration));
        this.dispatchEvent(new Event("seeking"));
        this.dispatchEvent(new Event("timeupdate"));
        this.dispatchEvent(new Event("seeked"));
    }

    playbackRate(rate) {
        if (rate === undefined) return this.playbackRateVal;
        this.playbackRateVal = Number(rate);
        return this;
    }
}
