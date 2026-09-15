from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[1]

def write(rel,text):
    p=ROOT/rel
    p.write_text(text.strip()+"\n",encoding='utf-8')

def replace_once(rel,old,new):
    p=ROOT/rel
    text=p.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{rel}: expected one anchor, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')

# Pages must assert the compact dev runtime that Phase B already validated.
replace_once('.github/workflows/pages.yml',
'''          test -s "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/data/qb-releases.json"\n          test -s "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/data/qb-settings-native.txt"''',
'''          test ! -e "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/data/qb-releases.json"\n          test ! -e "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/data/qb-release-profiles"\n          test ! -e "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/scripts/release-profile.js"\n          test -s "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/data/qb-settings-native.txt"''')
replace_once('.github/workflows/pages.yml',
"if(dist.ownedCopyRegistry!=='private/data/qb-settings-native.txt'||dist.legacySettingsAssets!==false||Number(dist.qmAssets)<1",
"if(dist.runtimeCompatibility!=='compact-contracts-only'||dist.legacyReleaseRuntime!==false||dist.ownedCopyRegistry!=='private/data/qb-settings-native.txt'||dist.legacySettingsAssets!==false||Number(dist.qmAssets)<1")

write('docs/001.项目总方案.md',r'''
# 001. 项目总方案

Status: **current project authority / stable project overview**

WeiG qB WebUI 是 qBittorrent Alternative WebUI。`webui/**` 是唯一正式产品，并且从 0.3.99 起本身就是可直接复制运行的 self-contained runtime；tools、source catalog、Virtual qB、CI 与 Pages 只负责生成、审计、验证与发布证据，不能反向成为浏览器运行依赖。

本文件只维护长期目标、正式边界、authority 与当前高层状态。**Git history 是版本历史档案**；docs 不再按 WeiG 版本号新增复盘/下一 AI 交接文件。当前未完成事项只维护在 `docs/014.AI协作与分支纪律.md`。

## 1. 长期目标与兼容原则

```text
qBittorrent 4.1.0 official stable
-> all admitted official stable releases
-> current latest official stable
-> future official stable / future major
```

未知能力不得靠版本号猜；危险 write 必须在 HTTP 前 fail closed。一个 semantic purpose 只有一个 Current Owner；禁止 old/new 双 active、MutationObserver repair、monkey patch、post-render repair、第二 polling/state/layout/language owner。

## 2. 当前基线

截至 2026-09-16：

```text
repository/product VERSION: 0.3.99
latest published WeiG Release/tag: v0.3.61
main: stable promoted baseline; do not move without explicit authorization
dev: active; current HEAD must always be fresh-read
qB support floor: 4.1.0 official stable
latest admitted stable: 5.2.3
Frozen stable profiles: 65
0.3.99 validated runtime-retirement product checkpoint: 5251bfa207a757af332b9592659296fca2a2d9d4
Phase B validation: Compact runtime retirement #9 / run 34994376073 SUCCESS
```

`VERSION = 0.3.99` 不代表 `v0.3.99` 已发布；正式 Release 仍为 `v0.3.61`。SHA 只作已验证 checkpoint，current `dev` 必须 fresh-read。

## 3. 当前正式架构

```text
qB WebAPI
   ↓
W.QBClient
   ↓
W.CapabilityRegistry ← capabilities.json / torrent-compat.json / detail-compat.json / source-actions.json
   ↓
product semantic owners
   ↓
WeiG UI

Settings Preference semantics ← settings-compat.json + W.SettingsSchema
qB-owned copy                ← qb-settings-native.txt + minimal official QM

qB official source / release catalog
   ↓
tools / CI / simulator evidence
   ↓
validate compact runtime contracts
```

Browser runtime 已退休旧 release-profile owner、`private/data/qb-releases.json` 与 `private/data/qb-release-profiles/`。65-release catalog 继续作为离线 source/CI/simulator evidence，不进入 dev 正式浏览器 runtime。

## 4. Universal Portable

raw `webui/` 与 materialized distribution 都必须自包含：正常运行不依赖 Node、tools、simulator、CI、GitHub 或在线翻译服务。Distribution 只负责 exact `GIT_SHA`、ZIP/checksum、manifest/installer 等发布身份，不再为 dev 生成 per-release browser profiles。

## 5. Authority

`docs/002` 维护 current facts；`docs/003` 维护架构 owner；`docs/005` 维护 Settings/Locale/i18n；`docs/007` 维护安装/distribution；`docs/008` 维护 Torrent workspace；`docs/010` 维护兼容策略；`docs/014` 是唯一 mutable handoff/TODO authority；`docs/015` 是长期硬规则；`DESIGN.md` 是 Current Owner/UI/design final authority。

## 6. 分支纪律

所有开发先进入 `dev`。每个 write batch 前 fresh-read `dev`，更新 ref 前再次 race-check，只允许 fast-forward，禁止 force push。未经用户明确授权不得移动 `main`、使用 `[candidate]`、promotion/tag/Release 或手动 release-grade matrix。
''')

