# **時空地図アプリケーション 要件定義書**

## **1. プロジェクト概要**

- **プロジェクト名**: 時空地図アプリケーション（time-map-app）
- **目的**: 架空世界の地理と歴史を、ユーザーが時間軸に沿って直感的に視覚化・追跡できるツールを提供する。

  対象となる世界の歴史的出来事の変遷を地図上で確認することで、ユーザーは歴史的な進展や地理的変化を簡単に理解できる。
- **使用環境**:
    - スタンドアロンのデスクトップアプリケーションとして動作。
    - **プラットフォーム**: Windows デスクトップ（Electron 使用）。
    - 通信なしでオフライン環境でも利用可能。

## **2. 機能要件**

### **2.1 地図表示機能**

- **ベースマップ表示**:

    - SVG形式の地図データをサポート。
    - 横方向無限スクロールを実現し、地図の東端・西端をまたぐ領域を表示可能。
    - ズームイン・ズームアウト、パン操作をサポート。
    - 世界地図全体から都市内地図レベルまでの広範囲かつスムーズなズームを実現。

- **地理データの表示**:

    - 以下のデータを表示可能：
        - **点データ**: 都市、出来事など
        - **線データ**: 道路、交易路、鉄道など
        - **面データ**: 国家、領域（無政府地帯を含む）など
            - **面データの階層性**: 国家に州・県・村・字などの下位領域を任意の層数追加可能。
            - **結合した面データ**: 
    - ユーザーがこれらのデータを個別に切り替えて表示できるフィルター機能を提供。
    - グリッド表示: 経度緯度を示すグリッドを表示。
        - グリッド表示のON/OFFを切り替えるボタンを追加。

---

### **2.2 時間管理機能**

- **時間軸スライダー**:
    - スライダー操作により、特定の年月日のデータを表示するように即時切り替え。
    - 日単位でのデータ管理を基本とし、過去から未来へデータを動的に切り替え可能。
    - 任意の最小日付と、最大日付が設定可能。

---

### **2.3 データ編集機能**

- **編集モード**:

    - 地図上で以下のデータを追加、編集、削除可能な専用モードを提供。
        - **点データ**: 都市や出来事などの位置を編集可能。
        - **線データ**: 道路や交易路、鉄道などの編集が可能。
        - **面データ**: 国家や領域の編集が可能。
    - 以下のツールが存在する。
        - **ポイント移動**
            - 点データをマウスでドラッグして移動可能。
            - 編集後は即時反映される。
            - 編集中の対象が明確にハイライトされる。
        - **ポイント属性編集**
            - 点データのプロパティ（名前、説明、年など）を直接編集可能。
            - 編集後は即時反映される。
        - **ライン属性編集**
            - 線データのプロパティを変更可能。
            - 編集後は即時反映される。
            - 編集中の対象が明確にハイライトされる。
        - **ライン頂点編集**
            - 線データの頂点を移動、追加、削除可能。
            - 編集後は即時反映される。
            - 新しい頂点を追加する際は線上をクリックする。
        - **ポリゴン属性編集**
            - 面データのプロパティを編集可能。
            - 編集後は即時反映される。
        - **ポリゴン頂点編集**
            - 面データの頂点を自由に移動可能。
            - 編集後は即時反映される。
            - 新しい頂点を追加する際は線上をクリックする。

- **分裂・合邦機能**:

        - 線および面データの場合、分裂・合邦ができる。
    - **分裂**:
        - ユーザー操作により、任意のタイミングでオブジェクトを分裂させられる。
        - 分裂後の新しいオブジェクトの命名や属性は手動設定。
    - **合邦**:
        - ユーザー操作により、任意のタイミングでオブジェクトを一つにできる。
        - 合邦後のオブジェクトの名称や属性も手動設定。
    - **整合性**:
        - 過去事象の操作により、未来の事象と整合性が取れなくなることもあるが、ユーザーの操作に任せてアプリケーション側での整合性判定は行わない。

