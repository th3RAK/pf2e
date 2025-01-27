import { ActorPF2e, ArmyPF2e, CreaturePF2e, type PartyPF2e } from "@actor";
import type { FeatGroup } from "@actor/character/feats/index.ts";
import { MODIFIER_TYPES } from "@actor/modifiers.ts";
import { ActorSheetPF2e, SheetClickActionHandlers } from "@actor/sheet/base.ts";
import { ActorSheetDataPF2e } from "@actor/sheet/data-types.ts";
import { ItemPF2e, type CampaignFeaturePF2e, PhysicalItemPF2e } from "@item";
import { ItemSourcePF2e } from "@item/base/data/index.ts";
import { EquipmentPF2e } from "@item/equipment/index.ts";
import { DropCanvasItemDataPF2e } from "@module/canvas/drop-canvas-data.ts";
import { ChatMessagePF2e } from "@module/chat-message/document.ts";
import { ValueAndMax } from "@module/data.ts";
import {
    AdjustedValue,
    SheetOption,
    SheetOptions,
    createSheetTags,
    getAdjustedValue,
} from "@module/sheet/helpers.ts";
import { SocketMessage } from "@scripts/socket.ts";
import { Statistic } from "@system/statistic/index.ts";
import {
    ErrorPF2e,
    SORTABLE_BASE_OPTIONS,
    createHTMLElement,
    htmlClosest,
    htmlQuery,
    htmlQueryAll,
    setHasElement,
    tupleHasValue,
} from "@util";
import { eventToRollParams } from "@util/sheet.ts";
import * as R from "remeda";
import Sortable from "sortablejs";
import { KingdomBuilder } from "./builder.ts";
import { calculateKingdomCollectionData, calculateKingdomStabilizationData } from "./helpers.ts";
import { Kingdom } from "./model.ts";
import {
    KingdomAbilityData,
    KingdomEdict,
    KingdomLeadershipData,
    KingdomSettlementData,
    KingdomSettlementGridBlock,
    KingdomSettlementGridLot,
    KingdomSettlementGridData,
    KingdomSource,
    KingdomSettlementQuality,
    KingdomSettlementGridBorder,
    KingdomSkillSettlement,
    KingdomDistrictData,
} from "./types.ts";
import {
    KINGDOM_ABILITIES,
    KINGDOM_ABILITY_LABELS,
    KINGDOM_COMMODITIES,
    KINGDOM_COMMODITY_DESCRIPTIONS,
    KINGDOM_COMMODITY_LABELS,
    KINGDOM_EDICT_DATA,
    KINGDOM_LEADERSHIP,
    KINGDOM_LEADERSHIP_ABILITIES,
    KINGDOM_LEADERSHIP_DESCRIPTIONS,
    KINGDOM_RUIN_LABELS,
    KINGDOM_SETTLEMENT_GRID_BLOCKS,
    KINGDOM_SETTLEMENT_GRID_BORDERS,
    KINGDOM_SETTLEMENT_GRID_LOTS,
    KINGDOM_SETTLEMENT_QUALITIES,
    KINGDOM_SETTLEMENT_TYPE_DATA,
    KINGDOM_SETTLEMENT_TYPE_LABELS,
    KINGDOM_SKILLS,
    KINGDOM_SKILLS_SETTLEMENT,
    KINGDOM_SKILL_DESCRIPTIONS,
    KINGDOM_SKILL_LABELS,
    KingdomEdictData,
} from "./values.ts";

// Kingdom traits in order of when the phases occur in the process
const KINGDOM_TRAITS = ["upkeep", "edict", "income", "event"] as const;
class KingdomSheetPF2e extends ActorSheetPF2e<PartyPF2e> {
    /** The current selected activity filter, which doubles as an active kingdom phase */
    protected selectedFilter: string | null = null;

    /** HTML element to focus on a re-render, such as when new elements are added */
    protected focusElement: string | null = null;

    #editingSettlements: Record<string, boolean> = {};

    constructor(actor: PartyPF2e, options?: Partial<ActorSheetOptions>) {
        super(actor, options);
    }

    get kingdom(): Kingdom {
        const campaign = this.actor.campaign;
        if (!(campaign instanceof Kingdom)) {
            this.close();
            throw ErrorPF2e("Only actors with kingdom data is supported");
        }

        return campaign;
    }

    override get title(): string {
        return this.kingdom.name;
    }

    static override get defaultOptions(): ActorSheetOptions {
        const options = super.defaultOptions;

        return {
            ...options,
            classes: [...options.classes, "kingdom"],
            width: 750,
            height: 620,
            template: "systems/pf2e/templates/actors/party/kingdom/sheet.hbs",
            scrollY: [...options.scrollY, ".tab.active", ".tab.active .content", ".sidebar"],
            tabs: [
                {
                    navSelector: "form > nav",
                    contentSelector: ".container",
                    initial: "main",
                },
            ],
        };
    }