write('docs/002.兼容与实现状态.md',r'''
# 002. 兼容与实现状态

Status: **current compatibility / implementation / evidence facts**

本文件只记录当前仍有效的产品兼容事实、已实现能力和验证边界；历史过程由 Git history / Actions / artifacts 保存。Current HEAD 与 Actions 必须 fresh-read。**当前未完成事项只维护在 `docs/014.AI协作与分支纪律.md`**。

## 1. 当前产品状态

```text
repository/product VERSION: 0.3.99
latest published Release/tag: v0.3.61
qB support floor: 4.1.0 official stable
latest admitted stable: 5.2.3
Frozen stable profiles: 65
validated product checkpoint: 5251bfa207a757af332b9592659296fca2a2d9d4
Compact runtime retirement #9 / run 34994376073: SUCCESS
```

该 run 对最终 0.3.99 产品工作树完成：repository contracts、65-profile product owner matrices、self-contained dist + dev/main Pages split、Chrome product evidence、race-check 与正式 product commit，全部 PASS/SUCCESS。

兼容优先级继续面向 **future official stable / future major**，不得靠 hard-coded major 拒绝未来版本。qB 4.0.x **不属于当前实现/CI 范围**，未来可选；正式支持底线保持 qB 4.1.0 official stable。

## 2. Runtime compatibility truth

当前浏览器 compatibility owner 为 `W.CapabilityRegistry`。它消费 checked-in compact contracts，并结合 `W.QBClient` 检测的 qB/WebAPI identity 解析 exact/equivalent/bounded inherited/fallback 状态。`W.QBClient` 只拥有 transport 与运行实例版本检测，不重新拥有 capability/version policy。

运行时 compact contracts 是 **source-derived / 上游源码生成** 的兼容真值。正式 runtime 不再包含旧 release-profile owner、`qb-releases.json` 或 per-release profile shards；qB official source、65-release catalog、完整 translation/source evidence 只留在 tools/tests/CI/simulator，用来生成或审计 compact contracts。

## 3. Runtime assets

raw `webui/` 现在直接携带：

```text
private/data/capabilities.json
private/data/torrent-compat.json
private/data/detail-compat.json
private/data/settings-compat.json
private/data/source-actions.json
private/data/qb-settings-native.txt
translations/webui_*.qm
VERSION
```

必须不存在：`private/scripts/release-profile.js`、`private/data/qb-releases.json`、`private/data/qb-release-profiles/`、旧 Settings translation shards 与 full recovery runtime bodies。

## 4. Settings / Locale

Preference current value/presence 只来自 `app/preferences`。`W.SettingsSchema + settings-compat.json` 拥有 Preference semantic/type/setter descriptor；certified write gate 来自当前 compatibility identity；`W.QBClient.setPreferences()` 后必须 `getPreferences()` verification reread。唯一 persisted language truth 仍是 `app/preferences.locale`。

qB-owned copy 走 `W.I18n` + `qb-settings-native.txt` + source-proven official QM/bridge；`4.5.0 -> 4.6.4` Alternative WebUI translation hard gap保持 exact bridge，不因 QM 存在而伪装 native。

## 5. Torrent / Detail protected state

`W.TorrentSemantics`、`W.TorrentFieldRegistry`、`W.Selection/ActionRegistry`、`W.QbUiEvidence`、`W.SharedColumns`、`W.ColumnInteraction`、`W.VirtualList` 等既有唯一 owner 不变。Files 必须保持 qB response order 与 exact source file index；synthetic folder != qB source file；file/folder Rename provenance独立；Tracker 使用 exact URL；Peer flags 本地 source-pinned；Copy browser-local；transport mutation只经 QBClient；checked Tag removal必须 exact `removeTagsAction`；unknown dangerous write零 HTTP。

## 6. Evidence boundary

**Linux/Windows browser evidence** 证明真实浏览器产品行为；**Full qB stable WebAPI evolution audit** 证明 all-stable 上游源码/API 演进。Ordinary CI、Virtual qB、Pages/browser、real-qB 与 release-grade matrix各自证明不同层级，不能互相冒充；`SKIPPED != PASS`，旧 SHA PASS 不自动证明新 SHA。Promotion/main/tag/Release仍需用户明确授权。
''')

