import {Authy, SocialIdentity} from "auth0-in-action/lib/Authy";
import ActionsHelper from "./ActionsHelper";
import GoogleConvo from "./GoogleConvo";
import ConversationConstants from "./ConversationConstants";
import {Suggestions} from "actions-on-google";

const request = require('request-promise-native');

export enum IssueRangeEnum {
    NONE, ONE, THRESHOLD_MET, MANY
}

export enum IssueEnum {
    CREATED, COMMENTED
}

const quantity = 5;

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

    static createdIssuesQuery(username: string, pagination: string = "", state: string = ""): string {
        const query = `{user(login:"${username}"){
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
        console.log(query);
        return query;
    }

    static commentsOnIssuesQuery(username: string, pagination: string = ""): string {
        const query = `{user(login: "${username}") {
                                issueComments(first: ${quantity}` + this.paginate(pagination) + `) {
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
        console.log(query);
        return query;
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

    static getIssueEnum(current: number, issueCount: number): IssueRangeEnum {
        if (issueCount > 0) {
            if (issueCount === 1) {
                return IssueRangeEnum.ONE;
            }
            // if the current pos + quantity more is met then we can't grab anything more after that
            if (current + quantity >= issueCount) {
                return IssueRangeEnum.THRESHOLD_MET;
            }
            return IssueRangeEnum.MANY;
        } else {
            return IssueRangeEnum.NONE;
        }
    }

    static filterIssuesByState(issues, issueState: string) {
        const filteredIssuesDict = {};
        const isOpen = issueState === 'open';
        issues.forEach(node => {
            // if user asks for open issue comments - then get all not closed issues
            // if user asks for closed issue comments - then gall all issues that are closed
            // or if issueState is blank              - the get everything
            if ((isOpen && !node.issue.closed) || (!isOpen && node.issue.closed) || issueState.length === 0) {
                // if doesnt exist in our dict currently, then add it
                // since a user might comment on the same repo multiple times
                if (!filteredIssuesDict.hasOwnProperty(node.issue.id)) {
                    filteredIssuesDict[node.issue.id] = node.issue;
                }
            }
        });

        const filteredIssues = [];
        for (const key in filteredIssuesDict) {
            filteredIssues.push(filteredIssuesDict[key]);
        }

        return filteredIssues;
    }


    static async firstTimeCreatedIssuesRequest(googleConvo: GoogleConvo) {
        const username = googleConvo.getStorage<string>(ConversationConstants.STORAGE_USERNAME);
        const issueState = googleConvo.hasEntity(ConversationConstants.ENTITY_ISSUE_STATE) ? googleConvo.getEntity<string>(ConversationConstants.ENTITY_ISSUE_STATE) :
            googleConvo.getContextParamValueOrDefault<string>(ConversationConstants.CONTEXT_FIND_ISSUES, 'issueState', '');
        const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.createdIssuesQuery(username, '', issueState));

        console.log(res);

        // information for paging
        // endCursor   - forward nav
        // startCursor - backward nav
        const pageInfo = res.data.user.issues.pageInfo;

        // based on response, lets set some information
        const issues = res.data.user.issues.nodes;
        const issuesCount = res.data.user.issues.totalCount;

        // based on issue count and current position, return
        const issueRangeEnum = GithubHelper.getIssueEnum(0, issuesCount);

        if (googleConvo.isScreenDevice()) {
            switch (issueRangeEnum) {
                case IssueRangeEnum.NONE:
                    googleConvo.ask(`You have no open created issues. However, you can ask to find issues you've commented on.`);
                    break;
                case IssueRangeEnum.ONE:
                    googleConvo.ask(`You currently have one open created issue.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(issues));
                    break;
                case IssueRangeEnum.THRESHOLD_MET:
                    googleConvo.ask(`Here are all of your created issues I found!`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(issues));
                    break;
                case IssueRangeEnum.MANY:
                    googleConvo.ask(`Here are some issues I found.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(issues));
                    googleConvo.ask(new Suggestions('get more'));
                    break;
            }
        }
        else {
            switch (issueRangeEnum) {
                case IssueRangeEnum.NONE:
                    googleConvo.ask(`You have no open created issues. However, you can ask to find issues you've commented on.`);
                    break;
                case IssueRangeEnum.ONE:
                    googleConvo.ask(`You currently have one open created issue.`);
                    googleConvo.ask(`The open issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue?`);
                    googleConvo.saveToStorage('issue', issues[0]);
                    break;
                case IssueRangeEnum.THRESHOLD_MET:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(`The first issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue or get the next issue?`);
                    googleConvo.saveToStorage('issue', issues[0]);
                    break;
                case IssueRangeEnum.MANY:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(`The first issue is ${issues[0].title} under ${issues[0].repository.owner.login}'s repository ${issues[0].repository.name}. Would you like a link to this issue or get the next issue?`);
                    googleConvo.saveToStorage('issue', issues[0]);
                    break;
            }
        }

        if (issueRangeEnum === IssueRangeEnum.MANY) {
            googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1,
                {
                    'position': quantity,
                    'issuesCount': issuesCount,
                    'nextCursor': pageInfo.endCursor,
                    'issueState': issueState,
                    'issueEnum' : IssueEnum.CREATED
                });
        }
    }

    static async firstTimeCommentedIssuesRequest(googleConvo: GoogleConvo) {
        const username = googleConvo.getStorage<string>(ConversationConstants.STORAGE_USERNAME);
        const issueState = googleConvo.hasEntity(ConversationConstants.ENTITY_ISSUE_STATE) ? googleConvo.getEntity<string>(ConversationConstants.ENTITY_ISSUE_STATE) :
            googleConvo.getContextParamValueOrDefault<string>(ConversationConstants.CONTEXT_FIND_ISSUES, 'issueState', '');
        const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.commentsOnIssuesQuery(username, ''));

        console.log(res);

        const issueComments = res.data.user.issueComments;
        const pageInfo = issueComments.pageInfo;
        const issues = issueComments.nodes;
        const totalIssueCommentCount = issueComments.totalCount;
        const filteredIssues = GithubHelper.filterIssuesByState(issues, issueState);


        const issueRangeEnum = GithubHelper.getIssueEnum(0, totalIssueCommentCount);


        if (googleConvo.isScreenDevice()) {
            switch (issueRangeEnum) {
                case IssueRangeEnum.NONE:
                    googleConvo.ask(`You do not have any ${issueState} commented issues. Would you like to do anything else?`);
                    break;
                case IssueRangeEnum.ONE:
                    googleConvo.ask(`You currently have only one open commented issue.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(filteredIssues));
                    break;
                case IssueRangeEnum.THRESHOLD_MET:
                    googleConvo.ask(`Here are all the unique ${issueState} issues you've commented on.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(filteredIssues));
                    break;
                case IssueRangeEnum.MANY:

                    if (filteredIssues.length === 1) {
                        googleConvo.ask(`Here is an issue I found.`);
                    } else {
                        googleConvo.ask(`Here are some issues I found.`);
                    }

                    googleConvo.ask(ActionsHelper.generateIssueResponse(filteredIssues));
                    googleConvo.ask(new Suggestions('more issues'));
                    break;
            }
        }


        if (issueRangeEnum === IssueRangeEnum.MANY) {
            googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1,
                {
                    'position': quantity,
                    'issuesCount': totalIssueCommentCount,
                    'nextCursor': pageInfo.endCursor,
                    'issueState': issueState,
                    'issueEnum' : IssueEnum.COMMENTED
                });
        }
    }

    static async nextCommentedIssues(googleConvo: GoogleConvo) {
        const username = googleConvo.getStorage<string>(ConversationConstants.STORAGE_USERNAME);
        const contextParams = googleConvo.getContextParam(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP);

        // didnt use get default here, because in order to get to 'next created issues'
        // i know for sure i pass all these params in contextParams
        const issuesCount = contextParams.issuesCount as number;
        const currentPosition = contextParams.position as number;
        const issueState = contextParams.issueState as string;
        const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.commentsOnIssuesQuery(username, contextParams.nextCursor as string));

        const issues = res.data.user.issueComments.nodes;
        const pageInfo = res.data.user.issueComments.pageInfo;
        const filteredIssues = GithubHelper.filterIssuesByState(issues, issueState);

        const issueRangeEnum = GithubHelper.getIssueEnum(currentPosition, issuesCount);


        if (googleConvo.isScreenDevice()) {
            switch (issueRangeEnum) {
                case IssueRangeEnum.THRESHOLD_MET:
                    googleConvo.ask(`Here are the last of the unique ${issueState} issues.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(filteredIssues));
                    break;
                case IssueRangeEnum.MANY:
                    console.log('Many more commented issues');
                    console.log('Next position: ' + currentPosition + quantity);
                    console.log('Issue count: ' + issuesCount);

                    googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1,
                        {
                            'position': currentPosition + quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCusor,
                            'issueState': issueState,
                            'issueEnum': contextParams.issueEnum
                        }
                    );

                    if (filteredIssues.length === 1) {
                        googleConvo.ask(`Here is the next unique ${issueState} issue.`);
                    } else {
                        googleConvo.ask(`Here are the next unique ${issueState} issues.`);
                    }

                    googleConvo.ask(ActionsHelper.generateIssueResponse(filteredIssues));
                    break;
            }
        } else {
            googleConvo.ask('not a screen?')
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
        const res = await GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.createdIssuesQuery(username, contextParams.nextCursor as string, issueState));

        const issues = res.data.user.issues.nodes;
        const pageInfo = res.data.user.issues.pageInfo;

        const issueRangeEnum = GithubHelper.getIssueEnum(currentPosition, issuesCount);


        if (googleConvo.isScreenDevice()) {
            switch (issueRangeEnum) {
                case IssueRangeEnum.THRESHOLD_MET:
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(issues));
                    break;
                case IssueRangeEnum.MANY:
                    console.log('Many more created issues');
                    console.log('Next position: ' + currentPosition + quantity);
                    console.log('Issue count: ' + issuesCount);

                    googleConvo.setContext(ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1,
                        {
                            'position': currentPosition + quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCusor,
                            'issueState': issueState,
                            'issueEnum': contextParams.issueEnum
                        }
                    );
                    googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                    googleConvo.ask(ActionsHelper.generateIssueResponse(issues));
                    break;
            }
        } else {
            googleConvo.ask('not a screen?')
        }
    }


}