import {DialogflowConversation, Parameters, Response} from "actions-on-google";

export default class GoogleConvo {
    conv: DialogflowConversation;

    constructor(conv: DialogflowConversation) {
        this.conv = conv;
    }

    setContext(context: string, lifespan: number, parameters: Parameters) {
        this.conv.contexts.set(context, lifespan, parameters);
    }

    hasContextParam(context: string): boolean {
        return !!this.getContextParam(context);
    }

    getContextParam(context: string) : Parameters {
        if (this.conv.contexts.get(context)) {
            return this.conv.contexts.get(context).parameters
        }
        return null;
    }

    getContextParamValueOrDefault<T>(context: string, key: string, defaultValue: T): T {
        const params = this.getContextParam(context);
        if (this.hasContextParam(context)) {
            if (params[key]) {
                return params[key] as T;
            }
            // if key doesnt exist in params
            return defaultValue;
        }
        // if no params
        return defaultValue;
    }

    hasEntity(key: string): boolean {
        return !!this.conv.parameters[key];
    }


    getEntity<T>(key: string): T {
        return this.conv.parameters[key] as T;
    }

    isScreenDevice(): boolean {
        return this.conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    }

    getStorage<T>(key: string): T {
        return this.conv.user.storage[key] as T;
    }

    saveToStorage<T>(key: string, value: T) {
        this.conv.user.storage[key] = value;
    }

    ask(str: Response) {
        this.conv.ask(str);
    }
}