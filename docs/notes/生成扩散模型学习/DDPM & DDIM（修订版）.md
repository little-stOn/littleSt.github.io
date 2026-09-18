最近想学习一下生成模型的基础原理。现在扩散模型几乎成了生成模型里的主流方案，所以目前打算从 DDPM、DDIM 这些经典的扩散模型学起，重点看看它们背后的数学逻辑，以及这个方向是怎么一步步优化过来的。

# 借鉴资料

大部分内容直接取自以下材料，相当于一遍自己的复述，也是自己重新理一遍完整的思路

- [《生成扩散模型漫谈（一）：DDPM = 拆楼 + 建楼》](https://spaces.ac.cn/archives/9119)
- [《生成扩散模型漫谈（二）：DDPM = 自回归式VAE》](https://spaces.ac.cn/archives/9152)
- [《生成扩散模型漫谈（三）：DDPM = 贝叶斯 + 去噪》](https://spaces.ac.cn/archives/9164)

上面都是很有启发性的教程

# DDPM

DDPM 这个模型的主要思路就是把生成这个过程人为地构造出一种学习的对象，我们不知道从噪声中怎样生成一个精美的图像，但是我们很容易就可以把一张图片变成随机噪声，如果我们反过来学习这个逆过程，就可以一步一步地从噪声生成图片

我们先从加噪的过程说起，一个很自然的方法就是保留原图的基础上加入一点随机噪声：

$$ x_t = \alpha_t x_{t - 1} + \beta_t \epsilon_{t} $$

其中：$\epsilon_{t} \sim \mathcal{N}(0, I)$

我们可以看到我们每次都会对于当前的图片加上一个随机的噪声，那么怎么逆向这个过程呢，一个最简单的想法是对上面的式子做一个逆变换：

$$ x_{t-1} = \frac{1}{\alpha_t}(x_t - \beta_t \epsilon_{t}) $$

但是这样做有一个问题，就是我们并不知道 $\epsilon_{t}$ 是什么，如果我们这里还是随机地从 $\mathcal{N}(0, I)$ 里采样一个噪声，由于高斯噪声的叠加依然是高斯噪声，那么我们得到的 $x_{t-1}$ 就是一个随机的图像，而不是我们想要的图像。

所以我们需要训练一个模型来预测这个噪声 $\epsilon_{t}$，具体来说我们考虑学习这样一个噪声： $\epsilon_{\theta}({x_{t}, t})$，那么损失函数就可以自然地设为：
$$L = \mathbb{E}_{t, x_t, \epsilon_t} \left[ \| \epsilon_t - \epsilon_\theta(x_t, t) \|^2 \right] $$

这里我们先把“预测单步噪声”作为一个直觉上的出发点。严格来说，DDPM 的训练目标来自变分下界中反向分布与前向分布之间的 KL 散度，后面得到的累计噪声预测形式也可以从这个变分目标中推导出来，具体的推导过程较为复杂，严肃[学习](https://spaces.ac.cn/archives/9152)。

到这里我们已经对模型的基本思路有了大概的理解，剩下就是完善其中的数学细节，这里有几个问题：
1. 这个加噪的过程是如何定义的？$\alpha_t$ 和 $\beta_t$ 是如何选择的？有没有哪些参数的设置能够为我们的模型带来更大的便利？
2. 这个损失函数中的 $x_t$ 应该是我们加噪后的结果，后面我们推导的时候会思考这个损失函数能不能够简化，或者说我们能不能直接用 $x_0$ 来表示这个损失函数？

第二个问题实际上建立在第一个问题的基础上，所以我们一个一个解决：

第一个问题这里主要考虑的是怎样提高加噪的速度，虽然定义是一步一步地递推式，但是实际上我们可以算出一个闭式的表达式：
$$
\begin{aligned}
\boldsymbol{x}_t &= \alpha_t \boldsymbol{x}_{t-1} + \beta_t \boldsymbol{\varepsilon}_t \\
&= \alpha_t (\alpha_{t-1} \boldsymbol{x}_{t-2} + \beta_{t-1} \boldsymbol{\varepsilon}_{t-1}) + \beta_t \boldsymbol{\varepsilon}_t \\
&= \cdots \\
&= (\alpha_t \cdots \alpha_1) \boldsymbol{x}_0 + \underbrace{(\alpha_t \cdots \alpha_2)\beta_1 \boldsymbol{\varepsilon}_1 + (\alpha_t \cdots \alpha_3)\beta_2 \boldsymbol{\varepsilon}_2 + \cdots + \alpha_t \beta_{t-1} \boldsymbol{\varepsilon}_{t-1} + \beta_t \boldsymbol{\varepsilon}_t}_{\text{多个相互独立的正态噪声之和}}
\end{aligned} \tag{4}
$$

如果我们引入条件： $\forall t, \alpha_t ^2 + \beta_t ^2 = 1$，就可以发现最后所有的噪声之和可以被看作是一个新的高斯噪声 $\boldsymbol{\varepsilon} \sim \mathcal{N}(0, I)$，于是我们就可以得到一个简化的表达式：

$$
(\alpha_t \cdots \alpha_1)^2 + (\alpha_t \cdots \alpha_2)^2 \beta_1^2 + (\alpha_t \cdots \alpha_3)^2 \beta_2^2 + \cdots + \alpha_t^2 \beta_{t-1}^2 + \beta_t^2 = 1 \tag{5}
$$

所以实际上相当于有

$$
\boldsymbol{x}_t = \underbrace{(\alpha_t \cdots \alpha_1)}_{\text{记为}\bar{\alpha}_t} \boldsymbol{x}_0 + \underbrace{\sqrt{1 - (\alpha_t \cdots \alpha_1)^2}}_{\text{记为}\bar{\beta}_t} \bar{\boldsymbol{\varepsilon}}_t, \quad \bar{\boldsymbol{\varepsilon}}_t \sim \mathcal{N}(\boldsymbol{0}, \boldsymbol{I}) \tag{6}
$$

这样我们就可以发现，只要预处理的时候计算好需要的 $\bar{\alpha}_t$ 和 $\bar{\beta}_t$，就可以直接从 $x_0$ 计算出任意时刻的 $x_t$，而不需要一步一步地递推下去，这样就大大提高了加噪的速度。

下一步，我们来考虑第二个问题，损失函数中的 $x_t$ 是否可以用 $x_0$ 来表示。根据上面的推导，我们知道：

$$
x_t = \bar{\alpha}_t x_0 + \bar{\beta}_t \bar{\epsilon}_t
$$

但是仔细思考就会发现，我们虽然可以用这个式子直接采样 $x_t$，但不能在保持监督目标仍为单步噪声 $\epsilon_t$ 的同时，简单地用一个独立采样的 $\bar{\epsilon}_t$ 替换。这是因为 $\bar{\epsilon}_t$ 是各步噪声的线性组合，它与其中最后一步的 $\epsilon_t$ 相关；如果把监督目标改成 $\bar{\epsilon}_t$，还需要进一步说明它为什么仍然能够确定反向分布的均值。因此我们先绕开 $\bar{\epsilon}_t$，考虑：

$$
\boldsymbol{x}_t = \alpha_t \boldsymbol{x}_{t-1} + \beta_t \boldsymbol{\varepsilon}_t = \alpha_t (\bar{\alpha}_{t-1} \boldsymbol{x}_0 + \bar{\beta}_{t-1} \bar{\boldsymbol{\varepsilon}}_{t-1}) + \beta_t \boldsymbol{\varepsilon}_t = \bar{\alpha}_t \boldsymbol{x}_0 + \alpha_t \bar{\beta}_{t-1} \bar{\boldsymbol{\varepsilon}}_{t-1} + \beta_t \boldsymbol{\varepsilon}_t \tag{10}
$$

得到损失函数的形式为

$$
\left\| \boldsymbol{\varepsilon}_t - \boldsymbol{\epsilon}_\theta(\bar{\alpha}_t \boldsymbol{x}_0 + \alpha_t \bar{\beta}_{t-1} \bar{\boldsymbol{\varepsilon}}_{t-1} + \beta_t \boldsymbol{\varepsilon}_t, t) \right\|^2 \tag{11}
$$

到这里我们已经基本完成了整个模型的构建，接下来就是思考一些可行性的问题，也就是我们的这个损失函数是不是那么容易训练？

答案是我们完全可以在当前的基础上进行优化，现在存在的一个问题是当前的损失函数里面需要我们自己采样的有四个变量，分别是 $\boldsymbol{x}_0, \boldsymbol{\varepsilon}_t, \bar{\boldsymbol{\varepsilon}}_{t-1}, t$，要采样的随机变量越多，就越难对损失函数做准确的估计，反过来说就是每次对损失函数进行估计的波动（方差）过大了。其中 $\bar{\boldsymbol{\varepsilon}}_{t-1}$ 是我们不希望采样的，因为它是一个中间变量，我们希望损失函数只依赖于 $\boldsymbol{x}_0, \boldsymbol{\varepsilon}_t, t$，所以我们希望把 $\bar{\boldsymbol{\varepsilon}}_{t-1}$ 消掉。

下面的化简过程是比较繁琐的，主要是利用了高斯分布的性质，为了保证过程比较连贯我们就不在这里进行详细的推导了，苏神的[推导](https://spaces.ac.cn/archives/9119)也非常清晰。最终我们可以得到一个简化的损失函数：

$$
\left\| \boldsymbol{\varepsilon} - \frac{\bar{\beta}_t}{\beta_t} \boldsymbol{\epsilon}_{\boldsymbol{\theta}}(\bar{\alpha}_t \boldsymbol{x}_0 + \bar{\beta}_t \boldsymbol{\varepsilon}, t) \right\|^2
$$

注意到这个损失函数非常的好，因为它只依赖于 $\boldsymbol{x}_0, \boldsymbol{\varepsilon}, t$，而且 $\boldsymbol{\varepsilon}$ 是我们可以直接采样的，所以我们可以直接用这个损失函数来训练我们的模型。

最后我们可以发现一个非常有意思的事实：我们最终学习预测的其实并不是单步噪声，而是多步噪声的一个线性组合，这个线性组合的系数就是 $\frac{\bar{\beta}_t}{\beta_t}$。

具体来说，我们可以在上一步对损失函数进行一个简单的换元：

$$\left\| \boldsymbol{\varepsilon} - \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t) \right\|^2$$

这里我们可以发现 $\varepsilon$ 实际上就是从 $x_0$ 到 $x_t$ 的噪声，所以这个损失函数实际上是在学习到原图的噪声，那么问题来了，我们一开始思路的起点是一步一步的去除对应加噪步的噪声从而得到原始图片分布（注意这里并不是得到原始的图片，而是得到原始图片的分布），现在经过积分技巧降低方差的化简，我们得到的损失函数却变成了学习到原图的噪声，这样真的能帮我们实现单步逆向吗？

答案是可以的，这里我们提供这样一种理解的视角：从贝叶斯定理的角度来理解

我们可以看到一开始我们想要获得的是在已知 $x_t$ 的情况下逆推出 $x_{t-1}$ 的分布，也就是 $p(x_{t-1} | x_t)$，如果我们利用贝叶斯定理就可以得到：

$$p(x_{t-1} | x_t) = \frac{p(x_t | x_{t-1}) p(x_{t-1})}{p(x_t)}$$

遗憾的是我们无法直接给出 $p(x_{t-1})$，但我们很容易得到 $p(x_{t-1} | x_0)$ 以及 $p(x_t | x_0)$，所以我们可以考虑引入一个中间变量 $x_0$，得到：

$$p(x_{t-1} | x_t, x_0) = \frac{p(x_t | x_{t-1}) p(x_{t-1} | x_0)}{p(x_t | x_0)}$$

代入并整理得到：

$$p(\boldsymbol{x}_{t-1} \mid \boldsymbol{x}_t, \boldsymbol{x}_0) = \mathcal{N}\left( \boldsymbol{x}_{t-1}; \frac{\alpha_t \bar{\beta}_{t-1}^2}{\bar{\beta}_t^2} \boldsymbol{x}_t + \frac{\bar{\alpha}_{t-1}\beta_t^2}{\bar{\beta}_t^2}\boldsymbol{x}_0, \frac{\bar{\beta}_{t-1}^2\beta_t^2}{\bar{\beta}_t^2}\boldsymbol{I} \right)$$

也就是说明了在 $p(\boldsymbol{x}_{t-1} \mid \boldsymbol{x}_t, \boldsymbol{x}_0)$ 这个后验分布下，$\boldsymbol{x}_{t-1}$ 服从一个高斯分布，而这个高斯分布的均值为：

$$
\tilde{\boldsymbol{\mu}}_t(\boldsymbol{x}_t, \boldsymbol{x}_0) = \frac{\alpha_t \bar{\beta}_{t-1}^2}{\bar{\beta}_t^2} \boldsymbol{x}_t + \frac{\bar{\alpha}_{t-1}\beta_t^2}{\bar{\beta}_t^2} \boldsymbol{x}_0
$$
在采样阶段我们虽然未知 $\boldsymbol{x}_0$，但由前向定义 $\boldsymbol{x}_t = \bar{\alpha}_t \boldsymbol{x}_0 + \bar{\beta}_t \boldsymbol{\varepsilon}$ 可知，只要网络给出了对全局累计噪声的估计 $\bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)$，我们就能立刻解出对原图的估计：
$$
\hat{\boldsymbol{x}}_0 = \frac{\boldsymbol{x}_t - \bar{\beta}_t \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)}{\bar{\alpha}_t}
$$
将此 $\hat{\boldsymbol{x}}_0$ 代入均值表达式中，利用关系式 $\bar{\alpha}_t = \bar{\alpha}_{t-1}\alpha_t$ 与 $\alpha_t^2 + \beta_t^2 = 1$ 整理化简，就可以把反向模型的均值完全改写成关于 $\boldsymbol{x}_t$ 和网络噪声预测的形式：
$$
\boldsymbol{\mu}_\theta(\boldsymbol{x}_t, t) = \frac{1}{\alpha_t} \left( \boldsymbol{x}_t - \frac{\beta_t^2}{\bar{\beta}_t} \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t) \right)
$$
这与把单步噪声的估计 $\boldsymbol{\varepsilon}_t \approx \frac{\beta_t}{\bar{\beta}_t}\bar{\boldsymbol{\epsilon}}_\theta$ 代入最初的逆变换式 $\boldsymbol{x}_{t-1} = \frac{1}{\alpha_t}(\boldsymbol{x}_t - \beta_t \boldsymbol{\varepsilon}_t)$ 得到的均值形式完全相同。这也就解释了，虽然我们最后学习的是全局累计噪声 $\bar{\boldsymbol{\epsilon}}_\theta$，但实际上在单步更新的时候，依然可以根据 $x_t$ 参数化反向高斯分布的均值；再结合预先指定的方差，就可以构造出 $p_\theta(x_{t-1}\mid x_t)$ 并进行单步采样。

最后我们总结一下 DDPM 模型的完整训练和采样的过程：

- DDPM 模型在训练的时候会先采样一个时间步 $t$ 和一个原图 $\boldsymbol{x}_0$，接着采样标准高斯噪声 $\boldsymbol{\varepsilon}$，然后根据前向定义 $\boldsymbol{x}_t = \bar{\alpha}_t \boldsymbol{x}_0 + \bar{\beta}_t \boldsymbol{\varepsilon}$ 构造出 $\boldsymbol{x}_t$，最后计算损失函数 $\left\| \boldsymbol{\varepsilon} - \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t) \right\|^2$ 并进行梯度下降更新模型参数。

