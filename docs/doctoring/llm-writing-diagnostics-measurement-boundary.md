# LLM writing diagnostics: measurement and editor-boundary doctoring

**Status:** Proposed design evidence; no shipped Inkspan diagnostic feature is claimed.  
**Date:** 2026-08-12

## Decision supported by this record

Inkspan may display and safely apply host-supplied writing diagnostics, but it must not infer grammar, tone, pragmatics, or technical quality from source text. Semantic judgment belongs to a host-owned LLM review and calibration system. Inkspan owns deterministic revision, selector, validation, accessibility, and mutation integrity.

This division is not merely packaging preference. LLM evaluators are useful but behave like fallible measurement instruments. Their scores can vary with model, rubric, language, answer order, verbosity, formatting, self-provenance, and irrelevant surface artifacts. A deterministic editor cannot turn those outputs into truth; it can ensure only that a proposal is displayed and applied to the correct document state.

## Evidence synthesis

### LLMs can produce useful structured evaluations

G-Eval demonstrated that rubric-driven, form-filling LLM evaluation can align more closely with human judgments than traditional automatic NLG metrics in the studied summarization setting. MT-Bench and Chatbot Arena likewise established LLM-as-a-Judge as a scalable evaluation method while explicitly documenting position, verbosity, self-enhancement, and reasoning limitations.

**Product implication:** a host can use an LLM to generate criterion-level writing diagnostics, but the output must remain structured, versioned, and reviewable rather than becoming an opaque whole-document rewrite.

### Evaluator output is biased and context-dependent

Subsequent work has shown that LLM evaluators are not uniformly fair or stable. Reported problems include position bias, self-preference, disagreement across evaluation dimensions, sensitivity to apologetic or verbose artifacts, persuasion, auxiliary guidance, and multilingual inconsistency. Larger models do not automatically remove these problems.

**Product implication:** Inkspan must not interpret a model confidence value as editor authority. The host must own judge calibration, multi-model or independent verification when warranted, abstention, monitoring, and human review.

### Multilingual writing guidance requires language-specific evidence

Multilingual judge studies report substantial inconsistency across languages and poorer behavior in some lower-resource settings. A feature that works in English cannot claim equivalent Korean, Japanese, Chinese, Vietnamese, or code-switched reliability merely because the underlying model accepts those languages.

**Product implication:** Inkspan's selector, grapheme, accessibility, and rendering contracts must be language-neutral, while the host's semantic quality claims remain language-profile-specific and empirically validated.

### Psychometric treatment is appropriate

Recent psychometric work argues that a judge should be characterized as a measuring device rather than reported only by scalar agreement. Relevant properties include baseline response under null inputs, response to controlled quality ladders, surface cross-sensitivity, positional false preference, criterion movement, reliability, and calibration. IRT-based evaluation research likewise shows why item difficulty and discrimination matter and why fixed average scores can hide poor items or unstable rankings.

**Product implication:** the editor API carries policy and provenance versions but does not perform calibration. A host such as Naruon may use fast-mlsirm to turn criterion-level polytomous judge responses into calibrated evaluation evidence.

### Position selectors need revision state

The W3C Web Annotation Data Model defines `TextPositionSelector` with Unicode-code-point offsets, inclusive start, exclusive end, logical text order, and a recommendation not to split grapheme clusters. It also warns that position selectors are brittle when a resource changes and recommends additional state.

**Product implication:** Inkspan binds every writing diagnostic to its own strong document revision and declared projection. It does not recover a stale suggestion by keyword search, nearest-text matching, or positional guessing.

## Deterministic validation is not semantic classification

The design permits deterministic code for:

- identifier and strong-revision syntax;
- exact JSON/schema validation;
- resource bounds and duplicate rejection;
- Unicode, selector, and grapheme boundaries;
- safe-link, inline-image, clipboard, and document-schema enforcement;
- current-revision comparison and transaction mapping;
- overlap detection and ordinary undo.

The design prohibits deterministic code from asserting that prose is impolite, unclear, grammatically wrong, technically imprecise, or non-actionable based on lexical triggers. Regex validation of an identifier is materially different from a keyword-based language judgment.

## Governance implications

The host's LLM review system should record, at minimum:

- model and provider identifiers;
- prompt, rubric, and policy versions;
- orchestration mode and reasoning configuration;
- criterion definitions and ordered category anchors;
- calibration dataset and language profile;
- observed agreement, false-positive rate, calibration error, and drift;
- abstention and escalation policy;
- privacy, retention, and provider data-use controls.

Inkspan records only bounded diagnostic/action metadata by default. Source text, replacement text, prompts, raw model output, and document envelopes are not generic telemetry.

## Standards alignment

- **W3C Web Annotation Data Model:** interoperable text selector semantics and change brittleness.
- **NIST AI 600-1:** lifecycle-oriented Generative AI risk identification, evaluation, monitoring, and trustworthiness controls.
- **ISO/IEC 23894:2023:** integration of AI-specific risk management into organizational activities.
- **ISO/IEC 42001:2023:** management-system requirements for responsible AI development and use, including traceability and continual improvement.
- **AERA/APA/NCME Standards:** validity, reliability, fairness, intended-use, and consequences evidence for score-based decisions. Inkspan itself does not claim conformance to a psychological testing standard; the principles inform host judge validation.

## APA 7th references

American Educational Research Association, American Psychological Association, & National Council on Measurement in Education. (2014). *Standards for educational and psychological testing*. American Educational Research Association.

Autio, C., Schwartz, R., Dunietz, J., Jain, S., Stanley, M., Tabassi, E., Hall, P., & Roberts, K. (2024). *Artificial intelligence risk management framework: Generative artificial intelligence profile* (NIST AI 600-1). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.AI.600-1

Chen, H., & Goldfarb-Tarrant, S. (2025). Safer or luckier? LLMs as safety evaluators are not robust to artifacts. In *Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)* (pp. 19750–19766). Association for Computational Linguistics. https://doi.org/10.18653/v1/2025.acl-long.970

Fu, X., & Liu, W. (2025). How reliable is multilingual LLM-as-a-Judge? In *Findings of the Association for Computational Linguistics: EMNLP 2025*. Association for Computational Linguistics. https://aclanthology.org/2025.findings-emnlp.587/

International Organization for Standardization. (2023a). *Information technology—Artificial intelligence—Guidance on risk management* (ISO/IEC Standard No. 23894:2023). https://www.iso.org/standard/77304.html

International Organization for Standardization. (2023b). *Information technology—Artificial intelligence—Management system* (ISO/IEC Standard No. 42001:2023). https://www.iso.org/standard/42001.html

Liu, S., Xu, Z., Liu, Z., Yan, Y., Yu, M., Gu, Y., Chen, C., Xie, H., & Yu, G. (2026). Mitigating judgment preference bias in large language models through group-based polling. In *Findings of the Association for Computational Linguistics: ACL 2026* (pp. 1448–1464). Association for Computational Linguistics. https://doi.org/10.18653/v1/2026.findings-acl.71

Liu, Y., Iter, D., Xu, Y., Wang, S., Xu, R., & Zhu, C. (2023). G-Eval: NLG evaluation using GPT-4 with better human alignment. In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing* (pp. 2511–2522). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.emnlp-main.153

Shen, C., Cheng, L., Nguyen, X.-P., You, Y., & Bing, L. (2023). Large language models are not yet human-level evaluators for abstractive summarization. In *Findings of the Association for Computational Linguistics: EMNLP 2023* (pp. 4215–4233). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.findings-emnlp.278

Usami, H., Hara, K., Tsuboi, A., & Matsuda, N. (2026). *LLM judges have dark current: A psychometric datasheet for LLM-as-a-Judge evaluation* [Preprint]. arXiv. https://arxiv.org/abs/2606.15610

Wang, P., Li, L., Chen, L., Cai, Z., Zhu, D., Lin, B., Cao, Y., Kong, L., Liu, Q., Liu, T., & Sui, Z. (2024). Large language models are not fair evaluators. In *Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)* (pp. 9440–9450). Association for Computational Linguistics. https://doi.org/10.18653/v1/2024.acl-long.511

World Wide Web Consortium. (2017). *Web annotation data model*. https://www.w3.org/TR/annotation-model/

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2023). *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* [Preprint]. arXiv. https://arxiv.org/abs/2306.05685

## Claim boundary

These sources support the need for structured, calibrated, bias-aware host evaluation and revision-bound editor integrity. They do not prove that any particular model, rubric, language, or Naruon implementation is sufficiently accurate. Those claims require the implementation plan's task-specific benchmark and current-model evidence.