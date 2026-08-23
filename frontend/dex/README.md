# Atropa DEX shell

Served at `/dex.html` by `scripts/server.js` (static files under `frontend/` need
no route registration). Reuses `frontend/style.css` for the house look; only
`frontend/dex.css` is new.

## Layout

```
frontend/dex.html          shell markup — header, wing rail, tab bar, panel host, console
frontend/dex.css           wing/tab/panel chrome (new class names only)
frontend/dex/boot.js       rail + tab rendering, #/wing/tab routing, panel mounting
frontend/dex/registry.js   THE GROUPING — which tabs live under which wing
frontend/dex/core.js       wallet, contracts, tx/read helpers, console logging
frontend/dex/config.js     network + per-tab contract addresses
frontend/dex/abi.js        ABI fragments, sourced from solidity/
frontend/dex/ui.js         DOM helpers (card, field, readout, actionButton)
frontend/dex/panels/       one module per tab
```

## Wings and tabs

`registry.js` is the only file that decides grouping:

| Wing | Tabs | Contracts |
|---|---|---|
| Dysnomia | LAU, QING, YUE | `solidity/dysnomia/11_lau.sol`, `solidity/dysnomia/domain/dan/03_qing.sol`, `solidity/dysnomia/domain/yue.sol` |
| Minters | Personal, Index, Federal | `solidity/{personal,index,federal}minter.sol` |

Each tab owns a route (`#/dysnomia/yue`), its own stored contract address, and a
lazily mounted panel that stays alive once built — switching tabs hides the node
rather than rebuilding it, so typed-in values survive.

## Adding a tab

1. Write `panels/<name>.js` exporting a default object:

```js
export default {
    id: "shio",
    label: "SHIO",
    sigil: "石",
    tagline: "One line under the tab title.",
    addressLabel: "SHIO contract address",
    build(ctx) { /* return a DOM node */ }
};
```

2. Add it to a wing's `tabs` array in `registry.js`.

That is the whole change: the rail, the tab bar, the route, the address bar and
the refresh cycle are all derived from the registry.

The `ctx` handed to `build()`:

| Member | Purpose |
|---|---|
| `ctx.address` | current contract address for this tab |
| `ctx.setAddress(v)` | repoint the tab (persists, refreshes) |
| `ctx.getExtra(n)` / `ctx.setExtra(n, v)` | extra stored addresses (e.g. a factory) |
| `ctx.onRefresh(fn)` | register a reader; runs on load, on Refresh, after every tx |
| `ctx.refresh()` | run all registered readers |

## Adding a wing

Append to `WINGS` in `registry.js` with `id`, `label`, `sigil`, `blurb` and its
`tabs`. Nothing else needs to change.

## Addresses

Resolution order per tab: `localStorage` (whatever the operator typed) →
`/api/config` (`dex` section, served by `scripts/server.js`) → the compiled
default in `config.js`. Defaults are seeded from `solidity/addresses.sol` and
the constants baked into the minter contracts; blanks are deliberate where the
deployed address is not pinned down in-repo.

## Verification status

The shell, routing and every panel build were exercised headlessly (jsdom) and
all ABI signatures were checked against the Solidity sources. Live reads and
writes against PulseChain have **not** been run — this sandbox has no route to
`rpc.pulsechain.com`. Before trusting the minter tabs with funds, confirm the
seeded minter addresses against your own deployment.
