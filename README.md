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

### **2.2 時間管理機能**

- **時間軸スライダー**:
    - スライダー操作により、特定の年月日のデータを表示するように即時切り替え。
    - 日単位でのデータ管理を基本とし、過去から未来へデータを動的に切り替え可能。
    - 任意の最小日付と、最大日付が設定可能。

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

- **ツールチップの表示**:
    - 地図上のデータにマウスオーバーすると、ツールチップで名前と概要情報を表示。
    - ドラッグ終了後にも、対象のフィーチャ名や年などが表示される。

### **2.5 データ保存・読み込み**

- **データ保存**:
    - ユーザーが編集したデータをローカルファイル（JSON形式）に保存可能。
- **データ読み込み**:
    - 保存されたデータを読み込んで表示。
- **警告機能**:
    - 保存していない状態で読み込みをしようとすると、警告が表示。

### **2.6 UI/UX**

- **UI要件**:
    - 基本操作が直感的に可能なインターフェースを提供。
    - フィルター機能を用いてデータを直感的に表示。
    - モーダルダイアログによる設定画面や、複数のフォーム/ウィンドウをドラッグ移動可能にすることで視認性と操作性を高める。

#### **2.6.1 UIファイルの構成（リファクタリング後）**

- `src/ui/uiManager.js`  
  - UIのメイン制御。ツールバーやサイドバー、イベント一覧などの更新。
- `src/ui/forms.js`  
  - ポイント・ライン・ポリゴン属性編集フォーム、および詳細ウィンドウを管理。
- `src/ui/tooltips.js`  
  - ツールチップの表示・移動・非表示機能。

---

## **デバッグ機能

  - ログレベルは呼び出し頻度が高いほど高レベル(4)を使う。詳細は最も高レベルにする
  - ログファイル出力を今後検討中

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
    - 修正や追加を行っていないファイルについては、表示する必要はありません。
    - 同じファイルに対する修正が続いた場合でも、その他のファイルのことを忘れないでください。

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

### 簡易テストケース

## A. 初期起動・UI要素の表示確認

### 1. アプリ起動

- ウィンドウが表示され、地図（`map.svg`）が5枚横に連続してレンダリングされている
- ツールバーに「追加モード」「編集モード」ボタンがあり、OFF表示になっている
- 右側に「保存」「読み込み」ボタンあり
- 下部に「スライダー」および「現在の年」が表示されている
- 左のサイドバーに「イベント一覧」がある

## 2. 設定ダイアログ確認

- 「設定」ボタンを押すとモーダルが開く
- 最小年・最大年・世界名・概要が入力可能
- 「スライダー更新」や「世界情報を保存」でエラーが出ないか

---

## B. 年スライダー・世界情報の基本操作

### 3. 年スライダー

- スライダーをドラッグすると「`currentYear`」が変化し、コンソールに「年が変更されました」と出る  
- 変更後の「年: XXX」が正しく表示される  

### 4. 世界情報の変更

- 設定ダイアログから「`worldName`」「`worldDescription`」を入力 → 「世界情報を保存」
- 画面の左上などに世界名、概要が反映される

---

## C. 追加モード（点・線・面の追加）

### 1. 点の追加

1. 追加モードON → 「`pointTool`」選択
2. 地図上をクリック → 新規ポイント用の編集フォームが表示される
3. 名前・説明・年を入力 → 保存 → ポイントが作成される
4. イベント一覧にポイントが追加される

### 2. 線の追加

1. 追加モードON → 「`lineTool`」選択
2. 地図上を数回クリックして頂点を増やす → 「確定」ボタン押下（`confirmDrawButton`）
3. ライン編集フォームが出る → 名前・説明・年を保存
4. イベント一覧にラインが追加

### 3. 面 (ポリゴン) の追加

1. 追加モードON → 「`polygonTool`」選択
2. 地図上をクリックして3点以上 → 「確定」
3. ポリゴン編集フォームが出る → 名前・説明・年を保存
4. イベント一覧に面が追加

---

