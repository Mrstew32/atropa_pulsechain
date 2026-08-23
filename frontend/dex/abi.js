// Human-readable ABI fragments for every contract the DEX talks to.
// Sources: solidity/dysnomia/11_lau.sol, solidity/dysnomia/domain/dan/03_qing.sol,
// solidity/dysnomia/domain/yue.sol and solidity/{personal,index,federal}minter.sol.

// Shared DYSNOMIA / ERC20 surface.
export const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)",
    "function transfer(address to, uint256 value) returns (bool)"
];

const DYSNOMIA_CORE = [
    ...ERC20_ABI,
    "function Type() view returns (string)",
    "function maxSupply() view returns (uint256)",
    "function owner(address) view returns (bool)",
    "function GetMarketRate(address) view returns (uint256)",
    "function Purchase(address _t, uint256 _a)",
    "function Redeem(address _t, uint256 _a)",
    "function Rename(string newName, string newSymbol)",
    "function mintToCap()"
];

export const LAU_ABI = [
    ...DYSNOMIA_CORE,
    "function Username() view returns (string)",
    "function Username(string newUsername)",
    "function Chat(string chatline)",
    "function Alias(address name) view returns (string)",
    "function Alias(address name, string value)",
    "function Withdraw(address what, uint256 amount)",
    "function Saat(uint256) view returns (uint64)",
    "function Leave()"
];

export const LAU_FACTORY_ABI = [
    "function New(string name, string symbol) returns (address)"
];

export const QING_ABI = [
    ...DYSNOMIA_CORE,
    "function Asset() view returns (address)",
    "function Cho() view returns (address)",
    "function Waat() view returns (uint256)",
    "function Entropy() view returns (uint64)",
    "function GWAT() view returns (bool)",
    "function NoCROWS() view returns (bool)",
    "function CoverCharge() view returns (uint256)",
    "function BouncerDivisor() view returns (uint16)",
    "function AddMarketRate(address Contract, uint256 Rate)",
    "function Join(address UserToken)",
    "function Admitted(address UserToken) view returns (bool)",
    "function Chat(address UserToken, string MSG)",
    "function bouncer(address) view returns (bool)",
    "function setBouncerDivisor(uint16 _d)",
    "function setCoverCharge(uint256 _c)",
    "function setStaff(address _a, bool active)",
    "function setGuestlist(address _a)",
    "function removeGuest(address _a)",
    "function AllowCROWS(bool _b)",
    "function Withdraw(address what, uint256 amount)",
    "event LogEvent(string Username, uint64 Soul, uint64 Aura, string LogLine)"
];

export const YUE_ABI = [
    ...ERC20_ABI,
    "function Type() view returns (string)",
    "function maxSupply() view returns (uint256)",
    "function owner(address) view returns (bool)",
    "function Origin() view returns (address)",
    "function Chan() view returns (address)",
    "function IsValidAsset(address GwatAsset, address Integrative) view returns (bool)",
    "function GetAssetRate(address GwatAsset, address Integrative) view returns (uint256)",
    "function Hong(address SpendAsset, address QingAsset, uint256 PurchaseAmount)",
    "function Hung(address QingAsset, address ReceiveAsset, uint256 RedeemAmount)",
    "function Bar(address Qing) view returns (uint256 Hypogram, uint256 Epigram)",
    "function React(address Qing) returns (uint256 Charge)",
    "function ChangeOrigin(address NewOrigin)",
    "function MintToOrigin()"
];

// NT — the deployer half of every minter.
const MINTER_BASE = [
    "function New(string Name, string Symbol, uint256 InitialMint, address Parent) returns (address)",
    "function TreasuryTokens(address) view returns (address)",
    "function GetTreasuryTokenOwner(address ctx) view returns (address)",
    "function Transfer(address ctx, address newOwner)"
];

export const PERSONAL_MINTER_ABI = [
    ...MINTER_BASE,
    "function GetStandardTokenParent(address ctx) view returns (address)",
    "function NewGai(string Name, string Symbol) returns (address)",
    "function NOTS() view returns (address)",
    "function SKILLS() view returns (address)",
    "function NINE() view returns (address)"
];

export const INDEX_MINTER_ABI = [
    ...MINTER_BASE,
    "function GetStandardTokenParent(address ctx) view returns (address)"
];

export const FEDERAL_MINTER_ABI = [...MINTER_BASE];

// TT — the token half. Claim() differs between personal and the others, and only
// the federal TT carries the Debenture/publish lifecycle.
const TT_BASE = [
    ...ERC20_ABI,
    "function Parent() view returns (address)",
    "function Creator() view returns (address)",
    "function _hu(address) view returns (uint8)",
    "function mint(uint256 amount)",
    "function burn(uint256 amount)",
    "function ha()",
    "function hu(address h, uint8 allow)",
    "function withdraw(address token, uint256 value)"
];

export const PERSONAL_TT_ABI = [
    ...TT_BASE,
    "function PersonalMinter() view returns (address)",
    "function Mint() view returns (uint256)",
    "function Multiplier(uint256 addition) view returns (uint256)",
    "function Claim(uint256 Amount)"
];

export const INDEX_TT_ABI = [
    ...TT_BASE,
    "function IndexMinter() view returns (address)",
    "function Debenture() view returns (bool)",
    "function Multiplier(uint256 addition) view returns (uint256)",
    "function Claim(address Contract, uint256 Amount)"
];

export const FEDERAL_TT_ABI = [
    ...TT_BASE,
    "function V2Minter() view returns (address)",
    "function Debenture() view returns (bool)",
    "function publish()",
    "function Claim(address Contract, uint256 Amount)"
];