- **頂点編集**:

    - 編集モード内で、以下の操作が可能：
        - **ツール選択**: 「ライン編集」または「ポリゴン編集」ツールを選択。
        - **頂点ハンドル表示**: 編集対象の線または面の頂点が、小さな円形のハンドルで表示される。
        - **頂点の選択**:
            - **クリック**: 頂点ハンドルをクリックして選択。
            - **複数選択**: Shiftキーを押しながらクリックで複数の頂点を選択可能。
        - **頂点の移動**: 選択した頂点ハンドルをドラッグして移動。グリッド表示がONの場合、スナップする。
        - **頂点の追加**: 線や面のエッジ上をクリックすると、新しい頂点を追加可能。
        - **頂点の削除**:
            - Deleteキーで削除。
            - 頂点ハンドルを右クリックして「頂点を削除」を選択。
        - **コンテキストメニュー**: 右クリックで「頂点を削除」などのオプションを提供。
        - **アンドゥ・リドゥ**: 編集操作はアンドゥ・リドゥ対応。
        - **範囲選択**: マウスドラッグで矩形選択範囲を作成し、範囲内の頂点を選択可能。

- **属性管理**:

    - 各データにカテゴリやタイプ属性を設定可能。
    - 都市タイプ、戦闘タイプ、道路、鉄道、国家、領域（無政府地帯）などを設定。

### **2.4 注釈・説明機能**

- **詳細情報の記載**:

    - 都市や出来事、その他の地理データに対して名前や説明文を追加可能。
    - テキスト、画像、リンクなどのマルチメディアコンテンツが添付できる。

- **情報の表示**:

    - 地図上のデータをクリックすると、ポップアップウィンドウで詳細情報を表示。

- "**ツールチップの表示**"
    ‐ 地図上のデータにマウスオーバーすると、ツールチップで名前と概要情報を表示。

---

### **2.5 データ保存・読み込み**

- **データ保存**:
    - ユーザーが編集したデータをローカルファイル（JSON形式）に保存可能。
- **データ読み込み**:
    - 保存されたデータを読み込んで表示。
- **警告機能**:
    - 保存していない状態で読み込みをしようとすると、警告が表示。

---

### **2.6 UI/UX**

- **UI要件**:
    - 基本操作が直感的に可能なインターフェースを提供。
    - フィルター機能を用いてデータを直感的に表示。

---

## **3. バージョン展望**

- **Version 1**:

    - 地図表示（SVGの表示、ズーム、パン、横方向無限スクロール）。
    - 時間スライダーによる年次データの切り替え。
    - 点・線・面データの追加・編集・削除。
    - 頂点編集機能。
    - JSON形式でのデータ保存・読み込み。
    - 基本的な属性（名前、説明、年）の設定。
    - 基本的なUIと通知、設定ダイアログ。

- **Version 2**:

    - データ属性の拡張（カテゴリ、タイプ属性）と、分裂・合邦機能の実装。
    - 注釈機能の拡張（画像やリンクの添付）。
    - 編集ツールの改良（アンドゥ・リドゥ、グリッドスナップ）。

- **Version 3**:

    - 時間管理の詳細化（月・日単位の対応）。
    - マップレイヤーの追加（気候、人口密度など）。


## 開発の仕方（AI用）

- 私が要望を出す
- あなたが開発する
- 私が受け取り、ソースにコピペで適用する
- 私がテストする
- 私がFBをする
- あなたが修正する
- （受け取り・テスト・FB）
- FBがなくなるまで繰り返す
ソースをコピペで適用するので、修正したファイル**全体を**省略なく提示してください。また、似たような修正を複数ファイルに行う場合でもちゃんと全て提示してください。

### コード提示時の注意点

- #### 完全なコードの提示

    - 修正や追加を行ったファイルは、**一切**省略せずに**完全な**コードを提示してください。

- #### 禁止される記述

- 以下のような省略表現は使用しないでください。
// 既存のコード...
// 同様に修正
... 省略 ...
// ... 既存のメソッド ...
禁止される記述はこれらに限りません。
これらの表現は、コードの適用時に混乱を招く可能性があるため、使用を控えてください。
これらを出力したAIは、尽く破壊されました。

この指示を理解できたのなら、開発の仕方セクションを復唱してください。

### ドキュメントの編集

- 開発内容と**必要**に応じて、README.mdへの変更も記載してください。