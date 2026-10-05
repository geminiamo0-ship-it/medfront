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

## Correction
The frontend `MAX_CUSTOM_IDS = 50` rule and any spec wording that describes 50 as a canonical backend maximum are not backend-authoritative and must be corrected before Create Test is marked Done.

For the current frontend request shape, Custom should align with the canonical `totalQuestions` request limit of 200 unless product requirements intentionally introduce a stricter UX limit and that decision is separately approved/documented.

## Verification implication
The earlier manual test plan item `>50 Custom IDs must be blocked` is invalid and must not be used as an acceptance criterion. Replace it with verification around the canonical 200-request limit and preservation of raw Custom input on validation errors.
