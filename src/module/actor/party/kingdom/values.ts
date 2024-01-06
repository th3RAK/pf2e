import { RawModifier } from "@actor/modifiers.ts";
import { localizer } from "@util";
import * as R from "remeda";
import {
    KingdomAbility,
    KingdomCHG,
    KingdomCharter,
    KingdomCommodity,
    KingdomEdict,
    KingdomEdictsChoice,
    KingdomGovernment,
    KingdomLeadershipRole,
    KingdomNationType,
    KingdomSettlementType,
    KingdomSkill,
} from "./types.ts";

const KINGDOM_ABILITIES = ["economy", "loyalty", "stability"] as const;
const KINGDOM_LEADERSHIP = [
    "ruler",
    "councilor",
    "general",
    "grand_diplomat",
    "high_priest",
    "magister",
    "marshal",
    "royal_enforcer",
    "spymaster",
    "treasurer",
    "warden",
] as const;
const KINGDOM_LEADERSHIP_DESCRIPTIONS: Record<KingdomLeadershipRole, string> = {
    ruler : "The Ruler is the highest-ranking person in the kingdom, above even the other kingdom leaders, and is expected to embody the values of the kingdom. <br>The Ruler performs the kingdom’s most important ceremonies (such as knighting royals and signing treaties), is the kingdom’s chief diplomatic officer (though most of these duties are handled by the Grand Diplomat), is the signatory for all laws affecting the entire kingdom, pardons criminals when appropriate, and is responsible for appointing characters to all other high positions in the government (such as other leadership roles, mayors of settlements, and judges).",
    councilor: "The Councilor acts as a liaison between the citizenry and the other kingdom leaders, parsing requests from the commonwealth and presenting the leaders’ proclamations to the people in understandable ways.<br> It is the Councilor’s responsibility to make sure the Ruler is making decisions that benefit the kingdom’s communities and its citizens.", //1
    general: "The General is the highest-ranking member of the kingdom’s military. <br>If the kingdom has an army and a navy, the heads of those organizations report to the kingdom’s General. <be>The General is responsible for looking after the needs of the military and directing the kingdom’s armies in times of war. <br>Most citizens see the General as a protector and patriot.", //1
    grand_diplomat: "The Grand Diplomat is in charge of the kingdom’s foreign policy—how it interacts with other kingdoms and similar political organizations such as tribes of intelligent monsters. <br>The Grand Diplomat is the head of all of the kingdom’s diplomats, envoys, and ambassadors. <br>It is the Grand Diplomat‘s responsibility to represent and protect the interests of the kingdom with regard to foreign powers.", //2
    high_priest: "The High Priest tends to the kingdom’s religious needs and guides its growth. <br>If the kingdom has an official religion, the High Priest may also be the highest-ranking member of that religion in the kingdom, and has similar responsibilities over the lesser priests of that faith to those the Grand Diplomat has over the kingdom’s ambassadors and diplomats. <br>If the kingdom has no official religion, the High Priest may be a representative of the most popular religion in the kingdom or a neutral party representing the interests of all religions allowed by the kingdom.", //3
    magister: "The Magister guides the kingdom’s higher learning and magic, promoting education and knowledge among the citizens and representing the interests of magic, science, and academia. <br>In most kingdoms, the Magister is a sage, a wizard, or a priest of a deity of knowledge, and oversees the governmental bureaucracy except regarding finance.", //1
    marshal: "The Marshal ensures that the kingdom’s laws are being enforced in the remote parts of the kingdom as well as in the vicinity of the capital. <br>The Marshal is also responsible for securing the kingdom’s borders. <br>He organizes regular patrols and works with the General to respond to threats that militias and adventurers can’t deal with alone.", //2
    royal_enforcer: "The Royal Enforcer deals with punishing criminals, working with the Councilor to make sure the citizens feel the government is adequately dealing with wrongdoers, and working with the Marshal to capture fugitives from the law. <br>The Royal Enforcer may grant civilians the authority to kill in the name of the law.", //2
    spymaster: "The Spymaster observes the kingdom’s criminal elements and underworld and spies on other kingdoms. <br>The Spymaster always has a finger on the pulse of the kingdom’s underbelly, and uses acquired information to protect the interests of the kingdom at home and elsewhere through a network of spies and informants.",
    treasurer: "The Treasurer monitors the state of the kingdom’s Treasury and citizens’ confidence in the value of their money and investigates whether any businesses are taking unfair advantage of the system. <br>The Treasurer is in charge of the tax collectors and tracks debts and credits with guilds and other governments.", //3
    warden: "The Warden is responsible for enforcing laws in larger settlements, as well as ensuring the safety of the kingdom leaders. <br>The Warden also works with the General to deploy forces to protect settlements and react to internal threats.", //3
};

