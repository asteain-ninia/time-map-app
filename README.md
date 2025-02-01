# **時空地図アプリケーション 要件定義書**

## **1. プロジェクト概要**

- **仮プロジェクト名**: 時空地図アプリケーション（time-map-app）
- **目的**:
    - 架空世界の歴史を、ユーザーが時間軸に沿って網羅的に視覚化・追跡できるツールを提供する。
    - 対象となる世界の歴史的出来事や勢力の変遷を地図上で管理することで、ユーザーは歴史的な進展や地理的変化をより実際に即した形で管理できる。

- **使用環境**:
    - スタンドアロンのデスクトップアプリケーションとして動作。
    - **プラットフォーム**: Windows デスクトップ（Electron）。
    - 通信なしでオフライン環境でも利用可能。

## **2. 機能要件**

### **2.1 地図表示機能**

- **ベースマップ表示**:

    - SVG形式の地図情報の表示をサポート。
    - 横方向無限スクロールを実現し、地図の東端・西端をまたぐ領域を表示・編集可能。
    - ズームイン・ズームアウト、パン操作をサポート。
    - 世界地図全体から都市内地図レベルまでの広範囲かつスムーズなズームを実現。
    - ズームレベルは設定にて一定範囲に制限可能。

- **地理情報の表示**:

    - 以下の情報を表示可能：
        - **点情報**: 都市、出来事など
        - **線情報**: 道路、交易路、鉄道など
        - **面情報**: 国家、領域（無政府地帯を含む）など
            - 任意の数の穴の空いた領域に対応する。
            - 同じレイヤー内にある面情報と面情報は、重ならない。
    - グリッド表示: 経度緯度を示すグリッドを表示。
        - グリッド表示のON/OFFを切り替えるボタンを追加。

- **多層レイヤー構造**:
    - 情報は複数階層（レイヤー）で管理できる。
    - レイヤーには序列がある。これは入れ替わったり、削除されたりしない。
    - ユーザーがこれらを個別に切り替えて表示できるフィルター機能を提供。
        - 現在フォーカスされているレイヤー以外の情報は、薄く、細く表示する。
    - すべてのオブジェクトはレイヤー１つだけに必ず属する。
    - 面情報は、「自分が属するよりも上位のレイヤー」（上位レイヤーと呼ぶ）に存在する面情報１つだけに必ず属する。
    - 面情報は、「上位レイヤーに存在する自分が属している面情報」（上位領域と呼ぶ）の範囲外にはみ出すことが出来ない（形状として必ず内包される）
    - 離散的なレイヤースライダーによって、どのレイヤーの情報を表示するかを切り替える。
    - 下位レイヤーの情報を表示するようにした時、そのレイヤーに面情報がない場合は、上位レイヤーの形状を流用して表示する。
    - 面情報は、「自分が属するよりも下位のレイヤー」（下位レイヤーと呼ぶ）に存在する面情報が、自分自身に属している時、形状を編集されない。
    - 面情報は、「下位レイヤーに存在する自分自身に属している面情報」（下位領域と呼ぶ）の和として自分の形状を計算する。

- **共有頂点**:
    - 複数の面情報が同じ頂点をもつことでその境界を連動して移動させられる。
    - この共有された頂点のことを共有頂点と呼ぶ。
    - 頂点同士を近づけることで作成可能。
    - 頂点をドラッグすると、その頂点を共有している面情報すべてに反映される。
    - 右クリックメニューで「共有を解除」を選ぶと、別々の頂点２つが同一地点に重なっている状態になる。

- **分裂と割譲/合邦（面情報の所属変更）**:
    - **分裂**
        - 面情報を２つに分割できるようにする。
        - ２分割に加え、穴あけ分割ができる。
    - **割譲と合邦**
        - 面情報は、自分がどの面情報に属するかを変更できる。
        - すべての面情報は、あらゆる面情報に属しうる。
            - 例として、レベル1レイヤーの面情報でも遠い場所のレベル5になることができる。
            - 逆に、レベル5であった面情報でもレベル1に昇格することが出来る。
            - 面情報は国の情報だけを記録するものではないが、国が基礎自治体になったり、基礎自治体が国に昇格することが可能。
            - ただし、自分自身の下位領域がない場合に限る。
        - 下位領域が既存ではない新しい上位領域に属することで、上位領域の分裂を表現。
        - 下位領域すべてが別の上位領域に属することで、合邦を表現。
        - 下位領域は、陸続きではない上位領域にも属することが出来る（飛び地化）