- DDPM 模型在采样的时候会先采样一个随机噪声 $\boldsymbol{x}_T \sim \mathcal{N}(\boldsymbol{0}, \boldsymbol{I})$，然后从 $t = T$ 到 $t = 1$ 迭代地计算 $\boldsymbol{\mu}_\theta(\boldsymbol{x}_t, t) = \frac{1}{\alpha_t} \left( \boldsymbol{x}_t - \frac{\beta_t^2}{\bar{\beta}_t} \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t) \right)$，并采样 $\boldsymbol{x}_{t-1} \sim \mathcal{N}(\boldsymbol{\mu}_\theta(\boldsymbol{x}_t, t), \frac{\bar{\beta}_{t-1}^2\beta_t^2}{\bar{\beta}_t^2}\boldsymbol{I})$，最终得到生成的图像 $\boldsymbol{x}_0$。

到目前为止 DDPM 基本就讲完了，当然对于参数设置，代码的实现细节还有很多需要注意的地方我们这里就不多介绍了（其实我也不太会）。下面我们再来反思一下 DDPM 的一些问题和改进的方向。

DDPM 目前有一个显而易见的问题，就是在采样的时候我们必须串行地执行每一步去噪过程，这样就导致了采样的速度非常慢。每生成一张图都要串行执行数百乃至上千次网络前向，分辨率越高，单次网络前向的计算量又越大，因此总采样成本尤其高。那么有没有办法提高采样时的速度呢？并行看上去有点困难，那么我们可不可以跳过一些步骤呢，这就是 DDIM 的思路 $\rightarrow$