write('docs/003.项目架构.md',r'''
# 003. 项目架构

Status: **current architecture / Current Owner boundaries**

`webui/**` 是唯一正式产品。浏览器 runtime 的 release-profile layer 已退休；source catalog 是离线验证/编译证据，不是 runtime owner。

## 1. 总体分层

```text
qB WebAPI
-> W.QBClient                    # transport + detected identity
-> W.CapabilityRegistry          # runtime compatibility/current release facts
   <- capabilities.json
   <- torrent-compat.json
   <- detail-compat.json
   <- source-actions.json
-> canonical semantic owners
-> UI / presentation

settings-compat.json -> W.SettingsSchema
qb-settings-native.txt + minimal QM -> W.I18n

qB official source / release catalog
-> tools / CI / simulator audit
-> generate/validate compact contracts
```

## 2. Current Owner map

```text
HTTP transport / detected identity         W.QBClient
Runtime release/capability/source facts    W.CapabilityRegistry
Settings Preference semantics              W.SettingsSchema + settings-compat.json
Persisted language truth                   qB app/preferences.locale
qB-owned/WeiG copy                         W.I18n
Torrent status/filter semantics            W.TorrentSemantics
Torrent field/column provenance            W.TorrentFieldRegistry
Selection/torrent actions                  W.Selection / ActionRegistry
Main virtual/scroll projection             W.VirtualList
Detail source schema/descriptors           W.CapabilityRegistry
Detail source projection                   W.QbUiEvidence
Detail generic dispatch                    app.js descriptor consumer
Detail user columns                        W.SharedColumns
Detail resize/reorder lifecycle            W.ColumnInteraction
Transfer runtime/history                   W.TransferRuntime
Responsive placement                       W.MobileAdaptive / W.SpatialRuntime
Settings presentation                      W.SettingsRenderer
```

一个 semantic purpose只能有一个 Current Owner。正式 cutover必须 new owner proven + callers switched + contracts/docs更新 + superseded runtime删除；禁止 runtime alias、repair layer、第二 polling/state/scroll owner。

## 3. Compatibility / writes

`W.CapabilityRegistry` 从 compact source facts解析 Torrent filters/info fields/table columns/Detail UI/source actions。UI key不是 API proof；unknown upstream shape fail closed。Dangerous write必须具备 certified identity + exact action/parameter provenance，并由 `W.QBClient` transport；不能用 patch/major version猜 endpoint。

Settings write additionally要求 `W.SettingsSchema` 的 setter/type agreement并在 POST 后 reread verification。

## 4. Torrent Detail / shared table

```text
W.CapabilityRegistry.torrentDetailUi()
-> W.QbUiEvidence
-> generic app Detail runtime
-> W.SharedColumns / W.ColumnInteraction / existing W.VirtualList
-> W.QBClient
```

General只消费 source-generated layout；Files/Trackers/Peers/Web Seeds共用 generic renderer/action chain；同一 viewport/columns state，禁止 per-surface第二 schema、第二 scroll owner或 endpoint-name业务分支。

## 5. Build/runtime boundary

65 stable source catalog、full translation recovery、upstream source parser属于 tools/CI/simulator。raw `webui/` 只携带浏览器真正消费的 compact contracts/copy/QM，因此可直接作为 Alternative WebUI root。Historical `main=0.3.71` simulator preview 可在 `branch==='main'` 的 simulator-only build 路径临时物化旧 profile runtime；不得回流到 dev formal product。

## 6. Validation

Source audit、65-profile Virtual qB、browser/Pages、real-qB、Candidate/Release 是不同 evidence 层。`SKIPPED != PASS`；exact-SHA evidence不可跨提交偷用。
''')

