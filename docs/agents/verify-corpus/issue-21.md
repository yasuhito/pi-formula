N 次元の計算基底 $|x\rangle$（$x = 0, \dots, N-1$）に対して

$$
\mathrm{QFT}_N|x\rangle = \frac{1}{\sqrt{N}} \sum_{k=0}^{N-1} e^{2\pi i\, xk/N}\, |k\rangle
$$

重ね合わせに対しては線形に拡張する：

$$
\mathrm{QFT}_N \sum_x \alpha_x |x\rangle = \frac{1}{\sqrt{N}} \sum_{k=0}^{N-1} \left(\sum_x \alpha_x\, e^{2\pi i xk/N}\right) |k\rangle
$$

つまり、振幅ベクトル $\alpha$ に離散フーリエ変換（DFT）をユニタリに作用させたもの。位相 $\omega = e^{2\pi i/N}$ を使うと行列要素は

$$
F_N[j,k] = \frac{\omega^{jk}}{\sqrt{N}}
$$

逆変換は共役転置 $F_N^\dagger$（$\omega^{jk} \to \omega^{-jk}$）。

$$
F_8 = \frac{1}{\sqrt{8}}
\begin{pmatrix}
1 & 1 & 1 & 1 & 1 & 1 & 1 & 1 \\
1 & \omega & \omega^2 & \omega^3 & \omega^4 & \omega^5 & \omega^6 & \omega^7 \\
1 & \omega^2 & \omega^4 & \omega^6 & 1 & \omega^2 & \omega^4 & \omega^6 \\
1 & \omega^3 & \omega^6 & \omega & \omega^4 & \omega^7 & \omega^2 & \omega^5 \\
1 & \omega^4 & 1 & \omega^4 & 1 & \omega^4 & 1 & \omega^4 \\
1 & \omega^5 & \omega^2 & \omega^7 & \omega^4 & \omega & \omega^6 & \omega^3 \\
1 & \omega^6 & \omega^4 & \omega^2 & 1 & \omega^6 & \omega^4 & \omega^2 \\
1 & \omega^7 & \omega^6 & \omega^5 & \omega^4 & \omega^3 & \omega^2 & \omega
\end{pmatrix}
$$