# DDIM 

其实 DDIM 的思路也是蛮自然的，我们可以直接看到当我们使用贝叶斯定理理解 DDPM 的时候，我们可以得到一个后验分布：

$$p(\boldsymbol{x}_{t-1} \mid \boldsymbol{x}_t, \boldsymbol{x}_0) = \mathcal{N}\left( \boldsymbol{x}_{t-1}; \frac{\alpha_t \bar{\beta}_{t-1}^2}{\bar{\beta}_t^2} \boldsymbol{x}_t + \frac{\bar{\alpha}_{t-1}\beta_t^2}{\bar{\beta}_t^2}\boldsymbol{x}_0, \frac{\bar{\beta}_{t-1}^2\beta_t^2}{\bar{\beta}_t^2}\boldsymbol{I} \right)$$

然后我们尝试求解这个均值，本质上就是使用现在的 $x_t$ 预测出一个原图的估计 $\hat{x}_0$，然后再用 $\hat{x}_0$ 和 $x_t$ 预测出 $x_{t-1}$，也就是：

$$
\hat{\boldsymbol{x}}_0 = \frac{\boldsymbol{x}_t - \bar{\beta}_t \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)}{\bar{\alpha}_t}
$$

$$
\boldsymbol{\mu}_\theta(\boldsymbol{x}_t, t) = \frac{1}{\alpha_t} \left( \boldsymbol{x}_t - \frac{\beta_t^2}{\bar{\beta}_t} \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t) \right)
$$

