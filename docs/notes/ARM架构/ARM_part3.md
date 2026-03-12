# ARM 汇编基础教程：ARM 指令集

这是 ARM 汇编基础教程系列的第三部分。

## ARM 与 Thumb

ARM 处理器有两种主要的工作状态（在这里我们暂不考虑 Jazelle 状态）：**ARM** 和 **Thumb**。这些状态与特权级别无关。例如，在 SVC（超级用户）模式下运行的代码既可以是 ARM 状态，也可以是 Thumb 状态。这两种状态之间的主要区别在于指令集：ARM 状态下的指令始终是 32 位的，而 Thumb 状态下的指令通常是 16 位的（但也可能是 32 位的）。了解何时以及如何使用 Thumb 对于我们编写 ARM 漏洞利用程序来说尤为重要。例如，在编写 ARM shellcode 时，我们需要消除 NULL 字节（空字节），而使用 16 位 Thumb 指令代替 32 位 ARM 指令可以极大地降低出现 NULL 字节的概率。

不同 ARM 版本的调用约定（Calling Conventions）相当令人困惑，并且并非所有 ARM 版本都支持相同的 Thumb 指令集。在某个阶段，ARM 引入了增强型 Thumb 指令集（伪名称：Thumbv2），它允许 32 位的 Thumb 指令，甚至支持条件执行（Conditional Execution），这在之前的版本中是不可能的。为了在 Thumb 状态下使用条件执行，官方引入了 `IT` 指令。然而，这条指令在后来的版本中又被移除了，并被替换成了本应使事情变得简单，却适得其反的东西。我并不了解所有不同 ARM 版本中 ARM/Thumb 指令集的所有细微变体，说实话，我也不关心。你也不应该关心。你唯一需要知道的是**目标设备的 ARM 版本**及其特定的 Thumb 支持情况，以便你可以针对性地调整代码。ARM 官方信息中心（ARM Infocenter）可以帮助你弄清楚你所使用的 ARM 版本的具体细节。

如前所述，有不同的 Thumb 版本。不同的命名只是为了将它们彼此区分开来（处理器本身将始终称之为 Thumb）。

* **Thumb-1（16 位指令）**：用于 ARMv6 及更早的架构中。
* **Thumb-2（16 位和 32 位指令）**：通过添加更多指令并允许它们为 16 位或 32 位宽，扩展了 Thumb-1（如 ARMv6T2，ARMv7）。
* **ThumbEE**：包含一些针对动态生成代码（在设备上执行前不久或执行期间即时编译的代码）的更改和新增内容。

**ARM 和 Thumb 之间的区别：**

* **条件执行（Conditional execution）**：ARM 状态下的所有指令都支持条件执行。一些 ARM 处理器版本允许通过使用 `IT` 指令在 Thumb 状态下进行条件执行。条件执行能提高代码密度，因为它减少了需要执行的指令数量，并减少了性能开销昂贵的分支跳转指令的数量。
* **32 位 ARM 和 Thumb 指令**：32 位 Thumb 指令带有 `.w` 后缀。
* **桶形移位器（Barrel Shifter）**：这是另一种独特的 ARM 模式特性。它可以用来将多条指令压缩成一条。例如，你不必使用两条独立的指令来进行乘法运算（先将寄存器乘以 2，再使用 `MOV` 将结果存储到另一个寄存器中），而是可以通过左移 1 位，将乘法操作直接合并在 `MOV` 指令中：`MOV R1, R0, LSL #1 ; R1 = R0 * 2`

要切换处理器执行的状态，必须满足以下两个条件之一：

1. 我们可以使用分支指令 `BX`（分支并交换，Branch and eXchange）或 `BLX`（分支、链接并交换，Branch, Link, and eXchange），并将目标寄存器的最低有效位（Least Significant Bit, LSB）设置为 1。这可以通过在一个内存偏移量上加 1 来实现，例如 `0x5530 + 1`。你可能会认为这会导致地址对齐问题，因为指令要么是 2 字节对齐，要么是 4 字节对齐的。但这其实不是问题，因为处理器会自动忽略这个最低有效位。在第 6 部分：条件执行和分支中会有更多细节。
2. 我们也可以通过检查当前程序状态寄存器（CPSR）中的 **T 位**。如果 T 位被置为 1，我们就知道当前正处于 Thumb 模式。

## ARM 指令简介

这部分的目的是简要介绍 ARM 的指令集及其一般用途。了解汇编语言的最小单元是如何运作的，它们如何相互连接，以及通过组合它们可以实现什么目标，对我们来说至关重要。

如前所述，汇编语言由指令组成，指令是主要的构建块。ARM 指令通常后跟一个或两个操作数（Operands），一般使用以下语法模板：

```assembly
MNEMONIC{S}{condition} {Rd}, Operand1, Operand2
```