write('docs/005.统一交互与设置系统.md',r'''
# 005. 统一交互、Settings 与 Locale 系统

Status: **current Settings / Locale / qB-owned copy / shared interaction contract**

## 1. Settings owner

当前 Preference presence/value 只来自 `GET /api/v2/app/preferences`。`W.SettingsSchema + private/data/settings-compat.json` 拥有 Preference surface/type/unit/enum/getter/setter descriptor；当前 release certified/write provenance gate来自 runtime compatibility identity；`W.QBClient` 只 transport。

```text
user edit
-> current Preference exists
-> SettingsSchema exact descriptor proves writable/type
-> certified write provenance
-> QBClient.setPreferences()
-> QBClient.getPreferences() verification reread
-> verified value becomes truth
```

Unknown/unproven values只读，危险 write fail closed。

## 2. Locale / qB-owned copy

唯一 persisted language truth是 `qB app/preferences.locale`。qB-owned wording不维护第二手写翻译表，统一走 `W.I18n`：exact source/context + `qb-settings-native.txt` + source-proven official QM；只有 source-proven Alternative WebUI hard gap才使用 compact official-TS bridge。

`4.5.0 -> 4.6.4` 的 document-translation gap继续保留。完整 TS/recovery/source evidence只在 tools/CI，最终 runtime只携带实际引用的 compact registry与 minimal QM。

## 3. Self-contained runtime

```text
capabilities.json / torrent-compat.json / detail-compat.json / source-actions.json
settings-compat.json
qb-settings-native.txt
translations/webui_*.qm
```

`release-profile.js`、`qb-releases.json`、`qb-release-profiles/`、旧 per-release Settings/translation shards 已退休，不得回流。

## 4. Shared interaction

Settings/Detail复用 canonical `W.Components` 与 shared Input/Button/Dialog/Select；Detail tables复用 `W.SharedColumns / W.ColumnInteraction`。Desktop/Mobile只是同一 state 的 adaptive presentation，不建立第二控件、action、language、scroll或polling owner。

## 5. Detail copy/action chain

```text
W.CapabilityRegistry.torrentDetailUi()
-> W.QbUiEvidence
-> generic Detail runtime
-> W.CapabilityRegistry.actionDescriptor()
-> W.QBClient for transport
```

Copy等 source-proven local action继续 browser-local。无法证明 required parameter/endpoint/action时零 HTTP。

## 6. Validation

必须持续证明 app/preferences truth、setter/type safety、locale verification、4.5.0-4.6.4 hard gap、minimal QM、old runtime absence与 Universal Portable self-contained。Promotion/main/tag/Release另需用户授权。
''')

