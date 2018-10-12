import {BrowseCarousel, BrowseCarouselItem, Image} from "actions-on-google";
import GoogleConvo from "./GoogleConvo";

export default class ActionsHelper {

    static generateBrowseCarouselItems(conv, issues): BrowseCarousel {

        const a11yText = 'Google Assistant Bubbles';
        const items: BrowseCarouselItem [] = [];

        issues.forEach(issue => {
            items.push(new BrowseCarouselItem({
                title: issue.repository.name,
                url: issue.url,
                description: issue.title,
                image: new Image({
                    url: issue.repository.owner.avatarUrl,
                    alt: a11yText
                })
            }));
        });

        // Create a browse carousel
        return new BrowseCarousel({
            items: items,
        });
    }

    static sendIssueCard(conv) {
        const issue = conv.user.storage.issue;
        conv.ask('Here is the issue');
        conv.ask(ActionsHelper.generateBrowseCarouselItems(conv, [issue]));
    }
}