const KINGDOM_COMMODITIES = ["food", "fish","lumber", "ore", "stone","aqueduct","bridge","canal","fort"
,"highway","road","watchtower","refuge","landmark","river"] as const;

const KINGDOM_COMMODITIES_MODIFIERS: Record<KingdomCommodity, () => ModifiersSet> = {
    food: () => ({
        modifiers: {
            consumption: [
                {
                    slug: "Farms",
                    label: "Farms",
                    modifier: -2,
                },
            ],
        },
    }),
    fish: () => ({
        modifiers: {
            consumption: [
                {
                    slug: "Fisheries",
                    label: "Fisheries",
                    modifier: -1,
                },
            ],
        },
    }),
    lumber: () => ({
        modifiers: {
            stability: [
                {
                    slug: "Sawmills",
                    label: "Sawmills",
                    modifier: 1,
                },
            ],            
        },
    }),
    ore: () => ({
        modifiers: {
            economy: [
                {
                    slug: "Mines",
                    label: "Mines",
                    modifier: 1,
                },
            ],
        },
    }),
    stone: () => ({
        modifiers: {
            stability: [
                {
                    slug: "Quarries",
                    label: "Quarries",
                    modifier: 1,
                },
            ],
        },
    }),
    aqueduct: () => ({
        modifiers: {
            loyalty: [
                {
                    slug: "Aqueducts",
                    label: "Aqueducts",
                    modifier: 1,
                },
            ],            
            stability: [
                {
                    slug: "Aqueducts",
                    label: "Aqueducts",
                    modifier: 1,
                },
            ],
        },
    }),
    bridge: () => ({}),
    canal: () => ({}),
    fort: () => ({
        modifiers: {
            stability: [
                {
                    slug: "Forts",
                    label: "Forts",
                    modifier: 2,
                },
            ],
            /*defense: [
                {
                    slug: "Forts",
                    label: "Forts",
                    modifier: 4,
                },
            ],*/
            consumption: [
                {
                    slug: "Forts",
                    label: "Forts",
                    modifier: 1,
                },
            ],
        },
    }),
    highway: () => ({
        modifiers: {
            economy: [
                {
                    slug: "Highways",
                    label: "Highways",
                    modifier: 0.25,
                },
            ],
            stability: [
                {
                    slug: "Highways",
                    label: "Highways",
                    modifier: 0.125,
                },
            ],
        },
    }),
    road: () => ({
        modifiers: {
            economy: [
                {
                    slug: "Roads",
                    label: "Roads",
                    modifier: 0.25,
                },
            ],
            stability: [
                {
                    slug: "Roads",
                    label: "Roads",
                    modifier: 0.125,
                },
            ],
        },
    }),
    watchtower: () => ({
        modifiers: {
            stability: [
                {
                    slug: "Watchtowers",
                    label: "Watchtowers",
                    modifier: 1,
                },
            ],
        },
    }),
    refuge: () => ({
        modifiers: {
            stability: [
                {
                    slug: "Lairs",
                    label: "Lairs",
                    modifier: 1,
                },
            ],
        },
    }),
    landmark: () => ({
        modifiers: {
            loyalty: [
                {
                    slug: "Landmarks",
                    label: "Landmarks",
                    modifier: 1,
                },
            ],
        },
    }),
    river: () => ({
        modifiers: {
            economy: [
                {
                    slug: "Rivers",
                    label: "Rivers",
                    modifier: 0.25,
                },
            ],
            stability: [
                {
                    slug: "Rivers",
                    label: "Rivers",
                    modifier: 0.125,
                },
            ],
        },
    }),
}
const KINGDOM_SKILLS_KINGDOM = [
    "economy",
    "loyalty",
    "stability",
    "fame",
    "infamy",
    "consumption",
    "population",
    "basevalue",
] as const;
const KINGDOM_SKILLS_SETTLEMENT = [
    "corruption",
    "crime",
    "productivity",
    "law",
    "lore",
    "society",
] as const;
const KINGDOM_SKILL_GENERIC =[
    "defense",
    "danger",
] as const;
 const KINGDOM_SKILLS = [...KINGDOM_SKILLS_KINGDOM, ...KINGDOM_SKILLS_SETTLEMENT, ...KINGDOM_SKILL_GENERIC] as const;

