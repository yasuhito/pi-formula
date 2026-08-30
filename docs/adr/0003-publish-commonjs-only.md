# ADR 0003: CommonJSだけを配布する

## 状況

pi-formulaは新しいパッケージなのでES Modulesを選べる。一方、qni-cliはCommonJSであり、pi-formulaの公開インターフェースと二重登録を防ぐ共有状態を直接使う。CommonJS版とES Modules版を両方配ると、Node.jsが同じパッケージを別のモジュールとして読み込み、共有状態が分かれる危険がある。

MathJax 4はCommonJSとES Modulesの両方を提供し、ResvgはCommonJSとして利用できる。Node.js 22はCommonJSを正式に扱う。

## 決定

pi-formula 0.1.0はCommonJSだけを配布する。ES Modulesとの二重配布は行わない。

## 結果

qni-cliから同期的に利用でき、数式描画の共有状態を一つに保てる。二種類の成果物と公開条件を管理せずに済む。

ES Modules専用の利用者は直接importできない。必要性が生じた場合は、共有状態と二重読み込みを壊さない境界を改めて設計する。

## 検討した選択肢

- ES Modulesだけを配る: 新しいNode.jsパッケージとして自然だが、CommonJSのqni-cliからの利用が複雑になるため採らない。
- CommonJSとES Modulesを両方配る: 利用範囲は広がるが、二重読み込みと共有状態の分断を招くため採らない。
