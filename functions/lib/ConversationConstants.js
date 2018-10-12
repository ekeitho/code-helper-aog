"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ConversationConstants {
}
/* intents */
ConversationConstants.INTENT_FIND_ISSUES = 'find_issues';
ConversationConstants.INTENT_FIND_MORE_ISSUES = 'find_issues-next';
ConversationConstants.INTENT_WELCOME = 'Default Welcome Intent';
ConversationConstants.INTENT_SIGN_IN = 'actions.intent.SIGN_IN';
ConversationConstants.INTENT_NEW_SURFACE = 'actions.intent.NEW_SURFACE';
/* contexts */
ConversationConstants.CONTEXT_FIND_ISSUES = 'find_issues';
ConversationConstants.CONTEXT_FIND_ISSUES_FOLLOW_UP = 'find_issues-followup';
/* entities */
ConversationConstants.ENTITY_ISSUES = 'issues';
ConversationConstants.ENTITY_ISSUE_STATE = 'issue-state';
/* storage keys */
ConversationConstants.STORAGE_USERNAME = 'userName';
ConversationConstants.STORAGE_TOKEN = 'token';
exports.default = ConversationConstants;
//# sourceMappingURL=ConversationConstants.js.map