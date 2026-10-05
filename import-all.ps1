Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   MedPark - Full Question Bank Import" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$global:ErrorCount = 0
$global:SuccessCount = 0

$NodeScript = "src/scripts/import-from-sqlite.ts"

function Run-Import {
    param([string]$db, [string]$name, [string]$code, [int]$step)
    Write-Host "---------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Importing: $name" -ForegroundColor Yellow
    Write-Host "---------------------------------------------" -ForegroundColor DarkGray

    & node --require ts-node/register --require tsconfig-paths/register $NodeScript --db $db --bank-name $name --bank-code $code --step $step

    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: $name" -ForegroundColor Green
        $global:SuccessCount++
    } else {
        Write-Host "FAILED: $name (exit code: $LASTEXITCODE)" -ForegroundColor Red
        $global:ErrorCount++
    }
    Write-Host ""
}

# =====================
#        STEP 1
# =====================
Write-Host "======== STEP 1 ========" -ForegroundColor Magenta

Run-Import "all_db/step 1/my_course_bank.db"                              "UWorld"                           "UWORLD"          1
Run-Import "all_db/step 1/amboss1/my_course_bank.db"                      "Amboss"                           "AMBOSS"          1
Run-Import "all_db/step 1/mehlman/my_course_bank.db"                      "Mehlman"                          "MEHLMAN"         1

Run-Import "all_db/step 1/main nbmes/26/my_course_bank1.db"               "NBME 26"                          "NBME26"          1
Run-Import "all_db/step 1/main nbmes/27/my_course_bank.db"                "NBME 27"                          "NBME27"          1
Run-Import "all_db/step 1/main nbmes/28/my_course_bank.db"                "NBME 28"                          "NBME28"          1
Run-Import "all_db/step 1/main nbmes/29/my_course_bank.db"                "NBME 29"                          "NBME29"          1
Run-Import "all_db/step 1/main nbmes/30/my_course_bank.db"                "NBME 30"                          "NBME30"          1
Run-Import "all_db/step 1/main nbmes/31/my_course_bank.db"                "NBME 31"                          "NBME31"          1
Run-Import "all_db/step 1/main nbmes/32/my_course_bank.db"                "NBME 32"                          "NBME32"          1
Run-Import "all_db/step 1/main nbmes/33/my_course_bank.db"                "NBME 33"                          "NBME33"          1
Run-Import "all_db/step 1/main nbmes/120/my_course_bank.db"               "NBME 120"                         "NBME120"         1

Run-Import "all_db/step 1/self ass u worlsd st 1/1/my_course_bank.db"     "UWSA 1"                           "UWSA1"           1
Run-Import "all_db/step 1/self ass u worlsd st 1/2/my_course_bank.db"     "UWSA 2"                           "UWSA2"           1
Run-Import "all_db/step 1/self ass u worlsd st 1/3/my_course_bank.db"     "UWSA 3"                           "UWSA3"           1

Run-Import "all_db/step 1/pass medicin/cardio/my_course_bank.db"          "Pass Medicine Cardiology"         "PASS_CARDIO"     1
Run-Import "all_db/step 1/pass medicin/clincal medicin/my_course_bank.db" "Pass Medicine Clinical"           "PASS_CLINICAL"   1
Run-Import "all_db/step 1/pass medicin/dermatology/my_course_bank.db"     "Pass Medicine Dermatology"        "PASS_DERM"       1
Run-Import "all_db/step 1/pass medicin/endo/my_course_bank.db"            "Pass Medicine Endocrinology"      "PASS_ENDO"       1
Run-Import "all_db/step 1/pass medicin/giractic medicin/my_course_bank.db" "Pass Medicine Geriatrics"        "PASS_GERIATRICS" 1
Run-Import "all_db/step 1/pass medicin/git/my_course_bank.db"             "Pass Medicine Gastroenterology"   "PASS_GI"         1
Run-Import "all_db/step 1/pass medicin/hematology/my_course_bank.db"      "Pass Medicine Hematology"         "PASS_HEME"       1
Run-Import "all_db/step 1/pass medicin/infiction/my_course_bank.db"       "Pass Medicine Infectious Disease" "PASS_ID"         1
Run-Import "all_db/step 1/pass medicin/nephro/my_course_bank.db"          "Pass Medicine Nephrology"         "PASS_NEPHRO"     1
Run-Import "all_db/step 1/pass medicin/nero/my_course_bank.db"            "Pass Medicine Neurology"          "PASS_NEURO"      1
Run-Import "all_db/step 1/pass medicin/optho/my_course_bank.db"           "Pass Medicine Ophthalmology"      "PASS_OPTHO"      1
Run-Import "all_db/step 1/pass medicin/pharma/my_course_bank.db"          "Pass Medicine Pharmacology"       "PASS_PHARMA"     1
Run-Import "all_db/step 1/pass medicin/pilative/my_course_bank.db"        "Pass Medicine Palliative"         "PASS_PALLIATIVE" 1
Run-Import "all_db/step 1/pass medicin/psychatry/my_course_bank.db"       "Pass Medicine Psychiatry"         "PASS_PSYCH"      1
Run-Import "all_db/step 1/pass medicin/resp/my_course_bank.db"            "Pass Medicine Respiratory"        "PASS_RESP"       1
Run-Import "all_db/step 1/pass medicin/rhumatolgy/my_course_bank.db"      "Pass Medicine Rheumatology"       "PASS_RHEUM"      1