write('docs/007.安装升级与手动部署.md',r'''
# 007. 安装、升级与手动部署

Status: **current installation / upgrade / Dev distribution / Windows config authority**

## 1. 产品形态

从 0.3.99 起，仓库中的 raw `webui/` 本身就是 self-contained Alternative WebUI root；复制完整目录到受支持 qB 主机即可运行。Materialized distribution 不再生成 per-release browser profiles，只在同一 runtime 上加入 exact `GIT_SHA`、manifest、ZIP/checksum 与 installers 等发布身份。

正常运行不得依赖 Node、tools、simulator、GitHub 或在线语言资产。

## 2. Runtime contract

runtime至少包含：

```text
private/data/capabilities.json
private/data/torrent-compat.json
private/data/detail-compat.json
private/data/settings-compat.json
private/data/source-actions.json
private/data/qb-settings-native.txt
translations/webui_*.qm
VERSION
GIT_SHA                  # materialized/exact distribution
```

必须不存在 `private/scripts/release-profile.js`、`private/data/qb-releases.json`、`private/data/qb-release-profiles/`、旧 Settings shards 或 full recovery runtime bodies。单静态文件继续低于 qB 10 MiB hard limit与项目 5 MiB target。

## 3. Dev installer

**Dev installer 只消费 Dev Pages 暴露的 exact-SHA materialized distribution，不允许 raw-source fallback。** raw `webui/` 可直接运行是产品自包含属性，不代表 installer 可以绕过 exact-SHA/manifest/checksum provenance。

Windows bootstrap仍从 `WeiG-qB-WebUI/dev/installers/install.ps1` 获取当前 dev installer；Linux/NAS 对应 `dev/installers/install.sh`。正式 payload继续来自 `downloads/dev`。

Pages Source只有在完整 compare证明 head advance与 materialized public payload无关时才可复用旧 payload；Unknown fail closed。

## 4. Stable installer

Stable只消费 immutable GitHub Release tag + `WeiG-qB-WebUI.zip` + `SHA256SUMS` + embedded VERSION/GIT_SHA。禁止 fallback到 moving branch/raw source。

## 5. Windows qB config safety

外部 config mutation必须 raw bytes strict decode -> byte-identical backup -> temp write -> invariant reread -> target-unchanged check -> safe replace -> post-write verify -> failure rollback。禁止 PowerShell whole-file `Get-Content/Set-Content` 默认编码重写；qB仍运行且可能写 config时必须拒绝 unsafe concurrent mutation。Installer-owned backup最多3份，先验证新 backup/更新 pointer，再 prune。

## 6. Upgrade / rollback

替换 WeiG product bytes != 删除 qB user config/Torrent data。失败时按实际阶段恢复 previous product folder或 byte-identical config backup，不做多余 mutation。

## 7. Simulator historical compatibility

当前 dev formal runtime永不物化 release profiles；只有为了预览未晋级的历史 `main=0.3.71`，simulator 的 `branch==='main'` 隔离路径可从离线 source catalog生成旧 runtime。该路径不能成为 dev/product owner。
''')

