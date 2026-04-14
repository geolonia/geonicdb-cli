# 変更履歴

このプロジェクトのすべての重要な変更は、このファイルに記録されます。

このフォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

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

[Unreleased]: https://github.com/geolonia/geonicdb-cli/compare/v0.12.0...HEAD
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