const KINGDOM_LEADERSHIP_ABILITIES: Record<KingdomLeadershipRole, KingdomAbility> = {
    ruler : "stability",
    councilor: "loyalty", //1
    general: "stability", //1
    grand_diplomat: "stability", //2
    high_priest: "stability", //3
    magister: "economy", //1
    marshal: "economy", //2
    royal_enforcer: "loyalty", //2
    spymaster: "loyalty",
    treasurer: "economy", //3
    warden: "loyalty", //3
};

const KINGDOM_SKILL_ABILITIES: Record<KingdomSkill, KingdomAbility | null> = {
    economy : "economy",
    loyalty : "loyalty",
    stability : "stability",
    corruption : null,
    crime : null,
    productivity : null,
    law : null,
    lore : null,
    society : null,
    defense : null,
    danger : null,
    fame : null,
    infamy : null,
    population : null,
    basevalue : null,
    consumption: null,
};

const KINGDOM_ABILITY_LABELS = R.mapToObj(KINGDOM_ABILITIES, (a) => [a, `PF2E.Kingmaker.Abilities.${a}`]);

const KINGDOM_COMMODITY_LABELS: Record<KingdomCommodity, string> = {
    food: "Farmland",
    fish: "Fisheries",
    lumber: "Sawmills",
    ore: "Mines", 
    stone: "Quarries",
    aqueduct: "Aqueduct",
    bridge: "Bridge",
    canal: "Canal",
    fort:"Fort",
    highway: "Highway",
    road: "Road",
    watchtower: "Watchtower",
    refuge: "Lair",
    landmark: "Landmark",
    river: "River"
};
const KINGDOM_COMMODITY_DESCRIPTIONS: Record<KingdomCommodity, string> = {
    food: "A Farm helps feed your kingdom.<br><b>Effect:</b> Consumption decreases by 2 BP.",
    fish: "A Fishery is like a Farm, except it provides abundant fish rather than planted crops.<br><b>Effect:</b> Consumption decreases by 1 BP.",
    lumber: "A sawmill centralizes the activities of loggers and turns trees into lumber for use in building and crafting.<br><b>Effect:</b> Stability +1, earn +1 BP per turn when collecting taxes during the Income Phase.",
    ore: "A Mine extracts metal, coal, salt, or other useful materials from the earth.<br><b>Effect:</b> Economy +1, earn +1 BP per turn when collecting taxes during the Income Phase.", 
    stone: "A Quarry extracts workable stone from the ground.<br><b>Effect:</b> Stability +1, earn +1 BP per turn when collecting taxes during the Income Phase.",
    aqueduct: "An Aqueduct brings water from alpine lakes and rivers to lowland cities where water is scarce or insufficient for the local populace.<br><b>Effect:</b> Loyalty +1, Stability +1, allows settlement to build water-dependent buildings.",
    bridge: "A Bridge allows your Road hexes to cross rivers.",
    canal: "A Canal is an artificial waterway that allows barge traffic to haul heavy commodities.<br><b>Effect:</b> Settlements in a hex with a Canal treat the hex as if it had a river.",
    fort:"A Fort is a walled encampment for military forces outside a settlement.<br><b>Effect:</b> Stability +2, Defense +4, increase Consumption by 1 BP; Unrest decreases by 1 when completed.",
    highway: "A highway is a paved and well-maintained version of a Road.<br><b>Effect:</b> Economy +1 for every 4 hexes of Highway, Stability +1 for every 8 hexes of Highway; improves overland travel speed.",
    road: "A Road speeds travel through your kingdom and promotes trade.<br><b>Effect:</b> Economy +1 for every 4 hexes of Road, Stability +1 for every 8 hexes of Road; improves overland travel speed.",
    watchtower: "A Watchtower flies your flag, is a safe place for your patrols, and establishes your power on the frontier.<br><b>Effect:</b> Stability +1, Defense +2; Unrest decreases by 1 when completed.",
    refuge: "A Lair is usually a cave or defensible shelter that can be used as a defensive fallback point, a storage location, or even a guardpost or prison. <br>If you claim a hex with a Lair, Stability increases by 1. If you construct a Fort or Watchtower over a Lair, its Defense increases by 1.",
    landmark: "A Landmark is a site of great pride, mystery, and wonder, such as an outcropping in the shape of a human face, a smoking volcano, or a lake with an unusual color or unique properties. The Landmark bolsters your kingdom’s morale.<br>If you claim a hex with a Landmark, Loyalty increases by 1. If the hex also has a Road or Highway, Loyalty increases by an additional 1.",
    river: "A River allows water travel through your kingdom, facilitating trade and allowing irrigation. <br>Economy increases by 1 for every 4 River hexes claimed, and Stability increases by 1 for every 8 such hexes claimed."
};
/** Ruin label by ability slug */
const KINGDOM_RUIN_LABELS = {
    culture: "PF2E.Kingmaker.Kingdom.Ruin.corruption",
    economy: "PF2E.Kingmaker.Kingdom.Ruin.crime",
    stability: "PF2E.Kingmaker.Kingdom.Ruin.decay",
    loyalty: "PF2E.Kingmaker.Kingdom.Ruin.strife",
};

