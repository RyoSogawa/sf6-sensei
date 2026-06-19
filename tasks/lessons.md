# Lessons

## Splide `autoWidth` + iOS Safari の画像デコードで初回表示だけ中央がずれる

- **症状**: SP（実機 iOS Safari）で FV カルーセルの各スライドが「初回表示だけ右にずれ、2回目以降は直る」。
- **原因**: `autoWidth: true` はスライド幅を画像の実寸から測る。iOS Safari は画像デコードを初回表示の瞬間に遅延実行するため、Splide が幅を測った時点でサイズ未確定 → そのスライドの中央位置を誤った幅で確定 → 初回だけずれる。
- **再現の落とし穴**: emulated Chrome（chrome-devtools）ではデコードが速く、cold load + throttle でも再現しなかった。**実機 Safari のデコードタイミング由来のレイアウト不具合は emulator で再現できないことがある**。
- **誤った修正**: `loading=eager` + `splide.refresh()` は最終状態しか直らず初回ずれは残る。CSS で `.splide__slide { width: 86vw }` を直接当てるのは `autoWidth` と競合して逆に +85px ずれた。
- **正解**: SP の breakpoint で `autoWidth: false` + `fixedWidth: '86vw'`。スライド幅を Splide 自身が固定し、**中央位置を画像デコードに非依存**にする。画像は `max-width: 100%` でスライド内に収める。
- **検証方法**: 再現できない不具合は「**画像を幅0に潰して（デコード前を模擬）も中央オフセットが0のままか**」を構造的に確認する。390px/600px 両方で `slideOff: 0` を確認。
