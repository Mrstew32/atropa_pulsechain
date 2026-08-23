// Minters wing. Personal, Index and Federal are the same NT + TT shape with a
// few real differences (fee source, Claim arity, Debenture lifecycle, mint
// multiplier), so one factory builds all three from a spec.
// Sources: solidity/{personal,index,federal}minter.sol.

import {
    FEDERAL_MINTER_ABI,
    FEDERAL_TT_ABI,
    INDEX_MINTER_ABI,
    INDEX_TT_ABI,
    PERSONAL_MINTER_ABI,
    PERSONAL_TT_ABI
} from "../abi.js";
import { KNOWN } from "../config.js";
import * as core from "../core.js";
import { actionButton, card, field, grid, note, readout, row } from "../ui.js";
import { approveRow, tokenMeta } from "./common.js";

const GAI_FEE = "15";

function makeMinterPanel(spec) {
    return {
        id: spec.id,
        label: spec.label,
        sigil: spec.sigil,
        tagline: spec.tagline,
        addressLabel: `${spec.label} minter address`,

        build(ctx) {
            const host = document.createElement("div");
            host.className = "dex-grid";
            host.appendChild(registryCard(ctx, spec));
            host.appendChild(deployCard(ctx, spec));
            host.appendChild(tokenCard(ctx, spec));
            return host;
        }
    };
}

/* ------------------------------------------------------- minter registry */

function registryCard(ctx, spec) {
    const { card: node, body } = card("<span class='icon'>🗂️</span> Treasury Registry", "Who owns which token this minter deployed.");

    const feeToken = readout("Fee / parent token");
    const known = readout("Bundled constants");
    body.appendChild(feeToken.row);
    if (spec.constants) body.appendChild(known.row);

    const lookup = field("Token address", { placeholder: "0x… a token this minter made" });
    body.appendChild(lookup.group);

    const owner = readout("Treasury owner");
    const standardParent = readout("Standard parent");
    body.appendChild(owner.row);
    if (spec.hasStandardParent) body.appendChild(standardParent.row);

    const newOwner = field("Transfer ownership to", { placeholder: "0x…" });
    body.appendChild(newOwner.group);

    body.appendChild(row([
        actionButton("Look Up", async () => {
            const minter = core.readContract(ctx.address, spec.minterAbi);
            const target = lookup.input.value.trim();
            const held = await core.safeRead("TreasuryTokens", () => minter.TreasuryTokens(target));
            const resolved = await core.safeRead("GetTreasuryTokenOwner", () => minter.GetTreasuryTokenOwner(target));
            owner.set(held && held !== core.ZERO_ADDRESS ? held : resolved || "—");
            if (spec.hasStandardParent) {
                const parent = await core.safeRead("GetStandardTokenParent", () => minter.GetStandardTokenParent(target));
                standardParent.set(parent || "—");
            }
        }, "btn-secondary"),
        actionButton("Transfer", async () => {
            const minter = core.writeContract(ctx.address, spec.minterAbi);
            await core.sendTx("Transfer", () => minter.Transfer(lookup.input.value.trim(), newOwner.input.value.trim()));
        })
    ]));
    body.appendChild(note("Transfer only moves the record when tx.origin is the current registered owner — it silently no-ops otherwise."));
    if (spec.addressHint) body.appendChild(note(spec.addressHint));

    ctx.onRefresh(async () => {
        const meta = await tokenMeta(spec.feeToken).catch(() => null);
        feeToken.set(meta ? `${meta.name} (${meta.symbol}) · ${spec.feeToken}` : spec.feeToken);
        if (spec.constants && core.isAddress(ctx.address)) {
            const minter = core.readContract(ctx.address, spec.minterAbi);
            const values = await Promise.all(spec.constants.map((key) => minter[key]().catch(() => null)));
            known.set(spec.constants.map((key, i) => `${key}=${values[i] || "?"}`).join("  "));
        }
    });

    return node;
}

/* --------------------------------------------------------------- deploy */

