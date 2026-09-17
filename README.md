# x402 Chat

Android chat app with a [Cloudflare Agent](https://developers.cloudflare.com/agents/) that can pay for HTTPS APIs on Solana.

You send a message. The agent lives on a Cloudflare Worker (a Durable Object). If it needs data from an [x402](https://www.x402.org/) endpoint, the phone pays that request with [Pay Kit](https://www.npmjs.com/package/@solana/pay-kit) and a Privy in-app Solana wallet, then the agent answers from the paid response.

**Android only.** Sign-in uses Solana Mobile Wallet Adapter, which does not run on iOS or web. You need a custom Expo development build, not Expo Go.

## What it does

When you ask for paid data, the agent searches the Pay catalog, reads the selected operation's request contract, and calls `request_x402_payment`. The app validates the URL, method, and JSON body against that catalog operation before it:

1. Signs the payment with the Privy in-app Solana wallet
2. Lets Pay Kit handle the HTTP 402, settle USDC on Solana mainnet, and retry the request
3. Sends the paid body and Solana transaction signature back to the agent
4. Shows the call as a collapsed **x402** row in chat

There is no approval screen. If the in-app wallet is funded and ready, the payment goes through. Try `Get a paid BTC-USD bid/ask snapshot`. Endpoints must be HTTPS operations published in the Pay catalog. The agent supplies the catalog method and any required JSON body.

## Wallets

Two wallets, two jobs.

| Wallet | Library | Job |
| --- | --- | --- |
| Sign-in | [Solana Mobile Wallet Adapter](https://docs.solanamobile.com/mobile-wallet-adapter/overview) via [`@wallet-ui/react-native-kit`](https://www.npmjs.com/package/@wallet-ui/react-native-kit) | Connect Phantom, Solflare, or another MWA wallet on the phone. Sign in to Privy with Solana. |
| In-app | [Privy](https://docs.privy.io/guide/expo) embedded Solana wallet | Pays x402 calls. This is the wallet Pay Kit signs with. |

Connect the sign-in wallet, sign in, then create or recover the Privy in-app wallet. Fund the in-app wallet with SOL for fees and USDC on Solana mainnet for x402. The sign-in wallet never pays.

## How it fits together

```
Android app  --chat-->  Cloudflare Worker (ChatAgent Durable Object)
     ^                              |
     |                              |  request_x402_payment
     |                              v
     +-- Pay Kit (x402) -------- HTTPS resource
            Privy in-app wallet signs
            USDC on Solana mainnet
```

- Agent: [`agents`](https://www.npmjs.com/package/agents) and [`@cloudflare/ai-chat`](https://www.npmjs.com/package/@cloudflare/ai-chat)
- Payments: [`@solana/pay-kit`](https://www.npmjs.com/package/@solana/pay-kit) and [`@solana/kit`](https://www.npmjs.com/package/@solana/kit)
- Model: Anthropic Claude Haiku when `ANTHROPIC_API_KEY` is set, otherwise Cloudflare Workers AI (`@cf/zai-org/glm-4.7-flash`)

## Requirements

- [Bun](https://bun.sh)
- Android Studio and an Android device or emulator
- A Solana wallet app on that device that supports Mobile Wallet Adapter
- A [Privy](https://dashboard.privy.io) app with Expo and embedded Solana wallets enabled
- Optional: an [Anthropic API key](https://console.anthropic.com/settings/keys)

## Setup

```bash
bun install
cp .env.example .env
cp worker/.dev.vars.example worker/.dev.vars
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_CLOUDFLARE_AGENT_HOST` | Yes | Worker URL. Local default is `http://127.0.0.1:8787`. |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Yes | Privy app id. |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Yes | Privy Expo client id. |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | Yes | Solana mainnet RPC. |
| `ANTHROPIC_API_KEY` | Recommended | Chat model. Copy the same value into `worker/.dev.vars`. |
| `EXPO_PUBLIC_MOCK_AI` | No | Set to `1` to stream mock replies and skip the Worker. |

```bash
bun run worker:dev
bun run android
```

The Worker lives in `worker/`. Chat does not stream until the app can reach `EXPO_PUBLIC_CLOUDFLARE_AGENT_HOST`.

First run: **Settings → Wallet** → connect a Solana wallet → sign in → create or initialize the in-app wallet → fund it → ask for a paid URL.

## Stack

Expo SDK 56, React Native, Expo Router. Cloudflare Workers and Durable Objects for the agent. Solana Mobile Wallet Adapter and Privy for wallets. Pay Kit for x402 on Solana mainnet.

## Attribution

Fork of [EvanBacon/chat-template](https://github.com/EvanBacon/chat-template) (MIT). That template is the chat UI this app started from.