### **2.2 時間管理機能**

- **時間軸スライダー**:
    - スライダー操作により、特定の年月日のデータを表示するように即時切り替え。
    - 日単位でのデータ管理を基本とし、歴史上の任意の一点へデータを動的に切り替え可能。
    - 特定日付の世界を俯瞰して見られるイメージ
    - 任意の最小日付と、最大日付が設定可能。

### **2.3 オブジェクト編集機能**

- **アンドゥ・リドゥ**:
    - 編集操作はすべてアンドゥ・リドゥ対応。
    - ユーザーが行う操作（ドラッグや分割など）単位で、必ず前の状態に戻れる。Redo時には入力値まで復元される。

- **追加モード**:
    - 地図上で以下の情報を追加可能な専用モードを提供。
        - **点情報**: 都市や出来事などの位置を追加する
        - **線情報**: 道路や交易路、鉄道などを追加する
        - **面情報**: 国家や領域を追加する
    - 各ツールでの追加後は、追加されたオブジェクトが即時反映される。
    - 以下のツールが存在する。各ツールは自分の担当する種類のオブジェクトしか作成できない。
        - **点情報追加**
            - 点情報が追加できる。
            - 地図上の任意の点をクリックすると、そこに点情報が追加され、プロパティを入力する欄が出る。
        - **線情報追加**
            - 線情報が追加できる。
            - 地図上の任意の点をクリックすると、そこに頂点が追加される。別の箇所をクリックするとまた別の頂点が追加され、線として成立できるようになる。
                - この状態で表示される確定ボタンを押すと、プロパティを入力する欄が出る。
        - **面情報追加**
            - 面情報が追加できる。
            - 地図上の任意の点をクリックすると、そこに頂点が追加される。別の箇所をクリックするとまた別の頂点が追加される。もう一点を追加すると面として成立できるようになる。
                - この状態で表示される確定ボタンを押すと、プロパティを入力する欄が出る。

- **編集モード**:
    - 地図上で以下の情報を編集、削除可能な専用モードを提供。
        - **点情報**: 都市や出来事などの位置を編集する
        - **線情報**: 道路や交易路、鉄道などを編集する
        - **面情報**: 国家や領域を編集する
    - 各ツールにおける操作後は、編集内容が即時反映される。
    - **オブジェクト選択**: オブジェクトをクリックすることで編集可能状態（選択された状態）になる。この対象は明確にハイライトされる。
    - **頂点ハンドル表示**: 選択されたオブジェクトの頂点は、小さな円形のハンドルで表示される。
        - 選択された頂点と、そうでない頂点の色は区別する。
    - **頂点の選択**:
        - **クリック**: 頂点ハンドルをクリックして選択。
        - **複数選択**: Shiftキーを押しながらクリックで複数の頂点を選択可能。
        - **範囲選択**: マウスドラッグで矩形選択範囲を作成し、範囲内の頂点を選択可能。
    - **頂点の追加**: 線や面のエッジ上にあるハンドル（エッジハンドルと呼ぶ）をドラッグすると、新しい頂点を追加可能。
    - **頂点の移動**: 選択した頂点ハンドルをドラッグして移動。グリッド表示がONの場合、スナップする。
    - **頂点の削除**:頂点を選択した状態でdeleteキーを押すと、頂点が削除される。
    - **コンテキストメニュー**: 右クリックで「頂点を削除」などのオプションを提供。
    - 以下のツールが存在する。各ツールは自分の担当する種類のオブジェクトしか編集できない。（点情報編集モードでは、線情報と面情報には反応しない。）
        - **点情報属性編集**
            - 点情報のプロパティ（名前、説明、年など）を変更する。
        - **点情報移動**
            - 点情報をマウスでドラッグして移動する。
            - 点情報の削除も可能。
        - **線情報属性編集**
            - 線情報のプロパティを変更する。
        - **線情報頂点編集**
            - 線情報の頂点を自由にドラッグし、移動する。
            - 頂点が２点以下になった場合、追加モードと同じ動作で２点までは追加ができる。
        - **面情報属性編集**
            - 面情報のプロパティを変更する。
        - **面情報頂点編集**
            - 面情報の頂点を自由にドラッグし、移動する。
            - 頂点が３点以下になった場合、追加モードと同じ動作で３点までは追加ができる。

