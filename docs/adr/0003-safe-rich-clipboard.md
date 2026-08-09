# ADR 0003: Safe rich clipboard boundary

Status: Proposed

## Context

Rich clipboard HTML is attacker-controlled browser input. A sanitizer that is correct only as a pure helper but is not installed in the real TipTap/ProseMirror paste pipeline does not protect the product. Browser fragment parsing can also differ across Chromium, Firefox, and WebKit.

## Decision

Sanitize untrusted rich HTML through a bounded, fail-closed semantic allowlist installed in the actual TipTap/ProseMirror paste pipeline. The sanitizer performs no external fetch or active execution, rejects unsupported active/resource-bearing structures, applies resource ceilings, and keeps its pure API behavior aligned with editor integration. Browser-engine differential evidence is required before the rich-clipboard release line is published.

## Consequences

Supported semantic formatting can survive paste while active or hidden content is removed or rejected. A downstream host still owns CSP, network egress, rendering policy, tenant authorization, and any later transforms. Cross-engine tests increase release cost but reduce parser-specific acquisition risk.

## Failure and recovery

Malformed input, hostile DOM capabilities, reflection failures, over-limit input, or unsafe structures fail closed with bounded diagnostics. If a security-relevant engine difference is found, add it to the differential corpus and repair the sanitizer or explicitly document a standards-grounded safe difference. Do not broaden the allowlist merely to recover parity.

## Verification

Use sanitizer unit tests, actual editor paste-pipeline integration tests, hostile DOM/reflection cases, package consumers, security scans, and the dependency-locked Chromium/Firefox/WebKit differential release gate tracked by the rich-clipboard assurance issue.

## Rollback or supersession

Rollback disables the rich transform or reverts to a narrower safe input path without granting arbitrary HTML authority. Supersession requires an equivalent or stronger fail-closed browser-integrated boundary, threat analysis, and fresh cross-engine evidence.
