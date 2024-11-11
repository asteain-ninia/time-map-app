# **時空地図アプリケーション 要件定義書**

## **1. プロジェクト概要**

- **プロジェクト名**: 時空地図アプリケーション（time-map-app）
- **目的**: 架空世界の地理と歴史を、ユーザーが時間軸に沿って直感的に視覚化・追跡できるツールを提供する。1万年間にわたる歴史的出来事の変遷を地図上で確認することで、ユーザーは歴史的な進展や地理的変化を簡単に理解できる。
- **使用環境**: スタンドアロンのデスクトップアプリケーションとして動作し、ユーザーがオフラインでも利用可能。OS の制約に依存せず、Windows、macOS、Linux で動作することが望ましい。

## **2. 機能要件**

### **2.1 地図表示機能**

- **ベースマップ表示**:
    - SVG ファイルで提供された架空世界の地図を、ズームイン・ズームアウトやパン機能により表示。
    - 世界地図全体から都市レベルまで、スムーズなズームを実現。

- **地理データの表示**:
    - 以下の情報を表示可能：
        - **点データ**（例: 都市、出来事）
        - **線データ**（例: 交易路、戦線）
        - **面データ**（例: 国境、勢力範囲）
    - ユーザーがこれらのデータを個別に切り替えて表示できるフィルター機能を提供。

### **2.2 時間スライダー機能**

- **時間軸スライダー**:
    - スライダーを操作し、特定の年に対応する地図データに即時切り替え。
    - 年単位での地図切り替えを行い、直感的に過去の地理・歴史情報を参照できる。
    - 年次データを動的に読み込み、表示速度を維持。

### **2.3 データ編集機能**

- **前年データの引き継ぎ**:
    - 各年の地図データは、基本的に前年のデータを自動的に引き継ぐ仕組みを採用。ユーザーが特定の年のデータを編集すると、その変更が以降の年にも適用される（例: 戦争による国境の変更）。
- **編集モード**:
    - 地図上で点・線・面データを追加・編集・削除するための専用モードを提供。

- **データ追加・編集**:
    - 新しい都市や出来事の追加、交易路や勢力範囲の線・面の描画など、直感的なインターフェースを提供。

- **データの削除**:
    - 不要なデータをクリックして削除可能。

### **2.4 注釈・説明機能**

- **詳細情報の記載**:
    - 都市や出来事、その他の地理データに対して、名前や説明文を追加できる機能を提供。
    - テキストのほか、画像やリンクなどのマルチメディアコンテンツも添付可能。

- **情報の表示**:
    - 地図上のデータをクリックすると、ポップアップウィンドウで詳細情報を表示。

### **2.5 データ保存・読み込み機能**

- **ローカルファイル保存**:
    - ユーザーが編集したデータは、ローカルファイルとして保存可能。データ形式は、互換性を重視した一般的なフォーマット（例: JSON, XML）を使用。
- **データ読み込み**:
    - 保存したデータを読み込んで表示。

## **3. バージョン情報**

### **Version 1 (v1): 基礎機能の実装**

**実装済みの機能:**

- **地図表示**
    - ベースマップ（SVG）の表示。
    - ズームイン・ズームアウト、パン操作。

- **地理データの表示**
    - 点データ、線データ、面データの表示。

- **時間スライダー機能**
    - スライダーによる年次データの切り替え。

- **データ編集機能**
    - 編集モードの実装。
    - 点・線・面データの追加、編集、削除。

- **注釈・説明機能**
    - データに名前と説明を追加。
    - データをクリックして詳細情報を表示。

- **データ保存・読み込み機能**
    - データのローカルファイルへの保存（JSON 形式）。
    - データの読み込み。

## **4. バージョン展望**

### **Version 2 (v2): 機能拡張と改良**

**未実装の機能:**

- **データの年次変化**
    - 点・線・面データが特定の年に編集された場合、その変更を次年度以降に自動で反映。

- **データ属性の追加**
    - 都市と出来事の区別や、交易路、鉄道・道路の区別などの属性を追加可能にする。
    - 各データに対してカテゴリやタグを設定できるようにする。

- **注釈・説明機能の強化**
    - 画像やリンクなどのマルチメディアコンテンツを添付可能にし、ユーザーが豊富な情報を追加できるようにする。

- **ユーザーインターフェースの改良**
    - フィルター機能の追加。
    - 編集ツールの使いやすさの向上。

### **Version 3 (v3): 時間管理の詳細化と高度な機能**

- **時間管理の詳細化**
    - 年単位から月・日単位での時間管理が可能にする（ユーザーの選択で切り替え可能）。

- **マップレイヤーの追加**
    - 気候、人口密度、自然災害など、複数のレイヤーを重ねて表示する機能を追加。

- **高度な検索・フィルター機能**
    - 都市の人口、歴史的出来事など、特定の条件に基づいたフィルター・検索機能。

### **Version 4 (v4): ビジュアルと操作性の強化**

- **グラフ表示**
    - 時系列データをグラフとして表示し、視覚的に変遷を確認可能にする。

- **アニメーション**
    - 線や面の変化を滑らかに表示するアニメーション機能。

- **地図直接編集**
    - SVG マップをアプリ内で編集できる機能。

### **Version 5 (v5): カレンダー・年表形式表示と連動機能**

- **年表ビューの追加**
    - 歴史的な出来事や重要なイベントを、カレンダーや年表形式で一覧表示できる機能を追加。

- **地図との連動**
    - 年表上の出来事をクリックすると、該当する年の地図と詳細情報を表示。
    - 地図上のデータと年表が連動し、相互に操作可能。


## **5. 今後の展望**

- **ユーザーコミュニティの形成**
    - ユーザーからのフィードバックを収集し、アプリケーションの改善に役立てる。

- **プラグイン・拡張機能のサポート**
    - 開発者が独自の機能を追加できるプラグインシステムを導入。

- **多言語対応**
    - インターフェースやデータの多言語化をサポートし、国際的なユーザー層に対応。

- **データの共有とコラボレーション**
    - ユーザー間でデータを共有し、共同編集が可能な機能を提供。

## 開発の仕方（AI用）

- 私が要望を出す
- あなたが開発する
- 私が受け取り、ソースにコピペで適用する
- 私がテストする
- 私がFBをする
- あなたが修正する
- （受け取り・テスト・FB）
- FBがなくなるまで繰り返す
ソースをコピペで適用するので、修正した関数ごとに省略なく提示してください。また、似たような修正を複数関数に行う場合でもちゃんと全て提示してください。
この指示を理解できたのなら、開発の仕方セクションを復唱してください。