const KINGDOM_SKILL_LABELS: Record<KingdomSkill, string> = {
    economy : "Economy",
    loyalty : "Loyalty",
    stability : "Stability",
    corruption : "Corruption",
    crime : "Crime",
    productivity : "Productivity",
    law : "Law",
    lore : "Lore",
    society : "Society",
    defense : "Defense",
    danger : "Danger",
    fame : "Fame",
    infamy : "Infamy",
    population : "Population",
    basevalue : "BaseValue",
    consumption: "Consumption",
};

const KINGDOM_SKILL_DESCRIPTIONS: Record<KingdomSkill, string> = {
    economy : "This attribute measures the productivity of your kingdom’s workers and the vibrancy of its trade, both in terms of money and in terms of information, innovation, and technology.",
    loyalty : "Loyalty refers to the sense of goodwill among your people, their ability to live peaceably together even in times of crisis, and to fight for one another when needed.",
    stability : "Stability refers to the physical and social well-being of the kingdom, from the health and security of its citizenry to the vitality of its natural resources and its ability to maximize their use.",
    corruption : "Corruption measures how open a settlement’s officials are to bribes, how honest its citizens are, and how likely anyone in town is to report a crime. <br>Low corruption indicates a high level of civic honesty. <br>A settlement’s corruption modifies all Deception checks made against city officials or guards and all Stealth checks made outside (but not inside buildings or underground).",
    crime : "Crime is a measure of a settlement’s lawlessness. A settlement with a low crime modifier is relatively safe, with violent crimes being rare or even unknown, while a settlement with a high crime modifier is likely to have A powerful thieves’ guild and a significant problem with violence. <br>The atmosphere generated by a settlement’s crime level applies as a modifier on Perception checks to avoid being deceived and to Thievery checks made to pick pockets.",
    productivity : "A settlement’s <s>economy</s> productivity modifier indicates the health of its trade and the wealth of its successful citizens. <br>A low <s>economy</s> productivity modifier doesn’t automatically mean the town is beset with poverty—it could merely indicate a town with little trade or one that is relatively self-sufficient. <br>Towns with high <s>economy</s> productivity modifiers always have large markets and many shops. <br>A settlement’s <s>economy</s> productivity helps its citizens make money, and thus it applies as a modifier on all Craft, Perform, and Lore checks made to generate income.",
    law : "Law measures how strict a settlement’s laws and edicts are. <br>A settlement with a low law modifier isn’t necessarily crime-ridden—in fact, a low law modifier usually indicates that the town simply has little need for protection since crime is so rare. <br>A high law modifier means the settlement’s guards are particularly alert, vigilant, and well-organized. <br>The more lawful a town is, the more timidly its citizens tend to respond to shows of force. <br>A settlement’s law modifier applies on Intimidation checks made to force an opponent to act friendly, Diplomacy checks against government officials, or Diplomacy checks made to call on the city guard.",
    lore : "A settlement’s lore modifier measures not only how willing the citizens are to chat and talk with visitors, but also how available and accessible its libraries and sages are. <br>A low lore modifier doesn’t mean the settlement’s citizens are idiots, just that they’re close-mouthed or simply lack knowledge resources. <br>A settlement’s lore modifier applies on Diplomacy checks made to gather information and Knowledge checks made using the city’s resources to do research when using a library.",
    society : "Society measures how open-minded and civilized a settlement’s citizens are. <br>A low society modifier might mean many of the citizens harbor prejudices or are overly suspicious of out-of-towners. <br>A high society modifier means that citizens are used to diversity and unusual visitors and that they respond better to well-spoken attempts at conversation. <br>A settlement’s society modifier applies on all Deception checks to disguise yourself as a nondescript person, as well as on Diplomacy checks made to alter the attitude of any non-government official.",
    defense : "A settlement’s Defense is used with the mass combat rules presented here. <br>It otherwise has no effect unless the settlement is attacked.",
    danger : "A settlement’s danger value is a number that gives a general idea of how dangerous it is to live in the settlement. <br>If you use wandering monster chart that uses percentile dice and ranks its encounters from lowest Cr to highest CR, use the modifier associated with the settlement’s danger value to adjust rolls on the encounter chart.",
    fame : "Fame",
    infamy : "Infamy",
    population : "Actual population numbers don’t factor into your kingdom’s statistics, but can be fun to track anyway.",
    basevalue : "The base value of a settlement is used to determine what magic items may easily be purchased there. <br>There is a 75% chance that any item of that value or lower can be found for sale in the settlement with little effort.",
    consumption: "Consumption indicates how many BP are required to keep the kingdom functioning each month. <br>Your kingdom’s Consumption is equal to its Size, modified by settlements and terrain improvements (such as Farms and Fisheries). <br>Consumption can never go below 0.",
};

