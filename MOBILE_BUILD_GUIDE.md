# スマホアプリ化ガイド（Android）

## 必要な準備

### 1. Android Studio のインストール
1. [Android Studio](https://developer.android.com/studio)をダウンロード・インストール
2. 初回起動時に「Standard」セットアップを選択
3. Android SDK がインストールされるのを待つ（5-10分）

### 2. PCのIPアドレスを確認
スマホからPCのサーバーに接続するため、PCのIPアドレスが必要です。

**Windowsの場合:**
```bash
ipconfig
```
「IPv4 アドレス」の値をメモ（例: 192.168.1.100）

**重要**: PCとスマホが**同じWi-Fi**に接続されている必要があります。

## ビルド手順

### ステップ1: サーバーのIP設定

1. `client/.env.mobile` を開く
2. `VITE_API_URL` の値を、あなたのPCのIPアドレスに変更:
   ```
   VITE_API_URL=http://192.168.1.100:3001
   ```
   ※ `192.168.1.100` の部分を実際のIPアドレスに置き換える

### ステップ2: モバイル用ビルド

clientフォルダで以下を実行:
```bash
cd client
npm run build:mobile
```

これで自動的に:
- .env.mobile を .env にコピー
- アプリをビルド
- Android プロジェクトに同期

### ステップ3: Android Studio で開く

```bash
npm run android:open
```

または手動で:
```bash
npx cap open android
```

Android Studio が起動します。

### ステップ4: APKをビルド

Android Studio が開いたら:

1. **メニューから**: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. ビルドが完了すると、画面右下に通知が表示される
3. 通知の `locate` をクリック
4. APKファイルの場所が開く（通常: `android/app/build/outputs/apk/debug/app-debug.apk`）

## スマホへのインストール

### 方法1: USBケーブル経由

1. スマホの「開発者向けオプション」を有効化:
   - 設定 → デバイス情報 → ビルド番号を7回タップ
2. 「USBデバッグ」を有効化
3. USBケーブルでPCとスマホを接続
4. Android Studio で `Run` ボタン（▶）をクリック
5. デバイスを選択して実行

### 方法2: APKファイル経由（推奨）

1. `app-debug.apk` を Google Drive / Dropbox にアップロード
2. スマホでダウンロード
3. ファイルをタップしてインストール
   - 「提供元不明のアプリ」のインストール許可が必要な場合があります

## アプリの使用方法

### 起動前の準備

1. **PCで以下を実行**して、サーバーを起動:
   ```bash
   cd server
   npm run dev
   ```
   サーバーが `http://0.0.0.0:3001` で起動します

2. **PCとスマホが同じWi-Fiに接続**されていることを確認

3. **Windowsファイアウォール**で、Node.js のポート 3001 を許可:
   - コントロールパネル → Windows Defender ファイアウォール
   - 詳細設定 → 受信の規則 → 新しい規則
   - ポート → TCP 3001 を許可

### アプリ起動

1. スマホで「AI Council Commander」アプリを開く
2. サーバーに接続されるはず
3. 議題を入力して評議会を開始！

## トラブルシューティング

### 接続できない場合

1. **サーバーが起動しているか確認**:
   ```bash
   curl http://localhost:3001/api/debate/test-gemini
   ```

2. **ファイアウォールを確認**:
   - 一時的に無効化してテスト

3. **IPアドレスを再確認**:
   ```bash
   ipconfig
   ```
   変わっている場合、`.env.mobile` を更新して再ビルド

4. **スマホでブラウザテスト**:
   - スマホのブラウザで `http://192.168.1.100:3001/api/debate/test-gemini` を開く
   - JSONが返ってくればOK

### ビルドエラーの場合

1. **Javaバージョン確認**:
   ```bash
   java -version
   ```
   Java 11 以上が必要

2. **Android Studio の SDK を更新**:
   - Tools → SDK Manager → SDK Tools タブ
   - Android SDK Build-Tools を最新に更新

3. **クリーンビルド**:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm run build:mobile
   ```

## アプリの更新方法

コードを変更した場合:
1. `npm run build:mobile` を実行
2. Android Studio で再度 APK をビルド
3. 新しい APK をスマホにインストール（上書き）

## 注意事項

- このAPKは **Debug版** です（開発用）
- Google Play ストアには公開できません（個人利用のみ）
- スマホでアプリを使用中は、PCのサーバーが起動している必要があります
- Wi-Fi が変わるとIPアドレスが変わる可能性があります