# =====================
#        STEP 2
# =====================
Write-Host "======== STEP 2 ========" -ForegroundColor Magenta

# UWorld S2 is at root of all_db
Run-Import "all_db/my_course_bank.db"                                     "UWorld S2"                        "UWORLD_S2"       2
Run-Import "all_db/step 2/amboss2/my_course_bank.db"                      "Amboss S2"                        "AMBOSS_S2"       2
Run-Import "all_db/step 2/cms/my_course_bank.db"                          "CMS S2"                           "CMS_S2"          2
Run-Import "all_db/step 2/mehlman2/my_course_bank.db"                     "Mehlman S2"                       "MEHLMAN_S2"      2

Run-Import "all_db/step 2/nbmes/9/my_course_bank.db"                      "NBME 9 S2"                        "NBME9_S2"        2
Run-Import "all_db/step 2/nbmes/10/my_course_bank.db"                     "NBME 10 S2"                       "NBME10_S2"       2
Run-Import "all_db/step 2/nbmes/11/my_course_bank.db"                     "NBME 11 S2"                       "NBME11_S2"       2
Run-Import "all_db/step 2/nbmes/12/my_course_bank.db"                     "NBME 12 S2"                       "NBME12_S2"       2
Run-Import "all_db/step 2/nbmes/13/my_course_bank.db"                     "NBME 13 S2"                       "NBME13_S2"       2
Run-Import "all_db/step 2/nbmes/14/my_course_bank.db"                     "NBME 14 S2"                       "NBME14_S2"       2
Run-Import "all_db/step 2/nbmes/15/my_course_bank.db"                     "NBME 15 S2"                       "NBME15_S2"       2
Run-Import "all_db/step 2/nbmes/16/my_course_bank.db"                     "NBME 16 S2"                       "NBME16_S2"       2
Run-Import "all_db/step 2/nbmes/120 23023 s2/my_course_bank.db"           "NBME 120 S2"                      "NBME120_S2"      2

Run-Import "all_db/step 2/uwsa s2/1/my_course_bank.db"                    "UWSA 1 S2"                        "UWSA1_S2"        2
Run-Import "all_db/step 2/uwsa s2/2/my_course_bank.db"                    "UWSA 2 S2"                        "UWSA2_S2"        2
Run-Import "all_db/step 2/uwsa s2/3/my_course_bank.db"                    "UWSA 3 S2"                        "UWSA3_S2"        2

# =====================
#        STEP 3
# =====================
Write-Host "======== STEP 3 ========" -ForegroundColor Magenta

Run-Import "all_db/step 3/u world/my_course_bank.db"                      "UWorld S3"                        "UWORLD_S3"       3
Run-Import "all_db/step 3/amboss3/my_course_bank.db"                      "Amboss S3"                        "AMBOSS_S3"       3
Run-Import "all_db/step 3/mehlman s3/my_course_bank.db"                   "Mehlman S3"                       "MEHLMAN_S3"      3

Run-Import "all_db/step 3/nbmes/1/my_course_bank.db"                      "NBME 1 S3"                        "NBME1_S3"        3
Run-Import "all_db/step 3/nbmes/2/my_course_bank.db"                      "NBME 2 S3"                        "NBME2_S3"        3

Run-Import "all_db/step 3/self ass s3/1/my_course_bank.db"                "UWSA 1 S3"                        "UWSA1_S3"        3
Run-Import "all_db/step 3/self ass s3/2/my_course_bank.db"                "UWSA 2 S3"                        "UWSA2_S3"        3

# =====================
#      FINAL SUMMARY
# =====================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "           IMPORT COMPLETE!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Successful: $global:SuccessCount" -ForegroundColor Green
Write-Host "Failed:     $global:ErrorCount" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Cyan
