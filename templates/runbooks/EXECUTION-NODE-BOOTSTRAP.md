# Runbook — bootstrap a Delivery OS Execution Node

> Turns any clean host into a Delivery OS **Execution Node**. The Execution Layer is a *platform*
> capability (this runbook + `templates/execution-node/`); the node only **instantiates** it. Run the
> same runbook on every node — the first becomes Execution Node 1; later nodes are identical and
> replaceable. **If the platform changes, nodes re-bootstrap; nothing canonical lives on a node.**
>
> **Legend:** 🤖 builder-automated · ✋ operator/founder action (auth · access grant · security/architectural
> approval · physical authorization).

## Prerequisites (the node provides the host; the platform provides the recipe)
- A clean machine you physically control (✋ physical authorization).
- The **builder** GitHub identity authenticated; engineering never runs as the founder identity.
- Outbound network. macOS arm64 is the current node class (the scripts extend to other classes).

## Phase A — base node (🤖, no grants) → satisfies `workstation` + `localCI`
1. 🤖 Toolchain: `git`, a Node version manager pinned to the stack's **22.x**, a package manager, `gh`.
2. 🤖 Identity: git `user.name`/`user.email` = builder (privacy noreply email); route HTTPS auth through
   the builder token; assert the active GitHub account is the builder before any write.
3. 🤖 Workspace: a node-local root holding clones of the platform + consumers (platform first, since
   consumers reference it as a sibling).
4. 🤖 Prove **localCI**: run a real project's verify (e.g. typecheck) locally — green, zero hosted minutes.
5. 🤖 `bash templates/execution-node/verify-node.sh` → expect the workstation + localCI floors PASS.

> ✅ A node that stops here is already a useful engineering + local-CI node. The capabilities below are
> opt-in and operator-gated.

## Phase B — runner capability (✋ security approval + token, then 🤖)
1. ✋ **Security approval** of the hardened posture: dedicated non-admin OS user · repo-level scope ·
   `--ephemeral` · private-repo-only · high-value secrets kept off-scope.
2. ✋ Create the dedicated non-admin user (needs sudo / physical auth):
   `sudo sysadminctl -addUser ghrunner -fullName "Delivery OS Runner" -password -`
3. ✋ Provide a **registration token** for the one private repo this node serves — from the repo's
   *Settings → Actions → Runners → New runner*, **or** authorize the builder to mint one:
   `gh api -X POST repos/<owner/repo>/actions/runners/registration-token --jq .token`
4. 🤖 `REG_TOKEN=… bash templates/execution-node/provision-runner.sh --repo <owner/repo> \
   --labels self-hosted,arm64 --runner-user ghrunner`
5. 🤖 Render + load the runner service from `launchd/com.deliveryos.runner.plist.template` (run as `ghrunner`).
6. 🤖 Smoke test: a `workflow_dispatch` job targeting `runs-on: [self-hosted, arm64]` goes green; then
   `verify-node.sh --require runner`.

## Phase C — heartbeat capability (🤖; uses an endpoint + secret you supply)
1. ✋ Provide the engine tick **endpoint** + its shared **secret** (access grant).
2. 🤖 `HEARTBEAT_SECRET=… bash templates/execution-node/provision-heartbeat.sh --endpoint <url> \
   --interval 300 --load`  → an always-on `*/5` tick the serverless tier can't honour.
3. 🤖 `verify-node.sh --require heartbeat`; observe a tick advance a test run.

## Phase D — mesh capability (✋ device auth, then 🤖)
1. 🤖 `bash templates/execution-node/provision-tailscale.sh --tag tag:execution-node` (installs only).
2. ✋ Join the device yourself: `sudo tailscale up …` (authentication stays in your hands); scope ACLs.

## Decommission / replace a node
- `cd <runner-home> && ./config.sh remove --token <removal-token>` ; unload launchd services ;
  delete the `ghrunner` user. Nothing platform-canonical is lost.
- To **replace** a node: run this runbook on the new host. It becomes Execution Node 1 again, executing
  the same unchanged Delivery OS.

## The standing operator surface (after a node is fully live)
Only: ✋ authentication / access grants (tokens, auth-keys, secret values) · ✋ security approval
(authorizing execution infra) · ✋ architectural approval (platform changes) · ✋ physical authorization
(the machine and what network it joins). Everything else is 🤖.
