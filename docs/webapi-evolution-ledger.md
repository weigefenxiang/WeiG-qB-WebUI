# qBittorrent WebAPI evolution ledger

本文件说明 WebAPI evolution ledger 的长期用途。它是**兼容 evidence index**，不是产品 roadmap，也不是 runtime compatibility owner。

Machine-readable source：

```text
tools/data/qb-webapi-evolution-ledger.json
```

当前 audited WebAPI v2 window：

```text
qBittorrent 4.1.0 / WebAPI 2.0.0
-> qBittorrent 5.2.3 / WebAPI 2.15.1
65 admitted official stable profiles
```

Alpha/Beta/RC/master 不进入正式 Frozen stable matrix。

## 1. Ledger 回答什么

```text
upstream WebAPI 历史发生了什么变化？
证据在哪里？
这个变化由哪个 source/simulator/product owner 消费？
是否仍有未建模的 evidence gap？
```

它不直接回答：

```text
正式 webui/** 是否已经在所有 real qB stable 上正确工作？
```

后者必须由 formal product contracts + real-qB evidence 证明。

## 2. Terminal classifications

```text
SOURCE_DERIVED
CONTRACT_COVERED
MISSING
NOT_APPLICABLE
```

`UNCLASSIFIED` 禁止作为终态。

含义：

- `SOURCE_DERIVED`：结构事实已由 source catalog 拥有；
- `CONTRACT_COVERED`：当前 simulator/evidence contract 已建模该 observable boundary；
- `MISSING`：已知 evolution evidence 尚未进入相应模拟/证据 owner；
- `NOT_APPLICABLE`：没有合理 simulator/runtime responsibility。

`CONTRACT_COVERED` 不自动等于正式产品 compatibility complete。

## 3. Product-first priority

处理一个 ledger delta 前，先判断它与 `webui/**` 的关系：

```text
PRODUCT_BLOCKER
PRODUCT_NORMALIZATION
PRODUCT_EMULATION
UNAVOIDABLE_PRODUCT_GAP
SIMULATOR_ONLY / UNUSED_BY_PRODUCT
```

优先级按产品影响，不按 ledger 顺序或 `MISSING` 数量。

正确流程：

```text
ledger/upstream delta
-> map to formal webui/** caller/owner
-> confirm official source truth
-> fix product normalization/emulation if needed
-> add direct product contracts
-> update Virtual qB contract/profile if useful
-> add real-qB evidence where relevant
```

降低 `MISSING` 数量本身不是产品成功指标。

## 4. Owner map

Evidence/simulator owner：

```text
NEW/REMOVED endpoint -> source apiActions/catalog
PREFERENCE          -> Preference source pipeline
TORRENT_SURFACE     -> Torrent surface parser/catalog
PARAM/RESPONSE/
STATUS/MUTATION     -> simulator Endpoint Contract
TRANSPORT           -> simulator Transport Contract
NOT_APPLICABLE      -> ledger only
```

Formal product owner 另见：

```text
W.QBClient              # transport + detected identity
W.CapabilityRegistry    # runtime compatibility/current release/source facts
W.SettingsSchema        # Settings Preference semantics/write proof
W.TorrentSemantics      # Torrent status/filter canonical semantics
W.TorrentFieldRegistry  # Torrent field/column projection + user overrides
```

旧 browser runtime `W.ReleaseProfile` owner 已退休；ledger/source catalog 可以保留离线 release/source evidence，但不得要求正式 `webui/**` 恢复 release-profile runtime、`qb-releases.json` 或 per-release profile shards。

不要混淆 simulator owner、离线 source evidence 与 formal product owner。

## 5. Compatibility examples

### qB4/qB5 action names

```text
qB4 resume/pause
qB5 start/stop
```

正式解决属于 `W.CapabilityRegistry` 提供的 source-proven action facts + canonical product action owner；simulator 只负责准确复现对应 upstream 行为。

### Torrent filter names

```text
qB4 paused/resumed
qB5 stopped/running
```

正式 normalize 属于 `W.CapabilityRegistry + W.TorrentSemantics`；不得恢复已退休 release-profile owner，也不得把版本分支散落到 UI caller。

### Historical response/parameter changes

例如 Category shape、`editTracker`、`torrents/add`、Basic Auth、peer `host_name` 等差异，可以由 ledger/source evidence 记录，并在 simulator Endpoint/Transport Contract 中复现；如果正式 UI 消费这些差异，还必须在当前 canonical product owner 中证明正确处理。

## 6. Future stable

新的 official stable：

```text
discover exact tag/source identity
-> generate source facts/profile evidence
-> compare evolution facts
-> product impact analysis
-> compatibility implementation if required
-> regenerate/audit compact runtime contracts
-> simulator/evidence update if useful
-> admission review
```

Unknown future semantics 不允许猜测。Fail-close 是安全机制，不是最终产品目标。

## 7. 与现行 CI 的关系

仓库不再维护独立 `Upstream Compatibility Audit` workflow。

发布级 source/product audit 由现行 CI/candidate 流程承担：

```text
generate exact stable source catalog
-> audit every official stable >= 4.1.0
-> full stable PRODUCT compatibility matrix
```

全版本真实 runtime 证明由 `Real qB Full Frozen Matrix` 手动执行。

Candidate / release-grade 流程只有用户明确授权后才进入；ledger 本身不能成为自动创建 `[candidate]` 或启动 heavy matrix 的理由。详细流程见 `docs/006.发布与晋级流程.md`。

## 8. Working rule

Ledger 是 chronology/evidence authority；`docs/010.真实qB产品兼容路线.md` 是正式兼容策略 authority。

发生冲突时：

```text
official source/runtime truth
-> admitted source evidence
-> canonical product owner
-> evidence tools/docs
```

不要为了保留旧 ledger/test expectation 修改正确产品语义，也不要把离线 release/profile evidence重新升级成 browser runtime owner。