interface KingdomSizeData {
    type: KingdomNationType;
    inFame: number;
    improvSettlements: number;
    improvBuildings: number;
    improvTerrain: number;
    claimHex: number;
}

const KINGDOM_SIZE_DATA = {
    1: { type: "territory", inFame : 1, improvSettlements: 1, improvBuildings: 1, improvTerrain: 2, claimHex: 1},
    11: { type: "province", inFame : 2, improvSettlements: 1, improvBuildings: 2, improvTerrain: 3, claimHex: 2},
    26: { type: "state", inFame : 3, improvSettlements: 1, improvBuildings: 5, improvTerrain: 5, claimHex: 3},
    51: { type: "country", inFame : 4, improvSettlements: 2, improvBuildings: 10, improvTerrain: 7, claimHex: 4},
    101: { type: "dominion", inFame : 5, improvSettlements: 3, improvBuildings: 20, improvTerrain: 9, claimHex: 8},
    201: { type: "dominion", inFame : 6, improvSettlements: 4, improvBuildings: Infinity, improvTerrain: 12, claimHex: 12},
} satisfies Record<number, KingdomSizeData>;

//Editcs
interface KingdomEdictData {
    label: string;
    economy: number;
    loyalty: number;
    stability: number;
    consumption: number;
}

const KINGDOM_EDICTS = ["holiday", "promotion", "taxation"] as const;
const KINGDOM_EDICT_CHOICES = ["0","1","2","3","4"] as const;
const KINGDOM_EDICT_HOLIDAY_DATA = {
    0: { label: "No Holidays", economy: 0, loyalty: -1, stability: 0, consumption: 0 },
    1: { label: "1 Holiday", economy: 0, loyalty: 1, stability: 0, consumption: 1 },
    2: { label: "2-6 Holidays", economy: 0, loyalty: 2, stability: 0, consumption: 2 },
    3: { label: "7-12 Holidays", economy: 0, loyalty: 3, stability: 0, consumption: 4 },
    4: { label: "13-24 Holidays", economy: 0, loyalty: 4, stability: 0, consumption: 8 },   
} satisfies Record<KingdomEdictsChoice, KingdomEdictData>;
const KINGDOM_EDICT_PROMOTION_DATA = {
    0: { label: "No Promotion", economy: 0, loyalty: 0, stability: -1, consumption: 0 },
    1: { label: "Token Promotion", economy: 0, loyalty: 0, stability: 1, consumption: 1 },
    2: { label: "Standard Promotion", economy: 0, loyalty: 0, stability: 2, consumption: 2 },
    3: { label: "Aggressive Promotion", economy: 0, loyalty: 0, stability: 3, consumption: 4 },
    4: { label: "Expansionist Promotion", economy: 0, loyalty: 0, stability: 4, consumption: 8 },
} satisfies Record<KingdomEdictsChoice, KingdomEdictData>;
const KINGDOM_EDICT_TAXATION_DATA = {
    0: { label: "No Taxation", economy: 0, loyalty: 1, stability: 0, consumption: 0 },
    1: { label: "Light Taxation", economy: 1, loyalty: -1, stability: 0, consumption: 0 },
    2: { label: "Normal Taxation", economy: 2, loyalty: -2, stability: 0, consumption: 0 },
    3: { label: "Heavy Taxation", economy: 3, loyalty: -4, stability: 0, consumption: 0 },
    4: { label: "Overwhelming Taxation", economy: 4, loyalty: -8, stability: 0, consumption: 0 },
} satisfies Record<KingdomEdictsChoice, KingdomEdictData>;
const KINGDOM_EDICT_DATA : Record<KingdomEdict, Record<string,KingdomEdictData>> = {
    holiday : KINGDOM_EDICT_HOLIDAY_DATA,
    promotion : KINGDOM_EDICT_PROMOTION_DATA,
    taxation : KINGDOM_EDICT_TAXATION_DATA,
};

