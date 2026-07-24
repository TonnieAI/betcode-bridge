# BetCode Bridge
## API Access Request One-Pager

**BetCode Bridge** is a bet-slip translation tool that helps users move share codes and odds between bookmakers. We are requesting access to your official API or partner integration program so we can support a live, compliant bookmaker connection.

## Why this matters for your company

This integration can help you re-engage inactive customers, increase repeat usage, and make it easier for existing users to return to your platform. A faster bet-slip experience can reduce friction, improve retention, and create another reason for users to come back more often.

## What we need from you

- API base URL for sandbox and production
- Authentication method and required headers
- Share-code or bet-slip decode endpoint
- Request and response format
- Rate limits, quotas, and retry guidance
- Sandbox credentials and approval steps

## What we already have

- A working conversion interface
- A provider layer for bookmaker-specific integrations
- Normalized decoded-slip data structures
- A response mapper for share-code style payloads

## Expected response shape

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

## Request

If you support share-code, bet-slip, or odds APIs, we would appreciate documentation on how to apply for access and any steps required for production approval.

## Contact

**Name:** [Your Name]  
**Company/App:** [Company/App Name]  
**Email:** [Email Address]  
**Phone:** [Phone Number, optional]
