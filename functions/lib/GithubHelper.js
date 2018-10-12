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
const Authy_1 = require("auth0-in-action/lib/Authy");
const ActionsHelper_1 = require("./ActionsHelper");
const ConversationConstants_1 = require("./ConversationConstants");
const request = require('request-promise-native');
var IssueEnum;
(function (IssueEnum) {
    IssueEnum[IssueEnum["NONE"] = 0] = "NONE";
    IssueEnum[IssueEnum["ONE"] = 1] = "ONE";
    IssueEnum[IssueEnum["THRESHOLD_MET"] = 2] = "THRESHOLD_MET";
    IssueEnum[IssueEnum["MANY"] = 3] = "MANY";
})(IssueEnum || (IssueEnum = {}));
const quantity = 2;
class GithubHelper {
    static paginate(pagination) {
        const isPaginating = pagination.length !== 0;
        if (isPaginating) {
            return ', after: "' + pagination + '"';
        }
        return '';
    }
    static issueState(state) {
        const hasState = state.length !== 0;
        if (hasState) {
            return ', states: ' + state;
        }
        return '';
    }
    static createdIssuesQuery(username, pagination = "", state = "") {
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
    static commentsOnIssuesQL(username, pagination = "", state = "") {
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
    static authenticateGithubUser(conv) {
        return __awaiter(this, void 0, void 0, function* () {
            let gitToken = '';
            let user = '';
            if (conv.hasInStorage(ConversationConstants_1.default.STORAGE_TOKEN)) {
                gitToken = conv.getStorage(ConversationConstants_1.default.STORAGE_TOKEN);
                user = conv.getStorage(ConversationConstants_1.default.STORAGE_USERNAME);
            }
            else {
                const authy = new Authy_1.Authy('codehelpa', 'eqKAwhrdqUU2uZymuP419XJPF417P8rq', 'c8hTVXh8gK8FqU0om5aBlX8ONfa9X3DMhYdgRin-SP3ox0M6yoyzXWVHSYptaWwE');
                const { access_token, username } = yield authy.getSocialIdentity(conv.getAccessToken());
                if (access_token && username) {
                    // save local scope vars for return
                    // make sure identities is for github later
                    gitToken = access_token;
                    user = username;
                    // save it for later so we dont have to do all these networks calls later
                    conv.saveToStorage(ConversationConstants_1.default.STORAGE_TOKEN, gitToken);
                    conv.saveToStorage(ConversationConstants_1.default.STORAGE_USERNAME, user);
                }
                else {
                    // report error
                    console.log('username: ' + username);
                    console.log('access_token: ' + access_token);
                    throw new Error('auth error');
                }
            }
            return { access_token: gitToken, username: user };
        });
    }
    static sendGithubGraphQL(conv, graphQL) {
        return __awaiter(this, void 0, void 0, function* () {
            const gitToken = yield GithubHelper.authenticateGithubUser(conv);
            const body = { query: graphQL };
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
        });
    }
    static getIssueEnum(issues, current, issueCount) {
        if (issueCount > 0) {
            if (issueCount === 1) {
                return IssueEnum.ONE;
            }
            // if the current pos + quantity more is met then we can't grab anything more after that
            if (current + quantity >= issueCount) {
                return IssueEnum.THRESHOLD_MET;
            }
            return IssueEnum.MANY;
        }
        else {
            return IssueEnum.NONE;
        }
    }
    static firstTimeCreatedIssues(googleConvo) {
        return __awaiter(this, void 0, void 0, function* () {
            const username = googleConvo.getStorage(ConversationConstants_1.default.STORAGE_USERNAME);
            const issueState = googleConvo.getContextParamValueOrDefault(ConversationConstants_1.default.CONTEXT_FIND_ISSUES, 'issueState', '');
            const res = yield GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.createdIssuesQuery(username, '', issueState));
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
                        googleConvo.ask(ActionsHelper_1.default.generateBrowseCarouselItems(googleConvo, issues));
                        break;
                    case IssueEnum.THRESHOLD_MET:
                        googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                        googleConvo.ask(ActionsHelper_1.default.generateBrowseCarouselItems(googleConvo, issues));
                        break;
                    case IssueEnum.MANY:
                        googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                        googleConvo.ask(ActionsHelper_1.default.generateBrowseCarouselItems(googleConvo, issues));
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
                googleConvo.setContext(ConversationConstants_1.default.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1, {
                    'position': quantity,
                    'issuesCount': issuesCount,
                    'nextCursor': pageInfo.endCursor,
                    'issueState': issueState
                });
            }
        });
    }
    static nextCreatedIssues(googleConvo) {
        return __awaiter(this, void 0, void 0, function* () {
            const username = googleConvo.getStorage(ConversationConstants_1.default.STORAGE_USERNAME);
            const contextParams = googleConvo.getContextParam(ConversationConstants_1.default.CONTEXT_FIND_ISSUES_FOLLOW_UP);
            // didnt use get default here, because in order to get to 'next created issues'
            // i know for sure i pass all these params in contextParams
            const issuesCount = contextParams.issuesCount;
            const currentPosition = contextParams.position;
            const issueState = contextParams.issueState;
            const res = yield GithubHelper.sendGithubGraphQL(googleConvo, GithubHelper.createdIssuesQuery(username, contextParams.nextCursor, issueState));
            const issues = res.data.user.issues.nodes;
            const pageInfo = res.data.user.issues.pageInfo;
            const issueEnum = GithubHelper.getIssueEnum(issues, currentPosition, issuesCount);
            if (googleConvo.isScreenDevice()) {
                console.log('is screen device');
                switch (issueEnum) {
                    case IssueEnum.THRESHOLD_MET:
                        googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                        googleConvo.ask(ActionsHelper_1.default.generateBrowseCarouselItems(googleConvo, issues));
                        break;
                    case IssueEnum.MANY:
                        console.log('hello?');
                        googleConvo.setContext(ConversationConstants_1.default.CONTEXT_FIND_ISSUES_FOLLOW_UP, 1, {
                            'position': currentPosition + quantity,
                            'issuesCount': issuesCount,
                            'nextCursor': pageInfo.endCusor
                        });
                        googleConvo.ask(`Of the ${issuesCount} issues you've created. I found a few that are open.`);
                        googleConvo.ask(ActionsHelper_1.default.generateBrowseCarouselItems(googleConvo, issues));
                        break;
                    default:
                        googleConvo.ask("hmmm");
                }
            }
            else {
                googleConvo.ask('not a screen?');
            }
        });
    }
}
exports.default = GithubHelper;
//# sourceMappingURL=GithubHelper.js.map