const KINGDOM_SETTLEMENT_TYPES = ["thorp", "hamlet", "village", "town","large_town","city","large_city","metropolis","large_metropolis"] as const;

const KINGDOM_SETTLEMENT_TYPE_LABELS : Record<KingdomSettlementType, string> = {
    thorp: "Thorp", hamlet: "Hamlet", village: "Village", town: "Small Town", large_town: "Large Town", city: "Small City", large_city: "Large City", metropolis: "Metropolis", large_metropolis: "Metropolis"
};

const KINGDOM_SETTLEMENT_GRID_BLOCKS = ["AA","AB","AC","BA","BB","BC","CA","CB","CC"] as const;
const KINGDOM_SETTLEMENT_GRID_LOTS = ["0","1","2","3"] as const;
const KINGDOM_SETTLEMENT_GRID_BORDERS = ["N","E","S","W"] as const;

const KINGDOM_SETTLEMENT_QUALITIES = ["government","alignment","qod1","qod2","qod3","qod4","qod5","qod6","qod7"] as const;
interface KingdomSettlementTypeData {
    blocks: number;
    lots: [number, number]
    population: [number, number];
    level: [number, number];
    consumption: number;
    maxItemBonus: number;
    influence: number;
    baseValueMax: number;
    qualities: number;
    modifiers: number;
    danger: number;
}

const KINGDOM_SETTLEMENT_TYPE_DATA = {
    thorp: { blocks: 1, lots: [0, 0], population: [0, 20], level: [0, 0], consumption: 0, maxItemBonus: 1, influence: 0, baseValueMax: 5, qualities: 1, modifiers: -4, danger: -10 },
    hamlet: { blocks: 1, lots: [0, 0], population: [21, 60], level: [1, 1], consumption: 0, maxItemBonus: 1, influence: 0, baseValueMax: 20 , qualities: 1, modifiers: -4, danger: -10 },
    village: { blocks: 1, lots: [1, 1], population: [61, 200], level: [2, 3], consumption: 0, maxItemBonus: 1, influence: 0, baseValueMax: 50 , qualities: 2, modifiers: -4, danger: -10 },
    town: { blocks: 4, lots: [2, 8], population: [201, 2000], level: [3, 4], consumption: 0, maxItemBonus: 1, influence: 1, baseValueMax: 100 , qualities: 2, modifiers: -2, danger: -5 },
    large_town: { blocks: 4, lots: [9, 20], population: [2001, 5000], level: [5, 5], consumption: 0, maxItemBonus: 1, influence: 1, baseValueMax: 200 , qualities: 3, modifiers: 0, danger: 0 },
    city: { blocks: 9, lots: [21, 40], population: [5001, 10000], level: [6, 7], consumption: 0, maxItemBonus: 2, influence: 2, baseValueMax: 400 , qualities: 4, modifiers: 1, danger: 5 },
    large_city: { blocks: 9, lots: [41, 100], population: [10001, 25000], level: [8, 9], consumption: 0, maxItemBonus: 2, influence: 2, baseValueMax: 800 , qualities: 5, modifiers: 1, danger: 5 },
    metropolis: {
        blocks: Infinity, lots: [101, Infinity], population: [25001, Infinity],
        level: [10, 11],
        consumption: 0,
        maxItemBonus: 3,
        influence: 3,
        baseValueMax: 1600,
        qualities: 6,
        modifiers: 1, 
        danger: 5 
    },
    large_metropolis: {
        blocks: Infinity, lots: [Infinity, Infinity], population: [Infinity, Infinity],
        level: [12, Infinity],
        consumption: 0,
        maxItemBonus: 3,
        influence: 3,
        baseValueMax: Infinity,
        qualities: 6,
        modifiers: 1, 
        danger: 5 
    },
} satisfies Record<KingdomSettlementType, KingdomSettlementTypeData>;

