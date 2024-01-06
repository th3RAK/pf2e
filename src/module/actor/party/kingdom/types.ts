import type { KINGDOM_SCHEMA, KINGDOM_DISTRICT_SCHEMA, KINGDOM_SETTLEMENT_SCHEMA } from "./schema.ts";
import type {
    KINGDOM_ABILITIES,
    KINGDOM_COMMODITIES,
    KINGDOM_EDICTS,
    KINGDOM_EDICT_CHOICES,
    KINGDOM_LEADERSHIP,
    KINGDOM_SETTLEMENT_GRID_BLOCKS,
    KINGDOM_SETTLEMENT_GRID_LOTS,
    KINGDOM_SETTLEMENT_GRID_BORDERS,
    KINGDOM_SETTLEMENT_QUALITIES,
    KINGDOM_SETTLEMENT_TYPES,
    KINGDOM_SKILLS,
    KINGDOM_SKILLS_KINGDOM,
    KINGDOM_SKILLS_SETTLEMENT,
} from "./values.ts";

interface KingdomCHG {
    name: string;
    img: ImageFilePath;
    description: string;
    boosts: (KingdomAbility | "free")[];
    flaw?: KingdomAbility | null;
    feat?: CompendiumUUID | null;
}

interface KingdomCharter extends KingdomCHG {
    flaw: KingdomAbility | null;
}

interface KingdomGovernment extends KingdomCHG {
    skills: KingdomSkill[];
    feat: CompendiumUUID | null;
}

type KingdomAbility = (typeof KINGDOM_ABILITIES)[number];
type KingdomEdict = (typeof KINGDOM_EDICTS)[number];
type KingdomEdictsChoice = (typeof KINGDOM_EDICT_CHOICES)[number];
type KingdomSkill = (typeof KINGDOM_SKILLS)[number];
type KingdomSkillKingdom = (typeof KINGDOM_SKILLS_KINGDOM)[number];
type KingdomSkillSettlement = (typeof KINGDOM_SKILLS_SETTLEMENT)[number];
type KingdomLeadershipRole = (typeof KINGDOM_LEADERSHIP)[number];
type KingdomCommodity = (typeof KINGDOM_COMMODITIES)[number];
type KingdomNationType = "territory" | "province" | "state" | "country" | "dominion";
type KingdomSettlementGridBlock = (typeof KINGDOM_SETTLEMENT_GRID_BLOCKS)[number];
type KingdomSettlementGridLot = (typeof KINGDOM_SETTLEMENT_GRID_LOTS)[number];
type KingdomSettlementGridBorder = (typeof KINGDOM_SETTLEMENT_GRID_BORDERS)[number];
type KingdomSettlementQuality = (typeof KINGDOM_SETTLEMENT_QUALITIES)[number];
type KingdomSettlementType = (typeof KINGDOM_SETTLEMENT_TYPES)[number];

type KingdomSchema = typeof KINGDOM_SCHEMA;
type KingdomSource = SourceFromSchema<typeof KINGDOM_SCHEMA>;
type KingdomData = ModelPropsFromSchema<typeof KINGDOM_SCHEMA>;
type KingdomAbilityData = KingdomData["abilities"][KingdomAbility];
type KingdomLeadershipData = KingdomData["leadership"][KingdomLeadershipRole];
type KingdomDistrictData = ModelPropsFromSchema<typeof KINGDOM_DISTRICT_SCHEMA>;
type KingdomSettlementData = ModelPropsFromSchema<typeof KINGDOM_SETTLEMENT_SCHEMA>;
type KingdomSettlementGridData = KingdomDistrictData["grid"][KingdomSettlementGridBlock];

type FameType = "fame" | "infamy";

export type {
    FameType,
    KingdomAbility,
    KingdomAbilityData,
    KingdomCHG,
    KingdomCharter,
    KingdomCommodity,
    KingdomData,
    KingdomEdict,
    KingdomEdictsChoice,
    KingdomGovernment,
    KingdomLeadershipData,
    KingdomLeadershipRole,
    KingdomNationType,
    KingdomSchema,
    KingdomDistrictData,
    KingdomSettlementData,
    KingdomSettlementGridBlock,
    KingdomSettlementGridLot,
    KingdomSettlementGridBorder,
    KingdomSettlementGridData,
    KingdomSettlementQuality,
    KingdomSettlementType,
    KingdomSkill,
    KingdomSkillKingdom,
    KingdomSkillSettlement,
    KingdomSource,
};
