import os
import glob
import sys

# 結合したい拡張子のリスト（引数がない場合のデフォルト）
default_extensions = ['.js', '.html', '.md', '.css', '.cjs']
output_file = 'combined_file.txt'  # 出力ファイル名
ignore_files = ['package.json', 'package-lock.json']  # 無視するファイル名
src_dir = 'src'  # ソースコードのルートディレクトリ

# コマンドライン引数から拡張子を取得（デフォルトはdefault_extensions）
extensions = [f'.{arg}' for arg in sys.argv[1:]] if len(sys.argv) > 1 else default_extensions

# 処理対象のファイルパスを保持するリスト
processed_files = []

def write_file_content(outfile, file_path):
    """
    指定されたファイルの内容を出力ファイルに書き込む。
    ファイルの境界を示す情報を追加。
    """
    relative_path = os.path.relpath(file_path, start='.')
    processed_files.append(relative_path)  # 処理対象ファイルをリストに追加
    outfile.write(f"\n--- Start of {relative_path} ---\n\n")
    with open(file_path, 'r', encoding='utf-8') as infile:
        outfile.write(infile.read())
    outfile.write(f"\n\n--- End of {relative_path} ---\n")

def process_directory(dir_path, outfile):
    """
    指定されたディレクトリ内のファイルを再帰的に処理。
    """
    for item in os.listdir(dir_path):
        item_path = os.path.join(dir_path, item)
        if os.path.isdir(item_path):
            # サブディレクトリの場合は再帰的に処理
            process_directory(item_path, outfile)
        elif os.path.isfile(item_path):
            # ファイルの場合は拡張子と無視リストを確認
            _, ext = os.path.splitext(item_path)
            if ext in extensions and item not in ignore_files:
                write_file_content(outfile, item_path)

def process_files_in_current_dir(outfile):
    """
    カレントディレクトリ内の対象ファイルを処理。
    """
    for ext in extensions:
        for file_path in glob.glob(f'*{ext}'):
            if os.path.isfile(file_path) and os.path.basename(file_path) not in ignore_files:
                write_file_content(outfile, file_path)

# 出力ファイルを生成して結合処理を実行
with open(output_file, 'w', encoding='utf-8') as outfile:
    # srcディレクトリ内のファイルを処理
    if os.path.isdir(src_dir):
        process_directory(src_dir, outfile)
    # カレントディレクトリ内のファイルを処理
    process_files_in_current_dir(outfile)

    # 処理対象ファイルのパスを追記
    outfile.write("\n--- Processed Files ---\n")
    outfile.write("\n".join(processed_files))

print(f'ファイルは {output_file} に結合されました。')
print(f'対象拡張子: {extensions}')
