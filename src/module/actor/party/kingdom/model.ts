import { ActorPF2e, type ArmyPF2e } from "@actor";
import { FeatGroup } from "@actor/character/feats.ts";
import { MODIFIER_TYPES, ModifierPF2e, RawModifier } from "@actor/modifiers.ts";
import { CampaignFeaturePF2e, ItemPF2e, PhysicalItemPF2e } from "@item";
import { ItemType } from "@item/base/data/index.ts";
import { ChatMessagePF2e } from "@module/chat-message/document.ts";
import { extractModifierAdjustments } from "@module/rules/helpers.ts";
import { Statistic } from "@system/statistic/index.ts";
import { ErrorPF2e, createHTMLElement, fontAwesomeIcon, objectHasKey, setHasElement } from "@util";
import * as R from "remeda";
import type { PartyPF2e } from "../document.ts";
import { PartyCampaign } from "../types.ts";
import { KingdomBuilder } from "./builder.ts";
import { calculateKingdomCollectionData, calculateKingdomStabilizationData, importDocuments, resolveKingdomBoosts } from "./helpers.ts";
import { KINGDOM_SCHEMA } from "./schema.ts";
import { KingdomSheetPF2e } from "./sheet.ts";

import {
    KingdomCHG,
    KingdomCharter,
    KingdomGovernment,
    KingdomNationType,
    KingdomSchema,
    KingdomSkill,
    KingdomSource,
} from "./types.ts";
import {
    KINGDOM_ABILITIES,
    KINGDOM_ABILITY_LABELS,
    KINGDOM_COMMODITIES,
    KINGDOM_COMMODITIES_MODIFIERS,
    KINGDOM_EDICTS,
    KINGDOM_EDICT_DATA,
    KINGDOM_LEADERSHIP,
    KINGDOM_SETTLEMENT_GRID_BLOCKS,
    KINGDOM_SETTLEMENT_GRID_BORDERS,
    KINGDOM_SETTLEMENT_GRID_LOTS,
    KINGDOM_SETTLEMENT_QUALITIES,
    KINGDOM_SIZE_DATA,
    KINGDOM_SKILLS,
    KINGDOM_SKILLS_KINGDOM,
    KINGDOM_SKILL_ABILITIES,
    KINGDOM_SKILL_LABELS,
    VACANCY_PENALTIES,
    KingdomSizeData,
    KINGDOM_SETTLEMENT_TYPE_DATA,
    KINGDOM_SKILLS_SETTLEMENT,
} from "./values.ts";

const { DataModel } = foundry.abstract;

/** Model for the Kingmaker campaign data type, which represents a Kingdom */
class Kingdom extends DataModel<PartyPF2e, KingdomSchema> implements PartyCampaign {
    declare sizeData: KingdomSizeData;
    declare nationType: KingdomNationType;
    declare features: FeatGroup<PartyPF2e, CampaignFeaturePF2e>;
    declare feats: FeatGroup<PartyPF2e, CampaignFeaturePF2e>;
    declare bonusFeats: FeatGroup<PartyPF2e, CampaignFeaturePF2e>;
    declare skills: Record<KingdomSkill, Statistic>;
    declare control: Statistic;
    declare armies: ArmyPF2e[];

    static override defineSchema(): KingdomSchema {
        return KINGDOM_SCHEMA;
    }

    get actor(): PartyPF2e {
        return this.parent;
    }

    get extraItemTypes(): ItemType[] {
        return ["campaignFeature", "effect"];
    }

    get activities(): CampaignFeaturePF2e[] {
        return this.actor.itemTypes.campaignFeature.filter((k) => k.category === "kingdom-activity");
    }

    get charter(): KingdomCharter | null {
        return this.build.charter;
    }

    get heartland(): KingdomCHG | null {
        return this.build.heartland;
    }

    get government(): KingdomGovernment | null {
        return this.build.government;
    }

