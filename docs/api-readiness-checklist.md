# API Readiness Checklist

Use this before sending a bookmaker integration request.

## Business readiness

- Clear product summary
- One-paragraph explanation of the bookmaker benefit
- Short demo or screenshots of the current flow
- Simple support contact and company identity

## Technical readiness

- Defined request format for bet-slip decoding
- Defined response model for share-code translation
- Error handling path for unavailable or invalid codes
- Logging strategy that avoids storing secrets
- Rate limit handling and retry policy
- Ability to disable the integration if the API is down

## Security and compliance

- API keys stored in environment variables
- No hardcoded credentials in source control
- Basic privacy note for user data
- Confirmation whether production access needs approval

## Current project status

- The app already has a decoder/provider abstraction in `src/lib/providers`
- The current decoder flow is simulated until a live API is provided
- The app can be wired to a real endpoint without changing the UI contract
