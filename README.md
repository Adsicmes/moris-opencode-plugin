# @moris/opencode-plugin

OpenCode v2 server plugin for **Moris LLMGateway**. It registers exactly one provider, `moris`, and syncs the gateway's model catalog.

```jsonc
{
  "plugins": [
    {
      "package": "@moris/opencode-plugin",
      "options": { "baseUrl": "https://gateway.example.com", "apiKey": "设备密钥" }
    }
  ]
}
```

- Model per protocol package: OpenAI Chat, OpenAI Responses, Anthropic Messages.
- Subscription models cost 0; a fully stated USD token price maps directly. Complex, per-request, unknown, CNY or incomplete token prices stay callable with `cost: []` and a “（价格见网关）” name hint — never a fabricated zero, never hidden.
- The `moris` namespace is fully gateway-managed: models removed upstream disappear, and provider settings are reconciled to the plugin configuration. Other providers are untouched.
- Supplier `syncedAt` plus 24 h controls availability; a local cache write never extends it.
- Refreshes every five minutes, keeps the last successful catalog on failure, replays the first catalog after startup, and disposes its timer and hooks.
- Retry is forced off for `moris` only; WebSocket is disabled with `settings.transport: "http"`.
- The device key is never stored in the catalog cache, and no user configuration file is written.

Full behaviour, limitations and verification notes: [`docs/clients.md`](../../docs/clients.md).