    /** Creates sidebar buttons to inject into the chat message sidebar */
    createSidebarButtons(): HTMLElement[] {
        // Do not show kingdom to party members until building starts or it becomes activated.
        if (!this.active && !game.user.isGM) return [];

        const hoverIcon = this.active === "building" ? "wrench" : !this.active ? "plus" : null;
        const icon = createHTMLElement("a", {
            classes: ["create-button"],
            children: R.compact([fontAwesomeIcon("crown"), hoverIcon ? fontAwesomeIcon(hoverIcon) : null]),
            dataset: {
                tooltip: game.i18n.localize(
                    `PF2E.Kingmaker.SIDEBAR.${this.active === true ? "OpenSheet" : "CreateKingdom"}`,
                ),
            },
        });

        icon.addEventListener("click", async (event) => {
            event.stopPropagation();

            if (!this.active) {
                const startBuilding = await Dialog.confirm({
                    title: game.i18n.localize("PF2E.Kingmaker.KingdomBuilder.Title"),
                    content: `<p>${game.i18n.localize("PF2E.Kingmaker.KingdomBuilder.ActivationMessage")}</p>`,
                });
                if (startBuilding) {
                    await this.update({ active: "building" });
                    KingdomBuilder.showToPlayers({ uuid: this.actor.uuid });
                    new KingdomBuilder(this).render(true);
                }
            } else {
                const type = this.active === true ? null : "builder";
                this.renderSheet({ type });
            }
        });

        return [icon];
    }

    /** Perform the collection portion of the income phase */
    async collect(): Promise<void> {
        const { formula, commodities } = calculateKingdomCollectionData(this);
        const roll = await new Roll(formula).evaluate();
        await roll.toMessage(
            {
                flavor: game.i18n.localize("PF2E.Kingmaker.Kingdom.Resources.Points"),
                speaker: {
                    ...ChatMessagePF2e.getSpeaker(this.actor),
                    alias: this.name,
                },
            },
            { rollMode: "publicroll" },
        );
        if (roll.total >= this.control.dc.value) {
            this.update({
                resources: {
                    points: this.resources.points + Math.floor(roll.total / 3) + commodities.lumber + commodities.ore + commodities.stone,
                },
            });
        } else {
            this.update({
                resources: {
                    points: this.resources.points + commodities.lumber + commodities.ore + commodities.stone,
                },
            });
        }

    }
    
    /** Perform the stability portion of the upkeep phase */
    async determineStability(): Promise<void> {
        const { formula } = calculateKingdomStabilizationData(this);
        const roll = await new Roll(formula).evaluate();
        await roll.toMessage(
            {
                flavor: "Determine Kingdom Stability",
                speaker: {
                    ...ChatMessagePF2e.getSpeaker(this.actor),
                    alias: this.name,
                },
            },
            { rollMode: "publicroll" },
        );
        if (roll.total >= this.control.dc.value) {
            if (this.unrest.value > 0) {
                this.update({
                    unrest: {
                        value: this.unrest.value - 1,
                    },
                });
            } else {
                this.update({
                    resources: {
                        points: this.resources.points + 1,
                    },
                });
            }
        } else if (roll.total >= this.control.dc.value - 4){
            this.update({
                unrest: {
                    value: this.unrest.value + 1,
                },
            });
        } else {
            const rollUnrest = await new Roll("1d4").evaluate();
            await rollUnrest.toMessage(
                {
                    flavor: "Additional Unrest",
                    speaker: {
                        ...ChatMessagePF2e.getSpeaker(this.actor),
                        alias: this.name,
                    },
                },
                { rollMode: "publicroll" },
            );
            this.update({
                unrest: {
                    value: this.unrest.value + rollUnrest.total,
                },
            });
        }
    }

    /** Perform the consumption portion of the upkeep phase */
    async payConsumption(): Promise<void> {
        if (this.resources.points >= this.consumption.value) {
            this.update({
                resources: {
                    points: this.resources.points - this.consumption.value,
                },
            });
        } else {
            this.update({
                resources: {
                    points: this.resources.points - this.consumption.value,
                },
                unrest: {
                    value: this.unrest.value + 2,
                },
            });
        }
    }


    /**
     * Adds a custom modifier that will be included when determining the final value of a stat. The slug generated by
     * the name parameter must be unique for the custom modifiers for the specified stat, or it will be ignored.
     */
    async addCustomModifier(stat: string, data: RawModifier): Promise<void> {
        if (stat.length === 0) throw ErrorPF2e("A custom modifier's statistic must be a non-empty string");
        if (data.label.length === 0) throw ErrorPF2e("A custom modifier's label must be a non-empty string");

        const customModifiers = this.toObject().customModifiers ?? {};
        const modifiers = customModifiers[stat] ?? [];
        if (!modifiers.some((m) => m.label === data.label)) {
            data.type = setHasElement(MODIFIER_TYPES, data.type) ? data.type : "untyped";
            const modifier = new ModifierPF2e({ ...data, custom: true }).toObject();
            await this.update({ [`customModifiers.${stat}`]: [...modifiers, modifier] });
        }
    }

