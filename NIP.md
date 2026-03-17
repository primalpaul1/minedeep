# SatMiner - Custom Nostr Event Kinds

## House Account (Escrow)

SatMiner uses a dedicated house account that acts as an escrow for all game funds. All entry fees are zapped to the house account's Lightning address. When a winner is determined, the house pays out the full pot to the winner. If no one joins within 1 hour, entry fees are refunded to all paid players.

The house account's nsec is embedded in the client. The payout is triggered by the winning player's browser, which signs a zap request from the house account to the winner's Lightning address.

## Kind 35303 — Game Lobby (Addressable)

Represents a SatMiner game room. Created by the host when they create a new game. Updated as players join and the game status changes.

### Tags

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Unique game identifier |
| `bet` | Yes | Entry fee amount in satoshis |
| `seed` | Yes | Deterministic seed for generating the game grid and bitcoin position |
| `status` | Yes | Game status: `waiting`, `playing`, or `finished` |
| `max_players` | No | Maximum number of players (default: 8) |
| `p` | No | Pubkeys of players who have joined (one tag per player, excludes host) |
| `t` | Yes | Always `satminer` for discoverability |
| `alt` | Yes | NIP-31 human-readable description |

### Example

```json
{
  "kind": 35303,
  "content": "",
  "tags": [
    ["d", "satminer-1710000000000-abc123"],
    ["bet", "100"],
    ["seed", "satminer-1710000000000-abc123-pubkey-1710000000000"],
    ["status", "waiting"],
    ["max_players", "8"],
    ["p", "<player2-pubkey>"],
    ["t", "satminer"],
    ["alt", "SatMiner game lobby - a multiplayer Bitcoin mining game"]
  ]
}
```

### Payment Flow

1. **Entry fees** are paid via NIP-57 zaps to the **house account** (not the game host). The zap request references the lobby event for tracking.
2. **Payment verification** is done by querying kind 9735 zap receipts targeting the lobby event's `a` tag coordinate (`35303:<host-pubkey>:<game-id>`). Each player's payment is verified by checking the zap request's `pubkey` field.
3. **Payouts** are triggered when the winner is determined. The house account signs a zap request to the winner's Lightning address.
4. **Refunds** are triggered if no players join within 1 hour of game creation. The house account signs zap requests back to each paid player's Lightning address.

## Kind 1159 — Game Action (Regular)

Represents a player action during gameplay (movement, mining). Published in real-time as players interact with the game.

### Tags

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Game identifier (matches the lobby's `d` tag) |
| `e` | No | Reference to the lobby event ID (used for join actions) |
| `p` | No | Reference to the host pubkey (used for join actions) |
| `t` | Yes | Always `satminer` |
| `alt` | Yes | NIP-31 human-readable description |

### Content

JSON-encoded action object:

```json
{ "type": "move", "direction": "down" }
{ "type": "swing" }
{ "type": "join" }
```

### Action Types

| Type | Description | Fields |
|------|-------------|--------|
| `move` | Player moves in a direction | `direction`: `up`, `down`, `left`, `right` |
| `swing` | Player swings their pickaxe | — |
| `join` | Player requests to join a game | — |

## Kind 7107 — Game Result (Regular)

Published when a player finds the Bitcoin and wins the game.

### Tags

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Game identifier |
| `p` | Yes | Host pubkey |
| `t` | Yes | Always `satminer` |
| `alt` | Yes | NIP-31 human-readable description |

### Content

```json
{ "result": "win", "gameId": "satminer-1710000000000-abc123" }
```
