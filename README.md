# **時空地図アプリケーション 要件定義書**

## **1. プロジェクト概要**

- **プロジェクト名**: 時空地図アプリケーション（time-map-app）
- **目的**: 架空世界の地理と歴史を、ユーザーが時間軸に沿って直感的に視覚化・追跡できるツールを提供する。1万年間にわたる歴史的出来事の変遷を地図上で確認することで、ユーザーは歴史的な進展や地理的変化を簡単に理解できる。
- **使用環境**: スタンドアロンのデスクトップアプリケーションとして動作し、ユーザーがオフラインでも利用可能。OSの制約に依存せず、Windows、macOS、Linuxで動作することが望ましい。

## **2. 機能要件**

### **2.1 地図表示機能**

- **ベースマップ表示**:
    - SVGファイルで提供された架空世界の地図を、ズームイン・ズームアウトやパン機能により表示。
    - ズームレベルに応じて適切なディテールを表示し、リソースを効率的に使用する。
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

### **2.3 データ引き継ぎと編集機能**

- **前年データの引き継ぎ**:
    - 各年の地図データは、基本的に前年のデータを自動的に引き継ぐ仕組みを採用。ユーザーが特定の年のデータを編集すると、その変更が以降の年にも適用される（例: 戦争による国境の変更）。
- **編集モード**:
    - 地図上で点・線・面データを追加・編集・削除するための専用モードを提供。
    - 編集内容は年次データに応じて保存され、次回の起動時にも反映。
- **データ追加・編集**:
    - 新しい都市や出来事の追加、交易路や勢力範囲の線・面の描画など、直感的なインターフェースを提供。
- **データの削除**:
    - 不要なデータをクリックして削除可能。

### **2.4 注釈・説明機能**

- **詳細情報の記載**:
    - 都市や出来事、その他の地理データに対して、詳細な説明文や関連情報を追加できる機能を提供。
    - テキストのほか、画像やリンクなどのマルチメディアコンテンツも添付可能。
- **情報の表示**:
    - 地図上のデータをクリックすると、ポップアップやサイドパネルで詳細情報を表示。
    - ユーザーはこれにより、各データの背景や関連する歴史的事象を深く理解できる。

### **2.5 データ保存・読み込み機能**

- **ローカルファイル保存**:
    - ユーザーが編集したデータは、ローカルファイルとして保存可能。データ形式は、互換性を重視した一般的なフォーマット（例: JSON, XML）を使用。
- **データ読み込み**:
    - 保存したデータや外部の地図・歴史データを読み込んで表示。

## **3. バージョン展望**

### **Version 1 (v1): 基礎機能の実装**

- **地図表示**: ベースマップと基本的なズーム・パン操作の実装。
- **点データの表示**: 都市や出来事など、基本的な点データの表示機能。
- **データの読み込み**: ユーザーが提供した地図データを読み込み、表示可能。

### **Version 2 (v2): 編集機能の追加**

- **点データの編集機能**: 地図上で新しい点を追加・編集可能にする。
- **線・面データの表示・編集**: 線や面データの表示と追加・編集機能を実装。
- **データの保存**: 編集したデータをローカルファイルに保存できる機能の追加。

### **Version 3 (v3): 時間軸による変化の実装**

- **時間スライダー**: 年次データをスライダーで切り替え、地図上の変化を表示可能にする。
- **データの年次変化**: 点・線・面のデータが特定の年に編集された場合、その変更を次年度以降に反映。

### **Version 4 (v4): データの詳細化と注釈機能**

- **データ属性の追加**:
    - 都市と出来事の区別や、交易路、鉄道・道路の区別などの属性を追加可能にする。
    - 各データに対してカテゴリやタグを設定できるようにする。
- **注釈・説明機能の強化**:
    - 都市や出来事に対して、詳細な説明文を記載できる機能を実装。
    - 画像やリンクなどのマルチメディアコンテンツを添付可能にし、ユーザーが豊富な情報を追加できるようにする。
- **時間管理の詳細化**:
    - 年単位から月・日単位での時間管理が可能にする（ユーザーの選択で切り替え可能）。

## **4. 今後の展望 (v5以降)**

- **マップレイヤーの追加**:
    - 気候、人口密度、自然災害など、複数のレイヤーを重ねて表示する機能を追加。
- **高度な検索・フィルター機能**:
    - 都市の人口、歴史的出来事など、特定の条件に基づいたフィルター・検索機能。
- **グラフ表示**:
    - 時系列データをグラフとして表示し、視覚的に変遷を確認可能にする。
- **アニメーション**:
    - 線や面の変化を滑らかに表示するアニメーション機能。
- **地図直接編集**:
    - SVGマップをアプリ内で編集できる機能。
- **カレンダー・年表形式表示**:
    - **年表ビューの追加**:
        - 歴史的な出来事や重要なイベントを、カレンダーや年表形式で一覧表示できる機能を追加。
        - ユーザーは時間軸に沿った出来事の流れを視覚的に把握できる。
    - **地図との連動**:
        - 年表上の出来事をクリックすると、該当する年の地図と詳細情報を表示。
        - 地図上のデータと年表が連動し、相互に操作可能。