function deployCard(ctx, spec) {
    const { card: node, body } = card("<span class='icon'>🏭</span> Mint a Token", `New() charges the initial mint in ${spec.feeSymbol} and deploys a TT.`);

    const name = field("Name", { placeholder: "My Treasury Token" });
    const symbol = field("Symbol", { placeholder: "MTT" });
    body.appendChild(grid([name.group, symbol.group]));

    const initial = field("Initial mint (whole tokens)", { placeholder: "1.0" });
    const parent = field("Parent token", { placeholder: spec.defaultParent || "0x…", value: spec.defaultParent || "" });
    body.appendChild(grid([initial.group, parent.group]));

    const approval = approveRow(
        `Approve ${spec.feeSymbol}`,
        () => spec.feeToken,
        () => ctx.address,
        () => initial.input.value
    );
    body.appendChild(approval.status);
    body.appendChild(approval.node);

    const deployed = readout("Deployed at");
    body.appendChild(deployed.row);

    const buttons = [
        actionButton("Deploy Token", async () => {
            const minter = core.writeContract(ctx.address, spec.minterAbi);
            const feeMeta = await tokenMeta(spec.feeToken);
            const units = core.parseAmount(initial.input.value, feeMeta.decimals);
            const receipt = await core.sendTx("New", () =>
                minter.New(name.input.value, symbol.input.value, units, parent.input.value.trim())
            );
            if (!receipt) return;
            const address = core.newTokenFromReceipt(receipt);
            deployed.set(address || "see transaction logs");
            if (address) {
                core.log(`${spec.label} minted ${address}.`, "success");
                ctx.setExtra("token", address);
                ctx.refresh();
            }
        })
    ];

    if (spec.hasNewGai) {
        buttons.push(actionButton("NewGai (5 tiers)", async () => {
            const minter = core.writeContract(ctx.address, spec.minterAbi);
            const receipt = await core.sendTx("NewGai", () => minter.NewGai(name.input.value, symbol.input.value));
            if (!receipt) return;
            const address = core.newTokenFromReceipt(receipt);
            deployed.set(address || "see transaction logs");
        }, "btn-secondary"));
    }
    body.appendChild(row(buttons));

    body.appendChild(note(
        `New() pulls the initial mint amount of ${spec.feeSymbol} from you, so approve at least that much first.`
        + (spec.hasNewGai ? ` NewGai() is a flat ${GAI_FEE} ${spec.feeSymbol} and deploys the five ➊–➎ tiers in one call.` : "")
    ));

    ctx.onRefresh(() => approval.refresh());

    return node;
}

/* -------------------------------------------------------- token console */

