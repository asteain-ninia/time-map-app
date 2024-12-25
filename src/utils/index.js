// src/utils/index.js

/**
 * utils/ ディレクトリのエントリポイント
 * - timeUtils など、他のユーティリティモジュールをまとめて export する
 */

export { getPropertiesForYear } from './timeUtils.js';
// ここに将来、geometryUtils や dataUtils などを追加可能
//今回は getPropertiesForYear しかありませんが
//**「形状計算系」や「文字列操作系」**などのユーティリティを今後追加する場合は、この index.js で一括エクスポートすると便利です。
