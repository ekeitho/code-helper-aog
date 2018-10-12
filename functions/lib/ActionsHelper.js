"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const actions_on_google_1 = require("actions-on-google");
class ActionsHelper {
    static generateBrowseCarouselItems(conv, issues) {
        const a11yText = 'Google Assistant Bubbles';
        const items = [];
        issues.forEach(issue => {
            items.push(new actions_on_google_1.BrowseCarouselItem({
                title: issue.repository.name,
                url: issue.url,
                description: issue.title,
                image: new actions_on_google_1.Image({
                    url: issue.repository.owner.avatarUrl,
                    alt: a11yText
                })
            }));
        });
        // Create a browse carousel
        return new actions_on_google_1.BrowseCarousel({
            items: items,
        });
    }
    static sendIssueCard(conv) {
        const issue = conv.user.storage.issue;
        conv.ask('Here is the issue');
        conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, [issue]));
    }
}
exports.default = ActionsHelper;
//# sourceMappingURL=ActionsHelper.js.map