## D. 編集モード（各ツール）

### 1. ポイント移動

- 編集モードON → 「`pointMoveTool`」  
- 既存ポイントをクリック → ポイント選択 → Deleteキー押下して削除確認  
- 別のポイントをマウスドラッグして座標移動  
- 再度同ポイントをクリック → 移動後の位置が維持されている  

### 2. ポイント属性編集

- 「`pointAttributeEditTool`」選択  
- 既存ポイントをクリック → 編集フォーム → 名前・説明を変更 → 保存  
- 「イベント一覧」やツールチップに新しい名前が反映されていることを確認  

### 3. ライン属性編集

- 「`lineAttributeEditTool`」選択  
- 既存ラインをクリック → フォームで名称・説明を変更 → 保存  
- イベント一覧やツールチップに変更が反映される  

### 4. ライン頂点編集

- 「`lineVertexEditTool`」選択
- ラインをクリック → 頂点ハンドルが表示される
- **シフト + クリック** で複数頂点を選択 → ドラッグ → 頂点全て移動
- **Deleteキー** で選択頂点を削除 → 頂点数が減るがライン自体が1点未満にならない限り残る
- ラインが1点になってもラインデータは保持しているか（描画はスキップ）
- 空クリック後に再度頂点追加（エッジハンドル）で復活できるか

### 5. ポリゴン属性編集

- 「`polygonAttributeEditTool`」選択
- 既存ポリゴンをクリック → フォーム表示 → 名称・説明を変更 → 保存
- イベント一覧やツールチップに反映されるか

### 6. ポリゴン頂点編集

- 「`polygonVertexEditTool`」選択
- ポリゴンをクリック → 頂点ハンドルが表示される
- **シフト+クリック** で複数頂点選択 → ドラッグ → 全て移動
- **Deleteキー** で選択頂点を削除 → 頂点が1点になってもポリゴンデータは保持（描画は消える）
- エッジハンドルクリック/ドラッグで頂点追加 → 再度2点→3点→描画がポリゴンに戻る

### 7. Deleteキーで単独ポイント削除

- 単頂点(ポイント)を選択 → Deleteキー → `DataStore.removePoint` → イベント一覧からも消える

---

## E. 保存・読み込み

### 1. 保存動作

- 「保存」ボタン押下 → ダイアログでファイル名指定
- JSONファイルが生成され、コンソールに「データの保存が完了しました。」が出る
- 不明なエラーが出ないこと

### 2. 読み込み動作

1. 編集してデータが更新された状態 → 「読み込み」 → 「保存されていない変更があります。続行しますか？」
2. Yesで続行 → 選択したJSONの内容がロードされ、画面に反映
3. 何も選択せずキャンセル → 「データの読み込みがキャンセルされました」と表示

### 3. 読み込み後の整合

- 読み込んだJSONの年範囲(min/max)や世界名がUIに反映されるか
- イベント一覧にロードしたデータのポイント/ライン/ポリゴンが表示される

---

## F. エッジケース

### 1. 最小限テスト

- ポイントを1個だけ追加 → 保存 → 再読み込み → 問題なく表示される
- ラインを2点だけ → Deleteで1点 → ラインが表示消えるが保持される → 頂点を追加 → 復活
- ポリゴンを3点だけ → Deleteで2点 → ライン化される → Deleteで1点 → 描画消えるがオブジェクト保持 → 頂点追加 → 再度2点、3点 → 再びポリゴン表示
- ポリゴンを毎度頂点1個ずつDeleteして空 → オブジェクトがDataStoreごと削除される

### 2. Shift+クリック多用

- ライン頂点を何度もShift+クリックで選択・解除してドラッグ → 頂点移動が想定通りか

### 3. ポイント移動中のDelete

- `pointMoveTool`で単頂点をクリックし、Delete → 削除されるか

### 4. ツールチップ

- ライン/ポリゴンをドラッグした直後、ツールチップが正しい名前・年を表示する
- ポリゴンを年が複数設定されたプロパティ配列付きで保存してある場合に、スライダー移動で年を切り替え → ドラッグしても正しい年がツールチップに出るか

