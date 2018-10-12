import {Authy, SocialIdentity} from "auth0-in-action/lib/Authy";
import ActionsHelper from "./ActionsHelper";
import GoogleConvo from "./GoogleConvo";
import ConversationConstants from "./ConversationConstants";

const request = require('request-promise-native');

enum IssueEnum {
    NONE, ONE, THRESHOLD_MET, MANY
}

const quantity = 2;

export default class GithubHelper {

    static paginate(pagination: string) {
        const isPaginating = pagination.length !== 0;
        if (isPaginating) {
            return ', after: "' + pagination + '"';
        }
        return '';
    }

    static issueState(state: string) {
        const hasState = state.length !== 0;
        if (hasState) {
            return ', states: ' + state
        }
        return '';
    }

    static createdIssuesQL(username: string, pagination: string = "", state: string = ""): string {
        return `{user(login:"${username}"){
                        issues(first: ${quantity}` + this.paginate(pagination) + this.issueState(state) + `) {
                          nodes {
                            title
                            repository {
                              owner {
                                login
                                avatarUrl
                              }
                              name
                            }
                            url
                          }
                          pageInfo {
                            endCursor
                            startCursor
                          }
                          totalCount
                        }
                      }
                   }`;
    }

    static commentsOnIssuesQL(username: string, pagination: string = "", state: string = ""): string {
        return `{user(login: "${username}") {
                                issueComments(first: ${quantity}` + this.paginate(pagination) + this.issueState(state) + `) {
                                  nodes {
                                    issue {
                                      closed
                                      id
                                      title
                                      repository {
                                        owner {
                                          login
                                          avatarUrl
                                        }
                                        name
                                      }
                                      url
                                    }
                                  }
                                  pageInfo {
                                    endCursor
                                    startCursor
                                  }
                                  totalCount
                                }
                              }
                            }`;
    }

    static async authenticateGithubUser(conv: GoogleConvo): Promise<SocialIdentity> {

        let gitToken = '';
        let user = '';


        if (conv.hasInStorage(ConversationConstants.STORAGE_TOKEN)) {
            gitToken = conv.getStorage(ConversationConstants.STORAGE_TOKEN);
            user = conv.getStorage(ConversationConstants.STORAGE_USERNAME);
        }
        else {
            const authy = new Authy('codehelpa',
                'eqKAwhrdqUU2uZymuP419XJPF417P8rq',
                'c8hTVXh8gK8FqU0om5aBlX8ONfa9X3DMhYdgRin-SP3ox0M6yoyzXWVHSYptaWwE'
            );

            const {access_token, username} = await authy.getSocialIdentity(conv.getAccessToken());

            if (access_token && username) {
                // save local scope vars for return
                // make sure identities is for github later
                gitToken = access_token;
                user = username;

                // save it for later so we dont have to do all these networks calls later
                conv.saveToStorage<string>(ConversationConstants.STORAGE_TOKEN, gitToken);
                conv.saveToStorage<string>(ConversationConstants.STORAGE_USERNAME, user);
            } else {
                // report error
                console.log('username: ' + username);
                console.log('access_token: ' + access_token);
                throw new Error('auth error');
            }
        }

        return {access_token: gitToken, username: user};
    }

    static async sendGithubGraphQL(conv: GoogleConvo, graphQL: string) {
        const gitToken = await GithubHelper.authenticateGithubUser(conv);

        const body = {query: graphQL};
        return request({
            uri: "https://api.github.com/graphql",
            method: 'POST',
            headers: {
                'User-Agent': 'codehelpa',
                Authorization: `bearer ${gitToken.access_token}`
            },
            body: body,
            json: true
        });
    }

    static getIssueEnum(issues, current: number, issueCount: number): IssueEnum {
        if (issueCount > 0) {
            if (issueCount === 1) {
                return IssueEnum.ONE;
            }
            // if the current pos + quantity more is met then we can't grab anything more after that
            if (current + quantity >= issueCount) {
                return IssueEnum.THRESHOLD_MET;
            }
            return IssueEnum.MANY;
        } else {
            return IssueEnum.NONE;
        }
    }


