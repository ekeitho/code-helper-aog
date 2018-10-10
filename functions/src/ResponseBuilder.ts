import {ActionsSdkConversation, DialogflowConversation} from "actions-on-google";

export default class ResponseBuilder {

    screenDevice;
    voiceOnlyDevice = "";

    googleConvo: DialogflowConversation;

    constructor (conv: DialogflowConversation) {
        this.googleConvo = conv;
    }

    forScreenDevice<T>(conv: (convs : DialogflowConversation) => T): ResponseBuilder {
        this.screenDevice = conv(this.googleConvo);
        return this;
    }

    forVoiceOnly(conv: (convs : DialogflowConversation) => string): ResponseBuilder {
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