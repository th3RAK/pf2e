import type { ChatMessagePF2e } from "@module/chat-message/document.ts";
import { createHTMLElement, fontAwesomeIcon, htmlClosest, htmlQuery } from "@util";
import { Kingdom } from "./model.ts";

/** Handler for kingdom chat messages. Does nothing if there is no kingdom */
export async function handleKingdomChatMessageEvents(options: KingdomChatMessageParams): Promise<void> {
    const { event, message } = options;
    const party = message.actor ?? game.actors.party;
    if (!party?.isOfType("party") || !(party?.campaign instanceof Kingdom)) {
        return;
    }

    if (htmlClosest(event.target, "[data-action=kingdom-collect]")) {
        if (!party.isOwner) return;
        const kingdom = party.campaign;
        await kingdom.collect();

        const content = createHTMLElement("div", { innerHTML: message.content });
        htmlQuery(content, "[data-action=kingdom-collect]")?.replaceWith(
            createHTMLElement("div", {
                classes: ["confirmation"],
                children: [fontAwesomeIcon("fa-check"), "Resources Collected"],
            }),
        );
        message.update({ content: content.innerHTML });
    }

    if (htmlClosest(event.target, "[data-action=kingdom-determineStability]")) {
        if (!party.isOwner) return;
        const kingdom = party.campaign;
        await kingdom.determineStability();

        const content = createHTMLElement("div", { innerHTML: message.content });
        htmlQuery(content, "[data-action=kingdom-determineStability]")?.replaceWith(
            createHTMLElement("div", {
                classes: ["confirmation"],
                children: [fontAwesomeIcon("fa-check"), "Stability Determined"],
            }),
        );
        message.update({ content: content.innerHTML });
    }

    if (htmlClosest(event.target, "[data-action=kingdom-payConsumption]")) {
        if (!party.isOwner) return;
        const kingdom = party.campaign;
        await kingdom.payConsumption();

        const content = createHTMLElement("div", { innerHTML: message.content });
        htmlQuery(content, "[data-action=kingdom-payConsumption]")?.replaceWith(
            createHTMLElement("div", {
                classes: ["confirmation"],
                children: [fontAwesomeIcon("fa-check"), "Consumption Paid"],
            }),
        );
        message.update({ content: content.innerHTML });
    }
}

interface KingdomChatMessageParams {
    event: MouseEvent;
    message: ChatMessagePF2e;
    messageEl: HTMLElement;
}