那么既然我们反正都要用 $x_t$ 来预测这个 $\hat{x}_0$，那么我们可不可以把步子迈得大一点，直接从这个预测出来的 $\hat{x}_0$ 开始，直接预测出 $x_{t-2}$ 呢？$x_{t-10}$ 呢？接下来让我们看 DDIM 是怎么做的：

我们先来回忆一下 DDPM 的推导过程：

$$
p(\boldsymbol{x}_t|\boldsymbol{x}_{t-1}) 
\xrightarrow{\text{推导}} 
p(\boldsymbol{x}_t|\boldsymbol{x}_0) 
\xrightarrow{\text{推导}} 
p(\boldsymbol{x}_{t-1}|\boldsymbol{x}_t, \boldsymbol{x}_0) 
\xrightarrow{\text{近似}} 
p(\boldsymbol{x}_{t-1}|\boldsymbol{x}_t)
$$

那么既然我们不想严格按步采样，那么我们能不能不依赖于 $p(\boldsymbol{x}_{t}|\boldsymbol{x}_{t-1})$，如果这样我们推导出来的结果就不依赖于 $x_{t-1}$ 了，那么我们就可以直接从 $x_t$ 预测出 $x_{t-2}$，$x_{t-10}$，甚至是 $x_0$。

这里有一个非常关键的观察：DDPM 的噪声预测损失只依赖于每个时刻的边缘分布 $q(x_t \mid x_0)$，而不直接依赖整条轨迹的联合分布 $q(x_{1:T} \mid x_0)$。所以说，只要我们构造出一个新的过程，保证每个时刻的边缘分布与 DDPM 相同，即使这个过程不再满足马尔科夫性，也依然可以复用已经训练好的噪声预测模型。