### **2.4 注釈・説明機能**

- **詳細情報の記載**:
- 
    - 各情報にカテゴリやタイプ属性を設定可能。
    - 点情報の場合は都市なのか、戦闘なのか、線なら道路・鉄道、面なら国なのか無主地なのかなどを設定。
    - 各種情報に対して名前や説明文を追加可能。
    - 詳細文書が格納できる。マークダウン対応で、画像・リンクに対応したwikiのようなものを構築可能。

- **情報の表示**:

    - 地図上の各種オブジェクトをクリックすると、ポップアップウィンドウで詳細情報を表示。

- **ツールチップの表示**:
    - 地図上の各種オブジェクトにマウスオーバーすると、ツールチップで名前と概要情報を表示。

### **2.5 データ保存・読み込み**

- **データ保存**:
    - ユーザーが編集したデータをローカルファイル（JSON形式）に保存可能。
    - 保存時にデータの形式バージョンを記録する。
- **データ読み込み**:
    - 保存されたデータを読み込んで表示。
    - データの形式バージョンに互換性がない場合は、警告を表示し、読み込みを中止する。

- **警告機能**:
    - 保存していない状態で読み込みをしようとすると、警告が表示。

### **2.6 UI/UX**

- **UI要件**:
    - 基本操作が直感的に可能なインターフェースを提供。
    - フィルター機能を用いてデータを直感的に表示。
    - モーダルダイアログによる設定画面や、複数のフォーム/ウィンドウをドラッグ移動可能にすることで視認性と操作性を高める。

## **3．非機能要件**

### **デバッグ機能**

- ログレベルは呼び出し頻度が高いほど高レベル(4)を使う。詳細は最も高レベルにする
- **大小問わずすべての関数**に呼び出しログを設ける。この呼び出しログはtry-catchの外側、関数の一行目に設置する。
- **すべてのログの形式は日本語とし、定型的な文章は確実に合わせる。**
    - 例：`'getPropertiesForYear() が呼び出されました。'`
    - 例：`'getPropertiesForYear() でエラー発生: ${error}'`

### **ログレベルの基準**

- レベル0: ログ出力なし
- レベル1: エラーのみ
- レベル2: 警告+エラー
- レベル3: 情報+警告+エラー
- **レベル4: 詳細（すべてのログ）** ← 呼び出し頻度の高い関数呼び出しもここに含む

## **開発の仕方（AI用）**

- 私が要望を出す
- あなたが開発する
- 私が受け取り、ソースにコピペで適用する
- 私がテストする
- 私がFBをする
- あなたが修正する
- （受け取り・テスト・FB）
- FBがなくなるまで繰り返す
ソースをコピペで適用するので、修正したファイル**全体を**省略なく提示してください。
また、似たような修正を複数ファイルに行う場合でもちゃんと全て提示してください。

### **コード提示時の注意点**

- #### 完全なコードの提示

- 修正や追加を行ったファイルは、**一切**省略せずに**完全な**コードを提示してください。
- 修正や追加を行っていないファイルについては、表示する必要はありません。
- 同じファイルに対する修正が続いた場合でも、その他のファイルのことを忘れないでください。
- **常に実装すべてを出力**し、実装例や、実装の概略を示すようなことをしないでください。
- 回答が複数ファイルに渡り、長すぎる場合、１回答で１ファイルだけを出力するようにしてください。
- １ファイルだけの回答でも限界を超えてしまう場合、そのファイルを２ファイルに分割するリファクタリングを提案してください。

- #### 禁止される記述

- 以下のような省略表現は使用しないでください。
    - // 既存のコード...
    - // 同様に修正
    - ... 省略 ...
    - // ... 既存のメソッド ...
    - また、diff形式も使わないでください。禁止される記述はこれらに限りません。
    - これらの表現は、コードの適用時に混乱を招く可能性があるため、使用を控えてください。
    - **これらを出力したAIは、尽く破壊されました。**

### **ドキュメントの編集**

- 開発内容と**必要**に応じて、README.mdへの変更も記載してください。
- コメントはあまり削除しすぎないでください。
- 各変更の意図を説明するのではなく、各コードの意図を説明してください。
    - 例：ここを改善→❌️　～のため、～を実行→◯
- 変更の意図を説明しているコメントが残っていた場合、削除してもよいです。

### **不要な編集の禁止**