由于 ARM 指令集的灵活性，并非所有指令都使用模板中提供的所有字段。尽管如此，模板中各个字段的用途描述如下：

* **MNEMONIC** - 指令的简短名称（助记符）。
* **{S}** - 可选后缀。如果指定了 `S`，则会根据操作的结果更新 CPSR 中的条件标志位（Condition Flags）。
* **{condition}** - 执行该指令所需满足的条件。
* **{Rd}** - 目标寄存器（Register Destination），用于存储指令计算的结果。
* **Operand1** - 第一个操作数。可以是寄存器或立即数（Immediate Value）。
* **Operand2** - 第二个（灵活的）操作数。可以是立即数（数字）或带有可选移位（Shift）操作的寄存器。

虽然 MNEMONIC、S、Rd 和 Operand1 字段非常直观，但 condition 和 Operand2 字段需要进一步说明。condition 字段与 CPSR 寄存器的值紧密相关，确切地说，是与寄存器中特定标志位的值相关。Operand2 被称为“灵活操作数（Flexible Operand）”，因为我们可以以各种形式使用它——作为立即数（具有有限的值集范围）、寄存器或带有移位操作的寄存器。例如，我们可以使用以下表达式作为 Operand2：

* `#123` - 立即数（具有受限的值域）。
* `Rx` - 寄存器 x（如 R1、R2、R3...）。
* `Rx, ASR n` - 寄存器 x 算术右移（Arithmetic Shift Right）n 位（$1 \le n \le 32$）。
* `Rx, LSL n` - 寄存器 x 逻辑左移（Logical Shift Left）n 位（$0 \le n \le 31$）。
* `Rx, LSR n` - 寄存器 x 逻辑右移（Logical Shift Right）n 位（$1 \le n \le 32$）。
* `Rx, ROR n` - 寄存器 x 循环右移（Rotate Right）n 位（$1 \le n \le 31$）。
* `Rx, RRX` - 寄存器 x 扩展循环右移一位（Rotate Right by one bit, with eXtend）。

为了快速了解不同种类指令的样貌，让我们看看下面的例子：

* `ADD R0, R1, R2` - 将 R1（Operand1）和 R2（作为寄存器形式的 Operand2）的内容相加，并将结果存储到 R0（Rd）中。
* `ADD R0, R1, #2` - 将 R1（Operand1）和值 2（作为立即数形式的 Operand2）相加，并将结果存储到 R0（Rd）中。
* `MOVLE R0, #5` - 只有在满足 `LE`（小于或等于，Less Than or Equal）条件时，才将数字 5（Operand2，编译器实际上将其视为 `MOVLE R0, R0, #5`）移动到 R0（Rd）中。
* `MOV R0, R1, LSL #1` - 将向左逻辑移位一位的 R1 的内容（作为逻辑左移的寄存器形式的 Operand2）移动到 R0（Rd）中。因此，如果 R1 的值为 2，它将向左移位一位并变为 4。然后将 4 移动到 R0 中。

作为快速总结，让我们看看在未来的示例中将使用的最常见的 ARM 指令集列表：

| 指令 (Instruction) | 描述 (Description) | 指令 (Instruction) | 描述 (Description) |
| --- | --- | --- | --- |
| **MOV** | 移动数据 (Move data) | **EOR** | 按位异或 (Bitwise XOR) |
| **MVN** | 移动并按位取反 (Move and negate) | **LDR** | 加载内存到寄存器 (Load) |
| **ADD** | 加法 (Addition) | **STR** | 将寄存器存储到内存 (Store) |
| **SUB** | 减法 (Subtraction) | **LDM** | 多重加载 (Load Multiple) |
| **MUL** | 乘法 (Multiplication) | **STM** | 多重存储 (Store Multiple) |
| **LSL** | 逻辑左移 (Logical Shift Left) | **PUSH** | 压入栈 (Push on Stack) |
| **LSR** | 逻辑右移 (Logical Shift Right) | **POP** | 弹出栈 (Pop off Stack) |
| **ASR** | 算术右移 (Arithmetic Shift Right) | **B** | 分支/跳转 (Branch) |
| **ROR** | 循环右移 (Rotate Right) | **BL** | 带链接的分支 (Branch with Link) |
| **CMP** | 比较 (Compare) | **BX** | 分支并交换状态 (Branch and eXchange) |
| **AND** | 按位与 (Bitwise AND) | **BLX** | 带链接的分支并交换 (Branch with Link and eXchange) |
| **ORR** | 按位或 (Bitwise OR) | **SWI/SVC** | 软中断/系统调用 (System Call) |

---

> **注**：原文链接来自于 Azeria Labs 博客[ARM Instruction Set (Part 3)](https://azeria-labs.com/arm-instruction-set-part-3/)，本翻译仅供学习交流使用。