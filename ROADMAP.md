# Roadmap

What WestGuardQC does not do yet, roughly in the order the gaps matter. Nothing here is committed to a schedule.

## Corrective action and review

The largest gap between this and something a lab could actually run on.

A QC record that logs a rejection but not the response to it does not satisfy CLIA or CAP. When a run goes out of control, the lab documents what it did: repeated the control, opened a new reagent vial, recalibrated, called service. Right now a rejection is a dead end on the chart.

Related, and smaller:

- Periodic review with supervisor sign-off, which inspectors ask to see.
- An audit trail on target revisions. Voiding records who and why; revising `target_mean` or `target_sd` does not, even though it silently rescores the lot's entire history. That is the more consequential operation and the one with no paper trail.

## Instruments

The data model has no concept of an analyzer. A lab runs the same analyte on several instruments and tracks QC per instrument, because the point of the exercise is qualifying a machine. Two analyzers running the same control lot currently collapse into one chart.

This is the change that would most improve how closely the model matches a real lab, and also the most invasive. It touches the schema, every query, and the dashboard grouping.

## Statistics

- Periodic summary per lot and analyte: N, mean, SD, CV, rejection count for a reporting month. The standard monthly QC report.
- Cumulative, lot-to-date, and current-period figures side by side. Labs track all three and they diverge.
- Establishing targets from observed data. The README describes labs refining manufacturer targets against their own accumulated results, and the app cannot do it. Computing new targets from the first 20 or so runs and applying them would close that loop, and the rescore machinery already exists.

## Configurable rules

Not every lab runs all six rules on every test. High-volume chemistry often runs a reduced set, and plenty of labs drop 10x or use 8x instead. Rule selection per analyte or per lot is normal in commercial QC software. The engine already evaluates rules independently and returns every violation, so this is mostly a configuration surface and a way to persist it.

## Reagent and calibration events

Marking on the chart when the reagent lot changed or the instrument was calibrated, drawn as a vertical line. A shift usually has one of those two explanations, and being able to see it against the trend is worth more than the implementation costs.

## Authentication and roles

There is no auth at all today. The natural split follows what is already treated as dangerous enough to keep out of the UI:

- **Bench tech**: record results, view charts, void with a reason.
- **Supervisor**: revise targets, retire and reactivate lots, create lots and analytes, sign off periodic review.
- **Read-only**: see everything, change nothing. Useful for inspectors.

Target revision is the operation that most wants a role behind it, since it rewrites stored verdicts across a whole lot.

## Smaller things

- Export to CSV or PDF, since inspectors ask for records on paper.
- A rejection queue, rather than relying on someone noticing a red card.
- Pagination on the results table, currently capped at 50 per request.
- Code-split Recharts. The bundle is 614 KB and trips Vite's default 500 KB warning.

## Deliberately not planned

Peer group comparison, where a lab's mean and SD are compared against other labs running the same instrument and control lot. It is real and standard in commercial QC programs, but it needs an external data source and demonstrates nothing the rest of the roadmap does not.
