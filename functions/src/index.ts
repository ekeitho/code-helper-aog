import * as functions from 'firebase-functions';
import {NewSurface, NewSurfaceOptions, SignIn} from "actions-on-google";
import GithubHelper from "./GithubHelper";
import ActionsHelper from "./ActionsHelper";
import GoogleConvo from "./GoogleConvo";
import ConversationConstants from "./ConversationConstants";

const {dialogflow} = require('actions-on-google');
const app = dialogflow({debug: true});


app.intent('Default Welcome Intent', conv => {
    conv.ask(new SignIn());
});

app.intent('actions.intent.SIGN_IN', async (conv, params, signin) => {
    if (signin.status !== 'OK') {
        return conv.close('You need to sign in before using the app.');
    }

    try {
        const gitToken = await GithubHelper.authenticateGithubUser(conv);
        // possibly do something with access token
        conv.ask(`Great! Thanks for signing in ${gitToken.username}. What can I do for you today?`);
    } catch (err) {

    }
});


app.intent('actions.intent.NEW_SURFACE', (conv, params, newSurface) => {
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

app.intent('find_issues-next', async conv => {
    await GithubHelper.nextCreatedIssues(conv);
});


app.intent('find_issues', async dialogConvo => {
    const conv = new GoogleConvo(dialogConvo);


    const userName = conv.getStorage<string>('userName');

    // we got an entity
    if (conv.hasEntity(ConversationConstants.ENTITY_ISSUES)) {
        // created issues
        if (conv.getEntity<string>(ConversationConstants.ENTITY_ISSUES) === 'create') {
            await GithubHelper.firstTimeCreatedIssues(conv);
        }
        // issues commented on
        else {
            const commentsToGrab = 20;
            const res = await GithubHelper.sendGithubGraphQL(conv, GithubHelper.commentsOnIssuesQL(userName));

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

            conv.ask(`The past ${min} comments you made on issues. ${openIssuesCount} of them are open.`);
            if (conv.isScreenDevice()) {
                conv.setContext('find_issues-followup', 1, {'position': 1, 'issue_count': 10});
                conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, openIssues));
            }
        }
    } else {
        // if user asked for open/closed issues, but didn't specify created or commented on
        // then ask them, but save the state for later
        if (conv.hasEntity('state-issue')) {
            conv.setContext('find_issues', 1,
                {
                    'issue-state': conv.getEntity<string>('state-issue')
                }
            )
        }
        conv.ask(`Would you like me to get issues you've commented on or issues you've created?`);
    }
});


export const mapp = functions.https.onRequest(app);