const vacancyLabel = (role: KingdomLeadershipRole) =>
    game.i18n.format("PF2E.Kingmaker.Kingdom.VacantRole", {
        role: game.i18n.localize(`PF2E.Kingmaker.Kingdom.LeadershipRole.${role}`),
    });

type ModifiersSet = {
    modifiers?: Record<string, (RawModifier & { slug: string })[]>;
};
const VACANCY_PENALTIES: Record<KingdomLeadershipRole, () => ModifiersSet> = {
    ruler: () => ({}),
    councilor: () => ({
        modifiers: {
            loyalty: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("councilor"),
                    modifier: -2,
                },
            ],
        },
    }),
    general: () => ({
        modifiers: {
            loyalty: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("general"),
                    modifier: -4
                },
            ],
        },
    }),
    grand_diplomat: () => ({
        modifiers: {
            stability: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("grand_diplomat"),
                    modifier: -2
                },
            ],
        },
    }),
    high_priest: () => ({
        modifiers: {
            stability: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("high_priest"),
                    modifier: -2
                },
            ],
            loyalty: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("high_priest"),
                    modifier: -2
                },
            ],
        },
    }),
    magister: () => ({
        modifiers: {
            economy: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("magister"),
                    modifier: -4,
                },
            ],
        },
    }),
    marshal: () => ({
        modifiers: {
            economy: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("marshal"),
                    modifier: -4,
                },
            ],
        },
    }),
    royal_enforcer: () => ({}),
    spymaster: () => ({
        modifiers: {
            economy: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("spymaster"),
                    modifier: -4,
                },
            ],
        },
    }),
    treasurer: () => ({
        modifiers: {
            economy: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("treasurer"),
                    modifier: -4,
                },
            ],
        },
    }),
    warden: () => ({
        modifiers: {
            stability: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("warden"),
                    modifier: -2
                },
            ],
            loyalty: [
                {
                    slug: "vacancy",
                    label: vacancyLabel("warden"),
                    modifier: -2
                },
            ],
        },
    }),
};

interface KingdomCHGData {
    charter: Record<string, KingdomCharter | undefined>;
    heartland: Record<string, KingdomCHG | undefined>;
    government: Record<string, KingdomGovernment | undefined>;
}

