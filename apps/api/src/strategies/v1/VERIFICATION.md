# V1 Trading Decision Logging - Verification Checklist

## Overview
V1 strategy implements deterministic trading decisions with risk policy checks in paper mode (no actual orders placed).

## Quick Start

1. **Start server:**
   ```bash
   pnpm -C apps/api dev
   ```

2. **Start agent-v1:**
   ```bash
   curl -X POST http://localhost:3001/agents/agent-v1/control \
     -H "Content-Type: application/json" \
     -d '{"action":"start"}'
   ```

3. **Wait 60 seconds for first tick, then verify:**

## Verification Commands

### 1. Check agent exists
```bash
curl http://localhost:3001/agents
```
**Expected:** `agent-v1` appears in the list with `strategyType: "v1"`

### 2. Get decision logs
```bash
curl "http://localhost:3001/agents/agent-v1/decisions?limit=10"
```
**Expected:** Returns JSON with:
- `decisions`: Array of decision logs
- Each decision has:
  - `agentId`: "agent-v1"
  - `timestamp`: ISO string
  - `summary`: String (e.g., "SKIP: No eligible markets" or "READY: 1 intent(s) generated")
  - `reasoningBullets`: Array of strings
  - `risk`: Object with `checksPassed[]`, `checksFailed[]`, `blocked: boolean`
  - `intents`: Array (empty if blocked/skipped)
  - `filledCount`: 0 (paper mode)
  - `rejectedCount`: 0 or number of blocked intents

### 3. Get replay data with decisions
```bash
curl "http://localhost:3001/replay?agentId=agent-v1"
```
**Expected:** Returns JSON with:
- `agentId`: "agent-v1"
- `equity`: Array (may be empty initially)
- `trades`: Array (empty in paper mode)
- `decisions`: Array of decision logs with timestamps

### 4. Get decisions with time range
```bash
# Get decisions from last hour
curl "http://localhost:3001/replay?agentId=agent-v1&from=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)&to=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```
**Expected:** Returns decisions within the time range

### 5. Verify decision structure
```bash
curl "http://localhost:3001/agents/agent-v1/decisions?limit=1" | jq '.decisions[0]'
```
**Expected structure:**
```json
{
  "agentId": "agent-v1",
  "timestamp": "2025-12-26T12:00:00.000Z",
  "summary": "READY: 1 intent(s) generated",
  "reasoningBullets": [
    "Filtered 5 markets, 3 eligible",
    "Selected market: Will X happen?",
    "Edge: 2.5% (model: 52.5%, market: 50.0%)",
    "Position size: 50 shares @ $0.500 (stake: $25.00)"
  ],
  "risk": {
    "checksPassed": [
      {
        "check": "max_risk_per_trade",
        "passed": true,
        "reason": "Trade risk $25.00 <= max $50.00"
      },
      {
        "check": "max_total_exposure",
        "passed": true,
        "reason": "Total exposure $25.00 <= max $200.00"
      },
      {
        "check": "bankroll_sufficient",
        "passed": true,
        "reason": "Total cost $25.00 <= bankroll $1000.00"
      }
    ],
    "checksFailed": [],
    "blocked": false
  },
  "intents": [
    {
      "marketId": "market-...",
      "side": "BUY",
      "outcome": "YES",
      "shares": 50,
      "limitPrice": 0.5,
      "reason": "V1 strategy: Edge 2.50% >= 2%"
    }
  ],
  "filledCount": 0,
  "rejectedCount": 0,
  "metadata": {
    "strategyVersion": "v1",
    "paperMode": true,
    "marketsConsidered": 10
  }
}
```

### 6. Verify SKIP decisions
If no markets meet criteria, you should see:
```bash
curl "http://localhost:3001/agents/agent-v1/decisions?limit=1" | jq '.decisions[0].summary'
```
**Expected:** `"SKIP: No eligible markets after filtering"` or `"SKIP: No market with edge >= 2%"`

### 7. Verify BLOCKED decisions
If risk checks fail, you should see:
```bash
curl "http://localhost:3001/agents/agent-v1/decisions?limit=1" | jq '.decisions[0]'
```
**Expected:** 
- `summary`: `"BLOCKED: X risk check(s) failed"`
- `risk.blocked`: `true`
- `risk.checksFailed`: Array with failed checks
- `intents`: Empty array (cleared when blocked)

## Expected Behavior

1. **Every 60 seconds:** Agent-v1 generates a DecisionLog
2. **Paper mode:** No orders are placed (`filledCount: 0`)
3. **Deterministic:** Same market conditions produce same decisions
4. **Risk checks:** All intents are checked against RiskPolicy
5. **Timestamps:** All timestamps are ISO strings

## Troubleshooting

- **No decisions appearing:** Check agent status is "running"
- **All decisions are SKIP:** Markets may not meet filter criteria (spread, liquidity, edge)
- **All decisions are BLOCKED:** Risk policy may be too strict, check `checksFailed` array

