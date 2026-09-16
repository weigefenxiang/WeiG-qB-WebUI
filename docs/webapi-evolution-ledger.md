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
upstream WebAPI/source UI 历史发生了什么变化？
证据在哪里？
这个变化由哪个 source/simulator/product owner 消费？
是否仍有未建模的 evidence gap？
```

它不直接回答“正式 `webui/**` 是否已经在所有 real qB stable 上正确工作”。后者必须由 formal product contracts + browser/real-qB evidence证明。

## 2. Terminal classifications

```text
SOURCE_DERIVED
CONTRACT_COVERED
MISSING
NOT_APPLICABLE
```

`UNCLASSIFIED` 禁止作为终态。

- `SOURCE_DERIVED`：结构事实已由 source catalog/compact-source pipeline拥有；
- `CONTRACT_COVERED`：当前 simulator/evidence contract已建模该 observable boundary；
- `MISSING`：已知 evolution evidence尚未进入相应模拟/证据 owner；
- `NOT_APPLICABLE`：没有合理 simulator/runtime responsibility。

`SOURCE_DERIVED` 或 `CONTRACT_COVERED` 都不自动等于正式产品 compatibility complete。

## 3. Product-first priority

处理一个 ledger delta前，先判断它与 `webui/**` 的关系：

```text
PRODUCT_BLOCKER
PRODUCT_NORMALIZATION
PRODUCT_EMULATION
UNAVOIDABLE_PRODUCT_GAP
SIMULATOR_ONLY / UNUSED_BY_PRODUCT
```

正确流程：ledger/upstream delta -> map to formal owner -> confirm official source truth -> fix product normalization/emulation if needed -> direct product contracts -> update Virtual qB if useful -> real-qB evidence where relevant。

降低 `MISSING` 数量本身不是产品成功指标。

## 4. Source/evidence owner map

```text
NEW/REMOVED endpoint         -> source apiActions/catalog
ACTION PARAMETER             -> apiActionParameters / source-actions.json
PREFERENCE API descriptor    -> Preference source pipeline
PREFERENCES native surface   -> qb-preferences-surface-source + qb-preferences-compact
RSS native surface           -> qb-rss-surface-source + qb-rss-compact
TORRENT surface/filter       -> Torrent source parser/catalog
DETAIL native UI             -> torrentDetailUi/detail source pipeline
qB-owned source/context copy -> qB UI/source inventory + translation source pipeline
PARAM/RESPONSE/STATUS        -> simulator Endpoint Contract where product/evidence consumes it
TRANSPORT                    -> simulator Transport Contract
NOT_APPLICABLE               -> ledger only
```

Formal product owner另见：

```text
W.QBClient              # transport + detected identity
W.CapabilityRegistry    # runtime compatibility/current release/source facts
W.SettingsSchema        # current Settings runtime; A target consumes source-native compact facts
W.TorrentSemantics      # Torrent status/filter canonical semantics
W.TorrentFieldRegistry  # Torrent field/column projection + user overrides
RSSRules                # current canonical RSS rule UI consumer of rss-compat
W.QbUiEvidence          # Detail source projection
```

旧 browser runtime `W.ReleaseProfile` owner已退休；ledger/source catalog可以保留离线 release/source evidence，但不得要求正式 `webui/**` 恢复 release-profile runtime、`qb-releases.json` 或 per-release profile shards。

## 5. Ledger != completeness proof

Ledger记录“已知 evolution事实”，但不能单独证明 upstream没有未知/新语法被 extractor漏掉。A–F source-driven domain的 completion还需要独立 inventory/census：

```text
upstream inventory = mapped + explicit reviewed exclusions
unaccounted = 0
duplicates = 0
```

例如 Preferences extractor可以成功输出60%+映射并通过 bounded regression gate，但这不等于剩余 upstream controls已被逐项解释。Census看到而semantic extractor未映射的新 item必须触发 review/fail closed，而不是继续标记 ledger healthy。

## 6. Compatibility examples

### qB4/qB5 action names

```text
qB4 resume/pause
qB5 start/stop
```

正式解决属于 `W.CapabilityRegistry` source-proven action facts + canonical product action owner；simulator只准确复现对应 upstream行为。

### Torrent filter names

```text
qB4 paused/resumed
qB5 stopped/running
```

正式 normalize属于 `W.CapabilityRegistry + W.TorrentSemantics`；不得恢复已退休 release-profile owner，也不得把版本分支散落到 UI caller。

### Native UI surface changes

Preferences/RSS/Sidebar/Detail的 tab、control、field、copy、order变化属于 source UI事实；应进入对应 source inventory/compact domain，而不是被 WebAPI ledger中的 version if/else取代。WebAPI值与source UI semantic是两层 evidence，不能互相推导不存在的事实。

## 7. Future stable

新的 official stable：

```text
discover exact tag/source identity
-> verify Frozen prefix
-> run independent inventory + semantic extraction
-> compare evolution/source facts
-> product impact analysis
-> review unaccounted items
-> compatibility implementation if required
-> regenerate common-identity compact contracts
-> simulator/evidence update if useful
-> admission review
```

Unknown future semantics不允许猜测。Fail-close是安全机制，不是最终产品目标。

## 8. 与现行 CI 的关系

发布级 source/product audit由现行 CI/candidate流程承担；本轮 A–F 另外使用 `native-surfaces` source-admission lane做 focused/all-admitted source extraction evidence。当前用户禁止创建/使用 `[candidate]`，因此该 source lane不能被解释为 Candidate授权。

全版本真实 runtime证明由 `Real qB Full Frozen Matrix` 手动执行，并只应在 A–F全部完成且 final dev SHA冻结后按 `docs/011`启动。

## 9. Working rule

Ledger是 chronology/evidence authority；`docs/010.真实qB产品兼容路线.md` 是正式兼容策略 authority；`docs/014` 是当前 mutable TODO/handoff authority。

发生冲突时：

```text
official source/runtime truth
-> admitted source evidence + independent inventory
-> canonical product owner
-> evidence tools/docs
```

不要为了保留旧 ledger/test expectation修改正确产品语义，也不要把离线 release/profile evidence重新升级成 browser runtime owner。