    static async firstTimeCreatedIssues(googleConvo: GoogleConvo) {
        const username = googleConvo.getStorage<string>(ConversationConstants.STORAGE_USERNAME);
        const issueState = googleConvo.getContextParamValueOrDefault(ConversationConstants.CONTEXT_FIND_ISSUES, 'issueState', '');
        const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.createdIssuesQL(username, '', issueState));

        // information for paging
        // endCursor   - forward nav
        // startCursor - backward nav
        const pageInfo = res.data.user.issues.pageInfo;

        // based on response, lets set some information
        const issues = res.data.user.issues.nodes;
        const issuesCount = res.data.user.issues.totalCount;

        // based on issue count and current position, return
        const issueEnum = GithubHelper.getIssueEnum(issues, 0, issuesCount);

        if (googleConvo.isScreenDevice()) {
            switch (issueEnum) {
                case IssueEnum.NONE:
                    googleConvo.ask(`You have no open created issues. However, you can ask to find issues you've commented on.`);
                    break;
                case IssueEnum.ONE:
                    googleConvo.ask(`You currently have one open created issue.`);
                    googleConvo.ask(ActionsHelper.generateBrowseCarouselItems(googleConvo, issues));
                    break;
                case IssueEnum.THRESHOLD_MET:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(ActionsHelper.generateBrowseCarouselItems(googleConvo, issues));
                    break;
                case IssueEnum.MANY:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(ActionsHelper.generateBrowseCarouselItems(googleConvo, issues));
                    break;
            }
        }
        else {
            switch (issueEnum) {
                case IssueEnum.NONE:
                    googleConvo.ask(`You have no open created issues. However, you can ask to find issues you've commented on.`);
                    break;
                case IssueEnum.ONE:
                    googleConvo.ask(`You currently have one open created issue.`);
                    googleConvo.ask(`The open issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue?`);
                    googleConvo.saveToStorage('issue', issues[0]);
                    break;
                case IssueEnum.THRESHOLD_MET:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(`The first issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue or get the next issue?`);
                    googleConvo.saveToStorage('issue', issues[0]);
                    break;
                case IssueEnum.MANY:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(`The first issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue or get the next issue?`);
                    googleConvo.saveToStorage('issue', issues[0]);
                    break;
            }
        }

        if (issueEnum === IssueEnum.MANY) {
            googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1,
                {
                    'position': quantity,
                    'issuesCount': issuesCount,
                    'nextCursor': pageInfo.endCursor,
                    'issueState': issueState
                });
        }
    }

    static async nextCreatedIssues(googleConvo: GoogleConvo) {

        const username = googleConvo.getStorage<string>(ConversationConstants.STORAGE_USERNAME);
        const contextParams = googleConvo.getContextParam(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP);

        // didnt use get default here, because in order to get to 'next created issues'
        // i know for sure i pass all these params in contextParams
        const issuesCount = contextParams.issuesCount as number;
        const currentPosition = contextParams.position as number;
        const issueState = contextParams.issueState as string;
        const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.createdIssuesQL(username, contextParams.nextCursor as string, issueState));

        const issues = res.data.user.issues.nodes;
        const pageInfo = res.data.user.issues.pageInfo;

        const issueEnum = GithubHelper.getIssueEnum(issues, currentPosition, issuesCount);


        if (googleConvo.isScreenDevice()) {
            console.log('is screen device');

            switch (issueEnum) {
                case IssueEnum.THRESHOLD_MET:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(ActionsHelper.generateBrowseCarouselItems(googleConvo, issues));
                    break;
                case IssueEnum.MANY:
                    console.log('hello?');
                    googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1,
                        {
                            'position': currentPosition + quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCusor
                        }
                    );
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(ActionsHelper.generateBrowseCarouselItems(googleConvo, issues));
                    break;
                default:
                    googleConvo.ask("hmmm");
            }
        } else {
            googleConvo.ask('not a screen?')
        }
    }


}