---

## G. 終了

- アプリの終了
- すべての操作を一通り実施した上で、異常終了（クラッシュ）がないか
- Windows/macOSいずれでも正常終了できるか

## **追加テストケース**

### **H. フォーム表示・ドラッグに関するテスト**

1. **属性フォームがクリック位置付近に出るか**  
   - 編集モードにして「ポイント属性編集」ツールを選択し、任意のポイントをクリック。  
   - フォームがクリック周辺に表示されるか確認。  
   - 保存 or キャンセルでフォームが閉じることを確認。

2. **フォームドラッグテスト**  
   - 属性編集フォームを開き、フォーム上部（テキストやボタンではない部分）をドラッグ。  
   - フォームがスムーズにドラッグ移動できるか、変なジャンプが起きないか確認。

3. **別オブジェクトクリック時のフォーム再表示**  
   - あるラインをクリックして属性フォームを開く。  
   - フォームを閉じずに他のライン or ポリゴンをクリック→ 新しいフォームが、クリックした場所の近くに出るか確認。

4. **詳細ウィンドウがクリック位置付近に出るか**  
   - 編集モードOFFで任意のオブジェクトをクリック。  
   - 詳細ウィンドウがマウス位置付近に表示されるか確認。  
   - 「閉じる」ボタンで消えるか確認。

5. **ツールチップとフォームの共存**  
   - フォームが開いた状態で、別のオブジェクトにマウスオーバーするとツールチップが表示されるか確認。  
   - フォームには影響しないか（位置がずれたりしないか）。

### **I. グリッド表示・オブジェクト配置**

1. **グリッド表示ON/OFF**  
   - グリッド切り替えボタンをクリックしてONにする。地図上に緯度経度ラインが描画されるか。  
   - 再度OFFにするとグリッドが消えるか。  
   - 頂点ドラッグ時、グリッドスナップがあれば正しい動作をするか（将来実装の場合）。

2. **横方向無限スクロール**  
   - 地図を右にズームアウトしてドラッグし、東端の先に地図が続いているか確認（複製表示）。  
   - 左端も同様に確認。  
   - ポリゴンなど大きめオブジェクトを配置しても正しく描画されるか。

### **J. 分裂・合邦の挙動（将来拡張）**

1. **分裂**  
   - ラインやポリゴンに対し、「分裂」操作を行い、オブジェクトが２つに分かれるか。  
   - 分裂後に別個の属性を設定し、時間軸の前後でそれぞれが存在するか確認。

2. **合邦**  
   - 複数のポリゴンを合邦操作して1つの大きなポリゴンにできるか。  
   - 合邦後の属性を編集可能か。

### **K. エラーハンドリング**

1. **JSONファイルが不正な場合**  
   - ファイルを読み込んだ際、フォーマットが壊れている→ 「データの解析中にエラーが発生しました」と出るか。  
   - UIにエラーメッセージが表示されるか。

2. **頂点数不正**  
   - ライン/ポリゴン頂点が1個以下になったとき、描画せずに保持しているか。  
   - 頂点数0になった場合に DataStore から削除されるか。

3. **座標値が極端に大きい/小さい**  
   - スライダーなどに影響しないか。  
   - 表示領域外でも保持されるか。

---

## **変更点: ログレベルに関する追加説明**

1. **ログレベルの基準（logger.js）**  
   - レベル0: ログ出力なし  
   - レベル1: エラーのみ  
   - レベル2: 警告+エラー  
   - レベル3: 情報+警告+エラー  
   - **レベル4: 詳細（すべてのログ）** ← 呼び出し頻度の高い関数呼び出しもここに含む  
2. **ログファイル出力**  
   - `logger.js` 内に `setLogToFile(enabled, filePath)` を追加  
   - `debugLog` 内で `fs.appendFileSync(...)` を用い、コンソール出力とファイル出力を両立させるサンプル実装  

---

### 現在の不具合

- 確認されているものはなし
