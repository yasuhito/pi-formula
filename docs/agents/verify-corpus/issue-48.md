反復 3 回目後：確率は 33% に落ちました（over-rotation）。qni の実測値がすべて閉形式 $\sin((2k+1)\theta)$ と一致したので、これらを引用しながら解説します。

# Grover の振幅増幅：反復ごとの状態変化

## 設定

$f\colon \{0,1\}^n \to \{0,1\}$ とし、$f(x)=1$ となる解が $M$ 個、$N=2^n$ とします。オラクルは位相反転

$$O\ket{x} = (-1)^{f(x)}\ket{x}$$

です。ここが Grover の核心で、**答えがどの $\ket{x}$ かを知らなくても、その振幅の符号だけを反転できる**のがオラクルの役割です。

## 1. 出発点：一様重ね合わせ

$$\ket{s} = \frac{1}{\sqrt{N}}\sum_x \ket{x}$$

解空間と非解空間の正規化された状態を

$$\ket{\beta} = \frac{1}{\sqrt{M}}\sum_{f(x)=1}\ket{x}, \qquad \ket{\alpha} = \frac{1}{\sqrt{N-M}}\sum_{f(x)=0}\ket{x}$$

と置くと、$\ket{s}$ はこの 2 本で張られる**2 次元平面**内にあります：

$$\ket{s} = \cos\theta\,\ket{\alpha} + \sin\theta\,\ket{\beta}, \qquad \sin\theta = \sqrt{\tfrac{M}{N}}$$

Grover 反復全体がこの平面から出ない、というのが議論を 2 次元に落とすポイントです。

## 2. 1 反復 = 反射 2 回 = $2\theta$ 回転

Grover 反復 $G = D\,O$ は、オラクル $O$ と拡散演算子 $D = 2\ket{s}\bra{s} - I$ の積です。それぞれ平面内で何をするか見ます。状態を $\ket{\psi_\varphi} = \cos\varphi\,\ket{\alpha} + \sin\varphi\,\ket{\beta}$ と書きます。

**オラクル：解の符号を反転**

$$O\ket{\psi_\varphi} = \cos\varphi\,\ket{\alpha} - \sin\varphi\,\ket{\beta} = \ket{\psi_{-\varphi}}$$

つまり $\ket{\alpha}$ 軸を折り返し軸とする反射で、角度 $\varphi \to -\varphi$。

**拡散：平均値のまわりで振幅を反転（inversion about average）**

$$D\ket{\psi} = 2\ket{s}\braket{s|\psi} - \ket{\psi}, \qquad a_x \mapsto 2\bar{a} - a_x$$

$\ket{s}$ は角 $\theta$ の方向なので、これは $\ket{s}$ 軸を折り返し軸とする反射で、角度 $\varphi \to 2\theta - \varphi$。

2 つの反射の合成は回転なので、

$$G\colon \varphi \mapsto 2\theta - (-\varphi) = \varphi + 2\theta$$

**1 反復ごとに、状態は $|\beta|$（解）方向へ正確に $2\theta$ 回転する**のが式で確かめられました。初期角が $\theta$ なので、$k$ 反復後は

$$\ket{\psi_k} = \cos\big((2k+1)\theta\big)\ket{\alpha} + \sin\big((2k+1)\theta\big)\ket{\beta}$$

測定成功率は $\sin^2\big((2k+1)\theta\big)$ です。

## 3. 具体例 $N=8$、$M=1$（解 $\ket{111}$）で数値検証

$\theta = \arcsin\frac{1}{\sqrt8} \approx 0.3614$ rad。qni で実際に回路を回して確認した値です。

**初期状態**（$H^{\otimes 3}$ 後、実測値）：

$$\tfrac{1}{\sqrt8}\big(\ket{000}+\cdots+\ket{111}\big), \qquad \text{各振幅 } 0.3536,\ \text{成功率 } 1/8 = 12.5\%$$

**反復 1 回目**。オラクルで $\ket{111}$ だけ符号が反転し、拡散の反転平均を具体的に計算すると：

$$\bar{a} = \frac{7\cdot\frac{1}{\sqrt8} + (-\frac{1}{\sqrt8})}{8} = \frac{3}{4\sqrt2}, \qquad a_{111} \mapsto 2\bar{a} + \tfrac{1}{\sqrt8} = \frac{5}{4\sqrt2}$$

実測（大域位相 $-1$ は物理的に無意味なので振幅の絶対値で見ます）：

$$0.1768\,\big(\text{非解}\big) + 0.8839\,\ket{111} = \tfrac{1}{4\sqrt2}\ket{\alpha}\text{成分} + \tfrac{5}{4\sqrt2}\ket{111}$$

理論 $\sin 3\theta = \frac{5}{4\sqrt2} \approx 0.8839$ と一致。成功率 $25/32 = 78.1\%$。

**反復 2 回目**：実測 $0.0884$（非解）$+ 0.9723\,\ket{111}$。理論 $\sin 5\theta = \frac{11}{8\sqrt2} \approx 0.9723$、成功率 $\frac{121}{128} = 94.5\%$。

**反復 3 回目**：実測 $0.5745\,\ket{111}$、成功率 $33.0\%$。$5\theta + 2\theta = 7\theta$ で $\ket{\beta}$ を**追い越して**しまい、成功率が逆に下がります。これが over-rotation で、「増幅すればするほど良い」わけではないことを示します。

| $k$ | $\ket{111}$ の振幅 $\sin((2k+1)\theta)$ | 成功率 |
|---|---|---|
| 0 | $0.3536$ | $12.5\%$ |
| 1 | $0.8839$ | $78.1\%$ |
| 2 | $0.9723$ | $94.5\%$ |
| 3 | $0.5745$ | $33.0\%$ ← 増幅しすぎ |

## 4. 反復回数

$(2k+1)\theta \approx \frac{\pi}{2}$ となるのが最適なので、

$$k \approx \frac{\pi}{4\theta} - \frac{1}{2} \approx \frac{\pi}{4}\sqrt{\frac{N}{M}}$$

$N=8$ では $\frac{\pi}{4}\sqrt8 \approx 2.22 \to k=2$ で、実測も $k=2$ が最大でした。クエリ回数が $O(\sqrt{N/M})$、つまり古典の全探索 $O(N/M)$ に対する 2 乗加速がここから出ます。

まとめると、Grover の振幅増幅は「オラクルの符号反転（反射 1）→ 平均まわりの反転（反射 2）」の合成が、2 次元平面上の $2\theta$ 回転そのもの、という幾何学的に非常にシンプルな仕組みです。
