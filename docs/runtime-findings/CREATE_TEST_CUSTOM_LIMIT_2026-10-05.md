# Create Test runtime/contract finding — Custom question limit

Date: 2026-10-05
Issue: #3

## Runtime observation
The user confirmed that the normal Create Test question-count field works above 50 and through 100 questions in the deployed Cloudflare frontend.

## Canonical backend re-check
`medhvgg/main` is authoritative.

- `CreateTestDto.totalQuestions` is validated with `@Min(1)` and `@Max(200)`.
- `CreateTestDto.customQuestionIds` has no `ArrayMaxSize(50)` validator.
- `TestCreationService` clamps `requestedTotalQuestions` to 200.
- The service emits an abuse-alert notification when `totalQuestions > 100`, but it does not reject the request for that reason.
- The custom-question branch resolves all unique submitted external/UWorld IDs and does not impose a 50-ID cap. The number 50 in that branch is only the maximum count shown in an error-message preview for invalid IDs.

## Resolution
The frontend `MAX_CUSTOM_IDS = 50` rule is **not** a backend limit. After the canonical backend re-check, the user explicitly chose to retain **50 as an intentional frontend product/UX limit**.

This gives the product a conservative current limit while preserving backend headroom. If the product later wants 100 or 200 Custom IDs, the intended path is to change the frontend product constant and re-run verification; no backend limit change is currently required unless the canonical backend contract changes.

The frontend/spec must therefore describe this correctly as:

- frontend Custom product limit: **50**;
- canonical backend `totalQuestions` maximum: **200**;
- backend `customQuestionIds`: no 50-item DTO cap.

## Verification implication
The correct manual acceptance case is now intentional product behavior:

- 50 valid unique Custom IDs may proceed if otherwise valid;
- 51 valid unique Custom IDs remain fully visible in the textarea and **Create Test is disabled by the frontend**;
- the UI must not silently truncate the input;
- this 50-ID block must not be described as a backend security/schema limit.
