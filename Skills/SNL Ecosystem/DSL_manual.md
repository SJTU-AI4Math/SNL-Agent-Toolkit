# SNL DSL syntax manual (SNL DSL 语法手册)

The SNL DSL is the domain-specific language to build term macros intro macro trees. Apart from ordinary syntax tree buil

## Grammar Overview (语法概览)

  ```text
  node     := "@"? name ("@" IDENT)? ("[" IDENT "]")? ("(" args? ")")?
  args     := node ("," node)*
  name     := IDENT | "%" text "%" | "$" latex "$" | "$$" latex "$$" | "`" code (ASCII) "`"
  ```

  The parser must reach EOF after the root node.

## Macro Name (宏名)

  A macro name is the unique identifier of a term macro. After parsed, SNL tries to find the macro name in the global macro pool. If found, the macro template is applied; otherwise, the macro falls back to a temporary macro.

## Style Selection (样式选择)

  A term macro can have multiple styles. `[style]` brackets are used to select a designated style for a term macro. If no style is specified, the default style is used.

  *Example:*
  ```snl
  macro_1[non-default](a)
  macro_2[non-default](a, b, c)
  ```

## Macro Application (宏应用)

  Macro application follows the classical prefix notation of `macro(arg1, arg2, ...)`. 
  
  The application is denoted with a pair of parentheses.
  The arguments are separated by commas.

  *Example:*
  ```snl
  macro_1(a)
  macro_2(a, b, c)
  ```

## Temporary Macro (临时宏)

  A temporary macro is a term macro that has not been declared in the global macro pool, and its macro kind is either a sub-macro or a free variable. Temporary macro templates follow the same syntax as constant macro templates, where `#n` placeholders can be used to create parameters for the temporary macro, starting from `#0`. Macro modes are distinguished by the following delimiters:

1. **Text Macro (文本宏)**
  A text macro is a temporary macro that renders as text.

  *Example:*
  ```snl
  %This is a natural language syntax node implemented with a #0.%(%text-mode temporary macro%)
  ```

2. **Inline Formula Macro (行内公式宏)**
  An inline formula macro is a temporary macro that renders as an inline formula.

  If a macro name is not found in the global macro pool, it is treated as a formula-mode temporary macro by default.

  *Example:*
  ```snl
  $#0 = #1$(a, b)
  ```

3. **Display Formula Macro (行间公式宏)**
  A display formula macro is a temporary macro that renders as a display formula.

  *Example:*
  ```snl
  $$\frac{#0}{#1}$$($-b\pm\sqrt{b^2-4ac}$, $2a$)
  ```

4. **Code Macro (代码宏)**
  A code macro is a syntactic sugar for inline formula macro equipped with `texttt` font. Note that you should write `\_` instead of `_` since `_` is a special character in $\TeX$. *This design is subject to change in the future.*

  *Example:*
  ```snl
  %The code macro node #0 is exactly equivalent to writing #1%.(`code`, $\texttt{code}$)
  ```

## Binders (绑定子)
  Binders can be created by adding `@` before a leaf syntax node, whether equipped with temporary macro delimiters or not. With the binder prefix, SNL no longer tries to find the macro name in the global macro pool, and always treats it as a temporary macro.

## Semantic Binding (语义绑定)
  A syntax can be followed by :
  1. Semantic binding of sub-syntax nodes.
  2. Semantic binding of temporary macro nodes.
  3. Semantic binding of binder nodes.

## SNL Structural Index (SSI) (SNL 结构化指数)

  