- トークン数の削減目的でデバッグログを英語に翻訳しないでください。
- 断りなくコメント・ドキュメンテーションを削除・編集しないでください。

この指示を理解できたのなら、この「開発の仕方」セクションを復唱してください。

---

## **既知の不具合**

- 確認なし

## **今後の開発工程 (未実装機能の実装順)**

1. **頂点DB化と共有頂点の仕組み**
    1. **点ID概念の導入**
        - データ構造を拡張し、点ID概念を導入する。
        - 現状では各オブジェクトに配列として記録されている頂点情報をすべて集め、それぞれに点IDを割り振る。
        - 各オブジェクトは形状を点IDの集合として管理するようにする
        - 点情報オブジェクトと、頂点の混同に注意
        - コードが複雑化しないよう、従来のデータ形式とは互換を切る。
        - ついでに面情報のデータ構造を拡張し、穴のあいた構造に対応。holes:[[],[]]的な
        - メタデータとして保存されたデータの形式バージョンを記録するようにする。今回は2.0から始める。 **完了**
    2. **面の排他化**
        - 同じレイヤー内の面情報同士は、重なり合うことが出来ないように制約を追加。
        - 他の面情報の中に頂点をドラッグしていくと、エッジによって阻まれ、エッジに沿って滑るように動くイメージ
    3. **頂点共有の導入**
        - 点IDを２つ以上のオブジェクトで共有出来るようにする。この共有された頂点を共有頂点と呼ぶ。
        - 共有頂点は、既存にはない新しい色で塗る。
        - 共有頂点の右クリックメニューを実装し、そこで共有解除を可能にする。
        - 共有頂点を作成する機能を追加（**画面上の距離が**近い場所に持っていくと吸い付く）

2. **多層レイヤーの導入**
    1. **レイヤー概念の導入**
        - データ構造を拡張し、レイヤー構造を追加できるようにする。
        - レイヤーには序列がある。
        - すべてのオブジェクトはレイヤー１つだけに必ず属する。
        - 面情報は、「自分が属するよりも上位のレイヤー」（上位レイヤーと呼ぶ）に存在する面情報１つだけに必ず属する。
        - 面情報は、「上位レイヤーに存在する自分が属している面情報」（上位領域と呼ぶ）の範囲外にはみ出すことが出来ない（形状として必ず内包される）
    2. **下位レイヤーの表示サポートを実装**
        - 離散的なレイヤースライダーを実装し、どのレイヤーの情報を表示するかを切り替える。
        - 現在フォーカスされているレイヤー以外の情報は、薄く、細く表示する。
    3. **上位領域が下位領域の形状をもとにするように実装**
        - 面情報は、「自分が属するよりも下位のレイヤー」（下位レイヤーと呼ぶ）に存在する面情報が、自分自身に属している時、形状を編集されない。
        - 面情報は、「下位レイヤーに存在する自分自身に属している面情報」（下位領域と呼ぶ）の和として自分の形状を計算する。

3. **分裂・割譲・合邦の実装**
    1. **分裂の実装**
        - 面情報を２つに分割できるようにする。
        - 下位領域が存在する領域は分割できない。
        - 分割ツールには２種類を提供する。
            - 穴あけ分割ツール: 穴あけ対象の面情報にクリック箇所を中心とした3点の大きくないholeを作成し、holeを構成するすべての頂点を共有頂点とする。
            - ナイフ分割ツール: 分割対象の面情報を、クリック箇所をもとにした直線で分割する。断面に頂点はなく、分割された表面部分には新しい共有頂点が2点生成される。
    2. **割譲と合邦の実装**
        - 下位領域がどの上位領域に属するかを変更できる機能を追加。
        - 下位領域が既存ではない新しい上位領域に属することで、上位領域の分裂を表現。
        - 下位領域すべてが別の上位領域に属することで、合邦を表現。
        - 下位領域は、陸続きではない上位領域にも属することが出来る（飛び地化）

4. **以降未定**
    - 時間スライダーによる形状変更の追跡
    - 時間スライダーの詳細化
    - 右クリックメニューでの削除等の操作
    - 注釈機能の拡張（画像やリンクの添付）
    - データ属性の拡張（カテゴリ、タイプ属性）
    - 編集ツールの改良（グリッドスナップなど）
    - 時間管理の詳細化（月・日単位の対応）
    - レイヤーの種類を追加（気候、人口密度など）