所以我们希望预测出来的 $x_{t-1}$ 依然符合原先 DDPM 的边缘分布，也就是
$$
\boldsymbol{x}_{t-1} \sim \mathcal{N}\left(\bar{\alpha}_{t-1}\boldsymbol{x}_0, \bar{\beta}_{t-1}^2 \mathbf{I}\right)
$$

那么我们再考虑 $p(x_{t-1} | x_t, x_0)$，根据之前我们的经验，我们可以把 $x_t$ 看作是 $x_0$ 的一个线性组合加上噪声 $\epsilon$，也就是：

$$
\boldsymbol{\epsilon} = \frac{\boldsymbol{x}_t - \bar{\alpha}_t\boldsymbol{x}_0}{\bar{\beta}_t}
$$

所以说我们可以对 $x_{t-1}$ 进行一个预测，我们先待定系数，并令 $\boldsymbol{\varepsilon}' \sim \mathcal{N}(\boldsymbol{0}, \boldsymbol{I})$ 与 $\boldsymbol{\epsilon}$ 相互独立：

$$x_{t-1} = c_1 x_0 + c_2 \boldsymbol{\epsilon} + \sigma_t \boldsymbol{\varepsilon}'$$

同时我们又知道 $x_{t-1}$ 要符合原先的边缘分布，所以分别对照均值和方差就得到了两个方程：

