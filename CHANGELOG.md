# 変更履歴

このプロジェクトのすべての重要な変更は、このファイルに記録されます。

このフォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### 2026-03-03
- **Feat**: `--dry-run` グローバルオプションを追加 (#42)
- **CI**: npm OIDC Trusted Publishing でパッケージ公開 (#39, #40, #41)
- **Feat**: npm スタイルの更新通知を追加 (#38)
- **Test**: ユニットテストカバレッジ 100% を達成 (#36, #37)
- **Fix**: NGSI-LD API パラメータおよびパス不具合を修正 (#35)
- **CI**: バージョンタグによる npm publish ワークフローを追加 (#32)

### 2026-03-02
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