function tokenCard(ctx, spec) {
    const { card: node, body } = card("<span class='icon'>🎛️</span> Token Console", "Drive a TT this minter deployed.");

    const token = field("TT address", { placeholder: "0x…", value: ctx.getExtra("token") });
    token.input.addEventListener("change", () => ctx.setExtra("token", token.input.value.trim()));
    body.appendChild(token.group);

    const identity = readout("Token");
    const parentOut = readout("Parent");
    const creator = readout("Creator");
    const supply = readout("Total supply");
    const held = readout("Your balance");
    const permission = readout("Your _hu level");
    const debenture = readout("Debenture");
    [identity, parentOut, creator, supply, held, permission].forEach((r) => body.appendChild(r.row));
    if (spec.hasDebenture) body.appendChild(debenture.row);

    const amount = field("Amount (whole tokens)", { placeholder: "1.0" });
    body.appendChild(amount.group);

    const multiplier = readout("Mint multiplier");
    const mintCost = readout("Parent pulled by mint");
    if (spec.hasMultiplier) {
        body.appendChild(multiplier.row);
        body.appendChild(mintCost.row);
    }

    let parentAddress = "";
    const mintApproval = approveRow(
        "Approve parent for mint",
        () => parentAddress,
        () => token.input.value.trim(),
        () => mintApprovalAmount()
    );

    // Personal and Index multiply the parent pull by Multiplier(amount);
    // Federal pulls the amount straight through.
    function mintApprovalAmount() {
        if (!spec.hasMultiplier) return amount.input.value;
        const factor = Number(multiplier.value.textContent);
        const typed = Number(amount.input.value);
        if (!Number.isFinite(factor) || !Number.isFinite(typed) || factor <= 0) return amount.input.value;
        return String(typed * factor);
    }

    body.appendChild(mintApproval.status);
    body.appendChild(mintApproval.node);

    const claimApproval = approveRow(
        spec.claimNeedsContract ? "Approve claimed token" : "Approve TT (self)",
        () => (spec.claimNeedsContract ? claimContract.input.value.trim() : token.input.value.trim()),
        () => token.input.value.trim(),
        () => amount.input.value
    );

    const claimContract = field("Claim — token to hand in", { placeholder: "0x… sibling token or the TT itself" });
    if (spec.claimNeedsContract) body.appendChild(claimContract.group);
    body.appendChild(claimApproval.status);
    body.appendChild(claimApproval.node);

    const actions = [
        actionButton("Read", () => refresh(), "btn-secondary"),
        actionButton("Mint", async () => {
            const tt = core.writeContract(token.input.value.trim(), spec.ttAbi);
            const meta = await tokenMeta(token.input.value.trim());
            const units = core.parseAmount(amount.input.value, meta.decimals);
            const receipt = await core.sendTx("mint", () => tt.mint(units));
            if (receipt) refresh();
        }),
        actionButton("Claim", async () => {
            const target = token.input.value.trim();
            const tt = core.writeContract(target, spec.ttAbi);
            const meta = await tokenMeta(target);
            const units = core.parseAmount(amount.input.value, meta.decimals);
            const receipt = spec.claimNeedsContract
                ? await core.sendTx("Claim", () => tt.Claim(claimContract.input.value.trim() || target, units))
                : await core.sendTx("Claim", () => tt.Claim(units));
            if (receipt) refresh();
        }),
        actionButton("Burn", async () => {
            const tt = core.writeContract(token.input.value.trim(), spec.ttAbi);
            const meta = await tokenMeta(token.input.value.trim());
            const receipt = await core.sendTx("burn", () => tt.burn(core.parseAmount(amount.input.value, meta.decimals)));
            if (receipt) refresh();
        }, "btn-secondary")
    ];
    if (spec.hasDebenture) {
        actions.push(actionButton("Publish", async () => {
            const tt = core.writeContract(token.input.value.trim(), spec.ttAbi);
            const receipt = await core.sendTx("publish", () => tt.publish());
            if (receipt) refresh();
        }, "btn-secondary"));
    }
    body.appendChild(row(actions));

    const grantee = field("Permission — address", { placeholder: "0x…" });
    const level = field("Permission — level (0-255)", { placeholder: "5" });
    body.appendChild(grid([grantee.group, level.group]));
    body.appendChild(row([
        actionButton("ha() — self level 1", async () => {
            const tt = core.writeContract(token.input.value.trim(), spec.ttAbi);
            const receipt = await core.sendTx("ha", () => tt.ha());
            if (receipt) refresh();
        }, "btn-secondary"),
        actionButton("hu() — set level", async () => {
            const tt = core.writeContract(token.input.value.trim(), spec.ttAbi);
            const receipt = await core.sendTx("hu", () => tt.hu(grantee.input.value.trim(), Number(level.input.value || "0")));
            if (receipt) refresh();
        }, "btn-secondary"),
        actionButton("Withdraw", async () => {
            const tt = core.writeContract(token.input.value.trim(), spec.ttAbi);
            const meta = await tokenMeta(grantee.input.value.trim()).catch(() => ({ decimals: 18 }));
            await core.sendTx("withdraw", () => tt.withdraw(grantee.input.value.trim(), core.parseAmount(amount.input.value, meta.decimals)));
        }, "btn-secondary")
    ]));
    body.appendChild(note(
        "Withdraw takes the token address from the permission field and the amount above; it refuses the parent token and anyone but the registered treasury owner."
        + (spec.claimNote ? ` ${spec.claimNote}` : "")
    ));

    async function refresh() {
        const target = token.input.value.trim();
        if (!core.isAddress(target)) {
            [identity, parentOut, creator, supply, held, permission, debenture, multiplier, mintCost].forEach((r) => r.set("—"));
            return;
        }
        const tt = core.readContract(target, spec.ttAbi);
        const meta = await tokenMeta(target).catch(() => ({ name: "?", symbol: "?", decimals: 18 }));
        identity.set(`${meta.name} (${meta.symbol})`);

        const [parentAddr, creatorAddr, total] = await Promise.all([
            tt.Parent().catch(() => null),
            tt.Creator().catch(() => null),
            tt.totalSupply().catch(() => null)
        ]);
        parentAddress = parentAddr || "";
        if (parentAddr) {
            const parentMeta = await tokenMeta(parentAddr).catch(() => null);
            parentOut.set(parentMeta ? `${parentMeta.symbol} · ${parentAddr}` : parentAddr);
        } else {
            parentOut.set("—");
        }
        creator.set(creatorAddr || "—");
        supply.set(total === null ? "—" : core.formatAmount(total, meta.decimals));

        if (core.state.account) {
            held.set(core.formatAmount(await tt.balanceOf(core.state.account).catch(() => 0n), meta.decimals));
            const level = await tt._hu(core.state.account).catch(() => null);
            permission.set(level === null ? "—" : level.toString());
        } else {
            held.set("connect wallet");
            permission.set("—");
        }

        if (spec.hasDebenture) {
            const flag = await tt.Debenture().catch(() => null);
            debenture.set(flag === null ? "—" : String(flag));
        }

        if (spec.hasMultiplier) {
            try {
                const units = core.parseAmount(amount.input.value || "0", meta.decimals);
                const factor = await tt.Multiplier(units);
                multiplier.set(factor.toString());
                mintCost.set(`${core.formatAmount(units * factor, meta.decimals)} parent tokens`);
            } catch (err) {
                multiplier.set("—");
                mintCost.set("—");
            }
        }

        await mintApproval.refresh();
        await claimApproval.refresh();
    }

    amount.input.addEventListener("change", () => refresh());
    ctx.onRefresh(refresh);

    return node;
}