    /** Removes a custom modifier by slug */
    async removeCustomModifier(stat: string, slug: string): Promise<void> {
        if (stat.length === 0) throw ErrorPF2e("A custom modifier's statistic must be a non-empty string");

        const customModifiers = this.toObject().customModifiers ?? {};
        const modifiers = customModifiers[stat] ?? [];
        if (modifiers.length === 0) return;

        if (typeof slug === "string") {
            const withRemoved = modifiers.filter((m) => m.slug !== slug);
            await this.update({ [`customModifiers.${stat}`]: withRemoved });
        } else {
            throw ErrorPF2e("Custom modifiers can only be removed by slug (string) or index (number)");
        }
    }

    /**
     * Updates the party's campaign data. All data is scoped to system.campaign unless it is already in system.campaign.
     * Scoping to system.campaign is necessary for certain sheet listeners such as data-property.
     */
    async update(data: DeepPartial<KingdomSource> & Record<string, unknown>): Promise<void> {
        const expanded: DeepPartial<KingdomSource> & { system?: { campaign?: DeepPartial<KingdomSource> } } =
            fu.expandObject(data);

        const updateData = fu.mergeObject(expanded, expanded.system?.campaign ?? {});
        delete updateData.system;
        await this.actor.update({ "system.campaign": updateData });

        if (updateData.level) {
            await this.updateFeatures(updateData.level);
        }
    }

    /** Resets kingdom data preparation and re-renders all party actor sheets, which includes the kingmaker sheet */
    notifyUpdate = fu.debounce(() => {
        this.reset();
        this.prepareBaseData();
        this.prepareDerivedData();
        this.actor.render();
    }, 50);