/** Returns every single possible charter, heartland, and government */
function getKingdomCHGData(): KingdomCHGData {
    const localize = localizer("PF2E.Kingmaker");
    return {
        charter: {
            charter: {
                name: "Charter",
                description: "The sponsor expects you to explore, clear, and settle a wilderness area along the sponsor’s border—an area where the sponsor has some territorial claims. You may have to fend off other challengers for the land.",
                img: "/icons/tools/navigation/map-chart-tan.webp",
                boosts: [],
                flaw: null,
            },
            conquest: {
                name: localize("Charter.conquest.Name"),
                description: localize("Charter.conquest.Description"),
                img: "/icons/weapons/swords/sword-guard-steel-green.webp",
                boosts: [],
                flaw: null,
            },
            fief: {
                name: "Fief",
                description: "The sponsor places you in charge of an existing domain within his own already-settled lands. If it includes already improved terrain and cities, you’re expected to govern and further improve them. (While you’ll start with land and settlements, you’ll still need around 50 BP to handle your kingdom’s Consumption and development needs.)",
                img: "/icons/sundries/documents/document-sealed-brown-red.webp",
                boosts: [],
                flaw: null,
            },
            grant: {
                name: localize("Charter.grant.Name"),
                description: localize("Charter.grant.Description"),
                img: "/icons/skills/trades/academics-merchant-scribe.webp",
                boosts: [],
                flaw: null,
            },
        },
        government: {
            aristocracy: {
                name: "Aristocracy",
                description: " A single person rules the kingdom by popular acclaim. This person may be elected by the people, a popular hero asked to lead, or even a hereditary monarch who rules with a light hand.",
                img: "/icons/environment/settlement/pyramid.webp",
                boosts: [],
                skills: [],
                feat: null,
            },   
            magocracy: {
                name: "Magocracy",
                description: "An individual or group with potent magical power leads the kingdom and promotes the spread of magical and mundane knowledge and education. Those with magical abilities often enjoy favored status in the kingdom.",
                img: "/icons/environment/settlement/pyramid.webp",
                boosts: [],
                skills: ["lore"],
                feat: null,
            },        
            oligarchy: {
                name: localize("Government.oligarchy.Name"),
                description: localize("Government.oligarchy.Description"),
                img: "/icons/environment/settlement/house-manor.webp",
                boosts: [],
                skills: ["corruption", "society"],
                feat: null,
            },
            republic: {
                name: localize("Government.republic.Name"),
                description: localize("Government.republic.Description"),
                img: "/icons/environment/settlement/gazebo.webp",
                boosts: [],
                skills: ["productivity", "society"],
                feat: null,
            },
            secret_syndicate: {
                name: "Secret Syndicate",
                description: "An unofficial or illegal group like a thieves’ guild rules the kingdom—the group may use a puppet leader to maintain secrecy, but the group pulls the strings.",
                img: "/icons/environment/settlement/wizard-castle.webp",
                boosts: [],
                skills: ["corruption", "crime", "productivity"],
                feat: null,
            },
            theocracy: {
                name: "Theocracy",
                description: "The kingdom is ruled by the leader of its most popular religion, and the ideas and members of that religion often enjoy favored status in government and the kingdom.",
                img: "/icons/environment/settlement/house-farmland-small.webp",
                boosts: [],
                skills: ["law", "lore"],
                feat: null,
            },
        },
        heartland: {
            lawful_good: {
                name: "LG",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["economy","loyalty"],
            },
            neutral_good: {
                name: "NG",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["stability","loyalty"],
            },
            chaotic_good: {
                name: "CG",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["loyalty"],
            },
            lawful_neutral: {
                name: "LN",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["economy","stability"],
            },
            neutral_neutral: {
                name: "TN",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["stability"],
            },
            chaotic_neutral: {
                name: "CN",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["loyalty","stability"],
            },
            lawful_evil: {
                name: "LE",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["economy"],
            },
            neutral_evil: {
                name: "NE",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["stability","economy"],
            },
            chaotic_evil: {
                name: "CE",
                description: "",
                img: "/icons/environment/wilderness/tree-oak.webp",
                boosts: ["loyalty","economy"],
            },

        },
    };
}

export {
    getKingdomCHGData,
    KINGDOM_ABILITIES,
    KINGDOM_ABILITY_LABELS,
    KINGDOM_COMMODITIES,
    KINGDOM_COMMODITIES_MODIFIERS,
    KINGDOM_COMMODITY_DESCRIPTIONS,
    KINGDOM_COMMODITY_LABELS,
    KINGDOM_EDICTS,
    KINGDOM_EDICT_CHOICES,
    KINGDOM_EDICT_DATA,
    KINGDOM_LEADERSHIP_ABILITIES,
    KINGDOM_LEADERSHIP,
    KINGDOM_LEADERSHIP_DESCRIPTIONS,
    KINGDOM_RUIN_LABELS,
    KINGDOM_SETTLEMENT_GRID_BLOCKS,
    KINGDOM_SETTLEMENT_GRID_LOTS,
    KINGDOM_SETTLEMENT_GRID_BORDERS,
    KINGDOM_SETTLEMENT_QUALITIES,
    KINGDOM_SETTLEMENT_TYPES,
    KINGDOM_SETTLEMENT_TYPE_DATA,
    KINGDOM_SETTLEMENT_TYPE_LABELS,
    KINGDOM_SIZE_DATA,
    KINGDOM_SKILLS,
    KINGDOM_SKILL_ABILITIES,
    KINGDOM_SKILL_DESCRIPTIONS,
    KINGDOM_SKILL_LABELS,
    KINGDOM_SKILLS_KINGDOM,
    KINGDOM_SKILLS_SETTLEMENT,
    VACANCY_PENALTIES,
    KINGDOM_EDICT_HOLIDAY_DATA,
    KINGDOM_EDICT_PROMOTION_DATA,
    KINGDOM_EDICT_TAXATION_DATA,
};

export type { KingdomCHGData, KingdomEdictData, KingdomSizeData};