    protected override _getHeaderButtons(): ApplicationHeaderButton[] {
        const buttons = super._getHeaderButtons();
        if (game.user.isGM) {
            buttons.unshift({
                label: "JOURNAL.ActionShow",
                class: "show-sheet",
                icon: "fa-solid fa-eye",
                onclick: () => {
                    const users = game.users.filter((u) => !u.isSelf);
                    game.socket.emit("system.pf2e", {
                        request: "showSheet",
                        users: users.map((u) => u.uuid),
                        document: this.actor.uuid,
                        options: {
                            campaign: true,
                            tab: this._tabs[0].active,
                        },
                    } satisfies SocketMessage);
                },
            });
        }

        return buttons;
    }

    override async getData(options?: ActorSheetOptions): Promise<KingdomSheetData> {
        const data = await super.getData(options);
        const kingdom = this.kingdom;

        const settlementEntries = R.sortBy(
            Object.entries(this.kingdom.settlements).filter((e): e is [string, KingdomSettlementData] => !!e[1]),
            (e) => e[1].sort,
        );

        return {
            ...data,
            actor: this.actor,
            kingdom: this.kingdom,
            nationTypeLabel: game.i18n.localize(`PF2E.Kingmaker.Kingdom.NationType.${kingdom.nationType}`),
            abilities: KINGDOM_ABILITIES.map((slug) => {
                return {
                    ...this.kingdom.abilities[slug],
                    slug,
                    label: game.i18n.localize(KINGDOM_ABILITY_LABELS[slug]),
                    ruinLabel: game.i18n.localize(KINGDOM_RUIN_LABELS[slug]),
                };
            }),
            commodities: KINGDOM_COMMODITIES.map((type) => ({
                ...kingdom.resources.commodities[type],
                type,
                label: game.i18n.localize(KINGDOM_COMMODITY_LABELS[type]),
                workSites: {
                    label: KINGDOM_COMMODITY_LABELS[type],
                    description: KINGDOM_COMMODITY_DESCRIPTIONS[type],
                    hasResource: ["food","fish","lumber", "ore", "stone","landmark"].includes(type),
                    value: kingdom.resources.workSites[type].value,
                    resource: kingdom.resources.workSites[type].resource,
                },
            })),
            leadership: KINGDOM_LEADERSHIP.map((slug) => {
                const data = this.kingdom.leadership[slug];
                const document = fromUuidSync(data.uuid ?? "");
                const actor = document instanceof ActorPF2e ? document : null;
                return {
                    ...data,
                    slug,
                    label: slug.capitalize(),
                    description: KINGDOM_LEADERSHIP_DESCRIPTIONS[slug],
                    actor,
                    img: actor?.prototypeToken.texture.src ?? actor?.img ?? ActorPF2e.DEFAULT_ICON,
                    abilityLabel: game.i18n.localize(KINGDOM_ABILITY_LABELS[KINGDOM_LEADERSHIP_ABILITIES[slug]]),
                    penaltyLabel: "Vacancy: " + slug,
                };
            }),
            actions: R.sortBy(kingdom.activities, (a) => a.name).map((item) => ({
                item,
                traits: createSheetTags(
                    CONFIG.PF2E.kingmakerTraits,
                    item.system.traits.value.filter((t) => t !== "downtime"),
                ),
            })),
            skills: Object.values(this.kingdom.skills),
            feats: [kingdom.features, kingdom.feats, kingdom.bonusFeats],
            actionFilterChoices: KINGDOM_TRAITS.map((trait) => ({
                label: trait,
                value: trait,
                selected: false, // selected is handled without re-render
            })),
            armies: await this.#prepareArmies(),
            settlements: await Promise.all(
                settlementEntries.map(async ([id, data]) => {
                    return this.#prepareSettlement(id, data!);
                }),
            ),
            eventText: await TextEditor.enrichHTML(kingdom.event.text, {
                rollData: this.actor.getRollData(),
            }),
            edictTypes: KINGDOM_EDICT_DATA,
            settlementTypes: KINGDOM_SETTLEMENT_TYPE_LABELS,
            abilityLabels: KINGDOM_ABILITY_LABELS,
            skillLabels: KINGDOM_SKILL_LABELS,
            proficiencyOptions: Object.values(CONFIG.PF2E.proficiencyRanks).map((label, i) => ({
                value: i.toString(),
                label,
            })),
        };
    }
    
