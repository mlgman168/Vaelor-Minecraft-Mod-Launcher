# Vaelor Chat Relay

This is the tiny backend used by `.Chat [message]`.

## Deploy

1. Push this `relay` folder to GitHub.
2. Deploy it on a Node host such as Render, Railway, Fly.io, or a small VPS.
3. Set the start command to `npm start` and the root directory to `relay`.
4. After deployment, update `relay/relay-config.json`:

```json
{
  "enabled": true,
  "relayUrl": "https://your-vaelor-relay.example.com"
}
```

Vaelor clients fetch that config from GitHub, so changing the URL does not require a client update.

## Endpoints

- `GET /health`
- `GET /v1/chat?after=0&joinedAt=0&server=example.org`
- `POST /v1/chat`

The relay keeps recent messages in memory only. Messages are filtered by the Minecraft server label, hidden from clients who joined after they were sent, and pruned after `VAELOR_MESSAGE_TTL_MS` (default: 10 minutes). Restarting the host clears everything.
