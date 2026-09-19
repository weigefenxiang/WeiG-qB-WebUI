# qBittorrent WebAPI evolution ledger



> **A3 当前交接事实（dev 160473f13c5c）**：Product VERSION **0.3.125**；A3已推dev但exact-SHA CI #35442179347 与 Virtual qB Pages #35442186315 FAIL。首要blocker是Settings runtime/common Frozen catalog identity未一致；main未移动、未创建/使用 `[candidate]`。当前仍为 **🟡 A3 IN_PROGRESS**；TODO只看 `docs/014` STOP 前。
> **2026-09-19 A3交接同步**：本文件已按当前 A–F 方案复核。mutable current status / blocker / TODO / next-AI handoff 只维护在 `docs/014.AI协作与分支纪律.md` 的 `STOP — COMPLETED ARCHIVE BELOW` 之前；本文件只维护本领域 authority/contract。具体 exact SHA、Actions 与运行结果在实际开发前必须 fresh-read，不以本注记代替 repository truth。

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
PREFERENCES inventory        -> qb-preferences-inventory + qb-preferences-census-source
PREFERENCE value projection  -> qb-preferences-value-projection
RSS native surface           -> qb-rss-surface-source + qb-rss-compact
TORRENT surface/filter       -> Torrent source parser/catalog
DETAIL native UI             -> torrentDetailUi/detail source pipeline
qB-owned source/context copy -> qB UI/source inventory + translation source pipeline
CATALOG identity             -> qb-catalog-identity + domain compilers
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

Preferences现在已经建立独立 census：raw source中的 native tabs、read/write app/preferences identities与 source-proven controls由独立 inventory路径发现，再与 semantic manifest accounting；full-stable contract要求全部 admitted release的 `tabs / preferences / bindings` census complete，并在 unaccounted/overlap/escaped/duplicate时失败。

因此 Preferences 的 60%+ mapping ratio现在只用于监测 semantic parser是否发生大幅退化，**不再承担 completeness proof**。A仍未完成的原因是 source-native IR尚未原子替换 formal `W.SettingsSchema -> Renderer` 手工 runtime truth，而不是因为 Preferences census缺失。其它 B/C/D/E/F domain仍需要各自的独立 census/coverage closure。

## 6. Preferences value projection 是独立 evidence 维度

Preference getter/setter/type相同，不代表 native UI与 API raw value可以直接互拷。当前 source pipeline会另外记录 source-derived value projection：

```text
identity
scale
switch-map
unproven
```

并携带 `safeWrite`。例如 source可证明 bytes/s <-> KiB/s或 bytes <-> MiB的 scale；历史 composite只有 read-side switch map、没有可信 inverse时必须 `safeWrite:false`。若 exact descriptor是 writable string、native control属于 text/select/password/textarea且 source明确 direct identity setter，则可额外记录 `writeIdentity:true`，只证明该 string写回安全；不能据此推导 numeric/composite inverse。

这类 projection属于 source UI semantics，不应降级成手工 `META.scale`、版本 if/else或仅由 WebAPI ledger推断。正式 A runtime完成后，Settings危险写回必须同时满足 API descriptor provenance与 source projection write safety。

## 7. Compatibility examples

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

### Native Settings tabs

固定 native Settings tab allowlist已经从 compact tooling退休；tab presence/order来自 exact `qbOwnedUi` 的 `settings.tab.*` facts。Future第九个 tab应通过 source inventory/admission进入，而不是更新一个八项白名单。

### Native UI surface changes

Preferences/RSS/Sidebar/Detail的 tab、control、field、copy、order变化属于 source UI事实；应进入对应 source inventory/compact domain，而不是被 WebAPI ledger中的 version if/else取代。WebAPI值与source UI semantic是两层 evidence，不能互相推导不存在的事实。

## 8. Common catalog identity

当前 tooling已经存在 common Frozen catalog identity，并已用于 capabilities/torrent/detail/actions/settings compact outputs以及 Preferences keyed native IR。它的目的是让后续 integrated F closure可以证明所有 runtime domain来自同一 admitted release/source set。

这项 foundation尚未完全闭环：RSS仍需纳入同一 compiler/identity链，formal runtime/distribution也仍需对全部 domain执行 mixed/stale identity拒绝。Ledger不得把“helper已经存在”误记成“F integrated closure已完成”。

## 9. Future stable

新的 official stable：

```text
discover exact tag/source identity
-> verify Frozen prefix
-> run independent inventory + semantic extraction
-> compare evolution/source/value-projection facts
-> product impact analysis
-> review unaccounted items
-> compatibility implementation if required
-> regenerate common-identity compact contracts
-> simulator/evidence update if useful
-> admission review
```

Unknown future semantics不允许猜测。Fail-close是安全机制，不是最终产品目标。

## 10. 与现行 CI 的关系

发布级 source/product audit由现行 CI/candidate流程承担；本轮 A–F另外使用 `native-surfaces` source-admission lane做 focused/all-admitted source extraction evidence。当前用户禁止创建/使用 `[candidate]`，因此该 source lane不能被解释为 Candidate授权。

Source extractor自身也受性能约束。可预索引的 exact release source应一次建立索引后bounded查询；禁止让每个 Preference/field重新扫描整份 source形成明显 O(N×source)回归，并靠延长 CI timeout掩盖。

全版本真实 runtime证明由 `Real qB Full Frozen Matrix` 手动执行，并只应在 A–F全部完成且 final dev SHA冻结后按 `docs/011`启动。

## 11. Working rule

Ledger是 chronology/evidence authority；`docs/010.真实qB产品兼容路线.md` 是正式兼容策略 authority；`docs/014` 是当前 mutable TODO/handoff authority。

发生冲突时：

```text
official source/runtime truth
-> admitted source evidence + independent inventory
-> canonical product owner
-> evidence tools/docs
```

不要为了保留旧 ledger/test expectation修改正确产品语义，也不要把离线 release/profile evidence重新升级成 browser runtime owner。


## 12. A3 Settings source facts / current gap（2026-09-19）

5.2.3 exact source目前已提供并进入Preferences IR的事实包括：RSS Downloader bounded source action、network interface/address dynamic option providers、WebUI Password setter-only/write-only语义、Scheduler `time_padding()` presentation、RSS Downloader disabled source/context copy。它们属于SOURCE_DERIVED，并已存在0.3.125 product consumer代码；但当前formal runtime仍因common Frozen `sourceCatalogSha256` identity mismatch fail closed，所以不能把SOURCE_DERIVED记成CONTRACT_COVERED/product-complete。下一步先统一Settings runtime materialization identity，再运行真实browser interaction gate。