write('docs/008.Torrent工作区与状态所有权.md',r'''
# 008. Torrent 工作区与状态所有权

Status: **current Torrent main/detail ownership authority**

## 1. Product owner chain

```text
compact source facts -> W.CapabilityRegistry
-> W.TorrentSemantics / W.TorrentFieldRegistry / W.QbUiEvidence
-> W.LibraryController / W.Selection / W.SharedColumns
-> generic Detail runtime
-> W.QBClient HTTP boundary
-> canonical presentation
```

`W.VirtualList` 是主 Torrent list唯一 virtual/scroll projection owner；polling在横向滚动期间继续，但只保留 latest pending snapshot并在 bounded idle flush。禁止第二 scroll/poll/state owner。

## 2. Main columns / filters / actions

Exact certified column/source facts由 `W.CapabilityRegistry.torrentFieldFacts()` 投影给 `W.TorrentFieldRegistry`；用户 visibility/order/width只是 override。Filter support由 CapabilityRegistry + TorrentSemantics canonicalize；caller不写 patch-version分支。Torrent More/right-click只有一个 ActionRegistry；Category/Tags truth实时来自 qB；checked tag remove必须 exact `removeTagsAction`；Copy browser-local，其余 mutation/export走 QBClient。

## 3. Torrent Detail

```text
W.CapabilityRegistry.torrentDetailUi()
-> W.QbUiEvidence
-> generic Detail runtime
-> W.SharedColumns / W.ColumnInteraction / existing viewport
-> W.CapabilityRegistry.actionDescriptor()
-> W.QBClient
```

Tabs/General/tables/context menus都消费同一 compact source manifest。General只一次 properties read；Files/Trackers/Peers/Web Seeds不建立 per-surface renderer/action owner。Header/body同 column definition；`.shared-table__viewport`是唯一 table scroll owner。

## 4. Files provenance

qB files response order与 exact source file index必须保持。Synthetic folder只是 presentation，绝不是 qB source file。Folder aggregation只读；folder/file context共用 canonical owner但 folder不继承 file-only Priority。

File Rename只在 exact `renameFileAction` provenance存在时发送；Folder Rename独立要求 `renameFolderAction`。两者不能互相推断。Collapse/re-expand用 stable child anchor/bounded fallback；sticky parent与 hierarchy继续使用同一 viewport，无 MutationObserver/scroll sync/第二 data owner。

## 5. Tracker / Peer / General

Tracker business value保持 exact `torrents/trackers.url`；presentation ellipsis不得改变 write/copy地址。Peer flags使用 source-pinned local qB assets + deterministic ISO fallback，无第三方 CDN truth。General layout来自 source-generated property layout；没有 proof即 omission/fail closed，不恢复手写 fallback。

## 6. Write boundary

Generic mutation链固定为 source availability -> CapabilityRegistry action descriptor -> endpoint agreement -> required/optional parameter binding -> QBClient。无法证明 required binding、source action或endpoint时必须在 HTTP 前阻断。桌面客户端 Open/Open containing folder等无 WebAPI provenance能力不得伪造。
''')

write('docs/010.真实qB产品兼容路线.md',r'''
# 010. 真实 qB 产品兼容策略

Status: **current compatibility strategy**

## 1. 长期目标

qB 4.1.0 official stable -> all admitted stable -> current latest -> future stable/major。`UNKNOWN` 表示无法证明；危险 write必须 fail closed。

## 2. Source truth first，runtime compact

```text
qB official source / official TS
-> tools extractors + admitted Frozen LKG
-> generate/audit compact runtime contracts
-> W.CapabilityRegistry / W.SettingsSchema / W.I18n
-> W.QBClient
-> product UI
```

Browser不加载 release catalog或 per-release profile shards。Version只用于 detected identity、exact/equivalent/bounded inherited resolution、diagnostics/evidence；禁止 `major >= N => feature=true` 或 future自动继承 dangerous writes。

## 3. Capability granularity

Category/Tags/Tracker/Settings/Detail等 read/write/action/field/parameter独立证明。一个 mutation需要多个 action/parameter时必须 all-required proven。可靠 historical shape差异可 NORMALIZED/DERIVED，但必须 deterministic、bounded、无 N->N requests、无第二 state；否则 READ_ONLY/UNAVAILABLE/UNKNOWN。

## 4. Fail-closed writes

Transport前必须证明 certified current identity、source action/endpoint、required parameters与 payload semantics。Settings另要求 Preference setter/type agreement。Unknown action/parameter、missing setter、type mismatch、unproven structured value、unsafe inherited/future write均零 HTTP。

## 5. Frozen LKG / new stable

65-release Frozen LKG是离线验证基线，不是 browser runtime。新 stable admission必须 verify frozen prefix -> extract new facts -> focused diff/review -> regenerate compact contracts -> product/browser validation后才能 admission。当前 operational范围 4.1.0 -> 5.2.3。

## 6. Translation / evidence layers

qB-owned wording遵循 exact source/context + translator behavior -> native official QM或 source-proven exact bridge；4.5.0 -> 4.6.4 hard gap不得 nearest inheritance。Source audit、Virtual qB、Pages/browser、real-qB、release-grade matrix是不同证据层，不能互相替代。
''')

