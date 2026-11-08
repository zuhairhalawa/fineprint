# Law notes: the rules Fineprint checks

Checked on 2026-11-09 against MOHRE's consolidated English text: "Federal Decree-Law No. (33) of 2021 Regarding the Regulation of Employment Relationships and its amendments". That text includes Cabinet Resolution No. 1 of 2022, the executive regulations, here "CR".
- MOHRE PDF: https://www.mohre.gov.ae/assets/download/3bde4984/Federal%20Decree-Law%20No.%2033%20of%202021%20Regarding%20the%20Regulation%20of%20Employment%20Relationship%20and%20its%20amendments_638990571068264034.pdf.aspx
- u.ae mirror: https://u.ae/-/media/Mohre-2024/Federal-DecreeLaw-No-33-of-2021-Regarding-the-Regulation-of-Employment-Relationship-and-its-amendmen.pdf

The Arabic text prevails (Art. 66). The amendments that matter here: Art. 8(3) was changed by Federal Decree-Law 14/2022, which removed the 3-year cap. Federal Decree-Law 9/2024 changed only the dispute and penalty articles.

Scope: private-sector jobs on the UAE mainland. Free zones with their own employment law (DIFC, ADGM), government jobs and domestic workers follow other rules.

| Rule in Fineprint | What the law says | Article | Level when it fails |
|---|---|---|---|
| `probation-length` | At most 6 months, once per employer, and it counts as service | Art. 9(1)-(2) | red |
| `probation-paid` | An employment contract is work "in consideration of a wage". No article says "probation is paid" in so many words | Art. 1 (definition), Art. 9 | red |
| `probation-notice` | An employer ending probation gives at least 14 days' written notice. An employee moving to another UAE employer gives at least 1 month, and the new employer pays the recruitment costs. An employee leaving the UAE gives at least 14 days | Art. 9(1), 9(3), 9(4) | red if under 14 days |
| `notice-period` | 30 to 90 days after probation, the same for both sides | Art. 43(1) | red |
| `non-compete` | Only where the worker learns clients or trade secrets. It must be limited in time, place and type of work, and last at most 2 years after the contract ends. Exemptions: the contract ends in probation, or the worker pays up to 3 months' wage with the old employer's written consent | Art. 10(1); CR Art. 12 | red if over 2 years or unlimited in place or work; otherwise amber |
| `working-hours` | 8 hours a day, 48 a week. Overtime is paid at basic wage plus at least 25% | Art. 17(1), Art. 19 | red |
| `annual-leave` | At least 30 days a year, or 2 days a month between 6 and 12 months of service. "30 days" is read as calendar days, so 22 working days on a 5-day week is about the same | Art. 29(1) | red if clearly under; amber if the day type is unclear |
| `basic-share` | Gratuity is 21 days of basic wage per year for years 1-5, then 30 days. Basic wage excludes allowances. Overtime is also calculated on basic | Art. 51; Art. 1 (definitions); Art. 19 | amber when basic is under 50% of total |
| `passport` | The employer must not withhold the worker's official documents | Art. 13(2) | red |
| `recruitment-costs` | The employer must not charge the worker recruitment or employment fees and costs, directly or indirectly. Visa and permit fees are commonly read as included, but the text doesn't name them | Art. 6(4) | red for recruitment or agency fees; amber for other named costs |
| `deductions` | Only 8 listed kinds of deduction, capped at 50% of the wage in total | Art. 25 | amber |
| `training-payback` | The law says nothing about repaying training costs. Terms that conflict with the law are void unless they favour the worker | Art. 65(3) | amber (ask) |
| `contract-type` | Every contract is written, fixed-term and renewable, on MOHRE forms, in Arabic plus a language the worker understands | Art. 8(1), 8(3), 8(6); Art. 66(2) | amber if missing, unclear or "unlimited" |

## Money

- **Gratuity:** basic monthly wage ÷ 30 × 21 for each of the first 5 years. This matches MOHRE's daily-wage convention; the law says "21 days' basic wage".
- **The gap Fineprint shows:** gratuity worked out on basic pay, compared with the figure on total pay. A reader who sees "AED 10,000 a month" might assume the second. The law's 2-year-wage cap never applies within 5 years.

## Not claimed (unconfirmed)

- **Unpaid internships:** no official text explicitly allows or bans unpaid student training.
- **Training bonds:** whether repayment clauses are enforceable is unclear, so Fineprint asks rather than judges.
- **Worldwide non-competes:** how a court would treat one (strike it out or narrow it) is unclear. Fineprint says it fails the limits in Art. 10, nothing more.