/* ------------------------------------------------------------ the three */

export const personalMinter = makeMinterPanel({
    id: "personal",
    label: "Personal",
    sigil: "個",
    tagline: "Personal treasury tokens — self-claim against the parent, NewGai tiers.",
    minterAbi: PERSONAL_MINTER_ABI,
    ttAbi: PERSONAL_TT_ABI,
    feeToken: KNOWN.WM,
    feeSymbol: "WM",
    hasStandardParent: true,
    hasNewGai: true,
    hasMultiplier: true,
    hasDebenture: false,
    claimNeedsContract: false,
    constants: ["NOTS", "SKILLS", "NINE"],
    addressHint: "personalminter.sol is not self-referencing: point this at your deployment. The V1 treasury minter it delegates to is 0xC7bDAc3e6Bb5eC37041A11328723e9927cCf430B.",
    claimNote: "Personal Claim() burns your own TT and returns parent tokens 1:1, so the TT must approve itself as spender."
});

export const indexMinter = makeMinterPanel({
    id: "index",
    label: "Index",
    sigil: "指",
    tagline: "Index treasury tokens — claim across siblings that share a creator and parent.",
    minterAbi: INDEX_MINTER_ABI,
    ttAbi: INDEX_TT_ABI,
    feeToken: KNOWN.WM,
    feeSymbol: "WM",
    hasStandardParent: true,
    hasNewGai: false,
    hasMultiplier: true,
    hasDebenture: true,
    claimNeedsContract: true,
    claimNote: "Index Claim() only accepts a sibling registered to the same Creator and Parent, and only while Debenture is still true."
});

export const federalMinter = makeMinterPanel({
    id: "federal",
    label: "Federal",
    sigil: "聯",
    tagline: "Federal treasury tokens — FED-rooted, debenture until published.",
    minterAbi: FEDERAL_MINTER_ABI,
    ttAbi: FEDERAL_TT_ABI,
    feeToken: KNOWN.WM,
    feeSymbol: "WM",
    defaultParent: KNOWN.FED,
    hasStandardParent: false,
    hasNewGai: false,
    hasMultiplier: false,
    hasDebenture: true,
    claimNeedsContract: true,
    addressHint: "Index TT names the federal minter as 0xc15c5F699Daf5e1135732139f05D2c05b3EF4354 — confirm against your deployment before sending funds.",
    claimNote: "publish() clears Debenture and needs _hu ≥ 100; withdraw() stays blocked until it is cleared."
});
