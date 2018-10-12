"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const actions_on_google_1 = require("actions-on-google");
const GithubHelper_1 = require("./GithubHelper");
const ActionsHelper_1 = require("./ActionsHelper");
const GoogleConvo_1 = require("./GoogleConvo");
const ConversationConstants_1 = require("./ConversationConstants");
const { dialogflow } = require('actions-on-google');
const app = dialogflow({ debug: true });
app.intent(ConversationConstants_1.default.INTENT_WELCOME, conv => {
    conv.ask('Welcome to Code Helper. I can help you find issues you created or commented on github!');
});
app.intent(ConversationConstants_1.default.INTENT_SIGN_IN, (conv, params, signin) => __awaiter(this, void 0, void 0, function* () {
    if (signin.status !== 'OK') {
        return conv.close('You need to sign in before using the app.');
    }
    try {
        const googleConvo = new GoogleConvo_1.default(conv);
        const gitToken = yield GithubHelper_1.default.authenticateGithubUser(googleConvo);
        // possibly do something with access token
        conv.ask(`Great! Thanks for signing in ${gitToken.username}. What can I do for you today?`);
    }
    catch (err) {
    }
}));
app.intent(ConversationConstants_1.default.INTENT_NEW_SURFACE, (conv, params, newSurface) => {
    if (newSurface) {
        if (newSurface.status === 'OK') {
            ActionsHelper_1.default.sendIssueCard(conv);
        }
        else {
            conv.ask(`Ok, I understand. Would you like to do anything else?`);
        }
    }
});
app.intent('send_link', (conv) => {
    const isOnAScreenDevice = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    const hasScreenAvailable = conv.available.surfaces.capabilities.has('actions.capability.SCREEN_OUTPUT');
    if (!isOnAScreenDevice && hasScreenAvailable) {
        const context = 'I can send you a link to this issue if you like?';
        const notification = 'Code Helper Issue';
        const capabilities = ['actions.capability.SCREEN_OUTPUT'];
        conv.ask(new actions_on_google_1.NewSurface({ context, notification, capabilities }));
    }
    else if (isOnAScreenDevice) {
        ActionsHelper_1.default.sendIssueCard(conv);
    }
});
app.intent(ConversationConstants_1.default.INTENT_FIND_MORE_ISSUES, (conv) => __awaiter(this, void 0, void 0, function* () {
    const googleConvo = new GoogleConvo_1.default(conv);
    yield GithubHelper_1.default.nextCreatedIssues(googleConvo);
}));
app.intent(ConversationConstants_1.default.INTENT_FIND_ISSUES, (dialogConvo) => __awaiter(this, void 0, void 0, function* () {
    const googleConvo = new GoogleConvo_1.default(dialogConvo);
    const userName = googleConvo.getStorage(ConversationConstants_1.default.STORAGE_USERNAME);
    // we got an entity
    if (googleConvo.hasEntity(ConversationConstants_1.default.ENTITY_ISSUES)) {
        // created issues
        if (googleConvo.getEntity(ConversationConstants_1.default.ENTITY_ISSUES) === 'create') {
            yield GithubHelper_1.default.firstTimeCreatedIssues(googleConvo);
        }
        // issues commented on
        else {
            const commentsToGrab = 20;
            const res = yield GithubHelper_1.default.sendGithubGraphQL(googleConvo, GithubHelper_1.default.commentsOnIssuesQL(userName));
            const issues = res.data.user.issueComments.nodes;
            const actualIssueCount = res.data.user.issueComments.totalCount;
            const min = actualIssueCount < commentsToGrab ? actualIssueCount : commentsToGrab;
            const openIssuesNodes = {};
            let openIssuesCount = 0;
            issues.forEach(node => {
                if (!node.issue.closed) {
                    // if issue is not closed and doesnt exist in our dict, then add it
                    if (!openIssuesNodes.hasOwnProperty(node.issue.id)) {
                        openIssuesNodes[node.issue.id] = node.issue;
                        openIssuesCount++;
                    }
                }
            });
            const openIssues = [];
            for (const key in openIssuesNodes) {
                openIssues.push(openIssuesNodes[key]);
            }
            googleConvo.ask(`The past ${min} comments you made on issues. ${openIssuesCount} of them are open.`);
            if (googleConvo.isScreenDevice()) {
                googleConvo.setContext(ConversationConstants_1.default.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1, { 'position': 1, 'issue_count': 10 });
                googleConvo.ask(ActionsHelper_1.default.generateBrowseCarouselItems(googleConvo, openIssues));
            }
        }
    }
    else {
        // if user asked for open/closed issues, but didn't specify created or commented on
        // then ask them, but save the state for later
        if (googleConvo.hasEntity(ConversationConstants_1.default.ENTITY_ISSUE_STATE)) {
            googleConvo.setContext(ConversationConstants_1.default.CONTEXT_FIND_ISSUES, 1, {
                'issueState': googleConvo.getEntity(ConversationConstants_1.default.ENTITY_ISSUE_STATE)
            });
        }
        googleConvo.ask(`Would you like me to get issues you've commented on or issues you've created?`);
    }
}));
exports.mapp = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map