$$
\begin{cases}
c_1 = \bar{\alpha}_{t-1} \\
c_2^2 + \sigma_t^2 = \bar{\beta}_{t-1}^2 \implies c_2 = \sqrt{\bar{\beta}_{t-1}^2 - \sigma_t^2}
\end{cases}
$$

我们把解出来的参数代回原先待定系数的表达式可以得到：

$$
\boldsymbol{x}_{t-1} = \bar{\alpha}_{t-1} \boldsymbol{x}_0 + \sqrt{\bar{\beta}_{t-1}^2 - \sigma_t^2} \left( \frac{\boldsymbol{x}_t - \bar{\alpha}_t \boldsymbol{x}_0}{\bar{\beta}_t} \right) + \sigma_t \boldsymbol{\varepsilon}'
$$

现在我们再次如法炮制，用 $x_t$ 来预测出一个 $x_0$，再代入上式就得到：

$$
\bar{\boldsymbol{\mu}}(\boldsymbol{x}_t) = \frac{1}{\bar{\alpha}_t}\left(\boldsymbol{x}_t - \bar{\beta}_t \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)\right)
$$

$$
\begin{aligned}
p(\boldsymbol{x}_{t-1}|\boldsymbol{x}_t) &\approx p(\boldsymbol{x}_{t-1}|\boldsymbol{x}_t, \boldsymbol{x}_0 = \bar{\boldsymbol{\mu}}(\boldsymbol{x}_t)) \\
&= \mathcal{N}\left(\boldsymbol{x}_{t-1}; \frac{1}{\alpha_t}\left(\boldsymbol{x}_t - \left(\bar{\beta}_t - \alpha_t\sqrt{\bar{\beta}_{t-1}^2 - \sigma_t^2}\right)\bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)\right), \sigma_t^2\boldsymbol{I}\right)
\end{aligned}
$$

注意这里我们又写成了分布的形式，之前为了便于推导和理解我们直接写了等式，但实际上这两种写法都是说明我们最后是从一个分布中选取 $x_{t-1}$，写成等式当然也是可以的。我们在这里更进一步，由于之前的推导并不要求 $s=t-1$，所以实际上可以把它推广到任意满足 $0 \leq s < t \leq T$ 的 $x_s$、$x_t$：

