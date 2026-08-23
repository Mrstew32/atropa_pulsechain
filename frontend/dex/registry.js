// The grouping. Every tab in the DEX lives under exactly one wing, and this
// file is the only place that decides which. Adding a tab means adding a panel
// module to a wing's `tabs` array — the rail, the tab bar, the #/wing/tab route
// and the address store all follow from here.

import lau from "./panels/lau.js";
import qing from "./panels/qing.js";
import yue from "./panels/yue.js";
import { federalMinter, indexMinter, personalMinter } from "./panels/minter.js";

export const WINGS = [
    {
        id: "dysnomia",
        label: "Dysnomia",
        sigil: "夜",
        blurb: "The on-chain society: user tokens, the venues they trade in, and the engine that prices routes between them.",
        tabs: [lau, qing, yue]
    },
    {
        id: "minters",
        label: "Minters",
        sigil: "鑄",
        blurb: "Treasury token issuance. Same NT + TT machinery in three flavours, each with its own claim rules and lifecycle.",
        tabs: [personalMinter, indexMinter, federalMinter]
    }
];

export function findWing(wingId) {
    return WINGS.find((wing) => wing.id === wingId) || null;
}

export function findTab(wingId, tabId) {
    const wing = findWing(wingId);
    if (!wing) return null;
    return wing.tabs.find((tab) => tab.id === tabId) || null;
}

export const DEFAULT_ROUTE = { wing: WINGS[0].id, tab: WINGS[0].tabs[0].id };
