import {BasicCard, BrowseCarousel, BrowseCarouselItem, Button, Image} from "actions-on-google";

export default class ActionsHelper {

    static generateIssueResponse(issues) {
        const items: BrowseCarouselItem [] = [];

        if (issues.length === 1) {
            return this.generateBasicCard(issues[0]);
        }

        issues.forEach(issue => {
            items.push(new BrowseCarouselItem({
                title: issue.repository.name,
                url: issue.url,
                description: issue.title,
                image: new Image({
                    url: issue.repository.owner.avatarUrl,
                    alt: 'avatar image'
                })
            }));
        });

        // Create a browse carousel
        return new BrowseCarousel({
            items: items,
        });
    }

    // when only 1 issue to show, we can't show caraousel
    private static generateBasicCard(issue): BasicCard {
        return new BasicCard({
            text: issue.title,
            title: issue.repository.name,
            buttons: new Button({
                title: 'link to issue',
                url: issue.url,
            }),
            image: new Image({
                url: issue.repository.owner.avatarUrl,
                alt: 'avatar image',
            }),
            display: 'CROPPED',
        });
    }

    static sendIssueCard(conv) {
        const issue = conv.user.storage.issue;
        conv.ask('Here is the issue');
        conv.ask(ActionsHelper.generateIssueResponse([issue]));
    }
}