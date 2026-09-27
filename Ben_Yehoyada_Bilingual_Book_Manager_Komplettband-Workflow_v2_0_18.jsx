#target "InDesign"
#targetengine "BenYehoyadaBilingualBookManager_v218"

/*
    Ben Yehoyada Bilingual Book Manager v2.0.18
    Target: Adobe InDesign 18.1 / ExtendScript (ES3)

    Abgeleitet vom Ben Ish Chai Bilingual Book Manager v1.0.17.
    Die gesamte Verkettungs-, Batch- und Balancing-Mechanik ist unverändert
    übernommen; geändert sind Seitenformat, Stile, Datenformat und Apparat.

    Purpose
    -------
    Hebrew/English workflow for the Ben Yehoyada edition (Talmud aggada
    commentary), one volume set per tractate.

    Was gegenüber v1.0.17 neu ist
    -----------------------------
      1. Seitenformat 7 × 10 Zoll (177,8 × 254 mm) statt A5, mit
         asymmetrischen Stegen: innen 19,1 mm (KDP-Pflicht für 501–700
         Seiten), außen 14, oben 16, unten 20 mm.
      2. Talmud-Kopfband. Jedes Segment beginnt mit der aramäischen
         Grundstelle (<band_he>) bzw. ihrer englischen Übersetzung
         (<band_en>). Beide liegen INNERHALB der bestehenden Textflüsse als
         eigener Absatzstil, nicht als zusätzliche Rahmen. Deshalb bleibt die
         Divider-Optimierung unverändert zweizonig und muss nichts über den
         Apparat wissen.
      3. Fußnotenapparat. <fn>…</fn>-Marken im Text werden beim Formatieren
         in echte InDesign-Fußnoten umgewandelt. InDesign platziert sie
         selbst am Fuß des jeweiligen Rahmens: hebräische Noten unter dem
         hebräischen, englische unter dem englischen.
      4. <lemma>…</lemma> zeichnet das zitierte Talmudstichwort aus.
      5. Gleichmäßige Bandaufteilung (BALANCE_VOLUMES).
      6. v2.0.1: <band_en> ist ein Übersetzungsziel. Bleibt das englische
         Kopfband beim Export leer, füllt es die Übersetzerin im Batch; der
         Merge schreibt es zurück und überschreibt dabei nie eine bereits
         vorhandene Fassung. Damit lässt sich die Ausgabe ohne fremde
         Lizenz für die englische Talmudstelle herstellen.
      7. v2.0.2: Hebräischer Produktionsfont auf "Frank Ruhl Hofshi" umgestellt.
         Der Font-Fallback verwendet nie mehr stillschweigend eine fremde Familie.
         Satzrahmen auf beiden Seiten spiegelgleich 5 mm innerhalb der
         InDesign-Randhilfslinien; Linie und Seitenzahl folgen derselben Geometrie.
      8. v2.0.3: Seitenzahl aus dem Kopfbereich in den Fußsteg verlegt.
         Sie sitzt jetzt unterhalb des unteren Textrahmens auf 237–245 mm,
         also innerhalb des unteren Stegs und weiterhin an der Außenkante.
         HE-/EN-Textrahmen und deren Balancing-Geometrie bleiben unverändert.

    Produktionsvorgaben
      - Seitenformat 177,8 × 254 mm, Doppelseiten
      - oben hebräischer Rahmen, unten englischer Rahmen
      - Frank Ruhl Hofshi 11/16 pt (Hebräisch)
      - Minion Pro 9,5/12,8 pt (Englisch)
      - hard maximum: 600 physical pages per volume
      - planning target: 540 pages, including 12 reserved pages
      - Kapazitäten: 1280 hebräische, 2420 englische Zeichen je Seite,
        Expansionsfaktor 1.95 (am Ben Ish Chai gemessen)

    Project workflow
    ----------------
      1. Select the complete Hebrew TXT once.
      2. Create volume files. The script assigns stable segment IDs and
         generates Band_XX_BILINGUAL.txt files containing <he> and <en>.
      3. Export translation batches from a volume file.
      4. Fill the empty <en_title>, <en> and <band_en> fields (outside this script).
      5. Merge translated batches back by stable segment ID.
      6. Build or update the InDesign volume document.

    The script never splits a segment. It prefers section/Parashah boundaries.
    If a single section is too large, it may split only between segments.

    v1.0.6:
      - repairs broken HE/EN text-frame chains before adding pages
      - automatically appends fully formatted bilingual pages while overset exists
      - adds manual page controls for active InDesign volumes
      - validation now reports broken links between specific pages

    v1.0.7:
      - never substitutes a Hebrew section title in the English text flow
      - rejects batches containing an empty English section title
      - rejects English section titles containing Hebrew characters
      - exports the binding translation instruction as version 1.2

    v1.0.8:
      - updates the complete Hebrew story in an existing InDesign volume
        without recreating pages or changing existing frame geometry
      - creates an automatic INDD backup before replacing the Hebrew story
      - accepts and normalizes accidental CDATA wrappers in section titles

    v1.0.9:
      - adds controlled per-batch HE/EN frame balancing based on stable BIH IDs
      - analyses the page lag of matching Hebrew and English segments
      - changes only the affected batch pages and honours manually protected pages
      - keeps changes only when the ID alignment is not worse
      - creates an INDD backup plus a geometry snapshot before every layout run
      - can restore the last batch layout exactly from its snapshot

    v1.0.10:
      - fixes the v1.0.9 plateau problem where a 3 mm trial was rejected before
        a paragraph could cross a page boundary
      - adds a continuous within-page alignment metric based on actual first/last
        text-line baselines of every matched BIH segment
      - accepts a safe divider move when coarse page alignment is unchanged but
        fine HE/EN alignment improves
      - continues up to ten controlled passes, still bounded by minimum frame heights
      - reports both coarse page deviation and fine positional deviation

    v1.0.11:
      - replaces the unsuccessful global/greedy fine-metric optimizer with a
        deterministic forward page-by-page anchor search
      - uses the stable BIH segment order plus the visible end position inside
        the current segment as the synchronization anchor for each page
      - searches past temporary plateaus instead of rejecting the first 3 mm move
      - optimizes every affected page independently and preserves earlier pages
        while moving forward through the batch
      - can append exact bilingual tail pages if the new split creates overset
      - snapshot v2 stores the original page count so rollback can also remove
        pages that were added by the layout run
      - reports every changed page with old/new divider and anchor error

    v1.0.12:
      - recomposes the document before analysis so before/after values are not stale
      - compares normalized rendered-line progress instead of raw character fractions
      - treats the stable BIH segment identity as the primary page-boundary target
      - solves each divider by monotonic binary search plus 0.5 mm local refinement
      - prefers the production split 103.24 / 106.24 mm when synchronization is equal
      - writes divider coordinates with explicit mm strings, independent of ruler units
      - adds a controlled standard-reset command for pages distorted by older test runs

    v1.0.13:
      - keeps the proven v1.0.12 BYH-boundary logic but adds a default Fast Mode
      - recomposes only the two affected HE/EN stories during divider probes instead
        of recomposing the complete 400+ page document for every candidate
      - skips already aligned pages before any search is started
      - caches divider probes so the same split is never recomposed twice
      - uses a directed binary search toward the required side and only two local
        refinement probes instead of the former broad +/-2 mm sweep
      - reuses the already calculated preview analysis when Apply is confirmed
      - disables document redraw only during the intensive Fast-Mode search
      - keeps the v1.0.12 precision solver available as a switchable fallback
      - reports elapsed time and number of divider probes for performance control

    v1.0.14:
      - adds true bulk translation-batch export with an in-memory cursor
      - creates N separate Translation_Batch TXT files in one master parse
      - persists exported ID ranges in a per-volume BatchQueue TSV
      - skips still-exported queue ranges so a later export cannot duplicate work
      - creates a Bulk_Set manifest for every bulk export with order, IDs and files
      - adds atomic multi-file Bulk Merge for several _EN_FERTIG TXT files
      - preflights every selected batch completely before any master file is changed
      - rejects duplicate/overlapping BIH IDs, changed Hebrew, wrong n values,
        missing English, conflicting section titles and conflicting existing English
      - creates exactly one master backup after successful preflight
      - applies all validated translations in memory and writes the master only once
      - updates all matching queue entries to MERGED in one queue write
      - adds a Queue-Status view without changing the existing single-batch workflow
      - adds a Bulk-Layout runner in the InDesign tab based on a Bulk_Set manifest
      - resolves the merged _EN_FERTIG files through the persistent BatchQueue
      - updates the English InDesign story exactly once for the complete bulk group
      - then re-locates, analyses and balances every batch in ascending BYH-ID order
      - shows live bulk progress, aborts immediately if HE/EN overset appears during layout
      - uses one shared INDD safety backup for the complete bulk run while retaining
        per-batch geometry snapshots and writes a final persistent Bulk-Layout protocol

    v1.0.15:
      - reorganizes the UI visually around four persistent workflow colours
      - BLUE identifies project / volume / InDesign base operations
      - GREEN identifies the complete single-batch workflow across tabs
      - MAGENTA identifies the complete bulk workflow across tabs
      - ORANGE identifies safety, rollback and repair operations
      - colours all buttons belonging to the same workflow consistently
      - adds visible workflow tags and colour legends to the relevant tabs
      - adds detailed hover help (ScriptUI helpTip) to workflow buttons and key fields
      - leaves all v1.0.14 export, merge, queue and layout algorithms unchanged

    v1.0.16:
      - changes Bulk Layout overset handling from immediate abort to controlled auto-expansion
      - after each balanced batch, HE/EN overset is first repaired by appending complete bilingual pages
      - every appended page contains both threaded HE and EN frames and obeys the existing 600-page hard limit
      - the next batch is re-localized only after overset has been resolved and text has recomposed
      - aborts on overset only when automatic expansion cannot resolve it or the 600-page limit is reached
      - records pages added by the one-time EN update and by per-batch layout repair in the Bulk run protocol
      - preserves the shared INDD backup, per-batch snapshots, rollback and all v1.0.15 colour/help UI conventions

    v1.0.17:
      - replaces the former VIOLET/PURPLE bulk workflow colour with high-contrast MAGENTA
        so Bulk controls are clearly distinguishable from BLUE Band/Textflow controls
      - keeps the textual BULK tags and hover help as redundant workflow indicators
      - Bulk Layout success reports now include the actual physical page span touched
        by the bulk batches and, separately, the newly appended page span when present
      - writes the same page-span summary into the persistent Bulk Layout run protocol

    v2.0.5:
      - adds a dedicated colour-coded running-header workflow as tab 4
      - BLUE: analyse, test, create/update and validate running headers
      - ORANGE: remove running headers without touching body frames or folios
      - running headers are generated from the FINAL Hebrew story/page flow after translation/layout
      - left pages use English, right pages use Hebrew by default
      - Daf is resolved per physical page from the stable BYH segment mapping
      - English/Hebrew templates and work/tractate names remain editable in the UI
      - tractate can be inferred from the BILINGUAL filename; Hebrew names are mapped for Bavli tractates
      - productive use is intentionally separate from build/merge/layout and should be run after final HE/EN balancing

    v2.0.6:
      - repairs the atomic Bulk Merge so <band_en> is validated and merged together with <en>
      - rejects altered <band_he>, daf/ref attributes, missing or conflicting <band_en>,
        Hebrew characters in <band_en>, lost edge ellipses and lemma/band mismatches
      - reports new and already-identical English Talmud bands in preflight and result summaries
      - verifies the fully serialized in-memory merge before the single master write
      - updates newly exported Translation_Batch headers to both binding instruction files, version 1.2

    v2.0.7:
      - fixes the first productive Bulk-Layout review findings from pages 1, 56–57, 64–65,
        80–81 and 160–161
      - makes Hebrew Talmud-band text readable (72 % black instead of the accidental 8 %)
      - keeps every Talmud band together and keeps Daf headings together with the following band
      - adds a dedicated HE/EN Daf-heading synchronizer so a new Daf title cannot remain one
        physical page ahead of its counterpart after batch/bulk balancing
      - includes Daf-heading mismatch in analysis, batch result, bulk final validation and active-band validation
      - suppresses only redundant pure-source English footnotes when the identical citation is
        already present in the same paragraph; explanatory footnotes remain untouched
      - repairs the obvious sentence-boundary duplicate-word capitalization in displayed <band_en>
        (for example "one. one" -> "one. One") without rewriting the BILINGUAL master

    v2.0.8:
      - repairs Daf-heading detection after the first productive v2.0.7 run: typographic Hebrew
        quotation marks / Gershayim and harmless local paragraph-style deviations no longer make
        an existing Daf title appear "missing"
      - matches Daf headings by a punctuation-insensitive canonical title key while keeping the
        expected section order as a safety guard
      - adds a dedicated BULK-FORTSETZEN mode for documents whose English story was already
        inserted by a previous Bulk run; the existing EN story is validated against the current
        BILINGUAL master and then only the 10 batch layouts are processed
      - keeps the original full Bulk button unchanged for fresh runs (EN update exactly once)
      - makes Bulk abort reporting generic so a Daf/layout safety stop is not mislabeled as an
        overset-only failure

    v2.0.9:
      - introduces a hard production divider envelope of ±15.00 mm around the nominal
        HE/EN split 126.00/129.00 mm; legal HE bottoms are 111.00–141.00 mm and EN tops
        114.00–144.00 mm while the 3.00 mm gap remains fixed
      - normalizes legacy outlier pages into that envelope before evaluating segment anchors
      - keeps Daf synchronization as a hard final requirement; if HE/EN Daf equality cannot be
        achieved inside the ±15 mm envelope, the whole current batch is rolled back
      - allows ordinary BYH segment alignment to remain imperfect rather than leaving the
        production envelope
      - reports out-of-envelope pages in Batch Analyse and in the final layout result

    v2.0.10:
      - fixes a priority conflict in v2.0.9: the legacy "sum of page anchors must not worsen"
        rollback is now a SOFT rule whenever a HARD repair was required
      - HARD priorities are now explicit and ordered: (1) no unresolved overflow,
        (2) divider inside ±15 mm, (3) HE/EN Daf titles on the same physical page
      - BYH page-anchor score and differing boundary IDs remain optimization goals, but they may
        worsen temporarily when necessary to repair an out-of-envelope divider or a Daf mismatch
      - if no HARD repair was required before the batch, the old anchor non-regression guard
        remains active and still rolls back an objectively worse ordinary alignment
      - accepted anchor regressions caused by HARD repairs are written to the batch result/audit
      - targetengine, palette global and visible version header are synchronized to v2.0.10

    v2.0.11:
      - typographic micro-adjustment only; no changes to merge, bulk, divider or Daf logic
      - Talmud headband paragraph styles in HE and EN now use:
        ruleAboveOffset 3.5 mm, ruleBelowOffset 2.0 mm,
        spaceBefore 7 pt and spaceAfter 4 pt
      - line weights remain unchanged at 0.8 pt above and 0.4 pt below

    v2.0.12:
      - adds a full-volume layout button for a newly built document whose English
        text is already present in its merged BILINGUAL master
      - validates the existing EN story, divides the master into temporary
        twelve-segment layout ranges, then reuses the protected Bulk balancer
        without a Bulk_Set manifest or MERGED queue entries
      - retains the v2.0.11 divider and Daf hard limits, INDD backup, snapshots,
        protocol, and controlled overset repair; English is not reinserted

    v2.0.13:
      - fixes false Bulk-Merge lemma errors when the lemma and <band_en> have
        identical words but different boundary punctuation (for example a
        lemma-final period versus a continuing comma in the Talmud headband)
      - compares a punctuation- and case-normalized word sequence with
        explicit word boundaries; semantic omissions or changed words still fail
      - leaves all merge atomicity, Hebrew-source, ID, attribute, ellipsis,
        existing-English and layout safeguards unchanged

    v2.0.14:
      - fixes a trailing-whitespace defect in the v2.0.13 lemma normalizer:
        punctuation at the end of a lemma no longer leaves an artificial space
        that can make an otherwise identical word sequence fail comparison
      - validates the final normalized lemma and headband values only after
        punctuation replacement, whitespace collapse and final edge trimming
      - keeps the complete v2.0.13 word-sequence and all merge safeguards intact

    v2.0.15:
      - fixes the remaining v2.0.9/v2.0.10 priority conflict inside the dedicated
        Daf-heading synchronizer: a legal same-page Daf solution is no longer
        rejected merely because the local BYH page anchor becomes temporarily worse
      - keeps Daf equality and the ±15 mm divider envelope as HARD conditions;
        BYH page-anchor quality remains a logged SOFT optimization goal
      - if changing the page on which the earlier Daf heading currently appears
        only makes the two language headings cross, searches up to three preceding
        unlocked batch pages in the same directed 0.5 mm steps
      - every fallback page must belong to the captured batch snapshot, so rollback
        still restores the exact original geometry

    v2.0.16:
      - fixes the remaining Daf-boundary deadlock seen at Daf 59b: the legal
        correction capacity of the title page and preceding captured batch pages
        is now accumulated instead of testing and resetting each page in isolation
      - stops each page immediately before a discrete HE/EN crossing and continues
        on the preceding page, allowing a same-page solution without overshooting
      - records every page participating in a cumulative Daf repair; if no legal
        solution exists, all provisional changes are restored before the HARD abort
      - retains the ±15 mm divider envelope, page locks, snapshot scope, exact
        rollback, overflow checks and mandatory final HE/EN Daf equality

    v2.0.17:
      - extends the dedicated Daf-repair snapshot to twelve preceding physical
        pages, because a Daf at the first segment of a batch may require more
        correction capacity than the former one-page batch padding provides
      - keeps those additional pages out of the ordinary BYH-anchor optimizer;
        they are available only to the directed cumulative Daf synchronizer
      - captures every additional context page in the rollback snapshot before
        it can be touched and reports the complete physical span in the Bulk log
      - retains the per-page ±15 mm HARD LIMIT, page locks, exact rollback,
        overflow checks and mandatory final HE/EN Daf equality

    v2.0.18 · KOMPLETTBAND statt Batches:
      - neuer PETROL-Workflow für eine vollständig übersetzte Banddatei
        (z. B. Ben_Yehoyada_Shabbat_Band_01_BILINGUAL_EN_FERTIG.txt); Export,
        Einzel-/Bulk-Merge, Queue und Batch-/Bulk-Layout bleiben unverändert erhalten
      - "Komplettband prüfen": vollständige Vorprüfung ohne Schreibzugriff
        (alle <en>, <en_title>, <band_en>, Lemma, Ellipsen, Tag-Balance,
        Segmentzahl, ID-Reihenfolge, Daf-Titel, geschätzte Seitenzahl); es werden
        ALLE Fehler gesammelt aufgelistet statt beim ersten Fehler abzubrechen
      - optionaler Abgleich gegen einen vorhandenen Band-Master: identische IDs,
        Reihenfolge, n/daf/ref, <he_title>, <he> und <band_he>
      - "In Band-Master übernehmen": atomarer Komplett-Merge mit genau einer
        Master-Sicherung und genau einem Schreibvorgang; vorhandene abweichende
        Übersetzungen werden nur nach ausdrücklicher Freigabe ersetzt; offene
        Queue-Einträge werden auf MERGED gesetzt
      - "Als InDesign-Quelle verwenden": die fertige Banddatei direkt als Quelle
        für Reiter 3 und 4 übernehmen, ohne Master-Schreibvorgang
      - Reiter 3: "Komplettband: neuen Band erstellen + ganzen Band angleichen"
        in einem Lauf (Vorprüfung → Aufbau → Speichern → Gesamtband-Abgleich)
      - Gesamtband-Abgleich: Gruppengröße einstellbar und Fortsetzen ab Gruppe N;
        nach einem Sicherheitsabbruch wird die Startgruppe automatisch vorgeschlagen
      - das tractate-Attribut des <book>-Elements bleibt beim Zurückschreiben
        erhalten und dient der Traktaterkennung für Kopfzeilen und Dateinamen
*/

(function () {
    var APP_NAME = "Ben Jehojada · Zweisprachiger Buchmanager";
    var VERSION = "2.0.18";

    // ---------------- UI workflow colours (v1.0.17) ----------------
    // Colour is never the only indicator: every coloured control also carries a
    // textual workflow tag and a hover tooltip. This keeps the UI understandable
    // even when colours are hard to distinguish.
    var UI_BLUE   = [0.18, 0.43, 0.73, 1]; // Projekt / Band / InDesign-Basis
    var UI_GREEN  = [0.16, 0.56, 0.31, 1]; // Einzelbatch von Export bis Layout
    var UI_MAGENTA = [0.82, 0.20, 0.52, 1]; // Bulk von Export bis Layout · klar getrennt von Blau
    var UI_ORANGE = [0.86, 0.49, 0.10, 1]; // Sicherheit / Rückgängig / Reparatur
    var UI_PETROL = [0.00, 0.43, 0.47, 1]; // v2.0.18: Komplettband ohne Batches
    var UI_TEXT_LIGHT = [1, 1, 1, 1];
    var UI_DISABLED = [0.36, 0.36, 0.36, 1];

    // ---------------- Fixed production settings ----------------
    // Ben Jehojada, 7 x 10 inch (KDP). Capacities are the Ben-Ish-Chai A5
    // figures scaled by frame area and then reduced for the two new page
    // elements that the Ben Ish Chai does not have: the Talmud band at the
    // head of every segment and the footnote apparatus at the foot of the
    // frame. Recalibrate after the first 30 typeset pages.
    var MAX_PAGES = 600;
    var TARGET_PAGES = 540;
    var RESERVED_PAGES = 12;
    var BODY_TARGET = TARGET_PAGES - RESERVED_PAGES;
    var HE_CHARS_PER_PAGE = 1280;   // A5 1050 x 1.56 area x 0.78 apparatus
    var EN_CHARS_PER_PAGE = 2420;   // A5 2000 x 1.61 area x 0.75 apparatus
    var EN_EXPANSION = 1.95;        // measured on the Ben Ish Chai, kept
    var PAGE_BATCH = 12;
    // v2.0.18: complete-volume workflow
    var COMPLETE_LAYOUT_GROUP_DEFAULT = 12;   // segments per full-volume layout group
    var COMPLETE_REPORT_LIMIT = 60;           // listed errors/warnings per report section
    var MANUAL_PAGE_DEFAULT = 2;

    // v2.0.0: even volumes. The Ben Ish Chai filled each volume to the target
    // and left the last one short. Here the planner first estimates the total
    // and then divides it evenly over the required number of volumes, so no
    // volume is much thinner than its siblings.
    var BALANCE_VOLUMES = true;

    // Controlled batch layout balancing. The divider may move only inside
    // these safety limits; the outer frame edges remain unchanged.
    var LAYOUT_GAP_MM = 3.0;
    var LAYOUT_MIN_HE_HEIGHT_MM = 65;
    var LAYOUT_MIN_EN_HEIGHT_MM = 65;
    var LAYOUT_STEP_MM = 3.0;
    var LAYOUT_MAX_PASSES = 10;
    var LAYOUT_FINE_EPSILON = 0.015;
    var LAYOUT_FINE_OK = 0.10;

    // v1.0.12 boundary solver.  The primary goal is that HE and EN reach the
    // same BIH segment at the bottom page boundary.  Only inside that same
    // segment do we compare normalized RENDERED LINE progress.  This is much
    // more reliable than comparing raw character percentages across languages.
    var LAYOUT_ANCHOR_OK = 0.10;
    var LAYOUT_ANCHOR_EPSILON = 0.015;
    var LAYOUT_SEARCH_FINE_MM = 0.5;
    var LAYOUT_BINARY_ITERATIONS = 10;
    var LAYOUT_NOMINAL_SPLIT_MM = 126.0;

    // v2.0.9 hard production envelope.  The HE bottom may never be committed
    // more than ±15 mm from 126 mm.  Because the gap is fixed at 3 mm, the
    // corresponding EN top is therefore always 114–144 mm.
    var LAYOUT_HARD_DEVIATION_MM = 15.0;

    // v1.0.13 Fast Mode.  Accuracy is still judged with the same BYH-ID /
    // rendered-line anchor as v1.0.12; only the number and scope of recomposes
    // is reduced.  The precision solver remains available from the UI.
    var LAYOUT_FAST_BINARY_ITERATIONS = 8;
    var LAYOUT_FAST_BRACKET_MM = 0.60;
    var LAYOUT_FAST_LOCAL_MM = 0.50;

    // v2.0.15: dedicated Daf-heading synchronization. The divider is moved only
    // in small directed steps. Daf equality and the legal divider envelope are
    // HARD; the stable BYH-ID gap is a logged SOFT goal during a required repair.
    var DAF_SYNC_STEP_MM = 0.50;
    var DAF_SYNC_MAX_STEPS = 80;
    var DAF_SYNC_LOOKBACK_PAGES = 12;

    // ---------------- Page geometry: 7 x 10 inch ----------------
    // Base bounds describe a LEFT-hand (verso) page. v2.0.2 keeps the actual
    // text frame 5 mm inside the margin guides and mirrors it from page.side.
    // This avoids asymmetric frame placement and remains correct even if a
    // section's numbering does not match simple odd/even assumptions.
    var PAGE_W_MM = 177.8;          // 7"
    var PAGE_H_MM = 254.0;          // 10"
    var MARGIN_INNER_MM = 19.1;     // KDP minimum for 501-700 pages
    var MARGIN_OUTER_MM = 14.0;
    var MARGIN_TOP_MM = 16.0;
    var MARGIN_BOTTOM_MM = 20.0;
    var MARGIN_MM = MARGIN_OUTER_MM;               // kept for old call sites
    // v2.0.2: Der Satzrahmen liegt bewusst 5 mm INNERHALB der InDesign-Randhilfslinien.
    // Auf linken/rechten Seiten wird er spiegelbildlich gesetzt. Damit ist der Abstand
    // zum äußeren Randrahmen auf allen vier Seiten optisch und geometrisch gleich.
    var FRAME_INSET_MM = 5.0;
    var FRAME_LEFT_MM = MARGIN_OUTER_MM + FRAME_INSET_MM;                  // 19,0 mm auf Verso
    var FRAME_RIGHT_MM = PAGE_W_MM - MARGIN_INNER_MM - FRAME_INSET_MM;     // 153,7 mm auf Verso
    var FRAME_TOP_MM = MARGIN_TOP_MM + FRAME_INSET_MM;                    // 21,0 mm
    var FRAME_BOTTOM_MM = PAGE_H_MM - MARGIN_BOTTOM_MM - FRAME_INSET_MM;  // 229,0 mm
    var HE_BOUNDS_MM = [FRAME_TOP_MM, FRAME_LEFT_MM, 126.00, FRAME_RIGHT_MM];
    var EN_BOUNDS_MM = [129.00, FRAME_LEFT_MM, FRAME_BOTTOM_MM, FRAME_RIGHT_MM];
    var RULE_Y_MM = 20.00;
    // v2.0.3: Seitenzahl im Fußsteg. Der EN-Rahmen endet bei 229 mm,
    // die Randhilfslinie liegt bei 234 mm; die Seitenzahl beginnt erst
    // darunter im eigentlichen Fußsteg und bleibt deutlich vom Beschnitt entfernt.
    var PAGE_NO_TOP_MM = 237.00;
    var PAGE_NO_BOTTOM_MM = 245.00;
    var PAGE_NO_WIDTH_MM = 12.0;

    // v2.0.4: InDesign setzt die Objekte der linken Spread-Seite in diesem
    // 7x10-Aufbau 5 mm zu weit nach außen. Nur die linke Seite erhält daher
    // eine horizontale Korrektur um +5 mm. Die rechte Seite bleibt unverändert.
    // Diese Korrektur gilt gemeinsam für HE-/EN-Rahmen, Linie und Seitenzahl.
    var LEFT_PAGE_X_CORRECTION_MM = 5.0;

    // v2.0.5: Laufende Kopfzeilen. Sie liegen vollständig im Kopfsteg oberhalb
    // der vorhandenen Haarlinie bei 20 mm und verändern niemals HE-/EN-Rahmen.
    var HEADER_FRAME_LABEL = "BYH_RUNNING_HEADER";
    var HEADER_TOP_MM = 8.0;
    var HEADER_BOTTOM_MM = 15.0;
    var HEADER_EN_SIZE = 7.5;
    var HEADER_HE_SIZE = 8.0;
    var HEADER_EN_TRACKING = 30;
    var HEADER_TINT = 85;
    var DOC_HEADER_TRACTATE_EN = "BYH_HEADER_TRACTATE_EN";
    var DOC_HEADER_TRACTATE_HE = "BYH_HEADER_TRACTATE_HE";
    var DOC_HEADER_TEMPLATE_EN = "BYH_HEADER_TEMPLATE_EN";
    var DOC_HEADER_TEMPLATE_HE = "BYH_HEADER_TEMPLATE_HE";
    var DOC_HEADER_LAST_RUN = "BYH_HEADER_LAST_RUN";

    var HE_FONT = "Frank Ruhl Hofshi";   // installierter hebräischer Produktionsfont
    var HE_FONT_STYLE = "Regular";
    var HE_SIZE = 11;
    var HE_LEADING = 16;
    var EN_FONT = "Minion Pro";
    var EN_FONT_STYLE = "Regular";
    var EN_SIZE = 9.5;
    var EN_LEADING = 12.8;

    // v2.0.0: Talmud band and footnote apparatus
    var BAND_HE_SIZE = 12;      var BAND_HE_LEADING = 17;
    var BAND_EN_SIZE = 9;       var BAND_EN_LEADING = 12;
    var FN_SIZE = 7.5;          var FN_LEADING = 9.5;
    var BAND_TINT = 72;         // v2.0.7: text tint; v2.0.6 accidentally used 8 % black, which was far too pale

    var STYLE_HE = "BY · Hebräisch";
    var STYLE_EN = "BY · English";
    var STYLE_HE_HEAD = "BY · Abschnitt · Hebräisch";
    var STYLE_EN_HEAD = "BY · Section · English";
    var STYLE_BAND_HE = "BY · Talmud · Hebräisch";
    var STYLE_BAND_EN = "BY · Talmud · English";
    var STYLE_FN_HE = "BY · Fussnote · Hebräisch";
    var STYLE_FN_EN = "BY · Fussnote · English";
    var CHAR_BOLD = "BY · Fett";
    var CHAR_ITALIC = "BY · Kursiv";
    var CHAR_HE_IN_EN = "BY · Hebräisch in Englisch";
    var CHAR_SMALL = "BY · Klein";
    var CHAR_SUP = "BY · Hochgestellt";
    var CHAR_LEMMA = "BY · Lemma";

    var FRAME_HE_LABEL = "BYH_HE_FRAME";
    var FRAME_EN_LABEL = "BYH_EN_FRAME";
    var DOC_VOLUME_LABEL = "BYH_VOLUME_NUMBER";
    var DOC_SOURCE_LABEL = "BYH_BILINGUAL_SOURCE";
    var DOC_LAYOUT_SNAPSHOT_LABEL = "BYH_LAYOUT_LAST_SNAPSHOT";
    var DOC_LAYOUT_BATCH_LABEL = "BYH_LAYOUT_LAST_BATCH";
    var DOC_LAYOUT_LOCKS_LABEL = "BYH_LAYOUT_LOCKED_PAGES";

    var state = {
        hebrewFile: null,
        outputFolder: null,
        parsed: null,
        plan: null
    };

    showPalette();

    // ---------------- User interface ----------------

    function showPalette() {
        try {
            var old = $.global.__BYH_BILINGUAL_BOOK_MANAGER_V212__;
            if (old && old.visible) { old.active = true; return; }
        } catch (_) {}

        var w = new Window("palette", APP_NAME + " v" + VERSION, undefined, {resizeable:true});
        $.global.__BYH_BILINGUAL_BOOK_MANAGER_V212__ = w;
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 12;
        w.spacing = 8;
        w.minimumSize = [980, 620];
        w.preferredSize = [1120, 860];

        var tabs = w.add("tabbedpanel");
        tabs.alignChildren = ["fill", "fill"];
        tabs.alignment = ["fill", "fill"];

        var projectTab = tabs.add("tab", undefined, "1 · Projekt & Bände");
        projectTab.orientation = "column";
        projectTab.alignChildren = "fill";
        projectTab.margins = 12;
        projectTab.spacing = 9;

        addWorkflowLegend(projectTab, [
            {label:"BLAU · Projekt / Bandaufbau", color:UI_BLUE, tip:"Projektquelle, Bandplanung und Banddateien erzeugen. Dies ist der Grundaufbau und wird normalerweise nur zu Beginn eines Projekts verwendet."}
        ]);

        var srcPanel = projectTab.add("panel", undefined, "Vollständige hebräische Quelle");
        srcPanel.orientation = "column";
        srcPanel.alignChildren = "fill";
        srcPanel.margins = 10;
        var srcRow = srcPanel.add("group");
        srcRow.add("statictext", undefined, "Hebräische TXT:");
        var srcEdit = srcRow.add("edittext", undefined, ""); srcEdit.characters = 65;
        var srcBtn = srcRow.add("button", undefined, "Auswählen …");
        var outRow = srcPanel.add("group");
        outRow.add("statictext", undefined, "Projektordner:");
        var outEdit = outRow.add("edittext", undefined, ""); outEdit.characters = 65;
        var outBtn = outRow.add("button", undefined, "Auswählen …");

        var fixedPanel = projectTab.add("panel", undefined, "Fest eingestellte Produktionsgrenzen");
        fixedPanel.orientation = "row";
        fixedPanel.margins = 10;
        fixedPanel.add("statictext", undefined,
            "Ziel: " + TARGET_PAGES + " Seiten · Reserve: " + RESERVED_PAGES +
            " · absolute Sperre: " + MAX_PAGES + " Seiten · Trennung nur zwischen Segmenten");

        var actionRow = projectTab.add("group");
        var analyzeBtn = actionRow.add("button", undefined, "Analysieren & Bandplan berechnen");
        var createFilesBtn = actionRow.add("button", undefined, "Banddateien erzeugen");
        createFilesBtn.enabled = false;

        var summary = projectTab.add("edittext", undefined, "Noch keine Quelle analysiert.", {multiline:true, readonly:true, scrolling:true});
        summary.preferredSize = [920, 330];

        var translationTab = tabs.add("tab", undefined, "2 · Übersetzungsportionen");
        translationTab.orientation = "column";
        translationTab.alignChildren = "fill";
        translationTab.margins = 12;
        translationTab.spacing = 10;

        addWorkflowLegend(translationTab, [
            {label:"GRÜN · Einzelbatch", color:UI_GREEN, tip:"Einzelablauf: einen Batch exportieren, übersetzen lassen und einzeln nach BYH-ID zurückführen."},
            {label:"MAGENTA · Bulk", color:UI_MAGENTA, tip:"Bulk-Ablauf: mehrere getrennte Batches exportieren, gemeinsam vorprüfen und in einem Master-Schreibvorgang zurückführen."},
            {label:"BLAU · Band-Master", color:UI_BLUE, tip:"Die ausgewählte BILINGUAL.txt ist die maßgebliche Banddatei für beide Abläufe."},
            {label:"PETROL · Komplettband", color:UI_PETROL, tip:"v2.0.18: Eine vollständig übersetzte Banddatei als Ganzes prüfen und übernehmen – ohne Batches, ohne Bulk_Set."}
        ]);

        var masterPanel = translationTab.add("panel", undefined, "Zweisprachige Banddatei · gemeinsame Grundlage");
        masterPanel.orientation = "row";
        masterPanel.margins = 10;
        masterPanel.add("statictext", undefined, "Banddatei:");
        var bilingualEdit = masterPanel.add("edittext", undefined, ""); bilingualEdit.characters = 67;
        var bilingualBtn = masterPanel.add("button", undefined, "Auswählen …");

        var quotaPanel = translationTab.add("panel", undefined, "Nächste noch nicht übersetzte Segmente");
        quotaPanel.orientation = "column";
        quotaPanel.alignChildren = "left";
        quotaPanel.margins = 10;
        var quotaRow = quotaPanel.add("group");
        addWorkflowTag(quotaRow, "EINZEL", UI_GREEN, "Grüner Ablauf: genau einen Translation_Batch exportieren.");
        quotaRow.add("statictext", undefined, "Höchstens Segmente:");
        var quotaSegments = quotaRow.add("edittext", undefined, "12"); quotaSegments.characters = 5;
        quotaRow.add("statictext", undefined, "und höchstens hebräische Zeichen:");
        var quotaChars = quotaRow.add("edittext", undefined, "30000"); quotaChars.characters = 8;
        var exportBatchBtn = quotaRow.add("button", undefined, "Einzelbatch exportieren");

        var bulkRow = quotaPanel.add("group");
        addWorkflowTag(bulkRow, "BULK", UI_MAGENTA, "Magenta-Ablauf: mehrere getrennte Translation_Batch-Dateien in einem Durchlauf exportieren.");
        bulkRow.add("statictext", undefined, "Anzahl Batch-Dateien:");
        var bulkCountEdit = bulkRow.add("edittext", undefined, "10"); bulkCountEdit.characters = 5;
        var exportBulkBtn = bulkRow.add("button", undefined, "Bulk-Batches exportieren");
        var queueStatusBtn = bulkRow.add("button", undefined, "Queue-Status anzeigen");
        bulkRow.add("statictext", undefined, "Jeder Batch bleibt eine eigene TXT; bereits exportierte Queue-IDs werden übersprungen.");

        var mergePanel = translationTab.add("panel", undefined, "Übersetzte Batches zurückführen");
        mergePanel.orientation = "column";
        mergePanel.alignChildren = "fill";
        mergePanel.margins = 10;
        var mergeSingleRow = mergePanel.add("group");
        addWorkflowTag(mergeSingleRow, "EINZEL", UI_GREEN, "Grüner Ablauf: eine fertige _EN_FERTIG-Datei prüfen und zurückführen.");
        mergeSingleRow.add("statictext", undefined, "Fertiger Batch:");
        var batchEdit = mergeSingleRow.add("edittext", undefined, ""); batchEdit.characters = 55;
        var batchBtn = mergeSingleRow.add("button", undefined, "Auswählen …");
        var mergeBtn = mergeSingleRow.add("button", undefined, "Nach IDs zusammenführen");
        var mergeBulkRow = mergePanel.add("group");
        addWorkflowTag(mergeBulkRow, "BULK", UI_MAGENTA, "Magenta-Ablauf: mehrere _EN_FERTIG-Dateien zuerst vollständig vorprüfen und danach gemeinsam zurückführen.");
        mergeBulkRow.add("statictext", undefined, "Bulk-Merge:");
        var bulkMergeInfo = mergeBulkRow.add("edittext", undefined, "Keine _EN_FERTIG-Dateien ausgewählt", {readonly:true}); bulkMergeInfo.characters = 45;
        var bulkMergeSelectBtn = mergeBulkRow.add("button", undefined, "Mehrere _EN_FERTIG auswählen …");
        var bulkMergeBtn = mergeBulkRow.add("button", undefined, "Alle gemeinsam zusammenführen");
        var bulkMergeFiles = [];
        var bulkLayoutGroup = null;

        // ---- v2.0.18: complete translated volume instead of batches ----
        var completePanel = translationTab.add("panel", undefined, "Komplettband · vollständig übersetzte Banddatei (ohne Batches)");
        completePanel.orientation = "column";
        completePanel.alignChildren = "fill";
        completePanel.margins = 10;
        var completeFileRow = completePanel.add("group");
        addWorkflowTag(completeFileRow, "KOMPLETTBAND", UI_PETROL, "Petrol-Ablauf: eine komplette _EN_FERTIG-Banddatei (<book> mit allen Segmenten) als Ganzes verarbeiten.");
        completeFileRow.add("statictext", undefined, "Fertige Banddatei:");
        var completeEdit = completeFileRow.add("edittext", undefined, ""); completeEdit.characters = 58;
        var completeBtn = completeFileRow.add("button", undefined, "Auswählen …");
        var completeActionRow = completePanel.add("group");
        addWorkflowTag(completeActionRow, "KOMPLETTBAND", UI_PETROL, "Prüfen verändert nichts. Übernehmen schreibt den Band-Master genau einmal. Als Quelle verwenden schreibt gar nichts.");
        var completeCheckBtn = completeActionRow.add("button", undefined, "Komplettband prüfen");
        var completeMergeBtn = completeActionRow.add("button", undefined, "In Band-Master übernehmen");
        var completeUseBtn = completeActionRow.add("button", undefined, "Als InDesign-Quelle verwenden");
        var completeReplaceCheck = completeActionRow.add("checkbox", undefined, "Abweichende vorhandene Übersetzungen im Master ersetzen");
        completeReplaceCheck.value = false;

        var transStatus = translationTab.add("edittext", undefined,
            "Die Banddatei bleibt die maßgebliche Datei. Ein Batch enthält dieselben stabilen IDs und wird ausschließlich über diese IDs zurückgeführt.\r\n" +
            "v2.0.18: Liegt der Band bereits vollständig übersetzt vor, im Bereich KOMPLETTBAND die fertige Banddatei wählen und prüfen – Batches sind dann nicht nötig.",
            {multiline:true, readonly:true, scrolling:true});
        transStatus.preferredSize = [920, 220];

        var indesignTab = tabs.add("tab", undefined, "3 · InDesign-Band");
        indesignTab.orientation = "column";
        indesignTab.alignChildren = "fill";
        indesignTab.margins = 12;
        indesignTab.spacing = 10;

        addWorkflowLegend(indesignTab, [
            {label:"BLAU · Band / Textfluss", color:UI_BLUE, tip:"Grundfunktionen des aktiven InDesign-Bandes: erstellen, HE/EN aktualisieren, prüfen und Textfluss verwalten."},
            {label:"GRÜN · Einzelbatch-Layout", color:UI_GREEN, tip:"Ein fertiger Batch wird analysiert und dessen HE/EN-Rahmen werden kontrolliert angeglichen."},
            {label:"MAGENTA · Bulk-Layout", color:UI_MAGENTA, tip:"Eine Bulk-Gruppe wird geladen; Englisch wird genau einmal aktualisiert, danach werden alle Batches in BYH-ID-Reihenfolge angeglichen."},
            {label:"ORANGE · Sicherheit / Reparatur", color:UI_ORANGE, tip:"Rückgängig, Snapshot-Wiederherstellung und Standardtrennung. Diese Funktionen verändern oder restaurieren Layoutzustände."},
            {label:"PETROL · Komplettband", color:UI_PETROL, tip:"v2.0.18: Neuer Band aus einer vollständig übersetzten Banddatei – Aufbau und Gesamtband-Abgleich in einem Lauf, ohne Batches."}
        ]);

        var idSourcePanel = indesignTab.add("panel", undefined, "Quelle für den InDesign-Band · gemeinsame Grundlage");
        idSourcePanel.orientation = "row";
        idSourcePanel.margins = 10;
        idSourcePanel.add("statictext", undefined, "Banddatei:");
        var idSourceEdit = idSourcePanel.add("edittext", undefined, ""); idSourceEdit.characters = 67;
        var idSourceBtn = idSourcePanel.add("button", undefined, "Auswählen …");

        var idActions = indesignTab.add("group");
        addWorkflowTag(idActions, "BAND", UI_BLUE, "Blaue Grundfunktionen für den aktiven InDesign-Band.");
        var buildDocBtn = idActions.add("button", undefined, "Neuen InDesign-Band erstellen");
        var updateHeBtn = idActions.add("button", undefined, "Hebräisch im aktiven Band aktualisieren");
        var updateEnBtn = idActions.add("button", undefined, "Englisch im aktiven Band aktualisieren");
        var validateBtn = idActions.add("button", undefined, "Aktiven Band prüfen");

        // ---- v2.0.18: complete volume in one run ----
        var completeIdPanel = indesignTab.add("panel", undefined, "Komplettband · ganzer Band ohne Batches");
        completeIdPanel.orientation = "column";
        completeIdPanel.alignChildren = "fill";
        completeIdPanel.margins = 10;
        var completeIdRow = completeIdPanel.add("group");
        addWorkflowTag(completeIdRow, "KOMPLETTBAND", UI_PETROL, "Petrol-Ablauf: die oben gewählte, vollständig übersetzte Banddatei prüfen, als neuen InDesign-Band aufbauen und danach komplett angleichen.");
        var completeIdCheckBtn = completeIdRow.add("button", undefined, "Quelle als Komplettband prüfen");
        var completeBuildLayoutBtn = completeIdRow.add("button", undefined, "Komplettband: neuen Band erstellen + ganzen Band angleichen");
        var completeIdOptRow = completeIdPanel.add("group");
        addWorkflowTag(completeIdOptRow, "GESAMTBAND", UI_PETROL, "Gilt für den Komplettband-Lauf UND für 'Ganzen Band angleichen · EN bereits vorhanden'.");
        completeIdOptRow.add("statictext", undefined, "Segmente je Layout-Gruppe:");
        var wholeGroupSizeEdit = completeIdOptRow.add("edittext", undefined, String(COMPLETE_LAYOUT_GROUP_DEFAULT)); wholeGroupSizeEdit.characters = 4;
        completeIdOptRow.add("statictext", undefined, "Start ab Gruppe:");
        var wholeStartEdit = completeIdOptRow.add("edittext", undefined, "1"); wholeStartEdit.characters = 4;
        completeIdOptRow.add("statictext", undefined, "1 = ganzer Band · nach einem Sicherheitsabbruch wird die Fortsetzungsgruppe hier automatisch eingetragen");

        var flowPanel = indesignTab.add("panel", undefined, "Seiten & Textfluss");
        flowPanel.orientation = "row";
        flowPanel.alignChildren = ["left", "center"];
        flowPanel.margins = 10;
        addWorkflowTag(flowPanel, "BAND", UI_BLUE, "Blaue Textfluss-Werkzeuge für Seiten, Verkettung und Übersatz.");
        flowPanel.add("statictext", undefined, "Seiten mit HE/EN-Textrahmen hinzufügen:");
        var addPagesEdit = flowPanel.add("edittext", undefined, String(MANUAL_PAGE_DEFAULT)); addPagesEdit.characters = 4;
        var addPagesBtn = flowPanel.add("button", undefined, "Hinzufügen");
        var autoFlowBtn = flowPanel.add("button", undefined, "Übersatz automatisch beheben");

        var layoutPanel = indesignTab.add("panel", undefined, "Batch-Layout · HE/EN automatisch angleichen");
        layoutPanel.orientation = "column";
        layoutPanel.alignChildren = "fill";
        layoutPanel.margins = 10;
        var layoutBatchRow = layoutPanel.add("group");
        addWorkflowTag(layoutBatchRow, "EINZEL", UI_GREEN, "Grüner Layout-Ablauf für genau einen fertigen Batch.");
        layoutBatchRow.add("statictext", undefined, "Fertiger Batch:");
        var layoutBatchEdit = layoutBatchRow.add("edittext", undefined, ""); layoutBatchEdit.characters = 54;
        var layoutBatchBtn = layoutBatchRow.add("button", undefined, "Auswählen …");
        layoutBatchRow.add("statictext", undefined, "Geschützte Seiten:");
        var layoutLocksEdit = layoutBatchRow.add("edittext", undefined, ""); layoutLocksEdit.characters = 14;
        layoutLocksEdit.helpTip = "Optional, z. B. 12,13,18-21. Diese Seiten werden beim automatischen Batch-Abgleich nicht verändert.";

        var layoutBulkRow = layoutPanel.add("group");
        addWorkflowTag(layoutBulkRow, "BULK", UI_MAGENTA, "Magenta-Layout-Ablauf für eine komplette Bulk-Gruppe.");
        layoutBulkRow.add("statictext", undefined, "Bulk-Gruppe:");
        var layoutBulkEdit = layoutBulkRow.add("edittext", undefined, "Kein Bulk_Set-Manifest geladen", {readonly:true}); layoutBulkEdit.characters = 43;
        var layoutBulkLoadBtn = layoutBulkRow.add("button", undefined, "Bulk-Gruppe laden …");
        var layoutBulkRunBtn = layoutBulkRow.add("button", undefined, "Bulk: EN 1× aktualisieren + alle angleichen");
        var layoutBulkProgress = layoutBulkRow.add("statictext", undefined, "Bereit");
        layoutBulkProgress.preferredSize.width = 150;

        var layoutBulkResumeRow = layoutPanel.add("group");
        addWorkflowTag(layoutBulkResumeRow, "FORTSETZEN", UI_MAGENTA, "Für einen bereits begonnenen Bulk-Lauf: vorhandenen EN-Textfluss validieren und nur die Layout-Batches angleichen.");
        var layoutBulkResumeBtn = layoutBulkResumeRow.add("button", undefined, "Bulk fortsetzen · EN nicht neu einspielen");
        layoutBulkResumeRow.add("statictext", undefined, "Nur verwenden, wenn der EN-Text bereits aus genau diesem Master im Dokument steht.");

        var layoutWholeRow = layoutPanel.add("group");
        addWorkflowTag(layoutWholeRow, "GESAMTBAND", UI_MAGENTA, "Für einen neu aufgebauten Band aus einer bereits übersetzten BILINGUAL-Datei; ohne Bulk_Set und BatchQueue.");
        var layoutWholeBtn = layoutWholeRow.add("button", undefined, "Ganzen Band angleichen · EN bereits vorhanden");
        layoutWholeRow.add("statictext", undefined, "Alle IDs aus dem gewählten Master · keine erneute EN-Aktualisierung");

        var layoutActionRow = layoutPanel.add("group");
        addWorkflowTag(layoutActionRow, "EINZEL", UI_GREEN, "Grüner Einzelbatch-Ablauf: analysieren, angleichen oder EN aktualisieren und anschließend angleichen.");
        var layoutAnalyzeBtn = layoutActionRow.add("button", undefined, "Batch analysieren");
        var layoutApplyBtn = layoutActionRow.add("button", undefined, "Automatisch angleichen");
        var layoutUpdateApplyBtn = layoutActionRow.add("button", undefined, "EN aktualisieren + angleichen");
        addWorkflowTag(layoutActionRow, "SICHERHEIT", UI_ORANGE, "Orange Funktionen stellen einen früheren Layoutzustand wieder her.");
        var layoutUndoBtn = layoutActionRow.add("button", undefined, "Letzten Batch rückgängig");
        var layoutRestoreBtn = layoutActionRow.add("button", undefined, "Snapshot wiederherstellen …");
        var layoutSpeedRow = layoutPanel.add("group");
        var layoutFastCheck = layoutSpeedRow.add("checkbox", undefined, "Schnellmodus (empfohlen)");
        layoutFastCheck.value = true;
        layoutFastCheck.helpTip = "Verwendet dieselbe BYH-ID-Logik wie v1.0.12, reduziert aber vollständige Neukompositionen drastisch. Deaktivieren = Präzisionsmodus v1.0.12.";
        layoutSpeedRow.add("statictext", undefined, "Aus = Präzisionsmodus v1.0.12 · langsamer, als Kontroll-/Fallbackmodus");
        var layoutLimitRow = layoutPanel.add("group");
        addWorkflowTag(layoutLimitRow, "HARD LIMIT", UI_ORANGE, "v2.0.11: Der Divider darf höchstens ±15 mm vom Produktionsstandard 126/129 mm abweichen. Daf-Synchronität bleibt zwingend.");
        layoutLimitRow.add("statictext", undefined, "HE 111–141 mm · EN 114–144 mm · Abstand immer 3 mm · Daf-Synchronität = harte Abschlussbedingung");
        var layoutRepairRow = layoutPanel.add("group");
        addWorkflowTag(layoutRepairRow, "REPARATUR", UI_ORANGE, "Orange Reparaturfunktion: setzt nur die Batch-Seiten auf die Produktions-Standardtrennung zurück.");
        var layoutResetBtn = layoutRepairRow.add("button", undefined, "Batch-Seiten auf Standardtrennung zurücksetzen");
        layoutRepairRow.add("statictext", undefined, "Nur für Reparatur älterer Fehlversuche; geschützte Seiten bleiben unverändert.");

        var idInfo = indesignTab.add("statictext", undefined,
            "Layout fest: 177,8 × 254 mm · Satzrahmen 5 mm innerhalb der Randhilfslinien · Hebräisch Frank Ruhl Hofshi 11/16 pt · Englisch Minion Pro 9,5/12,8 pt · unabhängige verkettete Textflüsse · maximal 600 Seiten.",
            {multiline:true});
        idInfo.preferredSize.width = 900;
        var idStatus = indesignTab.add("edittext", undefined, "Bereit.", {multiline:true, readonly:true, scrolling:true});
        idStatus.preferredSize = [920, 190];

        // ---- v2.0.5: eigener Kopfzeilen-Reiter ----
        var headerTab = tabs.add("tab", undefined, "4 · Kopfzeilen");
        headerTab.orientation = "column";
        headerTab.alignChildren = "fill";
        headerTab.margins = 12;
        headerTab.spacing = 9;

        addWorkflowLegend(headerTab, [
            {label:"BLAU · Kopfzeilen", color:UI_BLUE, tip:"Analyse, Test, Erstellen/Aktualisieren und Prüfung der laufenden Kopfzeilen. Produktiv erst nach Übersetzung und endgültigem HE/EN-Abgleich ausführen."},
            {label:"ORANGE · Rückbau", color:UI_ORANGE, tip:"Entfernt ausschließlich vom Book Manager erzeugte Kopfzeilen. HE-/EN-Rahmen, Haarlinie und Seitenzahlen bleiben unverändert."}
        ]);

        var headerSourcePanel = headerTab.add("panel", undefined, "Quelle & Zeitpunkt");
        headerSourcePanel.orientation = "column";
        headerSourcePanel.alignChildren = "fill";
        headerSourcePanel.margins = 10;
        var headerSourceRow = headerSourcePanel.add("group");
        addWorkflowTag(headerSourceRow, "KOPFZEILE", UI_BLUE, "Die Kopfzeile wird aus dem aktuellen Seitenfluss des fertigen InDesign-Bandes erzeugt.");
        headerSourceRow.add("statictext", undefined, "BILINGUAL.txt:");
        var headerSourceEdit = headerSourceRow.add("edittext", undefined, ""); headerSourceEdit.characters = 55;
        var headerSourceBtn = headerSourceRow.add("button", undefined, "Auswählen …");
        var headerUseDocSourceBtn = headerSourceRow.add("button", undefined, "Quelle aus Dokument");
        var headerTiming = headerSourcePanel.add("statictext", undefined,
            "Empfohlener Produktionszeitpunkt: NACH Übersetzung → EN-Aktualisierung → HE/EN-Batch-/Bulk-Abgleich. Danach Kopfzeilen erzeugen und vor PDF/KDP nochmals prüfen.",
            {multiline:true});
        headerTiming.preferredSize.width = 900;
        styleWorkflowText(headerTiming, UI_BLUE, "Kopfzeilen werden bewusst nicht automatisch beim Bandaufbau erzeugt, weil sich Daf-Grenzen durch Übersetzung und Layout-Abgleich verschieben können.");

        var headerContentPanel = headerTab.add("panel", undefined, "Inhalt · für alle Traktate wiederverwendbar");
        headerContentPanel.orientation = "column";
        headerContentPanel.alignChildren = "fill";
        headerContentPanel.margins = 10;
        var headerNames1 = headerContentPanel.add("group");
        headerNames1.add("statictext", undefined, "Werk EN:");
        var headerWorkEnEdit = headerNames1.add("edittext", undefined, "BEN YEHOYADA"); headerWorkEnEdit.characters = 24;
        headerNames1.add("statictext", undefined, "Traktat EN:");
        var headerTractateEnEdit = headerNames1.add("edittext", undefined, ""); headerTractateEnEdit.characters = 24;
        var headerInferBtn = headerNames1.add("button", undefined, "Traktat automatisch erkennen");
        var headerNames2 = headerContentPanel.add("group");
        headerNames2.add("statictext", undefined, "Werk HE:");
        var headerWorkHeEdit = headerNames2.add("edittext", undefined, "בן יהוידע"); headerWorkHeEdit.characters = 24;
        headerNames2.add("statictext", undefined, "Traktat HE:");
        var headerTractateHeEdit = headerNames2.add("edittext", undefined, ""); headerTractateHeEdit.characters = 24;
        var headerTemplates = headerContentPanel.add("group");
        headerTemplates.orientation = "column";
        headerTemplates.alignChildren = "fill";
        var headerTplEnRow = headerTemplates.add("group");
        headerTplEnRow.add("statictext", undefined, "Vorlage EN:");
        var headerTemplateEnEdit = headerTplEnRow.add("edittext", undefined, "{WORK} · {TRACTATE} · {DAF}"); headerTemplateEnEdit.characters = 58;
        var headerTplHeRow = headerTemplates.add("group");
        headerTplHeRow.add("statictext", undefined, "Vorlage HE:");
        var headerTemplateHeEdit = headerTplHeRow.add("edittext", undefined, "{WORK} · {TRACTATE} · {DAF}"); headerTemplateHeEdit.characters = 58;
        headerContentPanel.add("statictext", undefined,
            "Tokens: {WORK} · {TRACTATE} · {DAF}. Standard: linke Seiten Englisch, rechte Seiten Hebräisch. Beispiel: BEN YEHOYADA · BERAKHOT · Daf 4b / בן יהוידע · ברכות · דף ד ע״ב");

        var headerTypePanel = headerTab.add("panel", undefined, "Typografie & Position");
        headerTypePanel.orientation = "row";
        headerTypePanel.alignChildren = ["left","center"];
        headerTypePanel.margins = 10;
        headerTypePanel.add("statictext", undefined, "EN Minion Pro:");
        var headerEnSizeEdit = headerTypePanel.add("edittext", undefined, String(HEADER_EN_SIZE)); headerEnSizeEdit.characters = 5;
        headerTypePanel.add("statictext", undefined, "pt · Tracking:");
        var headerTrackingEdit = headerTypePanel.add("edittext", undefined, String(HEADER_EN_TRACKING)); headerTrackingEdit.characters = 5;
        headerTypePanel.add("statictext", undefined, "HE Frank Ruhl Hofshi:");
        var headerHeSizeEdit = headerTypePanel.add("edittext", undefined, String(HEADER_HE_SIZE)); headerHeSizeEdit.characters = 5;
        headerTypePanel.add("statictext", undefined, "pt · Schwarz:");
        var headerTintEdit = headerTypePanel.add("edittext", undefined, String(HEADER_TINT)); headerTintEdit.characters = 4;
        headerTypePanel.add("statictext", undefined, "% · Kopfsteg 8–15 mm · Haarlinie bei 20 mm bleibt unverändert");

        var headerActionPanel = headerTab.add("panel", undefined, "Produktiver Lauf");
        headerActionPanel.orientation = "column";
        headerActionPanel.alignChildren = "fill";
        headerActionPanel.margins = 10;
        var headerBlueRow = headerActionPanel.add("group");
        addWorkflowTag(headerBlueRow, "KOPFZEILE", UI_BLUE, "BLAU: Analyse und produktive Kopfzeilenfunktionen.");
        var headerAnalyzeBtn = headerBlueRow.add("button", undefined, "Kopfzeilen analysieren");
        var headerTestBtn = headerBlueRow.add("button", undefined, "Aktuelle Doppelseite testen");
        var headerApplyBtn = headerBlueRow.add("button", undefined, "Alle Kopfzeilen erstellen / aktualisieren");
        var headerValidateBtn = headerBlueRow.add("button", undefined, "Kopfzeilen prüfen");
        var headerOrangeRow = headerActionPanel.add("group");
        addWorkflowTag(headerOrangeRow, "RÜCKBAU", UI_ORANGE, "ORANGE: entfernt ausschließlich BYH_RUNNING_HEADER-Rahmen.");
        var headerRemoveBtn = headerOrangeRow.add("button", undefined, "Nur Kopfzeilen entfernen");
        headerOrangeRow.add("statictext", undefined, "Seitenzahlen, Haarlinie und HE-/EN-Textrahmen werden nicht verändert.");

        var headerStatus = headerTab.add("edittext", undefined,
            "Bereit. Die Kopfzeilenfunktion ist vorbereitet; produktiv erst nach dem endgültigen Übersetzungs- und Layoutlauf verwenden.",
            {multiline:true, readonly:true, scrolling:true});
        headerStatus.preferredSize = [920, 220];

        var helpTab = tabs.add("tab", undefined, "5 · Arbeitsablauf");
        helpTab.orientation = "column";
        helpTab.alignChildren = "fill";
        helpTab.margins = 12;
        var help = helpTab.add("edittext", undefined, helpText(), {multiline:true, readonly:true, scrolling:true});
        help.preferredSize = [920, 500];

        // ---- v1.0.15: consistent workflow colours + hover help ----
        styleWorkflowButton(srcBtn, UI_BLUE, "Vollständige hebräische Ausgangs-TXT wählen. Diese Quelle dient der Projektanalyse und Bandplanung.");
        styleWorkflowButton(outBtn, UI_BLUE, "Projektordner wählen, in dem Banddateien, Plan und Kontrolldateien erzeugt werden.");
        styleWorkflowButton(analyzeBtn, UI_BLUE, "Analysiert die hebräische Quelle und berechnet den Bandplan. Es werden noch keine Banddateien geschrieben.");
        styleWorkflowButton(createFilesBtn, UI_BLUE, "Erzeugt die geplanten BILINGUAL-Banddateien und Kontrolldateien. Bestehende Banddateien werden nicht überschrieben.");

        styleWorkflowButton(bilingualBtn, UI_BLUE, "Maßgebliche BILINGUAL.txt des aktuellen Bandes auswählen. Einzel- und Bulk-Ablauf arbeiten auf derselben Masterdatei.");
        styleWorkflowButton(exportBatchBtn, UI_GREEN, "EINZEL: Exportiert genau einen nächsten Translation_Batch unter Beachtung von Segment- und Zeichenlimit sowie der Queue-Reservierungen.");
        styleWorkflowButton(exportBulkBtn, UI_MAGENTA, "BULK: Exportiert die eingestellte Anzahl getrennt gespeicherter Translation_Batch-TXT-Dateien. Der Master wird nur einmal gelesen; Cursor, Manifest und Queue werden geführt.");
        styleWorkflowButton(queueStatusBtn, UI_MAGENTA, "BULK/QUEUE: Zeigt nur den aktuellen Queue-Status, reservierte Bereiche, MERGED/MISSING und die nächste exportierbare BYH-ID. Es wird nichts verändert.");
        styleWorkflowButton(batchBtn, UI_GREEN, "EINZEL: Eine fertige _EN_FERTIG.txt für die einzelne Rückführung auswählen.");
        styleWorkflowButton(mergeBtn, UI_GREEN, "EINZEL: Prüft den gewählten fertigen Batch und führt ihn nach stabilen BYH-IDs in den Band-Master zurück. Vorher wird eine Master-Sicherung angelegt.");
        styleWorkflowButton(bulkMergeSelectBtn, UI_MAGENTA, "BULK: Mehrere fertige _EN_FERTIG.txt gemeinsam auswählen. Zunächst wird nur die Auswahl vorbereitet.");
        styleWorkflowButton(bulkMergeBtn, UI_MAGENTA, "BULK: Prüft ALLE ausgewählten Dateien vollständig, erstellt danach genau eine Master-Sicherung und schreibt alle gültigen Übersetzungen in einem einzigen Master-Schreibvorgang.");

        styleWorkflowButton(idSourceBtn, UI_BLUE, "Die BILINGUAL.txt auswählen, die zum aktuell geöffneten InDesign-Band gehört.");
        styleWorkflowButton(buildDocBtn, UI_BLUE, "Erzeugt einen neuen InDesign-Band aus der ausgewählten BILINGUAL.txt mit HE-/EN-Rahmen, Verkettung und Produktionsformaten.");
        styleWorkflowButton(updateHeBtn, UI_BLUE, "Aktualisiert ausschließlich den vollständigen hebräischen Textfluss aus dem Master. Bestehende Rahmengeometrie und Englisch bleiben erhalten; vorher entsteht eine INDD-Sicherung.");
        styleWorkflowButton(updateEnBtn, UI_BLUE, "Aktualisiert den vollständigen englischen Textfluss EINMAL aus dem aktuellen Band-Master. Für einen Bulk-Lauf normalerweise nicht separat nötig, da der Bulk-Button dies selbst einmal ausführt.");
        styleWorkflowButton(validateBtn, UI_BLUE, "Prüft Seitenzahl, HE/EN-Rahmen, Verkettungen, Übersatz, Bandnummer und Quelle. Es wird nichts verändert.");
        styleWorkflowButton(addPagesBtn, UI_BLUE, "Fügt die angegebene Zahl vollständig eingerichteter zweisprachiger Seiten hinzu und verkettet HE und EN weiter.");
        styleWorkflowButton(autoFlowBtn, UI_BLUE, "Repariert unterbrochene HE/EN-Verkettungen und ergänzt bei echtem Übersatz automatisch Seiten bis zur 600-Seiten-Sperre.");

        styleWorkflowButton(layoutBatchBtn, UI_GREEN, "EINZEL-LAYOUT: Den fertigen _EN_FERTIG-Batch wählen, dessen BYH-ID-Bereich analysiert oder angeglichen werden soll.");
        styleWorkflowButton(layoutAnalyzeBtn, UI_GREEN, "EINZEL-LAYOUT: Ermittelt betroffene Seiten und HE/EN-Abweichungen. Diese Analyse verändert keine Rahmen.");
        styleWorkflowButton(layoutApplyBtn, UI_GREEN, "EINZEL-LAYOUT v2.0.11: Gleicht den gewählten Batch an, begrenzt den Divider hart auf HE 111–141 / EN 114–144 mm und verlangt abschließend Daf-Synchronität.");
        styleWorkflowButton(layoutUpdateApplyBtn, UI_GREEN, "EINZEL-LAYOUT: Aktualisiert zuerst den gesamten englischen Textfluss und gleicht danach genau den gewählten Batch an.");

        styleWorkflowButton(layoutBulkLoadBtn, UI_MAGENTA, "BULK-LAYOUT: Das zugehörige Bulk_Set-Manifest laden. Queue und MERGED-Status aller enthaltenen Batches werden geprüft.");
        styleWorkflowButton(layoutBulkRunBtn, UI_MAGENTA, "BULK-LAYOUT v2.0.11: Frischer Lauf. Aktualisiert Englisch GENAU EINMAL; jeder Divider bleibt hart innerhalb ±15 mm von 126/129 mm. Daf-Synchronität ist zwingende Abschlussbedingung.");
        styleWorkflowButton(layoutBulkResumeBtn, UI_MAGENTA, "BULK-FORTSETZEN v2.0.11: Spielt Englisch NICHT erneut ein. Bestehende Divider-Ausreißer werden beim Batch-Abgleich auf ±15 mm begrenzt; Daf-Synchronität bleibt zwingend.");
        styleWorkflowButton(completeBtn, UI_PETROL, "KOMPLETTBAND: Die vollständig übersetzte Banddatei wählen (<book> mit allen Segmenten, z. B. …_BILINGUAL_EN_FERTIG.txt).");
        styleWorkflowButton(completeCheckBtn, UI_PETROL, "KOMPLETTBAND: Prüft die fertige Banddatei vollständig und listet ALLE Fehler und Hinweise auf. Ist oben ein Band-Master gewählt, wird zusätzlich Segment für Segment gegen ihn verglichen. Es wird nichts geschrieben.");
        styleWorkflowButton(completeMergeBtn, UI_PETROL, "KOMPLETTBAND: Führt die komplette Übersetzung nach erfolgreicher Vorprüfung in den oben gewählten Band-Master zurück: genau eine Master-Sicherung, genau ein Schreibvorgang, Queue-Einträge werden MERGED.");
        styleWorkflowButton(completeUseBtn, UI_PETROL, "KOMPLETTBAND: Übernimmt die geprüfte fertige Banddatei direkt als Quelle für den InDesign-Band (Reiter 3) und die Kopfzeilen (Reiter 4). Es wird keine Datei verändert.");
        styleWorkflowButton(completeIdCheckBtn, UI_PETROL, "KOMPLETTBAND: Prüft die oben gewählte InDesign-Quelle auf Vollständigkeit (alle EN-Felder, Titel, Kopfbänder, Tags, geschätzte Seitenzahl). Es wird nichts verändert.");
        styleWorkflowButton(completeBuildLayoutBtn, UI_PETROL, "KOMPLETTBAND: Vorprüfung → neuen InDesign-Band mit HE und EN aufbauen und speichern → alle Segmente in Layout-Gruppen angleichen (Divider-HARD-LIMIT, Daf-Synchronität, Übersatzbehebung, INDD-Sicherung, Snapshots, Laufprotokoll).");
        styleWorkflowButton(layoutWholeBtn, UI_MAGENTA, "GESAMTBAND v2.0.18: Prüft den vorhandenen englischen Textfluss gegen die gewählte, vollständig übersetzte Banddatei. Gleicht sämtliche BYH-Segmente in kleinen Gruppen an, ohne Bulk_Set/Queue und ohne EN erneut einzuspielen. Daf-Korrekturen dürfen sich innerhalb des HARD LIMIT über einen rollback-sicher erfassten Zwölf-Seiten-Kontext kumulieren. Eine INDD-Sicherung und ein Laufprotokoll werden erstellt. Gruppengröße und Startgruppe stammen aus dem Bereich KOMPLETTBAND.");

        styleWorkflowButton(layoutUndoBtn, UI_ORANGE, "SICHERHEIT: Stellt den Zustand vor dem letzten automatischen Einzelbatch-Layout aus dessen gespeichertem Snapshot wieder her.");
        styleWorkflowButton(layoutRestoreBtn, UI_ORANGE, "SICHERHEIT: Einen beliebigen früher gespeicherten BYH-Layout-Snapshot auswählen und exakt wiederherstellen.");
        styleWorkflowButton(layoutResetBtn, UI_ORANGE, "REPARATUR: Setzt die betroffenen Batch-Seiten auf die Produktions-Standardtrennung 126,00/129,00 mm zurück. Geschützte Seiten bleiben unverändert.");

        styleWorkflowButton(headerSourceBtn, UI_BLUE, "BILINGUAL.txt für die Kopfzeilenanalyse wählen. Die Datei liefert Traktat/Daf-Zuordnung; die tatsächlichen Seiten werden aus dem aktuellen InDesign-Textfluss bestimmt.");
        styleWorkflowButton(headerUseDocSourceBtn, UI_BLUE, "Übernimmt die im aktiven InDesign-Dokument gespeicherte BYH_BILINGUAL_SOURCE als Kopfzeilenquelle.");
        styleWorkflowButton(headerInferBtn, UI_BLUE, "Erkennt den englischen Traktatnamen aus Dateiname/Pfad und setzt – wenn bekannt – automatisch den hebräischen Traktatnamen.");
        styleWorkflowButton(headerAnalyzeBtn, UI_BLUE, "Analysiert den aktuellen HE-Seitenfluss und zeigt, welches Daf auf welchen Seiten als Kopfzeile erscheinen würde. Es wird nichts verändert.");
        styleWorkflowButton(headerTestBtn, UI_BLUE, "Erzeugt/aktualisiert Kopfzeilen nur auf der aktuell sichtbaren Doppelseite. Ideal zur optischen Kontrolle vor dem produktiven Lauf.");
        styleWorkflowButton(headerApplyBtn, UI_BLUE, "Erstellt oder aktualisiert alle laufenden Kopfzeilen anhand des aktuellen finalen Seitenflusses. Vorher wird automatisch eine INDD-Sicherung angelegt.");
        styleWorkflowButton(headerValidateBtn, UI_BLUE, "Prüft vorhandene Kopfzeilen gegen die aktuell aus dem Seitenfluss erwarteten Texte und listet fehlende/abweichende Seiten auf.");
        styleWorkflowButton(headerRemoveBtn, UI_ORANGE, "Entfernt ausschließlich die vom Manager erzeugten Kopfzeilenrahmen. Vorher wird automatisch eine INDD-Sicherung angelegt.");

        // Hover help for important fields / modes.
        bilingualEdit.helpTip = "Band-Master. Alle Exporte und Rückführungen beziehen sich auf diese Datei.";
        quotaSegments.helpTip = "Maximale Segmentanzahl PRO erzeugtem Translation_Batch. Kein Segment wird geteilt.";
        quotaChars.helpTip = "Maximale hebräische Zeichen PRO Translation_Batch. Die Segmentgrenze hat Vorrang; ein Segment wird nicht geteilt.";
        bulkCountEdit.helpTip = "Wie viele getrennte Batch-TXT-Dateien der Bulk-Export in diesem Lauf höchstens erzeugen soll.";
        bulkMergeInfo.helpTip = "Zeigt die Zahl der aktuell für den gemeinsamen Bulk-Merge ausgewählten _EN_FERTIG-Dateien.";
        idSourceEdit.helpTip = "Band-Master für den aktiven InDesign-Band. Bandnummer muss zum geöffneten Dokument passen.";
        addPagesEdit.helpTip = "Anzahl vollständig eingerichteter HE/EN-Seiten, die manuell an den aktiven Band angefügt werden sollen.";
        layoutBatchEdit.helpTip = "EINZEL: fertiger Batch, dessen BYH-IDs für Analyse und Rahmenabgleich verwendet werden.";
        layoutBulkEdit.helpTip = "BULK: geladenes Bulk_Set-Manifest. Der Bulk-Lauf verarbeitet nur zugehörige, bereits MERGED gesetzte Batches.";
        layoutFastCheck.helpTip = "Aktiviert den schnellen, bewährten v1.0.13-Solver. Ausschalten nur zur Kontrolle/Fallback auf den langsameren Präzisionsmodus.";
        layoutBulkProgress.helpTip = "Live-Fortschritt des aktuellen Bulk-Layoutlaufs.";
        layoutWholeBtn.helpTip = "Nach dem Neubau aus einem bereits übersetzten Gesamtmaster: alle HE/EN-Seiten automatisch angleichen; der englische Text bleibt bestehen.";
        completeEdit.helpTip = "Vollständig übersetzte Banddatei (<book …> mit allen <segment>-Blöcken). Wird als Ganzes geprüft; kein Batch, kein Bulk_Set nötig.";
        completeReplaceCheck.helpTip = "Aus (Standard): Weicht eine bereits im Master vorhandene Übersetzung ab, wird abgebrochen. Ein: Die Fassung aus dem Komplettband ersetzt sie; die Master-Sicherung bleibt erhalten.";
        wholeGroupSizeEdit.helpTip = "Anzahl BYH-Segmente je Layout-Gruppe im Gesamtband-Abgleich (Standard 12). Kleinere Gruppen = feinere Protokollierung, größere = weniger Durchläufe.";
        wholeStartEdit.helpTip = "1 = ganzer Band. Nach einem Sicherheitsabbruch trägt das Skript hier die Gruppe ein, mit der fortgesetzt werden kann; bereits angeglichene Gruppen bleiben unverändert.";
        headerSourceEdit.helpTip = "BILINGUAL.txt für die Kopfzeilen. Wenn leer, kann 'Quelle aus Dokument' den gespeicherten Dokumentpfad übernehmen.";
        headerTractateEnEdit.helpTip = "Englischer Traktatname, z. B. Berakhot. Kann automatisch aus dem Dateinamen erkannt werden.";
        headerTractateHeEdit.helpTip = "Hebräischer Traktatname, z. B. ברכות. Für die üblichen Bavli-Traktate kann er automatisch zugeordnet werden.";
        headerTemplateEnEdit.helpTip = "Editierbare englische Kopfzeilenvorlage. Verfügbare Tokens: {WORK}, {TRACTATE}, {DAF}.";
        headerTemplateHeEdit.helpTip = "Editierbare hebräische Kopfzeilenvorlage. Verfügbare Tokens: {WORK}, {TRACTATE}, {DAF}.";

        srcBtn.onClick = function () {
            var f = File.openDialog("Vollständige hebräische TXT wählen", "Text:*.txt");
            if (f) { state.hebrewFile = f; srcEdit.text = f.fsName; }
        };
        outBtn.onClick = function () {
            var f = Folder.selectDialog("Projektordner wählen");
            if (f) { state.outputFolder = f; outEdit.text = f.fsName; }
        };
        analyzeBtn.onClick = function () {
            try {
                var src = fileFromEdit(srcEdit, "Hebräische TXT");
                var out = folderFromEdit(outEdit, "Projektordner");
                state.hebrewFile = src; state.outputFolder = out;
                var raw = readUTF8(src);
                state.parsed = parseHebrewSource(raw);
                state.plan = planVolumes(state.parsed);
                summary.text = planSummary(state.parsed, state.plan);
                createFilesBtn.enabled = true;
            } catch (e) { alert("Analyse fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        createFilesBtn.onClick = function () {
            try {
                if (!state.parsed || !state.plan) throw new Error("Bitte zuerst analysieren.");
                var written = writeProjectFiles(state.parsed, state.plan, state.outputFolder);
                summary.text = planSummary(state.parsed, state.plan) + "\n\nErzeugt:\n" + written.join("\n");
                if (written.length) {
                    var first = new File(state.outputFolder.fsName + "/Ben_Yehoyada_Band_01_BILINGUAL.txt");
                    if (first.exists) { bilingualEdit.text = first.fsName; idSourceEdit.text = first.fsName; }
                }
                alert(state.plan.length + " Banddateien und Kontrolldateien wurden erzeugt.", APP_NAME);
            } catch (e) { alert("Erzeugung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };

        bilingualBtn.onClick = function () { chooseTxtInto(bilingualEdit, "Zweisprachige Banddatei wählen"); };
        batchBtn.onClick = function () { chooseTxtInto(batchEdit, "Übersetzten Batch wählen"); };
        bulkMergeSelectBtn.onClick = function () {
            try {
                var files = chooseMultipleTxtFiles("Mehrere fertige _EN_FERTIG-Batches wählen");
                if (!files.length) return;
                bulkMergeFiles = files;
                bulkMergeInfo.text = files.length + " Datei(en) ausgewählt";
                transStatus.text = bulkMergeSelectionSummary(files);
            } catch (e) { alert("Bulk-Dateiauswahl fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        exportBatchBtn.onClick = function () {
            try {
                var master = fileFromEdit(bilingualEdit, "Banddatei");
                var maxSeg = positiveInt(quotaSegments.text, 12);
                var maxChars = positiveInt(quotaChars.text, 30000);
                var result = exportNextBatch(master, maxSeg, maxChars);
                transStatus.text = result.message;
                if (result.file) batchEdit.text = result.file.fsName;
            } catch (e) { alert("Batch-Export fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        exportBulkBtn.onClick = function () {
            try {
                var master = fileFromEdit(bilingualEdit, "Banddatei");
                var maxSeg = positiveInt(quotaSegments.text, 12);
                var maxChars = positiveInt(quotaChars.text, 30000);
                var count = positiveInt(bulkCountEdit.text, 10);
                var result = exportBulkBatches(master, count, maxSeg, maxChars);
                transStatus.text = result.message;
                if (result.files && result.files.length) batchEdit.text = result.files[0].fsName;
            } catch (e) { alert("Bulk-Batch-Export fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        queueStatusBtn.onClick = function () {
            try {
                var master = fileFromEdit(bilingualEdit, "Banddatei");
                transStatus.text = batchQueueStatus(master);
            } catch (e) { alert("Queue-Status konnte nicht gelesen werden:\n\n" + errorText(e), APP_NAME); }
        };
        mergeBtn.onClick = function () {
            try {
                var master = fileFromEdit(bilingualEdit, "Banddatei");
                var batch = fileFromEdit(batchEdit, "Übersetzter Batch");
                var result = mergeBatch(master, batch);
                transStatus.text = result;
                if (idSourceEdit.text === "") idSourceEdit.text = master.fsName;
                layoutBatchEdit.text = batch.fsName;
            } catch (e) { alert("Zusammenführen fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        bulkMergeBtn.onClick = function () {
            try {
                var master = fileFromEdit(bilingualEdit, "Banddatei");
                if (!bulkMergeFiles || !bulkMergeFiles.length) throw new Error("Bitte zuerst mehrere fertige _EN_FERTIG-Dateien auswählen.");
                transStatus.text = "Bulk-Merge · alle ausgewählten Dateien werden vollständig vorgeprüft …";
                try { transStatus.window.update(); } catch (_) {}
                var preflight = preflightBulkMerge(master, bulkMergeFiles);
                var ok = confirm(bulkMergeConfirmText(preflight));
                if (!ok) { transStatus.text = "Bulk-Merge nach erfolgreicher Vorprüfung abgebrochen. Der Master wurde nicht verändert."; return; }
                transStatus.text = mergeBatchesBulk(master, bulkMergeFiles, preflight);
                if (idSourceEdit.text === "") idSourceEdit.text = master.fsName;
                bulkMergeInfo.text = bulkMergeFiles.length + " Datei(en) erfolgreich verarbeitet";
            } catch (e) { alert("Bulk-Merge fehlgeschlagen — der Master wurde vor der vollständigen Vorprüfung nicht verändert:\n\n" + errorText(e), APP_NAME); }
        };

        // ---- v2.0.18: complete volume handlers ----
        function optionalMasterFile(){
            if(!trim(bilingualEdit.text))return null;
            var f=new File(bilingualEdit.text);
            if(!f.exists)throw new Error("Der oben gewählte Band-Master wurde nicht gefunden: "+bilingualEdit.text+"\nFeld leeren, um den Komplettband ohne Master zu prüfen.");
            return f;
        }
        completeBtn.onClick = function () { chooseTxtInto(completeEdit, "Vollständig übersetzte Banddatei wählen"); };
        completeCheckBtn.onClick = function () {
            try {
                var cf = fileFromEdit(completeEdit, "Fertige Banddatei");
                var master = optionalMasterFile();
                if (master && sameFilePath(master, cf)) master = null;
                transStatus.text = "Komplettband wird vollständig geprüft …";
                try { transStatus.window.update(); } catch (_) {}
                var pf = preflightCompleteVolume(cf, master);
                transStatus.text = completeVolumeReport(pf);
            } catch (e) { alert("Komplettband-Prüfung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        completeMergeBtn.onClick = function () {
            try {
                var cf = fileFromEdit(completeEdit, "Fertige Banddatei");
                var master = fileFromEdit(bilingualEdit, "Band-Master (oben)");
                if (sameFilePath(master, cf)) throw new Error("Band-Master und Komplettband sind dieselbe Datei. Zum direkten Satz aus dieser Datei 'Als InDesign-Quelle verwenden' klicken.");
                transStatus.text = "Komplettband wird vollständig gegen den Master geprüft …";
                try { transStatus.window.update(); } catch (_) {}
                var allowReplace = !!completeReplaceCheck.value;
                var pf = preflightCompleteVolume(cf, master);
                transStatus.text = completeVolumeReport(pf);
                assertCompleteVolumeMergeable(pf, allowReplace);
                if (!confirm(completeMergeConfirmText(pf, allowReplace))) { transStatus.text = completeVolumeReport(pf) + "\r\n\r\nKomplett-Merge nach erfolgreicher Vorprüfung abgebrochen. Der Master wurde nicht verändert."; return; }
                transStatus.text = mergeCompleteVolume(master, cf, pf, allowReplace);
                idSourceEdit.text = master.fsName;
            } catch (e) { alert("Komplett-Merge fehlgeschlagen — der Master wurde nicht verändert, sofern unten nicht ausdrücklich anders gemeldet:\n\n" + errorText(e), APP_NAME); }
        };
        completeUseBtn.onClick = function () {
            try {
                var cf = fileFromEdit(completeEdit, "Fertige Banddatei");
                var pf = preflightCompleteVolume(cf, null);
                transStatus.text = completeVolumeReport(pf);
                if (pf.errors.length) throw new Error("Die Banddatei ist noch nicht vollständig satzfertig ("+pf.errors.length+" Fehler). Details stehen im Statusfeld.");
                idSourceEdit.text = cf.fsName;
                headerSourceEdit.text = cf.fsName;
                try { var _ten = inferTractateEnglish(cf, ""); if (_ten) { headerTractateEnEdit.text = _ten; var _thn = tractateHebrewForEnglish(_ten); if (_thn) headerTractateHeEdit.text = _thn; } } catch (_) {}
                transStatus.text = completeVolumeReport(pf) + "\r\n\r\nALS INDESIGN-QUELLE ÜBERNOMMEN\r\n" + cf.fsName + "\r\nWeiter in Reiter 3: 'Komplettband: neuen Band erstellen + ganzen Band angleichen'.";
                try { tabs.selection = indesignTab; } catch (_) {}
                idStatus.text = "Komplettband als Quelle übernommen: " + cf.fsName + "\r\n" + pf.segmentCount + " Segmente · " + pf.sectionCount + " Abschnitte · geschätzt ca. " + pf.estimatedPages + " Seiten.";
            } catch (e) { alert("Komplettband konnte nicht als Quelle übernommen werden:\n\n" + errorText(e), APP_NAME); }
        };

        idSourceBtn.onClick = function () { chooseTxtInto(idSourceEdit, "Zweisprachige Banddatei wählen"); };
        buildDocBtn.onClick = function () {
            try {
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                idStatus.text = "Band wird aufgebaut …";
                var result = buildVolumeDocument(src, idStatus);
                idStatus.text = result;
            } catch (e) { alert("Bandaufbau fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        updateHeBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var proceed = confirm(
                    "Der vollständige hebräische Textfluss des aktiven Bandes wird aus der gewählten Banddatei neu aufgebaut.\n\n" +
                    "Bestehende Seiten, Textrahmen, Rahmenpositionen, Verkettungen und der englische Text bleiben erhalten. " +
                    "Vor der Änderung wird automatisch eine INDD-Sicherungskopie angelegt.\n\n" +
                    "Fortfahren?"
                );
                if (!proceed) { idStatus.text = "Hebräisch-Aktualisierung abgebrochen."; return; }
                idStatus.text = updateHebrewInActiveDocument(src, idStatus);
            } catch (e) { alert("Hebräisch-Aktualisierung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        updateEnBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                idStatus.text = updateEnglishInActiveDocument(src, idStatus);
            } catch (e) { alert("Englisch-Aktualisierung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        validateBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                idStatus.text = validateActiveVolume(app.activeDocument);
            } catch (e) { alert("Prüfung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        addPagesBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var count = positiveInt(addPagesEdit.text, MANUAL_PAGE_DEFAULT);
                idStatus.text = addBilingualPagesToActiveDocument(app.activeDocument, count, idStatus);
            } catch (e) { alert("Seiten konnten nicht hinzugefügt werden:\n\n" + errorText(e), APP_NAME); }
        };
        autoFlowBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                idStatus.text = autoRepairAndExpandActiveDocument(app.activeDocument, idStatus);
            } catch (e) { alert("Automatische Übersatzbehebung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        layoutBatchBtn.onClick = function () { chooseTxtInto(layoutBatchEdit, "Fertigen Übersetzungsbatch für den Layout-Abgleich wählen"); };
        layoutBulkLoadBtn.onClick = function () {
            try {
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var mf = File.openDialog("Bulk_Set-Manifest für den InDesign-Bulk-Lauf wählen", "TSV:*.tsv");
                if (!mf) return;
                bulkLayoutGroup = loadBulkLayoutGroup(mf, src);
                layoutBulkEdit.text = mf.fsName;
                layoutBulkProgress.text = bulkLayoutGroup.items.length + " Batches · " + bulkLayoutGroup.firstId + "–" + bulkLayoutGroup.lastId;
                if (bulkLayoutGroup.items.length) layoutBatchEdit.text = bulkLayoutGroup.items[0].file.fsName;
                idStatus.text = bulkLayoutGroupSummary(bulkLayoutGroup);
            } catch (e) {
                bulkLayoutGroup = null;
                layoutBulkEdit.text = "Kein gültiges Bulk_Set-Manifest geladen";
                layoutBulkProgress.text = "Fehler";
                alert("Bulk-Gruppe konnte nicht geladen werden:\n\n" + errorText(e), APP_NAME);
            }
        };
        layoutBulkRunBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                if (!bulkLayoutGroup || !bulkLayoutGroup.manifestFile || !bulkLayoutGroup.manifestFile.exists)
                    throw new Error("Bitte zuerst über 'Bulk-Gruppe laden …' ein gültiges Bulk_Set-Manifest laden.");
                // Reload immediately before execution so Queue/Master state cannot be stale.
                bulkLayoutGroup = loadBulkLayoutGroup(bulkLayoutGroup.manifestFile, src);
                var ok = confirm(bulkLayoutConfirmText(bulkLayoutGroup, layoutLocksEdit.text, layoutFastCheck.value, false));
                if (!ok) { idStatus.text = "Bulk-Layoutlauf abgebrochen. Es wurde nichts verändert."; layoutBulkProgress.text = "Abgebrochen"; return; }
                idStatus.text = runBulkLayoutGroup(app.activeDocument, src, bulkLayoutGroup, layoutLocksEdit.text, idStatus, layoutBulkProgress, layoutFastCheck.value, {skipEnglishUpdate:false});
            } catch (e) {
                layoutBulkProgress.text = "Fehler";
                alert("Bulk-Layoutlauf fehlgeschlagen:\n\n" + errorText(e), APP_NAME);
            }
        };
        layoutBulkResumeBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                if (!bulkLayoutGroup || !bulkLayoutGroup.manifestFile || !bulkLayoutGroup.manifestFile.exists)
                    throw new Error("Bitte zuerst über 'Bulk-Gruppe laden …' ein gültiges Bulk_Set-Manifest laden.");
                bulkLayoutGroup = loadBulkLayoutGroup(bulkLayoutGroup.manifestFile, src);
                var ready = validateExistingEnglishFlowForBulkResume(app.activeDocument, src, bulkLayoutGroup);
                var ok = confirm(bulkLayoutConfirmText(bulkLayoutGroup, layoutLocksEdit.text, layoutFastCheck.value, true)+"\n\nVorprüfung vorhandener EN-Textfluss: "+ready.summary);
                if (!ok) { idStatus.text = "Bulk-Fortsetzen abgebrochen. Es wurde nichts verändert."; layoutBulkProgress.text = "Abgebrochen"; return; }
                idStatus.text = runBulkLayoutGroup(app.activeDocument, src, bulkLayoutGroup, layoutLocksEdit.text, idStatus, layoutBulkProgress, layoutFastCheck.value, {skipEnglishUpdate:true,resumeValidation:ready});
            } catch (e) {
                layoutBulkProgress.text = "Fehler";
                alert("Bulk-Fortsetzen fehlgeschlagen:\n\n" + errorText(e), APP_NAME);
            }
        };
        // v2.0.18: shared helpers for whole-volume runs (group size / resume group)
        function wholeLayoutOptions(){
            return {groupSize:boundedNumber(wholeGroupSizeEdit.text,COMPLETE_LAYOUT_GROUP_DEFAULT,1,200),
                    startGroup:Math.floor(boundedNumber(wholeStartEdit.text,1,1,99999))};
        }
        function applyWholeRunOutcome(outcome){
            if(!outcome)return;
            if(outcome.aborted&&outcome.nextSequence)wholeStartEdit.text=String(outcome.nextSequence);
            else if(outcome.success)wholeStartEdit.text="1";
        }
        function wholeLayoutConfirmText(title,src,whole,ready){
            return title+"\n\n" +
                "Band-Master: " + src.fsName + "\n" +
                "Segmente: " + whole.segmentCount + " · Layout-Gruppen gesamt: " + whole.totalGroups + " à " + whole.groupSize + " Segmente\n" +
                (whole.startGroup>1 ? "FORTSETZEN ab Gruppe " + whole.startGroup + " · in diesem Lauf: " + whole.items.length + " Gruppe(n)\n" : "") +
                "BYH-Bereich dieses Laufs: " + whole.firstId + " bis " + whole.lastId + "\n" +
                "Vorprüfung: " + ready.summary + "\n\n" +
                "Der vorhandene englische Text wird NICHT neu eingespielt. " +
                "Die Gruppen werden in BYH-Reihenfolge angeglichen; vor jeder Dokumentänderung " +
                "entsteht eine INDD-Sicherung. Daf-Synchronität, Divider-Grenzen und Übersatz " +
                "werden geprüft.\n\n" +
                "Geschützte Seiten: " + (trim(layoutLocksEdit.text) || "keine") + "\n" +
                "Modus: " + (layoutFastCheck.value ? "Schnell" : "Präzision") + "\n\nFortfahren?";
        }
        layoutWholeBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var doc = app.activeDocument;
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var opt = wholeLayoutOptions();
                var whole = prepareFullVolumeLayoutGroup(doc, src, opt.groupSize, opt.startGroup);
                var ready = validateExistingEnglishFlowForBulkResume(doc, src, whole);
                var ok = confirm(wholeLayoutConfirmText("GESAMTEN BAND ANGLEICHEN?", src, whole, ready));
                if (!ok) { idStatus.text = "Gesamtband-Abgleich abgebrochen. Das Dokument blieb unverändert."; layoutBulkProgress.text = "Abgebrochen"; return; }
                var outcome = {};
                idStatus.text = runBulkLayoutGroup(doc, src, whole, layoutLocksEdit.text, idStatus, layoutBulkProgress,
                    layoutFastCheck.value, {skipEnglishUpdate:true, resumeValidation:ready, runOutcome:outcome});
                applyWholeRunOutcome(outcome);
            } catch (e) {
                layoutBulkProgress.text = "Fehler";
                alert("Gesamtband-Abgleich fehlgeschlagen:\n\n" + errorText(e), APP_NAME);
            }
        };
        completeIdCheckBtn.onClick = function () {
            try {
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                idStatus.text = "Komplettband-Quelle wird geprüft …";
                try { idStatus.window.update(); } catch (_) {}
                idStatus.text = completeVolumeReport(preflightCompleteVolume(src, null));
            } catch (e) { alert("Komplettband-Prüfung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        completeBuildLayoutBtn.onClick = function () {
            try {
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var opt = wholeLayoutOptions();
                if (opt.startGroup > 1) throw new Error("'Start ab Gruppe' steht auf " + opt.startGroup + ". Ein Neuaufbau beginnt immer mit Gruppe 1.\nZum Fortsetzen eines abgebrochenen Laufs das bestehende Dokument öffnen und 'Ganzen Band angleichen · EN bereits vorhanden' verwenden – oder das Feld auf 1 setzen.");
                idStatus.text = "Komplettband wird vorgeprüft …";
                try { idStatus.window.update(); } catch (_) {}
                var pf = preflightCompleteVolume(src, null);
                if (pf.errors.length) { idStatus.text = completeVolumeReport(pf); throw new Error("Die Quelle ist noch nicht vollständig satzfertig (" + pf.errors.length + " Fehler). Es wurde kein Dokument angelegt. Details stehen im Statusfeld."); }
                var ok = confirm("KOMPLETTBAND AUFBAUEN UND ANGLEICHEN?\n\n" +
                    "Quelle: " + src.fsName + "\n" +
                    (pf.tractate ? "Traktat: " + pf.tractate + " · " : "") + "Band " + pad2(pf.volume || 1) + "\n" +
                    "Segmente: " + pf.segmentCount + " · Abschnitte: " + pf.sectionCount + " · geschätzt ca. " + pf.estimatedPages + " Seiten\n" +
                    "Hinweise der Vorprüfung: " + pf.warnings.length + "\n\n" +
                    "Ablauf:\n1. Neues InDesign-Dokument mit HE- und EN-Textfluss aufbauen und speichern.\n" +
                    "2. Gesamtband-Abgleich in Gruppen zu " + opt.groupSize + " Segmenten (EN wird nicht erneut eingespielt).\n" +
                    "3. INDD-Sicherung, Layout-Snapshots und Laufprotokoll wie beim Bulk-Layout.\n\n" +
                    "Geschützte Seiten: " + (trim(layoutLocksEdit.text) || "keine") + "\n" +
                    "Modus: " + (layoutFastCheck.value ? "Schnell" : "Präzision") + "\n\n" +
                    "Das kann bei einem ganzen Band lange dauern. Fortfahren?");
                if (!ok) { idStatus.text = "Komplettband-Lauf abgebrochen. Es wurde nichts angelegt."; return; }
                var outcome = {};
                idStatus.text = buildAndLayoutCompleteVolume(src, opt.groupSize, layoutLocksEdit.text, idStatus, layoutBulkProgress, layoutFastCheck.value, outcome);
                applyWholeRunOutcome(outcome);
            } catch (e) {
                layoutBulkProgress.text = "Fehler";
                alert("Komplettband-Lauf fehlgeschlagen:\n\n" + errorText(e), APP_NAME);
            }
        };
        layoutAnalyzeBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var batch = fileFromEdit(layoutBatchEdit, "Fertiger Batch");
                idStatus.text = analyzeBatchLayout(app.activeDocument, src, batch, layoutLocksEdit.text);
            } catch (e) { alert("Batch-Analyse fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        layoutApplyBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var batch = fileFromEdit(layoutBatchEdit, "Fertiger Batch");
                var preview = getBatchLayoutAnalysis(app.activeDocument, src, batch, layoutLocksEdit.text);
                var ok = confirm("Batch "+preview.firstId+" bis "+preview.lastId+" automatisch angleichen?\n\n"+
                    "Betroffene Seiten: "+formatPageList(preview.pages)+"\n"+
                    "Geschützte Seiten: "+(preview.lockedText||"keine")+"\n"+
                    "Aktuelle ID-Abweichung: "+preview.score+"\n"+
                    "HARD LIMIT: HE 111–141 mm · EN 114–144 mm · Daf-Synchronität zwingend\n\n"+
                    "Vorher werden eine INDD-Sicherung und ein Layout-Snapshot angelegt.");
                if(!ok){idStatus.text="Batch-Layout abgebrochen.";return;}
                idStatus.text = applyBatchLayoutBalance(app.activeDocument, src, batch, layoutLocksEdit.text, idStatus, preview, layoutFastCheck.value);
            } catch (e) { alert("Batch-Abgleich fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        layoutUpdateApplyBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var batch = fileFromEdit(layoutBatchEdit, "Fertiger Batch");
                var updateResult = updateEnglishInActiveDocument(src, idStatus);
                var preview = getBatchLayoutAnalysis(app.activeDocument, src, batch, layoutLocksEdit.text);
                var ok = confirm("Englisch wurde aktualisiert. Jetzt den zurückgeführten Batch "+preview.firstId+" bis "+preview.lastId+" angleichen?\n\n"+
                    "Betroffene Seiten: "+formatPageList(preview.pages)+"\nAktuelle ID-Abweichung: "+preview.score);
                if(ok) idStatus.text = updateResult+"\r\n\r\n"+applyBatchLayoutBalance(app.activeDocument, src, batch, layoutLocksEdit.text, idStatus, preview, layoutFastCheck.value);
                else idStatus.text = updateResult+"\r\n\r\nBatch-Layout wurde nicht verändert.";
            } catch (e) { alert("EN-Aktualisierung / Batch-Abgleich fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        layoutUndoBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var snap=app.activeDocument.extractLabel(DOC_LAYOUT_SNAPSHOT_LABEL);
                if(!snap)throw new Error("Für dieses Dokument ist kein letzter Batch-Snapshot gespeichert.");
                if(!confirm("Den letzten automatischen Batch-Abgleich exakt auf den gespeicherten Rahmenzustand zurücksetzen?")){idStatus.text="Rückgängig abgebrochen.";return;}
                idStatus.text=restoreLayoutSnapshot(app.activeDocument,new File(snap));
            } catch (e) { alert("Batch-Rückgängig fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };
        layoutRestoreBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var f=File.openDialog("BYH-Layout-Snapshot wählen", "TSV:*.tsv");
                if(!f)return;
                if(!confirm("Den gewählten Layout-Snapshot wiederherstellen?\n\n"+f.fsName)){idStatus.text="Snapshot-Wiederherstellung abgebrochen.";return;}
                idStatus.text=restoreLayoutSnapshot(app.activeDocument,f);
            } catch (e) { alert("Snapshot-Wiederherstellung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };

        layoutResetBtn.onClick = function () {
            try {
                if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
                var src = fileFromEdit(idSourceEdit, "Banddatei");
                var batch = fileFromEdit(layoutBatchEdit, "Fertiger Batch");
                var preview = getBatchLayoutAnalysis(app.activeDocument, src, batch, layoutLocksEdit.text);
                if(!confirm("Die Batch-Seiten "+formatPageList(preview.pages)+" auf die Produktions-Standardtrennung 126,00 / 129,00 mm zurücksetzen?\n\n"+
                    "Geschützte Seiten bleiben unverändert. Vorher werden INDD-Sicherung und Snapshot angelegt.\n\n"+
                    "Diese Funktion ist vor allem dafür gedacht, falsche Rahmenänderungen aus v1.0.9–v1.0.11 sauber zu neutralisieren.")){
                    idStatus.text="Standard-Rücksetzung abgebrochen.";return;
                }
                idStatus.text=resetBatchPagesToStandard(app.activeDocument,src,batch,layoutLocksEdit.text,idStatus);
            } catch (e) { alert("Standard-Rücksetzung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };

        function currentHeaderConfig(){
            var cfg={};
            cfg.workEn=trim(headerWorkEnEdit.text)||"BEN YEHOYADA";
            cfg.workHe=trim(headerWorkHeEdit.text)||"בן יהוידע";
            cfg.tractateEn=trim(headerTractateEnEdit.text);
            cfg.tractateHe=trim(headerTractateHeEdit.text);
            cfg.templateEn=trim(headerTemplateEnEdit.text)||"{WORK} · {TRACTATE} · {DAF}";
            cfg.templateHe=trim(headerTemplateHeEdit.text)||"{WORK} · {TRACTATE} · {DAF}";
            cfg.enSize=positiveNumber(headerEnSizeEdit.text,HEADER_EN_SIZE);
            cfg.heSize=positiveNumber(headerHeSizeEdit.text,HEADER_HE_SIZE);
            cfg.tracking=signedNumber(headerTrackingEdit.text,HEADER_EN_TRACKING);
            cfg.tint=boundedNumber(headerTintEdit.text,HEADER_TINT,10,100);
            return cfg;
        }
        function currentHeaderSource(){
            var f=null,p="";
            if(trim(headerSourceEdit.text)){f=new File(headerSourceEdit.text);if(f.exists)return f;}
            try{if(app.documents.length)p=app.activeDocument.extractLabel(DOC_SOURCE_LABEL)||"";}catch(_){p="";}
            if(p){f=new File(p);if(f.exists){headerSourceEdit.text=f.fsName;return f;}}
            throw new Error("Keine gültige BILINGUAL.txt für die Kopfzeilen gewählt. Bitte Datei auswählen oder 'Quelle aus Dokument' verwenden.");
        }
        function inferHeaderNames(){
            var f=currentHeaderSource(),cfg=currentHeaderConfig(),en=inferTractateEnglish(f,""),he;
            if(en)headerTractateEnEdit.text=en;
            he=tractateHebrewForEnglish(en||cfg.tractateEn);
            if(he)headerTractateHeEdit.text=he;
            headerStatus.text="Traktat erkannt: "+(en||"nicht erkannt")+(he?" · "+he:"")+"\r\nQuelle: "+f.fsName;
        }
        headerSourceBtn.onClick=function(){
            try{var f=File.openDialog("BILINGUAL.txt für Kopfzeilen wählen","Text:*.txt");if(f){headerSourceEdit.text=f.fsName;inferHeaderNames();}}catch(e){alert("Kopfzeilenquelle konnte nicht gewählt werden:\n\n"+errorText(e),APP_NAME);}
        };
        headerUseDocSourceBtn.onClick=function(){
            try{
                if(!app.documents.length)throw new Error("Kein InDesign-Dokument geöffnet.");
                var p=app.activeDocument.extractLabel(DOC_SOURCE_LABEL)||"";if(!p)throw new Error("Im aktiven Dokument ist keine BILINGUAL-Quelle gespeichert.");
                var f=new File(p);if(!f.exists)throw new Error("Die gespeicherte Quelle wurde nicht gefunden: "+p);
                headerSourceEdit.text=f.fsName;inferHeaderNames();
            }catch(e){alert("Dokumentquelle konnte nicht übernommen werden:\n\n"+errorText(e),APP_NAME);}
        };
        headerInferBtn.onClick=function(){try{inferHeaderNames();}catch(e){alert("Traktat-Erkennung fehlgeschlagen:\n\n"+errorText(e),APP_NAME);}};
        headerAnalyzeBtn.onClick=function(){
            try{if(!app.documents.length)throw new Error("Kein InDesign-Dokument geöffnet.");var f=currentHeaderSource(),cfg=currentHeaderConfig();completeHeaderTractateConfig(cfg,f);headerStatus.text=analyzeRunningHeaders(app.activeDocument,f,cfg);}
            catch(e){alert("Kopfzeilenanalyse fehlgeschlagen:\n\n"+errorText(e),APP_NAME);}
        };
        headerTestBtn.onClick=function(){
            try{if(!app.documents.length)throw new Error("Kein InDesign-Dokument geöffnet.");var f=currentHeaderSource(),cfg=currentHeaderConfig();completeHeaderTractateConfig(cfg,f);headerStatus.text=applyRunningHeaders(app.activeDocument,f,cfg,true,false);}
            catch(e){alert("Kopfzeilen-Test fehlgeschlagen:\n\n"+errorText(e),APP_NAME);}
        };
        headerApplyBtn.onClick=function(){
            try{if(!app.documents.length)throw new Error("Kein InDesign-Dokument geöffnet.");var f=currentHeaderSource(),cfg=currentHeaderConfig();completeHeaderTractateConfig(cfg,f);
                if(!confirm("Alle Kopfzeilen anhand des AKTUELLEN Seitenflusses erstellen/aktualisieren?\n\nEmpfohlen erst nach Übersetzung und endgültigem HE/EN-Abgleich.\nVorher wird automatisch eine INDD-Sicherung angelegt.")){headerStatus.text="Kopfzeilenlauf abgebrochen.";return;}
                headerStatus.text=applyRunningHeaders(app.activeDocument,f,cfg,false,true);}
            catch(e){alert("Kopfzeilen konnten nicht erstellt werden:\n\n"+errorText(e),APP_NAME);}
        };
        headerValidateBtn.onClick=function(){
            try{if(!app.documents.length)throw new Error("Kein InDesign-Dokument geöffnet.");var f=currentHeaderSource(),cfg=currentHeaderConfig();completeHeaderTractateConfig(cfg,f);headerStatus.text=validateRunningHeaders(app.activeDocument,f,cfg);}
            catch(e){alert("Kopfzeilenprüfung fehlgeschlagen:\n\n"+errorText(e),APP_NAME);}
        };
        headerRemoveBtn.onClick=function(){
            try{if(!app.documents.length)throw new Error("Kein InDesign-Dokument geöffnet.");
                if(!confirm("Nur die vom Book Manager erzeugten Kopfzeilen entfernen?\n\nSeitenzahlen, Haarlinie und HE-/EN-Textrahmen bleiben unverändert.\nVorher wird eine INDD-Sicherung angelegt.")){headerStatus.text="Kopfzeilen-Rückbau abgebrochen.";return;}
                headerStatus.text=removeRunningHeaders(app.activeDocument,true);}
            catch(e){alert("Kopfzeilen konnten nicht entfernt werden:\n\n"+errorText(e),APP_NAME);}
        };

        try{
            if(app.documents.length){
                var _hp=app.activeDocument.extractLabel(DOC_SOURCE_LABEL)||"";
                if(_hp&&new File(_hp).exists){headerSourceEdit.text=_hp;var _he=inferTractateEnglish(new File(_hp),"");if(_he){headerTractateEnEdit.text=_he;var _hh=tractateHebrewForEnglish(_he);if(_hh)headerTractateHeEdit.text=_hh;}}
                var _te=app.activeDocument.extractLabel(DOC_HEADER_TRACTATE_EN)||"";if(_te)headerTractateEnEdit.text=_te;
                var _th=app.activeDocument.extractLabel(DOC_HEADER_TRACTATE_HE)||"";if(_th)headerTractateHeEdit.text=_th;
                var _tpe=app.activeDocument.extractLabel(DOC_HEADER_TEMPLATE_EN)||"";if(_tpe)headerTemplateEnEdit.text=_tpe;
                var _tph=app.activeDocument.extractLabel(DOC_HEADER_TEMPLATE_HE)||"";if(_tph)headerTemplateHeEdit.text=_tph;
            }
        }catch(_headerInit){}

        w.onClose = function () { try { $.global.__BYH_BILINGUAL_BOOK_MANAGER_V212__ = null; } catch (_) {} };
        w.center();
        w.show();
    }

    function helpText() {
        return "BEN YEHOYADA · FESTER ARBEITSABLAUF\r\r" +
            "FARBLOGIK DER OBERFLÄCHE\r" +
            "BLAU = Projekt, Band und InDesign-Grundfunktionen.\r" +
            "GRÜN = kompletter Einzelbatch-Ablauf von Export über Merge bis Layout.\r" +
            "MAGENTA = kompletter Bulk-Ablauf von Export über Bulk-Merge bis Bulk-Layout.\r" +
            "ORANGE = Sicherheit, Rückgängig und Reparatur.\r" +
            "PETROL = Komplettband: eine vollständig übersetzte Banddatei als Ganzes – ohne Batches (v2.0.18).\r" +
            "Wenn der Mauszeiger über einem Button oder wichtigen Feld steht, erscheint eine kurze Funktionsbeschreibung.\r\r" +
            "1. Im ersten Reiter die vollständige hebräische TXT und einen Projektordner wählen.\r" +
            "2. Analysieren. Das Skript nummeriert Absätze stabil, plant so viele Bände wie nötig und hält 600 Seiten als absolute Grenze ein.\r" +
            "3. Banddateien erzeugen. Jede Banddatei enthält <segment>-Blöcke mit unverändertem <he>-Text und zunächst leerem <en>-Feld.\r" +
            "4. Im zweiten Reiter Einzelbatches oder mehrere getrennte Translation-Batches als Bulk-Gruppe exportieren. Der Bulk-Export liest den Master nur einmal, führt einen internen Cursor und reserviert exportierte IDs in einer BatchQueue.tsv, damit sie bis zur Rückführung nicht doppelt exportiert werden. Zu jeder Bulk-Gruppe entsteht zusätzlich ein Bulk_Set-Manifest.\r" +
            "5. Im übersetzten Batch ausschließlich leere <en_title>-, <en>- und <band_en>-Felder füllen. IDs, Attribute, <he_title>, <he>, <band_he> und Tags unverändert lassen. Ein bereits gefülltes <band_en> bleibt ebenfalls unverändert.\r" +
            "6. Rückführung: Ein Einzelbatch kann wie bisher separat zusammengeführt werden. Für mehrere _EN_FERTIG-Dateien steht der gemeinsame Bulk-Merge zur Verfügung. Dabei werden zuerst ausnahmslos alle ausgewählten Dateien einschließlich <band_en> geprüft; bei irgendeinem Fehler bleibt der Master unverändert. Erst nach vollständig erfolgreicher Vorprüfung wird genau eine Master-Sicherung erzeugt, alle geprüften <en>- und <band_en>-Texte werden im Speicher nach BYH-ID eingesetzt und der Band-Master wird genau einmal geschrieben. Danach werden die zugehörigen Queue-Einträge gemeinsam auf MERGED gesetzt.\r" +
            "7. Im dritten Reiter einen neuen InDesign-Band erstellen oder die hebräische beziehungsweise englische Hälfte eines offenen Bandes aktualisieren.\r" +
            "   Vor einer hebräischen Aktualisierung legt das Skript automatisch eine INDD-Sicherungskopie an; vorhandene Seiten und Rahmen bleiben erhalten.\r" +
            "8. Nach einem zurückgeführten Einzelbatch kann im Bereich Batch-Layout derselbe _EN_FERTIG-Batch gewählt werden. 'Batch analysieren' verändert nichts; 'Automatisch angleichen' arbeitet ab v1.0.12 an den Seiten-Grenzen mit einem deterministischen Solver. Primär wird dieselbe BYH-ID am unteren HE-/EN-Rahmenrand angestrebt, sekundär der normalisierte Fortschritt über die tatsächlich gesetzten Zeilen des Segments. Gleich gute Lösungen werden möglichst nahe an der Produktions-Standardtrennung 126,00/129,00 mm gehalten. Geschützte Seiten bleiben unverändert.\r" +
            "9. Für eine bereits gemeinsam zurückgeführte Bulk-Gruppe im InDesign-Reiter das zugehörige Bulk_Set-Manifest laden. Für einen FRISCHEN Lauf aktualisiert 'Bulk: EN 1× aktualisieren + alle angleichen' den vollständigen englischen Textfluss genau EINMAL. Wurde Englisch bereits durch einen vorherigen Bulk-Lauf korrekt eingespielt, verwendet v2.0.11 stattdessen 'Bulk fortsetzen · EN nicht neu einspielen': der vorhandene EN-Textfluss wird streng gegen Master-Reihenfolge und Bulk-Bereich geprüft und danach ohne erneuten Textaufbau angeglichen. Vor jedem Batch werden dessen Seiten nach dem aktuellen Textfluss neu lokalisiert und analysiert. Jeder Daf-Titel ist ein eigener HE/EN-Anker; v2.0.11 erkennt dabei gerade/typografische Anführungszeichen und hebräische Gershayim tolerant, sodass vorhandene Titel nicht fälschlich als fehlend gelten. Ein neuer Daf darf nicht auf einer Sprache eine physische Seite früher beginnen als auf der anderen. Der Divider wird dafür kontrolliert in 0,5-mm-Schritten nachgeführt, ohne den stabilen BYH-ID-Abstand zu verschlechtern. Kopfbänder bleiben vollständig zusammen; Daf-Titel werden mit dem folgenden Kopfband zusammengehalten. Während des Laufs wird der Fortschritt angezeigt. Entsteht durch eine Layoutänderung HE- oder EN-Übersatz, ergänzt der Bulk-Modus zunächst automatisch vollständige zweisprachige Seiten mit verketteten HE-/EN-Rahmen und komponiert neu. Bei einem nicht sicher lösbaren Layoutzustand oder an der harten 600-Seiten-Grenze wird die gerade getestete Batch-Geometrie zurückgesetzt und der Bulk-Lauf gestoppt. Für den gesamten Bulk-Lauf entsteht eine gemeinsame INDD-Sicherung, pro Batch weiterhin ein Layout-Snapshot sowie abschließend ein dauerhaftes Bulk-Layout-Laufprotokoll.\r\r" +
            "KOMPLETTBAND STATT BATCHES (v2.0.18)\r" +
            "Liegt ein Band bereits vollständig übersetzt vor (eine <book>-Datei mit allen Segmenten, z. B. Ben_Yehoyada_Shabbat_Band_01_BILINGUAL_EN_FERTIG.txt), sind Batch-Export, Bulk-Merge und Bulk_Set nicht nötig:\r" +
            "K1. Reiter 2 · KOMPLETTBAND: fertige Banddatei wählen und 'Komplettband prüfen'. Geprüft werden alle <en>, <en_title> und <band_en>, Lemma und Kopfband, Auslassungszeichen, Tag-Paare (<fn>, <lemma>, <b> …), Segmentzahl, ID-Reihenfolge, Daf-Titel und die geschätzte Seitenzahl. ALLE Fehler werden gesammelt aufgelistet; es wird nichts geschrieben. Ist oben ein Band-Master gewählt, wird zusätzlich jedes Segment gegen ihn verglichen (IDs, Reihenfolge, n/daf/ref, <he_title>, <he>, <band_he>).\r" +
            "K2a. Mit vorhandenem Master: 'In Band-Master übernehmen' setzt die komplette Übersetzung atomar ein – genau eine Master-Sicherung, genau ein Schreibvorgang, offene Queue-Einträge werden MERGED. Abweichende bereits vorhandene Übersetzungen werden nur ersetzt, wenn das Kästchen dafür ausdrücklich aktiviert ist.\r" +
            "K2b. Ohne Master: 'Als InDesign-Quelle verwenden' übernimmt die geprüfte Datei direkt als Quelle für Reiter 3 und 4. Es wird keine Datei verändert.\r" +
            "K3. Reiter 3 · KOMPLETTBAND: 'Komplettband: neuen Band erstellen + ganzen Band angleichen'. Das Skript prüft die Quelle, baut den InDesign-Band mit HE und EN auf, speichert ihn und gleicht danach alle Segmente in Layout-Gruppen (Standard 12 Segmente) an – mit denselben Sicherungen wie der Bulk-Lauf: INDD-Sicherung, Snapshots, Divider-HARD-LIMIT, Daf-Synchronität, automatische Übersatzbehebung und Laufprotokoll.\r" +
            "K4. Bricht der Abgleich aus Sicherheitsgründen ab, trägt das Skript die Fortsetzungsgruppe in 'Start ab Gruppe' ein. Nach Prüfung im selben Dokument 'Ganzen Band angleichen · EN bereits vorhanden' klicken; bereits angeglichene Gruppen bleiben unverändert.\r" +
            "K5. Danach wie gewohnt Kopfzeilen in Reiter 4. Das Traktat wird aus dem tractate-Attribut der Banddatei erkannt.\r\r" +
            "10. KOPFZEILEN: Erst NACH abgeschlossener Übersetzung, einmaliger EN-Aktualisierung und endgültigem HE/EN-Abgleich in Reiter 4 wechseln. Quelle prüfen, Traktat automatisch erkennen oder eintragen, 'Kopfzeilen analysieren', die aktuelle Doppelseite testen und danach alle Kopfzeilen erstellen/aktualisieren. Vor PDF/KDP nochmals 'Kopfzeilen prüfen'. Linke Seiten sind standardmäßig Englisch, rechte Seiten Hebräisch. Die Daf-Zuordnung wird aus dem tatsächlich gesetzten hebräischen Seitenfluss ermittelt.\r\r" +
            "SEITENGRENZE\r\r" +
            "Geplant wird auf " + TARGET_PAGES + " Seiten einschließlich " + RESERVED_PAGES + " Reserveseiten. " +
            "Beim Aufbau und bei Aktualisierungen repariert das Skript unterbrochene HE/EN-Textketten automatisch und fügt bei echtem Übersatz weitere vollständig eingerichtete Seiten hinzu. " +
            "Im InDesign-Reiter können zusätzlich beliebig viele Seiten mit beiden verketteten Textrahmen angefügt oder vorhandener Übersatz sofort repariert werden. " +
            "Bei 600 physischen Seiten stoppt das Skript zwingend. Kein Segment wird automatisch zerschnitten.";
    }

    // ---------------- Source parsing and stable IDs ----------------

    function parseHebrewSource(raw) {
        raw = normalizeNewlines(stripBom(String(raw || "")));
        var blocks = splitBlocks(raw);
        if (!blocks.length) throw new Error("Die TXT enthält keinen Text.");

        // Sefaria/Wikisource metadata commonly occupies the first block.
        if (/https?:\/\/|\bmerged\b|This file contains/i.test(blocks[0])) blocks.shift();

        var sections = [], current = null, pendingChapter = null;
        var globalNo = 0, localNo = 0, i, b, heading;

        function ensureSection(title) {
            current = {title: title || "Ohne Abschnitt", order: sections.length + 1, segments: []};
            sections.push(current);
            localNo = 0;
        }

        for (i = 0; i < blocks.length; i++) {
            b = trim(blocks[i]);
            if (!b) continue;

            var chapterMatch = /^Chapter\s+([0-9]+)\s*$/i.exec(stripTags(b));
            if (chapterMatch) {
                pendingChapter = parseInt(chapterMatch[1], 10);
                continue;
            }

            heading = isHeadingBlock(b, pendingChapter !== null);
            if (heading) {
                ensureSection(stripTags(b));
                pendingChapter = null;
                continue;
            }

            if (!current) ensureSection("הקדמה");
            if (pendingChapter !== null) {
                localNo = pendingChapter;
                pendingChapter = null;
            } else {
                localNo++;
            }
            globalNo++;
            current.segments.push({
                id: stableId(globalNo),
                globalNo: globalNo,
                number: localNo,
                sectionOrder: current.order,
                section: current.title,
                he: b,
                en: ""
            });
        }

        // Remove empty headings while preserving their title as prefix to the next section.
        var clean = [], carry = [], s, title;
        for (i = 0; i < sections.length; i++) {
            s = sections[i];
            if (!s.segments.length) { carry.push(s.title); continue; }
            title = carry.length ? carry.join(" · ") + " · " + s.title : s.title;
            s.title = title;
            for (var j = 0; j < s.segments.length; j++) s.segments[j].section = title;
            clean.push(s); carry = [];
        }
        if (!clean.length) throw new Error("Es wurden keine übersetzbaren Absätze erkannt.");

        return {sections: clean, segmentCount: globalNo, rawChars: raw.length};
    }

    function isHeadingBlock(block, followsChapter) {
        if (followsChapter) return false;
        var t = trim(stripTags(block));
        if (!t || t.length > 90) return false;
        if (/^https?:\/\//i.test(t)) return false;
        if (/[.!?;:]\s*$/.test(t)) return false;
        if (block.indexOf("\n") >= 0) return false;
        if (/<b\b/i.test(block)) return false;
        var words = t.split(/\s+/).length;
        if (words > 12) return false;
        // Known structural labels and short isolated Hebrew titles.
        if (/^(הקדמה|פתיחה|דרשות|הלכות|הלכות\s+שנה|שנה\s+ראשונה|שנה\s+שניה|בן איש חי)/.test(t)) return true;
        return t.length <= 45;
    }

    function splitBlocks(raw) {
        var arr = raw.split(/\n[\t ]*\n+/), out = [], i, j, t, lines;
        var numberedHalakha = false;
        for (i = 0; i < arr.length; i++) {
            t = trim(arr[i].replace(/\n+/g, "\n"));
            if (!t) continue;

            // The merged source uses one physical line per paragraph in the
            // introduction and derashot, but not always an empty line between
            // consecutive paragraphs.  In the numbered Halakha portion,
            // however, a Chapter block may intentionally contain several
            // physical lines and must remain one translation segment.
            if (/^הלכות\s+שנה\b/.test(stripTags(t))) numberedHalakha = true;
            if (i === 0 || numberedHalakha || /^Chapter\s+[0-9]+\s*$/i.test(stripTags(t))) {
                out.push(t);
            } else {
                lines = t.split("\n");
                for (j = 0; j < lines.length; j++) {
                    lines[j] = trim(lines[j]);
                    if (lines[j]) out.push(lines[j]);
                }
            }
        }
        return out;
    }

    function stableId(n) {
        var s = String(n);
        while (s.length < 7) s = "0" + s;
        return "BYH-" + s;
    }

    // ---------------- Volume planning ----------------

    function planVolumes(parsed) {
        var groups = [], i, s, chunks, j;
        for (i = 0; i < parsed.sections.length; i++) {
            s = parsed.sections[i];
            chunks = splitOversizeSection(s);
            for (j = 0; j < chunks.length; j++) groups.push(chunks[j]);
        }

        var volumes = [], current = newVolume(1), g;
        for (i = 0; i < groups.length; i++) {
            g = groups[i];
            if (current.segments.length && estimatedBodyPages(current.heChars + g.heChars) > BODY_TARGET) {
                finalizeVolume(current); volumes.push(current); current = newVolume(volumes.length + 1);
            }
            addGroupToVolume(current, g);
        }
        if (current.segments.length) { finalizeVolume(current); volumes.push(current); }

        for (i = 0; i < volumes.length; i++) {
            if (volumes[i].estimatedPages > TARGET_PAGES) {
                throw new Error("Band " + (i + 1) + " überschreitet schon in der Planung " + TARGET_PAGES + " Seiten.");
            }
        }
        return volumes;
    }

    function splitOversizeSection(section) {
        var out = [], current = {title: section.title, part: 1, segments: [], heChars: 0};
        var i, seg, next;
        for (i = 0; i < section.segments.length; i++) {
            seg = section.segments[i];
            next = current.heChars + visibleLength(seg.he);
            if (current.segments.length && estimatedBodyPages(next) > BODY_TARGET) {
                out.push(current);
                current = {title: section.title, part: current.part + 1, segments: [], heChars: 0};
            }
            current.segments.push(seg);
            current.heChars += visibleLength(seg.he);
        }
        if (current.segments.length) out.push(current);
        return out;
    }

    function newVolume(n) {
        return {number:n, groups:[], segments:[], heChars:0, estimatedEnChars:0, estimatedBodyPages:0, estimatedPages:0};
    }

    function addGroupToVolume(v, g) {
        v.groups.push(g);
        for (var i = 0; i < g.segments.length; i++) v.segments.push(g.segments[i]);
        v.heChars += g.heChars;
    }

    function finalizeVolume(v) {
        v.estimatedEnChars = Math.ceil(v.heChars * EN_EXPANSION);
        v.estimatedBodyPages = estimatedBodyPages(v.heChars);
        v.estimatedPages = v.estimatedBodyPages + RESERVED_PAGES;
    }

    function estimatedBodyPages(heChars) {
        var hePages = heChars / HE_CHARS_PER_PAGE;
        var enPages = (heChars * EN_EXPANSION) / EN_CHARS_PER_PAGE;
        return Math.ceil(Math.max(hePages, enPages));
    }

    function planSummary(parsed, plan) {
        var out = [];
        out.push("Quelle: " + parsed.segmentCount + " Segmente · " + parsed.sections.length + " Abschnitte · " + parsed.rawChars + " Zeichen");
        out.push("Kalibrierung: HE " + HE_CHARS_PER_PAGE + " Zeichen/Seite · EN " + EN_CHARS_PER_PAGE +
            " Zeichen/Seite · erwartete EN-Länge " + EN_EXPANSION.toFixed(2) + " × HE");
        out.push("Plan: " + plan.length + " Bände · Ziel " + TARGET_PAGES + " · absolute Grenze " + MAX_PAGES);
        out.push("");
        for (var i = 0; i < plan.length; i++) {
            var v = plan[i], first = v.segments[0], last = v.segments[v.segments.length - 1];
            out.push("Band " + pad2(v.number) + ": ca. " + v.estimatedPages + " Seiten (davon " + RESERVED_PAGES +
                " Reserve) · " + v.segments.length + " Segmente · " + first.id + " bis " + last.id);
            out.push("    " + first.section + "  →  " + last.section);
        }
        return out.join("\r");
    }

    // ---------------- Project and bilingual files ----------------

    function writeProjectFiles(parsed, plan, folder) {
        if (!folder.exists && !folder.create()) throw new Error("Projektordner konnte nicht erstellt werden.");
        var written = [], manifest = ["volume\tsegment_id\tvisible_number\tsection\the_chars\tstatus"];
        var i, j, v, f, text, seg;
        // Never overwrite a bilingual master file: it may already contain translations.
        for (i = 0; i < plan.length; i++) {
            f = new File(folder.fsName + "/Ben_Yehoyada_Band_" + pad2(plan[i].number) + "_BILINGUAL.txt");
            if (f.exists) throw new Error("Abbruch ohne Überschreiben: Diese Banddatei existiert bereits:\n" + f.fsName + "\nBitte einen neuen Projektordner wählen.");
        }
        for (i = 0; i < plan.length; i++) {
            v = plan[i];
            text = serializeVolume(v);
            f = new File(folder.fsName + "/Ben_Yehoyada_Band_" + pad2(v.number) + "_BILINGUAL.txt");
            writeUTF8(f, text);
            written.push(f.name);
            for (j = 0; j < v.segments.length; j++) {
                seg = v.segments[j];
                manifest.push(v.number + "\t" + seg.id + "\t" + seg.number + "\t" + tsv(seg.section) + "\t" + visibleLength(seg.he) + "\toffen");
            }
        }
        f = new File(folder.fsName + "/Ben_Ish_Chai_Bandplan.txt");
        writeUTF8(f, planSummary(parsed, plan)); written.push(f.name);
        f = new File(folder.fsName + "/Ben_Ish_Chai_Segmentkontrolle.tsv");
        writeUTF8(f, manifest.join("\r\n")); written.push(f.name);
        return written;
    }

    function serializeVolume(v) {
        var out = [];
        out.push("<book project=\"Ben Yehoyada\" volume=\"" + pad2(v.number) + "\" max_pages=\"" + MAX_PAGES + "\">");
        out.push("<planning estimated_pages=\"" + v.estimatedPages + "\" target_pages=\"" + TARGET_PAGES + "\" reserved_pages=\"" + RESERVED_PAGES + "\" />");
        var lastSection = null, i, seg;
        for (i = 0; i < v.segments.length; i++) {
            seg = v.segments[i];
            if (seg.section !== lastSection) {
                out.push("");
                out.push("<section>");
                out.push("<he_title>" + xmlEscape(seg.section) + "</he_title>");
                out.push("<en_title></en_title>");
                out.push("</section>");
                lastSection = seg.section;
            }
            out.push("");
            out.push("<segment id=\"" + seg.id + "\" n=\"" + seg.number + "\">");
            out.push("<he>" + protectCdata(seg.he) + "</he>");
            out.push("<en></en>");
            out.push("</segment>");
        }
        out.push("");
        out.push("</book>");
        return out.join("\r\n");
    }

    function parseBilingualFile(raw) {
        raw = normalizeNewlines(stripBom(String(raw || "")));
        var volume = 0, m = /<book\b[^>]*\bvolume=["']([0-9]+)["'][^>]*>/i.exec(raw);
        if (m) volume = parseInt(m[1], 10);
        // v2.0.18: keep the optional tractate attribute of a complete volume file
        var tractate = "", tm = /<book\b[^>]*\btractate=["']([^"']*)["'][^>]*>/i.exec(raw);
        if (tm) tractate = trim(xmlUnescape(tm[1]));

        var events = [], sections = [], segments = [], secRe = /<section>\s*<he_title>([\s\S]*?)<\/he_title>\s*<en_title>([\s\S]*?)<\/en_title>\s*<\/section>/ig;
        // v2.0.0: a segment now carries the Talmud band as well. Parsing the
        // block first and then each field separately is more forgiving than one
        // long regex - a missing optional field no longer kills the whole match.
        var segRe = /<segment\b([^>]*)>([\s\S]*?)<\/segment>/ig;
        var sm, gm;
        function segField(body,name){
            var m = new RegExp("<"+name+">([\\s\\S]*?)<\\/"+name+">","i").exec(body);
            return m ? m[1] : "";
        }
        while ((sm = secRe.exec(raw)) !== null) {
            events.push({index:sm.index, type:"section", he:restoreCdata(xmlUnescape(sm[1])), en:restoreCdata(xmlUnescape(sm[2]))});
        }
        while ((gm = segRe.exec(raw)) !== null) {
            var attrs = gm[1], body = gm[2];
            var idM = /\bid=["']([^"']+)["']/.exec(attrs);
            var nM  = /\bn=["']([0-9]+)["']/.exec(attrs);
            if (!idM || !nM) continue;
            var dafM = /\bdaf=["']([^"']*)["']/.exec(attrs);
            var refM = /\bref=["']([^"']*)["']/.exec(attrs);
            events.push({index:gm.index, type:"segment", id:idM[1], number:parseInt(nM[1],10),
                         daf:(dafM?dafM[1]:""), ref:(refM?refM[1]:""),
                         bandHe:restoreCdata(segField(body,"band_he")),
                         bandEn:restoreCdata(segField(body,"band_en")),
                         he:restoreCdata(segField(body,"he")),
                         en:restoreCdata(segField(body,"en"))});
        }
        events.sort(function(a,b){return a.index-b.index;});
        var currentSection = {he:"",en:"",order:-1}, seen = {}, i, e;
        for (i=0;i<events.length;i++) {
            e=events[i];
            if(e.type==="section") { currentSection={he:e.he,en:e.en,order:sections.length}; sections.push(currentSection); }
            else {
                if(seen[e.id]) throw new Error("Doppelte Segment-ID: "+e.id);
                seen[e.id]=true; e.sectionHe=currentSection.he; e.sectionEn=currentSection.en; e.sectionOrder=currentSection.order; segments.push(e);
            }
        }
        if(!segments.length) throw new Error("Keine <segment>-Blöcke erkannt.");
        return {volume:volume,tractate:tractate,events:events,sections:sections,segments:segments,raw:raw};
    }

    // ---------------- Translation batches ----------------

    function exportNextBatch(masterFile, maxSegments, maxChars) {
        var p=parseBilingualFile(readUTF8(masterFile));
        var queue=loadBatchQueue(masterFile,p);
        normalizeBatchQueue(queue,p);
        var reserved=reservedQueueIds(queue,p),cursor={index:0},chosen=takeNextBatchAtCursor(p,cursor,reserved,maxSegments,maxChars);
        if(!chosen.segments.length){
            saveBatchQueue(queue,masterFile,p);
            return {file:null,message:"Keine exportierbaren Segmente mehr vorhanden. Offene, bereits exportierte Queue-Bereiche werden nicht doppelt ausgegeben.\r\n\r\n"+batchQueueSummary(masterFile,p,queue)};
        }
        var f=writeTranslationBatch(p,chosen.segments,masterFile.parent,true);
        var bulkId="SINGLE-"+pad2(p.volume||1)+"-"+timestamp();
        addQueueRecord(queue,{status:"EXPORTED",bulkId:bulkId,sequence:1,firstId:chosen.segments[0].id,lastId:chosen.segments[chosen.segments.length-1].id,
            segmentCount:chosen.segments.length,heChars:chosen.chars,batchFile:f.fsName,exportedAt:timestamp(),mergedAt:"",mergedFile:""});
        queue.cursorId=chosen.segments[chosen.segments.length-1].id;
        saveBatchQueue(queue,masterFile,p);
        return {file:f,message:"Batch erzeugt: "+f.fsName+"\r\n"+chosen.segments.length+" Segmente · "+chosen.chars+" hebräische Zeichen · "+chosen.segments[0].id+" bis "+chosen.segments[chosen.segments.length-1].id+"\r\n\r\n"+batchQueueSummary(masterFile,p,queue)};
    }

    function exportBulkBatches(masterFile,count,maxSegments,maxChars){
        var p=parseBilingualFile(readUTF8(masterFile));
        var queue=loadBatchQueue(masterFile,p);
        normalizeBatchQueue(queue,p);
        var reserved=reservedQueueIds(queue,p),cursor={index:0},files=[],rows=[],i,chosen,f;
        var bulkId="BULK-"+pad2(p.volume||1)+"-"+timestamp();
        var cursorStart="",cursorEnd="";
        for(i=1;i<=count;i++){
            chosen=takeNextBatchAtCursor(p,cursor,reserved,maxSegments,maxChars);
            if(!chosen.segments.length)break;
            if(!cursorStart)cursorStart=chosen.segments[0].id;
            cursorEnd=chosen.segments[chosen.segments.length-1].id;
            f=writeTranslationBatch(p,chosen.segments,masterFile.parent,(i===1));
            files.push(f);
            rows.push({sequence:i,firstId:chosen.segments[0].id,lastId:chosen.segments[chosen.segments.length-1].id,segmentCount:chosen.segments.length,heChars:chosen.chars,batchFile:f.fsName,status:"EXPORTED"});
            addQueueRecord(queue,{status:"EXPORTED",bulkId:bulkId,sequence:i,firstId:chosen.segments[0].id,lastId:chosen.segments[chosen.segments.length-1].id,
                segmentCount:chosen.segments.length,heChars:chosen.chars,batchFile:f.fsName,exportedAt:timestamp(),mergedAt:"",mergedFile:""});
            reserveChosenIds(reserved,chosen.segments);
        }
        if(!files.length){
            saveBatchQueue(queue,masterFile,p);
            return {files:[],manifest:null,message:"Bulk-Export: Keine neuen Segmente verfügbar. Offene, bereits exportierte Queue-Bereiche werden nicht doppelt ausgegeben.\r\n\r\n"+batchQueueSummary(masterFile,p,queue)};
        }
        queue.cursorId=cursorEnd;
        var manifest=writeBulkManifest(masterFile,p,bulkId,count,maxSegments,maxChars,cursorStart,cursorEnd,rows);
        queue.lastManifest=manifest.fsName;
        saveBatchQueue(queue,masterFile,p);
        var out=[];
        out.push("BULK-EXPORT ABGESCHLOSSEN");
        out.push("Bulk-ID: "+bulkId);
        out.push("Erzeugte Batch-Dateien: "+files.length+" / angefordert "+count);
        out.push("Grenzen je Datei: höchstens "+maxSegments+" Segmente · höchstens "+maxChars+" hebräische Zeichen");
        out.push("Cursor: "+cursorStart+" → "+cursorEnd);
        out.push("Manifest: "+manifest.fsName);
        out.push("Queue: "+batchQueueFile(masterFile).fsName);
        out.push("");
        for(i=0;i<rows.length;i++)out.push(pad2(rows[i].sequence)+" · "+rows[i].firstId+" bis "+rows[i].lastId+" · "+rows[i].segmentCount+" Segmente · "+rows[i].heChars+" Zeichen · "+new File(rows[i].batchFile).displayName);
        out.push("");out.push(batchQueueSummary(masterFile,p,queue));
        return {files:files,manifest:manifest,message:out.join("\r\n")};
    }

    function writeTranslationBatch(p,chosen,folder,includePriorMissingTitles){
        var first=chosen[0].id.replace(/[^A-Za-z0-9_-]/g,"_"),last=chosen[chosen.length-1].id.replace(/[^A-Za-z0-9_-]/g,"_");
        var f=uniqueFile(new File(folder.fsName+"/Translation_Batch_"+pad2(p.volume||1)+"_"+first+"_bis_"+last+".txt"));
        var out=[];
        out.push("<translation_batch project=\"Ben Yehoyada\" volume=\""+pad2(p.volume||1)+"\">");
        out.push("<!-- Zu fuellen sind: leere <en>-Felder UND leere <band_en>-Felder. IDs, n, daf, ref, <he_title>, <he> und <band_he> unveraendert lassen. -->");
        out.push("<!-- <band_he> ist die aramaeische Talmud-Grundstelle. Ist <band_en> leer, wird sie dort ins Englische uebersetzt. Ist sie bereits gefuellt, unveraendert lassen. -->");
        out.push("<!-- Das Kopfband ist ein Ausschnitt um das Lemma: fuehrende und schliessende … bleiben stehen, der Satz darf mitten beginnen oder enden. -->");
        out.push("<!-- Im <en>-Text darf <lemma>…</lemma> das zitierte Talmudstichwort markieren und <fn>…</fn> eine Fussnote enthalten. Beide Tags beibehalten. -->");
        out.push("<!-- VERBINDLICHE UEBERSETZUNGSANWEISUNG: Ben_Yehoyada_VERBINDLICHE_Uebersetzungsanweisung_EN_Fassung1.2.txt -->");
        out.push("<!-- VERBINDLICHE ARBEITSANLEITUNG: Ben_Yehoyada_Arbeitsanleitung_AKTUELL_Fassung1.2.txt -->");
        out.push("<!-- Die Abschnitte sind Talmudblaetter, keine Paraschot. <en_title> ist bereits gefuellt (z.B. \"Daf 4b\") und bleibt unveraendert. -->");
        out.push("<!-- Das Lemma am Anfang des <en>-Felds mit <lemma>…</lemma> auszeichnen, sinngleich zur Formulierung in <band_en>. -->");
        out.push("<!-- Englische Fussnoten mit <fn>…</fn> setzen; Aufloesungen aus Ben_Yehoyada_<Traktat>_GLOSSAR.tsv, nichts erfinden. -->");
        out.push("<!-- Zahlenwerte und Buchstabenspiele erhalten: hebraeische Buchstaben stehen lassen und zusaetzlich erklaeren. -->");
        out.push("<!-- Zielsprache Englisch. Jedes Segment vollständig und präzise übersetzen; nichts kürzen, verbinden, teilen oder auslassen. -->");
        out.push("<!-- Fachbegriffe wie Mitzvah, Halacha, Berakhah und Kavvanah beibehalten und beim ersten Vorkommen kurz erklären. -->");
        out.push("<!-- Quellen ohne Kategorie-Praefix zitieren: (Genesis 37:18), nicht (Bible: Genesis 37:18) oder (Tanach: Genesis 37:18). -->");
        out.push("<!-- Talmud, Midrash und Zohar mit dem konkreten Werk- oder Traktatnamen angeben, ebenfalls ohne unnoetiges Kategorie-Praefix. -->");
        out.push("<!-- Gottesnamen im Englischen: יהוה, ה׳, השם, השי״ת und göttliches אדני als HaShem; niemals YHWH, Yahweh, Jehovah oder Adonai. -->");
        out.push("<!-- אלהים bei Bezug auf den einen G-d als G-d oder sachlich erforderliches Elohim; nicht als ungekürztes God. -->");
        out.push("<!-- Nur vollständig ausgefüllte leere Zielfelder zurückgeben; alle übrigen Dateiinhalte unverändert. -->");
        var i,s,sec,lastBatchSection=-999,firstSectionOrder=chosen[0].sectionOrder;
        if(includePriorMissingTitles){
            for(i=0;i<p.sections.length&&i<firstSectionOrder;i++){
                sec=p.sections[i];if(!trim(sec.en)){out.push("");out.push("<section>");out.push("<he_title>"+xmlEscape(sec.he)+"</he_title>");out.push("<en_title></en_title>");out.push("</section>");}
            }
        }
        for(i=0;i<chosen.length;i++){
            s=chosen[i];
            if(s.sectionOrder!==lastBatchSection){out.push("");out.push("<section>");out.push("<he_title>"+xmlEscape(s.sectionHe)+"</he_title>");out.push("<en_title>"+xmlEscape(s.sectionEn)+"</en_title>");out.push("</section>");lastBatchSection=s.sectionOrder;}
            // v2.0.6: the Talmud band travels with the batch as source context
            // and <band_en> is an actual translation target whenever it is empty.
            // A pre-existing <band_en> must remain unchanged.
            out.push("");
            out.push("<segment id=\""+s.id+"\" n=\""+s.number+"\""+(s.daf?" daf=\""+xmlEscape(s.daf)+"\"":"")+(s.ref?" ref=\""+xmlEscape(s.ref)+"\"":"")+">");
            out.push("<band_he>"+protectCdata(s.bandHe||"")+"</band_he>");
            out.push("<band_en>"+protectCdata(s.bandEn||"")+"</band_en>");
            out.push("<he>"+protectCdata(s.he)+"</he>");
            out.push("<en></en>");
            out.push("</segment>");
        }
        out.push("");out.push("</translation_batch>");writeUTF8(f,out.join("\r\n"));return f;
    }

    function takeNextBatchAtCursor(p,cursor,reserved,maxSegments,maxChars){
        var chosen=[],chars=0,s,c,i=cursor.index||0;
        for(;i<p.segments.length;i++){
            s=p.segments[i];
            if(trim(stripTags(s.en)))continue;
            if(reserved[s.id]){if(chosen.length){i++;break;}continue;}
            c=visibleLength(s.he);
            if(chosen.length&&(chosen.length>=maxSegments||chars+c>maxChars))break;
            chosen.push(s);chars+=c;
            if(chosen.length>=maxSegments){i++;break;}
        }
        cursor.index=i;
        return {segments:chosen,chars:chars};
    }

    function reserveChosenIds(reserved,segments){var i;for(i=0;i<segments.length;i++)reserved[segments[i].id]=true;}

    function batchQueueFile(masterFile){return new File(masterFile.parent.fsName+"/"+masterFile.displayName.replace(/\.txt$/i,"")+"_BatchQueue.tsv");}

    function loadBatchQueue(masterFile,p){
        var f=batchQueueFile(masterFile),q={version:1,cursorId:"",lastManifest:"",records:[]};
        if(!f.exists)return q;
        var raw=normalizeNewlines(readUTF8(f)),lines=raw.split("\n"),i,parts,header=false,r;
        for(i=0;i<lines.length;i++){
            parts=lines[i].split("\t");if(!parts.length)continue;
            if(parts[0]==="cursor_id"){q.cursorId=parts[1]||"";continue;}
            if(parts[0]==="last_manifest"){q.lastManifest=parts.slice(1).join("\t")||"";continue;}
            if(parts[0]==="status"&&parts[1]==="bulk_id"){header=true;continue;}
            if(!header||parts.length<10)continue;
            r={status:parts[0]||"",bulkId:parts[1]||"",sequence:parseInt(parts[2],10)||0,firstId:parts[3]||"",lastId:parts[4]||"",segmentCount:parseInt(parts[5],10)||0,
               heChars:parseInt(parts[6],10)||0,batchFile:parts[7]||"",exportedAt:parts[8]||"",mergedAt:parts[9]||"",mergedFile:parts[10]||""};
            q.records.push(r);
        }
        return q;
    }

    function saveBatchQueue(q,masterFile,p){
        var f=batchQueueFile(masterFile),out=[];
        out.push("BYH_BATCH_QUEUE\t1");out.push("master\t"+tsv(masterFile.fsName));out.push("volume\t"+pad2(p.volume||1));out.push("updated\t"+timestamp());out.push("cursor_id\t"+tsv(q.cursorId||""));out.push("last_manifest\t"+tsv(q.lastManifest||""));out.push("");
        out.push("status\tbulk_id\tsequence\tfirst_id\tlast_id\tsegment_count\the_chars\tbatch_file\texported_at\tmerged_at\tmerged_file");
        for(var i=0;i<q.records.length;i++){var r=q.records[i];out.push(tsv(r.status)+"\t"+tsv(r.bulkId)+"\t"+r.sequence+"\t"+tsv(r.firstId)+"\t"+tsv(r.lastId)+"\t"+r.segmentCount+"\t"+r.heChars+"\t"+tsv(r.batchFile)+"\t"+tsv(r.exportedAt)+"\t"+tsv(r.mergedAt)+"\t"+tsv(r.mergedFile));}
        writeUTF8(f,out.join("\r\n"));return f;
    }

    function addQueueRecord(q,r){q.records.push(r);}

    function normalizeBatchQueue(q,p){
        var i,r,f;
        for(i=0;i<q.records.length;i++){
            r=q.records[i];
            if(r.status==="EXPORTED"){
                f=new File(r.batchFile);
                if(!r.batchFile||!f.exists)r.status="MISSING";
            }
        }
    }

    function reservedQueueIds(q,p){
        var set={},idx={},i,r,a,b,j;
        for(i=0;i<p.segments.length;i++)idx[p.segments[i].id]=i;
        for(i=0;i<q.records.length;i++){
            r=q.records[i];if(r.status!=="EXPORTED")continue;
            a=idx[r.firstId];b=idx[r.lastId];if(a===undefined||b===undefined)continue;if(a>b){j=a;a=b;b=j;}
            for(j=a;j<=b;j++)set[p.segments[j].id]=true;
        }
        return set;
    }

    function writeBulkManifest(masterFile,p,bulkId,requested,maxSegments,maxChars,cursorStart,cursorEnd,rows){
        var f=uniqueFile(new File(masterFile.parent.fsName+"/Bulk_Set_"+pad2(p.volume||1)+"_"+timestamp()+".tsv")),out=[];
        out.push("BYH_BULK_MANIFEST\t1");out.push("bulk_id\t"+bulkId);out.push("master\t"+tsv(masterFile.fsName));out.push("volume\t"+pad2(p.volume||1));out.push("created\t"+timestamp());out.push("requested_batches\t"+requested);out.push("created_batches\t"+rows.length);out.push("max_segments\t"+maxSegments);out.push("max_he_chars\t"+maxChars);out.push("cursor_start_id\t"+cursorStart);out.push("cursor_end_id\t"+cursorEnd);out.push("queue_file\t"+tsv(batchQueueFile(masterFile).fsName));out.push("");
        out.push("sequence\tstatus\tfirst_id\tlast_id\tsegment_count\the_chars\tbatch_file");
        for(var i=0;i<rows.length;i++){var r=rows[i];out.push(r.sequence+"\t"+r.status+"\t"+r.firstId+"\t"+r.lastId+"\t"+r.segmentCount+"\t"+r.heChars+"\t"+tsv(r.batchFile));}
        writeUTF8(f,out.join("\r\n"));return f;
    }

    function batchQueueSummary(masterFile,p,q){
        if(!q){q=loadBatchQueue(masterFile,p);normalizeBatchQueue(q,p);}
        var counts={EXPORTED:0,MERGED:0,MISSING:0},i,r,reserved=reservedQueueIds(q,p),reservedCount=0,next="keine";
        for(i=0;i<q.records.length;i++){r=q.records[i];if(counts[r.status]===undefined)counts[r.status]=0;counts[r.status]++;}
        for(var k in reserved)if(reserved[k])reservedCount++;
        for(i=0;i<p.segments.length;i++)if(!trim(stripTags(p.segments[i].en))&&!reserved[p.segments[i].id]){next=p.segments[i].id;break;}
        return "QUEUE-STATUS\r\nDatei: "+batchQueueFile(masterFile).fsName+"\r\nEXPORTED/offen: "+(counts.EXPORTED||0)+" Batch(es) · reservierte IDs: "+reservedCount+"\r\nMERGED: "+(counts.MERGED||0)+" Batch(es)\r\nMISSING: "+(counts.MISSING||0)+" Batch(es)\r\nPersistierter Cursor: "+(q.cursorId||"-")+"\r\nNächste exportierbare ID: "+next+(q.lastManifest?"\r\nLetztes Bulk-Manifest: "+q.lastManifest:"");
    }

    function batchQueueStatus(masterFile){var p=parseBilingualFile(readUTF8(masterFile)),q=loadBatchQueue(masterFile,p);normalizeBatchQueue(q,p);saveBatchQueue(q,masterFile,p);return batchQueueSummary(masterFile,p,q);}

    function markQueueMerged(masterFile,p,batch,batchFile){
        var q=loadBatchQueue(masterFile,p);normalizeBatchQueue(q,p);if(!batch.segments.length)return;
        var first=batch.segments[0].id,last=batch.segments[batch.segments.length-1].id,found=false,i,r;
        for(i=0;i<q.records.length;i++){r=q.records[i];if(r.firstId===first&&r.lastId===last&&r.status!=="MERGED"){r.status="MERGED";r.mergedAt=timestamp();r.mergedFile=batchFile.fsName;found=true;}}
        if(!found)addQueueRecord(q,{status:"MERGED",bulkId:"LEGACY-"+pad2(p.volume||1)+"-"+timestamp(),sequence:1,firstId:first,lastId:last,segmentCount:batch.segments.length,heChars:0,batchFile:"",exportedAt:"",mergedAt:timestamp(),mergedFile:batchFile.fsName});
        q.cursorId=last;saveBatchQueue(q,masterFile,p);
    }


    function chooseMultipleTxtFiles(title){
        var picked=File.openDialog(title,"Text:*.txt",true),out=[],i;
        if(!picked)return out;
        try{
            if(picked instanceof Array){for(i=0;i<picked.length;i++)if(picked[i])out.push(picked[i]);return out;}
        }catch(_){ }
        if(picked.length!==undefined&&!picked.fsName){for(i=0;i<picked.length;i++)if(picked[i])out.push(picked[i]);return out;}
        out.push(picked);return out;
    }

    function bulkMergeSelectionSummary(files){
        var out=["BULK-MERGE DATEIAUSWAHL",files.length+" fertige Datei(en) ausgewählt."],i,limit=Math.min(files.length,12);
        out.push("");
        for(i=0;i<limit;i++)out.push(pad2(i+1)+" · "+files[i].displayName);
        if(files.length>limit)out.push("… plus "+(files.length-limit)+" weitere Datei(en)");
        out.push("");out.push("Beim Klick auf 'Alle gemeinsam zusammenführen' werden <en> und <band_en> jeder Datei vollständig gegen den unveränderten Master geprüft. Vorher wird nichts geschrieben.");
        return out.join("\r\n");
    }

    function preflightBulkMerge(masterFile,batchFiles){
        if(!batchFiles||!batchFiles.length)throw new Error("Keine _EN_FERTIG-Dateien ausgewählt.");
        var masterRaw=readUTF8(masterFile),master=parseBilingualFile(masterRaw),masterMap={},masterIndex={},masterTitles={},i,j,s,key,st;
        for(i=0;i<master.segments.length;i++){
            s=master.segments[i];masterMap[s.id]=s;masterIndex[s.id]=i;key=normalizeForCompare(s.sectionHe);
            if(key){
                if(!masterTitles[key])masterTitles[key]={he:s.sectionHe,en:s.sectionEn||""};
                else if(trim(masterTitles[key].en)&&trim(s.sectionEn)&&normalizeForCompare(masterTitles[key].en)!==normalizeForCompare(s.sectionEn))
                    throw new Error("Der Band-Master enthält bereits widersprüchliche englische Abschnittstitel für: "+s.sectionHe);
                else if(!trim(masterTitles[key].en)&&trim(s.sectionEn))masterTitles[key].en=s.sectionEn;
            }
        }

        var seenFiles={},seenIds={},titleAssignments={},infos=[],totalSegments=0,newSegments=0,identicalSegments=0;
        var newBands=0,identicalBands=0,emptyBands=0;
        var file,batch,raw,firstIdx,lastIdx,prevIdx,sec,target,existing,titleNew=0,titleIdentical=0,pathKey;
        for(i=0;i<batchFiles.length;i++){
            file=batchFiles[i];if(!file||!file.exists)throw new Error("Ausgewählte Datei nicht gefunden: "+(file?file.fsName:"?"));
            pathKey=String(file.fsName).toLowerCase();if(seenFiles[pathKey])throw new Error("Dieselbe Datei wurde mehrfach ausgewählt: "+file.displayName);seenFiles[pathKey]=true;
            if(String(file.displayName).toUpperCase().indexOf("_EN_FERTIG")<0)throw new Error(file.displayName+": Der Dateiname enthält nicht '_EN_FERTIG'. Für den Bulk-Merge nur fertige Rückgabedateien auswählen.");
            try{raw=readUTF8(file);batch=parseBilingualFile(wrapBatchAsBook(raw));}catch(pe){throw new Error(file.displayName+": Datei konnte nicht als Translation-Batch gelesen werden. "+errorText(pe));}
            if(batch.volume&&master.volume&&batch.volume!==master.volume)throw new Error(file.displayName+": Falscher Band. Batch Band "+batch.volume+", Master Band "+master.volume+".");
            if(!batch.segments.length)throw new Error(file.displayName+": Keine Segment-IDs enthalten.");

            for(j=0;j<batch.sections.length;j++){
                sec=batch.sections[j];key=normalizeForCompare(sec.he);if(!key)continue;
                if(!masterTitles[key])throw new Error(file.displayName+": Hebräische Abschnittsüberschrift ist im Master nicht vorhanden: "+sec.he);
                if(!trim(sec.en))throw new Error(file.displayName+": Englische Abschnittsüberschrift fehlt für: "+sec.he);
                if(/[\u0590-\u05FF]/.test(sec.en))throw new Error(file.displayName+": <en_title> enthält hebräische Zeichen für: "+sec.he);
                if(titleAssignments[key]&&normalizeForCompare(titleAssignments[key])!==normalizeForCompare(sec.en))throw new Error(file.displayName+": Widersprüchlicher englischer Abschnittstitel gegenüber einer anderen ausgewählten Datei für: "+sec.he);
                existing=masterTitles[key].en||"";
                if(trim(existing)&&normalizeForCompare(existing)!==normalizeForCompare(sec.en))throw new Error(file.displayName+": Der Master enthält bereits einen anderen englischen Abschnittstitel für: "+sec.he+" (Master: "+existing+" / Batch: "+sec.en+")");
                if(!titleAssignments[key])titleAssignments[key]=sec.en;
            }

            firstIdx=999999999;lastIdx=-1;prevIdx=-1;
            for(j=0;j<batch.segments.length;j++){
                s=batch.segments[j];target=masterMap[s.id];
                if(!target)throw new Error(file.displayName+": Batch-ID ist im Master nicht vorhanden: "+s.id);
                if(seenIds[s.id])throw new Error(file.displayName+": BYH-ID "+s.id+" kommt bereits in einer anderen ausgewählten Datei vor (Überlappung/Doppelwahl).");
                if(masterIndex[s.id]<=prevIdx)throw new Error(file.displayName+": Segmentreihenfolge ist nicht aufsteigend bei "+s.id+".");
                prevIdx=masterIndex[s.id];seenIds[s.id]=file.displayName;
                if(target.number!==s.number)throw new Error(file.displayName+": Attribut n wurde verändert bei "+s.id+". Master n="+target.number+", Batch n="+s.number+".");
                if(normalizeForCompare(target.daf||"")!==normalizeForCompare(s.daf||""))throw new Error(file.displayName+": Attribut daf wurde verändert bei "+s.id+".");
                if(normalizeForCompare(target.ref||"")!==normalizeForCompare(s.ref||""))throw new Error(file.displayName+": Attribut ref wurde verändert bei "+s.id+".");
                if(batch.sections.length&&normalizeForCompare(target.sectionHe)!==normalizeForCompare(s.sectionHe))throw new Error(file.displayName+": Hebräische Abschnittsüberschrift wurde verändert oder verschoben bei "+s.id+".");
                if(normalizeForCompare(target.he)!==normalizeForCompare(s.he))throw new Error(file.displayName+": Hebräischer Text wurde verändert bei "+s.id+".");
                if(normalizeForCompare(target.bandHe||"")!==normalizeForCompare(s.bandHe||""))throw new Error(file.displayName+": Das hebräische Kopfband wurde verändert bei "+s.id+".");

                // v2.0.6: <band_en> is a first-class Bulk-Merge target.
                // Validate the returned field completely before any master write.
                var targetBandHas=!!trim(stripTags(target.bandEn||""));
                var batchBandHas=!!trim(stripTags(s.bandEn||""));
                var bandHeHas=!!trim(stripTags(target.bandHe||""));
                var effectiveBand="";
                if(!bandHeHas){
                    if(batchBandHas)throw new Error(file.displayName+": <band_en> ist gefüllt, obwohl <band_he> leer ist bei "+s.id+".");
                    if(targetBandHas)throw new Error("Der Master enthält <band_en>, obwohl <band_he> leer ist bei "+s.id+".");
                    emptyBands++;
                }else if(targetBandHas){
                    if(!batchBandHas)throw new Error(file.displayName+": Ein bereits vorhandenes <band_en> wurde im Batch geleert bei "+s.id+".");
                    if(normalizeForCompare(target.bandEn)!==normalizeForCompare(s.bandEn))throw new Error(file.displayName+": Der Master enthält bereits ein anderes englisches Kopfband für "+s.id+". Bestehende <band_en>-Fassungen werden niemals überschrieben.");
                    effectiveBand=target.bandEn;identicalBands++;
                }else{
                    if(!batchBandHas)throw new Error(file.displayName+": <band_en> ist noch leer bei "+s.id+", obwohl <band_he> gefüllt ist.");
                    effectiveBand=s.bandEn;newBands++;
                }
                if(bandHeHas){
                    if(/[\u0590-\u05FF]/.test(effectiveBand))throw new Error(file.displayName+": <band_en> enthält hebräische Zeichen bei "+s.id+".");
                    if(hasLeadingEllipsis(target.bandHe)!==hasLeadingEllipsis(effectiveBand))throw new Error(file.displayName+": Führendes Auslassungszeichen … stimmt zwischen <band_he> und <band_en> nicht überein bei "+s.id+".");
                    if(hasTrailingEllipsis(target.bandHe)!==hasTrailingEllipsis(effectiveBand))throw new Error(file.displayName+": Abschließendes Auslassungszeichen … stimmt zwischen <band_he> und <band_en> nicht überein bei "+s.id+".");
                    validateEnglishLemmaForBand(file.displayName,s.id,s.he,s.en,effectiveBand);
                }
                if(!trim(stripTags(s.en)))throw new Error(file.displayName+": <en> ist noch leer bei "+s.id+". Bulk-Merge akzeptiert nur vollständig fertige Batches.");
                if(trim(stripTags(target.en))){
                    if(normalizeForCompare(target.en)!==normalizeForCompare(s.en))throw new Error(file.displayName+": Der Master enthält bereits einen anderen englischen Text für "+s.id+". Bestehende Übersetzungen werden im Bulk-Merge niemals überschrieben.");
                    identicalSegments++;
                }else newSegments++;
                if(masterIndex[s.id]<firstIdx)firstIdx=masterIndex[s.id];if(masterIndex[s.id]>lastIdx)lastIdx=masterIndex[s.id];totalSegments++;
            }
            infos.push({file:file,batch:batch,firstId:batch.segments[0].id,lastId:batch.segments[batch.segments.length-1].id,startIndex:firstIdx,endIndex:lastIdx});
        }
        infos.sort(function(a,b){return a.startIndex-b.startIndex;});

        for(key in titleAssignments){
            if(!titleAssignments.hasOwnProperty||titleAssignments.hasOwnProperty(key)){
                st=masterTitles[key];if(st&&trim(st.en))titleIdentical++;else titleNew++;
            }
        }

        var q=loadBatchQueue(masterFile,master);normalizeBatchQueue(q,master);var bulkSet={},r,k;
        for(i=0;i<infos.length;i++){
            for(j=0;j<q.records.length;j++){r=q.records[j];if(r.firstId===infos[i].firstId&&r.lastId===infos[i].lastId&&r.bulkId)bulkSet[r.bulkId]=true;}
        }
        var bulkIds=[];for(k in bulkSet)if(bulkSet[k])bulkIds.push(k);bulkIds.sort();
        return {masterFile:masterFile,masterRaw:masterRaw,master:master,masterMap:masterMap,masterIndex:masterIndex,masterTitles:masterTitles,
            titleAssignments:titleAssignments,infos:infos,fileCount:infos.length,totalSegments:totalSegments,newSegments:newSegments,identicalSegments:identicalSegments,
            newBands:newBands,identicalBands:identicalBands,emptyBands:emptyBands,
            newTitles:titleNew,identicalTitles:titleIdentical,firstId:infos[0].firstId,lastId:infos[infos.length-1].lastId,bulkIds:bulkIds};
    }

    function bulkMergeConfirmText(pf){
        var out=[];out.push("BULK-MERGE · VORPRÜFUNG ERFOLGREICH");out.push("");
        out.push("Dateien: "+pf.fileCount);out.push("BYH-Bereich: "+pf.firstId+" bis "+pf.lastId);out.push("Segmente insgesamt: "+pf.totalSegments);
        out.push("Neu einzusetzen: "+pf.newSegments+" · bereits identisch im Master: "+pf.identicalSegments);
        out.push("Englische Kopfbänder neu: "+pf.newBands+" · bereits identisch: "+pf.identicalBands+" · ohne Kopfband: "+pf.emptyBands);
        out.push("Neue Abschnittstitel: "+pf.newTitles+" · bereits identisch: "+pf.identicalTitles);
        if(pf.bulkIds.length)out.push("Queue/Bulk-ID: "+pf.bulkIds.join(", "));
        out.push("");out.push("Alle Dateien wurden vollständig geprüft. Es wurde noch nichts verändert.");
        out.push("Nach Bestätigung wird genau EINE Master-Sicherung erstellt, danach werden alle Batches im Speicher zusammengeführt und der Master genau EINMAL geschrieben.");
        out.push("");out.push("Fortfahren?");return out.join("\n");
    }

    function advanceQueueCursor(q,p,id){
        var idx={},i,current=-1,next=-1;for(i=0;i<p.segments.length;i++)idx[p.segments[i].id]=i;
        if(q.cursorId&&idx[q.cursorId]!==undefined)current=idx[q.cursorId];if(id&&idx[id]!==undefined)next=idx[id];
        if(next>current)q.cursorId=id;
    }

    function markQueueMergedBulk(masterFile,p,infos){
        var q=loadBatchQueue(masterFile,p);normalizeBatchQueue(q,p);var when=timestamp(),updated=0,added=0,i,j,r,found,legacyId="BULK-MERGE-"+pad2(p.volume||1)+"-"+when;
        for(i=0;i<infos.length;i++){
            found=false;
            for(j=0;j<q.records.length;j++){
                r=q.records[j];
                if(r.firstId===infos[i].firstId&&r.lastId===infos[i].lastId){
                    r.status="MERGED";if(!r.mergedAt)r.mergedAt=when;r.mergedFile=infos[i].file.fsName;found=true;updated++;
                }
            }
            if(!found){addQueueRecord(q,{status:"MERGED",bulkId:legacyId,sequence:i+1,firstId:infos[i].firstId,lastId:infos[i].lastId,segmentCount:infos[i].batch.segments.length,heChars:0,batchFile:"",exportedAt:"",mergedAt:when,mergedFile:infos[i].file.fsName});added++;}
            advanceQueueCursor(q,p,infos[i].lastId);
        }
        var f=saveBatchQueue(q,masterFile,p);return {file:f,updated:updated,added:added,summary:batchQueueSummary(masterFile,p,q)};
    }

    function mergeBatchesBulk(masterFile,batchFiles,prepared){
        var pf=prepared||preflightBulkMerge(masterFile,batchFiles),master=pf.master,key,i,j,s,target,backup=null,queueResult=null;
        if(pf.newSegments===0&&pf.newBands===0&&pf.newTitles===0){
            try{queueResult=markQueueMergedBulk(masterFile,master,pf.infos);}catch(qe0){return "BULK-MERGE: Alle ausgewählten Inhalte sind bereits identisch im Master; es war kein Master-Schreibvorgang nötig.\r\nWARNUNG: Queue-Status konnte nicht aktualisiert werden: "+errorText(qe0);}
            return "BULK-MERGE: Alle "+pf.fileCount+" ausgewählten Dateien sind bereits vollständig und identisch im Master. Kein Master-Schreibvorgang und keine zusätzliche Sicherung waren nötig.\r\n\r\n"+queueResult.summary;
        }

        backup=new File(masterFile.parent.fsName+"/"+masterFile.displayName.replace(/\.txt$/i,"")+"_backup_BULK_MERGE_"+safeFileToken(pf.firstId)+"_"+safeFileToken(pf.lastId)+"_"+timestamp()+".txt");
        writeUTF8(backup,pf.masterRaw);

        for(key in pf.titleAssignments){
            if(!pf.titleAssignments.hasOwnProperty||pf.titleAssignments.hasOwnProperty(key)){
                for(j=0;j<master.segments.length;j++)if(normalizeForCompare(master.segments[j].sectionHe)===key&&!trim(master.segments[j].sectionEn))master.segments[j].sectionEn=pf.titleAssignments[key];
            }
        }
        for(i=0;i<pf.infos.length;i++){
            for(j=0;j<pf.infos[i].batch.segments.length;j++){
                s=pf.infos[i].batch.segments[j];target=pf.masterMap[s.id];
                if(!trim(stripTags(target.bandEn||""))&&trim(stripTags(s.bandEn||"")))target.bandEn=s.bandEn;
                if(!trim(stripTags(target.en)))target.en=s.en;
            }
        }

        // Serialize and reparse in memory before the one and only master write.
        // This catches any accidental loss of <en> or <band_en> in the serializer.
        var mergedText=reserializeParsedBook(master),verified=parseBilingualFile(mergedText),verifiedMap={};
        for(i=0;i<verified.segments.length;i++)verifiedMap[verified.segments[i].id]=verified.segments[i];
        for(i=0;i<pf.infos.length;i++){
            for(j=0;j<pf.infos[i].batch.segments.length;j++){
                s=pf.infos[i].batch.segments[j];target=verifiedMap[s.id];
                if(!target)throw new Error("Interne Bulk-Merge-Prüfung: Segment fehlt nach Serialisierung: "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
                if(normalizeForCompare(target.en)!==normalizeForCompare(s.en))throw new Error("Interne Bulk-Merge-Prüfung: <en> stimmt nach Serialisierung nicht bei "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
                if(normalizeForCompare(target.bandEn||"")!==normalizeForCompare(s.bandEn||""))throw new Error("Interne Bulk-Merge-Prüfung: <band_en> stimmt nach Serialisierung nicht bei "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
            }
        }

        try{writeUTF8(masterFile,mergedText);}catch(we){throw new Error("Die Master-Sicherung wurde erstellt, aber der gemeinsame Master-Schreibvorgang ist fehlgeschlagen. Sicherung: "+backup.fsName+"\n\n"+errorText(we));}
        var queueNote="";
        try{queueResult=markQueueMergedBulk(masterFile,master,pf.infos);queueNote="Queue aktualisiert: "+queueResult.updated+" bestehende Einträge, "+queueResult.added+" neue/Legacy-Einträge.\r\n"+queueResult.summary;}
        catch(qe){queueNote="WARNUNG: Der Master wurde erfolgreich geschrieben, aber der Queue-Status konnte nicht aktualisiert werden: "+errorText(qe);}

        var out=[];out.push("BULK-MERGE ERFOLGREICH");out.push("Dateien vollständig vorgeprüft: "+pf.fileCount);out.push("BYH-Bereich: "+pf.firstId+" bis "+pf.lastId);
        out.push("Segmente geprüft: "+pf.totalSegments);out.push("Neu zusammengeführt: "+pf.newSegments+" · bereits identisch: "+pf.identicalSegments);
        out.push("Englische Kopfbänder neu: "+pf.newBands+" · bereits identisch: "+pf.identicalBands+" · ohne Kopfband: "+pf.emptyBands);
        out.push("Neue Abschnittstitel: "+pf.newTitles+" · bereits identisch: "+pf.identicalTitles);out.push("Master-Schreibvorgänge: 1");out.push("Master-Sicherung: "+backup.fsName);out.push("");out.push(queueNote);
        return out.join("\r\n");
    }

    function mergeBatch(masterFile,batchFile){
        var masterRaw=readUTF8(masterFile),master=parseBilingualFile(masterRaw),batch=parseBilingualFile(wrapBatchAsBook(readUTF8(batchFile)));
        var map={},i,j,s,filled=0,unchanged=0,titleFilled=0,titleMap={},masterTitleMap={},sec,key;
        for(i=0;i<master.segments.length;i++)map[master.segments[i].id]=master.segments[i];
        for(i=0;i<master.segments.length;i++){
            key=normalizeForCompare(master.segments[i].sectionHe);
            if(key)masterTitleMap[key]=true;
        }
        for(i=0;i<batch.sections.length;i++){
            sec=batch.sections[i];key=normalizeForCompare(sec.he);
            if(!key)continue;
            if(!masterTitleMap[key])throw new Error("Die hebräische Abschnittsüberschrift ist in der Banddatei nicht vorhanden: "+sec.he);
            if(!trim(sec.en))throw new Error("Englische Abschnittsüberschrift fehlt für: "+sec.he+". Jedes <en_title> muss ausgefüllt sein.");
            if(/[\u0590-\u05FF]/.test(sec.en))throw new Error("Das englische Titelfeld enthält hebräische Zeichen für: "+sec.he+". Bitte die englische Transliteration in <en_title> einsetzen.");
            if(titleMap[key] && normalizeForCompare(titleMap[key])!==normalizeForCompare(sec.en))throw new Error("Widersprüchliche englische Überschriften für: "+sec.he);
            titleMap[key]=sec.en;
        }
        for(key in titleMap){
            if(!titleMap.hasOwnProperty || titleMap.hasOwnProperty(key)){
                for(j=0;j<master.segments.length;j++)if(normalizeForCompare(master.segments[j].sectionHe)===key)master.segments[j].sectionEn=titleMap[key];
                titleFilled++;
            }
        }
        var bandFilled=0,bandOpen=0;
        for(i=0;i<batch.segments.length;i++){
            s=batch.segments[i];
            if(!map[s.id])throw new Error("Batch-ID ist in der Banddatei nicht vorhanden: "+s.id);
            if(batch.sections.length && normalizeForCompare(map[s.id].sectionHe)!==normalizeForCompare(s.sectionHe))throw new Error("Die hebräische Abschnittsüberschrift wurde im Batch verändert oder verschoben: "+s.id);
            if(normalizeForCompare(map[s.id].he)!==normalizeForCompare(s.he))throw new Error("Der hebräische Text wurde im Batch verändert: "+s.id);
            if(normalizeForCompare(map[s.id].bandHe||"")!==normalizeForCompare(s.bandHe||""))throw new Error("Das hebräische Kopfband wurde im Batch verändert: "+s.id);

            // v2.0.1: Das englische Kopfband ist jetzt ein Uebersetzungsziel.
            // Es wird nur uebernommen, wenn es im Master noch leer ist - eine
            // bereits lizenzierte Fassung wird nie ueberschrieben.
            if(trim(stripTags(s.bandEn||"")) && !trim(stripTags(map[s.id].bandEn||""))){
                if(/[֐-׿]/.test(s.bandEn))throw new Error("Das englische Kopfband enthält hebräische Zeichen: "+s.id);
                map[s.id].bandEn=s.bandEn;bandFilled++;
            }else if(trim(stripTags(map[s.id].bandHe||"")) && !trim(stripTags(map[s.id].bandEn||""))){
                bandOpen++;
            }

            if(!trim(stripTags(s.en))){unchanged++;continue;}
            map[s.id].en=s.en;filled++;
        }
        if(!filled && !titleFilled && !bandFilled)throw new Error("Der Batch enthält keine gefüllten <en_title>-, <band_en>- oder <en>-Felder.");
        var backup=new File(masterFile.parent.fsName+"/"+masterFile.displayName.replace(/\.txt$/i,"")+"_backup_"+timestamp()+".txt");
        writeUTF8(backup,masterRaw);
        writeUTF8(masterFile,reserializeParsedBook(master));
        var queueNote="Queue-Status: MERGED für "+batch.segments[0].id+" bis "+batch.segments[batch.segments.length-1].id+".";
        try{markQueueMerged(masterFile,master,batch,batchFile);}catch(qe){queueNote="WARNUNG: Master wurde erfolgreich zusammengeführt, Queue-Status konnte aber nicht aktualisiert werden: "+errorText(qe);}
        var bandNote="Englische Kopfbänder: "+bandFilled+" zusammengeführt";
        if(bandOpen)bandNote+=", "+bandOpen+" noch offen";
        bandNote+=".";
        return "Zusammengeführt: "+filled+" englische Segmente.\r\n"+bandNote+"\r\nEnglische Überschriften: "+titleFilled+".\r\nLeer geblieben: "+unchanged+".\r\n"+queueNote+"\r\nSicherung: "+backup.fsName;
    }

    function wrapBatchAsBook(raw){
        raw=normalizeNewlines(raw);
        var m=/<translation_batch\b[^>]*\bvolume=["']([0-9]+)["'][^>]*>/i.exec(raw),v=m?m[1]:"1";
        return raw.replace(/<translation_batch\b[^>]*>/i,"<book volume=\""+v+"\">").replace(/<\/translation_batch>/i,"</book>");
    }

    function reserializeParsedBook(p){
        var out=[];out.push("<book project=\"Ben Yehoyada\""+(p.tractate?" tractate=\""+xmlEscape(p.tractate)+"\"":"")+" volume=\""+pad2(p.volume||1)+"\" max_pages=\""+MAX_PAGES+"\">");
        var secKey=null,i,s,key,attrs;
        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];key=s.sectionHe+"\u0001"+s.sectionEn;
            if(key!==secKey){out.push("");out.push("<section>");out.push("<he_title>"+xmlEscape(s.sectionHe)+"</he_title>");out.push("<en_title>"+xmlEscape(s.sectionEn)+"</en_title>");out.push("</section>");secKey=key;}
            attrs="<segment id=\""+s.id+"\" n=\""+s.number+"\"";
            if(s.daf)attrs+=" daf=\""+xmlEscape(s.daf)+"\"";
            if(s.ref)attrs+=" ref=\""+xmlEscape(s.ref)+"\"";
            attrs+=">";
            out.push("");out.push(attrs);
            out.push("<band_he>"+protectCdata(s.bandHe||"")+"</band_he>");
            out.push("<band_en>"+protectCdata(s.bandEn||"")+"</band_en>");
            out.push("<he>"+protectCdata(s.he)+"</he>");
            out.push("<en>"+protectCdata(s.en)+"</en>");
            out.push("</segment>");
        }
        out.push("");out.push("</book>");return out.join("\r\n");
    }


    // ---------------- v2.0.18: complete translated volume (no batches) ----------------
    //
    // A complete volume file is an ordinary BILINGUAL <book> whose <en>,
    // <en_title> and <band_en> fields are all filled. It is validated as a
    // whole; every error is collected, so one run shows everything that still
    // has to be corrected. Nothing is written by the preflight.

    function sameFilePath(a,b){
        try{return normalizedPathForCompare(a.fsName)===normalizedPathForCompare(b.fsName);}catch(_){return false;}
    }

    function countTag(s,tag){
        var o=String(s||"").match(new RegExp("<"+tag+"\\b[^>]*>","gi")),c=String(s||"").match(new RegExp("<\\/"+tag+">","gi"));
        return {open:o?o.length:0,close:c?c.length:0};
    }

    function tagProblems(s,label){
        var tags=["fn","lemma","b","i","small","sup"],out=[],i,c,text=String(s||""),fnRe=/<fn>([\s\S]*?)<\/fn>/gi,m;
        for(i=0;i<tags.length;i++){
            c=countTag(text,tags[i]);
            if(c.open!==c.close)out.push(label+": <"+tags[i]+"> "+c.open+"× geöffnet, "+c.close+"× geschlossen");
        }
        while((m=fnRe.exec(text))!==null){
            if(/<fn>/i.test(m[1])){out.push(label+": verschachtelte <fn> innerhalb einer Fußnote");break;}
            if(!trim(stripTags(m[1]))){out.push(label+": leere Fußnote <fn></fn>");break;}
        }
        if(/<!\[CDATA\[|\]\]>/.test(text))out.push(label+": doppelte bzw. übrig gebliebene CDATA-Markierung");
        return out;
    }

    function byhIdNumber(id){var m=/([0-9]+)\s*$/.exec(String(id||""));return m?parseInt(m[1],10):NaN;}

    function preflightCompleteVolume(completeFile,masterFile){
        if(!completeFile||!completeFile.exists)throw new Error("Fertige Banddatei nicht gefunden.");
        var raw=readUTF8(completeFile),text=normalizeNewlines(raw);
        if(/<translation_batch\b/i.test(text))throw new Error(completeFile.displayName+": Das ist ein Translation-Batch, keine vollständige Banddatei. Batches bitte weiterhin über Einzel- oder Bulk-Merge zurückführen.");
        if(!/<book\b/i.test(text))throw new Error(completeFile.displayName+": Kein <book>-Element gefunden. Erwartet wird eine vollständige BILINGUAL-Banddatei.");
        var p=parseBilingualFile(text),errors=[],warnings=[],i,s,label,bandHeHas,bandEnHas,sec,titleByHe={},heByTitle={},k;
        var rawSegCount=(text.match(/<segment\b/gi)||[]).length,prevNo=-1,no,fnHe=0,fnEn=0,bands=0,lemmas=0;
        if(rawSegCount!==p.segments.length)errors.push("Die Datei enthält "+rawSegCount+" <segment>-Tags, aber nur "+p.segments.length+" gültige Segmente (id und n sind Pflicht).");
        if(!/<\/book>\s*$/i.test(trim(text)))errors.push("Das schließende </book> fehlt am Dateiende – die Datei ist möglicherweise abgeschnitten.");

        for(i=0;i<p.sections.length;i++){
            sec=p.sections[i];
            if(!trim(sec.he))errors.push("Abschnitt "+(i+1)+": <he_title> ist leer.");
            if(!trim(sec.en))errors.push("Abschnitt "+(i+1)+" ("+sec.he+"): <en_title> ist leer.");
            else if(/[֐-׿]/.test(sec.en))errors.push("Abschnitt "+(i+1)+" ("+sec.he+"): <en_title> enthält hebräische Zeichen.");
            k=normalizeForCompare(sec.he);
            if(k&&titleByHe[k]!==undefined&&normalizeForCompare(titleByHe[k])!==normalizeForCompare(sec.en))errors.push("Widersprüchliche englische Titel für "+sec.he+": "+titleByHe[k]+" / "+sec.en);
            if(k)titleByHe[k]=sec.en;
            if(trim(sec.en)){var ek=normalizeForCompare(sec.en).toLowerCase();if(heByTitle[ek]!==undefined&&heByTitle[ek]!==k)warnings.push("Englischer Titel "+sec.en+" steht bei zwei verschiedenen hebräischen Titeln.");heByTitle[ek]=k;}
        }
        if(p.segments.length&&p.segments[0].sectionOrder<0)errors.push("Vor dem ersten Segment "+p.segments[0].id+" steht kein <section>-Block (Daf-Titel).");

        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];label=s.id;
            no=byhIdNumber(s.id);
            if(!isNaN(no)){if(prevNo>=0&&no<=prevNo)errors.push(label+": BYH-ID ist nicht aufsteigend (vorher "+p.segments[i-1].id+").");prevNo=no;}
            if(!trim(stripTags(s.he)))errors.push(label+": <he> ist leer.");
            if(!trim(stripTags(s.en)))errors.push(label+": <en> ist leer.");
            bandHeHas=!!trim(stripTags(s.bandHe||""));bandEnHas=!!trim(stripTags(s.bandEn||""));
            if(bandHeHas){
                bands++;
                if(!bandEnHas)errors.push(label+": <band_en> ist leer, obwohl <band_he> gefüllt ist.");
                else{
                    if(/[֐-׿]/.test(s.bandEn))errors.push(label+": <band_en> enthält hebräische Zeichen.");
                    if(hasLeadingEllipsis(s.bandHe)!==hasLeadingEllipsis(s.bandEn))errors.push(label+": führendes … stimmt zwischen <band_he> und <band_en> nicht überein.");
                    if(hasTrailingEllipsis(s.bandHe)!==hasTrailingEllipsis(s.bandEn))errors.push(label+": abschließendes … stimmt zwischen <band_he> und <band_en> nicht überein.");
                    if(trim(stripTags(s.en))){try{validateEnglishLemmaForBand(completeFile.displayName,s.id,s.he,s.en,s.bandEn);}catch(le){errors.push(errorText(le).replace(completeFile.displayName+": ",""));}}
                }
            }else if(bandEnHas)errors.push(label+": <band_en> ist gefüllt, obwohl <band_he> leer ist.");
            if(/<lemma>/i.test(s.en))lemmas++;
            errors=errors.concat(tagProblems(s.he,label+" <he>"),tagProblems(s.en,label+" <en>"),tagProblems(s.bandEn,label+" <band_en>"));
            fnHe+=countTag(s.he,"fn").open;fnEn+=countTag(s.en,"fn").open;
            if(s.daf&&trim(s.sectionEn)&&/^Daf\s+/i.test(trim(s.sectionEn))&&normalizeForCompare(s.sectionEn).toLowerCase()!==("daf "+normalizeForCompare(s.daf)).toLowerCase())
                warnings.push(label+": Attribut daf=\""+s.daf+"\" passt nicht zum Abschnittstitel \""+s.sectionEn+"\".");
            if(/^\s*\[[0-9]+\]/.test(stripTags(s.en))||/<br\s*\/?>\s*(?:<[^>]+>\s*)*\[[0-9]+\]/i.test(s.en+" "+s.he))
                warnings.push(label+": Text beginnt nach einem Absatz mit [Zahl]; das kann die BYH-Zuordnung im Layout stören.");
        }

        var est=0,texts=null;
        try{texts=composeDisplayTexts(p);est=Math.ceil(Math.max(texts.heVisible/HE_CHARS_PER_PAGE,texts.enEstimated/EN_CHARS_PER_PAGE))+2;}catch(ce){errors.push("Textaufbau für InDesign nicht möglich: "+errorText(ce));}
        if(est>MAX_PAGES)warnings.push("Geschätzt ca. "+est+" Seiten – mehr als die harte Grenze von "+MAX_PAGES+" Seiten. Der Aufbau stoppt spätestens dort.");
        else if(est>TARGET_PAGES)warnings.push("Geschätzt ca. "+est+" Seiten – über dem Planungsziel von "+TARGET_PAGES+" Seiten.");

        var pf={completeFile:completeFile,completeRaw:raw,complete:p,masterFile:masterFile||null,master:null,masterRaw:"",
            errors:errors,warnings:warnings,segmentCount:p.segments.length,sectionCount:p.sections.length,volume:p.volume,tractate:p.tractate,
            firstId:p.segments.length?p.segments[0].id:"",lastId:p.segments.length?p.segments[p.segments.length-1].id:"",
            bands:bands,lemmas:lemmas,footnotesHe:fnHe,footnotesEn:fnEn,estimatedPages:est,
            heChars:texts?texts.heVisible:0,enChars:texts?texts.enVisible:0,
            newSegments:0,identicalSegments:0,conflictSegments:[],newBands:0,identicalBands:0,conflictBands:[],
            newTitles:0,identicalTitles:0,conflictTitles:[]};
        if(masterFile)compareCompleteVolumeWithMaster(pf,masterFile);
        return pf;
    }

    function compareCompleteVolumeWithMaster(pf,masterFile){
        var masterRaw=readUTF8(masterFile),m=parseBilingualFile(masterRaw),c=pf.complete,errors=pf.errors,i,a,b,mMap={},cMap={},missing=[],extra=[],orderOk=true,seenTitle={},key;
        pf.master=m;pf.masterRaw=masterRaw;pf.masterFile=masterFile;
        if(m.volume&&c.volume&&m.volume!==c.volume)errors.push("Falscher Band: Komplettband Band "+c.volume+", Master Band "+m.volume+".");
        if(m.tractate&&c.tractate&&normalizedNameKey(m.tractate)!==normalizedNameKey(c.tractate))errors.push("Falsches Traktat: Komplettband "+c.tractate+", Master "+m.tractate+".");
        for(i=0;i<m.segments.length;i++)mMap[m.segments[i].id]=m.segments[i];
        for(i=0;i<c.segments.length;i++){cMap[c.segments[i].id]=c.segments[i];if(!mMap[c.segments[i].id])extra.push(c.segments[i].id);}
        for(i=0;i<m.segments.length;i++)if(!cMap[m.segments[i].id])missing.push(m.segments[i].id);
        if(missing.length)errors.push("Im Komplettband fehlen "+missing.length+" Master-Segment(e): "+missing.slice(0,15).join(", ")+(missing.length>15?" …":""));
        if(extra.length)errors.push("Der Komplettband enthält "+extra.length+" Segment(e), die im Master nicht existieren: "+extra.slice(0,15).join(", ")+(extra.length>15?" …":""));
        if(!missing.length&&!extra.length){
            for(i=0;i<m.segments.length;i++)if(m.segments[i].id!==c.segments[i].id){errors.push("Segmentreihenfolge weicht ab ab Position "+(i+1)+": Master "+m.segments[i].id+", Komplettband "+c.segments[i].id+".");orderOk=false;break;}
        }
        for(i=0;i<c.segments.length;i++){
            b=c.segments[i];a=mMap[b.id];if(!a)continue;
            if(a.number!==b.number)errors.push(b.id+": Attribut n wurde verändert (Master "+a.number+", Komplettband "+b.number+").");
            if(normalizeForCompare(a.daf||"")!==normalizeForCompare(b.daf||""))errors.push(b.id+": Attribut daf wurde verändert.");
            if(normalizeForCompare(a.ref||"")!==normalizeForCompare(b.ref||""))errors.push(b.id+": Attribut ref wurde verändert.");
            if(normalizeForCompare(a.sectionHe)!==normalizeForCompare(b.sectionHe))errors.push(b.id+": Hebräischer Abschnittstitel wurde verändert oder verschoben.");
            if(normalizeForCompare(a.he)!==normalizeForCompare(b.he))errors.push(b.id+": Hebräischer Text <he> wurde verändert.");
            if(normalizeForCompare(a.bandHe||"")!==normalizeForCompare(b.bandHe||""))errors.push(b.id+": Hebräisches Kopfband <band_he> wurde verändert.");
            if(trim(stripTags(a.en))){if(normalizeForCompare(a.en)===normalizeForCompare(b.en))pf.identicalSegments++;else pf.conflictSegments.push(b.id);}
            else pf.newSegments++;
            if(trim(stripTags(a.bandEn||""))){if(normalizeForCompare(a.bandEn)===normalizeForCompare(b.bandEn||""))pf.identicalBands++;else pf.conflictBands.push(b.id);}
            else if(trim(stripTags(b.bandEn||"")))pf.newBands++;
            key=normalizeForCompare(b.sectionHe);
            if(key&&!seenTitle[key]){
                seenTitle[key]=true;
                if(trim(a.sectionEn)){if(normalizeForCompare(a.sectionEn)===normalizeForCompare(b.sectionEn))pf.identicalTitles++;else pf.conflictTitles.push(b.sectionHe+" (Master: "+a.sectionEn+" / Komplettband: "+b.sectionEn+")");}
                else pf.newTitles++;
            }
        }
        return orderOk;
    }

    function limitedList(a,limit){
        var out=[],i,n=Math.min(a.length,limit||COMPLETE_REPORT_LIMIT);
        for(i=0;i<n;i++)out.push("  · "+a[i]);
        if(a.length>n)out.push("  … plus "+(a.length-n)+" weitere");
        return out;
    }

    function completeVolumeReport(pf){
        var out=[];
        out.push(pf.errors.length?"KOMPLETTBAND-PRÜFUNG · "+pf.errors.length+" FEHLER":"KOMPLETTBAND-PRÜFUNG · OK · SATZFERTIG");
        out.push("Datei: "+pf.completeFile.fsName);
        out.push("Band: "+pad2(pf.volume||1)+(pf.tractate?" · Traktat: "+pf.tractate:""));
        out.push("Segmente: "+pf.segmentCount+" · Abschnitte (Daf-Titel): "+pf.sectionCount+" · BYH-Bereich: "+pf.firstId+" bis "+pf.lastId);
        out.push("Talmud-Kopfbänder: "+pf.bands+" · englische Lemmata: "+pf.lemmas+" · Fußnoten HE/EN: "+pf.footnotesHe+" / "+pf.footnotesEn);
        if(pf.estimatedPages)out.push("Sichtbare Zeichen HE/EN: "+pf.heChars+" / "+pf.enChars+" · geschätzte Seiten: ca. "+pf.estimatedPages+" (Ziel "+TARGET_PAGES+", Sperre "+MAX_PAGES+")");
        else out.push("Geschätzte Seiten: nicht berechenbar, solange die unten genannten Fehler bestehen.");
        if(pf.masterFile){
            out.push("");out.push("ABGLEICH MIT BAND-MASTER");out.push("Master: "+pf.masterFile.fsName);
            out.push("EN-Segmente neu: "+pf.newSegments+" · bereits identisch: "+pf.identicalSegments+" · abweichend vorhanden: "+pf.conflictSegments.length);
            out.push("EN-Kopfbänder neu: "+pf.newBands+" · bereits identisch: "+pf.identicalBands+" · abweichend vorhanden: "+pf.conflictBands.length);
            out.push("EN-Abschnittstitel neu: "+pf.newTitles+" · bereits identisch: "+pf.identicalTitles+" · abweichend vorhanden: "+pf.conflictTitles.length);
            if(pf.conflictSegments.length)out.push("Abweichende vorhandene <en>: "+pf.conflictSegments.slice(0,20).join(", ")+(pf.conflictSegments.length>20?" …":""));
            if(pf.conflictBands.length)out.push("Abweichende vorhandene <band_en>: "+pf.conflictBands.slice(0,20).join(", ")+(pf.conflictBands.length>20?" …":""));
            if(pf.conflictTitles.length){out.push("Abweichende vorhandene <en_title>:");out=out.concat(limitedList(pf.conflictTitles,20));}
        }else{
            out.push("");out.push("Kein Band-Master gewählt: Die Datei wurde eigenständig geprüft.");
        }
        if(pf.errors.length){out.push("");out.push("FEHLER ("+pf.errors.length+") – bitte in der Banddatei korrigieren:");out=out.concat(limitedList(pf.errors));}
        if(pf.warnings.length){out.push("");out.push("HINWEISE ("+pf.warnings.length+") – kein Abbruchgrund:");out=out.concat(limitedList(pf.warnings));}
        out.push("");
        if(pf.errors.length)out.push("Es wurde nichts verändert.");
        else if(pf.masterFile)out.push("Nächster Schritt: 'In Band-Master übernehmen' oder – ohne Master-Schreibvorgang – 'Als InDesign-Quelle verwenden'.");
        else out.push("Nächster Schritt: 'Als InDesign-Quelle verwenden' und in Reiter 3 den Komplettband aufbauen und angleichen.");
        return out.join("\r\n");
    }

    function assertCompleteVolumeMergeable(pf,allowReplace){
        if(!pf.master)throw new Error("Für die Übernahme muss oben ein Band-Master gewählt sein.");
        if(pf.errors.length)throw new Error("Die Vorprüfung hat "+pf.errors.length+" Fehler gefunden. Der Master wurde nicht verändert. Details stehen im Statusfeld.");
        var conflicts=pf.conflictSegments.length+pf.conflictBands.length+pf.conflictTitles.length;
        if(conflicts&&!allowReplace)throw new Error("Der Master enthält bereits "+conflicts+" abweichende englische Fassung(en) ("+pf.conflictSegments.length+" <en>, "+pf.conflictBands.length+" <band_en>, "+pf.conflictTitles.length+" <en_title>).\nBestehende Übersetzungen werden standardmäßig nie überschrieben. Wenn der Komplettband maßgeblich sein soll, das Kästchen 'Abweichende vorhandene Übersetzungen im Master ersetzen' aktivieren.");
    }

    function completeMergeConfirmText(pf,allowReplace){
        var conflicts=pf.conflictSegments.length+pf.conflictBands.length+pf.conflictTitles.length,out=[];
        out.push("KOMPLETTBAND IN DEN MASTER ÜBERNEHMEN?");out.push("");
        out.push("Komplettband: "+pf.completeFile.displayName);out.push("Master: "+pf.masterFile.displayName);
        out.push("Segmente: "+pf.segmentCount+" · "+pf.firstId+" bis "+pf.lastId);
        out.push("EN neu: "+pf.newSegments+" · identisch: "+pf.identicalSegments+(conflicts?" · ERSETZT: "+pf.conflictSegments.length:""));
        out.push("Kopfbänder neu: "+pf.newBands+" · identisch: "+pf.identicalBands+(conflicts?" · ERSETZT: "+pf.conflictBands.length:""));
        out.push("Titel neu: "+pf.newTitles+" · identisch: "+pf.identicalTitles+(conflicts?" · ERSETZT: "+pf.conflictTitles.length:""));
        if(conflicts&&allowReplace){out.push("");out.push("ACHTUNG: "+conflicts+" vorhandene abweichende englische Fassung(en) werden durch den Komplettband ersetzt.");}
        out.push("");out.push("Hebräischer Text, IDs und Attribute bleiben unverändert. Es wird genau EINE Master-Sicherung erstellt und der Master genau EINMAL geschrieben. Offene Queue-Einträge werden auf MERGED gesetzt.");
        out.push("");out.push("Fortfahren?");return out.join("\n");
    }

    function markQueueCompleteVolume(masterFile,p,completeFile){
        var q=loadBatchQueue(masterFile,p),when=timestamp(),closed=0,i,r;normalizeBatchQueue(q,p);
        for(i=0;i<q.records.length;i++){
            r=q.records[i];
            if(r.status==="EXPORTED"||r.status==="MISSING"){
                // The exported batch file carries the exact ID range; that is all a
                // later Bulk-Layout lookup needs. The English now lives in the master.
                r.status="MERGED";r.mergedAt=when;r.mergedFile=(r.batchFile&&new File(r.batchFile).exists)?r.batchFile:"";closed++;
            }
        }
        addQueueRecord(q,{status:"MERGED",bulkId:"KOMPLETT-"+pad2(p.volume||1)+"-"+when,sequence:1,firstId:p.segments[0].id,lastId:p.segments[p.segments.length-1].id,
            segmentCount:p.segments.length,heChars:0,batchFile:"",exportedAt:"",mergedAt:when,mergedFile:completeFile.fsName});
        q.cursorId=p.segments[p.segments.length-1].id;
        var f=saveBatchQueue(q,masterFile,p);
        return {file:f,closed:closed,summary:batchQueueSummary(masterFile,p,q)};
    }

    function mergeCompleteVolume(masterFile,completeFile,prepared,allowReplace){
        var pf=prepared||preflightCompleteVolume(completeFile,masterFile);
        assertCompleteVolumeMergeable(pf,allowReplace);
        var master=pf.master,c=pf.complete,cMap={},i,s,target,replaced=0,filled=0,bandFilled=0,titleSet=0,titleSeen={},queueNote="",queueResult=null;
        for(i=0;i<c.segments.length;i++)cMap[c.segments[i].id]=c.segments[i];
        var conflicts=pf.conflictSegments.length+pf.conflictBands.length+pf.conflictTitles.length;
        if(!pf.newSegments&&!pf.newBands&&!pf.newTitles&&!conflicts&&(!c.tractate||master.tractate)){
            try{queueResult=markQueueCompleteVolume(masterFile,master,completeFile);queueNote=queueResult.summary;}catch(qe0){queueNote="WARNUNG: Queue-Status konnte nicht aktualisiert werden: "+errorText(qe0);}
            return "KOMPLETTBAND: Alle "+pf.segmentCount+" Segmente, Kopfbänder und Titel sind bereits identisch im Master. Kein Master-Schreibvorgang war nötig.\r\n\r\n"+queueNote;
        }
        var backup=new File(masterFile.parent.fsName+"/"+masterFile.displayName.replace(/\.txt$/i,"")+"_backup_KOMPLETTBAND_"+timestamp()+".txt");
        writeUTF8(backup,pf.masterRaw);
        for(i=0;i<master.segments.length;i++){
            target=master.segments[i];s=cMap[target.id];
            if(!trim(stripTags(target.en))){target.en=s.en;filled++;}
            else if(normalizeForCompare(target.en)!==normalizeForCompare(s.en)){target.en=s.en;replaced++;}
            if(trim(stripTags(s.bandEn||""))&&normalizeForCompare(target.bandEn||"")!==normalizeForCompare(s.bandEn)){if(!trim(stripTags(target.bandEn||"")))bandFilled++;else replaced++;target.bandEn=s.bandEn;}
            if(trim(s.sectionEn)&&normalizeForCompare(target.sectionEn)!==normalizeForCompare(s.sectionEn)){
                target.sectionEn=s.sectionEn;
                if(!titleSeen[normalizeForCompare(target.sectionHe)]){titleSeen[normalizeForCompare(target.sectionHe)]=true;titleSet++;}
            }
        }
        if(!master.tractate&&c.tractate)master.tractate=c.tractate;

        // Serialize and reparse in memory before the one and only master write.
        var mergedText=reserializeParsedBook(master),verified=parseBilingualFile(mergedText),vMap={},orig=parseBilingualFile(pf.masterRaw),oMap={};
        for(i=0;i<verified.segments.length;i++)vMap[verified.segments[i].id]=verified.segments[i];
        for(i=0;i<orig.segments.length;i++)oMap[orig.segments[i].id]=orig.segments[i];
        if(verified.segments.length!==orig.segments.length)throw new Error("Interne Komplett-Merge-Prüfung: Segmentzahl nach Serialisierung abweichend. Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
        for(i=0;i<c.segments.length;i++){
            s=c.segments[i];target=vMap[s.id];
            if(!target)throw new Error("Interne Komplett-Merge-Prüfung: Segment fehlt nach Serialisierung: "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
            if(normalizeForCompare(target.en)!==normalizeForCompare(s.en))throw new Error("Interne Komplett-Merge-Prüfung: <en> stimmt nach Serialisierung nicht bei "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
            if(normalizeForCompare(target.bandEn||"")!==normalizeForCompare(s.bandEn||""))throw new Error("Interne Komplett-Merge-Prüfung: <band_en> stimmt nach Serialisierung nicht bei "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
            if(normalizeForCompare(target.sectionEn)!==normalizeForCompare(s.sectionEn))throw new Error("Interne Komplett-Merge-Prüfung: <en_title> stimmt nach Serialisierung nicht bei "+s.id+". Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
            if(normalizeForCompare(target.he)!==normalizeForCompare(oMap[s.id].he)||normalizeForCompare(target.bandHe||"")!==normalizeForCompare(oMap[s.id].bandHe||""))
                throw new Error("Interne Komplett-Merge-Prüfung: Hebräischer Text würde sich bei "+s.id+" ändern. Der Master wurde nicht geschrieben. Sicherung: "+backup.fsName);
        }
        try{writeUTF8(masterFile,mergedText);}catch(we){throw new Error("Die Master-Sicherung wurde erstellt, aber der Master-Schreibvorgang ist fehlgeschlagen. Sicherung: "+backup.fsName+"\n\n"+errorText(we));}
        try{queueResult=markQueueCompleteVolume(masterFile,master,completeFile);queueNote="Queue: "+queueResult.closed+" offene Einträge auf MERGED gesetzt, Komplettband-Eintrag ergänzt.\r\n"+queueResult.summary;}
        catch(qe){queueNote="WARNUNG: Der Master wurde erfolgreich geschrieben, aber der Queue-Status konnte nicht aktualisiert werden: "+errorText(qe);}
        var out=[];out.push("KOMPLETTBAND ERFOLGREICH ÜBERNOMMEN");out.push("Komplettband: "+completeFile.fsName);out.push("Master: "+masterFile.fsName);
        out.push("Segmente geprüft: "+pf.segmentCount+" · "+pf.firstId+" bis "+pf.lastId);
        out.push("EN neu eingesetzt: "+filled+" · bereits identisch: "+pf.identicalSegments+" · ersetzt (EN/Kopfband): "+replaced);
        out.push("EN-Kopfbänder neu: "+bandFilled+" · Abschnittstitel gesetzt/geändert: "+titleSet);
        out.push("Master-Schreibvorgänge: 1");out.push("Master-Sicherung: "+backup.fsName);out.push("");out.push(queueNote);
        out.push("");out.push("Nächster Schritt: Reiter 3 · 'Komplettband: neuen Band erstellen + ganzen Band angleichen' (Quelle = dieser Master).");
        return out.join("\r\n");
    }

    // Build a fresh InDesign volume from a complete file and balance all of it
    // in one run. The build itself is the proven buildVolumeDocument(); the
    // balancing is the proven whole-volume path (runBulkLayoutGroup without EN
    // re-insertion), so no new layout mechanics are introduced here.
    function buildAndLayoutCompleteVolume(sourceFile,groupSize,locksText,statusField,progressField,fastMode,outcome){
        var built={},buildMsg,doc,whole,ready,layoutMsg;
        setStatus(progressField,"Aufbau …");
        buildMsg=buildVolumeDocument(sourceFile,statusField,built);
        doc=built.doc;
        if(!doc||!doc.isValid)throw new Error("Der neue InDesign-Band wurde nicht gefunden.");
        try{app.activeDocument=doc;}catch(_){}
        setStatus(statusField,buildMsg+"\r\n\r\nGesamtband-Abgleich wird vorbereitet …");
        try{
            whole=prepareFullVolumeLayoutGroup(doc,sourceFile,groupSize,1);
            ready=validateExistingEnglishFlowForBulkResume(doc,sourceFile,whole);
        }catch(pe){
            if(outcome){outcome.aborted=true;outcome.nextSequence=1;}
            return "KOMPLETTBAND · AUFBAU ERFOLGREICH, ABGLEICH NICHT GESTARTET\r\n"+buildMsg+"\r\n\r\nGrund: "+errorText(pe)+"\r\n\r\nDas gespeicherte Dokument kann geprüft und danach mit 'Ganzen Band angleichen · EN bereits vorhanden' (Start ab Gruppe 1) angeglichen werden.";
        }
        layoutMsg=runBulkLayoutGroup(doc,sourceFile,whole,locksText,statusField,progressField,fastMode,{skipEnglishUpdate:true,resumeValidation:ready,runOutcome:outcome});
        return "KOMPLETTBAND-LAUF\r\n\r\n1 · AUFBAU\r\n"+buildMsg+"\r\n\r\n2 · GESAMTBAND-ABGLEICH\r\n"+layoutMsg;
    }

    // ---------------- InDesign document building ----------------

    function buildVolumeDocument(sourceFile,statusField,out){
        var p=parseBilingualFile(readUTF8(sourceFile));
        var texts=composeDisplayTexts(p);
        var est=Math.ceil(Math.max(texts.heVisible/HE_CHARS_PER_PAGE,texts.enEstimated/EN_CHARS_PER_PAGE))+2;
        est=Math.max(4,Math.min(BODY_TARGET,est));

        requireProductionFonts();

        var oldRedraw=app.scriptPreferences.enableRedraw;
        app.scriptPreferences.enableRedraw=false;
        var doc=null;
        try{
            doc=app.documents.add();
            setupDocument(doc,p.volume||1);
            ensureStyles(doc);
            doc.insertLabel(DOC_VOLUME_LABEL,String(p.volume||1));
            doc.insertLabel(DOC_SOURCE_LABEL,sourceFile.fsName);
            setStatus(statusField,"Seitenrahmen werden vorbereitet: ca. "+est+" …");
            var chains=createPageChains(doc,est,statusField);
            insertTextChunked(chains.heFirst,texts.he,statusField,"Hebräisch");
            insertTextChunked(chains.enFirst,texts.en,statusField,"Englisch");
            formatStory(doc,chains.heFirst.parentStory,true);
            formatStory(doc,chains.enFirst.parentStory,false);
            recompose(doc);
            chains=ensureNoOverflow(doc,chains,statusField);
            trimEmptyTailPages(doc,chains,2);
            if(doc.pages.length>MAX_PAGES)throw new Error("Der Band hat "+doc.pages.length+" Seiten und überschreitet die Sperre.");

            // v2.0.18: a known tractate becomes part of the file name
            var tractToken=p.tractate?safeFileToken(p.tractate)+"_":"";
            var saveFile=uniqueFile(new File(sourceFile.parent.fsName+"/Ben_Yehoyada_"+tractToken+"Band_"+pad2(p.volume||1)+".indd"));
            doc.save(saveFile);
            if(out){out.doc=doc;out.file=saveFile;}
            return "Band "+pad2(p.volume||1)+" erstellt und gespeichert.\r\nSeiten: "+doc.pages.length+" / "+MAX_PAGES+"\r\nSegmente: "+p.segments.length+" · Englisch vorhanden: "+texts.translated+" · offen: "+texts.untranslated+"\r\nDatei: "+saveFile.fsName;
        }catch(e){
            if(doc&&doc.isValid){try{doc.insertLabel("BYH_BUILD_ERROR",errorText(e));}catch(_){}}
            throw e;
        }finally{app.scriptPreferences.enableRedraw=oldRedraw;try{app.redraw();}catch(_){}}
    }

    function setupDocument(doc,volume){
        // Explicit measurement strings prevent InDesign from interpreting
        // point values as millimetres (148 mm must never become 419.528 mm).
        try{
            doc.viewPreferences.horizontalMeasurementUnits=MeasurementUnits.MILLIMETERS;
            doc.viewPreferences.verticalMeasurementUnits=MeasurementUnits.MILLIMETERS;
        }catch(_){ }
        doc.documentPreferences.facingPages=true;
        doc.documentPreferences.pageWidth=mm(PAGE_W_MM);
        doc.documentPreferences.pageHeight=mm(PAGE_H_MM);
        doc.documentPreferences.pagesPerDocument=1;
        try{
            doc.documentPreferences.documentBleedUniformSize=true;
            doc.documentPreferences.documentBleedTopOffset=mm(0);
            doc.documentPreferences.documentBleedBottomOffset=mm(0);
            doc.documentPreferences.documentBleedInsideOrLeftOffset=mm(0);
            doc.documentPreferences.documentBleedOutsideOrRightOffset=mm(0);
        }catch(_){ }
        try{doc.viewPreferences.rulerOrigin=RulerOrigin.PAGE_ORIGIN;}catch(_){ }
        try{doc.documentPreferences.pageBinding=PageBindingOptions.LEFT_TO_RIGHT;}catch(_){ }
        try{
            var sec=doc.sections[0];sec.continueNumbering=false;sec.pageNumberStart=1;sec.sectionPrefix="";
        }catch(_){ }
        doc.pages[0].label="BYH_BODY_PAGE";
        setPageMargins(doc.pages[0]);
    }

    function createPageChains(doc,count,statusField){
        while(doc.pages.length<count)doc.pages.add();
        var heFirst=null,enFirst=null,heLast=null,enLast=null,heFrames=[],enFrames=[],i,page,pair;
        for(i=0;i<doc.pages.length;i++){
            page=doc.pages[i];pair=addBilingualFrames(page,i+1);
            if(heLast)heLast.nextTextFrame=pair.he;if(enLast)enLast.nextTextFrame=pair.en;
            if(!heFirst)heFirst=pair.he;if(!enFirst)enFirst=pair.en;
            heLast=pair.he;enLast=pair.en;heFrames.push(pair.he);enFrames.push(pair.en);
            if(i%25===0)setStatus(statusField,"Seitenrahmen "+(i+1)+" / "+count);
        }
        return {heFirst:heFirst,enFirst:enFirst,heLast:heLast,enLast:enLast,heFrames:heFrames,enFrames:enFrames};
    }

    function addBilingualFrames(page,pageNo){
        page.label="BYH_BODY_PAGE";
        setPageMargins(page);
        // v2.0.2: tatsächliche InDesign-Seitenseite statt bloßer Seitenzahl-Parität.
        // Der innere Satzrahmen liegt auf jeder Seite exakt 5 mm innerhalb der
        // Randhilfslinien. Rechts wird dieselbe Geometrie sauber gespiegelt.
        var he=page.textFrames.add();he.geometricBounds=pageBounds(HE_BOUNDS_MM,pageNo,page);he.label=FRAME_HE_LABEL;
        var en=page.textFrames.add();en.geometricBounds=pageBounds(EN_BOUNDS_MM,pageNo,page);en.label=FRAME_EN_LABEL;
        setFrameInsets(he,0);setFrameInsets(en,0);
        try{he.textFramePreferences.verticalJustification=VerticalJustification.TOP_ALIGN;en.textFramePreferences.verticalJustification=VerticalJustification.TOP_ALIGN;}catch(_){ }

        // Die Trenn-/Kopflinie folgt exakt der horizontalen Satzrahmenbreite.
        var ruleBounds=pageBounds([RULE_Y_MM,FRAME_LEFT_MM,RULE_Y_MM,FRAME_RIGHT_MM],pageNo,page);
        var line=page.graphicLines.add();line.paths[0].entirePath=[[ruleBounds[1],ruleBounds[0]],[ruleBounds[3],ruleBounds[2]]];line.strokeWeight=0.5;line.strokeColor=blackSwatch(page.parent.parent);
        var num=page.textFrames.add();
        // v2.0.3: Seitenzahl außen im Fußsteg statt im Kopfbereich.
        // Der untere Textrahmen endet bei 229 mm; zwischen Textrahmen und
        // Randhilfslinie bleiben 5 mm frei. Die Seitenzahl selbst sitzt
        // darunter im Fußsteg bei 237–245 mm.
        num.geometricBounds=pageBounds([PAGE_NO_TOP_MM,FRAME_LEFT_MM,PAGE_NO_BOTTOM_MM,FRAME_LEFT_MM+PAGE_NO_WIDTH_MM],pageNo,page);
        num.label="BYH_PAGE_NUMBER";
        try{num.insertionPoints[0].contents=SpecialCharacters.AUTO_PAGE_NUMBER;}catch(_){num.contents=String(pageNo);}
        num.texts[0].pointSize=8;num.texts[0].appliedFont=safeFont(EN_FONT,EN_FONT_STYLE);
        num.texts[0].justification=(pageNo%2===0)?Justification.LEFT_ALIGN:Justification.RIGHT_ALIGN;
        try{num.textFramePreferences.verticalJustification=VerticalJustification.CENTER_ALIGN;}catch(_){ }
        return {he:he,en:en};
    }

    function ensureNoOverflow(doc,chains,statusField){
        chains=collectChains(doc);
        var repair=repairBilingualThreading(chains);
        if(repair.repaired){
            recompose(doc);
            setStatus(statusField,"Textfluss repariert · "+repair.repaired+" Verknüpfung(en)");
        }
        refreshChainEnds(chains);

        var guard=0;
        while((storyOverflows(chains.heFirst)||storyOverflows(chains.enFirst))&&doc.pages.length<MAX_PAGES){
            var add=Math.min(PAGE_BATCH,MAX_PAGES-doc.pages.length);
            appendBilingualPages(doc,chains,add,statusField);
            recompose(doc);
            guard++;
            setStatus(statusField,"Übersatz wird automatisch aufgelöst · "+doc.pages.length+" / "+MAX_PAGES+" Seiten");
            if(guard>60)break;
        }
        if(storyOverflows(chains.heFirst)||storyOverflows(chains.enFirst)){
            throw new Error("600-Seiten-Sperre erreicht. Der Band muss vor dem letzten vollständig passenden Segment geteilt werden.");
        }
        return chains;
    }

    function repairBilingualThreading(chains){
        var a=repairFrameSequence(chains.heFrames,"Hebräisch");
        var b=repairFrameSequence(chains.enFrames,"Englisch");
        refreshChainEnds(chains);
        return {repaired:a.repaired+b.repaired,he:a,en:b};
    }

    function repairFrameSequence(frames,label){
        var repaired=0,conflicts=[],i,prev,curr,nx,pr;
        for(i=1;i<frames.length;i++){
            prev=frames[i-1];curr=frames[i];
            nx=safeNextTextFrame(prev);pr=safePreviousTextFrame(curr);
            if(sameObject(nx,curr))continue;

            // The common failure case is a broken thread: the previous frame
            // ends the story although the following BIH frame is present and empty.
            if(!isValidTextFrame(nx) && !isValidTextFrame(pr)){
                if(frameHasText(curr)){
                    conflicts.push(label+" Seite "+safePageName(curr)+": separater Text vorhanden");
                    continue;
                }
                try{prev.nextTextFrame=curr;repaired++;continue;}catch(e){
                    conflicts.push(label+" Seite "+safePageName(curr)+": "+errorText(e));
                    continue;
                }
            }

            // Do not destroy an existing non-standard link automatically.
            if(!sameObject(nx,curr)){
                conflicts.push(label+" zwischen Seite "+safePageName(prev)+" und "+safePageName(curr));
            }
        }
        return {repaired:repaired,conflicts:conflicts};
    }

    function appendBilingualPages(doc,chains,count,statusField){
        count=positiveInt(count,1);
        if(doc.pages.length+count>MAX_PAGES){
            throw new Error("Es können nur noch "+(MAX_PAGES-doc.pages.length)+" Seite(n) hinzugefügt werden. Maximale Bandlänge: "+MAX_PAGES+".");
        }
        refreshChainEnds(chains);
        if(!chains.heLast||!chains.enLast)throw new Error("Die HE/EN-Textketten konnten nicht bestimmt werden.");

        var i,page,pair;
        for(i=0;i<count;i++){
            page=doc.pages.add();
            pair=addBilingualFrames(page,doc.pages.length);
            try{chains.heLast.nextTextFrame=pair.he;}catch(eh){throw new Error("Hebräischer Textfluss konnte auf Seite "+doc.pages.length+" nicht verkettet werden: "+errorText(eh));}
            try{chains.enLast.nextTextFrame=pair.en;}catch(ee){throw new Error("Englischer Textfluss konnte auf Seite "+doc.pages.length+" nicht verkettet werden: "+errorText(ee));}
            chains.heLast=pair.he;chains.enLast=pair.en;
            chains.heFrames.push(pair.he);chains.enFrames.push(pair.en);
            if(i%12===0)setStatus(statusField,"Seiten werden ergänzt · "+doc.pages.length+" / "+MAX_PAGES);
        }
        return chains;
    }

    function addBilingualPagesToActiveDocument(doc,count,statusField){
        if(!doc||!doc.isValid)throw new Error("Kein gültiges InDesign-Dokument geöffnet.");
        var chains=collectChains(doc);
        if(!chains.heFirst||!chains.enFirst)throw new Error("Keine BYH-HE/EN-Textrahmen gefunden.");

        var repair=repairBilingualThreading(chains);
        appendBilingualPages(doc,chains,count,statusField);
        recompose(doc);
        try{doc.save();}catch(_){}

        return count+" Seite(n) mit vollständig verketteten HE/EN-Textrahmen hinzugefügt."+
            (repair.repaired?"\r\nVorher reparierte Textverknüpfungen: "+repair.repaired+".":"")+
            "\r\nSeiten: "+doc.pages.length+" / "+MAX_PAGES+
            "\r\nHebräisch-Übersatz: "+(storyOverflows(chains.heFirst)?"JA":"nein")+
            "\r\nEnglisch-Übersatz: "+(storyOverflows(chains.enFirst)?"JA":"nein");
    }

    function autoRepairAndExpandActiveDocument(doc,statusField){
        if(!doc||!doc.isValid)throw new Error("Kein gültiges InDesign-Dokument geöffnet.");
        var before=doc.pages.length,chains=collectChains(doc);
        if(!chains.heFirst||!chains.enFirst)throw new Error("Keine BYH-HE/EN-Textrahmen gefunden.");

        var repair=repairBilingualThreading(chains);
        recompose(doc);
        chains=ensureNoOverflow(doc,chains,statusField);
        var added=doc.pages.length-before;
        try{doc.save();}catch(_){}

        var out=[];
        out.push("Automatische Textflussprüfung abgeschlossen.");
        out.push("Reparierte Verknüpfungen: "+repair.repaired+".");
        out.push("Automatisch hinzugefügte Seiten: "+added+".");
        out.push("Seiten: "+doc.pages.length+" / "+MAX_PAGES+".");
        out.push("Hebräisch-Übersatz: "+(storyOverflows(chains.heFirst)?"JA":"nein")+".");
        out.push("Englisch-Übersatz: "+(storyOverflows(chains.enFirst)?"JA":"nein")+".");
        if(repair.he.conflicts.length||repair.en.conflicts.length){
            out.push("Hinweis: Es bestehen nicht automatisch veränderbare Sonderverknüpfungen. Bitte 'Aktiven Band prüfen' verwenden.");
        }
        return out.join("\r\n");
    }

    function refreshChainEnds(chains){
        if(chains.heFirst)chains.heLast=actualLastTextFrame(chains.heFirst);
        if(chains.enFirst)chains.enLast=actualLastTextFrame(chains.enFirst);
        return chains;
    }

    function actualLastTextFrame(first){
        var cur=first,next=null,guard=0;
        while(cur&&cur.isValid&&guard<MAX_PAGES+100){
            next=safeNextTextFrame(cur);
            if(!isValidTextFrame(next))return cur;
            cur=next;guard++;
        }
        return cur;
    }

    function safeNextTextFrame(tf){
        try{return tf.nextTextFrame;}catch(_){return null;}
    }

    function safePreviousTextFrame(tf){
        try{return tf.previousTextFrame;}catch(_){return null;}
    }

    function isValidTextFrame(tf){
        try{return !!(tf&&tf.isValid);}catch(_){return false;}
    }

    function sameObject(a,b){
        if(!isValidTextFrame(a)||!isValidTextFrame(b))return false;
        try{return a.id===b.id;}catch(_){return a===b;}
    }

    function safePageName(tf){
        try{return tf.parentPage.name;}catch(_){return "?";}
    }

    function trimEmptyTailPages(doc,chains,keepBlank){
        var removed=0;
        while(doc.pages.length>2+keepBlank&&chains.heFrames.length&&chains.enFrames.length){
            var hi=chains.heFrames.length-1,ei=chains.enFrames.length-1;
            if(frameHasText(chains.heFrames[hi])||frameHasText(chains.enFrames[ei]))break;
            try{doc.pages[doc.pages.length-1].remove();chains.heFrames.pop();chains.enFrames.pop();removed++;}catch(_){break;}
        }
        if(chains.heFrames.length)chains.heLast=chains.heFrames[chains.heFrames.length-1];
        if(chains.enFrames.length)chains.enLast=chains.enFrames[chains.enFrames.length-1];
        return removed;
    }

    function updateHebrewInActiveDocument(sourceFile,statusField){
        requireProductionFonts();
        var doc=app.activeDocument,p=parseBilingualFile(readUTF8(sourceFile)),texts=composeDisplayTexts(p);
        var expected=doc.extractLabel(DOC_VOLUME_LABEL),actual=String(p.volume||1);
        if(expected&&expected!==actual)throw new Error("Aktiver Band "+expected+" passt nicht zur Quelldatei Band "+actual+".");

        var chains=collectChains(doc);
        if(!chains.heFirst)throw new Error("Keine mit "+FRAME_HE_LABEL+" markierten Hebräischrahmen gefunden.");
        if(!chains.enFirst)throw new Error("Keine mit "+FRAME_EN_LABEL+" markierten Englischrahmen gefunden.");

        var backup=createInDesignBackup(doc,"HE_update");
        var pagesBefore=doc.pages.length;
        chains.heFirst.parentStory.contents="";
        insertTextChunked(chains.heFirst,texts.he,statusField,"Hebräisch");
        formatStory(doc,chains.heFirst.parentStory,true);
        recompose(doc);
        chains=ensureNoOverflow(doc,chains,statusField);
        doc.insertLabel(DOC_SOURCE_LABEL,sourceFile.fsName);
        doc.save();

        return "Hebräisch aktualisiert.\r\n"+
            "Bestehende Rahmen und Seitenpositionen wurden beibehalten.\r\n"+
            "Seiten: "+doc.pages.length+" / "+MAX_PAGES+
            (doc.pages.length>pagesBefore?" · automatisch hinzugefügt: "+(doc.pages.length-pagesBefore):"")+"\r\n"+
            "Segment-IDs: "+p.segments.length+"\r\n"+
            "Sicherung: "+backup.fsName;
    }

    function createInDesignBackup(doc,suffix){
        var original;
        try{original=doc.fullName;}catch(_){original=null;}
        if(!original||!original.exists){
            throw new Error("Der aktive InDesign-Band muss vor dieser Änderung einmal gespeichert werden.");
        }
        var base=original.displayName.replace(/\.indd$/i,"");
        var backup=uniqueFile(new File(original.parent.fsName+"/"+base+"_backup_"+suffix+"_"+timestamp()+".indd"));
        try{doc.saveACopy(backup);}catch(e){throw new Error("INDD-Sicherung konnte nicht angelegt werden: "+errorText(e));}
        if(!backup.exists)throw new Error("INDD-Sicherung wurde nicht gefunden. Die Aktualisierung wurde nicht begonnen.");
        return backup;
    }

    function updateEnglishInActiveDocument(sourceFile,statusField){
        requireProductionFonts();
        var doc=app.activeDocument,p=parseBilingualFile(readUTF8(sourceFile)),texts=composeDisplayTexts(p);
        var expected=doc.extractLabel(DOC_VOLUME_LABEL),actual=String(p.volume||1);
        if(expected&&expected!==actual)throw new Error("Aktiver Band "+expected+" passt nicht zur Quelldatei Band "+actual+".");
        var chains=collectChains(doc);
        if(!chains.enFirst)throw new Error("Keine mit "+FRAME_EN_LABEL+" markierten Englischrahmen gefunden.");
        chains.enFirst.parentStory.contents="";
        insertTextChunked(chains.enFirst,texts.en,statusField,"Englisch");
        var formatInfo=formatStory(doc,chains.enFirst.parentStory,false,statusField);recompose(doc);
        chains=ensureNoOverflow(doc,chains,statusField);trimEmptyTailPages(doc,chains,2);
        doc.insertLabel(DOC_SOURCE_LABEL,sourceFile.fsName);doc.save();
        return "Englisch aktualisiert.\r\nSeiten: "+doc.pages.length+" / "+MAX_PAGES+"\r\nÜbersetzt: "+texts.translated+" · offen: "+texts.untranslated+
            "\r\nRedundante reine Quellen-Fußnoten unterdrückt: "+Number(formatInfo&&formatInfo.removedRedundantSourceFootnotes||0)+
            "\r\nSegment-IDs: "+p.segments.length;
    }

    // ---------------- Bulk InDesign layout group ----------------

    function readBulkManifest(file){
        if(!file||!file.exists)throw new Error("Bulk-Manifest nicht gefunden: "+(file?file.fsName:"?"));
        var raw=normalizeNewlines(readUTF8(file)),lines=raw.split("\n"),meta={},rows=[],inRows=false,i,parts;
        if(!lines.length||lines[0].split("\t")[0]!=="BYH_BULK_MANIFEST")throw new Error("Die gewählte TSV ist kein BYH_BULK_MANIFEST.");
        for(i=1;i<lines.length;i++){
            parts=lines[i].split("\t");if(!parts.length||!parts[0])continue;
            if(parts[0]==="sequence"&&parts[1]==="status"){inRows=true;continue;}
            if(!inRows){meta[parts[0]]=parts.slice(1).join("\t");continue;}
            if(parts.length<7)continue;
            rows.push({sequence:parseInt(parts[0],10)||0,status:parts[1]||"",firstId:parts[2]||"",lastId:parts[3]||"",
                segmentCount:parseInt(parts[4],10)||0,heChars:parseInt(parts[5],10)||0,batchFile:parts.slice(6).join("\t")||""});
        }
        if(!meta.bulk_id)throw new Error("Bulk-Manifest enthält keine bulk_id.");
        if(!rows.length)throw new Error("Bulk-Manifest enthält keine Batch-Zeilen.");
        return {file:file,meta:meta,rows:rows,bulkId:meta.bulk_id,volume:parseInt(meta.volume,10)||0};
    }

    // v2.0.12: a completed master is sufficient for a whole-volume layout run.
    // The generated range files are audit inputs only. Neither the master nor
    // its BatchQueue is modified, and no MERGED queue state is required.
    // v2.0.18: groupSize and startGroup are optional. startGroup > 1 resumes an
    // aborted whole-volume run; all groups are still written to the audit folder,
    // but only the groups from startGroup onward are returned for layout.
    function prepareFullVolumeLayoutGroup(doc,masterFile,groupSize,startGroup){
        var saved=null;
        try{saved=doc.fullName;}catch(_){saved=null;}
        if(!saved||!saved.exists)throw new Error("Bitte den neu erstellten InDesign-Band vor dem Gesamtband-Abgleich speichern.");
        var p=parseBilingualFile(readUTF8(masterFile));
        var expected=doc.extractLabel(DOC_VOLUME_LABEL),actual=String(p.volume||1);
        if(expected&&expected!==actual)throw new Error("Aktiver InDesign-Band "+expected+" passt nicht zur Banddatei "+actual+".");
        var text=readUTF8(masterFile),blocks=[],rx=/<segment\b[^>]*>[\s\S]*?<\/segment>/ig,m,i,j,idM;
        while((m=rx.exec(text))!==null)blocks.push(m[0]);
        if(blocks.length!==p.segments.length)throw new Error("Die Segmente im Band-Master konnten nicht eindeutig eingelesen werden.");
        for(i=0;i<p.segments.length;i++){
            idM=/\bid=["']([^"']+)["']/.exec(blocks[i]);
            if(!idM||idM[1]!==p.segments[i].id)throw new Error("Die Reihenfolge der BYH-IDs stimmt an Segment "+(i+1)+" nicht.");
            if(!trim(stripTags(p.segments[i].en||"")))
                throw new Error("Der gewählte Band-Master ist noch nicht vollständig englisch gefüllt: "+p.segments[i].id+". Für einen Gesamtband-Abgleich muss zuerst die zusammengeführte BILINGUAL-Datei gewählt werden.");
        }
        var base=new Folder(saved.parent.fsName+"/BYH_Layout_Snapshots");
        if(!base.exists&&!base.create())throw new Error("Der Ordner für Layout-Protokolle konnte nicht erstellt werden: "+base.fsName);
        var runId="VOLL-"+timestamp(),path=base.fsName+"/Vollband_"+runId,folder=new Folder(path),suffix=2;
        while(folder.exists){folder=new Folder(path+"_"+suffix);suffix++;}
        if(!folder.create())throw new Error("Der Ordner für die Gesamtband-Bereiche konnte nicht erstellt werden: "+folder.fsName);
        var items=[],log=["BYH_FULL_VOLUME_LAYOUT\t1","run_id\t"+runId,"source\t"+masterFile.fsName,
            "segment_count\t"+p.segments.length],size=Math.max(1,Math.floor(Number(groupSize)||COMPLETE_LAYOUT_GROUP_DEFAULT)),part=0,start,end,lines,file,firstId,lastId;
        var totalGroups=Math.ceil(blocks.length/size),startSeq=Math.max(1,Math.floor(Number(startGroup)||1));
        if(startSeq>totalGroups)throw new Error("Start ab Gruppe "+startSeq+" ist zu groß: Bei "+size+" Segmenten je Gruppe hat dieser Band nur "+totalGroups+" Layout-Gruppen.");
        log.push("group_size\t"+size);log.push("total_groups\t"+totalGroups);log.push("start_group\t"+startSeq);log.push("sequence\tfirst_id\tlast_id\tfile");
        for(start=0;start<blocks.length;start+=size){
            end=Math.min(blocks.length,start+size);part++;
            firstId=p.segments[start].id;lastId=p.segments[end-1].id;
            file=new File(folder.fsName+"/Layout_Range_"+pad2(part)+"_"+firstId+"_bis_"+lastId+".txt");
            lines=["<translation_batch project=\"Ben Yehoyada\" volume=\""+pad2(p.volume||1)+"\">"];
            for(j=start;j<end;j++)lines.push(blocks[j]);
            lines.push("</translation_batch>");writeUTF8(file,lines.join("\r\n"));
            if(part>=startSeq)items.push({sequence:part,firstId:firstId,lastId:lastId,startIndex:start,endIndex:end-1,
                file:file,segmentCount:end-start});
            log.push(part+"\t"+firstId+"\t"+lastId+"\t"+file.fsName+(part<startSeq?"\t(bereits angeglichen · übersprungen)":""));
        }
        var manifest=new File(folder.fsName+"/Vollband_Layout_Bereiche.tsv");writeUTF8(manifest,log.join("\r\n"));
        return {manifestFile:manifest,bulkId:runId,volume:p.volume||1,masterFile:masterFile,
            items:items,firstId:items[0].firstId,lastId:items[items.length-1].lastId,
            segmentCount:p.segments.length,queueFile:null,
            isFullVolume:true,groupSize:size,totalGroups:totalGroups,startGroup:startSeq};
    }

    function loadBulkLayoutGroup(manifestFile,masterFile){
        var manifest=readBulkManifest(manifestFile),p=parseBilingualFile(readUTF8(masterFile));
        if(manifest.volume&&p.volume&&manifest.volume!==p.volume)throw new Error("Bulk-Manifest gehört zu Band "+manifest.volume+", die gewählte Banddatei aber zu Band "+p.volume+".");
        var masterIndex={},masterMap={},i,j,r,row,match,file,batch,items=[],prevEnd=-1;
        for(i=0;i<p.segments.length;i++){masterIndex[p.segments[i].id]=i;masterMap[p.segments[i].id]=p.segments[i];}
        var q=loadBatchQueue(masterFile,p);normalizeBatchQueue(q,p);
        for(i=0;i<manifest.rows.length;i++){
            row=manifest.rows[i];match=null;
            // First choice: exact queue member of this Bulk-ID and sequence/range.
            for(j=0;j<q.records.length;j++){
                r=q.records[j];
                if(r.bulkId===manifest.bulkId&&r.firstId===row.firstId&&r.lastId===row.lastId&&r.status==="MERGED"){match=r;break;}
            }
            // Compatibility fallback: exact merged range, even if an older merge lost the Bulk-ID.
            if(!match){for(j=0;j<q.records.length;j++){r=q.records[j];if(r.firstId===row.firstId&&r.lastId===row.lastId&&r.status==="MERGED"){match=r;break;}}}
            if(!match)throw new Error("Für "+row.firstId+" bis "+row.lastId+" existiert kein MERGED-Queue-Eintrag. Zuerst den gemeinsamen Bulk-Merge vollständig ausführen.");
            if(!match.mergedFile)throw new Error("Queue-Eintrag "+row.firstId+" bis "+row.lastId+" enthält keinen Pfad zur zurückgeführten _EN_FERTIG-Datei.");
            file=new File(match.mergedFile);if(!file.exists)throw new Error("_EN_FERTIG-Datei aus der Queue wurde nicht gefunden: "+match.mergedFile);
            batch=parseBilingualFile(wrapBatchAsBook(readUTF8(file)));
            if(batch.volume&&p.volume&&batch.volume!==p.volume)throw new Error(file.displayName+": falscher Band für den Bulk-Layoutlauf.");
            if(!batch.segments.length)throw new Error(file.displayName+": keine BYH-Segmente enthalten.");
            if(batch.segments[0].id!==row.firstId||batch.segments[batch.segments.length-1].id!==row.lastId)
                throw new Error(file.displayName+": BYH-Bereich stimmt nicht mit dem Bulk-Manifest überein (Manifest "+row.firstId+"–"+row.lastId+").");
            var start=masterIndex[row.firstId],end=masterIndex[row.lastId];
            if(start===undefined||end===undefined)throw new Error("Manifest-ID ist im gewählten Master nicht vorhanden: "+row.firstId+" / "+row.lastId);
            for(j=0;j<batch.segments.length;j++){
                var bs=batch.segments[j],ms=masterMap[bs.id];
                if(!ms)throw new Error(file.displayName+": "+bs.id+" fehlt im Master.");
                if(!trim(stripTags(ms.en)))throw new Error(file.displayName+": "+bs.id+" ist im Master noch nicht englisch gefüllt. Zuerst Bulk-Merge ausführen.");
            }
            items.push({sequence:row.sequence,firstId:row.firstId,lastId:row.lastId,startIndex:start,endIndex:end,file:file,queue:match,segmentCount:batch.segments.length});
        }
        items.sort(function(a,b){return a.startIndex-b.startIndex;});
        for(i=0;i<items.length;i++){
            if(i>0&&items[i].startIndex<=prevEnd)throw new Error("Bulk-Gruppe enthält überlappende oder nicht eindeutig getrennte ID-Bereiche bei "+items[i].firstId+".");
            prevEnd=items[i].endIndex;
        }
        return {manifestFile:manifestFile,manifest:manifest,bulkId:manifest.bulkId,volume:p.volume||manifest.volume,masterFile:masterFile,
            items:items,firstId:items[0].firstId,lastId:items[items.length-1].lastId,queueFile:batchQueueFile(masterFile)};
    }

    function bulkLayoutGroupSummary(g){
        var out=[];out.push("BULK-LAYOUT GRUPPE GELADEN");out.push("Bulk-ID: "+g.bulkId);out.push("Manifest: "+g.manifestFile.fsName);
        out.push("Batches: "+g.items.length);out.push("BYH-Bereich: "+g.firstId+" bis "+g.lastId);out.push("Queue: "+g.queueFile.fsName);out.push("");
        for(var i=0;i<g.items.length;i++)out.push(pad2(i+1)+" · "+g.items[i].firstId+" bis "+g.items[i].lastId+" · "+g.items[i].file.displayName);
        out.push("");out.push("Alle zugehörigen Queue-Einträge stehen auf MERGED und die _EN_FERTIG-Dateien wurden gefunden. Für einen frischen Lauf kann Englisch einmal aktualisiert werden; nach einem bereits erfolgten EN-Aufbau kann v2.0.11 den vorhandenen Textfluss validieren und nur den Layout-Abgleich fortsetzen.");
        return out.join("\r\n");
    }

    function bulkLayoutConfirmText(g,locksText,fastMode,skipEnglishUpdate){
        var resume=!!skipEnglishUpdate,out=[];
        out.push(resume?"BULK-LAYOUT FORTSETZEN?":"BULK-LAYOUT STARTEN?");out.push("");out.push("Bulk-ID: "+g.bulkId);out.push("Batches: "+g.items.length);
        out.push("BYH-Bereich: "+g.firstId+" bis "+g.lastId);out.push("Modus: "+(fastMode?"Schnellmodus":"Präzisionsmodus"));
        out.push("Geschützte Seiten: "+(trim(locksText)||"keine"));out.push("");
        out.push("Ablauf:");out.push("1. Eine gemeinsame INDD-Sicherung für den gesamten Lauf.");
        if(resume){
            out.push("2. Vorhandenen englischen InDesign-Textfluss gegen den aktuellen Master prüfen; KEIN erneutes Einspielen.");
        }else{
            out.push("2. Englischen Textfluss genau EINMAL aus dem aktuellen Master aktualisieren.");
        }
        out.push("3. Jeden Batch in aufsteigender BYH-ID-Reihenfolge neu lokalisieren, analysieren und angleichen.");
        out.push("4. Bei HE- oder EN-Übersatz: automatisch vollständige zweisprachige Seiten ergänzen, neu komponieren und erneut prüfen.");
        out.push("   Abbruch nur bei einem nicht sicher lösbaren Layoutzustand oder an der 600-Seiten-Grenze.");
        out.push("5. Divider hart auf HE 111–141 mm / EN 114–144 mm begrenzen; normale Segmentangleichung darf diese Grenze nicht überschreiten.");out.push("6. Daf-Titel als harte Abschlussbedingung prüfen und BYH-ID-Anker dauerhaft protokollieren.");
        out.push("");out.push("Fortfahren?");return out.join("\n");
    }

    function assertNoLayoutOverflow(doc,context){
        var chains=collectChains(doc);if(!chains.heFirst||!chains.enFirst)throw new Error("HE/EN-Textrahmenketten wurden nicht gefunden"+(context?" ("+context+")":"")+".");
        var ho=storyOverflows(chains.heFirst),eo=storyOverflows(chains.enFirst);
        if(ho||eo)throw new Error("SICHERHEITSABBRUCH WEGEN ÜBERSATZ"+(context?" · "+context:"")+". Hebräisch: "+(ho?"JA":"nein")+" · Englisch: "+(eo?"JA":"nein")+".");
    }

    function normalizedPathForCompare(s){
        return String(s||"").replace(/\\/g,"/").replace(/\/+$/,"").toLowerCase();
    }

    function bulkResumeMastersEquivalent(oldFile,newFile,g){
        if(!oldFile||!oldFile.exists||!newFile||!newFile.exists)return false;
        var a=parseBilingualFile(readUTF8(oldFile)),b=parseBilingualFile(readUTF8(newFile)),am={},bm={},i,s,inside=false;
        for(i=0;i<a.segments.length;i++)am[a.segments[i].id]=a.segments[i];
        for(i=0;i<b.segments.length;i++)bm[b.segments[i].id]=b.segments[i];
        for(i=0;i<b.segments.length;i++){
            s=b.segments[i];
            if(s.id===g.firstId)inside=true;
            if(inside){
                if(!am[s.id]||!bm[s.id])return false;
                if(normalizeForCompare(am[s.id].en||"")!==normalizeForCompare(bm[s.id].en||""))return false;
                if(normalizeForCompare(am[s.id].bandEn||"")!==normalizeForCompare(bm[s.id].bandEn||""))return false;
                if(normalizeForCompare(am[s.id].sectionEn||"")!==normalizeForCompare(bm[s.id].sectionEn||""))return false;
            }
            if(s.id===g.lastId)break;
        }
        return inside;
    }

    function validateExistingEnglishFlowForBulkResume(doc,sourceFile,g){
        var sourcePath="",currentPath="",p,chains,enMap,heMap,i,idx={},start=-1,end=-1,translated=0,pathNote="";
        try{sourcePath=doc.extractLabel(DOC_SOURCE_LABEL)||"";}catch(_){sourcePath="";}
        currentPath=sourceFile&&sourceFile.exists?sourceFile.fsName:"";
        if(sourcePath&&currentPath&&normalizedPathForCompare(sourcePath)!==normalizedPathForCompare(currentPath)){
            var previousMaster=new File(sourcePath);
            if(!bulkResumeMastersEquivalent(previousMaster,sourceFile,g)){
                throw new Error("FORTSETZEN nicht sicher: Der im InDesign-Dokument gespeicherte BILINGUAL-Master ist ein anderer als die aktuell gewählte Datei und konnte für den Bulk-Bereich nicht als inhaltsgleich bestätigt werden.\nDokument: "+sourcePath+"\nGewählt: "+currentPath+"\nBitte die beim EN-Aufbau verwendete Masterdatei wählen oder den frischen Bulk-Lauf mit EN-Aktualisierung verwenden.");
            }
            pathNote=" · Masterdatei wurde umbenannt/verschoben, Bulk-Inhalt ist aber identisch";
        }
        p=parseBilingualFile(readUTF8(sourceFile));
        chains=collectChains(doc);
        if(!chains.heFirst||!chains.enFirst)throw new Error("FORTSETZEN nicht möglich: HE/EN-Textrahmenketten wurden nicht gefunden.");
        assertNoLayoutOverflow(doc,"Vorprüfung Bulk-Fortsetzen");
        // mapStorySegmentsToPages is intentionally strict: it verifies the complete
        // translated master order through the visible [n] paragraph markers.
        heMap=mapStorySegmentsToPages(chains.heFirst.parentStory,p.segments,false);
        enMap=mapStorySegmentsToPages(chains.enFirst.parentStory,p.segments,true);
        for(i=0;i<p.segments.length;i++){
            idx[p.segments[i].id]=i;
            if(trim(stripTags(p.segments[i].en||"")))translated++;
        }
        if(idx[g.firstId]===undefined||idx[g.lastId]===undefined)throw new Error("FORTSETZEN nicht möglich: Der Bulk-Bereich ist im aktuellen Master nicht vollständig vorhanden.");
        start=idx[g.firstId];end=idx[g.lastId];
        for(i=start;i<=end;i++){
            if(trim(stripTags(p.segments[i].en||""))&&!enMap[p.segments[i].id])
                throw new Error("FORTSETZEN nicht sicher: Englische ID "+p.segments[i].id+" wurde im bestehenden InDesign-Textfluss nicht gefunden.");
            if(!heMap[p.segments[i].id])
                throw new Error("FORTSETZEN nicht sicher: Hebräische ID "+p.segments[i].id+" wurde im bestehenden InDesign-Textfluss nicht gefunden.");
        }
        return {translated:translated,firstId:g.firstId,lastId:g.lastId,sourcePath:sourcePath||currentPath,
            summary:"OK · vorhandener EN-Textfluss passt zur Master-Reihenfolge · "+g.firstId+" bis "+g.lastId+" vorhanden · EN wird nicht neu aufgebaut"+pathNote};
    }

    function createBulkLayoutProtocolFile(doc,g){
        var original;try{original=doc.fullName;}catch(_){original=null;}if(!original||!original.exists)throw new Error("Der aktive InDesign-Band muss vor dem Bulk-Lauf gespeichert sein.");
        var folder=new Folder(original.parent.fsName+"/BYH_Layout_Snapshots");if(!folder.exists&&!folder.create())throw new Error("Protokollordner konnte nicht erstellt werden: "+folder.fsName);
        return uniqueFile(new File(folder.fsName+"/Bulk_Layout_Run_"+safeFileToken(g.bulkId)+"_"+timestamp()+".txt"));
    }

    function writeBulkLayoutProtocol(file,lines){writeUTF8(file,lines.join("\r\n"));}

    function runBulkLayoutGroup(doc,sourceFile,g,locksText,statusField,progressField,fastMode,options){
        options=options||{};var skipEnglishUpdate=!!options.skipEnglishUpdate;
        var started=new Date().getTime(),total=g.items.length,i,item,preview,ranges,anchorBefore,result,completed=0;
        // v2.0.18: whole-volume runs report absolute group numbers so that a
        // resumed run ("Start ab Gruppe") stays readable in progress and protocol.
        var runOutcome=options.runOutcome||null;
        function groupLabel(k){return (g.isFullVolume&&g.totalGroups)?("Gruppe "+g.items[k].sequence+" / "+g.totalGroups):((k+1)+" / "+total);}
        var totalLayoutAddedPages=0,enUpdateAddedPages=0,enUpdateCount=0,startPageCount=doc.pages.length;
        // Physical page span actually touched by this Bulk group.  It is built from
        // every freshly re-localized batch analysis, because earlier layout changes
        // and appended pages can move later BIH ranges to different pages.
        var bulkPageMin=0,bulkPageMax=0;
        // A single safety copy is intentionally created BEFORE any EN update or resume-layout change.
        var backup=createInDesignBackup(doc,"BULK_layout_"+safeFileToken(g.firstId)+"_"+safeFileToken(g.lastId));
        var protocol=createBulkLayoutProtocolFile(doc,g),log=[];
        log.push("BEN YEHOYADA · BULK-LAYOUT LAUFPROTOKOLL");log.push("Status: RUNNING");log.push("Bulk-ID: "+g.bulkId);log.push("Manifest: "+g.manifestFile.fsName);
        log.push("Band-Master: "+sourceFile.fsName);log.push("INDD-Sicherung: "+backup.fsName);log.push("Batches: "+total);log.push("BYH-Bereich: "+g.firstId+" bis "+g.lastId);
        if(g.isFullVolume)log.push("Gesamtband: "+g.totalGroups+" Layout-Gruppen à "+g.groupSize+" Segmente · Start ab Gruppe "+g.startGroup+" · Segmente gesamt: "+g.segmentCount);
        log.push("Modus: "+(fastMode?"Schnellmodus":"Präzisionsmodus"));log.push("EN-Modus: "+(skipEnglishUpdate?"FORTSETZEN · vorhandenen EN-Text validieren, nicht neu einspielen":"FRISCH · EN genau einmal aktualisieren"));log.push("Geschützte Seiten: "+(trim(locksText)||"keine"));log.push("Seiten bei Start: "+startPageCount);
        log.push("Priorität v2.0.11: HARD = kein Übersatz, Divider innerhalb ±15 mm, Daf HE/EN auf derselben physischen Seite. SOFT = BYH-Seitenanker; bei notwendiger HARD-Reparatur darf deren Score schlechter werden und wird nur protokolliert.");
        log.push("Start: "+timestamp());log.push("");
        writeBulkLayoutProtocol(protocol,log);
        try{
            if(skipEnglishUpdate){
                setStatus(progressField,"Vorhandener EN-Text wird geprüft …");
                setStatus(statusField,"BULK-FORTSETZEN · vorhandener englischer Textfluss wird gegen den Master geprüft …");
                var ready=options.resumeValidation||validateExistingEnglishFlowForBulkResume(doc,sourceFile,g);
                assertNoLayoutOverflow(doc,"nach Vorprüfung Bulk-Fortsetzen");
                log.push("EN-AKTUALISIERUNG · ÜBERSPRUNGEN");log.push(ready.summary);log.push("Zusätzliche zweisprachige Seiten durch EN-Aktualisierung: 0");log.push("");writeBulkLayoutProtocol(protocol,log);
            }else{
                setStatus(progressField,"EN wird 1× aktualisiert …");
                setStatus(statusField,"BULK-LAYOUT · Englisch wird für "+total+" Batches genau einmal aktualisiert …");
                var pagesBeforeEn=doc.pages.length;
                var updateResult=updateEnglishInActiveDocument(sourceFile,statusField);
                enUpdateCount=1;
                enUpdateAddedPages=Math.max(0,doc.pages.length-pagesBeforeEn);
                assertNoLayoutOverflow(doc,"nach einmaliger EN-Aktualisierung");
                log.push("EN-AKTUALISIERUNG · EINMALIG");log.push(updateResult);log.push("Zusätzliche zweisprachige Seiten durch EN-Aktualisierung: "+enUpdateAddedPages);log.push("");writeBulkLayoutProtocol(protocol,log);
            }

            for(i=0;i<total;i++){
                item=g.items[i];
                var pct=Math.round(((i+1)/total)*100);
                setStatus(progressField,(g.isFullVolume?groupLabel(i)+" · ":(i+1)+" / "+total+" · ")+pct+" %");
                setStatus(statusField,"BULK-LAYOUT "+(i+1)+" / "+total+" · ANALYSE · "+item.firstId+" bis "+item.lastId);
                // Any overset here would mean the previous repair step did not finish cleanly.
                assertNoLayoutOverflow(doc,"vor Batch "+(i+1)+" / "+total);
                // Fresh analysis is mandatory here: earlier batches and newly appended pages may
                // have moved later text to different physical pages.
                preview=getBatchLayoutAnalysis(doc,sourceFile,item.file,locksText);
                var touchedPages=preview.snapshotPages||preview.pages;
                if(touchedPages&&touchedPages.length){
                    var localMin=touchedPages[0],localMax=touchedPages[touchedPages.length-1];
                    if(!bulkPageMin||localMin<bulkPageMin)bulkPageMin=localMin;
                    if(localMax>bulkPageMax)bulkPageMax=localMax;
                }
                ranges=buildBatchStoryRanges(doc,preview);
                anchorBefore=pageAnchorSummary(doc,preview,ranges.he,ranges.en);
                log.push("BATCH "+pad2(i+1)+" / "+pad2(total)+(g.isFullVolume?" · "+groupLabel(i):"")+" · "+item.firstId+" bis "+item.lastId);
                log.push("Datei: "+item.file.fsName);log.push("Analyse-Seiten: "+formatPageList(preview.pages));
                log.push("Rollback-sicherer Daf-Kontext: "+formatPageList(preview.dafPages||preview.pages));
                log.push("ID-Seitenabweichung: "+preview.score+" · Grenzfehler: "+formatLayoutNumber(anchorBefore.score)+" · unterschiedliche Grenz-IDs: "+anchorBefore.idMismatch);
                writeBulkLayoutProtocol(protocol,log);

                setStatus(statusField,"BULK-LAYOUT "+(i+1)+" / "+total+" · ANGLEICHEN · "+item.firstId+" bis "+item.lastId);
                var outcome={};
                result=applyBatchLayoutBalance(doc,sourceFile,item.file,locksText,statusField,preview,fastMode,{
                    skipInddBackup:true,backupPath:backup.fsName,skipSave:true,abortOnOverflow:false,
                    statusPrefix:"Bulk "+(i+1)+"/"+total+" · ",preparedRanges:ranges,outcome:outcome
                });
                // applyBatchLayoutBalance has already attempted automatic bilingual expansion.
                // If overset still exists, it is considered non-resolvable and the run stops.
                assertNoLayoutOverflow(doc,"nach automatischer Übersatzbehebung in Batch "+(i+1)+" / "+total);
                totalLayoutAddedPages+=Number(outcome.addedPages||0);
                if(Number(outcome.addedPages||0)>0&&doc.pages.length>bulkPageMax)bulkPageMax=doc.pages.length;
                completed++;
                log.push(result);
                log.push("Automatisch ergänzte zweisprachige Seiten in diesem Batch: "+Number(outcome.addedPages||0));
                log.push("Seitenstand nach Batch: "+doc.pages.length+" / "+MAX_PAGES);
                log.push("BATCH-STATUS: OK");log.push("");writeBulkLayoutProtocol(protocol,log);
            }

            setStatus(progressField,total+" / "+total+" · 100 %");
            setStatus(statusField,"BULK-LAYOUT · Abschlussprüfung und Speichern …");
            assertNoLayoutOverflow(doc,"vor Abschluss");
            assertDafHeadingsAlignedForIdRange(doc,sourceFile,g.firstId,g.lastId);
            doc.save();
            var validation=validateActiveVolume(doc),elapsed=(new Date().getTime()-started)/1000;
            log[1]="Status: SUCCESS";log.push("ABSCHLUSSPRÜFUNG");log.push(validation);log.push("");log.push("Erfolgreich verarbeitet: "+completed+" / "+total);
            var bulkPageSpan=(bulkPageMin&&bulkPageMax)?("Seite "+bulkPageMin+" bis "+bulkPageMax):"nicht bestimmbar";
            var newPageSpan=(doc.pages.length>startPageCount)?("Seite "+(startPageCount+1)+" bis "+doc.pages.length):"keine";
            log.push("EN-Aktualisierungen: "+enUpdateCount);log.push("Zusätzliche Seiten durch EN-Aktualisierung: "+enUpdateAddedPages);
            log.push("Zusätzliche Seiten durch Bulk-Layout-Übersatzbehebung: "+totalLayoutAddedPages);
            log.push("Bulk-Layout bearbeiteter Seitenbereich: "+bulkPageSpan);
            log.push("Neu angelegte Seiten in diesem Bulk-Lauf: "+newPageSpan);
            log.push("Seiten bei Start: "+startPageCount+" · Seiten am Ende: "+doc.pages.length+" / "+MAX_PAGES);
            log.push("Gesamtlaufzeit: "+formatLayoutNumber(elapsed)+" s");log.push("Ende: "+timestamp());writeBulkLayoutProtocol(protocol,log);
            if(runOutcome){runOutcome.success=true;runOutcome.aborted=false;runOutcome.nextSequence=0;}
            return "BULK-LAYOUT ERFOLGREICH\r\n"+
                (g.isFullVolume?"Gesamtband: Gruppen "+g.startGroup+" bis "+g.totalGroups+" von "+g.totalGroups+" angeglichen\r\n":"")+
                "Bulk-ID: "+g.bulkId+"\r\nBatches: "+completed+" / "+total+"\r\nBYH-Bereich: "+g.firstId+" bis "+g.lastId+"\r\n"+
                "Bearbeiteter Layout-Seitenbereich: "+bulkPageSpan+"\r\n"+
                "Englischer Textfluss: "+(skipEnglishUpdate?"vorhandener EN-Text validiert · nicht neu eingespielt":"aktualisiert: genau 1× (gesamter EN-Textfluss)")+"\r\n"+
                "Zusätzliche zweisprachige Seiten durch EN-Aktualisierung: "+enUpdateAddedPages+"\r\n"+
                "Zusätzliche zweisprachige Seiten durch Layout-Übersatzbehebung: "+totalLayoutAddedPages+"\r\n"+
                "Neu angelegte Seiten in diesem Bulk-Lauf: "+newPageSpan+"\r\n"+
                "Seiten: "+startPageCount+" → "+doc.pages.length+" / "+MAX_PAGES+"\r\n"+
                "Übersatz am Ende: keiner\r\nGesamtlaufzeit: "+formatLayoutNumber(elapsed)+" s\r\n"+
                "Gemeinsame INDD-Sicherung: "+backup.fsName+"\r\nLaufprotokoll: "+protocol.fsName+"\r\n\r\n"+validation;
        }catch(e){
            // applyBatchLayoutBalance restores the currently failing batch geometry AND any
            // tail pages appended inside that failing batch before propagating an error.
            try{doc.save();}catch(_save){}
            var elapsedFail=(new Date().getTime()-started)/1000;
            log[1]="Status: ABORTED";log.push("");log.push("SICHERHEITSABBRUCH");log.push("Nach erfolgreich abgeschlossenen Batches: "+completed+" / "+total);
            log.push("Fehler: "+errorText(e));log.push("Bis dahin zusätzlich erzeugte Layout-Seiten: "+totalLayoutAddedPages);
            log.push("Aktueller Seitenstand: "+doc.pages.length+" / "+MAX_PAGES);log.push("Gesamtlaufzeit bis Abbruch: "+formatLayoutNumber(elapsedFail)+" s");log.push("Ende: "+timestamp());
            log.push("Hinweis: Der Abbruch kann durch Übersatz, Daf-Synchronität oder eine andere Sicherheitsprüfung ausgelöst worden sein. Übersatz wird zuvor automatisch durch vollständige zweisprachige Seiten zu beheben versucht. Bereits erfolgreich abgeschlossene Batch-Layouts bleiben erhalten. Die gemeinsame INDD-Sicherung stellt bei Bedarf den Zustand VOR dem gesamten Bulk-Lauf bereit.");
            try{writeBulkLayoutProtocol(protocol,log);}catch(_log){}
            setStatus(progressField,"ABBRUCH nach "+completed+" / "+total);
            var resumeNote="";
            if(g.isFullVolume&&completed<total){
                resumeNote="FORTSETZEN: Nach Prüfung der Ursache im selben Dokument 'Start ab Gruppe' = "+g.items[completed].sequence+
                    " setzen (wurde automatisch eingetragen) und 'Ganzen Band angleichen · EN bereits vorhanden' klicken. "+(completed>0?"Gruppen "+g.startGroup+" bis "+(g.items[completed].sequence-1)+" sind bereits angeglichen und bleiben unverändert.":"In diesem Lauf wurde noch keine Gruppe abgeschlossen.")+"\r\n";
                try{log.push(resumeNote);writeBulkLayoutProtocol(protocol,log);}catch(_log2){}
            }
            if(runOutcome){runOutcome.success=false;runOutcome.aborted=true;runOutcome.nextSequence=(g.isFullVolume&&completed<total)?g.items[completed].sequence:0;}
            return "BULK-LAYOUT SICHERHEITSABBRUCH\r\n"+resumeNote+
                "Bulk-ID: "+g.bulkId+"\r\nErfolgreich abgeschlossen: "+completed+" / "+total+" Batch(es)\r\n"+
                "Grund: "+errorText(e)+"\r\n\r\nSicherheitsprüfung beendet den Lauf. Bei Übersatz wird zuvor automatisch eine zweisprachige Seitenerweiterung versucht.\r\n"+
                "Spätere Batches wurden NICHT ausgeführt.\r\nAktueller Seitenstand: "+doc.pages.length+" / "+MAX_PAGES+"\r\n"+
                "Gemeinsame INDD-Sicherung vor dem Bulk-Lauf: "+backup.fsName+"\r\nLaufprotokoll: "+protocol.fsName;
        }
    }

    // ---------------- Divider hard limit v2.0.9 ----------------

    function layoutHardMinSplitMm(){
        var legacyMin=HE_BOUNDS_MM[0]+LAYOUT_MIN_HE_HEIGHT_MM;
        return Math.max(legacyMin,LAYOUT_NOMINAL_SPLIT_MM-LAYOUT_HARD_DEVIATION_MM);
    }

    function layoutHardMaxSplitMm(){
        var legacyMax=EN_BOUNDS_MM[2]-LAYOUT_GAP_MM-LAYOUT_MIN_EN_HEIGHT_MM;
        return Math.min(legacyMax,LAYOUT_NOMINAL_SPLIT_MM+LAYOUT_HARD_DEVIATION_MM);
    }

    function clampLayoutSplitMm(v){
        v=Number(v);
        var lo=layoutHardMinSplitMm(),hi=layoutHardMaxSplitMm();
        if(v<lo)return lo;
        if(v>hi)return hi;
        return v;
    }

    function dividerHardLimitSummary(doc,a){
        var out={outside:[],lockedOutside:[],count:0,lockedCount:0},i,pn,pair,split,dev;
        for(i=0;i<a.pages.length;i++){
            pn=a.pages[i];
            if(pn<1||pn>doc.pages.length)continue;
            pair=findBilingualFramesOnPage(doc.pages[pn-1]);
            if(!pair.he||!pair.en)continue;
            split=frameBottomMm(pair.he);
            dev=split-LAYOUT_NOMINAL_SPLIT_MM;
            if(Math.abs(dev)>LAYOUT_HARD_DEVIATION_MM+0.05){
                if(a.locks[pn]){
                    out.lockedOutside.push({page:pn,split:split,deviation:dev});
                    out.lockedCount++;
                }else{
                    out.outside.push({page:pn,split:split,deviation:dev});
                    out.count++;
                }
            }
        }
        return out;
    }

    function formatDividerLimitRows(rows){
        var out=[],i,r;
        for(i=0;i<rows.length;i++){
            r=rows[i];
            out.push("Seite "+r.page+" ("+formatLayoutNumber(r.split)+" mm; Δ "+(r.deviation>0?"+":"")+formatLayoutNumber(r.deviation)+" mm)");
        }
        return out.join(", ");
    }

    // ---------------- Daf-heading synchronization v2.0.9 ----------------

    function paragraphPageNumber(par){
        var frames=null;
        try{frames=par.parentTextFrames;if(frames&&frames.length)return pageNumberFromFrame(frames[0]);}catch(_){ }
        try{return pageNumberFromFrame(par.insertionPoints[0].parentTextFrames[0]);}catch(__){ }
        return -1;
    }

    function canonicalDafHeadingKey(text){
        var s=String(text||"");
        // InDesign may automatically replace straight quotation marks in Hebrew
        // with Gershayim / typographic variants. Daf identity must not depend on
        // that purely typographic choice.
        s=s.replace(/&quot;/gi,'"');
        s=s.replace(/[\r\n\u2028\u2029]+/g," ");
        s=s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,"");
        s=s.replace(/[\u05F3\u05F4"'׳״‘’“”„‟`´\u2032\u2033]/g,"");
        s=s.replace(/[\-–—:;,.!?()\[\]{}]/g,"");
        s=s.replace(/\s+/g,"");
        return s.toLowerCase();
    }

    function expectedDafHeadingKeys(p,isEnglish){
        var keys={},si,title,key;
        for(si=0;si<p.sections.length;si++){
            title=isEnglish?p.sections[si].en:p.sections[si].he;
            key=canonicalDafHeadingKey(title);
            if(key)keys[key]=true;
        }
        return keys;
    }

    function collectDafHeadingParagraphs(story,p,isEnglish,styleName){
        var out=[],paras=story.paragraphs,keys=expectedDafHeadingKeys(p,isEnglish),i,nm,raw,key,styleMatch;
        for(i=0;i<paras.length;i++){
            try{nm=String(paras[i].appliedParagraphStyle.name||"");}catch(_){nm="";}
            try{raw=String(paras[i].contents||"").replace(/[\r\n]+$/g,"");}catch(__){raw="";}
            key=canonicalDafHeadingKey(raw);
            styleMatch=(nm===styleName);
            // Primary route: the production paragraph style. Fallback route:
            // an exact canonical Daf title, even if a local style deviation exists.
            if(!styleMatch&&!keys[key])continue;
            out.push({paragraph:paras[i],text:normalizeForCompare(raw),key:key,page:paragraphPageNumber(paras[i]),styleMatch:styleMatch});
        }
        return out;
    }

    function sectionTranslationFlags(p){
        var flags={},i,s;
        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];
            if(trim(stripTags(s.en||"")))flags[s.sectionOrder]=true;
        }
        return flags;
    }

    function sectionFirstIndices(p){
        var first={},i,s;
        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];
            if(first[s.sectionOrder]===undefined)first[s.sectionOrder]=i;
        }
        return first;
    }

    function mapExpectedSectionParagraphs(p,heads,isEnglish){
        var out={},translated=sectionTranslationFlags(p),pos=0,si,title,key,j;
        for(si=0;si<p.sections.length;si++){
            if(isEnglish&&!translated[si])continue;
            title=isEnglish?p.sections[si].en:p.sections[si].he;
            key=canonicalDafHeadingKey(title);
            if(!key)continue;
            for(j=pos;j<heads.length;j++){
                if(heads[j].key===key){out[si]=heads[j];pos=j+1;break;}
            }
        }
        return out;
    }

    function mergeUniquePages(a,b,maxPages){
        var set={},out=[],i,n;
        a=a||[];b=b||[];
        for(i=0;i<a.length;i++){n=parseInt(a[i],10);if(n>=1&&(!maxPages||n<=maxPages))set[n]=true;}
        for(i=0;i<b.length;i++){n=parseInt(b[i],10);if(n>=1&&(!maxPages||n<=maxPages))set[n]=true;}
        for(n=1;n<=(maxPages||10000);n++)if(set[n])out.push(n);
        return out;
    }

    function dafSyncContextPages(pages,maxPages){
        var out=mergeUniquePages(pages,[],maxPages),first,i,extra=[];
        if(!out.length)return out;
        first=out[0];
        for(i=Math.max(1,first-DAF_SYNC_LOOKBACK_PAGES);i<first;i++)extra.push(i);
        return mergeUniquePages(out,extra,maxPages);
    }

    function pageArrayContains(a,n){var i;for(i=0;i<a.length;i++)if(a[i]===n)return true;return false;}

    function dafHeadingAlignmentSummary(doc,p,startIndex,endIndex){
        var chains=collectChains(doc),out={mismatch:0,missing:0,pairs:[],pages:[],details:[]};
        if(!chains.heFirst||!chains.enFirst)return out;
        var heHeads=collectDafHeadingParagraphs(chains.heFirst.parentStory,p,false,STYLE_HE_HEAD);
        var enHeads=collectDafHeadingParagraphs(chains.enFirst.parentStory,p,true,STYLE_EN_HEAD);
        var heMap=mapExpectedSectionParagraphs(p,heHeads,false),enMap=mapExpectedSectionParagraphs(p,enHeads,true);
        var translated=sectionTranslationFlags(p),first=sectionFirstIndices(p),si,idx,h,e,hp,ep,label;
        if(startIndex===undefined||startIndex===null)startIndex=0;
        if(endIndex===undefined||endIndex===null)endIndex=p.segments.length;
        for(si=0;si<p.sections.length;si++){
            idx=first[si];if(idx===undefined||idx<startIndex||idx>=endIndex||!translated[si])continue;
            h=heMap[si]||null;e=enMap[si]||null;label=trim(p.sections[si].en)||trim(p.sections[si].he)||("Abschnitt "+(si+1));
            if(!h||!e){out.missing++;out.details.push(label+": Überschrift in "+(!h?"HE":"EN")+" nicht gefunden");continue;}
            hp=paragraphPageNumber(h.paragraph);ep=paragraphPageNumber(e.paragraph);
            if(hp>0)out.pages=mergeUniquePages(out.pages,[hp],doc.pages.length);
            if(ep>0)out.pages=mergeUniquePages(out.pages,[ep],doc.pages.length);
            out.pairs.push({sectionOrder:si,index:idx,label:label,he:h.paragraph,en:e.paragraph,hePage:hp,enPage:ep});
            if(hp>0&&ep>0&&hp!==ep){out.mismatch++;out.details.push(label+": HE Seite "+hp+" · EN Seite "+ep);}
        }
        return out;
    }

    function introducedDafHeadingMismatches(before,after){
        var oldBad={},out=[],i,p;
        before=before||{pairs:[]};after=after||{pairs:[]};
        for(i=0;i<before.pairs.length;i++){
            p=before.pairs[i];
            if(p.hePage>0&&p.enPage>0&&p.hePage!==p.enPage)oldBad[p.sectionOrder]=true;
        }
        for(i=0;i<after.pairs.length;i++){
            p=after.pairs[i];
            if(p.hePage>0&&p.enPage>0&&p.hePage!==p.enPage&&!oldBad[p.sectionOrder])
                out.push(p.label+": HE Seite "+p.hePage+" · EN Seite "+p.enPage);
        }
        return out;
    }

    function synchronizeDafHeadingsForBatch(doc,a,heRanges,enRanges,statusField){
        var before=dafHeadingAlignmentSummary(doc,a.parsed,a.batchStartIndex,a.batchEndIndex),changes=[],unresolved=[];
        var i,pair,hp,ep,earlyPage,minSplit,maxSplit,direction,accepted,lookbackStart,searchPage;
        var frames,current,base,step,candidate,hp2,ep2,lastSafe,ev,pageStates,state,j,changedCount;
        for(i=0;i<before.pairs.length;i++){
            pair=before.pairs[i];hp=paragraphPageNumber(pair.he);ep=paragraphPageNumber(pair.en);
            if(hp<1||ep<1||hp===ep)continue;
            earlyPage=Math.min(hp,ep);
            minSplit=layoutHardMinSplitMm();
            maxSplit=layoutHardMaxSplitMm();
            // HE title early => move divider UP (less HE, more EN).
            // EN title early => move divider DOWN (more HE, less EN).
            direction=(hp<ep)?-1:1;
            accepted=false;pageStates=[];
            lookbackStart=Math.max(1,earlyPage-DAF_SYNC_LOOKBACK_PAGES);

            // v2.0.16: keep the useful legal movement on the title page while
            // continuing onto preceding captured pages.  v2.0.15 reset every
            // unsuccessful page before testing the previous one, so repairs
            // requiring the combined capacity of two pages (for example Daf 59b)
            // could never be reached.
            for(searchPage=earlyPage;searchPage>=lookbackStart&&!accepted;searchPage--){
                if(a.locks[searchPage]||!pageArrayContains(a.dafPages||a.pages,searchPage))continue;
                frames=findBilingualFramesOnPage(doc.pages[searchPage-1]);
                if(!frames.he||!frames.en)continue;
                current=frameBottomMm(frames.he);
                base=evaluatePageAnchor(frames,a,heRanges,enRanges);
                state={page:searchPage,frames:frames,oldSplit:current,newSplit:current,
                    idGapBefore:base.valid?base.idGap:-1};
                pageStates.push(state);lastSafe=current;

                for(step=1;step<=DAF_SYNC_MAX_STEPS;step++){
                    candidate=current+(direction*DAF_SYNC_STEP_MM*step);
                    if(candidate<minSplit-0.001||candidate>maxSplit+0.001)break;
                    setDividerOnFrames(frames.he,frames.en,candidate);recomposeBilingualStories(frames);
                    hp2=paragraphPageNumber(pair.he);ep2=paragraphPageNumber(pair.en);
                    if(hp2===ep2&&hp2>0){
                        state.newSplit=candidate;accepted=true;break;
                    }

                    // A complete page jump can make the headings cross without
                    // ever sharing a page.  Do not retain that overshoot: return
                    // to the last split with the original order, then distribute
                    // the remaining correction over the preceding page.
                    if((hp<ep&&hp2<ep2)||(hp>ep&&hp2>ep2)){
                        lastSafe=candidate;state.newSplit=candidate;
                    }else{
                        setDividerOnFrames(frames.he,frames.en,lastSafe);
                        recomposeBilingualStories(frames);
                        state.newSplit=lastSafe;
                        break;
                    }
                }
            }

            if(accepted){
                changedCount=0;
                for(j=0;j<pageStates.length;j++){
                    state=pageStates[j];
                    if(Math.abs(state.newSplit-state.oldSplit)<=0.01)continue;
                    ev=evaluatePageAnchor(state.frames,a,heRanges,enRanges);
                    changes.push({page:state.page,label:pair.label,oldSplit:state.oldSplit,newSplit:state.newSplit,
                        heBefore:hp,enBefore:ep,after:hp2,idGapBefore:state.idGapBefore,
                        idGapAfter:ev.valid?ev.idGap:-1,fallback:(state.page!==earlyPage),cumulative:(pageStates.length>1)});
                    changedCount++;
                }
                setStatus(statusField,"Daf-Titel kumulativ synchronisiert · "+pair.label+" · Seite "+hp2+" · "+changedCount+" Seite(n)");
            }else{
                // The caller's batch snapshot remains the authoritative rollback,
                // but also restore all provisional Daf probes immediately so the
                // next title and the diagnostic summary see the true prior state.
                for(j=pageStates.length-1;j>=0;j--){
                    state=pageStates[j];setDividerOnFrames(state.frames.he,state.frames.en,state.oldSplit);
                }
                recompose(doc);
                hp=paragraphPageNumber(pair.he);ep=paragraphPageNumber(pair.en);
                if(!pageStates.length){
                    unresolved.push(pair.label+" · keine ungeschützte HE/EN-Seite im Batch-Snapshot für die Daf-Korrektur verfügbar");
                }else{
                    unresolved.push(pair.label+" · HE Seite "+hp+" / EN Seite "+ep+" konnte innerhalb des harten ±15-mm-Dividerbereichs (HE 111–141 / EN 114–144 mm) auch kumulativ über die erfassten Batch-Seiten nicht synchronisiert werden");
                }
            }
        }
        recompose(doc);
        var after=dafHeadingAlignmentSummary(doc,a.parsed,a.batchStartIndex,a.batchEndIndex);
        return {before:before,after:after,changes:changes,unresolved:unresolved};
    }

    function assertDafHeadingsAlignedForIdRange(doc,sourceFile,firstId,lastId){
        var p=parseBilingualFile(readUTF8(sourceFile)),idx={},i,start=-1,end=-1,s;
        for(i=0;i<p.segments.length;i++)idx[p.segments[i].id]=i;
        if(idx[firstId]!==undefined)start=idx[firstId];if(idx[lastId]!==undefined)end=idx[lastId]+1;
        if(start<0||end<0)return null;
        var sum=dafHeadingAlignmentSummary(doc,p,start,end);
        if(sum.mismatch||sum.missing)throw new Error("DAF-TITEL NICHT SYNCHRON: "+sum.mismatch+" Seitenabweichung(en), "+sum.missing+" fehlende Überschrift(en). "+(sum.details.length?sum.details.join(" | "):""));
        return sum;
    }

    // ---------------- Controlled per-batch layout balancing ----------------

    function analyzeBatchLayout(doc,sourceFile,batchFile,locksText){
        recompose(doc);
        var a=getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText);
        var ranges=buildBatchStoryRanges(doc,a);
        var anchor=pageAnchorSummary(doc,a,ranges.he,ranges.en);
        var daf=dafHeadingAlignmentSummary(doc,a.parsed,a.batchStartIndex,a.batchEndIndex);
        var lim=dividerHardLimitSummary(doc,a);
        return "BATCH-LAYOUT ANALYSE\r\n"+
            "IDs: "+a.firstId+" bis "+a.lastId+" · "+a.ids.length+" Segmente\r\n"+
            "Betroffene Seiten: "+formatPageList(a.pages)+"\r\n"+
            "Geschützte Seiten: "+(a.lockedText||"keine")+"\r\n"+
            "ID-Seitenabweichung: "+a.score+" · größte Seitenabweichung: "+a.maxLag+"\r\n"+
            "Grenzfehler: "+formatLayoutNumber(anchor.score)+" · größte normalisierte Abweichung: "+formatLayoutNumber(anchor.max)+" Segmente\r\n"+
            "Grenzen mit unterschiedlicher BYH-ID: "+anchor.idMismatch+" · gleiche BYH-ID: "+anchor.sameId+"\r\n"+
            "Daf-Titel HE/EN auf unterschiedlicher Seite: "+daf.mismatch+" · fehlend: "+daf.missing+(daf.details.length?"\r\nDaf-Details: "+daf.details.join(" | "):"")+"\r\n"+
            "Divider außerhalb HARD LIMIT ±15 mm: "+lim.count+(lim.count?" · "+formatDividerLimitRows(lim.outside):"")+
            (lim.lockedCount?"\r\nGeschützte Seiten außerhalb HARD LIMIT: "+lim.lockedCount+" · "+formatDividerLimitRows(lim.lockedOutside):"")+"\r\n"+
            "Seiten mit HE voraus: "+anchor.heAhead+" · EN voraus: "+anchor.enAhead+" · ausreichend passend: "+anchor.aligned+"\r\n"+
            "Verglichene ID-Paare: "+a.compared+" / "+a.ids.length+"\r\n\r\n"+
            "v2.0.11 bewertet zusätzlich die Daf-Überschriften selbst und erkennt typografische Quote-/Gershayim-Varianten tolerant. Ein neuer Daf-Titel darf nach dem Abgleich nicht mehr in HE eine physische Seite früher erscheinen als in EN oder umgekehrt. " +
            "Der vorhandene BYH-ID-/Zeilenanker bleibt die zweite Sicherheitsstufe. Normale Segmentangleichung darf den HARD LIMIT HE 111–141 mm / EN 114–144 mm nicht überschreiten; Daf-Synchronität bleibt zwingende Abschlussbedingung. Muss dafür ein vorhandener Ausreißer oder Daf-Versatz repariert werden, sind BYH-Seitenanker nur noch SOFT und dürfen sich verschlechtern.";
    }

    function getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText){
        recompose(doc);
        var p=parseBilingualFile(readUTF8(sourceFile));
        var b=parseBilingualFile(wrapBatchAsBook(readUTF8(batchFile)));
        var expected=doc.extractLabel(DOC_VOLUME_LABEL),actual=String(p.volume||1);
        if(expected&&expected!==actual)throw new Error("Aktiver Band "+expected+" passt nicht zur Quelldatei Band "+actual+".");
        if(b.volume&&p.volume&&b.volume!==p.volume)throw new Error("Der Batch gehört zu Band "+b.volume+", die Banddatei aber zu Band "+p.volume+".");
        var masterMap={},masterIndex={},ids=[],i,s;
        for(i=0;i<p.segments.length;i++){masterMap[p.segments[i].id]=p.segments[i];masterIndex[p.segments[i].id]=i;}
        for(i=0;i<b.segments.length;i++){
            s=b.segments[i];
            if(!masterMap[s.id])throw new Error("Batch-ID ist in der Banddatei nicht vorhanden: "+s.id);
            if(!trim(stripTags(masterMap[s.id].en)))throw new Error("Die Batch-ID "+s.id+" ist im Band-Master noch nicht englisch gefüllt. Zuerst 'Nach IDs zusammenführen' ausführen.");
            ids.push(s.id);
        }
        if(!ids.length)throw new Error("Der gewählte Batch enthält keine Segment-IDs.");
        var chains=collectChains(doc);
        if(!chains.heFirst||!chains.enFirst)throw new Error("HE/EN-Textrahmenketten wurden nicht gefunden.");
        var heMap=mapStorySegmentsToPages(chains.heFirst.parentStory,p.segments,false);
        var enMap=mapStorySegmentsToPages(chains.enFirst.parentStory,p.segments,true);
        var metric=layoutMetric(ids,heMap,enMap);
        var batchStartIndex=masterIndex[ids[0]],batchEndIndex=masterIndex[ids[ids.length-1]]+1;
        var pages=affectedPagesForIds(ids,heMap,enMap,doc.pages.length);
        var dafHeadings=dafHeadingAlignmentSummary(doc,p,batchStartIndex,batchEndIndex);
        pages=mergeUniquePages(pages,dafHeadings.pages,doc.pages.length);
        // Ordinary segment balancing remains restricted to `pages`. Daf repair
        // receives a wider, separately captured context so a title at the very
        // start of a batch can use cumulative capacity from preceding pages.
        var dafPages=dafSyncContextPages(pages,doc.pages.length);
        var snapshotPages=mergeUniquePages(pages,dafPages,doc.pages.length);
        var locks=parsePageRanges(locksText,doc.pages.length);
        var lockedText=formatPageList(objectKeysAsNumbers(locks));
        return {parsed:p,batch:b,ids:ids,firstId:ids[0],lastId:ids[ids.length-1],heMap:heMap,enMap:enMap,
            score:metric.score,maxLag:metric.maxLag,fineScore:metric.fineScore,maxFineLag:metric.maxFineLag,
            compared:metric.compared,pages:pages,locks:locks,lockedText:lockedText,dafHeadings:dafHeadings,
            dafPages:dafPages,snapshotPages:snapshotPages,dafContextStartIndex:Math.max(0,batchStartIndex-48),
            batchStartIndex:batchStartIndex,batchEndIndex:batchEndIndex};
    }

    function mapStorySegmentsToPages(story,segments,isEnglish){
        var expected=[],i,s;
        for(i=0;i<segments.length;i++){
            s=segments[i];
            if(!isEnglish||trim(stripTags(s.en)))expected.push(s);
        }
        var map={},ei=0,paras=story.paragraphs,pi,txt,m,seg,frames,startPage,endPage,startPos,endPos,lines,firstLine,lastLine;
        for(pi=0;pi<paras.length&&ei<expected.length;pi++){
            txt="";
            try{txt=String(paras[pi].contents||"").replace(/[\r\n]+$/g,"");}catch(_){continue;}
            m=/^\s*\[([0-9]+)\]/.exec(txt);
            if(!m)continue;
            seg=expected[ei];
            if(parseInt(m[1],10)!==seg.number){
                throw new Error((isEnglish?"Englischer":"Hebräischer")+" InDesign-Text ist nicht mehr eindeutig mit der Master-Reihenfolge synchron. Erwartet wurde ["+seg.number+"] für "+seg.id+", gefunden wurde ["+m[1]+"]. Bitte zuerst den aktiven Band prüfen.");
            }
            frames=[];
            try{frames=paras[pi].parentTextFrames;}catch(__){frames=[];}
            startPage=pageNumberFromFrame(frames&&frames.length?frames[0]:null);
            endPage=pageNumberFromFrame(frames&&frames.length?frames[frames.length-1]:null);
            if(startPage<1){try{startPage=pageNumberFromFrame(paras[pi].insertionPoints[0].parentTextFrames[0]);}catch(___){} }
            if(endPage<1){try{endPage=pageNumberFromFrame(paras[pi].insertionPoints[paras[pi].insertionPoints.length-1].parentTextFrames[0]);}catch(____){} }

            startPos=startPage>0?startPage-1:-1;
            endPos=endPage>0?endPage-1:-1;
            try{
                lines=paras[pi].lines;
                if(lines&&lines.length){
                    firstLine=lines[0];lastLine=lines[lines.length-1];
                    startPos=lineFlowPosition(firstLine,startPage);
                    endPos=lineFlowPosition(lastLine,endPage<1?startPage:endPage);
                }
            }catch(_____){ }
            if(startPos<0&&startPage>0)startPos=startPage-1;
            if(endPos<0&&endPage>0)endPos=endPage-1;
            map[seg.id]={start:startPage,end:endPage<1?startPage:endPage,startPos:startPos,endPos:endPos};
            ei++;
        }
        if(ei!==expected.length)throw new Error((isEnglish?"Englischer":"Hebräischer")+" Textfluss konnte nur "+ei+" von "+expected.length+" Segmenten den BYH-IDs zuordnen.");
        return map;
    }

    function lineFlowPosition(line,fallbackPage){
        var tf=null,pageNo=fallbackPage||-1,bounds,base,frac;
        try{if(line.parentTextFrames&&line.parentTextFrames.length)tf=line.parentTextFrames[0];}catch(_){tf=null;}
        if(tf)pageNo=pageNumberFromFrame(tf);
        if(pageNo<1)return -1;
        try{
            bounds=tf.geometricBounds;base=Number(line.baseline);
            if(!isNaN(base)&&Number(bounds[2])>Number(bounds[0])){
                frac=(base-Number(bounds[0]))/(Number(bounds[2])-Number(bounds[0]));
                if(frac<0)frac=0;if(frac>1)frac=1;
                return (pageNo-1)+frac;
            }
        }catch(__){ }
        return pageNo-1;
    }

    function pageNumberFromFrame(tf){
        try{if(tf&&tf.isValid&&tf.parentPage)return tf.parentPage.documentOffset+1;}catch(_){ }
        return -1;
    }

    function layoutMetric(ids,heMap,enMap){
        var score=0,maxLag=0,fineScore=0,maxFineLag=0,compared=0,i,id,h,e,a,b,fa,fb;
        for(i=0;i<ids.length;i++){
            id=ids[i];h=heMap[id];e=enMap[id];if(!h||!e||h.start<1||e.start<1)continue;
            a=Math.abs(h.start-e.start);b=Math.abs(h.end-e.end);
            score+=a*3+b*2;maxLag=Math.max(maxLag,a,b);
            fa=Math.abs(Number(h.startPos)-Number(e.startPos));
            fb=Math.abs(Number(h.endPos)-Number(e.endPos));
            if(isNaN(fa))fa=a;if(isNaN(fb))fb=b;
            fineScore+=fa*3+fb*2;maxFineLag=Math.max(maxFineLag,fa,fb);compared++;
        }
        return {score:score,maxLag:maxLag,fineScore:fineScore,maxFineLag:maxFineLag,compared:compared};
    }

    function formatLayoutNumber(v){
        v=Number(v);if(isNaN(v))return "?";return (Math.round(v*100)/100).toFixed(2);
    }

    function affectedPagesForIds(ids,heMap,enMap,maxPages){
        var set={},i,id,h,e,a,b,p,out=[];
        for(i=0;i<ids.length;i++){
            id=ids[i];h=heMap[id];e=enMap[id];if(!h||!e)continue;
            a=Math.max(1,Math.min(h.start,e.start)-1);b=Math.min(maxPages,Math.max(h.end,e.end)+1);
            for(p=a;p<=b;p++)set[p]=true;
        }
        for(p=1;p<=maxPages;p++)if(set[p])out.push(p);
        return out;
    }

    // Build stable story-index ranges once.  Their text indices do not change
    // when text merely reflows between frames, which makes them a reliable and
    // much faster anchor than repeated baseline measurements.
    function buildBatchStoryRanges(doc,a){
        var chains=collectChains(doc);
        if(!chains.heFirst||!chains.enFirst)throw new Error("HE/EN-Textrahmenketten wurden nicht gefunden.");
        return {
            he:buildStorySegmentRanges(chains.heFirst.parentStory,a.parsed.segments,false),
            en:buildStorySegmentRanges(chains.enFirst.parentStory,a.parsed.segments,true)
        };
    }

    function buildStorySegmentRanges(story,segments,isEnglish){
        var expected=[],i,s,paras=story.paragraphs,pi,txt,m,item,ei=0,startIdx,endIdx,ranges=[],lineSpans,lines,li,lstart,lend,ips;
        for(i=0;i<segments.length;i++){
            s=segments[i];
            if(!isEnglish||trim(stripTags(s.en)))expected.push({seg:s,masterIndex:i});
        }
        for(pi=0;pi<paras.length&&ei<expected.length;pi++){
            txt="";
            try{txt=String(paras[pi].contents||"").replace(/[\r\n]+$/g,"");}catch(_){continue;}
            m=/^\s*\[([0-9]+)\]/.exec(txt);
            if(!m)continue;
            item=expected[ei];
            if(parseInt(m[1],10)!==item.seg.number){
                throw new Error((isEnglish?"Englischer":"Hebräischer")+" Textfluss ist für die Seitengrenzen nicht eindeutig. Erwartet ["+item.seg.number+"] für "+item.seg.id+", gefunden ["+m[1]+"].");
            }
            startIdx=-1;endIdx=-1;
            try{startIdx=Number(paras[pi].insertionPoints[0].index);}catch(__){}
            try{endIdx=Number(paras[pi].insertionPoints[paras[pi].insertionPoints.length-1].index);}catch(___){}
            if(startIdx<0||endIdx<startIdx){
                try{startIdx=Number(paras[pi].characters[0].index);endIdx=startIdx+Math.max(1,paras[pi].characters.length);}catch(____){}
            }
            if(startIdx<0||endIdx<startIdx)throw new Error("Story-Index konnte für "+item.seg.id+" nicht bestimmt werden.");

            // Rendered-line spans are stable while only frame HEIGHTS change,
            // because the frame width and typography remain unchanged.  They are
            // therefore a much better cross-language progress scale than raw chars.
            lineSpans=[];
            try{
                lines=paras[pi].lines;
                for(li=0;li<lines.length;li++){
                    lstart=-1;lend=-1;
                    try{ips=lines[li].insertionPoints;if(ips&&ips.length){lstart=Number(ips[0].index);lend=Number(ips[ips.length-1].index);}}catch(_____){ }
                    if(lstart>=0&&lend>=lstart)lineSpans.push({start:lstart,end:lend});
                }
            }catch(______){lineSpans=[];}
            ranges.push({id:item.seg.id,masterIndex:item.masterIndex,start:startIdx,end:endIdx,length:Math.max(1,endIdx-startIdx),lines:lineSpans});
            ei++;
        }
        if(ei!==expected.length)throw new Error((isEnglish?"Englischer":"Hebräischer")+" Textfluss konnte nur "+ei+" von "+expected.length+" Segmenten für die Seitengrenzen zuordnen.");
        return ranges;
    }

    function frameVisibleEndIndex(tf){
        var lines,last,ips,chars;
        try{
            lines=tf.lines;
            if(lines&&lines.length){
                last=lines[lines.length-1];ips=last.insertionPoints;
                if(ips&&ips.length)return Number(ips[ips.length-1].index);
            }
        }catch(_){}
        try{
            chars=tf.characters;
            if(chars&&chars.length)return Number(chars[chars.length-1].index)+1;
        }catch(__){}
        try{
            ips=tf.insertionPoints;
            if(ips&&ips.length)return Number(ips[ips.length-1].index);
        }catch(___){}
        return -1;
    }

    function storyProgressAtIndex(idx,ranges){
        if(idx<0||!ranges||!ranges.length)return null;
        var lo=0,hi=ranges.length-1,mid,r,prev,lines,j,frac,lineSpan,lineFrac;
        if(idx<ranges[0].start)return ranges[0].masterIndex;
        if(idx>=ranges[hi].end)return ranges[hi].masterIndex+0.999999;
        while(lo<=hi){
            mid=Math.floor((lo+hi)/2);r=ranges[mid];
            if(idx<r.start)hi=mid-1;
            else if(idx>r.end)lo=mid+1;
            else{
                lines=r.lines||[];
                if(lines.length){
                    for(j=0;j<lines.length;j++){
                        lineSpan=lines[j];
                        if(idx<=lineSpan.end){
                            lineFrac=0;
                            if(lineSpan.end>lineSpan.start)lineFrac=Math.max(0,Math.min(1,(idx-lineSpan.start)/(lineSpan.end-lineSpan.start)));
                            frac=(j+lineFrac)/lines.length;
                            return r.masterIndex+Math.max(0,Math.min(0.999999,frac));
                        }
                    }
                    return r.masterIndex+0.999999;
                }
                // Fallback only when InDesign cannot expose rendered line spans.
                return r.masterIndex+Math.max(0,Math.min(0.999999,(idx-r.start)/r.length));
            }
        }
        // Between numbered paragraphs / section headings: preceding BIH segment
        // is completely finished, but the next numbered segment has not begun.
        prev=hi>=0?ranges[hi]:ranges[0];
        return prev.masterIndex+0.999999;
    }

    function clampLayoutProgress(v,a,b){
        if(v<a)return a;if(v>b)return b;return v;
    }

    function layoutProgressSegmentIndex(v,a){
        // v can equal batchEndIndex when the final segment is completely done.
        // Treat that as the final batch segment for boundary-ID comparison.
        if(v>=a.batchEndIndex)return a.batchEndIndex-1;
        if(v<=a.batchStartIndex)return a.batchStartIndex;
        return Math.floor(v);
    }

    function evaluatePageAnchor(pair,a,heRanges,enRanges){
        var hi=frameVisibleEndIndex(pair.he),ei=frameVisibleEndIndex(pair.en);
        var hp=storyProgressAtIndex(hi,heRanges),ep=storyProgressAtIndex(ei,enRanges);
        if(hp===null||ep===null)return {valid:false,delta:0,error:9999,he:null,en:null,idGap:9999,heId:-1,enId:-1};
        hp=clampLayoutProgress(hp,a.batchStartIndex,a.batchEndIndex);
        ep=clampLayoutProgress(ep,a.batchStartIndex,a.batchEndIndex);
        var heId=layoutProgressSegmentIndex(hp,a),enId=layoutProgressSegmentIndex(ep,a);
        var idGap=Math.abs(heId-enId),delta=hp-ep;
        // Segment identity is the primary objective.  A one-ID mismatch must
        // always rank worse than any within-segment fractional difference.
        var error=idGap*10+Math.abs(delta);
        return {valid:true,delta:delta,error:error,he:hp,en:ep,idGap:idGap,heId:heId,enId:enId};
    }

    function pageAnchorSummary(doc,a,heRanges,enRanges){
        var score=0,max=0,count=0,heAhead=0,enAhead=0,aligned=0,idMismatch=0,sameId=0,i,pn,pair,e;
        for(i=0;i<a.pages.length;i++){
            pn=a.pages[i];if(pn<1||pn>doc.pages.length||a.locks[pn])continue;
            pair=findBilingualFramesOnPage(doc.pages[pn-1]);if(!pair.he||!pair.en)continue;
            e=evaluatePageAnchor(pair,a,heRanges,enRanges);if(!e.valid)continue;
            score+=e.error;max=Math.max(max,Math.abs(e.delta));count++;
            if(e.idGap>0)idMismatch++;else sameId++;
            if(e.idGap===0&&Math.abs(e.delta)<=LAYOUT_ANCHOR_OK)aligned++;
            else if(e.delta>0)heAhead++;else if(e.delta<0)enAhead++;else aligned++;
        }
        return {score:score,max:max,count:count,heAhead:heAhead,enAhead:enAhead,aligned:aligned,idMismatch:idMismatch,sameId:sameId};
    }

    function layoutCandidateBetter(candidate,best,currentSplit){
        if(!candidate||!candidate.valid)return false;
        if(!best||!best.valid)return true;
        if(candidate.idGap<best.idGap)return true;
        if(candidate.idGap>best.idGap)return false;
        if(Math.abs(candidate.delta)<Math.abs(best.delta)-LAYOUT_ANCHOR_EPSILON)return true;
        if(Math.abs(candidate.delta)>Math.abs(best.delta)+LAYOUT_ANCHOR_EPSILON)return false;
        // Equal synchronization quality: prefer the normal production divider,
        // then the smallest intervention from the current manually controlled state.
        var cn=Math.abs(candidate.split-LAYOUT_NOMINAL_SPLIT_MM),bn=Math.abs(best.split-LAYOUT_NOMINAL_SPLIT_MM);
        if(cn<bn-0.05)return true;if(cn>bn+0.05)return false;
        return Math.abs(candidate.split-currentSplit)<Math.abs(best.split-currentSplit)-0.05;
    }

    function evaluateDividerCandidate(doc,pair,split,a,heRanges,enRanges){
        setDividerOnFrames(pair.he,pair.en,split);recompose(doc);
        var e=evaluatePageAnchor(pair,a,heRanges,enRanges);e.split=split;return e;
    }

    function recomposeBilingualStories(pair){
        var hs=null,es=null;
        try{hs=pair.he&&pair.he.isValid?pair.he.parentStory:null;}catch(_){hs=null;}
        try{es=pair.en&&pair.en.isValid?pair.en.parentStory:null;}catch(__){es=null;}
        try{if(hs&&hs.isValid)hs.recompose();}catch(___){try{app.activeDocument.recompose();return;}catch(____){}}
        try{if(es&&es.isValid&&es!==hs)es.recompose();}catch(_____){try{app.activeDocument.recompose();}catch(______){}}
    }

    function fastProbeKey(split){return String(Math.round(Number(split)*100)/100);}

    function optimizeOnePageDividerFast(doc,pageNo,a,heRanges,enRanges,perf){
        var pair=findBilingualFramesOnPage(doc.pages[pageNo-1]);
        if(!pair.he||!pair.en)return {changed:false,page:pageNo,reason:"Rahmen fehlen"};
        var originalSplit=frameBottomMm(pair.he);
        var current=clampLayoutSplitMm(originalSplit);
        var normalizedByLimit=Math.abs(current-originalSplit)>0.01;
        var minSplit=layoutHardMinSplitMm();
        var maxSplit=layoutHardMaxSplitMm();

        // v2.0.9: legacy runs may already contain divider positions far outside
        // the production envelope.  Normalize first; all following anchor probes
        // are therefore evaluated only inside the legal ±15 mm range.
        if(normalizedByLimit){
            setDividerOnFrames(pair.he,pair.en,current);
            recomposeBilingualStories(pair);
            if(perf)perf.probes++;
        }

        // The document is already composed after the preceding page.  Reading
        // the current anchor therefore costs no additional recomposition.
        var base=evaluatePageAnchor(pair,a,heRanges,enRanges);base.split=current;
        if(!base.valid){
            if(normalizedByLimit)return {changed:true,page:pageNo,reason:"nur HARD-LIMIT-Normalisierung",before:0,after:0,oldSplit:originalSplit,newSplit:current,
                deltaBefore:0,deltaAfter:0,idGapBefore:0,idGapAfter:0,hardLimitNormalized:true};
            return {changed:false,page:pageNo,reason:"kein Anker"};
        }
        if(base.idGap===0&&Math.abs(base.delta)<=LAYOUT_ANCHOR_OK){
            if(perf)perf.skipped++;
            return {changed:normalizedByLimit,page:pageNo,before:base.error,after:base.error,oldSplit:originalSplit,newSplit:current,
                deltaBefore:base.delta,deltaAfter:base.delta,idGapBefore:base.idGap,idGapAfter:base.idGap,fastSkipped:true,hardLimitNormalized:normalizedByLimit};
        }

        var cache={},applied=current,best=base;
        cache[fastProbeKey(current)]=base;
        function probe(split){
            if(split<minSplit)split=minSplit;if(split>maxSplit)split=maxSplit;
            split=Math.round(split*100)/100;
            var key=fastProbeKey(split),e;
            if(cache[key]){if(perf)perf.cacheHits++;return cache[key];}
            if(Math.abs(applied-split)>0.01){
                setDividerOnFrames(pair.he,pair.en,split);
                recomposeBilingualStories(pair);
                applied=split;
                if(perf)perf.probes++;
            }
            e=evaluatePageAnchor(pair,a,heRanges,enRanges);e.split=split;cache[key]=e;
            return e;
        }

        // If HE is ahead, the divider must move upward (less HE / more EN).
        // If EN is ahead, move downward.  Only that legal side needs probing.
        var limit=base.delta>0?minSplit:maxSplit;
        var edge=probe(limit);
        if(layoutCandidateBetter(edge,best,current))best=edge;

        // Search only if the relevant side brackets the zero crossing.  The
        // current state and one legal extreme are enough because delta is
        // monotonic while frame widths and typography remain fixed.
        var left=Math.min(current,limit),right=Math.max(current,limit),mid,ev,i;
        var leftEval=(left===current)?base:edge;
        var rightEval=(right===current)?base:edge;
        if(leftEval.valid&&rightEval.valid&&leftEval.delta<=0&&rightEval.delta>=0){
            for(i=0;i<LAYOUT_FAST_BINARY_ITERATIONS;i++){
                mid=(left+right)/2;
                ev=probe(mid);
                if(layoutCandidateBetter(ev,best,current))best=ev;
                if(!ev.valid)break;
                if(ev.delta<0){left=mid;leftEval=ev;}else{right=mid;rightEval=ev;}
                if(right-left<=LAYOUT_FAST_BRACKET_MM)break;
            }
        }

        // Only two local probes are needed after the narrow binary bracket.
        ev=probe(best.split-LAYOUT_FAST_LOCAL_MM);if(layoutCandidateBetter(ev,best,current))best=ev;
        ev=probe(best.split+LAYOUT_FAST_LOCAL_MM);if(layoutCandidateBetter(ev,best,current))best=ev;

        var improved=(best.idGap<base.idGap)||
            (best.idGap===base.idGap&&Math.abs(best.delta)<Math.abs(base.delta)-LAYOUT_ANCHOR_EPSILON)||
            (best.idGap===base.idGap&&Math.abs(Math.abs(best.delta)-Math.abs(base.delta))<=LAYOUT_ANCHOR_EPSILON&&
             Math.abs(best.split-LAYOUT_NOMINAL_SPLIT_MM)<Math.abs(current-LAYOUT_NOMINAL_SPLIT_MM)-0.25);

        if(!improved||Math.abs(best.split-current)<0.20){
            if(Math.abs(applied-current)>0.01){setDividerOnFrames(pair.he,pair.en,current);recomposeBilingualStories(pair);if(perf)perf.probes++;}
            return {changed:normalizedByLimit,page:pageNo,before:base.error,after:base.error,oldSplit:originalSplit,newSplit:current,
                deltaBefore:base.delta,deltaAfter:base.delta,idGapBefore:base.idGap,idGapAfter:base.idGap,hardLimitNormalized:normalizedByLimit};
        }
        if(Math.abs(applied-best.split)>0.01){setDividerOnFrames(pair.he,pair.en,best.split);recomposeBilingualStories(pair);if(perf)perf.probes++;}
        return {changed:true,page:pageNo,before:base.error,after:best.error,oldSplit:originalSplit,newSplit:best.split,
            deltaBefore:base.delta,deltaAfter:best.delta,idGapBefore:base.idGap,idGapAfter:best.idGap,hardLimitNormalized:normalizedByLimit};
    }

    function optimizeOnePageDividerPrecise(doc,pageNo,a,heRanges,enRanges){
        var pair=findBilingualFramesOnPage(doc.pages[pageNo-1]);
        if(!pair.he||!pair.en)return {changed:false,page:pageNo,reason:"Rahmen fehlen"};
        var originalSplit=frameBottomMm(pair.he);
        var current=clampLayoutSplitMm(originalSplit);
        var normalizedByLimit=Math.abs(current-originalSplit)>0.01;
        var minSplit=layoutHardMinSplitMm();
        var maxSplit=layoutHardMaxSplitMm();
        if(normalizedByLimit){
            setDividerOnFrames(pair.he,pair.en,current);
            recompose(doc);
        }

        var base=evaluateDividerCandidate(doc,pair,current,a,heRanges,enRanges);
        if(!base.valid){
            if(normalizedByLimit)return {changed:true,page:pageNo,reason:"nur HARD-LIMIT-Normalisierung",before:0,after:0,oldSplit:originalSplit,newSplit:current,
                deltaBefore:0,deltaAfter:0,idGapBefore:0,idGapAfter:0,hardLimitNormalized:true};
            return {changed:false,page:pageNo,reason:"kein Anker"};
        }
        var best=base,low,high,mid,ev,i,candidate;

        // Evaluate both legal extremes.  Progress delta is monotonic with divider
        // height: moving down gives HE more room and EN less room.
        low=evaluateDividerCandidate(doc,pair,minSplit,a,heRanges,enRanges);
        if(layoutCandidateBetter(low,best,current))best=low;
        high=evaluateDividerCandidate(doc,pair,maxSplit,a,heRanges,enRanges);
        if(layoutCandidateBetter(high,best,current))best=high;

        // If the legal range brackets delta=0, binary-search the crossing.
        // Otherwise the best legal extreme/current state already tells us the
        // closest attainable synchronization for this page boundary.
        var lo=minSplit,hi=maxSplit,loEval=low,hiEval=high;
        if(loEval.valid&&hiEval.valid&&loEval.delta<=0&&hiEval.delta>=0){
            for(i=0;i<LAYOUT_BINARY_ITERATIONS;i++){
                mid=(lo+hi)/2;
                ev=evaluateDividerCandidate(doc,pair,mid,a,heRanges,enRanges);
                if(layoutCandidateBetter(ev,best,current))best=ev;
                if(!ev.valid)break;
                if(ev.delta<0){lo=mid;loEval=ev;}else{hi=mid;hiEval=ev;}
                if(hi-lo<=LAYOUT_SEARCH_FINE_MM)break;
            }
        }

        // Local half-millimetre refinement around the best candidate.  This also
        // handles discrete line jumps and plateaus cleanly.
        var fineStart=Math.max(minSplit,best.split-2.0),fineEnd=Math.min(maxSplit,best.split+2.0);
        for(candidate=fineStart;candidate<=fineEnd+0.001;candidate+=LAYOUT_SEARCH_FINE_MM){
            ev=evaluateDividerCandidate(doc,pair,candidate,a,heRanges,enRanges);
            if(layoutCandidateBetter(ev,best,current))best=ev;
        }

        // Decide against the ORIGINAL page state, not against a stale recompose.
        var improved=(best.idGap<base.idGap)||
            (best.idGap===base.idGap&&Math.abs(best.delta)<Math.abs(base.delta)-LAYOUT_ANCHOR_EPSILON)||
            (best.idGap===base.idGap&&Math.abs(Math.abs(best.delta)-Math.abs(base.delta))<=LAYOUT_ANCHOR_EPSILON&&
             Math.abs(best.split-LAYOUT_NOMINAL_SPLIT_MM)<Math.abs(current-LAYOUT_NOMINAL_SPLIT_MM)-0.25);

        if(!improved||Math.abs(best.split-current)<0.20){
            setDividerOnFrames(pair.he,pair.en,current);recompose(doc);
            return {changed:normalizedByLimit,page:pageNo,before:base.error,after:base.error,oldSplit:originalSplit,newSplit:current,
                deltaBefore:base.delta,deltaAfter:base.delta,idGapBefore:base.idGap,idGapAfter:base.idGap,hardLimitNormalized:normalizedByLimit};
        }
        setDividerOnFrames(pair.he,pair.en,best.split);recompose(doc);
        return {changed:true,page:pageNo,before:base.error,after:best.error,oldSplit:originalSplit,newSplit:best.split,
            deltaBefore:base.delta,deltaAfter:best.delta,idGapBefore:base.idGap,idGapAfter:best.idGap,hardLimitNormalized:normalizedByLimit};
    }

    function ensureLayoutNoOverflow(doc,statusField,statusPrefix){
        var chains=collectChains(doc),added=0,repair=repairBilingualThreading(chains),prefix=statusPrefix||"";
        if(!chains.heFirst||!chains.enFirst)throw new Error("Übersatz kann nicht automatisch behoben werden: HE/EN-Textrahmenketten wurden nicht gefunden.");
        if(repair.repaired)recompose(doc);
        refreshChainEnds(chains);
        while(storyOverflows(chains.heFirst)||storyOverflows(chains.enFirst)){
            if(doc.pages.length>=MAX_PAGES)throw new Error("600-Seiten-Sperre erreicht. Der Übersatz benötigt weitere vollständige zweisprachige Seiten; der Bulk-Lauf kann diesen Batch nicht sicher fortsetzen.");
            setStatus(statusField,prefix+"Übersatz erkannt · füge vollständige zweisprachige Seite "+(doc.pages.length+1)+" hinzu …");
            appendBilingualPages(doc,chains,1,statusField);
            added++;
            recompose(doc);
            chains=collectChains(doc);
            repair=repairBilingualThreading(chains);
            if(repair.repaired)recompose(doc);
            refreshChainEnds(chains);
            setStatus(statusField,prefix+"Übersatz wird automatisch behoben · "+doc.pages.length+" / "+MAX_PAGES+" Seiten · ergänzt: "+added);
        }
        // A second explicit verification turns any abnormal/non-resolvable state
        // into a controlled error instead of silently continuing the next batch.
        chains=collectChains(doc);refreshChainEnds(chains);
        if(storyOverflows(chains.heFirst)||storyOverflows(chains.enFirst))
            throw new Error("Übersatz konnte trotz automatischer Seitenerweiterung nicht vollständig behoben werden.");
        return added;
    }

    function removeTailPagesToCount(doc,count){
        count=parseInt(count,10);if(isNaN(count)||count<1)return 0;
        var removed=0;
        while(doc.pages.length>count){
            try{doc.pages[doc.pages.length-1].remove();removed++;}catch(_){break;}
        }
        return removed;
    }

    function restoreFailedBatchLayout(doc,geometry,pageCount){
        restoreLayoutGeometry(doc,geometry);recompose(doc);
        if(doc.pages.length>pageCount){removeTailPagesToCount(doc,pageCount);recompose(doc);}
    }

    function applyBatchLayoutBalance(doc,sourceFile,batchFile,locksText,statusField,preparedAnalysis,fastMode,options){
        var started=new Date().getTime();
        fastMode=(fastMode!==false);
        options=options||{};
        // Reuse the preview analysis calculated immediately before the user's
        // confirmation. This avoids a second complete story/page mapping pass.
        var a=preparedAnalysis||getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText);
        if(!a.compared)throw new Error("Für diesen Batch konnten keine HE/EN-ID-Paare verglichen werden.");
        var ranges=options.preparedRanges||buildBatchStoryRanges(doc,a);
        var anchorBefore=pageAnchorSummary(doc,a,ranges.he,ranges.en);
        var dafBefore=dafHeadingAlignmentSummary(doc,a.parsed,a.batchStartIndex,a.batchEndIndex);
        var dafContextBefore=dafHeadingAlignmentSummary(doc,a.parsed,a.dafContextStartIndex,a.batchEndIndex);
        var limitBefore=dividerHardLimitSummary(doc,a);

        if(a.score===0&&anchorBefore.max<=LAYOUT_ANCHOR_OK&&dafBefore.mismatch===0&&dafBefore.missing===0&&limitBefore.count===0){
            if(options.outcome){options.outcome.addedPages=0;options.outcome.changedPages=0;options.outcome.pageCountAfter=doc.pages.length;options.outcome.alreadyAligned=true;options.outcome.dafMismatchAfter=0;}
            return "Batch "+a.firstId+" bis "+a.lastId+" ist bereits ausreichend ausgerichtet. Keine Rahmenänderung erforderlich.\r\n"+
                "ID-Seitenabweichung: 0 · größte normalisierte Grenzabweichung: "+formatLayoutNumber(anchorBefore.max)+" Segmente · Daf-Titel synchron: ja.";
        }

        var originalPageCount=doc.pages.length;
        var original=captureLayoutGeometry(doc,a.snapshotPages||a.pages);
        var backup=null,backupPath="";
        if(options.skipInddBackup){backupPath=options.backupPath||"";}
        else{backup=createInDesignBackup(doc,"layout_"+safeFileToken(a.firstId)+"_"+safeFileToken(a.lastId));backupPath=backup.fsName;}
        var snap=writeLayoutSnapshot(doc,batchFile,a,original);
        doc.insertLabel(DOC_LAYOUT_SNAPSHOT_LABEL,snap.fsName);
        doc.insertLabel(DOC_LAYOUT_BATCH_LABEL,a.firstId+".."+a.lastId);
        doc.insertLabel(DOC_LAYOUT_LOCKS_LABEL,locksText||"");

        var changes=[],i,pn,res,addedPages=0,dafSync=null;
        var perf={probes:0,cacheHits:0,skipped:0};
        var oldRedraw=null;
        try{
            if(fastMode){try{oldRedraw=app.scriptPreferences.enableRedraw;app.scriptPreferences.enableRedraw=false;}catch(_){oldRedraw=null;}}
            if(fastMode)setStatus(statusField,(options.statusPrefix||"")+"Schnellabgleich "+a.firstId+"–"+a.lastId+" · "+a.pages.length+" Seiten …");
            for(i=0;i<a.pages.length;i++){
                pn=a.pages[i];
                if(a.locks[pn])continue;
                if(!fastMode)setStatus(statusField,(options.statusPrefix||"")+"Präzisionsabgleich "+a.firstId+"–"+a.lastId+" · Seite "+pn+" · "+(i+1)+" / "+a.pages.length);
                res=fastMode?optimizeOnePageDividerFast(doc,pn,a,ranges.he,ranges.en,perf):optimizeOnePageDividerPrecise(doc,pn,a,ranges.he,ranges.en);
                if(res.changed)changes.push(res);
            }
            if(oldRedraw!==null){try{app.scriptPreferences.enableRedraw=oldRedraw;}catch(__){}oldRedraw=null;}

            // v2.0.15: ordinary segment anchors alone do not see a section title.
            // Synchronize every Daf title explicitly before the final overset repair.
            // Daf equality is HARD; a necessary BYH-ID-gap change is SOFT and logged.
            recompose(doc);
            dafSync=synchronizeDafHeadingsForBatch(doc,a,ranges.he,ranges.en,statusField);

            if(options.abortOnOverflow){
                assertNoLayoutOverflow(doc,"nach Layout "+a.firstId+" bis "+a.lastId);
                addedPages=0;
            }else{
                addedPages=ensureLayoutNoOverflow(doc,statusField,options.statusPrefix||"");
                recompose(doc);
            }

            var finalA=getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText);
            var rangesAfter=buildBatchStoryRanges(doc,finalA);
            var anchorAfter=pageAnchorSummary(doc,finalA,rangesAfter.he,rangesAfter.en);
            var dafAfter=dafHeadingAlignmentSummary(doc,finalA.parsed,finalA.batchStartIndex,finalA.batchEndIndex);
            var dafContextAfter=dafHeadingAlignmentSummary(doc,finalA.parsed,finalA.dafContextStartIndex,finalA.batchEndIndex);
            var introducedDaf=introducedDafHeadingMismatches(dafContextBefore,dafContextAfter);
            var limitAfter=dividerHardLimitSummary(doc,finalA);

            // v2.0.9 hard geometry condition: no unprotected batch page may be
            // committed outside ±15 mm.  Daf equality remains an independent,
            // equally mandatory final condition below.
            if(limitAfter.count){
                restoreFailedBatchLayout(doc,original,originalPageCount);
                throw new Error("Sicherheitsabbruch: "+limitAfter.count+" ungeschützte Batch-Seite(n) liegen nach dem Abgleich außerhalb des HARD LIMIT ±15 mm: "+formatDividerLimitRows(limitAfter.outside)+". Der ursprüngliche Rahmen- und Seitenzustand wurde wiederhergestellt.");
            }

            if(dafAfter.mismatch||dafAfter.missing){
                restoreFailedBatchLayout(doc,original,originalPageCount);
                throw new Error("Sicherheitsabbruch: Die Daf-Titel sind nach dem Batch-Abgleich innerhalb des HARD LIMIT ±15 mm noch nicht HE/EN-synchron. "+(dafAfter.details.length?dafAfter.details.join(" | "):""));
            }
            if(introducedDaf.length||dafContextAfter.missing>dafContextBefore.missing){
                restoreFailedBatchLayout(doc,original,originalPageCount);
                throw new Error("Sicherheitsabbruch: Die erweiterte Daf-Korrektur würde einen zuvor synchronen Titel im rollback-sicheren Kontext verschlechtern. "+(introducedDaf.length?introducedDaf.join(" | "):"Eine zuvor vorhandene Überschrift wäre nicht mehr auffindbar."));
            }
            if(dafAfter.mismatch>dafBefore.mismatch||dafAfter.missing>dafBefore.missing){
                restoreFailedBatchLayout(doc,original,originalPageCount);
                throw new Error("Sicherheitsabbruch: Die Daf-Titel-Synchronität wäre schlechter geworden. Der ursprüngliche Rahmen- und Seitenzustand wurde wiederhergestellt.");
            }

            // v2.0.10 priority model:
            // HARD = geometry envelope + Daf equality (+ overflow checks above).
            // SOFT = BYH page-anchor score / differing boundary IDs.
            //
            // The old non-regression rule is still valuable for a normal alignment
            // where no HARD defect existed beforehand.  It must NOT, however, undo
            // a necessary repair merely because pulling a legacy divider back from
            // e.g. 86 mm to the legal 111 mm makes a local segment anchor worse.
            var hardRepairWasRequired=
                (limitBefore.count>0 || dafBefore.mismatch>0 || dafBefore.missing>0);
            var anchorRegression=
                (anchorAfter.score>anchorBefore.score+LAYOUT_ANCHOR_EPSILON);
            var idBoundaryRegression=
                (anchorAfter.idMismatch>anchorBefore.idMismatch);
            var acceptedSoftRegression=false;

            if(!hardRepairWasRequired && changes.length && anchorRegression){
                restoreFailedBatchLayout(doc,original,originalPageCount);
                throw new Error("Sicherheitsabbruch: Bei diesem Batch war keine HARD-Reparatur erforderlich, aber die Summe der Seitenanker wäre schlechter geworden. Der ursprüngliche Rahmen- und Seitenzustand wurde wiederhergestellt.");
            }

            // During a required HARD repair, a worse soft anchor result is allowed.
            // It is deliberately reported instead of rolled back, because otherwise
            // the ±15-mm production limit or Daf equality could never be authoritative.
            if(hardRepairWasRequired && (anchorRegression || idBoundaryRegression)){
                acceptedSoftRegression=true;
            }

            if(!options.skipSave)doc.save();
            appendLayoutAudit(doc,fastMode?"APPLY_FAST_DAFSYNC":"APPLY_PRECISE_DAFSYNC",a.firstId,a.lastId,
                a.score+" / Anker "+formatLayoutNumber(anchorBefore.score)+" / Daf "+dafBefore.mismatch+" / Limit "+limitBefore.count,
                finalA.score+" / Anker "+formatLayoutNumber(anchorAfter.score)+" / Daf "+dafAfter.mismatch+" / Limit "+limitAfter.count+
                    (acceptedSoftRegression?" / SOFT-Regression akzeptiert wegen HARD-Reparatur":""),
                a.pages,a.lockedText,backupPath,snap.fsName);

            var detail=[],d,changedPageSet={},changedPages=0;
            for(i=0;i<changes.length;i++){
                d=changes[i];changedPageSet[d.page]=true;
                detail.push("Seite "+d.page+": "+(d.hardLimitNormalized?"HARD-LIMIT-NORMALISIERUNG · ":"")+"Trennlinie "+formatLayoutNumber(d.oldSplit)+" → "+formatLayoutNumber(d.newSplit)+" mm · BYH-ID-Abstand "+d.idGapBefore+" → "+d.idGapAfter+" · norm. Fortschritt "+formatLayoutNumber(Math.abs(d.deltaBefore))+" → "+formatLayoutNumber(Math.abs(d.deltaAfter)));
            }
            if(dafSync){
                for(i=0;i<dafSync.changes.length;i++){
                    d=dafSync.changes[i];changedPageSet[d.page]=true;
                    detail.push("Seite "+d.page+": DAF-SYNC "+d.label+(d.fallback?" über Vorseite":"")+(d.cumulative?" · kumulative Mehrseitenkorrektur":"")+" · HE/EN "+d.heBefore+"/"+d.enBefore+" → gemeinsam Seite "+d.after+" · Trennlinie "+formatLayoutNumber(d.oldSplit)+" → "+formatLayoutNumber(d.newSplit)+" mm · SOFT-BYH-ID-Abstand "+d.idGapBefore+" → "+d.idGapAfter);
                }
            }
            for(var ck in changedPageSet)if(changedPageSet[ck])changedPages++;
            var elapsed=(new Date().getTime()-started)/1000;
            if(options.outcome){
                options.outcome.addedPages=addedPages;
                options.outcome.changedPages=changedPages;
                options.outcome.pageCountBefore=originalPageCount;
                options.outcome.pageCountAfter=doc.pages.length;
                options.outcome.firstId=a.firstId;
                options.outcome.lastId=a.lastId;
                options.outcome.alreadyAligned=false;
                options.outcome.dafMismatchBefore=dafBefore.mismatch;
                options.outcome.dafMismatchAfter=dafAfter.mismatch;
                options.outcome.dafSyncChanges=dafSync?dafSync.changes.length:0;
            }
            return "BATCH-LAYOUT ANGEGLICHEN\r\n"+
                "Modus: "+(fastMode?"Schnellmodus v1.0.13 + Daf-Sync v2.0.11 + HARD LIMIT ±15 mm":"Präzisionsmodus v1.0.12 + Daf-Sync v2.0.11 + HARD LIMIT ±15 mm")+"\r\n"+
                "Laufzeit: "+formatLayoutNumber(elapsed)+" s"+(fastMode?" · Divider-Proben: "+perf.probes+" · Cache-Treffer: "+perf.cacheHits+" · bereits passende Seiten übersprungen: "+perf.skipped:"")+"\r\n"+
                "IDs: "+a.firstId+" bis "+a.lastId+"\r\n"+
                "Betroffene Seiten: "+formatPageList(a.pages)+"\r\n"+
                "Geschützte Seiten: "+(a.lockedText||"keine")+"\r\n"+
                "ID-Seitenabweichung vorher: "+a.score+" · nachher: "+finalA.score+"\r\n"+
                "Grenzfehler vorher: "+formatLayoutNumber(anchorBefore.score)+" · nachher: "+formatLayoutNumber(anchorAfter.score)+"\r\n"+
                "Grenzen mit unterschiedlicher BYH-ID vorher: "+anchorBefore.idMismatch+" · nachher: "+anchorAfter.idMismatch+"\r\n"+
                "Daf-Titel auf unterschiedlicher physischer Seite vorher: "+dafBefore.mismatch+" · nachher: "+dafAfter.mismatch+"\r\n"+
                "Divider außerhalb HARD LIMIT vorher: "+limitBefore.count+" · nachher: "+limitAfter.count+
                (limitAfter.lockedCount?" · geschützt außerhalb Limit: "+limitAfter.lockedCount:"")+"\r\n"+
                "Priorität: HARD = Divider ±15 mm + Daf-Synchronität · SOFT = BYH-Seitenanker\r\n"+
                (acceptedSoftRegression?
                    "Hinweis: Eine Verschlechterung der SOFT-Seitenanker wurde akzeptiert, weil eine HARD-Reparatur erforderlich war.\r\n":"")+
                "Größte normalisierte Abweichung vorher: "+formatLayoutNumber(anchorBefore.max)+" · nachher: "+formatLayoutNumber(anchorAfter.max)+" Segmente\r\n"+
                "Tatsächlich geänderte Seiten: "+changedPages+"\r\n"+
                "Zusätzlich benötigte Seiten wegen Übersatz: "+addedPages+"\r\n"+
                "INDD-Sicherung: "+(backupPath||"keine separate Sicherung")+"\r\n"+
                "Layout-Snapshot: "+snap.fsName+"\r\n\r\n"+
                (detail.length?detail.join("\r\n")+"\r\n\r\n":"")+
                (changedPages?"Die Trennhöhen wurden kontrolliert verändert; Daf-Grenzen und BYH-ID-Anker wurden anschließend erneut geprüft. ":"Es wurde auf keiner Seite eine messbare Verbesserung benötigt; die Rahmen blieben unverändert. ")+
                "'Letzten Batch rückgängig' stellt Rahmen und – bei Snapshot v2 – auch die ursprüngliche Seitenzahl wieder her.";
        }catch(e){
            if(oldRedraw!==null){try{app.scriptPreferences.enableRedraw=oldRedraw;}catch(___){}oldRedraw=null;}
            try{restoreFailedBatchLayout(doc,original,originalPageCount);}catch(____){}
            throw e;
        }
    }

    function resetBatchPagesToStandard(doc,sourceFile,batchFile,locksText,statusField){
        recompose(doc);
        var a=getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText);
        var originalPageCount=doc.pages.length;
        var original=captureLayoutGeometry(doc,a.snapshotPages||a.pages);
        var backup=createInDesignBackup(doc,"layout_standard_"+safeFileToken(a.firstId)+"_"+safeFileToken(a.lastId));
        var snap=writeLayoutSnapshot(doc,batchFile,a,original);
        doc.insertLabel(DOC_LAYOUT_SNAPSHOT_LABEL,snap.fsName);
        doc.insertLabel(DOC_LAYOUT_BATCH_LABEL,a.firstId+".."+a.lastId);
        doc.insertLabel(DOC_LAYOUT_LOCKS_LABEL,locksText||"");
        var changed=[],i,pn,pair,oldSplit;
        try{
            for(i=0;i<a.pages.length;i++){
                pn=a.pages[i];if(a.locks[pn]||pn<1||pn>doc.pages.length)continue;
                pair=findBilingualFramesOnPage(doc.pages[pn-1]);if(!pair.he||!pair.en)continue;
                oldSplit=frameBottomMm(pair.he);
                if(Math.abs(oldSplit-LAYOUT_NOMINAL_SPLIT_MM)<0.10)continue;
                setDividerOnFrames(pair.he,pair.en,LAYOUT_NOMINAL_SPLIT_MM);changed.push(pn);
            }
            recompose(doc);
            ensureLayoutNoOverflow(doc,statusField);recompose(doc);doc.save();
            appendLayoutAudit(doc,"RESET_STANDARD",a.firstId,a.lastId,"","",a.pages,a.lockedText,backup.fsName,snap.fsName);
            return "BATCH-SEITEN AUF STANDARD ZURÜCKGESETZT\r\n"+
                "IDs: "+a.firstId+" bis "+a.lastId+"\r\n"+
                "Betroffene Seiten: "+formatPageList(a.pages)+"\r\n"+
                "Geänderte Seiten: "+formatPageList(changed)+"\r\n"+
                "Standard: HE unten 126,00 mm · EN oben 129,00 mm\r\n"+
                "Geschützte Seiten: "+(a.lockedText||"keine")+"\r\n"+
                "INDD-Sicherung: "+backup.fsName+"\r\nLayout-Snapshot: "+snap.fsName+"\r\n\r\n"+
                "Jetzt 'Batch analysieren' und danach 'Automatisch angleichen' ausführen.";
        }catch(e){try{restoreFailedBatchLayout(doc,original,originalPageCount);}catch(_){}throw e;}
    }

    function findBilingualFramesOnPage(page){
        var he=null,en=null,i,tf;for(i=0;i<page.textFrames.length;i++){tf=page.textFrames[i];if(tf.label===FRAME_HE_LABEL)he=tf;else if(tf.label===FRAME_EN_LABEL)en=tf;}return {he:he,en:en};
    }

    function frameBottomMm(tf){
        var old=null,v;
        try{old=app.scriptPreferences.measurementUnit;app.scriptPreferences.measurementUnit=MeasurementUnits.POINTS;}catch(_){old=null;}
        try{v=Number(tf.geometricBounds[2]);}finally{try{if(old!==null)app.scriptPreferences.measurementUnit=old;}catch(__){}}
        return ptToMm(v);
    }

    function setDividerOnFrames(he,en,splitMm){
        var hb=he.geometricBounds,eb=en.geometricBounds;
        // v2.0.9 final safety net: no solver or Daf-sync call can commit a
        // divider outside the hard ±15 mm production envelope.
        splitMm=clampLayoutSplitMm(splitMm);
        // Explicit measurement strings make this independent of the user's ruler
        // and script measurement-unit preferences.
        hb=[hb[0],hb[1],mm(splitMm),hb[3]];
        eb=[mm(splitMm+LAYOUT_GAP_MM),eb[1],eb[2],eb[3]];
        he.geometricBounds=hb;en.geometricBounds=eb;
    }

    function captureLayoutGeometry(doc,pages){
        var out=[],i,pair,hb,eb,pn;for(i=0;i<pages.length;i++){pn=pages[i];if(pn<1||pn>doc.pages.length)continue;pair=findBilingualFramesOnPage(doc.pages[pn-1]);if(!pair.he||!pair.en)continue;hb=pair.he.geometricBounds;eb=pair.en.geometricBounds;out.push({page:pn,he:[Number(hb[0]),Number(hb[1]),Number(hb[2]),Number(hb[3])],en:[Number(eb[0]),Number(eb[1]),Number(eb[2]),Number(eb[3])]});}return out;
    }

    function restoreLayoutGeometry(doc,snapshot){
        var i,r,pair;for(i=0;i<snapshot.length;i++){r=snapshot[i];if(r.page<1||r.page>doc.pages.length)continue;pair=findBilingualFramesOnPage(doc.pages[r.page-1]);if(pair.he)pair.he.geometricBounds=r.he;if(pair.en)pair.en.geometricBounds=r.en;}
    }

    function writeLayoutSnapshot(doc,batchFile,a,geometry){
        var original;try{original=doc.fullName;}catch(_){original=null;}if(!original||!original.exists)throw new Error("Der aktive InDesign-Band muss gespeichert sein, bevor ein Layout-Snapshot angelegt werden kann.");
        var folder=new Folder(original.parent.fsName+"/BYH_Layout_Snapshots");if(!folder.exists&&!folder.create())throw new Error("Snapshot-Ordner konnte nicht erstellt werden: "+folder.fsName);
        var f=uniqueFile(new File(folder.fsName+"/Layout_Batch_"+safeFileToken(a.firstId)+"_bis_"+safeFileToken(a.lastId)+"_"+timestamp()+".tsv"));
        var lines=["BYH_LAYOUT_SNAPSHOT\t2","batch\t"+tsv(batchFile.fsName),"ids\t"+a.firstId+"\t"+a.lastId,"pages\t"+formatPageList(a.snapshotPages||a.pages),"page_count\t"+doc.pages.length,"locks\t"+(a.lockedText||"")];
        lines.push("page\the_top\the_left\the_bottom\the_right\ten_top\ten_left\ten_bottom\ten_right");
        for(var i=0;i<geometry.length;i++){var r=geometry[i];lines.push(r.page+"\t"+r.he.join("\t")+"\t"+r.en.join("\t"));}
        writeUTF8(f,lines.join("\r\n"));return f;
    }

    function restoreLayoutSnapshot(doc,file){
        if(!file||!file.exists)throw new Error("Layout-Snapshot nicht gefunden: "+(file?file.fsName:""));
        var raw=normalizeNewlines(readUTF8(file)),lines=raw.split("\n"),geometry=[],i,parts,start=false,pageCount=0;
        for(i=0;i<lines.length;i++){
            parts=lines[i].split("\t");
            if(parts[0]==="page_count"&&parts.length>1)pageCount=parseInt(parts[1],10);
            if(parts[0]==="page"&&parts[1]==="he_top"){start=true;continue;}
            if(!start||parts.length<9)continue;
            geometry.push({page:parseInt(parts[0],10),he:[Number(parts[1]),Number(parts[2]),Number(parts[3]),Number(parts[4])],en:[Number(parts[5]),Number(parts[6]),Number(parts[7]),Number(parts[8])]});
        }
        if(!geometry.length)throw new Error("Der Snapshot enthält keine wiederherstellbaren Rahmenkoordinaten.");
        var backup=createInDesignBackup(doc,"before_layout_undo");restoreLayoutGeometry(doc,geometry);recompose(doc);
        if(pageCount>0&&doc.pages.length>pageCount){removeTailPagesToCount(doc,pageCount);recompose(doc);}
        doc.save();
        doc.insertLabel(DOC_LAYOUT_SNAPSHOT_LABEL,"");doc.insertLabel(DOC_LAYOUT_BATCH_LABEL,"");
        appendLayoutAudit(doc,"RESTORE","","","","",snapshotPageNumbers(geometry),"",backup.fsName,file.fsName);
        return "Batch-Layout wurde aus Snapshot zurückgesetzt.\r\nWiederhergestellte Seiten: "+formatPageList(snapshotPageNumbers(geometry))+(pageCount>0?"\r\nUrsprüngliche Seitenzahl: "+pageCount:"")+"\r\nSicherung vor Rückgängig: "+backup.fsName+"\r\nSnapshot: "+file.fsName;
    }

    function appendLayoutAudit(doc,action,firstId,lastId,beforeScore,afterScore,pages,locks,backupPath,snapshotPath){
        var original;try{original=doc.fullName;}catch(_){original=null;}if(!original||!original.exists)return;
        var folder=new Folder(original.parent.fsName+"/BYH_Layout_Snapshots");if(!folder.exists&&!folder.create())return;
        var f=new File(folder.fsName+"/BYH_Layout_Audit.tsv"),isNew=!f.exists;
        f.encoding="UTF-8";f.lineFeed="Windows";if(!f.open("a"))return;
        if(isNew)f.write("\uFEFFtimestamp\taction\tdocument\tfirst_id\tlast_id\tscore_before\tscore_after\tpages\tlocks\tbackup\tsnapshot\r\n");
        f.write(timestamp()+"\t"+tsv(action)+"\t"+tsv(original.fsName)+"\t"+tsv(firstId)+"\t"+tsv(lastId)+"\t"+tsv(beforeScore)+"\t"+tsv(afterScore)+"\t"+tsv(formatPageList(pages))+"\t"+tsv(locks)+"\t"+tsv(backupPath)+"\t"+tsv(snapshotPath)+"\r\n");
        f.close();
    }

    function snapshotPageNumbers(geometry){var a=[],i;for(i=0;i<geometry.length;i++)a.push(geometry[i].page);return a;}

    function parsePageRanges(text,maxPages){
        var set={},s=trim(text),parts,i,p,m,a,b,n;if(!s)return set;parts=s.split(/[,;\s]+/);for(i=0;i<parts.length;i++){p=parts[i];if(!p)continue;m=/^(\d+)-(\d+)$/.exec(p);if(m){a=parseInt(m[1],10);b=parseInt(m[2],10);if(a>b){n=a;a=b;b=n;}for(n=a;n<=b;n++)if(n>=1&&n<=maxPages)set[n]=true;}else{n=parseInt(p,10);if(!isNaN(n)&&n>=1&&n<=maxPages)set[n]=true;}}return set;
    }

    function objectKeysAsNumbers(o){var a=[],k;for(k in o)if(o[k])a.push(parseInt(k,10));a.sort(function(x,y){return x-y;});return a;}

    function formatPageList(pages){
        if(!pages||!pages.length)return "keine";var a=pages.slice(0),out=[],start=a[0],prev=a[0],i;for(i=1;i<=a.length;i++){if(i<a.length&&a[i]===prev+1){prev=a[i];continue;}out.push(start===prev?String(start):start+"-"+prev);if(i<a.length){start=prev=a[i];}}return out.join(", ");
    }

    function safeFileToken(s){return String(s||"").replace(/[^A-Za-z0-9_-]/g,"_");}
    function ptToMm(v){return Number(v)/2.834645669291339;}
    function mmToPt(v){return Number(v)*2.834645669291339;}

    function collectChains(doc){
        var he=[],en=[],i,j,p,tf;
        for(i=0;i<doc.pages.length;i++){
            p=doc.pages[i];
            for(j=0;j<p.textFrames.length;j++){
                tf=p.textFrames[j];if(tf.label===FRAME_HE_LABEL)he.push(tf);else if(tf.label===FRAME_EN_LABEL)en.push(tf);
            }
        }
        return {heFirst:he.length?he[0]:null,enFirst:en.length?en[0]:null,heLast:he.length?he[he.length-1]:null,enLast:en.length?en[en.length-1]:null,heFrames:he,enFrames:en};
    }

    // v2.0.7: display-only editorial cleanup for an obvious duplicated word
    // across a sentence boundary in <band_en>, e.g. "one. one" -> "one. One".
    // The BILINGUAL master remains untouched; only the composed InDesign text is corrected.
    function cleanEnglishBandForDisplay(text){
        return String(text||"").replace(/\b([A-Za-z][A-Za-z\'’-]{1,})\.\s+([a-z][A-Za-z\'’-]{1,})\b/g,function(all,a,b){
            if(String(a).toLowerCase()!==String(b).toLowerCase())return all;
            return a+". "+b.charAt(0).toUpperCase()+b.substring(1);
        });
    }

    function composeDisplayTexts(p){
        var he=[],en=[],lastHe=null,lastEn=null,translated=0,untranslated=0,i,s;
        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];
            if(s.sectionHe!==lastHe){he.push("<section>"+s.sectionHe+"</section>");lastHe=s.sectionHe;}
            // v2.0.0: Talmud band ahead of the commentary, inside the same flow
            if(trim(stripTags(s.bandHe||"")))he.push("<band>"+s.bandHe+"</band>");
            he.push("<b>["+s.number+"]</b> "+s.he);
            if(trim(stripTags(s.en))){
                if(!trim(s.sectionEn))throw new Error("Englische Abschnittsüberschrift fehlt für: "+s.sectionHe+". Der englische Textfluss wird nicht mit einem hebräischen Ersatztitel aufgebaut.");
                if(/[\u0590-\u05FF]/.test(s.sectionEn))throw new Error("Das englische Titelfeld enthält hebräische Zeichen für: "+s.sectionHe+".");
                if(s.sectionEn!==lastEn){en.push("<section>"+s.sectionEn+"</section>");lastEn=s.sectionEn;}
                if(trim(stripTags(s.bandEn||"")))en.push("<band>"+cleanEnglishBandForDisplay(s.bandEn)+"</band>");
                en.push("<b>["+s.number+"]</b> "+s.en);translated++;
            }else untranslated++;
        }
        var heText=he.join("\r\r"),enText=en.join("\r\r");
        var heVisible=visibleLength(heText),enVisible=visibleLength(enText);
        return {he:heText,en:enText,heVisible:heVisible,enVisible:enVisible,enEstimated:Math.max(enVisible,Math.ceil(heVisible*EN_EXPANSION)),translated:translated,untranslated:untranslated};
    }

    function insertTextChunked(firstFrame,text,statusField,label){
        text=String(text||"");firstFrame.contents="";
        var story=firstFrame.parentStory,pos=0,total=text.length,size=100000,n=0,end;
        while(pos<total){end=Math.min(total,pos+size);story.insertionPoints[story.insertionPoints.length-1].contents=text.substring(pos,end);pos=end;n++;setStatus(statusField,label+" · "+Math.round(pos/1000)+"k / "+Math.round(total/1000)+"k Zeichen");}
    }

    // ---------------- Formatting ----------------

    function ensureStyles(doc){
        var he=ensurePara(doc,STYLE_HE),en=ensurePara(doc,STYLE_EN),hh=ensurePara(doc,STYLE_HE_HEAD),eh=ensurePara(doc,STYLE_EN_HEAD);
        try{he.appliedFont=safeFont(HE_FONT,HE_FONT_STYLE);he.fontStyle=HE_FONT_STYLE;he.pointSize=HE_SIZE;he.leading=HE_LEADING;he.justification=Justification.RIGHT_JUSTIFIED;he.paragraphDirection=ParagraphDirectionOptions.RIGHT_TO_LEFT_DIRECTION;he.composer="Adobe World-Ready Paragraph Composer";he.hyphenation=false;he.keepFirstLines=2;he.keepLastLines=2;}catch(_){ }
        try{en.appliedFont=safeFont(EN_FONT,EN_FONT_STYLE);en.fontStyle=EN_FONT_STYLE;en.pointSize=EN_SIZE;en.leading=EN_LEADING;en.justification=Justification.LEFT_JUSTIFIED;en.paragraphDirection=ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;en.hyphenation=true;en.keepFirstLines=2;en.keepLastLines=2;}catch(_){ }
        try{hh.basedOn=he;hh.appliedFont=safeFont(HE_FONT,HE_FONT_STYLE);hh.pointSize=17;hh.leading=20;hh.justification=Justification.CENTER_ALIGN;hh.spaceBefore=10;hh.spaceAfter=7;hh.keepWithNext=2;hh.keepAllLinesTogether=true;}catch(_){ }
        try{eh.basedOn=en;eh.appliedFont=safeFont(EN_FONT,"Bold");eh.pointSize=15;eh.leading=18;eh.justification=Justification.CENTER_ALIGN;eh.spaceBefore=10;eh.spaceAfter=7;eh.keepWithNext=2;eh.keepAllLinesTogether=true;}catch(_){ }
        // ---- v2.0.0: Talmud band and footnote apparatus ----
        // The band is a paragraph at the head of every segment inside the
        // existing story, not a separate frame. That way the whole threading
        // and divider-balancing machinery keeps working untouched.
        var bh=ensurePara(doc,STYLE_BAND_HE),be=ensurePara(doc,STYLE_BAND_EN);
        var fh=ensurePara(doc,STYLE_FN_HE),fe=ensurePara(doc,STYLE_FN_EN);
        try{
            bh.basedOn=he;bh.appliedFont=safeFont(HE_FONT,"Bold");bh.fontStyle="Bold";
            bh.pointSize=BAND_HE_SIZE;bh.leading=BAND_HE_LEADING;
            bh.spaceBefore=7;bh.spaceAfter=4;bh.keepWithNext=2;bh.keepAllLinesTogether=true;
            bh.ruleAbove=true;bh.ruleAboveLineWeight=0.8;bh.ruleAboveOffset=mm(3.5);
            bh.ruleBelow=true;bh.ruleBelowLineWeight=0.4;bh.ruleBelowOffset=mm(2.0);
            bh.fillColor=doc.swatches.item("Black");bh.fillTint=BAND_TINT;
        }catch(_){ }
        try{
            be.basedOn=en;be.appliedFont=safeFont(EN_FONT,"Italic");be.fontStyle="Italic";
            be.pointSize=BAND_EN_SIZE;be.leading=BAND_EN_LEADING;
            be.spaceBefore=7;be.spaceAfter=4;be.keepWithNext=2;be.keepAllLinesTogether=true;
            be.ruleAbove=true;be.ruleAboveLineWeight=0.8;be.ruleAboveOffset=mm(3.5);
            be.ruleBelow=true;be.ruleBelowLineWeight=0.4;be.ruleBelowOffset=mm(2.0);
        }catch(_){ }
        try{fh.basedOn=he;fh.pointSize=FN_SIZE;fh.leading=FN_LEADING;fh.hyphenation=false;}catch(_){ }
        try{fe.basedOn=en;fe.pointSize=FN_SIZE;fe.leading=FN_LEADING;}catch(_){ }

        var b=ensureChar(doc,CHAR_BOLD),it=ensureChar(doc,CHAR_ITALIC),hi=ensureChar(doc,CHAR_HE_IN_EN),sm=ensureChar(doc,CHAR_SMALL),su=ensureChar(doc,CHAR_SUP),lm=ensureChar(doc,CHAR_LEMMA);
        try{b.fontStyle="Bold";}catch(_){ }
        try{it.fontStyle="Italic";}catch(_){ }
        try{hi.appliedFont=safeFont(HE_FONT,HE_FONT_STYLE);hi.fontStyle=HE_FONT_STYLE;hi.pointSize=9;}catch(_){ }
        try{sm.pointSize=8;}catch(_){ }
        try{su.position=Position.SUPERSCRIPT;}catch(_){ }
        try{lm.fontStyle="Bold";}catch(_){ }
        return {he:he,en:en,heHead:hh,enHead:eh,bandHe:bh,bandEn:be,fnHe:fh,fnEn:fe,
                bold:b,italic:it,heInEn:hi,small:sm,sup:su,lemma:lm};
    }

    // v2.0.0: footnote defaults. InDesign places footnotes at the foot of the
    // containing frame by itself, which is exactly what we need - the Hebrew
    // notes sit under the Hebrew frame, the English under the English frame,
    // and the divider solver does not have to know anything about them.
    function ensureFootnoteOptions(doc,styles){
        try{
            var o=doc.footnoteOptions;
            o.footnoteNumberingStyle=FootnoteNumberingStyleType.ARABIC;
            o.restartNumbering=FootnoteRestarting.PAGE;
            o.startAt=1;
            o.separatorText="\t";
            o.footnoteTextStyle=styles.fnEn;
            o.markerPositioning=FootnoteMarkerPositioning.SUPERSCRIPT_MARKER;
            o.ruleOn=true;o.ruleLineWeight=0.4;o.ruleWidth=30;
            o.spaceBetweenFootnotes=mm(0.6);
            o.spaceBeforeFirstFootnote=mm(2.0);
        }catch(_){ }
    }

    function formatStory(doc,story,isHebrew,statusField){
        var st=ensureStyles(doc),base=isHebrew?st.he:st.en,removedRedundant=0,convertedNotes=0;
        ensureFootnoteOptions(doc,st);
        try{story.paragraphs.everyItem().appliedParagraphStyle=base;}catch(_){ }
        grepApplyParagraphAndStrip(story,"<section>([\\s\\S]*?)</section>",isHebrew?st.heHead:st.enHead,"$1");
        // v2.0.0: the Talmud band is its own paragraph at the head of a segment
        grepApplyParagraphAndStrip(story,"<band>([\\s\\S]*?)</band>",isHebrew?st.bandHe:st.bandEn,"$1");
        grepApplyAndStrip(story,"<lemma>([\\s\\S]*?)</lemma>",st.lemma,"$1");
        grepApplyAndStrip(story,"<b>([\\s\\S]*?)</b>",st.bold,"$1");
        grepApplyAndStrip(story,"<i>([\\s\\S]*?)</i>",st.italic,"$1");
        grepApplyAndStrip(story,"<small>([\\s\\S]*?)</small>",st.small,"$1");
        grepApplyAndStrip(story,"<sup>([\\s\\S]*?)</sup>",st.sup,"$1");
        grepReplace(story,"<br\\s*/?>","\\r");
        // v2.0.7: remove only a pure citation footnote when exactly the same
        // citation is already printed in the same English paragraph. Explanatory
        // notes are never touched. This is output cleanup only; the master stays intact.
        if(!isHebrew)removedRedundant=removeRedundantCitationFootnoteMarkers(story);
        convertedNotes=convertFootnoteMarkers(doc,story,st,isHebrew,statusField);
        if(!isHebrew)grepApply(story,"[\\x{0590}-\\x{05FF}]+",st.heInEn);
        resetGrep();
        return {removedRedundantSourceFootnotes:removedRedundant,convertedFootnotes:convertedNotes};
    }

    function normalizeCitationForCompare(s){
        return trim(stripTags(String(s||"")))
            .replace(/^[\(\[]+|[\)\]]+$/g,"")
            .replace(/[.,;:]+$/g,"")
            .replace(/[–—]/g,"-")
            .replace(/\s+/g," ")
            .toLowerCase();
    }

    function isPureSourceCitation(s){
        var t=trim(stripTags(String(s||"")));
        if(!t||t.length>120)return false;
        t=t.replace(/^[\(\[]+|[\)\]]+$/g,"").replace(/[.,;:]+$/g,"");
        // Tanach / Talmud / Midrash / Zohar-style short citations only.
        // Any explanatory prose makes the footnote ineligible for suppression.
        if(/^(?:[1-3]\s+)?[A-Za-z][A-Za-z .\'’\-]+\s+\d{1,4}(?::\d{1,4}(?:[-–]\d{1,4})?|[ab])(?:\s*[,;]\s*(?:[1-3]\s+)?[A-Za-z][A-Za-z .\'’\-]+\s+\d{1,4}(?::\d{1,4}(?:[-–]\d{1,4})?|[ab]))*$/.test(t))return true;
        if(/^Zohar\s+[IVXLC]+(?:,|\s)\s*\d+(?::\d+)?$/i.test(t))return true;
        return false;
    }

    function removeRedundantCitationFootnoteMarkers(story){
        var hits=null,recs=[],i,raw,inner,paraText,outside,needle,hay,c,removed=0;
        resetGrep();
        try{app.findGrepPreferences.findWhat="<fn>[\\s\\S]*?</fn>";hits=story.findGrep();}
        catch(_){hits=null;}finally{resetGrep();}
        if(!hits||!hits.length)return 0;
        for(i=0;i<hits.length;i++){
            try{
                raw=String(hits[i].contents);inner=raw.replace(/^<fn>/,"").replace(/<\/fn>$/,"");
                if(!isPureSourceCitation(inner))continue;
                paraText=String(hits[i].paragraphs[0].contents||"");
                outside=paraText.replace(raw,"");
                needle=normalizeCitationForCompare(inner);hay=normalizeCitationForCompare(outside);
                if(needle&&hay.indexOf(needle)>=0)recs.push({idx:hits[i].insertionPoints[0].index,len:raw.length});
            }catch(__){ }
        }
        for(i=recs.length-1;i>=0;i--){
            try{c=story.characters.itemByRange(recs[i].idx,recs[i].idx+recs[i].len-1);c.remove();removed++;}catch(___){ }
        }
        return removed;
    }

    // v2.0.0: turn <fn>…</fn> markers into real InDesign footnotes.
    // Worked from the END of the story backwards, so removing a marker never
    // shifts the character indices of the markers still to be processed.
    // One findGrep for the whole story instead of one per footnote - with
    // well over a thousand notes per volume that is the difference between
    // seconds and minutes.
    function convertFootnoteMarkers(doc,story,st,isHebrew,statusField){
        var style=isHebrew?st.fnHe:st.fnEn,recs=[],hits,i,c,raw,inner,fn;
        resetGrep();
        try{
            app.findGrepPreferences.findWhat="<fn>[\\s\\S]*?</fn>";
            hits=story.findGrep();
        }catch(_){ hits=null; }
        finally{ resetGrep(); }
        if(!hits||!hits.length)return 0;
        for(i=0;i<hits.length;i++){
            try{
                raw=String(hits[i].contents);
                recs.push({idx:hits[i].insertionPoints[0].index,len:raw.length,
                           txt:raw.replace(/^<fn>/,"").replace(/<\/fn>$/,"")});
            }catch(__){ }
        }
        for(i=recs.length-1;i>=0;i--){
            try{
                c=story.characters.itemByRange(recs[i].idx,recs[i].idx+recs[i].len-1);
                c.remove();
                fn=story.insertionPoints[recs[i].idx].footnotes.add();
                fn.insertionPoints[-1].contents=recs[i].txt;
                try{fn.texts[0].appliedParagraphStyle=style;}catch(___){ }
                // Hebrew inside an English note keeps the Hebrew face
                if(!isHebrew){try{grepApply(fn.texts[0],"[\\x{0590}-\\x{05FF}]+",st.heInEn);}catch(____){ }}
            }catch(__){ }
            if(statusField&&(i%200===0))setStatus(statusField,"Fußnoten · "+(recs.length-i)+" / "+recs.length);
        }
        resetGrep();
        return recs.length;
    }

    function grepApplyAndStrip(story,pattern,style,replacement){
        resetGrep();
        try{app.findGrepPreferences.findWhat=pattern;app.changeGrepPreferences.changeTo=replacement;app.changeGrepPreferences.appliedCharacterStyle=style;story.changeGrep();}finally{resetGrep();}
    }
    function grepApplyParagraphAndStrip(story,pattern,style,replacement){
        resetGrep();
        try{app.findGrepPreferences.findWhat=pattern;app.changeGrepPreferences.changeTo=replacement;app.changeGrepPreferences.appliedParagraphStyle=style;story.changeGrep();}finally{resetGrep();}
    }
    function grepApply(story,pattern,style){resetGrep();try{app.findGrepPreferences.findWhat=pattern;app.changeGrepPreferences.appliedCharacterStyle=style;story.changeGrep();}finally{resetGrep();}}
    function grepReplace(story,pattern,replacement){resetGrep();try{app.findGrepPreferences.findWhat=pattern;app.changeGrepPreferences.changeTo=replacement;story.changeGrep();}finally{resetGrep();}}
    function resetGrep(){try{app.findGrepPreferences=NothingEnum.NOTHING;app.changeGrepPreferences=NothingEnum.NOTHING;}catch(_){}}

    // ---------------- Running headers v2.0.5 ----------------

    function positiveNumber(v,fallback){var n=parseFloat(String(v).replace(",","."));return isNaN(n)||n<=0?fallback:n;}
    function signedNumber(v,fallback){var n=parseFloat(String(v).replace(",","."));return isNaN(n)?fallback:n;}
    function boundedNumber(v,fallback,min,max){var n=parseFloat(String(v).replace(",","."));if(isNaN(n))n=fallback;if(n<min)n=min;if(n>max)n=max;return n;}

    function bavliTractateMap(){
        return [
            ["Berakhot","ברכות"],["Shabbat","שבת"],["Eruvin","עירובין"],["Pesachim","פסחים"],["Yoma","יומא"],
            ["Sukkah","סוכה"],["Beitzah","ביצה"],["Rosh Hashanah","ראש השנה"],["Taanit","תענית"],["Megillah","מגילה"],
            ["Moed Katan","מועד קטן"],["Chagigah","חגיגה"],["Yevamot","יבמות"],["Ketubot","כתובות"],["Nedarim","נדרים"],
            ["Nazir","נזיר"],["Sotah","סוטה"],["Gittin","גיטין"],["Kiddushin","קידושין"],["Bava Kamma","בבא קמא"],
            ["Bava Metzia","בבא מציעא"],["Bava Batra","בבא בתרא"],["Sanhedrin","סנהדרין"],["Makkot","מכות"],["Shevuot","שבועות"],
            ["Avodah Zarah","עבודה זרה"],["Horayot","הוריות"],["Zevachim","זבחים"],["Menachot","מנחות"],["Chullin","חולין"],
            ["Bekhorot","בכורות"],["Arakhin","ערכין"],["Temurah","תמורה"],["Keritot","כריתות"],["Meilah","מעילה"],
            ["Tamid","תמיד"],["Niddah","נדה"]
        ];
    }

    function normalizedNameKey(s){return String(s||"").toLowerCase().replace(/[_\-.]+/g," ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").replace(/^\s+|\s+$/g,"");}

    // v2.0.18: the <book tractate="…"> attribute of a complete volume file is
    // more reliable than the file name. Only the file head is read.
    function bookTractateAttribute(file){
        var head="",m;
        try{if(!file||!file.exists)return "";file.encoding="UTF-8";if(!file.open("r"))return "";head=file.read(4000);file.close();}catch(_){try{file.close();}catch(__){}return "";}
        m=/<book\b[^>]*\btractate=["']([^"']*)["']/i.exec(String(head||""));
        return m?trim(xmlUnescape(m[1])):"";
    }

    function inferTractateEnglish(sourceFile,existing){
        if(trim(existing))return trim(existing);
        var attr=bookTractateAttribute(sourceFile),attrKey,amap,ai;
        if(attr){
            attrKey=normalizedNameKey(attr);amap=bavliTractateMap();
            for(ai=0;ai<amap.length;ai++)if(normalizedNameKey(amap[ai][0])===attrKey)return amap[ai][0];
            return attr;
        }
        var hay="";
        try{hay=sourceFile.displayName+" "+sourceFile.parent.displayName;}catch(_){hay=String(sourceFile||"");}
        var key=normalizedNameKey(hay),map=bavliTractateMap(),i,k;
        for(i=0;i<map.length;i++){k=normalizedNameKey(map[i][0]);if((" "+key+" ").indexOf(" "+k+" ")>=0)return map[i][0];}
        var aliases=[["berachot","Berakhot"],["brachot","Berakhot"],["avoda zara","Avodah Zarah"],["bava kama","Bava Kamma"],["bava metsia","Bava Metzia"],["bava mezia","Bava Metzia"]];
        for(i=0;i<aliases.length;i++)if((" "+key+" ").indexOf(" "+aliases[i][0]+" ")>=0)return aliases[i][1];
        return "";
    }

    function tractateHebrewForEnglish(en){var map=bavliTractateMap(),key=normalizedNameKey(en),i;for(i=0;i<map.length;i++)if(normalizedNameKey(map[i][0])===key)return map[i][1];return "";}
    function completeHeaderTractateConfig(cfg,sourceFile){if(!cfg.tractateEn)cfg.tractateEn=inferTractateEnglish(sourceFile,"");if(!cfg.tractateHe)cfg.tractateHe=tractateHebrewForEnglish(cfg.tractateEn);if(!cfg.tractateEn)cfg.tractateEn="TRACTATE";if(!cfg.tractateHe)cfg.tractateHe=cfg.tractateEn;return cfg;}

    function hebrewNumberPlain(n){
        n=parseInt(n,10);if(isNaN(n)||n<1)return String(n||"");var out="";
        while(n>=400){out+="ת";n-=400;}
        if(n>=100){var h=Math.min(3,Math.floor(n/100));out+=["","ק","ר","ש"][h];n-=h*100;}
        if(n===15)return out+"טו";if(n===16)return out+"טז";
        var tens=["","י","כ","ל","מ","נ","ס","ע","פ","צ"],ones=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
        if(n>=10){out+=tens[Math.floor(n/10)];n=n%10;}if(n>0)out+=ones[n];return out;
    }

    function extractDafToken(seg){
        var candidates=[seg&&seg.daf,seg&&seg.sectionEn,seg&&seg.sectionHe],i,t,m;
        for(i=0;i<candidates.length;i++){
            t=trim(candidates[i]);if(!t)continue;
            m=/(?:Daf\s*)?([0-9]{1,3})\s*([ab])\b/i.exec(t);if(m)return {num:parseInt(m[1],10),side:m[2].toLowerCase(),raw:m[1]+m[2].toLowerCase()};
            m=/דף\s+([^\s]+)\s+(ע[״\"']?[אב])/i.exec(t);if(m)return {heDirect:"דף "+m[1]+" "+m[2],rawHe:t};
        }
        return null;
    }
    function dafEnglish(seg){var d=extractDafToken(seg);if(d&&d.num)return "Daf "+d.num+d.side;var t=trim(seg&&seg.sectionEn);return t||"Daf ?";}
    function dafHebrew(seg){var d=extractDafToken(seg);if(d&&d.heDirect)return d.heDirect;if(d&&d.num)return "דף "+hebrewNumberPlain(d.num)+" "+(d.side==="a"?"ע״א":"ע״ב");var t=trim(seg&&seg.sectionHe);if(/^דף\b/.test(t))return t;return "דף ?";}

    function applyHeaderTemplate(tpl,work,tractate,daf){var s=String(tpl||"");s=s.replace(/\{WORK\}/g,work||"").replace(/\{TRACTATE\}/g,tractate||"").replace(/\{DAF\}/g,daf||"");s=s.replace(/\s+·\s+·\s+/g," · ").replace(/^\s*·\s*|\s*·\s*$/g,"").replace(/\s{2,}/g," ");return trim(s);}

    function runningHeaderPagePlan(doc,p,cfg){
        recompose(doc);
        var chains=collectChains(doc);if(!chains.heFirst)throw new Error("Keine BYH-HE-Textrahmen gefunden. Die Kopfzeilen werden aus dem hebräischen Seitenfluss bestimmt.");
        var map=mapStorySegmentsToPages(chains.heFirst.parentStory,p.segments,false),plan=[],pn,i,s,m,page,isRight,text,lang;
        for(pn=1;pn<=doc.pages.length;pn++){
            page=doc.pages[pn-1];if(String(page.label||"")!=="BYH_BODY_PAGE"){plan.push({page:pn,skip:true,reason:"keine BYH_BODY_PAGE"});continue;}
            s=null;for(i=0;i<p.segments.length;i++){m=map[p.segments[i].id];if(m&&m.start>0&&m.end>0&&m.start<=pn&&m.end>=pn){s=p.segments[i];break;}}
            if(!s){plan.push({page:pn,skip:true,reason:"kein sichtbares BYH-Segment"});continue;}
            try{isRight=page.side===PageSideOptions.RIGHT_HAND;}catch(_){isRight=(pn%2===1);}
            if(isRight){lang="HE";text=applyHeaderTemplate(cfg.templateHe,cfg.workHe,cfg.tractateHe,dafHebrew(s));}
            else{lang="EN";text=applyHeaderTemplate(cfg.templateEn,cfg.workEn,cfg.tractateEn,dafEnglish(s));}
            plan.push({page:pn,skip:false,lang:lang,text:text,segment:s.id,dafEn:dafEnglish(s),dafHe:dafHebrew(s)});
        }
        return plan;
    }

    function runningHeaderFrameOnPage(page){var found=[],i,tf;for(i=0;i<page.textFrames.length;i++){tf=page.textFrames[i];if(tf.label===HEADER_FRAME_LABEL)found.push(tf);}return found;}
    function removeHeaderFramesOnPage(page){var a=runningHeaderFrameOnPage(page),i,c=0;for(i=a.length-1;i>=0;i--){try{a[i].remove();c++;}catch(_){}}return c;}

    function setHeaderFrameForPage(doc,page,pageNo,item,cfg){
        var frames=runningHeaderFrameOnPage(page),tf,i;if(frames.length){tf=frames[0];for(i=frames.length-1;i>=1;i--)try{frames[i].remove();}catch(_){}}else{tf=page.textFrames.add();tf.label=HEADER_FRAME_LABEL;}
        tf.geometricBounds=pageBounds([HEADER_TOP_MM,FRAME_LEFT_MM,HEADER_BOTTOM_MM,FRAME_RIGHT_MM],pageNo,page);setFrameInsets(tf,0);tf.contents=item.text;
        try{tf.fillColor=doc.swatches.item("None");tf.strokeColor=doc.swatches.item("None");}catch(_){ }try{tf.textFramePreferences.verticalJustification=VerticalJustification.CENTER_ALIGN;}catch(_){ }
        var t=tf.texts[0];t.fillColor=blackSwatch(doc);try{t.fillTint=cfg.tint;}catch(_){ }
        if(item.lang==="HE"){t.appliedFont=safeFont(HE_FONT,HE_FONT_STYLE);t.pointSize=cfg.heSize;t.justification=Justification.RIGHT_ALIGN;try{t.paragraphDirection=ParagraphDirectionOptions.RIGHT_TO_LEFT_DIRECTION;t.composer="Adobe World-Ready Paragraph Composer";}catch(_){ }}
        else{t.appliedFont=safeFont(EN_FONT,EN_FONT_STYLE);t.pointSize=cfg.enSize;t.justification=Justification.LEFT_ALIGN;try{t.tracking=cfg.tracking;t.paragraphDirection=ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;}catch(_){ }}
        return tf;
    }

    function pageListFromHeaderPlan(plan,skipOnly){var a=[],i;for(i=0;i<plan.length;i++)if(skipOnly?plan[i].skip:!plan[i].skip)a.push(plan[i].page);return a;}
    function headerPlanSummary(doc,sourceFile,cfg,plan){
        var out=[],active=pageListFromHeaderPlan(plan,false),skipped=pageListFromHeaderPlan(plan,true),changes=[],last="",i,it;
        out.push("KOPFZEILEN-ANALYSE");out.push("Dokument: "+doc.name);out.push("Quelle: "+sourceFile.fsName);out.push("Traktat: "+cfg.tractateEn+" · "+cfg.tractateHe);out.push("Kopfzeilen-Seiten: "+active.length+" · ausgelassen: "+skipped.length);if(skipped.length)out.push("Ohne Kopfzeile laut Plan: "+formatPageList(skipped));
        out.push("");out.push("DAF-WECHSEL IM AKTUELLEN SEITENFLUSS:");for(i=0;i<plan.length;i++){it=plan[i];if(it.skip)continue;if(it.dafEn!==last){changes.push("Seite "+it.page+": "+it.dafEn+" · "+it.dafHe+" · ab "+it.segment);last=it.dafEn;}}out.push(changes.length?changes.join("\r\n"):"Keine Daf-Zuordnung erkannt.");
        out.push("");out.push("Hinweis: Die Analyse basiert auf dem AKTUELL gesetzten hebräischen Textfluss. Nach weiteren Layoutänderungen erneut analysieren/aktualisieren.");return out.join("\r\n");
    }

    function analyzeRunningHeaders(doc,sourceFile,cfg){requireProductionFonts();var p=parseBilingualFile(readUTF8(sourceFile)),expected=doc.extractLabel(DOC_VOLUME_LABEL),actual=String(p.volume||1);if(expected&&expected!==actual)throw new Error("Aktiver Band "+expected+" passt nicht zur Kopfzeilenquelle Band "+actual+".");var plan=runningHeaderPagePlan(doc,p,cfg);return headerPlanSummary(doc,sourceFile,cfg,plan);}

    function activeSpreadPhysicalPages(doc){var out=[],seen={},page=null,spread=null,i,pn;try{page=app.activeWindow.activePage;spread=page.parent;}catch(_){page=null;spread=null;}if(spread&&spread.pages){for(i=0;i<spread.pages.length;i++){pn=spread.pages[i].documentOffset+1;if(!seen[pn]){seen[pn]=true;out.push(pn);}}}else if(page){pn=page.documentOffset+1;out.push(pn);}if(!out.length&&doc.pages.length)out.push(1);out.sort(function(a,b){return a-b;});return out;}

    function applyRunningHeaders(doc,sourceFile,cfg,currentSpreadOnly,makeBackup){
        requireProductionFonts();var p=parseBilingualFile(readUTF8(sourceFile)),expected=doc.extractLabel(DOC_VOLUME_LABEL),actual=String(p.volume||1);if(expected&&expected!==actual)throw new Error("Aktiver Band "+expected+" passt nicht zur Kopfzeilenquelle Band "+actual+".");
        var plan=runningHeaderPagePlan(doc,p,cfg),filter=null,pagesToDo=[],i,it,page,created=0,updated=0,removed=0,backup=null,existing;
        if(currentSpreadOnly){filter={};pagesToDo=activeSpreadPhysicalPages(doc);for(i=0;i<pagesToDo.length;i++)filter[pagesToDo[i]]=true;}if(makeBackup)backup=createInDesignBackup(doc,"running_headers");
        for(i=0;i<plan.length;i++){it=plan[i];if(filter&&!filter[it.page])continue;page=doc.pages[it.page-1];if(it.skip){removed+=removeHeaderFramesOnPage(page);continue;}existing=runningHeaderFrameOnPage(page).length>0;setHeaderFrameForPage(doc,page,it.page,it,cfg);if(existing)updated++;else created++;}
        doc.insertLabel(DOC_HEADER_TRACTATE_EN,cfg.tractateEn);doc.insertLabel(DOC_HEADER_TRACTATE_HE,cfg.tractateHe);doc.insertLabel(DOC_HEADER_TEMPLATE_EN,cfg.templateEn);doc.insertLabel(DOC_HEADER_TEMPLATE_HE,cfg.templateHe);doc.insertLabel(DOC_HEADER_LAST_RUN,timestamp());if(makeBackup)doc.save();
        var out=[];out.push(currentSpreadOnly?"KOPFZEILEN-TEST AKTUELLE DOPPELSEITE":"KOPFZEILEN ERFOLGREICH AKTUALISIERT");out.push("Dokument: "+doc.name);out.push("Traktat: "+cfg.tractateEn+" · "+cfg.tractateHe);out.push("Neu erstellt: "+created+" · aktualisiert: "+updated+" · entfernt/nicht vorgesehen: "+removed);if(currentSpreadOnly)out.push("Getestete Seiten: "+formatPageList(pagesToDo)+" · noch nicht automatisch gespeichert.");if(backup)out.push("INDD-Sicherung: "+backup.fsName);out.push("");out.push(headerPlanSummary(doc,sourceFile,cfg,plan));return out.join("\r\n");
    }

    function normalizeHeaderText(s){return trim(String(s||"").replace(/[\r\n]+/g," ").replace(/\s+/g," "));}
    function validateRunningHeaders(doc,sourceFile,cfg){
        requireProductionFonts();var p=parseBilingualFile(readUTF8(sourceFile)),plan=runningHeaderPagePlan(doc,p,cfg),missing=[],wrong=[],unexpected=[],ok=0,i,it,page,frames,actual;
        for(i=0;i<plan.length;i++){it=plan[i];page=doc.pages[it.page-1];frames=runningHeaderFrameOnPage(page);if(it.skip){if(frames.length)unexpected.push(it.page);continue;}if(!frames.length){missing.push(it.page);continue;}actual="";try{actual=normalizeHeaderText(frames[0].contents);}catch(_){actual="";}if(actual!==normalizeHeaderText(it.text)||frames.length>1)wrong.push(it.page);else ok++;}
        var out=[];out.push("KOPFZEILEN-PRÜFUNG");out.push("Dokument: "+doc.name);out.push("Korrekt: "+ok);out.push("Fehlend: "+missing.length+(missing.length?" · Seiten "+formatPageList(missing):""));out.push("Abweichend/doppelt: "+wrong.length+(wrong.length?" · Seiten "+formatPageList(wrong):""));out.push("Unerwartet auf ausgelassenen Seiten: "+unexpected.length+(unexpected.length?" · Seiten "+formatPageList(unexpected):""));out.push("Letzter produktiver Kopfzeilenlauf: "+(doc.extractLabel(DOC_HEADER_LAST_RUN)||"nicht gespeichert"));out.push("");out.push((!missing.length&&!wrong.length&&!unexpected.length)?"ERGEBNIS: Kopfzeilen stimmen mit dem aktuellen Seitenfluss überein.":"ERGEBNIS: Bitte 'Alle Kopfzeilen erstellen / aktualisieren' ausführen und danach erneut prüfen.");return out.join("\r\n");
    }

    function removeRunningHeaders(doc,makeBackup){var backup=null,count=0,i;if(makeBackup)backup=createInDesignBackup(doc,"remove_running_headers");for(i=0;i<doc.pages.length;i++)count+=removeHeaderFramesOnPage(doc.pages[i]);doc.insertLabel(DOC_HEADER_LAST_RUN,"");if(makeBackup)doc.save();return "KOPFZEILEN ENTFERNT\r\nDokument: "+doc.name+"\r\nEntfernte Kopfzeilenrahmen: "+count+"\r\nSeitenzahlen, Haarlinie und HE-/EN-Textrahmen wurden nicht verändert."+(backup?"\r\nINDD-Sicherung: "+backup.fsName:"");}

    function validateActiveVolume(doc){
        var chains=collectChains(doc),out=[],heCheck=inspectFrameSequence(chains.heFrames),enCheck=inspectFrameSequence(chains.enFrames);
        var sourcePath=doc.extractLabel(DOC_SOURCE_LABEL)||"",sourceFile=null,daf=null,p=null;
        out.push("Dokument: "+doc.name);out.push("Band: "+(doc.extractLabel(DOC_VOLUME_LABEL)||"nicht gekennzeichnet"));
        out.push("Seiten: "+doc.pages.length+" / "+MAX_PAGES+(doc.pages.length>MAX_PAGES?" · FEHLER":" · OK"));
        out.push("Hebräisch-Rahmen: "+chains.heFrames.length+" · Englisch-Rahmen: "+chains.enFrames.length);
        out.push("HE-Verkettung: "+(heCheck.breaks.length?"UNTERBROCHEN bei "+heCheck.breaks.join(", "):"OK"));
        out.push("EN-Verkettung: "+(enCheck.breaks.length?"UNTERBROCHEN bei "+enCheck.breaks.join(", "):"OK"));
        out.push("Hebräisch-Übersatz: "+(chains.heFirst&&storyOverflows(chains.heFirst)?"JA":"nein"));
        out.push("Englisch-Übersatz: "+(chains.enFirst&&storyOverflows(chains.enFirst)?"JA":"nein"));
        out.push("Quelle: "+(sourcePath||"nicht gespeichert"));
        if(chains.heFrames.length!==chains.enFrames.length)out.push("WARNUNG: Die Zahl der HE- und EN-Rahmen stimmt nicht überein.");
        if(sourcePath){
            try{
                sourceFile=new File(sourcePath);
                if(sourceFile.exists){
                    recompose(doc);p=parseBilingualFile(readUTF8(sourceFile));daf=dafHeadingAlignmentSummary(doc,p,0,p.segments.length);
                    out.push("Daf-Titel HE/EN: "+((!daf.mismatch&&!daf.missing)?"OK":"FEHLER")+" · unterschiedliche Seiten: "+daf.mismatch+" · fehlend: "+daf.missing);
                    if(daf.details.length)out.push("Daf-Details: "+daf.details.join(" | "));
                }else out.push("Daf-Titel HE/EN: nicht geprüft · Quelldatei nicht gefunden.");
            }catch(dafErr){out.push("Daf-Titel HE/EN: Prüfung fehlgeschlagen · "+errorText(dafErr));}
        }
        return out.join("\r");
    }

    function inspectFrameSequence(frames){
        var breaks=[],i,nx;
        for(i=1;i<frames.length;i++){
            nx=safeNextTextFrame(frames[i-1]);
            if(!sameObject(nx,frames[i]))breaks.push(safePageName(frames[i-1])+"→"+safePageName(frames[i]));
        }
        return {breaks:breaks};
    }

    // ---------------- UI helpers · workflow colours v1.0.15 ----------------

    function addWorkflowLegend(parent,items){
        var p=parent.add("panel",undefined,"Farblegende · gleicher Ablauf = gleiche Farbe");
        p.orientation="row";p.alignChildren=["left","center"];p.margins=7;p.spacing=16;
        var i,item,st;
        for(i=0;i<items.length;i++){
            item=items[i];st=p.add("statictext",undefined,"● "+item.label);
            styleWorkflowText(st,item.color,item.tip||"");
        }
        return p;
    }

    function addWorkflowTag(parent,label,color,tip){
        var st=parent.add("statictext",undefined,"● "+label);
        st.preferredSize.width=Math.max(70,String(label).length*8+24);
        styleWorkflowText(st,color,tip||"");
        return st;
    }

    function styleWorkflowText(control,color,tip){
        if(tip)control.helpTip=tip;
        try{
            var g=control.graphics;
            g.foregroundColor=g.newPen(g.PenType.SOLID_COLOR,color,1);
            try{g.font=ScriptUI.newFont(g.font.name,"BOLD",g.font.size);}catch(_font){}
        }catch(_){ }
        return control;
    }

    function styleWorkflowButton(btn,color,tip){
        btn.__bihWorkflowColor=color;
        if(tip)btn.helpTip=tip;
        // Direct foreground/background assignment helps on ScriptUI hosts that
        // honour native control colours. The custom onDraw below is the Windows
        // fallback and makes the workflow colour visible in InDesign 18.1.
        try{
            var gg=btn.graphics;
            gg.backgroundColor=gg.newBrush(gg.BrushType.SOLID_COLOR,color);
            gg.foregroundColor=gg.newPen(gg.PenType.SOLID_COLOR,UI_TEXT_LIGHT,1);
        }catch(_direct){}
        btn.onDraw=function(){
            try{
                var g=this.graphics;
                var w=(this.size&&this.size.width!==undefined)?this.size.width:this.size[0];
                var h=(this.size&&this.size.height!==undefined)?this.size.height:this.size[1];
                var c=this.enabled?this.__bihWorkflowColor:UI_DISABLED;
                var brush=g.newBrush(g.BrushType.SOLID_COLOR,c);
                var border=g.newPen(g.PenType.SOLID_COLOR,[0.12,0.12,0.12,1],1);
                var textPen=g.newPen(g.PenType.SOLID_COLOR,this.enabled?UI_TEXT_LIGHT:[0.72,0.72,0.72,1],1);
                g.rectPath(0,0,w,h);g.fillPath(brush);g.strokePath(border);
                var txt=String(this.text||"");
                var m=g.measureString(txt);
                var x=Math.max(4,(w-m[0])/2);
                var y=Math.max(2,(h-m[1])/2);
                g.drawString(txt,textPen,x,y);
            }catch(_draw){ }
        };
        return btn;
    }

    // ---------------- Generic helpers ----------------

    function ensurePara(doc,name){var s=doc.paragraphStyles.itemByName(name);if(!s.isValid)s=doc.paragraphStyles.add({name:name});return s;}
    function ensureChar(doc,name){var s=doc.characterStyles.itemByName(name);if(!s.isValid)s=doc.characterStyles.add({name:name});return s;}

    // v2.0.2: niemals mehr auf app.fonts[0] und damit auf eine fremde Schriftfamilie
    // zurückfallen. Zuerst exakten Schnitt suchen; falls der Schnitt anders heißt,
    // bleibt der Fallback innerhalb derselben Familie.
    function findFamilyFont(family,style){
        var f=null,i,nm,sty;
        try{f=app.fonts.itemByName(family+"\t"+style);if(f&&f.isValid)return f;}catch(_){ }
        try{f=app.fonts.itemByName(family);if(f&&f.isValid)return f;}catch(__){ }
        for(i=0;i<app.fonts.length;i++){
            try{
                f=app.fonts[i];nm=String(f.fontFamily||f.name||"");sty=String(f.fontStyleName||f.styleName||"");
                if(nm===family){
                    if(sty===style)return f;
                    if(!style||style==="Regular"||style==="Roman"||style==="Book")return f;
                }
            }catch(___){ }
        }
        return null;
    }
    function safeFont(family,style){
        var f=findFamilyFont(family,style);
        if(f&&f.isValid)return f;
        throw new Error("Schrift nicht verfügbar: "+family+(style?" "+style:"")+". Kein Fremdschrift-Fallback wird verwendet.");
    }
    function blackSwatch(doc){var s=doc.swatches.itemByName("Black");if(s&&s.isValid)return s;s=doc.swatches.itemByName("$ID/Black");if(s&&s.isValid)return s;return doc.swatches[doc.swatches.length-1];}
    function requireProductionFonts(){
        var h=findFamilyFont(HE_FONT,HE_FONT_STYLE),e=findFamilyFont(EN_FONT,EN_FONT_STYLE);
        if(!h||!h.isValid)throw new Error("Erforderliche hebräische Schrift fehlt: "+HE_FONT+". Bitte den in InDesign angezeigten Familiennamen prüfen.");
        if(!e||!e.isValid)throw new Error("Erforderliche englische Schrift fehlt: "+EN_FONT+". Bitte den in InDesign angezeigten Familiennamen prüfen.");
    }
    function setFrameInsets(tf,v){try{tf.textFramePreferences.insetSpacing=[v,v,v,v];}catch(_){}}
    function setPageMargins(page){
        // v2.0.0: asymmetric margins. The inner (gutter) margin of 19.1 mm is a
        // hard KDP requirement for volumes of 501-700 pages; a smaller value
        // gets the file rejected. Inner and outer swap on right-hand pages.
        try{
            var m=page.marginPreferences;
            m.top=mm(MARGIN_TOP_MM);m.bottom=mm(MARGIN_BOTTOM_MM);
            var left=MARGIN_OUTER_MM,right=MARGIN_INNER_MM;
            try{if(page.side===PageSideOptions.RIGHT_HAND){left=MARGIN_INNER_MM;right=MARGIN_OUTER_MM;}}catch(_){ }
            m.left=mm(left);m.right=mm(right);
        }catch(_){ }
    }
    function storyOverflows(first){
        if(!first||!first.isValid)return false;
        // Overset is a property of the terminal text container. Checking only
        // the first frame can miss overset at the end of a long threaded story.
        var last=actualLastTextFrame(first);
        try{if(last&&last.isValid&&last.overflows)return true;}catch(_){ }
        try{if(first.parentStory&&first.parentStory.isValid&&first.parentStory.overflows)return true;}catch(__){ }
        return false;
    }
    function frameHasText(tf){try{return tf.characters.length>0;}catch(_){return true;}}
    function recompose(doc){try{doc.recompose();}catch(_){try{app.activeDocument.recompose();}catch(__){}}}
    function mm(v){return String(Number(v))+" mm";}
    function mmBounds(a){return [mm(a[0]),mm(a[1]),mm(a[2]),mm(a[3])];}
    function pageBounds(a,pageNo,page){
        var isRight=false;
        try{isRight=!!(page&&page.isValid&&page.side===PageSideOptions.RIGHT_HAND);}catch(_){isRight=(pageNo%2===1);}
        // v2.0.4: Die rechte Seite entspricht bereits dem gewünschten Satzspiegel.
        // Auf der linken Seite verschieben wir den KOMPLETTEN horizontalen Aufbau
        // um 5 mm nach rechts, ohne Breite oder Höhe zu verändern. Dadurch wandern
        // Text-/Apparatrahmen, Kopflinie und linke Seitenzahl gemeinsam und bleiben
        // exakt zueinander ausgerichtet.
        if(isRight)return [mm(a[0]),mm(PAGE_W_MM-a[3]),mm(a[2]),mm(PAGE_W_MM-a[1])];
        return [mm(a[0]),mm(Number(a[1])+LEFT_PAGE_X_CORRECTION_MM),mm(a[2]),mm(Number(a[3])+LEFT_PAGE_X_CORRECTION_MM)];
    }
    function setStatus(field,text){try{field.text=text;field.window.update();}catch(_){}}
    function positiveInt(v,fallback){var n=parseInt(v,10);return isNaN(n)||n<1?fallback:n;}
    function pad2(n){n=String(n);return n.length<2?"0"+n:n;}
    function trim(s){return String(s||"").replace(/^\s+|\s+$/g,"");}
    function normalizeNewlines(s){return String(s||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");}
    function stripBom(s){return s.charCodeAt(0)===0xFEFF?s.substring(1):s;}
    function stripTags(s){return String(s||"").replace(/<[^>]+>/g,"");}
    // v2.0.13: "wortgleich" means the same contiguous sequence of words.
    // Punctuation at the edge of a lemma is allowed to differ from the headband:
    // the commentary lemma may end with a period while the quoted Talmud sentence
    // continues with a comma. Typography and capitalization are normalized,
    // but the complete ordered word sequence remains mandatory.
    function normalizeLemmaWords(s){
        return trim(trim(stripTags(String(s||"")))
            .toLowerCase()
            .replace(/[^a-z0-9]+/g," ")
            .replace(/\s+/g," "));
    }
    function bandContainsLemmaWords(bandEn,lemma){
        var bandWords=normalizeLemmaWords(bandEn);
        var lemmaWords=normalizeLemmaWords(lemma);
        if(!lemmaWords)return false;
        return (" "+bandWords+" ").indexOf(" "+lemmaWords+" ")>=0;
    }
    function hasLeadingEllipsis(s){return /^…/.test(trim(stripTags(String(s||""))));}
    function hasTrailingEllipsis(s){return /…$/.test(trim(stripTags(String(s||""))));}
    function validateEnglishLemmaForBand(fileName,id,he,en,bandEn){
        var heHas=/<lemma>[\s\S]*?<\/lemma>/i.test(String(he||""));
        var text=String(en||""),re=/<lemma>([\s\S]*?)<\/lemma>/ig,m,count=0,lemma="";
        while((m=re.exec(text))!==null){count++;if(count===1)lemma=trim(stripTags(m[1]));}
        if(heHas){
            if(count!==1)throw new Error(fileName+": <en> muss genau ein englisches <lemma> enthalten bei "+id+".");
            if(!/^\s*<lemma>[\s\S]*?<\/lemma>/i.test(text))throw new Error(fileName+": Das englische <lemma> muss am Anfang von <en> stehen bei "+id+".");
            if(!lemma)throw new Error(fileName+": Das englische <lemma> ist leer bei "+id+".");
            if(!bandContainsLemmaWords(bandEn,lemma))throw new Error(fileName+": Das englische <lemma> kommt nicht als wortgleiche Wortfolge in <band_en> vor bei "+id+". Satzzeichen am Lemmarand werden dabei ignoriert. Lemma: "+lemma);
        }else if(count){
            throw new Error(fileName+": <en> enthält ein <lemma>, obwohl im unveränderten hebräischen Segment keines vorhanden ist bei "+id+".");
        }
    }
    function visibleLength(s){return trim(stripTags(s)).length;}
    function normalizeForCompare(s){return trim(normalizeNewlines(String(s||""))).replace(/\s+/g," ");}
    function tsv(s){return String(s||"").replace(/[\t\r\n]+/g," ");}
    function timestamp(){var d=new Date();return d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate())+"-"+pad2(d.getHours())+pad2(d.getMinutes())+pad2(d.getSeconds());}
    function errorText(e){return e&&e.message?e.message:String(e);}

    function xmlEscape(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
    function xmlUnescape(s){return String(s||"").replace(/&quot;/g,'"').replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&amp;/g,"&");}
    function protectCdata(s){return "<![CDATA["+String(s||"").replace(/\]\]>/g,"]]]]><![CDATA[>")+"]]>";}
    function restoreCdata(s){s=trim(String(s||""));if(/^<!\[CDATA\[/.test(s)&&/\]\]>$/.test(s)){s=s.replace(/^<!\[CDATA\[/,"").replace(/\]\]>$/,"").replace(/\]\]\]\]><!\[CDATA\[>/g,"]]>");}return s;}

    function readUTF8(file){file.encoding="UTF-8";if(!file.open("r"))throw new Error("Datei kann nicht geöffnet werden: "+file.fsName);var s=file.read();file.close();return stripBom(s);}
    function writeUTF8(file,text){file.encoding="UTF-8";file.lineFeed="Windows";if(!file.open("w"))throw new Error("Datei kann nicht geschrieben werden: "+file.fsName);file.write("\uFEFF"+String(text||""));file.close();}
    function fileFromEdit(edit,label){var f=new File(edit.text);if(!edit.text||!f.exists)throw new Error(label+" nicht gefunden.");return f;}
    function folderFromEdit(edit,label){var f=new Folder(edit.text);if(!edit.text)throw new Error(label+" fehlt.");if(!f.exists&&!f.create())throw new Error(label+" konnte nicht erstellt werden.");return f;}
    function chooseTxtInto(edit,title){var f=File.openDialog(title,"Text:*.txt");if(f)edit.text=f.fsName;}
    function uniqueFile(file){
        if(!file.exists)return file;
        var name=file.displayName,match=/^(.*?)(\.[^.]+)?$/.exec(name),base=match?match[1]:name,ext=(match&&match[2])?match[2]:"",n=2,candidate;
        do{candidate=new File(file.parent.fsName+"/"+base+"_"+n+ext);n++;}while(candidate.exists);
        return candidate;
    }

})();
