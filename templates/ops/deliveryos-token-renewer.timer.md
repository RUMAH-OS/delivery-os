# systemd equivalent of the token-renewer (Linux nodes)

For a Linux execution node, use a systemd user timer instead of the launchd plist.

`~/.config/systemd/user/deliveryos-token-renewer.service`
```ini
[Unit]
Description=Delivery OS service-token auto-renewer (renew GOALS_API_TOKEN before expiry from the vault)

[Service]
Type=oneshot
Environment=DELIVERYOS_VAULT=/opt/deliveryos/vault
# Environment=DELIVERYOS_ALERT_WEBHOOK=https://hooks.slack.com/services/…
ExecStart=/usr/bin/node /opt/deliveryos/rumah-admin/scripts/renew-service-token.mjs --once --env prod \
  --token-key GOALS_API_TOKEN --ttl 2592000 --threshold 604800 --sub svc-neo --aud service
```

`~/.config/systemd/user/deliveryos-token-renewer.timer`
```ini
[Unit]
Description=Run the Delivery OS token-renewer daily

[Timer]
OnCalendar=*-*-* 04:17:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
systemctl --user daemon-reload
systemctl --user enable --now deliveryos-token-renewer.timer
systemctl --user start deliveryos-token-renewer.service   # run once now
journalctl --user -u deliveryos-token-renewer -n 20        # audit lines only — never a value
```

The master key comes from the `0600` vault key file / Keychain, not from the unit. Do not put secrets
in the unit. The renewer emits only audit lines (name + verdict) to the journal; the token/secret
value never appears.
