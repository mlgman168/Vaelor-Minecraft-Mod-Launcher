# Vaelor Chat Relay

This is the tiny backend used by `.Chat [message]`.

## Deploy On Render

1. Open Render and create a new Blueprint from this GitHub repo.
2. Render will use the root `render.yaml` file and run the `relay` folder.
3. Copy the deployed service URL, such as `https://vaelor-chat-relay.onrender.com`.
4. In GitHub, add these repository secrets:
   - `RENDER_DEPLOY_HOOK_URL`: Render service deploy hook URL.
   - `VAELOR_RELAY_URL`: the public relay URL.
5. Run the `Deploy Chat Relay` GitHub Action.

The workflow deploys the service, waits for `/health`, and updates `relay/relay-config.json` so Vaelor clients can discover the live relay automatically.

## Endpoints

- `GET /health`
- `GET /v1/chat?after=0&joinedAt=0&server=example.org`
- `POST /v1/chat`

The relay keeps recent messages in memory only. Messages are filtered by the Minecraft server label, hidden from clients who joined after they were sent, and pruned after `VAELOR_MESSAGE_TTL_MS` (default: 10 minutes). Restarting the host clears everything.