    async #prepareDistrict(id: string, district: KingdomDistrictData, settlement_id: string): Promise<DistrictSheetData> { 
        return {
            //...district,
            id,
            grid: KINGDOM_SETTLEMENT_GRID_BLOCKS.map((block) => {
                const data2 = district.grid[block];
                const lots = KINGDOM_SETTLEMENT_GRID_LOTS.map((lot) => {
                    const data = district.grid[block][lot];
                    const document = fromUuidSync(data.uuid ?? "");                    
                    const actor = document instanceof EquipmentPF2e ? document : null;
                    var label ="";
                    if (actor) {
                        label = actor.name;
                    }
                    return {
                        ...data,
                        slug: lot,
                        block,
                        district: id,
                        settlement: settlement_id,
                        label,
                        actor,
                        img: actor?.img ?? ActorPF2e.DEFAULT_ICON,
                    };
                });
                return {
                    ...data2,
                    block,
                    lots: lots,
                };
            }),
        };
    }

    protected override _configureProseMirrorPlugins(
        name: string,
        options: { remove?: boolean },
    ): Record<string, ProseMirror.Plugin> {
        const plugins = super._configureProseMirrorPlugins(name, options);
        plugins.menu = foundry.prosemirror.ProseMirrorMenu.build(foundry.prosemirror.defaultSchema, {
            destroyOnSave: options.remove,
            onSave: () => this.saveEditor(name, options),
            compact: true,
        });
        return plugins;
    }

    async #prepareArmies(): Promise<ArmySheetData[]> {
        const data = this.kingdom.armies.map(async (a) => ({
            document: a,
            link: await TextEditor.enrichHTML(a.link),
            consumption: getAdjustedValue(a.system.consumption, a._source.system.consumption, {
                better: "lower",
            }),
        }));

        const dataResolved = await Promise.all(data);
        return dataResolved.sort((a, b) => a.document.name.localeCompare(b.document.name));
    }

    async #prepareSettlement(id: string, settlement: KingdomSettlementData): Promise<SettlementSheetData> {
        const data = KINGDOM_SETTLEMENT_TYPE_DATA[settlement.type];

        const lotRange = data.lots[1] === Infinity ? `${data.lots[0]}+` : data.lots[0]===data.lots[1] ?  `${data.lots[0]}` : data.lots.join("-");
        const levelRange =
            data.level[1] === Infinity
                ? `${data.level[0]}+`
                : data.level[0] === data.level[1]
                  ? String(data.level[0])
                  : data.level.join("-");
        const populationRange = data.population[1] === Infinity ? `${data.population[0]}+` : data.population.join("-");

        const districtEntries = R.pipe(
            Object.entries(settlement.districts),
            R.filter((entry): entry is [string, KingdomDistrictData] => !!entry[1]),
        );

        return {
            ...settlement,
            id,
            description: await TextEditor.enrichHTML(settlement.description, {
                rollData: this.actor.getRollData(),
            }),
            editing: this.#editingSettlements[id] ?? false,
            //blocks: data.blocks === Infinity ? "10+" : data.blocks,
            lotRange,
            populationRange,
            levelRange,
            typeLabel: KINGDOM_SETTLEMENT_TYPE_LABELS[settlement.type],
            districts: await Promise.all(
                districtEntries.map(async ([districtdId, data]) => {
                    return this.#prepareDistrict(districtdId, data!, id);
                }),
            ),
            qualities: KINGDOM_SETTLEMENT_QUALITIES.map((quality) => {
                const data = settlement.qualities[quality];
                const document = fromUuidSync(data.uuid ?? "");                    
                const actor = document instanceof EquipmentPF2e ? document : null;
                var label ="";
                if (actor) {
                    label = actor.name;
                }
                return {
                    ...data,
                    slug: quality,
                    settlement: id,
                    label,
                    actor,
                    img: actor?.img ?? ActorPF2e.DEFAULT_ICON,
                };
            }),
            maxQualities: data.qualities,
            borders: KINGDOM_SETTLEMENT_GRID_BORDERS.map((border) => {
                const data = settlement.borders[border];
                const document = fromUuidSync(data.uuid ?? "");                    
                const actor = document instanceof EquipmentPF2e ? document : null;
                var label ="";
                if (actor) {
                    label = actor.name;
                }
                return {
                    ...data,
                    slug: border,
                    settlement: id,
                    label,
                    actor,
                    img: actor?.img ?? ActorPF2e.DEFAULT_ICON,
                };
            }),
            storage: KINGDOM_SKILLS.map((type) => {
                let value;
                if (type != 'basevalue') {
                    if (KINGDOM_SKILLS_SETTLEMENT.includes(<KingdomSkillSettlement>type)) {
                        value = settlement.storage[type] + this.kingdom.skills[type].mod;
                    } else {
                        value = settlement.storage[type];
                    }
                } else {
                    value = Math.min(settlement.storage[type], data.baseValueMax);
                }
                return {
                    type,
                    value,
                    label: KINGDOM_SKILL_LABELS[type],
                    description: KINGDOM_SKILL_DESCRIPTIONS[type],
                };
            }),
        };
    }

    override activateListeners($html: JQuery<HTMLElement>): void {
        super.activateListeners($html);
        const html = $html[0];

        // If a settlement name needs to be focused (such as when a new list item is created), do so
        if (this.focusElement) {
            htmlQuery(html, this.focusElement)?.focus();
            this.focusElement = null;
        }

        // Add open sheet links
        for (const openSheetLink of htmlQueryAll(html, "[data-action=open-sheet]")) {
            const actorUUID = htmlClosest(openSheetLink, "[data-actor-uuid]")?.dataset.actorUuid;
            const actor = fromUuidSync(actorUUID ?? "");
            openSheetLink.addEventListener("click", () => actor?.sheet.render(true));
        }

        for (const button of htmlQueryAll(html, "[data-action=builder]")) {
            const tab = button.dataset.tab ?? null;
            button.addEventListener("click", () => {
                new KingdomBuilder(this.kingdom).render(true, { tab });
            });
        }

        // Data binding for leader roles
        for (const leader of htmlQueryAll(html, ".leader[data-role]")) {
            const { role, uuid } = leader.dataset;
            htmlQuery(leader, "[data-action=remove-leader]")?.addEventListener("click", () => {
                this.kingdom.update({ [`leadership.${role}`]: null });
            });

            if (uuid) {
                for (const clickable of htmlQueryAll(leader, "[data-action=open-sheet]")) {
                    clickable.addEventListener("click", async () => {
                        const actor = await fromUuid(uuid);
                        actor?.sheet.render(true);
                    });
                }
            }

            const vacantEl = htmlQuery(leader, ".vacant[title]");
            if (vacantEl) {
                const lines = vacantEl.title.split(/;\s*/).map((l) => createHTMLElement("li", { children: [l] }));
                const content = createHTMLElement("ul", { children: lines });
                $(vacantEl).tooltipster({
                    content,
                    contentAsHTML: true,
                    side: "right",
                    theme: "crb-hover",
                });
            }
        }

        // Implement events for rollable statistics
        for (const rollableStat of htmlQueryAll(html, ".rollable")) {
            const statSlug = htmlClosest(rollableStat, "[data-statistic]")?.dataset.statistic;
            if (!statSlug) continue;

            rollableStat.addEventListener("click", (event) => {
                const statistic = this.actor.getStatistic(statSlug);
                statistic?.roll(eventToRollParams(event, { type: "check"}));
            });
        }

        htmlQuery(html, "[data-action=collect]")?.addEventListener("click", async () => {
            ChatMessagePF2e.create({
                speaker: {
                    ...ChatMessagePF2e.getSpeaker(this.actor),
                    alias: this.kingdom.name,
                },
                content: await renderTemplate("systems/pf2e/templates/actors/party/kingdom/collection.hbs", {
                    ...calculateKingdomCollectionData(this.kingdom),
                }),
            });
        });

        htmlQuery(html, "[data-action=stabilize]")?.addEventListener("click", async () => {
            ChatMessagePF2e.create({
                speaker: {
                    ...ChatMessagePF2e.getSpeaker(this.actor),
                    alias: this.kingdom.name,
                },
                content: await renderTemplate("systems/pf2e/templates/actors/party/kingdom/determineStability.hbs", {
                    ...calculateKingdomStabilizationData(this.kingdom),
                }),
            });
        });

        htmlQuery(html, "[data-action=payConsumption]")?.addEventListener("click", async () => {
            ChatMessagePF2e.create({
                speaker: {
                    ...ChatMessagePF2e.getSpeaker(this.actor),
                    alias: this.kingdom.name,
                },
                content: await renderTemplate("systems/pf2e/templates/actors/party/kingdom/payConsumption.hbs", {
                    consumption: this.kingdom.consumption,
                    points: this.kingdom.resources.points,
                }),
            });
        });

        // Handle action filters
        this.filterActions(this.selectedFilter, { instant: true });
        htmlQuery(html, ".filters")?.addEventListener("click", (event) => {
            const filterButton = htmlClosest(event.target, ".choice");
            if (!filterButton) return;

            this.filterActions(filterButton.dataset.slug ?? null);
        });

        $html.find("[data-tooltip-content]").tooltipster({
            trigger: "click",
            arrow: false,
            contentAsHTML: true,
            debug: BUILD_MODE === "development",
            interactive: true,
            side: ["right", "bottom"],
            theme: "crb-hover",
            minWidth: 120,
        });

        // Handle adding and inputting custom user submitted modifiers
        for (const customModifierEl of htmlQueryAll(html, ".modifiers-tooltip")) {
            const stat = customModifierEl.dataset.stat;
            if (!stat) continue;

            for (const removeButton of htmlQueryAll(customModifierEl, "[data-action=remove-modifier]")) {
                const slug = removeButton.dataset.slug ?? "";
                removeButton.addEventListener("click", () => {
                    this.kingdom.removeCustomModifier(stat, slug);
                });
            }

            const modifierValueEl = htmlQuery<HTMLInputElement>(customModifierEl, ".add-modifier input[type=number]");
            htmlQuery(customModifierEl, "[data-action=increment]")?.addEventListener("click", () => {
                modifierValueEl?.stepUp();
            });
            htmlQuery(customModifierEl, "[data-action=decrement]")?.addEventListener("click", () => {
                modifierValueEl?.stepDown();
            });

            htmlQuery(customModifierEl, "[data-action=create-custom-modifier]")?.addEventListener("click", () => {
                const modifier = modifierValueEl?.valueAsNumber || 1;
                const type = htmlQuery<HTMLSelectElement>(customModifierEl, ".add-modifier-type")?.value ?? "";
                const label =
                    htmlQuery<HTMLInputElement>(customModifierEl, ".add-modifier-name")?.value?.trim() ??
                    game.i18n.localize(`PF2E.ModifierType.${type}`);
                if (!setHasElement(MODIFIER_TYPES, type)) {
                    ui.notifications.error("Type is required.");
                    return;
                }

                this.kingdom.addCustomModifier(stat, { label, modifier, type });
            });
        }

        // Add settlement and individual settlement actions
        htmlQuery(html, "[data-action=add-settlement]")?.addEventListener("click", () => {
            const id = fu.randomID();
            this.#editingSettlements[id] = true;
            this.focusElement = `[name="settlements.${id}.name"]`;
            this.kingdom.update({ [`settlements.${id}`]: {} });
        });
        for (const settlementElement of htmlQueryAll(html, ".settlement")) {
            this.#activateSettlementEvents(settlementElement);
        }

        for (const link of htmlQueryAll(html, "[data-action=browse-feats]")) {
            const maxLevel = Number(link.dataset.level) || this.kingdom.level;

            link.addEventListener("click", async () => {
                const compendiumTab = game.pf2e.compendiumBrowser.tabs.campaignFeature;
                const filter = await compendiumTab.getFilterData();

                // Configure level filters
                const levels = filter.sliders.level;
                levels.values.max = Math.min(maxLevel, levels.values.upperLimit);
                levels.isExpanded = levels.values.max !== levels.values.upperLimit;

                // Set category
                filter.checkboxes.category.options["kingdom-feat"].selected = true;
                filter.checkboxes.category.selected.push("kingdom-feat");
                filter.checkboxes.category.isExpanded = true;

                compendiumTab.open(filter);
            });
        }

        htmlQuery(html, "[data-action=random-event]")?.addEventListener("click", () => {
            const stat = new Statistic(this.actor, {
                slug: "random-event",
                label: "Random Kingdom Event",
                check: {
                    type: "flat-check",
                },
            });

            stat.roll({ dc: this.kingdom.event.dc }).then(result => {
                if(result?.degreeOfSuccess) {
                    if(result?.degreeOfSuccess >= 2) {
                        this.kingdom.update({ event: { dc: 16 } });
                    } else {
                        this.kingdom.update({ event: { dc: 6 } });
                    }
                }
            });
        });

        htmlQuery(html, "[data-action=reset-event-dc]")?.addEventListener("click", () => {
            this.kingdom.update({ event: { dc: 16 } });
        });

        // Sort settlements
        const settlementList = htmlQuery(html, ".settlement-list");
        if (settlementList) {
            Sortable.create(settlementList, {
                ...SORTABLE_BASE_OPTIONS,
                handle: ".drag-handle",
                onEnd: (event) => {
                    const settlements = this.kingdom.settlements as Record<string, KingdomSettlementData>;
                    const settlementsWithIds = Object.entries(settlements).map(([id, value]) => ({ id, ...value }));
                    const settlement = settlementsWithIds.find((s) => s.id === event.item.dataset.settlementId);
                    const newIndex = event.newDraggableIndex;
                    if (!settlement || newIndex === undefined) {
                        this.render();
                        return;
                    }

                    // Perform the resort and update
                    const siblings = R.sortBy(
                        settlementsWithIds.filter((s) => s !== settlement),
                        (s) => s.sort,
                    );
                    siblings.splice(newIndex, 0, settlement);
                    const updates = R.mapToObj(siblings, (s, index) => [`settlements.${s.id}.sort`, index]);
                    this.kingdom.update(updates);
                },
            });
        }
    }

    protected override activateClickListener(html: HTMLElement): SheetClickActionHandlers {
        const handlers = super.activateClickListener(html);

        handlers["create-feat"] = () => {
            this.actor.createEmbeddedDocuments("Item", [
                {
                    name: game.i18n.localize(CONFIG.PF2E.featCategories.bonus),
                    type: "campaignFeature",
                    system: {
                        campaign: "kingmaker",
                        category: "kingdom-feat",
                    },
                },
            ]);
        };

        return handlers;
    }

    /** Activate sheet events for a signle settlement */
    #activateSettlementEvents(settlementElement: HTMLElement) {
        const id = settlementElement.dataset.settlementId ?? null;
        if (id === null) return;

        const rerenderSettlement = async () => {
            const settlement = this.kingdom.settlements[id];
            if (!settlement) return;

            const newHTML = await renderTemplate(
                "systems/pf2e/templates/actors/party/kingdom/partials/settlement.hbs",
                {
                    ...(await this.getData()),
                    settlement: await this.#prepareSettlement(id, settlement),
                },
            );

            // Create the new settlement and replace the current one. We'll also need to re-listen to it.
            // activateListeners() handles both rich text editing and expanding the item summary
            const newElement = createHTMLElement("div", { innerHTML: newHTML }).firstElementChild;
            if (newElement instanceof HTMLElement) {
                // Preserve item summary expanded state
                const isExpanded = !htmlQuery(settlementElement, ".item-summary")?.hidden;
                htmlQuery(newElement, ".item-summary")!.hidden = !isExpanded;

                // Perform replacement and activate listeners
                settlementElement.replaceWith(newElement);
                super.activateListeners($(newElement));
                this.#activateSettlementEvents(newElement);

                // If we're editing, ensure it opens
                if (this.#editingSettlements[id]) {
                    this.itemRenderer.toggleSummary(newElement, { visible: true });
                }
            }
        };

        htmlQuery(settlementElement, "[data-action=edit-settlement]")?.addEventListener("click", () => {
            this.#editingSettlements[id] = true;
            rerenderSettlement();
        });
        htmlQuery(settlementElement, "[data-action=finish-settlement]")?.addEventListener("click", async () => {
            this.#editingSettlements[id] = false;
            rerenderSettlement();
        });
        htmlQuery(settlementElement, "[data-action=delete-settlement]")?.addEventListener("click", async (event) => {
            const settlement = this.kingdom.settlements[id];
            if (!settlement) return;
            const result =
                event?.ctrlKey ||
                (await Dialog.confirm({
                    title: game.i18n.localize("PF2E.DeleteItemTitle"),
                    content: `<p>${game.i18n.format("PF2E.DeleteQuestion", { name: `"${settlement.name}"` })}</p>`,
                }));
            if (result) {
                this.kingdom.update({ [`settlements.-=${id}`]: null });
            }
        });
        // Add district actions
        htmlQuery(settlementElement, "[data-action=add-district]")?.addEventListener("click", async (event) => {
            const settlement = this.kingdom.settlements[id];
            if (!settlement) return;
            const districtId = fu.randomID(16);
            const result =
            event?.ctrlKey ||
            (await Dialog.confirm({
                title: game.i18n.localize("PF2E.DeleteItemTitle"),
                content: `<p>${game.i18n.format("PF2E.DeleteQuestion", { name: `"${settlement.name}"` })}</p>`,
            }));
            if (result) {
                this.kingdom.update({ [`settlements.${id}.districts.${districtId}`]: {} });
                rerenderSettlement();
            }
            
        });

        // Data binding for settlement qualities
        for (const data of htmlQueryAll(settlementElement, ".quality[data-quality]")) {
            const { quality, settlement, uuid } = data.dataset;

            htmlQuery(data, "[data-action=remove-quality]")?.addEventListener("click", () => {
                this.kingdom.update({ [`settlements.${settlement}.qualities.${quality}.uuid`]: null });
            });

            if (uuid) {
                for (const clickable of htmlQueryAll(data, "[data-action=open-sheet]")) {
                    clickable.addEventListener("click", async () => {
                        const quality = await fromUuid(uuid);
                        quality?.sheet.render(true);
                    });
                }
            }
        }
        // Data binding for settlement grid
        for (const data of htmlQueryAll(settlementElement, ".lot[data-lot]")) {
            const { lot, block, district, settlement, uuid } = data.dataset;

            htmlQuery(data, "[data-action=remove-lot]")?.addEventListener("click", () => {
                this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.${lot}.uuid`]: null });
            });

            if (uuid) {
                for (const clickable of htmlQueryAll(data, "[data-action=open-sheet]")) {
                    clickable.addEventListener("click", async () => {
                        const lot = await fromUuid(uuid);
                        lot?.sheet.render(true);
                    });
                }
            }
        }
        for (const data of htmlQueryAll(settlementElement, ".border[data-border]")) {
            const { border, settlement, uuid } = data.dataset;

            htmlQuery(data, "[data-action=remove-border]")?.addEventListener("click", () => {
                this.kingdom.update({ [`settlements.${settlement}.borders.${border}.uuid`]: null });
            });

            if (uuid) {
                for (const clickable of htmlQueryAll(data, "[data-action=open-sheet]")) {
                    clickable.addEventListener("click", async () => {
                        const border = await fromUuid(uuid);
                        border?.sheet.render(true);
                    });
                }
            }
        }
    }

    protected filterActions(trait: string | null, options: { instant?: boolean } = {}): void {
        const html = this.element.get(0);
        const duration = 0.4;
        this.selectedFilter = trait;

        const animateElement = (element: HTMLElement, visible: boolean) => {
            if (options.instant) {
                element.hidden = !visible;
            } else if (visible && element.hidden) {
                gsap.fromTo(
                    element,
                    { height: 0, opacity: 0, hidden: false },
                    { height: "auto", opacity: 1, duration },
                );
            } else if (!visible && !element.hidden) {
                gsap.to(element, {
                    height: 0,
                    duration,
                    opacity: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    margin: 0,
                    clearProps: "all",
                    onComplete: () => {
                        element.hidden = true;
                        this.itemRenderer.toggleSummary(element, { visible: false, instant: true });
                    },
                });
            }
        };

        // Set and animate visibility of the different action types
        for (const action of this.kingdom.activities) {
            const element = htmlQuery(html, `[data-item-id="${action.id}"]`);
            const visible = !trait || tupleHasValue(action.system.traits.value, trait);
            if (!element) continue;
            animateElement(element, visible);
        }

        // Set and animate phases
        for (const summary of htmlQueryAll(html, ".phase-summary")) {
            animateElement(summary, summary.dataset.phase === trait);
        }

        // Set active toggle
        for (const choice of htmlQueryAll(html, ".filters .choice")) {
            const active = choice.dataset.slug ? choice.dataset.slug === trait : trait === null;
            choice.classList.toggle("active", active);
        }

        // Scroll to top so that the Activity Phase summary is visible
        const actionsList = htmlQuery(html, ".actions-list");
        if (actionsList) {
            actionsList.scrollTop = 0;
        }
    }

    protected override async _onDropItem(event: DragEvent, data: DropCanvasItemDataPF2e): Promise<ItemPF2e[]> {
        const item = await ItemPF2e.fromDropData(data);
        if (!item) throw ErrorPF2e("Unable to create item from drop data!");

        // If the actor is the same, call the parent method, which will eventually call the sort instead
        if (this.actor.uuid === item.parent?.uuid) {
            return super._onDropItem(event, data);
        }

        if (item?.isOfType("campaignFeature") && (item.isFeat || item.isFeature)) {
            const slotData = this.#getFeatSlotData(event) ?? { groupId: "bonus", slotId: null };
            const group = slotData.groupId === "bonus" ? this.kingdom.bonusFeats : this.kingdom.feats;
            return group.insertFeat(item, slotData.slotId);
        }

        if (item instanceof PhysicalItemPF2e){
            const closestLot = htmlClosest(event.target, ".lot[data-lot]");
            const closestQuality = htmlClosest(event.target, ".quality[data-quality]");
            const closestBorder = htmlClosest(event.target, ".border[data-border]");
            if (closestLot) {
                const settlement = String(closestLot.dataset.settlement);
                const district = String(closestLot.dataset.district);
                const block = <KingdomSettlementGridBlock>String(closestLot.dataset.block);
                const lot = <KingdomSettlementGridLot>String(closestLot.dataset.lot);
                const uuid = item.uuid;
                
                console.log(district);
                console.log(settlement);
                console.log(this.kingdom);
                console.log(this.kingdom.settlements[settlement]);
                console.log(this.kingdom.settlements[settlement]!.districts);
                console.log(this.kingdom.settlements[settlement]!.districts[district]);
                const top = fromUuidSync(this.kingdom.settlements[settlement]!.districts[district]!.grid[block][0].uuid as ActorUUID);
                const bottom = fromUuidSync(this.kingdom.settlements[settlement]!.districts[district]!.grid[block][2].uuid as ActorUUID);
                if (top instanceof PhysicalItemPF2e) {
                    if ((top.size == "lg"  && Number(lot) == 1) || top.size == "huge") {
                        this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.0.uuid`]: null });
                    }
                }
                if (bottom instanceof PhysicalItemPF2e) {
                    if (bottom.size == "lg" && Number(lot) == 3) {
                        this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.2.uuid`]: null });
                    }
                }

                if (item.size == "huge") {
                    KINGDOM_SETTLEMENT_GRID_LOTS.forEach(l => this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.${l}.uuid`]: null }))
                    this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.0.uuid`]: uuid });
                } else if (item.size == "lg") {
                    if (Number(lot) % 2 == 0) {
                        this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.${lot}.uuid`]: uuid });
                        this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.${Number(lot) + 1}.uuid`]: null });
                    } else {
                        this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.${Number(lot) - 1}.uuid`]: uuid });
                    }
                } else {
                    this.kingdom.update({ [`settlements.${settlement}.districts.${district}.grid.${block}.${lot}.uuid`]: uuid });
                }

                const changed: PhysicalItemPF2e<ActorPF2e>[] = [];
                return changed;
            } else if (closestQuality) {
                const settlement = String(closestQuality.dataset.settlement);
                const quality = <KingdomSettlementGridBlock>String(closestQuality.dataset.quality);
                const uuid = item.uuid;
                this.kingdom.update({ [`settlements.${settlement}.qualities.${quality}.uuid`]: uuid });
                const changed: PhysicalItemPF2e<ActorPF2e>[] = [];
                return changed;
            } else if (closestBorder) {
                const settlement = String(closestBorder.dataset.settlement);
                const border = <KingdomSettlementGridBlock>String(closestBorder.dataset.border);
                const uuid = item.uuid;
                this.kingdom.update({ [`settlements.${settlement}.borders.${border}.uuid`]: uuid });
                const changed: PhysicalItemPF2e<ActorPF2e>[] = [];
                return changed;
            }
        }

        return super._onDropItem(event, data);
    }

    /** Handle a drop event for an existing Owned Item to sort that item */
    protected override async _onSortItem(event: DragEvent, itemData: ItemSourcePF2e): Promise<ItemPF2e[]> {
        const item = this.actor.items.get(itemData._id!);
        if (item?.isOfType("campaignFeature") && (item.isFeat || item.isFeature)) {
            const featSlot = this.#getFeatSlotData(event);
            if (!featSlot) return [];

            const group = featSlot.groupId === "bonus" ? this.kingdom.bonusFeats : this.kingdom.feats;
            const resorting = item.group === group && !group?.slotted;
            if (group?.slotted && !featSlot.slotId) {
                return [];
            } else if (!resorting) {
                return group.insertFeat(item, featSlot.slotId);
            }
        }

        return super._onSortItem(event, itemData);
    }

    protected override async _onDropActor(
        event: DragEvent,
        data: DropCanvasData<"Actor", PartyPF2e>,
    ): Promise<false | void> {
        await super._onDropActor(event, data);

        const actor = fromUuidSync(data.uuid as ActorUUID);
        const closestLeader = htmlClosest(event.target, ".leader[data-role]");
        if (actor instanceof CreaturePF2e && closestLeader) {
            const role = String(closestLeader.dataset.role);
            const uuid = actor.uuid;
            this.kingdom.update({ leadership: { [role]: { uuid } } });
        }
    }

    #getFeatSlotData(event: DragEvent): { slotId: string | undefined; groupId: string } | null {
        const groupId = htmlClosest(event.target, "[data-group-id]")?.dataset.groupId;
        const slotId = htmlClosest(event.target, "[data-slot-id]")?.dataset.slotId;
        return typeof groupId === "string" ? { slotId, groupId } : null;
    }

    /** Override to not auto-disable fields on a thing meant to be used by players */
    protected override _disableFields(form: HTMLElement): void {
        for (const gmOnlyField of htmlQueryAll(form, "input, textarea, [data-access=owner]")) {
            if (gmOnlyField instanceof HTMLTextAreaElement) {
                gmOnlyField.readOnly = true;
            } else if (gmOnlyField instanceof HTMLInputElement || gmOnlyField instanceof HTMLButtonElement) {
                gmOnlyField.disabled = true;
            }
        }
    }

    protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
        if (!this.actor.id) return;

        const data: DeepPartial<KingdomSource> = fu.expandObject(formData);

        // Ensure penalties are all negative numbers
        for (const abilitySlug of KINGDOM_ABILITIES) {
            const ability = data.abilities?.[abilitySlug];

            if (ability?.penalty) {
                ability.penalty = -Math.abs(ability.penalty);
            }
        }

        return this.kingdom.update(data);
    }
}