    prepareBaseData(): void {
        const { synthetics } = this.actor;
        const { build } = this;

        // All friendly armies are gathered to determine consumption
        this.armies = game.actors.filter((a): a is ArmyPF2e<null> => a.isOfType("army") && a.alliance === "party");
        this.consumption.army = R.sumBy(this.armies, (a) => a.system.consumption);

        // Calculate Ability Boosts (if calculated automatically)
        if (!build.manual) {
            for (const ability of KINGDOM_ABILITIES) {
                this.abilities[ability].value = 0;
            }

            // Charter/Heartland/Government boosts
            for (const category of ["charter", "heartland", "government"] as const) {
                const data = build[category];
                const chosen = build.boosts[category];
                if (!data) continue;

                const activeBoosts = resolveKingdomBoosts(data, chosen);
                if (activeBoosts.length == 1) {
                    for (const ability of activeBoosts) {
                        this.abilities[ability].value += 4;
                    }
                } else {
                    for (const ability of activeBoosts) {
                        this.abilities[ability].value += 2;
                    }
                }

            }

            // Level boosts
            const activeLevels = KINGDOM_LEADERSHIP;
            for (const level of activeLevels) {
                const chosen = build.boosts[level].slice(0, 2);
                if (chosen.length == 1) {
                    for (const ability of chosen) {
                        this.abilities[ability].value += 4;
                    }
                } else {
                    for (const ability of chosen) {
                        this.abilities[ability].value += 2;
                    }
                }
            }
        }

        // Bless raw custom modifiers as `ModifierPF2e`s
        const customModifiers = (this.customModifiers ??= {});
        for (const selector of Object.keys(customModifiers)) {
            const modifiers = (customModifiers[selector] = customModifiers[selector].map(
                (rawModifier: RawModifier) => new ModifierPF2e(rawModifier),
            ));
            (synthetics.modifiers[selector] ??= []).push(...modifiers.map((m) => () => m));
        }

        this.sizeData =
            Object.entries(KINGDOM_SIZE_DATA).findLast(([size]) => this.size >= Number(size))?.[1] ??
            KINGDOM_SIZE_DATA[1];

        this.nationType = this.sizeData.type;

        // Auto-set if vacant (for npcs), and inject vacancy penalty modifiers and adjustments into synthetics
        for (const role of KINGDOM_LEADERSHIP) {
            const data = this.leadership[role];
            const actor = fromUuidSync(data.uuid ?? "");
            if (actor instanceof ActorPF2e) {
                if (!actor.hasPlayerOwner) data.vacant = false;
            } else {
                data.vacant = true;
            }

            if (data.vacant) {
                const penalties = VACANCY_PENALTIES[role]();
                for (const [selector, entries] of Object.entries(penalties.modifiers ?? {})) {
                    const modifiers = (synthetics.modifiers[selector] ??= []);
                    modifiers.push(...entries.map((e) => () => new ModifierPF2e(e)));
                }
            }
        }
        
        // Add a penalty due to unrest
        if (this.unrest.value > 0) {
            const modifiers = (synthetics.modifiers["kingdom-ability-check"] ??= []);
            modifiers.push(
                () =>
                    new ModifierPF2e({
                        slug: "unrest",
                        label: "PF2E.Kingmaker.Kingdom.Unrest",
                        modifier: -this.unrest.value,
                    }),
            );
        }

        const settlements = R.compact(Object.values(this.settlements));

        // Initialize settlement data
        for (const settlement of settlements) {
            if (!settlement) continue;
            const typeData = KINGDOM_SETTLEMENT_TYPE_DATA[settlement.type];
            for (const skill in KINGDOM_SKILLS) {
                const data = KINGDOM_SKILLS[skill];
                settlement.storage[data] = 0;
            }
            for (const skill in KINGDOM_SKILLS_SETTLEMENT) {
                const data = KINGDOM_SKILLS_SETTLEMENT[skill];
                settlement.storage[data] = typeData.modifiers * Object.keys(settlement.districts).length
            }
            settlement.storage["danger"] = typeData.danger * Object.keys(settlement.districts).length

            // Initialize settlement data
            const districts = R.compact(Object.values(settlement.districts));
            for (const district of districts) {
                if (!district) continue;
                KINGDOM_SETTLEMENT_GRID_BLOCKS.forEach((block) => {
                    KINGDOM_SETTLEMENT_GRID_LOTS.forEach((lot) => {
                        const building = district.grid[block][lot];
                        const document = fromUuidSync(building.uuid ?? "");                
                        const actor = document instanceof PhysicalItemPF2e ? document : null;
                        if (actor) {
                            if (actor.description.length > 40) {
                                const parser = new DOMParser();
                                const parsed = parser.parseFromString(actor.description, "text/html");

                                const tableBody = parsed.body.firstChild?.childNodes[2];
                                if (tableBody) {
                                    tableBody?.childNodes.forEach((entry) => {
                                        if (entry.childNodes[1] && entry.childNodes[3]){;
                                            const nodeType = <KingdomSkill>entry.childNodes[1].childNodes[0].nodeValue?.toLowerCase();
                                            const nodeValue = (Number)(entry.childNodes[3].childNodes[0].nodeValue);
                                            const nodeIsNumber = !isNaN(nodeValue);
                                            if ( KINGDOM_SKILLS.includes(nodeType!) && nodeIsNumber) {
                                                settlement.storage[nodeType!] += nodeValue;
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    });
                });
            }
            KINGDOM_SETTLEMENT_GRID_BORDERS.forEach((border) => {
                const data = settlement.borders[border];
                const document = fromUuidSync(data.uuid ?? "");                
                const actor = document instanceof PhysicalItemPF2e ? document : null;
                if (actor) {
                    if (actor.description.length > 40) {
                        const parser = new DOMParser();
                        const parsed = parser.parseFromString(actor.description, "text/html");

                        const tableBody = parsed.body.firstChild?.childNodes[2];
                        if (tableBody) {
                            tableBody?.childNodes.forEach((entry) => {
                                if (entry.childNodes[1] && entry.childNodes[3]){
                                    const nodeType = <KingdomSkill>entry.childNodes[1].childNodes[0].nodeValue?.toLowerCase();
                                    const nodeValue = (Number)(entry.childNodes[3].childNodes[0].nodeValue);
                                    const nodeIsNumber = !isNaN(nodeValue);
                                    if ( KINGDOM_SKILLS.includes(nodeType!) && nodeIsNumber) {
                                        settlement.storage[nodeType!] += nodeValue;
                                    }
                                }
                            });
                        }
                    }
                }
            });
            KINGDOM_SETTLEMENT_QUALITIES.forEach((quality) => {
                const data = settlement.qualities[quality];
                const document = fromUuidSync(data.uuid ?? "");                
                const actor = document instanceof PhysicalItemPF2e ? document : null;
                if (actor) {
                    if (actor.description.length > 40) {
                        const parser = new DOMParser();
                        const parsed = parser.parseFromString(actor.description, "text/html");

                        const tableBody = parsed.body.firstChild?.childNodes[2];
                        if (tableBody) {
                            tableBody?.childNodes.forEach((entry) => {
                                if (entry.childNodes[1] && entry.childNodes[3]){
                                    const nodeType = <KingdomSkill>entry.childNodes[1].childNodes[0].nodeValue?.toLowerCase();
                                    const nodeValue = (Number)(entry.childNodes[3].childNodes[0].nodeValue);
                                    const nodeIsNumber = !isNaN(nodeValue);
                                    if ( KINGDOM_SKILLS.includes(nodeType!) && nodeIsNumber) {
                                        settlement.storage[nodeType!] += nodeValue;
                                    }
                                }
                            });
                        }
                    }
                }
            });
        }

        //Inject Modifiers Size > Town > Improvements > Edicts
        const modifiersMaybeFame = (synthetics.modifiers[this.aspiration] ??= []);
        modifiersMaybeFame.push(
            () =>
                new ModifierPF2e({
                    slug: "Size",
                    label: "Size",
                    modifier: this.sizeData.inFame,
                })
        );

        // Inject control dc modifiers
        const modifiers = (synthetics.modifiers["control-dc"] ??= []);
        modifiers.push(
            () =>
                new ModifierPF2e({
                    slug: "size",
                    label: "Size Modifier",
                    modifier: this.size,
                })
        );
        modifiers.push(
            () =>
                new ModifierPF2e({
                    slug: "districts",
                    label: "Settlement Districts Modifier",
                    modifier: settlements.reduce((sum, current) => sum + Object.keys(current.districts).length, 0),
                })
        );

        const modifiersFame = (synthetics.modifiers["fame"] ??= []);
        modifiersFame.push(
            () =>
                new ModifierPF2e({
                    slug: "Settlements",
                    label: "Lore & Society",
                    modifier: Math.floor(settlements.reduce((sum, current) => sum + (current.storage['lore'] + current.storage['society'])/10, 0)),
                })
        );
        const modifiersInfame = (synthetics.modifiers["infamy"] ??= []);
        modifiersInfame.push(
            () =>
                new ModifierPF2e({
                    slug: "Settlements",
                    label: "Corruption & Crime",
                    modifier: Math.floor(settlements.reduce((sum, current) => sum + (current.storage['corruption'] + current.storage['crime'])/10, 0)),
                })
        );
        for (const settlement of settlements) {
            if (!settlement) continue;
            for (const skill in KINGDOM_SKILLS_KINGDOM) {
                const data = KINGDOM_SKILLS_KINGDOM[skill];
                const modifiers = (synthetics.modifiers[data] ??= []);
                modifiers.push(
                    () =>
                        new ModifierPF2e({
                            slug: data + settlement.name,
                            label: settlement.name,
                            modifier: settlement.storage[data],
                        })
                );
            }
        }
        for (const commodity of KINGDOM_COMMODITIES) {
            for (const [selector, entries] of Object.entries(KINGDOM_COMMODITIES_MODIFIERS[commodity]().modifiers ?? {})) {
                const modifiers = (synthetics.modifiers[selector] ??= []);
                entries.forEach((entry) => {
                    if (this.resources.workSites[commodity].value + this.resources.workSites[commodity].resource > 0) {
                        if (selector == 'consumption' && commodity == 'food') {
                            modifiers.push(
                                () =>
                                    new ModifierPF2e({
                                        slug: entry.slug,
                                        label: entry.label,
                                        modifier: entry.modifier * this.resources.workSites[commodity].value + entry.modifier * 1.5 * this.resources.workSites[commodity].resource
                                    })
                            )
                        } else {
                            modifiers.push(
                                () =>
                                    new ModifierPF2e({
                                        slug: entry.slug,
                                        label: entry.label,
                                        modifier: Math.floor(entry.modifier * this.resources.workSites[commodity].value + entry.modifier * 2 * this.resources.workSites[commodity].resource)
                                    })
                            )
                        }
                    }
                });
            }
        }
        KINGDOM_EDICTS.forEach((type) => {
            const edict = this.edicts[type];
            const data = KINGDOM_EDICT_DATA[type][edict];
            if (data.economy != 0) {
                const modifiers = (synthetics.modifiers["economy"] ??= []);
                modifiers.push(
                    () =>
                        new ModifierPF2e({
                            slug: type,
                            label: data.label,
                            modifier: data.economy,
                        })
                )
            }
            if (data.loyalty != 0) {
                const modifiers = (synthetics.modifiers["loyalty"] ??= []);
                modifiers.push(
                    () =>
                        new ModifierPF2e({
                            slug: type,
                            label: data.label,
                            modifier: data.loyalty,
                        })
                )
            }
            if (data.stability != 0) {
                const modifiers = (synthetics.modifiers["stability"] ??= []);
                modifiers.push(
                    () =>
                        new ModifierPF2e({
                            slug: type,
                            label: data.label,
                            modifier: data.stability,
                        })
                )
            }
            if (data.consumption != 0) {
                const modifiers = (synthetics.modifiers["consumption"] ??= []);
                modifiers.push(
                    () =>
                        new ModifierPF2e({
                            slug: type,
                            label: data.label,
                            modifier: data.consumption,
                        })
                )
            }
        });

    }

    prepareDerivedData(): void {
        const { synthetics } = this.actor;
        const { consumption} = this;

        // Assign Ability modifiers base on values
        for (const ability of KINGDOM_ABILITIES) {
            this.abilities[ability].mod = (this.abilities[ability].value);
        }

        const modifiersCon = (synthetics.modifiers["consumption"] ??= []);
        modifiersCon.push(
            () =>
                new ModifierPF2e({
                    slug: "Size",
                    label: "Size Modifier",
                    modifier: this.size,
                })
        );
        modifiersCon.push(
            () =>
                new ModifierPF2e({
                    slug: "Armies",
                    label: "Army Modifier",
                    modifier: consumption.army,
                })
        );

        // Calculate the control dc, used for skill checks
        const controlMod = 10;
        this.control = new Statistic(this.actor, {
            slug: "control",
            label: "PF2E.Kingmaker.Kingdom.ControlDC",
            domains: ["control-dc"],
            modifiers: [new ModifierPF2e({ slug: "base", label: "PF2E.ModifierTitle", modifier: controlMod })],
        });

        // Calculate all kingdom skills
        this.skills = R.mapToObj(KINGDOM_SKILLS, (skill) => {
            const ability = KINGDOM_SKILL_ABILITIES[skill];
            const rank = this.build.skills[skill].rank;
            var statistic;
            if (ability) {
                const abilityMod = this.abilities[ability].mod;
                const domains = ["kingdom-check", "kingdom-ability-check", `${ability}-based`, `${ability}-skill-check`, skill];
                statistic = new Statistic(this.actor, {
                    slug: skill,
                    rank,
                    label: KINGDOM_SKILL_LABELS[skill],
                    domains,
                    modifiers: [
                        new ModifierPF2e({
                            slug: ability,
                            label: KINGDOM_ABILITY_LABELS[ability],
                            modifier: abilityMod,
                            type: "ability",
                            adjustments: extractModifierAdjustments(synthetics.modifierAdjustments, domains, ability),
                        }),
                    ],
                    check: { type: "skill-check" },
                });
            } else {
                const domains = ["kingdom-check", skill];
                statistic = new Statistic(this.actor, {
                    slug: skill,
                    rank,
                    label: KINGDOM_SKILL_LABELS[skill],
                    domains,
                    modifiers: [
                    ],
                    check: { type: "skill-check" },
                });
            }

            return [skill, statistic];
        });

        consumption.value = Math.max(this.skills.consumption.mod, 0);

        // Create feat groups
        const evenLevels = new Array(this.level)
            .fill(0)
            .map((_, idx) => idx + 1)
            .filter((idx) => idx % 2 === 0);
        this.features = new FeatGroup(this.actor, {
            id: "features",
            label: "Kingdom Features",
            level: this.level,
        });
        this.feats = new FeatGroup(this.actor, {
            id: "kingdom",
            label: "Kingdom Feats",
            slots: [{ id: "government", label: "G" }, ...evenLevels],
            featFilter: ["traits-kingdom"],
            level: this.level,
        });
        this.bonusFeats = new FeatGroup(this.actor, {
            id: "bonus",
            label: "PF2E.FeatBonusHeader",
            featFilter: ["traits-kingdom"],
            level: this.level,
        });

        // Assign feats and features
        const allFeatures = this.actor.itemTypes.campaignFeature;
        const features = R.sortBy(
            allFeatures.filter((f) => f.isFeature),
            (f) => f.level ?? 1,
            (f) => f.name,
        );
        const feats = R.sortBy(
            allFeatures.filter((f) => f.isFeat),
            (f) => f.sort,
        );
        for (const feature of features) {
            this.features.assignFeat(feature);
        }
        for (const feat of feats) {
            if (!this.feats.assignFeat(feat)) {
                this.bonusFeats.assignFeat(feat);
            }
        }
    }

    getRollOptions(): string[] {
        const prefix = "kingdom";
        return R.compact([this.unrest.value ? `${prefix}:unrest:${this.unrest.value}` : null]);
    }

    getRollData(): Record<string, unknown> {
        return { kingdom: this };
    }

    async importActivities({ skipDialog = false }: { skipDialog?: boolean } = {}): Promise<void> {
        const pack = game.packs.get("pf2e.kingmaker-features");
        if (!pack) {
            throw ErrorPF2e("Could not load kingdom features compendium");
        }

        // Add any relevant kingdom features first
        await this.updateFeatures(this.level);

        const documents = (await pack.getDocuments({ type: "campaignFeature" }))
            .filter((d): d is CampaignFeaturePF2e<null> => d instanceof ItemPF2e && d.isOfType("campaignFeature"))
            .filter((d) => d.system.category === "kingdom-activity");

        await importDocuments(this.actor, documents, skipDialog);
    }

    /** Adds/removes kingdom features as appropriate. Private instead of # because # explodes */
    private async updateFeatures(level: number): Promise<void> {
        const existingFeatures = this.actor.itemTypes.campaignFeature.filter((f) => f.isFeature);
        const featuresToDelete = existingFeatures.filter((f) => (f.level ?? 0) > level).map((f) => f.id);

        const featuresToAdd = await (async () => {
            const pack = game.packs.get("pf2e.kingmaker-features");
            if (!pack) {
                console.error("PF2E System | Could not load kingdom features compendium");
                return [];
            }

            const documents = (await pack.getDocuments({ type: "campaignFeature" }))
                .filter((d): d is CampaignFeaturePF2e<null> => d instanceof ItemPF2e && d.isOfType("campaignFeature"))
                .filter((d) => d.system.category === "kingdom-feature")
                .filter((d) => level >= (d.level ?? 0));
            return documents
                .filter((d) => !this.actor.items.some((i) => i.sourceId === d.uuid))
                .map((i) => i.toObject());
        })();

        await this.actor.deleteEmbeddedDocuments("Item", featuresToDelete);
        await this.actor.createEmbeddedDocuments("Item", featuresToAdd);
    }

    getStatistic(slug: string): Statistic | null {
        if (this.skills && objectHasKey(this.skills, slug)) {
            return this.skills[slug] ?? null;
        }

        return null;
    }

    renderSheet(options: { tab?: string; type?: "builder" | null } = {}): void {
        if (options.type === "builder") {
            new KingdomBuilder(this).render(true);
        } else {
            new KingdomSheetPF2e(this.actor).render(true, { tab: options.tab });
        }
    }

    _preUpdate(changed: DeepPartial<KingdomSource>): void {
        const actor = this.actor;
        const feat = changed.build?.government?.feat;
        if (feat) {
            console.log("Replacing feat");
            fromUuid(feat).then(async (f) => {
                if (!(f instanceof CampaignFeaturePF2e)) return;
                const currentGovernmentFeat = actor.itemTypes.campaignFeature.find(
                    (f) => f.system.location === "government",
                );
                const newFeat = f.clone({ "system.location": "government" });
                await currentGovernmentFeat?.delete();
                await actor.createEmbeddedDocuments("Item", [newFeat.toObject()]);
            });
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Kingdom extends ModelPropsFromSchema<KingdomSchema> {}

export { Kingdom };