$$
\boldsymbol{x}_s = \frac{\bar{\alpha}_s}{\bar{\alpha}_t} \boldsymbol{x}_t + \left( \sqrt{\bar{\beta}_s^2 - \sigma_{t \to s}^2} - \frac{\bar{\alpha}_s\bar{\beta}_t}{\bar{\alpha}_t} \right) \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t) + \sigma_{t \to s} \boldsymbol{\varepsilon}'

$$
实际进行加速采样的时候，我们不会再遍历全部时间步，而是选取一个递减的时间子序列 $T = \tau_S > \tau_{S-1} > \cdots > \tau_0 = 0$，然后利用上式从 $x_{\tau_i}$ 更新到 $x_{\tau_{i-1}}$。当 $S \ll T$ 时，网络前向的次数也就从 $T$ 次降低到了 $S$ 次。

写到这里我们就可以完全理解之前所说的跳步采样是如何实现的了。DDIM 的核心就是构造一族与 DDPM 具有相同边缘分布 $q(x_t \mid x_0)$、但联合分布不再满足前向马尔科夫性的过程，因此可以复用 DDPM 的训练目标。当 $\sigma_t$ 取与 DDPM 后验方差对应的特定值时，可以还原成 DDPM 的采样形式；当 $\sigma_t = 0$ 时，则会得到确定性的 DDIM 更新，具体可以参见 [几个例子](https://spaces.ac.cn/archives/9181#%E5%87%A0%E4%B8%AA%E4%BE%8B%E5%AD%90)


最后我们再提一下如何利用微分方程的数值解来加速采样的过程，当我们取 $\sigma_t = 0$ 时，代入一般式得到：

$$
\boldsymbol{x}_s = \frac{\bar{\alpha}_s}{\bar{\alpha}_t} \boldsymbol{x}_t + \left( \bar{\beta}_s - \frac{\bar{\alpha}_s\bar{\beta}_t}{\bar{\alpha}_t} \right) \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)
$$

进一步两边同时除以 $\bar{\alpha}_s$ 得到：

$$
\frac{\boldsymbol{x}_s}{\bar{\alpha}_s} - \frac{\boldsymbol{x}_t}{\bar{\alpha}_t} = \left(\frac{\bar{\beta}_s}{\bar{\alpha}_s} - \frac{\bar{\beta}_t}{\bar{\alpha}_t}\right) \bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)
$$

如果我们定义 $\boldsymbol{u}_t = \boldsymbol{x}_t / \bar{\alpha}_t$ 与 $\lambda_t = \bar{\beta}_t / \bar{\alpha}_t$，那么上式就可以写成 $\boldsymbol{u}_s - \boldsymbol{u}_t = (\lambda_s - \lambda_t)\bar{\boldsymbol{\epsilon}}_\theta(\boldsymbol{x}_t, t)$，它对应于在当前时间点固定模型输出后的一阶欧拉更新。把时间连续化之后，就可以进一步得到相应的常微分方程视角，并按照常微分方程的数值求解[方式](https://spaces.ac.cn/archives/9181#%E5%BE%AE%E5%88%86%E6%96%B9%E7%A8%8B)进行加速采样了

# 小结

本文简单梳理了 DDPM 和 DDIM 的主要思路。总的来说，DDPM 的核心是先构造一个逐步加噪的过程，然后训练模型从 $x_t$ 中预测累计噪声，并用这个预测结果一步步构造出反向生成过程（这里面还有一种[预估-修正](https://spaces.ac.cn/archives/9164#%E9%A2%84%E4%BC%B0%E4%BF%AE%E6%AD%A3)的想法,相信大家看前面的过程也能有所体会这种看长路，迈小步的感觉）；DDIM 则重新审视了 DDPM 的出发点，发现训练目标实际上只依赖于 $q(x_t \mid x_0)$，并不要求前向过程一定满足马尔科夫性，因此可以在不重新训练模型的情况下得到更一般的采样方式，其中既包括 DDPM，也包括确定性的跳步采样，甚至还可以跟常微分方程的数值求解联系起来。从这个角度来看，DDIM 并不是学了一个新的生成模型，而是换了一种使用 DDPM 的方式。