interface KingdomSheetData extends ActorSheetDataPF2e<PartyPF2e> {
    kingdom: Kingdom;
    nationTypeLabel: string;
    abilities: (KingdomAbilityData & {
        slug: string;
        label: string;
        ruinLabel: string;
    })[];
    commodities: CommoditySheetData[];
    leadership: LeaderSheetData[];
    actions: { item: CampaignFeaturePF2e; traits: SheetOptions }[];
    skills: Statistic[];
    feats: FeatGroup<PartyPF2e, CampaignFeaturePF2e>[];
    actionFilterChoices: SheetOption[];
    armies: ArmySheetData[];
    settlements: SettlementSheetData[];
    eventText: string;
    //edicts: Record<string,string>[];
    edictTypes: Record<KingdomEdict, Record<number,KingdomEdictData>>;
    settlementTypes: Record<string, string>;
    abilityLabels: Record<string, string>;
    skillLabels: Record<string, string>;
    proficiencyOptions: FormSelectOption[];
}

interface ArmySheetData {
    link: string;
    document: ArmyPF2e;
    consumption: AdjustedValue;
}

interface LeaderSheetData extends KingdomLeadershipData {
    actor: ActorPF2e | null;
    img: ImageFilePath | VideoFilePath;
    slug: string;
    label: string;
    description: string;
    abilityLabel: string;
    penaltyLabel: string;
}