write('docs/014.AI协作与分支纪律.md',r'''
# 014. AI 协作与分支纪律

Status: **single current handoff authority**

长期硬规则以 `docs/015.开发硬规则（长期版）.md` 为最高约束。本文件是唯一 mutable handoff / 当前未完成事项 authority；历史过程由 Git history / Actions / artifacts 保存。

## 1. 接手顺序

完整阅读：015 -> 014 -> 001 -> 002 -> 003 -> 005 -> 006 -> 007 -> 008 -> 009 -> 010 -> 011 -> DESIGN.md；然后 fresh-read `dev`、`main`、VERSION、latest Release/tag 与 current dev exact-SHA Actions。任何文档 SHA 只能当 checkpoint。

完成上述阅读与 fresh-read 后，如果 current `dev`没有新的 deterministic failure且本文明确方案已完成，应停止主动修改并等待用户新方案。

## 2. 当前产品状态

```text
repository/product VERSION: 0.3.99
latest published Release/tag: v0.3.61
qB support floor: 4.1.0 official stable
latest admitted stable: 5.2.3
Frozen stable profiles: 65
validated product checkpoint: 5251bfa207a757af332b9592659296fca2a2d9d4
Compact runtime retirement #9 / run 34994376073: SUCCESS
```

0.3.99 已完成 browser runtime release-profile layer 退休：raw `webui/` 直接包含 compact compatibility contracts、`qb-settings-native.txt` 与 minimal official QM；`release-profile.js`、`qb-releases.json`、profile shards已从 formal runtime物理删除。`W.CapabilityRegistry` 是 runtime compatibility/current release facts owner，`W.QBClient` 只拥有 transport/detected identity，`W.SettingsSchema` 单独拥有 Preference semantics/settings-compat。qB source/catalog继续只作为 tools/CI/simulator evidence。

## 3. 已验证 evidence

Run `34994376073` 对同一 0.3.99 产品工作树完成 full repository contracts、65-profile product matrices、self-contained dev dist、dev/main Pages split、Chrome product evidence与最后 race-check/commit，全部 SUCCESS。正式 product commit为 `5251bfa207a757af332b9592659296fca2a2d9d4`。

Protected state继续包括：Detail hero/General/shared tables、Files source order/index与 synthetic folder separation、file/folder Rename独立 provenance、one ActionRegistry、live Category/Tags truth、removeTags独立证明、local Copy、Peer local flags、Settings verified writes、Locale single truth、VirtualList single owner与所有 dangerous-write fail-closed规则。

## 4. 当前未完成事项判定

**当前批准的 0.3.99 compact-runtime / raw-webui-self-contained 方案已经完成产品实现并通过 Phase B 必要产品验证。** 本 closure只剩把已经验证的 `pages.yml` compact-runtime断言落到最终 `dev`、删除临时 retirement workflow/bootstrap，并确认最终 exact-head ordinary CI / Pages materialization/live verification。完成后没有已批准产品 TODO，必须停止继续修改。

不得自行开启新的 runtime rearchitecture、UI redesign、support-floor change、manual Current Stable Locale Matrix、Real qB Full Frozen Matrix、promotion/main/tag/Release。

## 5. 分支硬边界

```text
normal development: dev
main: 不移动，除非用户明确授权
[candidate]: 不创建、不使用
force push: 禁止
promotion/tag/Release/manual release-grade matrix: 不自动触发
```

每个 formal write batch前 fresh-read dev，更新 ref前 race-check，safe fast-forward only。Exact-SHA evidence不能跨提交偷用；`SKIPPED != PASS`。

## 6. 当前架构摘要

```text
qB WebAPI -> QBClient -> CapabilityRegistry <- compact contracts -> product semantics -> UI
qB source -> tools/CI audit -> validate compact contracts
Settings -> SettingsSchema + settings-compat
qB-owned copy -> I18n + qb-settings-native + minimal QM
```

Historical main preview compatibility只允许留在 simulator-only `branch==='main'` 路径。

## 7. 一键复制给下一位 AI

```text
接手 weigefenxiang/WeiG-qB-WebUI。只在 dev 上继续，不要移动 main，不要创建/使用 [candidate]。
先完整阅读 canonical docs 015,014,001,002,003,005,006,007,008,009,010,011,DESIGN.md，然后 fresh-read dev/main/VERSION/latest Release/current exact-SHA Actions。
当前产品 VERSION 0.3.99；qB support floor 4.1.0；latest admitted stable 5.2.3；65 Frozen profiles。
Browser runtime 已退休 release-profile/qb-releases/profile shards；CapabilityRegistry + compact contracts 是 runtime compatibility owner；raw webui 已 self-contained。
0.3.99 product checkpoint 5251bfa207a757af332b9592659296fca2a2d9d4，Phase B run 34994376073 全绿。
若 fresh-read确认最终 closure CI/Pages也已绿，则当前方案全部完成：停止主动修改，等待用户提出新方案。
```
''')

