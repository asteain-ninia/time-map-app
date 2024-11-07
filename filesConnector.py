import os
import glob

# ファイルを全て１ファイルに結合します。　python .\filesConnector.py で実行します。
# o1などのファイル読み込み機能のないAIに読み込むときに使用します。

# 結合したい拡張子のリスト
extensions = ['.js', '.html', 'md', 'css', 'cjs']  # ここに複数の拡張子を追加できる
output_file = 'combined_file.txt'  # 出力するファイル名

# 無視したいファイル名のリスト
ignore_files = ['package.json', 'package-lock.json']  # ここに無視したいファイル名を追加

# 結合するファイルを開く
with open(output_file, 'w', encoding='utf-8') as outfile:
    # 現在のディレクトリ内の全ファイルをチェック
    for ext in extensions:
        # 拡張子に一致するファイルを取得
        for filename in glob.glob(f'*{ext}'):
            # 無視するファイル名の場合はスキップ
            if filename in ignore_files:
                continue
            with open(filename, 'r', encoding='utf-8') as infile:
                outfile.write(f"\n--- Start of {filename} ---\n\n")
                # ファイルの内容を読み取って出力ファイルに書き込む
                outfile.write(infile.read())
                # 区切りとしてファイル名を挿入する場合
                outfile.write(f"\n\n--- End of {filename} ---\n")

print(f'ファイルは {output_file} に結合されました。')