interface LotSheetData {
    actor: ItemPF2e | null;
    img: ImageFilePath | VideoFilePath;
    slug: KingdomSettlementGridLot;
    block: KingdomSettlementGridBlock;
    district: string;
    settlement: string;
    label: string;
}
interface BlockSheetData extends KingdomSettlementGridData {
    lots: LotSheetData[]
}
type DistrictSheetData = {
    id: string;
    grid: BlockSheetData[];
}

interface QualitySheetData {
    actor: ItemPF2e | null;
    img: ImageFilePath | VideoFilePath;
    slug: KingdomSettlementQuality;
    settlement: string;
    label: string;
}

interface BorderSheetData {
    actor: ItemPF2e | null;
    img: ImageFilePath | VideoFilePath;
    slug: KingdomSettlementGridBorder;
    settlement: string;
    label: string;
}

interface CommoditySheetData extends ValueAndMax {
    type: string;
    label: string;
    /** Worksite data (if it exists for the commodity type) */
    workSites: {
        label: string;
        description: string;
        hasResource: boolean;
        value: number;
        resource?: number;
    };
}

//type SettlementSheetData = Omit<KingdomSettlementData, "storage" | "grid" | "qualities" | "borders"> & {
type SettlementSheetData = Omit<KingdomSettlementData, "storage" | "districts" | "qualities" | "borders"> & {
    id: string;
    editing: boolean;
    lotRange: string;
    levelRange: string;
    populationRange: string;
    typeLabel: string;
    storage: {
        type: string;
        label: string;
        description: string;
        value: number;
    }[];
    districts: DistrictSheetData[];
    qualities: QualitySheetData[];
    maxQualities: number;
    //grid: GridSheetData[];
    borders: BorderSheetData[];
};

export { KingdomSheetPF2e };
