"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ResponseBuilder {
    constructor(conv) {
        this.voiceOnlyDevice = "";
        this.googleConvo = conv;
    }
    forScreenDevice(conv) {
        this.screenDevice = conv(this.googleConvo);
        return this;
    }
    forVoiceOnly(conv) {
        this.voiceOnlyDevice = conv(this.googleConvo);
        return this;
    }
    build() {
        // if no screen text given, then set screen text to voice only
        if (this.screenDevice.length === 0) {
            this.screenDevice = this.voiceOnlyDevice;
        }
        if (this.voiceOnlyDevice.length === 0) {
            throw new Error("Need to supply text to response builder at least once.");
        }
    }
}
exports.default = ResponseBuilder;
//# sourceMappingURL=ResponseBuilder.js.map