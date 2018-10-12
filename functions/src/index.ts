import * as functions from 'firebase-functions';
import {NewSurface, NewSurfaceOptions, SignIn} from "actions-on-google";
import GithubHelper from "./GithubHelper";
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
    await GithubHelper.nextCreatedIssues(googleConvo);
});


app.intent(ConversationConstants.INTENT_FIND_ISSUES, async dialogConvo => {
    const googleConvo = new GoogleConvo(dialogConvo);

    const userName = googleConvo.getStorage<string>(ConversationConstants.STORAGE_USERNAME);

    // we got an entity
    if (googleConvo.hasEntity(ConversationConstants.ENTITY_ISSUES)) {
        // created issues
        if (googleConvo.getEntity<string>(ConversationConstants.ENTITY_ISSUES) === 'create') {
            await GithubHelper.firstTimeCreatedIssues(googleConvo);
        }
        // issues commented on
        else {
            const commentsToGrab = 20;
            const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.commentsOnIssuesQL(userName));

            const issues = res.data.user.issueComments.nodes;
            const actualIssueCount = res.data.user.issueComments.totalCount;
            const min = actualIssueCount < commentsToGrab ? actualIssueCount : commentsToGrab;

            const openIssuesNodes: object = {};
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
                googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1, {'position': 1, 'issue_count': 10});
                googleConvo.ask(ActionsHelper.generateBrowseCarouselItems(googleConvo, openIssues));
            }
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