# DESIGN keeps all established UI/interaction rules; only stale runtime-owner words change.
d=ROOT/'DESIGN.md'
text=d.read_text(encoding='utf-8')
text=text.replace('qB stable source/release facts           tools/qb-release-catalog.mjs -> W.ReleaseProfile','qB stable source/release evidence        tools/qb-release-catalog.mjs / CI (offline)')
text=text.replace('W.ReleaseProfile','W.CapabilityRegistry')
text=text.replace('W.CapabilityRegistry.torrentTableColumns','W.CapabilityRegistry.torrentFieldFacts().torrentTableColumns')
text=text.replace('W.CapabilityRegistry.torrentDetailUi.tables','W.CapabilityRegistry.torrentDetailUi().tables')
text=text.replace('W.CapabilityRegistry.torrentDetailUi','W.CapabilityRegistry.torrentDetailUi()')
text=text.replace('Exact supported-stable source facts are owned by the generated qB release catalog and `W.CapabilityRegistry`; user-visible availability/presentation policy is owned by `W.CapabilityRegistry + data/capabilities.json`.','Exact supported-stable runtime facts are owned by `W.CapabilityRegistry` consuming checked-in compact contracts; the generated qB release catalog is offline tools/CI evidence only. User-visible availability/presentation policy remains owned by `W.CapabilityRegistry`.')
text=text.replace('`W.SettingsSchema` owns qB preference surface, section, type, unit, enum, editability and future fallback. `W.CapabilityRegistry` supplies the exact stable-release getter/setter descriptors;','`W.SettingsSchema + data/settings-compat.json` own qB preference surface, section, type, unit, enum, editability and exact stable-release getter/setter descriptors. `W.CapabilityRegistry` supplies the certified release identity/write-provenance gate;')
text=text.replace('torrentDetailUi()()','torrentDetailUi()')
d.write_text(text,encoding='utf-8')

# Temporary migration code is not part of current architecture.
shutil.rmtree(ROOT/'.bootstrap/0.3.99')
Path(__file__).unlink()
print('Applied compact-runtime authority closure and removed temporary closure scripts.')
