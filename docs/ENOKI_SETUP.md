# Enoki setup guide (Yeti Wells)

What Phase 2 needs to make **Sign in with Google (zkLogin)** + **gasless (sponsored) donate** work.
You do the console work below (I can't — it's account-gated); then hand me the three values in §4.

## 0. Mental model — you create THREE things
| Thing | Where | Used by | Secret? |
|---|---|---|---|
| **Google OAuth Client ID** | Google Cloud Console | frontend (zkLogin) | no (public) |
| **Enoki PUBLIC key** | Enoki Developer Portal | frontend `registerEnokiWallets` (zkLogin) | no (ships to browser) |
| **Enoki PRIVATE/secret key** | Enoki Developer Portal | backend `EnokiClient` (gas sponsorship) | **YES — server only** |

The flow: Google proves who the user is → Enoki turns that into a self‑custodial Sui address (zkLogin, no
seed phrase) → our backend uses the **secret** key to pay gas so the donor pays **zero** (sponsored tx).
Sponsorship is locked to only our Move functions via a **whitelist** (so the key can't be abused).

## 1. Google Cloud — create the OAuth Client ID  (do this first; Enoki needs the Client ID)
1. Go to <https://console.cloud.google.com> → create/select a project (e.g. "Yeti Wells").
2. **APIs & Services → OAuth consent screen**: choose **External**, fill app name + your email. While in
   "Testing" status, add **your Google account as a Test user** (otherwise sign‑in is blocked). No sensitive
   scopes needed — the default `openid`/`email`/`profile` is enough.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`  (Vite dev — our app)
     - add your deployed origin later (e.g. `https://yetiwells.vercel.app`) before the demo.
   - **Authorized redirect URIs** — REQUIRED (Enoki's zkLogin flow redirects here even though the window is a
     popup). Add **the app origin with a trailing slash**:
     - `http://localhost:5173/`  (and `http://localhost:5173` without the slash, to be safe)
     - add your deployed origin's `/` later (e.g. `https://yetiwells.vercel.app/`).
     > If you skip this you get `Error 400: redirect_uri_mismatch` — Google's error details show the exact
     > `redirect_uri` it expected (the app origin + `/`); register that value verbatim.
4. Copy the **Client ID** (looks like `xx…apps.googleusercontent.com`). You do **not** need the client secret.

## 2. Enoki Developer Portal — app, provider, keys, sponsorship
Portal: <https://portal.enoki.mystenlabs.com>
1. **Create a new app** (name it "Yeti Wells").
2. **Add an auth provider → Google**: paste the **Client ID** from §1. Make sure the provider is enabled for
   the **testnet** network (we're on testnet).
3. **API keys** — create both:
   - a **Public** key (client/zkLogin) → this is `VITE_ENOKI_PUBLIC_KEY`.
   - a **Private/secret** key (sponsored transactions) → this is `ENOKI_SECRET_KEY` (backend only).
   > Enoki's docs: sponsorship "requires using **private** API keys"; zkLogin sign‑in uses the **public** key.
4. **Sponsored Transactions** — enable it for this app and **whitelist our Move call targets** (so Enoki only
   pays gas for these exact functions). Add, for **testnet**, these three targets (current deployed package):
   ```
   0xa2090b3f15a42375b239a835d83bc86a3c1e4b4c76142529491236bc8d93d66a::donation::donate
   0xa2090b3f15a42375b239a835d83bc86a3c1e4b4c76142529491236bc8d93d66a::donation::donate_again
   0xa2090b3f15a42375b239a835d83bc86a3c1e4b4c76142529491236bc8d93d66a::impact_nft::sync_impact
   ```
   > ⚠️ If we ever re‑publish/upgrade the Move package, the package id changes → **update this whitelist**.
   > (Format is `package::module::function`. Per‑request `allowedMoveCallTargets` can narrow further, but the
   > portal whitelist is the one that gates sponsorship.)

## 3. Where the values go in our repo (I'll wire these in Phase 2)
Create these (already git‑ignored via `.gitignore` — never commit keys):

`app/.env.local` (frontend — only `VITE_`‑prefixed vars reach the browser; that's fine for public values):
```
VITE_ENOKI_PUBLIC_KEY=enoki_public_...
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_SUI_NETWORK=testnet
VITE_PACKAGE_ID=0xa2090b3f15a42375b239a835d83bc86a3c1e4b4c76142529491236bc8d93d66a
VITE_REGISTRY_ID=0x12e8905da2765dafc7362888e9309d8a8e94a9c745afafbc288887c6967157d9
```
`server/.env` (backend — the **secret** key lives here, NEVER with a `VITE_`/public prefix):
```
ENOKI_SECRET_KEY=enoki_private_...
```

## 4. What to hand me to start Phase 2
1. **Enoki PUBLIC key** (`enoki_public_…`)
2. **Enoki PRIVATE/secret key** (`enoki_private_…`) — paste it to me privately; I'll put it in `server/.env`
   (git‑ignored) and it stays server‑side.
3. **Google OAuth Client ID** (`…apps.googleusercontent.com`)

Confirm too: app created on **testnet**, Google provider added, the **3 targets whitelisted**.

## 5. Gotchas (from the live‑doc validation)
- **Popup flow still uses a redirect URI.** Google needs BOTH: **Authorized JavaScript origins** (`http://localhost:5173`)
  AND **Authorized redirect URIs** (`http://localhost:5173/`). Missing the redirect URI → `Error 400: redirect_uri_mismatch`
  (verified: the flow sends `redirect_uri=http://localhost:5173/`).
- **Never expose the secret key** to the browser (no `VITE_`/`NEXT_PUBLIC_` prefix). It only goes in `server/.env`.
- **Network must match**: Enoki wallets are bound to a network; we register on **testnet**. (If we add mainnet
  later, the wallet must be re‑registered for that network.)
- **API shape (current):** frontend uses `registerEnokiWallets({ apiKey: <public>, providers: { google: { clientId } }, client, network })`,
  called in a `useEffect` rendered **before** the wallet provider; sign‑in via dApp Kit's connect (popup).
  Backend `new EnokiClient({ apiKey: <secret> })` → `createSponsoredTransaction({ network, transactionKindBytes, sender, allowedMoveCallTargets })` → user signs → `executeSponsoredTransaction({ digest, signature })`.
  Build the bytes with `tx.build({ client, onlyTransactionKind: true })`.
- **dApp Kit note:** Enoki integrates with the **legacy `@mysten/dapp-kit`** (`SuiClientProvider`/`WalletProvider`),
  while our scaffold uses `@mysten/dapp-kit-react`. I'll reconcile this when wiring auth (likely swap the wallet/
  provider layer to legacy `@mysten/dapp-kit`).
- **Pricing:** paid tiers exist (~$69/mo Starter and up) plus a trial; a **testnet** hackathon demo is effectively
  free. Confirm current free/trial limits in the portal before any mainnet use.

## Sources
- Enoki docs — overview/portal: <https://docs.enoki.mystenlabs.com/>
- Enoki docs — register wallets (zkLogin, popup flow): <https://docs.enoki.mystenlabs.com/ts-sdk/register>
- Enoki docs — sponsored transactions (private key, build flow): <https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions>
- Google — OAuth client / JS origins setup: <https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow>
- Google — manage OAuth clients: <https://support.google.com/cloud/answer/15549257>
