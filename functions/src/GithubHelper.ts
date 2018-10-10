import {Authy, SocialIdentity} from "auth0-in-action/lib/Authy";
import ActionsHelper from "./ActionsHelper";
import GoogleConvo from "./GoogleConvo";

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

    static async authenticateGithubUser(conv): Promise<SocialIdentity> {

        let gitToken = '';
        let user = '';

        if (!conv.user.storage.hasOwnProperty('token')) {

            const authy = new Authy('codehelpa',
                'eqKAwhrdqUU2uZymuP419XJPF417P8rq',
                'c8hTVXh8gK8FqU0om5aBlX8ONfa9X3DMhYdgRin-SP3ox0M6yoyzXWVHSYptaWwE'
            );

            const {access_token, username} = await authy.getSocialIdentity(conv.user.access.token);

            if (access_token && username) {
                // save local scope vars for return
                // make sure identities is for github later
                gitToken = access_token;
                user = username;

                // save it for later so we dont have to do all these networks calls later
                conv.user.storage.token = gitToken;
                conv.user.storage.userName = user;
            } else {
                // report error
            }
        } else {
            gitToken = conv.user.storage.token;
            user = conv.user.storage.userName;
        }

        return {access_token: gitToken, username: user};
    }

    static async sendGithubGraphQL(conv, graphQL: string) {
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


    static async firstTimeCreatedIssues(conv: GoogleConvo) {
        const username = conv.getStorage<string>('userName');
        const issueState = conv.getContextParamValueOrDefault('find_issues', 'issue-state', '');
        const res = await GithubHelper.sendGithubGraphQL(conv, GithubHelper.createdIssuesQL(username, '', issueState));

        // information for paging
        // endCursor   - forward nav
        // startCursor - backward nav
        const pageInfo = res.data.user.issues.pageInfo;

        // based on response, lets set some informaiton
        const issues = res.data.user.issues.nodes;
        const issuesCount = res.data.user.issues.totalCount;

        // based on issue count and current position, return
        const issueEnum = GithubHelper.getIssueEnum(issues, 0, issuesCount);

        if (ActionsHelper.isScreenDevice(conv)) {
            switch (issueEnum) {
                case IssueEnum.NONE:
                    conv.ask(`You have no open created issues. However, you can ask to find issues you've commented on.`);
                    break;
                case IssueEnum.ONE:
                    conv.ask(`You currently have one open created issue.`);
                    conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, issues));
                    break;
                case IssueEnum.THRESHOLD_MET:
                    conv.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, issues));
                    break;
                case IssueEnum.MANY:
                    conv.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, issues));
                    conv.setContext('find_issues-followup', 1,
                        {
                            'position': quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCursor
                        });
                    break;
            }
        }
        else {
            switch (issueEnum) {
                case IssueEnum.NONE:
                    conv.ask(`You have no open created issues. However, you can ask to find issues you've commented on.`);
                    break;
                case IssueEnum.ONE:
                    conv.ask(`You currently have one open created issue.`);
                    conv.ask(`The open issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue?`);
                    conv.saveToStorage('issue', issues[0]);
                    break;
                case IssueEnum.THRESHOLD_MET:
                    conv.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    conv.ask(`The first issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue or get the next issue?`);
                    conv.saveToStorage('issue', issues[0]);
                    break;
                case IssueEnum.MANY:
                    conv.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    conv.ask(`The first issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue or get the next issue?`);
                    conv.saveToStorage('issue', issues[0]);
                    conv.setContext('find_issues-followup', 1,
                        {
                            'position': quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCursor
                        });
                    break;
            }
        }
    }

    static async nextCreatedIssues(conv: GoogleConvo) {

        const username = conv.getStorage<string>('userName');
        const contextParams = conv.getContextParam('find_issues-followup');

        const issuesCount = contextParams.issuesCount as number;
        const currentPosition = contextParams.position as number;

        const res = await GithubHelper.sendGithubGraphQL(conv, GithubHelper.createdIssuesQL(username, contextParams.nextCursor as string));

        const issues = res.data.user.issues.nodes;
        const pageInfo = res.data.user.issues.pageInfo;

        const issueEnum = GithubHelper.getIssueEnum(issues, currentPosition, issuesCount);


        if (ActionsHelper.isScreenDevice(conv)) {
            console.log('is screen device');

            switch (issueEnum) {
                case IssueEnum.THRESHOLD_MET:
                    conv.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, issues));
                    break;
                case IssueEnum.MANY:
                    console.log('hello?');
                    conv.setContext('find_issues-followup', 1,
                        {
                            'position': currentPosition + quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCusor
                        }
                    );
                    conv.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, issues));
                    break;
                default:
                    conv.ask("hmmm");
            }
        } else {
            conv.ask('not a screen?')
        }
    }


}