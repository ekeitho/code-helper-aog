import * as functions from 'firebase-functions';
import {NewSurface, NewSurfaceOptions} from "actions-on-google";
import GithubHelper, {IssueEnum} from "./GithubHelper";
import ActionsHelper from "./ActionsHelper";
import GoogleConvo from "./GoogleConvo";
import ConversationConstants from "./ConversationConstants";

const {dialogflow} = require('actions-on-google');
const app = dialogflow({debug: true});


app.intent(ConversationConstants.INTENT_WELCOME, conv => {
    conv.ask('Welcome to Code Helper. I can help you find issues you created or commented on github!');
});

app.intent(ConversationConstants.INTENT_SIGN_IN, async (conv, params, signin) => {
    if (signin.status !== 'OK') {
        return conv.close('You need to sign in before using the app.');
    }

    try {
        const googleConvo = new GoogleConvo(conv);
        const gitToken = await GithubHelper.authenticateGithubUser(googleConvo);
        // possibly do something with access token
        conv.ask(`Great! Thanks for signing in ${gitToken.username}. What can I do for you today?`);
    } catch (err) {

    }
});


app.intent(ConversationConstants.INTENT_NEW_SURFACE, (conv, params, newSurface) => {
    if (newSurface) {
        if (newSurface.status === 'OK') {
            ActionsHelper.sendIssueCard(conv);
        } else {
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
        conv.ask(new NewSurface({context, notification, capabilities} as NewSurfaceOptions));
    } else if (isOnAScreenDevice) {
        ActionsHelper.sendIssueCard(conv);
    }
});

app.intent(ConversationConstants.INTENT_FIND_MORE_ISSUES, async conv => {
    const googleConvo = new GoogleConvo(conv);
    const issueEnum = googleConvo.getContextParamValueOrDefault<IssueEnum>(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 'issueEnum', IssueEnum.CREATED);

    if (issueEnum === IssueEnum.CREATED) {
        await GithubHelper.nextCreatedIssues(googleConvo);
    } else {
        await GithubHelper.nextCommentedIssues(googleConvo);
    }

});


app.intent(ConversationConstants.INTENT_FIND_ISSUES, async dialogConvo => {
    const googleConvo = new GoogleConvo(dialogConvo);

    // we got an entity
    if (googleConvo.hasEntity(ConversationConstants.ENTITY_ISSUES)) {
        if (googleConvo.getEntity<string>(ConversationConstants.ENTITY_ISSUES) === 'create') {
            // created issues
            await GithubHelper.firstTimeCreatedIssuesRequest(googleConvo);
        }
        else {
            // commented on issues
            await GithubHelper.firstTimeCommentedIssuesRequest(googleConvo);
        }
    } else {
        // if user asked for open/closed issues, but didn't specify created or commented on
        // then ask them, but save the state for later
        if (googleConvo.hasEntity(ConversationConstants.ENTITY_ISSUE_STATE)) {
            googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES, 1,
                {
                    'issueState': googleConvo.getEntity<string>(ConversationConstants.ENTITY_ISSUE_STATE)
                }
            )
        }
        googleConvo.ask(`Would you like me to get issues you've commented on or issues you've created?`);
    }
});


export const mapp = functions.https.onRequest(app);
