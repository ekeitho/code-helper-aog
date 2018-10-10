"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GoogleConvo {
    constructor(conv) {
        this.conv = conv;
    }
    setContext(context, lifespan, parameters) {
        this.conv.contexts.set(context, lifespan, parameters);
    }
    hasContextParam(context) {
        return !!this.getContextParam(context);
    }
    getContextParam(context) {
        if (this.conv.contexts.get(context)) {
            return this.conv.contexts.get(context).parameters;
        }
        return null;
    }
    getContextParamValueOrDefault(context, key, defaultValue) {
        const params = this.getContextParam(context);
        if (this.hasContextParam(context)) {
            if (params[key]) {
                return params[key];
            }
            // if key doesnt exist in params
            return defaultValue;
        }
        // if no params
        return defaultValue;
    }
    hasEntity(key) {
        return !!this.conv.parameters[key];
    }
    getEntity(key) {
        return this.conv.parameters[key];
    }
    isScreenDevice() {
        return this.conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    }
    getStorage(key) {
        return this.conv.user.storage[key];
    }
    saveToStorage(key, value) {
        this.conv.user.storage[key] = value;
    }
    ask(str) {
        this.conv.ask();
    }
}
exports.default = GoogleConvo;
//# sourceMappingURL=GoogleConvo.js.map