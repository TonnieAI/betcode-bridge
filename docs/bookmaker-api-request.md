# Bookmaker API Access Request Packet

## Purpose

BetCode Bridge translates bet codes across bookmakers and reuses converted slips to improve user engagement. The strongest commercial value for a bookmaker is reactivating inactive customers, increasing repeat sessions, and making it easier for users to return to the platform through a low-friction bet-slip workflow.

## Short Email

Subject: Request for API Access / Integration Partnership

Hello [Bookmaker Team/Name],

I’m building a bet-slip translation and odds comparison app and would like to request access to your official API or partner integration program.

This integration could benefit your company by re-engaging inactive customers, increasing repeat usage, and creating a smoother experience that encourages more betting activity on your platform. It can also help bring back users who have not been active recently by making it easier to reuse existing bet slips.

We’re looking for documentation covering:
- Authentication method
- Available endpoints
- Request and response formats
- Rate limits and usage terms
- Any approval steps required for production access

If you support share-code, bet-slip, or odds APIs, I’d appreciate details on how to apply and what information you need from us to get started.

Thank you for your time. I’d be glad to share more about the use case if helpful.

Best regards,
[Your Name]
[Company/App Name]
[Email Address]
[Phone Number, optional]

## What to Ask For

- Base URL for sandbox and production
- Authentication scheme
- Required headers and signing rules
- Share-code decode endpoint, if available
- Odds lookup endpoint, if available
- Supported markets and response schema
- Rate limits, quotas, and IP allowlisting rules
- Test credentials and sandbox sample payloads

## What We Already Have

- A conversion UI that accepts bet codes
- A provider abstraction for bookmaker-specific decoders
- Normalized bet-slip types for decoded selections
- A mapper for share-code-style API responses

## What We Still Need From the Bookmaker

- Real endpoint URL
- Auth credentials or onboarding steps
- Exact request format for decoding a share code
- Sample response payloads
- Sandbox access for testing
- Production approval criteria

## Technical Summary for Partners

The app expects a response shape similar to:

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

The integration can be adapted to any equivalent schema if the bookmaker uses different field names.