# @soukadao/remark-notes

## ライブラリ名

`@soukadao/remark-notes`

## プラグインの概要

GitHub Alerts と Qiita 風 note 記法を共通の note 構造へ正規化する remark プラグインです。

note の種類、タイトル、元の記法を data と HTML 用 properties に付与し、レンダラー側で同じ class 名を使って表示できます。

## プラグインでの記法

GitHub Alerts 記法です。

```md
> [!NOTE]
> GitHub alert content.
```

```md
> [!WARNING]
> First line
> second line.
```

Qiita 風 note 記法です。

```md
:::note warn
Qiita note content.
:::
```

複数ブロックを含めることもできます。

```md
:::note alert

- First item
- Second item

:::
```

標準で使える種類は `note`, `tip`, `important`, `warning`, `caution` です。`info` は `note`、`warn` は `warning`、`alert` は `caution` として扱われます。
