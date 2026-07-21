# 変更履歴

このプロジェクトのすべての重要な変更は、このファイルに記録されます。

このフォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### 2026-07-21
- **Feat**: temporal 読み取り (`temporal entities list`/`get`、`temporal entityOperations query`) で本体の履歴打ち切りを可視化 (#157, closes #150, geonicdb#1437)
  - `lastN` 未指定時、本体は属性ごとの時系列を既定で最新 100 件にキャップする。打ち切り時に付く `NGSILD-Warning` (RFC 7234 warn-code 199) ヘッダを stderr に `Warning:` として表示し、silently drop を防ぐ
  - `--last-n` を正整数バリデーション (`>= 1`) に変更。上限 (本体 1000) は CLI にハードコードせず、超過時は本体の 400 をそのまま提示（API との乖離を避ける）
  - README に履歴打ち切りの挙動と全履歴取得の手段（`--last-n` 最大 1000 / 時間窓の絞り込み）を明記
- **CI**: devDependency の geonicdb pinned ハッシュを `913ceecf` → `4f9f72cc` に更新し、週次互換チェックの失敗を解消 (closes #155, geonicdb#1478/#1479)
  - 失敗の真因は本体の回帰: merge モードの batch upsert が属性なしエンティティを `attributes` フィールドなしで保存し、後段の `entities list` (`toNormalized`) が `Object.keys(undefined)` で 500。CLI は正常で、本体 #1479 で修正済み
  - 更新後の HEAD に対しローカルで build/lint/typecheck/unit (856)/E2E (149) 全緑を確認

### 2026-07-20
- **Feat**: `geonic import` — 巨大データセット向けのクライアント駆動バルクローダーを追加 (#152, closes #151, geonicdb#1409)
  - NDJSON をストリーミングで読み、件数 + バイトの両基準でチャンク分割して batch upsert に投入。API Gateway の 29 秒制限を回避
  - 429(Retry-After 尊重・プロセス全体クールダウン)/5xx/タイムアウトを指数バックオフ + jitter でリトライ
  - `--resume` によるチェックポイント再開（入力ファイル同一性 + mode/format 一致を検証、atomic write、upsert + ファイル入力限定）
  - 失敗の 2 系統出力: `--errors-out`(再投入可能な NDJSON) と `--errors-log`(理由/ステータス/行番号)
  - 400 chunk 失敗時の `--bisect` による不正エンティティの二分探索特定
  - 既定はエラーで停止、`--continue-on-error` で継続。`--dry-run` で送信せず計画を表示
  - `--mode replace` は再送で最新を上書きするため resume 非対応 + 警告表示（at-least-once の副作用を明記）
  - `client.ts`: リクエストの `AbortSignal` タイムアウトと 429 応答の `Retry-After` パースに対応
- **Fix**: 開発依存の脆弱性 7 件 (Dependabot alerts) を解消 (#153) — hono/js-yaml を `npm audit fix` で更新し、esbuild を `overrides` で `^0.28.1` に固定 (Dependabot #135 を包含)。すべて devDependency のため公開パッケージ (dist バンドル) への影響はなし。`npm audit` 0 件、build/test/e2e 全緑を確認

## [0.18.1] - 2026-07-15

### 2026-07-15
- **Test**: `models.feature` の @wip を解除し、一意制約（geonicdb#1268）の E2E シナリオを追加 (#148)
  - @wip の理由だった「モデル作成に tenantId が必要」は、e2e hooks の `e2e_test` テナント + tenant_admin 整備（#143）で解消済みだったため既存 6 シナリオをそのまま有効化
  - 新規シナリオ: 制約宣言 → `models get --format table` の可読表示確認 → 重複エンティティの exit 1 + 違反制約名 + ヒント表示 → `uniqueConstraints: []` での全削除後に重複作成可
  - 既存の get/delete シナリオが Mongo の `id` を渡していたのを type 指定に修正（API はモデルを type でキーする: `GET/DELETE /custom-data-models/{type}`）
  - devDependency の geonicdb を一意制約実装済みの main (`913ceecf`) に更新
- **Fix**: 存在しないサブコマンドへの `--help` (`geonic hello --help` 等) がヘルプ表示 + exit 0 で成功扱いになっていた問題を修正 — `geonic help <unknown>` と同じエラーを stderr に出力し exit 1 を返す (#147)
  - エラーメッセージはユーザーが入力したエイリアス表記をそのまま echo する（`models badsub` を `custom-data-models badsub` に置換しない）
  - 未知オプションの値はサブコマンド名と誤認しない（`geonic entities --bogus json --help` は従来通りヘルプ表示）

## [0.18.0] - 2026-07-15

### 2026-07-15
- **Feat**: カスタムデータモデルの一意制約（複合ユニーク, geonicdb#1268）に対応 (#136)
  - `models create` / `models update` の JSON ペイロードで `uniqueConstraints` を指定可能に（本体へパススルー）。ヘルプ・examples に宣言例と全置換 (`[]` で全削除) のセマンティクスを追記
  - `models get` / `models list` の table 形式で `uniqueConstraints` を `制約名(フィールド, ...)` の可読形式で表示（json 形式は従来通りそのまま出力）
  - 409 AlreadyExists のエラー表示を改善 — サーバーが返す違反制約名入りメッセージをそのまま表示し、一意制約違反の場合は `geonic models get <model-id>` で制約を確認するヒントを stderr に表示
  - `UniqueConstraint` 型を `types.ts` に追加

### 2026-07-14
- **Fix**: list 系コマンドがサーバーのデフォルトページサイズ (20件) で結果を暗黙に切り捨てていた問題を修正 (#141)
  - `--limit`/`--offset` 未指定時は `X-Total-Count` に従って全ページを自動取得するように変更。対象: `admin users/tenants/policies/api-keys/oauth-clients list`, `me api-keys/oauth-clients/policies list`, `rules list`, `custom-data-models list`, `catalog datasets list`
  - `--limit`/`--offset` 明示時は従来通り単一リクエストとし、結果が全体の一部である場合は stderr に `Showing N of M results...` の警告を表示する
  - `types list` / `entities list` は NGSI データプレーンのページネーション (NGSILD-Results-Count) を使うため対象外
- **Test**: `fetchPaginatedList` のページ巡回・打ち切り警告・非配列応答パススルーの単体テストを追加 (#141)
- **CI**: 週次 geonicdb 互換性チェックが実際には最新版をテストしていなかった問題を修正 — package.json の spec を `github:geolonia/geonicdb` に書き換えるだけでは package-lock.json の旧解決 (pinned hash) が優先され更新されないため、`git ls-remote` で HEAD ハッシュを取得して明示的に `npm install` するように変更 (#144)
- **CI**: geonicdb 本体をローカル起動するジョブ (compat check / e2e) の Node.js を 20 → 24 に更新 — 本体の `engines` (>= 24.13) に追従 (#144)
- **CI**: devDependency の geonicdb を最新 main (`53e27682`) に更新。E2E 全シナリオのパスを確認済み (#144)
- **Test**: E2E の auth 系シナリオ (whoami / auto-refresh) が間欠的に 401 で落ちる flake を修正 (#142, #143)
  - 真因はサーバーの logout が「現在秒 +1 まで」の全トークンを無効化するため、直後 (同一壁時計秒) に正規ログインで発行された新トークンまで無効化窓に入ること。ローカルモードでは無効化レコードがインメモリ保持のため、E2E の DB クリーンアップでは除去できない
  - `loginAs` で取得したトークンを `/me` で実効性検証し、無効化窓を跨ぐバックオフ (計 2 秒) 付きでリトライするように変更

## [0.17.0] - 2026-06-12

### 2026-06-10
- **Fix**: `auth login` で複数テナント所属ユーザーがテナント名で指定できなかった問題を修正 (#133)
  - サーバーが返す `availableTenants[].tenantName` を CLI 側が `name` で読んでおり、一覧表示が常に tenantId にフォールバックし、`-s/--service <name>` のマッチングも常に false になっていた。`TenantInfo.tenantName` に統一
  - 複数テナント検出時に TTY であってもインタラクティブ選択 prompt を出さず即エラー終了していた挙動を改善。TTY 時は番号入力による選択 prompt を表示する (フラグ未指定かつ非 TTY 時は従来通りエラー)
- **Feat**: `auth login` に `--tenant <name|id>` を追加 — テナント名でも ID でもログインできる新フラグ。`profile create --tenant` と表記を揃えた (`geonic auth login --tenant miya`) (#133)
- **Refactor**: `auth login` の HTTP フローを「テナント未指定の初回ログイン → クライアント側で name→ID 解決 → 必要なら resolved ID で再ログイン」に整理 (#133)
- **Refactor**: `--tenant-id` フラグはフラグ名通り **ID 専用**として動作するように整理。ヒントを出すエラーメッセージを追加 (`--tenant-id miya` のように name を渡した場合、`Use --tenant miya (or --tenant-id <id>)` と案内する) (#133)
- **Test**: `promptTenantSelection`、`--tenant-id` の name 解決、インタラクティブ選択フローの単体テストを追加。既存テストの `TenantInfo` フィクスチャを `tenantName` に揃えた (#133)

## [0.16.2] - 2026-06-09

### 2026-05-31
- **Fix**: `entities replace` が PUT を `/ngsi-ld/v1/entities/{id}/attrs` に送ってサーバーの `MethodNotAllowed` で常に失敗していた問題を修正。NGSI-LD 仕様 (ETSI GS CIM 009 clause 5.6.4 Replace Entity) に従い、PUT を `/ngsi-ld/v1/entities/{id}` に送るよう変更。`@wip` でスキップしていた E2E シナリオを有効化 (#128)

## [0.16.1] - 2026-05-15

### 2026-05-14
- **Fix**: `auth login` / `auth login --client-credentials` / `auth token-exchange --save` で `--url <URL>` を渡してログインしても URL がプロファイルに永続化されず、後続コマンドで `No URL configured` エラーになっていた問題を修正。トークン保存時に URL も一緒に保存するように。空のプロファイルに切り替えてからログインするフロー (`profile create miya` → `profile use miya` → `auth login --url <URL>` → `me`) で発生していた (#126)
- **Fix**: `me oauth-clients create`、`me api-keys create`、`admin api-keys create/refresh` で `--url` 渡し時に同様の URL 永続化漏れがあった箇所も合わせて修正 (#126)
- **Test**: `auth login` の URL 永続化を直接検証する回帰防止テストを追加 (#126)

## [0.16.0] - 2026-05-14

### 2026-05-13
- **Fix**: アップデート通知のメッセージを `npm i -g @geolonia/geonicdb-cli` から `geonic cli update` に変更 — CLI 内蔵のアップデートコマンドを案内するように (#124)
- **Fix**: `geonic cli update` 実行後に同セッション末尾でアップデート通知が再表示される問題を修正 — `update` コマンド成功時に通知出力を抑制 (#124)
- **Feat**: `profile create` に `--tenant <tenant>` オプションを追加 — プロファイル作成時にテナント ID/名を初期値として束縛できるように。`--url` (グローバルフラグ) と組み合わせて、同じアカウントの別テナントごとに独立したプロファイルを一度に生成可能 (例: `geonic profile create miya --tenant miya` / `geonic profile create geolonia --tenant geolonia`) (#123)
- **Breaking**: `auth login` の複数テナント所属時の挙動を変更 — 対話プロンプトによるテナント選択を廃止し、`--tenant-id` または `-s/--service` の明示指定を必須化。未指定で複数所属を検出した場合は利用可能テナント一覧を表示してエラー終了する。プロファイル設定で `service`/`tenantId` を保持していれば自動解決される (#123)
- **Refactor**: `src/prompt.ts` から `promptTenantSelection` / `TenantChoice` を削除。`src/commands/auth.ts` は `types.ts` の `TenantInfo` を参照するように統一 (#123)

## [0.15.1] - 2026-05-11

### 2026-05-08
- **Docs**: `admin users create` のヘルプ description / examples で旧フィールド名 `tenantId` を使っていた箇所を `primaryTenantId` に修正。サーバ側 `CreateUserInputSchema` (`.strict()`) は `primaryTenantId` のみを受理しており、ヘルプ通りに書くと `400 Unrecognized key: "tenantId"` で失敗していた。回帰防止としてヘルプ文字列・examples を `primaryTenantId` で検証するユニットテストを追加 (#118, #120)
- **Docs**: `me api-keys` および `me oauth-clients` で create のフラグが `--policy`、update のフラグが `--policy-id` という命名非対称になっている件について、ヘルプ description と README で明示的に案内するよう修正。`--policy` の説明文に "use --policy-id on update" を、`--policy-id` の説明文に "use --policy on create" を追記。回帰防止としてヘルプ option description を Commander API 経由で検証するユニットテストを追加 (#119, #121)

## [0.15.0] - 2026-04-30

### 2026-04-30
- **Feat**: `admin tenants create` / `admin tenants update` に `--allowed-origins` フラグを追加 — テナント単位の CORS origin 制御 (`Tenant.settings.allowedOrigins`, geonicdb #1069 対応) を専用フラグで設定可能に。`api-keys` の `--origins` と同じカンマ区切り命名規則を踏襲し、空文字列で `[]`（全 deny）、`*` で wildcard 許可を表現 (#115, #116)

## [0.14.0] - 2026-04-27

### 2026-04-27
- **Feat**: ページング未対応だった `list` 系コマンドに `--limit` / `--offset` フラグを追加 — `types list`, `rules list`, `catalog datasets list`, `custom-data-models list`, `me policies list`, `me api-keys list`, `me oauth-clients list`, `admin tenants list`, `admin users list`, `admin api-keys list`, `admin oauth-clients list`, `admin policies list` で全件取得可能に (#113)
- **Refactor**: ページング処理を `helpers.ts` の `parseNonNegativeInt` / `buildPaginationParams` に共通化。負数や非整数を CLI 側で早期に弾くようバリデーションを追加 (#113)

## [0.13.0] - 2026-04-24

### 2026-04-24
- **Feat**: `entities list` に `--scope-q` オプションを追加 — NGSI-LD `scopeQ` パラメータによるスコープフィルタリングに対応 (#110)
- **Feat**: テーブル表示で `scope` プロパティを `id`, `type` の直後に表示 (#110)
- **Feat**: `entities create` のヘルプに `scope` プロパティの使用例を追加 (#110)
- **CI**: geonicdb 週次互換性チェックワークフローを追加 (#110)
- **Refactor**: devDependency `geonicdb` をコミットハッシュでピン留めに変更 (#110)

## [0.12.1] - 2026-04-14

### 2026-04-14
- **Fix**: パスワード入力時、ペーストなどで複数文字が一度に入力された場合に `*` が1個しか表示されない問題を修正 (#108)

## [0.12.0] - 2026-04-14

### 2026-04-14
- **Feat**: `geonic me password` コマンドを追加 — パスワード変更 (`POST /me/password`) に対応、インタラクティブプロンプトおよびフラグ指定の両方をサポート (#106)

## [0.11.0] - 2026-04-06

### 2026-04-06
- **Feat**: エンティティ取得コマンド (`entities list`, `entities get`) に `--sys-attrs` フラグを追加 — `options=sysAttrs` を付与し `createdAt` / `modifiedAt` を取得可能に (#105)

## [0.10.1] - 2026-04-06

### 2026-04-06
- **CI**: npm publish を OIDC Trusted Publishing に移行 — レガシートークン認証を廃止 (#100)
- **CI**: publish ワークフローから `npm install -g npm@latest` を削除 — Node.js 22.22.2 ランナーとの依存関係競合によるリリース失敗を修正 (#99)

### 2026-04-05
- **Fix**: token と apiKey が config に共存する場合、`canRefresh()` が apiKey の存在でリフレッシュをブロックし、JWT 期限切れ後にセッションが復旧不能になる問題を修正 (#98)
- **Feat**: リクエスト前に JWT の `exp` を確認し、期限切れ/期限間近なら事前にリフレッシュするプロアクティブ・トークンリフレッシュを追加 (#98)

## [0.10.0] - 2026-04-03

### 2026-04-03
- **Docs**: 全コマンドの help 内容を充実 — description の具体化、examples の追加（テーブル形式、プロフィルスコープ、ユースケース別の例）、24 ファイル改善 (#96)
- **Feat**: マルチテナント対応 — ログイン時のテナント名指定 (`-s <テナント名>`)、`tenantId` / `availableTenants` の config 保存、`profile use` 時のトークン自動リフレッシュ (#90)
- **Feat**: `geonic cli update` コマンドを追加 — `npm update -g` のエイリアスとして CLI を最新版に更新可能に (#94)
- **Fix**: 複数ターミナルで同一プロファイルを使用時、refresh token rotation によりセッションが無効化される問題を修正 — トークンリフレッシュ前に config を再読み込みし、別プロセスが既にリフレッシュ済みならそのトークンを使用する (#93)

## [0.9.0] - 2026-03-25

### 2026-03-25
- **Feat**: `me api-keys refresh` / `admin api-keys refresh` コマンドを追加 — `POST /me/api-keys/{keyId}/refresh` / `POST /admin/api-keys/{keyId}/refresh` でキーローテーションに対応 (`--save` オプション付き) (GeonicDB #799) (#92)
- **Feat**: `me api-keys create` / `admin api-keys create` で API キー値をボックス囲みで強調表示し、保存を促す警告メッセージを改善 (#92)
- **Feat**: `me api-keys list` / `admin api-keys list` の出力末尾に注釈を追加 — API キー値は作成時またはリフレッシュ時にのみ表示される旨を明示 (#92)

### 2026-03-24
- **Fix**: `auth login` 後に `NGSILD-Tenant` ヘッダーが付与されない問題を修正 — ログインレスポンスの `tenantId` を `service` として config に保存するようにした (#89)

## [0.8.0] - 2026-03-23

### 2026-03-23
- **Feat**: `me policies` コマンド群を新設 — `list`, `get`, `create`, `update`, `delete` で `/me/policies` セルフサービスポリシー管理に対応 (GeonicDB #764) (#83, #86)
- **Feat**: `me api-keys update` コマンドを追加 — `PATCH /me/api-keys/{keyId}` 対応 (`--name`, `--policy-id`, `--origins`, `--rate-limit`, `--dpop-required`/`--no-dpop-required`, `--active`/`--inactive`) (#85)
- **Feat**: `me oauth-clients update` コマンドを追加 — `PATCH /me/oauth-clients/{clientId}` 対応 (`--name`, `--description`, `--policy-id`, `--active`/`--inactive`) (#85)
- **Feat**: `me oauth-clients regenerate-secret` コマンドを追加 — `POST /me/oauth-clients/{clientId}/regenerate-secret` 対応 (#85)
- **Docs**: XACML デフォルトポリシー再設計に合わせて README を更新 — `user` デフォルト動作、priority 体系表、`me policies` セクション、認可モデル説明を整理 (GeonicDB #762) (#84)

### 2026-03-21
- **Breaking**: API キー (`admin api-keys`, `me api-keys`) から `--scopes`, `--permissions`, `--entity-types` オプションを削除し、`--policy <policyId>` オプションを追加 — 認可は policyId 紐づけ方式に移行 (GeonicDB #757) (#82)
- **Breaking**: OAuth クライアント (`admin oauth-clients`, `me oauth-clients`) から `--scopes` オプションと `allowedScopes` フィールドを削除し、`--policy <policyId>` オプションを追加 (GeonicDB #757) (#82)
- **Breaking**: OAuth クライアントの `clientName` フィールドを `name` にリネーム (GeonicDB #757) (#82)
- **Docs**: README を policyId 紐づけ方式に更新 — `--scopes`/`--permissions`/`--entity-types` の記述を `--policy` に置換、認可モデルセクションを整理 (#82)

## [0.7.0] - 2026-03-20

### 2026-03-20
- **Feat**: `admin api-keys create/update` および `me api-keys create` に `--permissions` オプションを追加 — `read`, `write`, `create`, `update`, `delete` を指定して XACML ポリシーを自動生成 (GeonicDB #753) (#79)
- **Breaking**: `admin tenants update` から `--anonymous-access` / `--no-anonymous-access` フラグを削除 — テナントフィーチャーフラグが廃止され、匿名アクセスは XACML ポリシーで制御 (GeonicDB #752) (#79)
- **Breaking**: スコープヘルプから `write:X implies read:X` の記述を削除 — `write:X` は `read:X` を暗黙的に含まなくなった (GeonicDB #723) (#79)
- **Docs**: `admin policies create` のヘルプに `servicePath` リソース属性、priority の説明（大きい数値=高優先度）、デフォルトロールポリシーの説明を追加 (GeonicDB #747, #751, #752) (#79)
- **Docs**: README を更新 — `--permissions` オプション、XACML 認可モデル、スコープ包含関係、API キーヘッダ排他仕様を反映 (#79)

### 2026-03-19
- **Feat**: `admin tenants update` に `--anonymous-access` / `--no-anonymous-access` オプションを追加 — テナントの匿名アクセス設定を CLI から管理可能に (#78)
- **Docs**: `admin policies create` のヘルプに `target` フィールド（subjects, resources, actions, environments）のスキーマ例を追加 (#78)
- **Docs**: `admin users create` のヘルプを API 仕様に合わせて改善 (#77)

### 2026-03-17
- **Fix**: API キーコマンド (`me api-keys`, `admin api-keys`) のヘルプで表示されるスコープ一覧を、API キーで実際に使用可能な6スコープに修正 (#74)

## [0.6.3] - 2026-03-17

### 2026-03-17
- **Feat**: `--scopes` オプションを持つコマンドのヘルプに有効なスコープ一覧を NOTES セクションとして追加 (#73)
- **Docs**: README の Valid Scopes セクションを全18スコープに更新、包含関係と特殊スコープの説明を追加 (#73)
- **Fix**: `admin api-keys create` の例で誤ったスコープ形式 (`entities:read`) を正しい形式 (`read:entities`) に修正 (#73)
- **Fix**: E2E テストの config を v2 フォーマットで統一し、CLI プロセスでの auto-migration による認証フレーキーテストを修正 (#73)

## [0.6.2] - 2026-03-17

### 2026-03-17
- **Docs**: 全 JSON 入力コマンドのヘルプを改善 — description に JSON payload example を追加、examples にインライン JSON・stdin pipe・interactive mode の具体例を追加 (#72)
- **Fix**: E2E テストの `performLogin` にリトライとトークン検証を追加 — DB クリーンアップ後のレースコンディションによるフレーキーテストを修正 (#72)

## [0.6.1] - 2026-03-13

### 2026-03-12
- **Breaking**: `auth login` の email/password フローを対話モード専用に変更 — `GDB_EMAIL` / `GDB_PASSWORD` 環境変数サポートを廃止（シェルヒストリへのクレデンシャル漏洩を防止） (#70)
- **Feat**: `auth login` にマルチテナント対応を追加 — `availableTenants` レスポンスの表示と対話的テナント選択 (#67)
- **Fix**: `auth login` が `/auth/login` リクエストに `NGSILD-Tenant` ヘッダーを送信しないよう修正 (#68)
- **Fix**: 401 エラー時のメッセージを `geonic auth login` に修正 (#69)
- **Docs**: README の auth セクションを拡充 — 対話ログイン、マルチテナント、OAuth Client Credentials の説明を追加 (#70)
- **Test**: `promptTenantSelection` / `skipTenantHeader` / マルチテナントフローのテストを追加 (#70)

## [0.6.0] - 2026-03-11

### 2026-03-11
- **Feat**: API キー管理コマンドに `--dpop-required` フラグを追加 — DPoP トークンバインド (RFC 9449) の有効化に対応 (#66)
- **Feat**: `admin api-keys update` に `--no-dpop-required` フラグを追加 — DPoP の無効化に対応 (#66)
- **Test**: `dpopRequired` フラグのユニットテストを追加（create / update / 単独フラグ分岐） (#66)

## [0.5.0] - 2026-03-10

### 2026-03-08
- **Feat**: `geonic admin api-keys` コマンドを追加 — APIキーの CRUD 管理 (#57)
- **Feat**: `geonic me api-keys` コマンドを追加 — ユーザー自身の APIキー セルフサービス管理 (#57)
- **Feat**: `X-Api-Key` ヘッダによる APIキー認証サポートを追加（`--api-key` / `config set api-key`） (#57)
- **Feat**: `--save` オプションで APIキーを config に保存し、自動送信を有効化 (#57)
- **Fix**: `allowedOrigins` の空配列バリデーションを CLI 側に追加 (#58)
- **Feat**: `allowedEntityTypes` ランタイムエンフォースメントの 403 エラーメッセージを改善 (#59)
- **Feat**: `geonic auth nonce` / `geonic auth token-exchange` コマンドを追加 — APIキー→JWT 交換（PoW対応） (#60)
- **Fix**: Token と API key が両方設定されている場合にヘッダが排他的に送信されるよう修正 (#62)
- **Test**: API key E2E テストにヘッダ排他アサーションを追加 (#62)

## [0.4.1] - 2026-03-06

### 2026-03-06
- **Feat**: `entities list` に `--count-only` オプションを追加 (#55)
- **Fix**: GeoProperty をテーブル表示で読みやすい座標形式にフォーマット (#54)

### 2026-03-05
- **Fix**: publish ワークフローで CI 完了をポーリング待機するよう修正（レースコンディション対策）(#52)
- **Docs**: CLAUDE.md を現状の実装に合わせて更新 (#53)

## [0.4.0] - 2026-03-05

### 2026-03-05
- **Feat**: `geonic me oauth-clients` コマンドを追加 — ユーザー自身が OAuth Client Credentials をセルフサービスで発行・管理 (#51)
- **Feat**: `--save` オプションで credentials を config に保存し、自動再認証を有効化 (#51)
- **Feat**: client_credentials grant による自動トークン再取得フォールバックを追加 (#51)

### 2026-03-04
- **CI**: npm publish 前に CI ワークフロー（E2E 含む）の成功を必須化 (#50)

## [0.3.0] - 2026-03-04

### 2026-03-03
- **Feat**: `--dry-run` グローバルオプションを追加 (#42)
- **CI**: E2E テストジョブを CI ワークフローに追加 (#43)

## [0.2.0] - 2026-03-03

### 2026-03-03
- **Feat**: npm スタイルの更新通知を追加 (#38)
- **Test**: ユニットテストカバレッジ 100% を達成 (#36, #37)
- **Fix**: NGSI-LD API パラメータおよびパス不具合を修正 (#35)
- **CI**: npm OIDC Trusted Publishing でパッケージ公開 (#39, #40, #41)

## [0.1.0] - 2026-03-03

### 2026-03-02
- **CI**: バージョンタグによる npm publish ワークフローを追加 (#32)
- **Breaking**: `--format keyValues` を `--key-values` フラグに分離 (#31)
- **Test**: E2E feature ファイルをサブコマンド単位に統合 (26 → 21 ファイル) (#29, #30)
- **Fix**: 設定 URL にプロトコルがない場合の Invalid URL エラーを修正 (#28)
- **Feat**: JSON5 入力、stdin 自動検出、インタラクティブ入力モードを追加 (#27)
- **Refactor**: E2E テストを汎用ステップに統一 (#26)

### 2026-03-01
- **Feat**: `version` コマンドを追加、ヘルプに CLI バージョンを表示 (#25)
- **Fix**: fast-xml-parser の脆弱性を修正 (#24)
- **Docs**: package.json メタデータ更新、CLI 説明文を動的化 (#23)
- **Docs**: 全コマンドにヘルプの例と説明を追加 (#22)
- **Refactor**: geonicdb 依存からピン留めコミットハッシュを削除 (#21)
- **Test**: E2E テストカバレッジ拡大とディレクトリ再編 (#20)
- **Feat**: zsh 補完サポートを追加 (#19)
- **Docs**: `entities list` の全オプションに例を追加 (#18)
- **Feat**: ヘルプシステムに EXAMPLES セクションを追加 (#17)

### 2026-02-28
- **Feat**: `geonic help` サブコマンドの補完サポート (#16)
- **Feat**: bash 補完サポートを追加 (#15)
- **Refactor**: コマンド説明文を動詞始まりに統一 (#14)
- **Refactor**: ヘルプ出力の GLOBAL PARAMETERS / OPTIONS をコンパクト化 (#13)
- **Fix**: サンプルエンドポイントのポートを 1026 → 3000 に変更 (#12)
- **Breaking**: NGSIv2 サポートを削除、CLI を NGSI-LD 専用に変更 (#11)
- **Feat**: CLI コマンド階層を API エンドポイントに整合 (#10)
- **Feat**: wp-cli スタイルのヘルプコマンドを追加 (#8)
- **Test**: helpers ユニットテスト + コアコマンド E2E テストを追加 (#7)
- **Breaking**: CLI バイナリ名を `gdb` → `geonic` にリネーム (#6)
- **Test**: E2E テストにモックサーバーの代わりに実 GeonicDB を使用 (#4)

### 2026-02-27
- **Feat**: 認証システムと Cucumber E2E テストを追加 (#3)
- **Feat**: プロファイル管理、API キー認証、トークンリフレッシュを追加 (#2)

### 2026-02-26
- **Docs**: README にインストール手順・使い方・コマンドリファレンスを追加 (#1)

[Unreleased]: https://github.com/geolonia/geonicdb-cli/compare/v0.19.0...HEAD
[0.19.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.18.1...v0.19.0
[0.18.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.18.0...v0.18.1
[0.18.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.16.2...v0.17.0
[0.16.2]: https://github.com/geolonia/geonicdb-cli/compare/v0.16.1...v0.16.2
[0.16.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.15.1...v0.16.0
[0.15.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.6.4...v0.7.0
[0.6.4]: https://github.com/geolonia/geonicdb-cli/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/geolonia/geonicdb-cli/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/geolonia/geonicdb-cli/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/geolonia/geonicdb-cli/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/geolonia/geonicdb-cli/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/geolonia/geonicdb-cli/releases/tag/v0.1.0