# Bookmaker Integration Spec

This is the contract BetCode Bridge expects from a live bookmaker share-code API.

## Recommended endpoint

`POST /share-code/decode`

## Request

Headers:

- `Authorization: Bearer <token>` or `X-API-Key: <key>`
- `Content-Type: application/json`

Body:

```json
{
  "shareCode": "waxec6",
  "sourceBookmaker": "bet9ja"
}
```

## Response

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "shareCode": "waxec6",
    "outcomes": [
      {
        "eventId": "sr:match:...",
        "eventName": "Team A vs Team B",
        "marketName": "1X2",
        "specifier": null,
        "odds": "1.85"
      }
    ]
  }
}
```

## Minimum fields needed

- `shareCode`
- `outcomes[]`
- `eventId`
- `eventName`
- `marketName`
- `specifier`
- `odds`

## Useful extras

- `kickoff` or event start time
- explicit outcome selection label
- market status or suspension flag
- pagination or batching support for large slips

## Notes

- The current app maps this response into the internal decoded-slip model.
- If kickoff time is not returned, the app can still operate, but the result is less precise.
