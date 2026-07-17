# Build an SNL document

This document contains instructions on how to build an SNL document from scratch. Ask the user to check your work and for permission to proceed after you have completed each stage, unless the user instructs otherwise.

## Initialization (初始化)

1. Check whether `.SNL_Doc` folder exists in the root directory: 
   * If true, proceed to [Drafting](#drafting); 
   * if else, *SNL_Init CLI Tools not implemented(TBD), reply to the user to run `SNL_Init` with extension command instead.*

2. Initialize `.SNL_Doc/config.json` by 

## Drafting (起稿)

Drafting process includes two separate stages: **Independent Markdown Planning (独立文件计划)** and **Entrification (条目化)** 

1. During *Independent Markdown Planning*, write the document draft of the contents to be built in a Markdown file `.SNL_Doc/Plans/Draft_<Name>.md`;

2. During *Entrification*, for each entry in the draft, create an entry in `.SNL_Doc/entries.json` according to the data prepared in the markdown file during the planning stage.

You should refer to [Drafting Guide](Drafting.md) for detailed guidance. 

## Terminologization (术语化)

During *Terminologization*, extract terms from markdown natural language contents and create Term Macros in `.SNL_Doc/term_macros/*.json`. 

You should refer to [Terminologization Guide](Terminologization.md) for detailed guidance.

### The five phases

| # | Phase (EN)               | Phase (CN)   | Produces                                     |
|---|--------------------------|--------------|----------------------------------------------|
| 1 | Drafting                 | 起稿         | scratch `.md` outline + prose                |
| 2 | Terminologization        | 术语化       | `config.json#entry_kinds` + `macro_kinds`; `term_macros/*.json` |
| 3 | Entry Prefabrication     | 条目预制     | `entries.json` (ids + kinds + titles, content optional) |
| 4 | Library Construction     | 库建构       | `libraries/<slug>/{meta,graph}.json` (branch tree over entries) |
| 5 | Semantic Indexation      | 建立语义索引 | each macro's `source: { entries[], urls[] }` filled in |
