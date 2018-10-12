export default class ConversationConstants {
    /* intents */
    static INTENT_FIND_ISSUES  = 'find_issues';
    static INTENT_FIND_MORE_ISSUES = 'find_issues-next';
    static INTENT_WELCOME = 'Default Welcome Intent';
    static INTENT_SIGN_IN = 'actions.intent.SIGN_IN';
    static INTENT_NEW_SURFACE = 'actions.intent.NEW_SURFACE';

    /* contexts */
    static CONTEXT_FIND_ISSUES = 'find_issues';
    static CONTEXT_FIND_ISSUES_FOLLOW_UP = 'find_issues-followup';


    /* entities */
    static ENTITY_ISSUES = 'issues';
    static ENTITY_ISSUE_STATE = 'issue-state';

    /* storage keys */
    static STORAGE_USERNAME = 'userName';
    static STORAGE_TOKEN = 'token';

}