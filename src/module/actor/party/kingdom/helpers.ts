import type { ActorPF2e } from "@actor";
import type { ItemPF2e } from "@item";
import * as R from "remeda";
import type { Kingdom } from "./model.ts";
import { KingdomAbility, KingdomCHG, KingdomCommodity } from "./types.ts";

/** Resolves boosts using kingmaker rules. Free boosts cannot be the granted ability nor the flaw */
function resolveKingdomBoosts(entry: KingdomCHG, choices: KingdomAbility[]): KingdomAbility[] {
    const notFreeBoosts = entry.boosts.filter((b): b is KingdomAbility => b !== "free");
    return R.unique([notFreeBoosts, choices].flat())
        .filter((b) => b !== entry.flaw)
        .slice(0, entry.boosts.length);
}

/** Assemble what will be collected during the kingdom's upkeep phase */
function calculateKingdomCollectionData(kingdom: Kingdom): {
    formula: string;
    commodities: Record<Exclude<KingdomCommodity, "food"|"fish"|"aqueduct"|"bridge"|"canal"|"fort"
    |"highway"|"road"|"watchtower"|"refuge"|"landmark"|"river">, number>;
} { 
    const commodityTypes = ["lumber", "ore", "stone"] as const;
    return {
        formula: "1d20+"+`${kingdom.skills.economy.mod}`,
        commodities: R.mapToObj(commodityTypes, (type) => {
            const value = kingdom.resources.workSites[type];
            return [type, value.value + value.resource * 2];
        }),
    };
}

function calculateKingdomStabilizationData(kingdom: Kingdom): {
    formula: string;
} { 
    return {
        formula: "1d20+"+`${kingdom.skills.stability.mod}` 
    };
}

async function importDocuments(actor: ActorPF2e, items: ItemPF2e[], skipDialog: boolean): Promise<void> {
    const newDocuments = items.filter((d) => !actor.items.some((i) => i.sourceId === d.uuid));
    const createData = newDocuments.map((d) => d.toObject());

    const incomingDataByUUID = R.mapToObj(items, (d) => [d.uuid, d.toObject(true)]);
    const updateData = actor.itemTypes.campaignFeature
        .map((d) => {
            const incoming = d.sourceId && incomingDataByUUID[d.sourceId];
            if (!incoming) return null;

            const data = R.pick(incoming, ["name", "img", "system"]);
            const diff = fu.diffObject(d.toObject(true), data);
            return R.isEmpty(diff) ? null : { _id: d.id, ...diff };
        })
        .filter(R.isTruthy);

    // Exit out early if there's nothing to add or update
    if (!updateData.length && !createData.length) {
        return;
    }

    if (!skipDialog) {
        const result = await Dialog.confirm({
            title: game.i18n.localize("PF2E.Kingmaker.Kingdom.ImportDialog.Title"),
            content: game.i18n.format("PF2E.Kingmaker.Kingdom.ImportDialog.Content", {
                added: createData.length,
                updated: updateData.length,
            }),
        });
        if (!result) return;
    }

    await actor.updateEmbeddedDocuments("Item", updateData);
    await actor.createEmbeddedDocuments("Item", createData);
}

export { calculateKingdomCollectionData, calculateKingdomStabilizationData, importDocuments, resolveKingdomBoosts };
