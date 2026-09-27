#target "InDesign"
#targetengine "BenIshChaiBilingualBookManager_v117"

/*
    Ben Ish Chai Bilingual Book Manager v1.0.17
    Target: Adobe InDesign 18.1 / ExtendScript (ES3)

    Purpose
    -------
    Dedicated Hebrew/English workflow for the Ben Ish Chai edition.

    Fixed production defaults calibrated from Halakhah_Ben_Ish_Hai_I.idml:
      - exact page size 148 × 210 mm, facing pages
      - upper Hebrew frame, lower English frame
      - Keter YG Medium 10 pt (Hebrew)
      - Cambria Regular 9 pt (English)
      - hard maximum: 600 physical pages per volume
      - planning target: 540 pages, including 12 reserved pages
      - calibrated capacities: 1050 Hebrew chars / page,
        2000 English chars / page, English expansion factor 1.95

    Project workflow
    ----------------
      1. Select the complete Hebrew TXT once.
      2. Create volume files. The script assigns stable segment IDs and
         generates Band_XX_BILINGUAL.txt files containing <he> and <en>.
      3. Export translation batches from a volume file.
      4. Fill the empty <en_title> and <en> fields (outside this script).
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
      - keeps the proven v1.0.12 BIH-boundary logic but adds a default Fast Mode
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
      - then re-locates, analyses and balances every batch in ascending BIH-ID order
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
*/

(function () {
    var APP_NAME = "Ben Ish Chai · Zweisprachiger Buchmanager";
    var VERSION = "1.0.17";

    // ---------------- UI workflow colours (v1.0.17) ----------------
    // Colour is never the only indicator: every coloured control also carries a
    // textual workflow tag and a hover tooltip. This keeps the UI understandable
    // even when colours are hard to distinguish.
    var UI_BLUE   = [0.18, 0.43, 0.73, 1]; // Projekt / Band / InDesign-Basis
    var UI_GREEN  = [0.16, 0.56, 0.31, 1]; // Einzelbatch von Export bis Layout
    var UI_MAGENTA = [0.82, 0.20, 0.52, 1]; // Bulk von Export bis Layout · klar getrennt von Blau
    var UI_ORANGE = [0.86, 0.49, 0.10, 1]; // Sicherheit / Rückgängig / Reparatur
    var UI_TEXT_LIGHT = [1, 1, 1, 1];
    var UI_DISABLED = [0.36, 0.36, 0.36, 1];

    // ---------------- Fixed production settings ----------------
    var MAX_PAGES = 600;
    var TARGET_PAGES = 540;
    var RESERVED_PAGES = 12;
    var BODY_TARGET = TARGET_PAGES - RESERVED_PAGES;
    var HE_CHARS_PER_PAGE = 1050;
    var EN_CHARS_PER_PAGE = 2000;
    var EN_EXPANSION = 1.95;
    var PAGE_BATCH = 12;
    var MANUAL_PAGE_DEFAULT = 2;

    // Controlled batch layout balancing. The divider may move only inside
    // these safety limits; the outer frame edges remain unchanged.
    var LAYOUT_GAP_MM = 3.0;
    var LAYOUT_MIN_HE_HEIGHT_MM = 55;
    var LAYOUT_MIN_EN_HEIGHT_MM = 55;
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
    var LAYOUT_NOMINAL_SPLIT_MM = 103.24;

    // v1.0.13 Fast Mode.  Accuracy is still judged with the same BIH-ID /
    // rendered-line anchor as v1.0.12; only the number and scope of recomposes
    // is reduced.  The precision solver remains available from the UI.
    var LAYOUT_FAST_BINARY_ITERATIONS = 8;
    var LAYOUT_FAST_BRACKET_MM = 0.60;
    var LAYOUT_FAST_LOCAL_MM = 0.50;

    var PAGE_W_MM = 148;
    var PAGE_H_MM = 210;
    var MARGIN_MM = 12.7;
    var HE_BOUNDS_MM = [16.82, 15.90, 103.24, 128.57];
    var EN_BOUNDS_MM = [106.24, 15.90, 189.89, 128.57];
    var RULE_Y_MM = 16.10;
    var PAGE_NO_TOP_MM = 5.20;

    var HE_FONT = "Keter YG";
    var HE_FONT_STYLE = "Medium";
    var HE_SIZE = 10;
    var HE_LEADING = 12;
    var EN_FONT = "Cambria";
    var EN_FONT_STYLE = "Regular";
    var EN_SIZE = 9;
    var EN_LEADING = 10.8;

    var STYLE_HE = "BIH · Hebräisch";
    var STYLE_EN = "BIH · English";
    var STYLE_HE_HEAD = "BIH · Abschnitt · Hebräisch";
    var STYLE_EN_HEAD = "BIH · Section · English";
    var CHAR_BOLD = "BIH · Fett";
    var CHAR_ITALIC = "BIH · Kursiv";
    var CHAR_HE_IN_EN = "BIH · Hebräisch in Englisch";
    var CHAR_SMALL = "BIH · Klein";
    var CHAR_SUP = "BIH · Hochgestellt";

    var FRAME_HE_LABEL = "BIH_HE_FRAME";
    var FRAME_EN_LABEL = "BIH_EN_FRAME";
    var DOC_VOLUME_LABEL = "BIH_VOLUME_NUMBER";
    var DOC_SOURCE_LABEL = "BIH_BILINGUAL_SOURCE";
    var DOC_LAYOUT_SNAPSHOT_LABEL = "BIH_LAYOUT_LAST_SNAPSHOT";
    var DOC_LAYOUT_BATCH_LABEL = "BIH_LAYOUT_LAST_BATCH";
    var DOC_LAYOUT_LOCKS_LABEL = "BIH_LAYOUT_LOCKED_PAGES";

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
            var old = $.global.__BIH_BILINGUAL_BOOK_MANAGER_V117__;
            if (old && old.visible) { old.active = true; return; }
        } catch (_) {}

        var w = new Window("palette", APP_NAME + " v" + VERSION, undefined, {resizeable:true});
        $.global.__BIH_BILINGUAL_BOOK_MANAGER_V117__ = w;
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 12;
        w.spacing = 8;
        w.minimumSize = [980, 620];
        w.preferredSize = [1120, 820];

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
            {label:"GRÜN · Einzelbatch", color:UI_GREEN, tip:"Einzelablauf: einen Batch exportieren, übersetzen lassen und einzeln nach BIH-ID zurückführen."},
            {label:"MAGENTA · Bulk", color:UI_MAGENTA, tip:"Bulk-Ablauf: mehrere getrennte Batches exportieren, gemeinsam vorprüfen und in einem Master-Schreibvorgang zurückführen."},
            {label:"BLAU · Band-Master", color:UI_BLUE, tip:"Die ausgewählte BILINGUAL.txt ist die maßgebliche Banddatei für beide Abläufe."}
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

        var transStatus = translationTab.add("edittext", undefined,
            "Die Banddatei bleibt die maßgebliche Datei. Ein Batch enthält dieselben stabilen IDs und wird ausschließlich über diese IDs zurückgeführt.",
            {multiline:true, readonly:true, scrolling:true});
        transStatus.preferredSize = [920, 260];

        var indesignTab = tabs.add("tab", undefined, "3 · InDesign-Band");
        indesignTab.orientation = "column";
        indesignTab.alignChildren = "fill";
        indesignTab.margins = 12;
        indesignTab.spacing = 10;

        addWorkflowLegend(indesignTab, [
            {label:"BLAU · Band / Textfluss", color:UI_BLUE, tip:"Grundfunktionen des aktiven InDesign-Bandes: erstellen, HE/EN aktualisieren, prüfen und Textfluss verwalten."},
            {label:"GRÜN · Einzelbatch-Layout", color:UI_GREEN, tip:"Ein fertiger Batch wird analysiert und dessen HE/EN-Rahmen werden kontrolliert angeglichen."},
            {label:"MAGENTA · Bulk-Layout", color:UI_MAGENTA, tip:"Eine Bulk-Gruppe wird geladen; Englisch wird genau einmal aktualisiert, danach werden alle Batches in BIH-ID-Reihenfolge angeglichen."},
            {label:"ORANGE · Sicherheit / Reparatur", color:UI_ORANGE, tip:"Rückgängig, Snapshot-Wiederherstellung und Standardtrennung. Diese Funktionen verändern oder restaurieren Layoutzustände."}
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
        layoutFastCheck.helpTip = "Verwendet dieselbe BIH-ID-Logik wie v1.0.12, reduziert aber vollständige Neukompositionen drastisch. Deaktivieren = Präzisionsmodus v1.0.12.";
        layoutSpeedRow.add("statictext", undefined, "Aus = Präzisionsmodus v1.0.12 · langsamer, als Kontroll-/Fallbackmodus");
        var layoutRepairRow = layoutPanel.add("group");
        addWorkflowTag(layoutRepairRow, "REPARATUR", UI_ORANGE, "Orange Reparaturfunktion: setzt nur die Batch-Seiten auf die Produktions-Standardtrennung zurück.");
        var layoutResetBtn = layoutRepairRow.add("button", undefined, "Batch-Seiten auf Standardtrennung zurücksetzen");
        layoutRepairRow.add("statictext", undefined, "Nur für Reparatur älterer Fehlversuche; geschützte Seiten bleiben unverändert.");

        var idInfo = indesignTab.add("statictext", undefined,
            "Layout fest: 148 × 210 mm · oben Hebräisch Keter YG 10/12 pt · unten Englisch Cambria 9/10,8 pt · unabhängige verkettete Textflüsse · maximal 600 Seiten.",
            {multiline:true});
        idInfo.preferredSize.width = 900;
        var idStatus = indesignTab.add("edittext", undefined, "Bereit.", {multiline:true, readonly:true, scrolling:true});
        idStatus.preferredSize = [920, 190];

        var helpTab = tabs.add("tab", undefined, "4 · Arbeitsablauf");
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
        styleWorkflowButton(queueStatusBtn, UI_MAGENTA, "BULK/QUEUE: Zeigt nur den aktuellen Queue-Status, reservierte Bereiche, MERGED/MISSING und die nächste exportierbare BIH-ID. Es wird nichts verändert.");
        styleWorkflowButton(batchBtn, UI_GREEN, "EINZEL: Eine fertige _EN_FERTIG.txt für die einzelne Rückführung auswählen.");
        styleWorkflowButton(mergeBtn, UI_GREEN, "EINZEL: Prüft den gewählten fertigen Batch und führt ihn nach stabilen BIH-IDs in den Band-Master zurück. Vorher wird eine Master-Sicherung angelegt.");
        styleWorkflowButton(bulkMergeSelectBtn, UI_MAGENTA, "BULK: Mehrere fertige _EN_FERTIG.txt gemeinsam auswählen. Zunächst wird nur die Auswahl vorbereitet.");
        styleWorkflowButton(bulkMergeBtn, UI_MAGENTA, "BULK: Prüft ALLE ausgewählten Dateien vollständig, erstellt danach genau eine Master-Sicherung und schreibt alle gültigen Übersetzungen in einem einzigen Master-Schreibvorgang.");

        styleWorkflowButton(idSourceBtn, UI_BLUE, "Die BILINGUAL.txt auswählen, die zum aktuell geöffneten InDesign-Band gehört.");
        styleWorkflowButton(buildDocBtn, UI_BLUE, "Erzeugt einen neuen InDesign-Band aus der ausgewählten BILINGUAL.txt mit HE-/EN-Rahmen, Verkettung und Produktionsformaten.");
        styleWorkflowButton(updateHeBtn, UI_BLUE, "Aktualisiert ausschließlich den vollständigen hebräischen Textfluss aus dem Master. Bestehende Rahmengeometrie und Englisch bleiben erhalten; vorher entsteht eine INDD-Sicherung.");
        styleWorkflowButton(updateEnBtn, UI_BLUE, "Aktualisiert den vollständigen englischen Textfluss EINMAL aus dem aktuellen Band-Master. Für einen Bulk-Lauf normalerweise nicht separat nötig, da der Bulk-Button dies selbst einmal ausführt.");
        styleWorkflowButton(validateBtn, UI_BLUE, "Prüft Seitenzahl, HE/EN-Rahmen, Verkettungen, Übersatz, Bandnummer und Quelle. Es wird nichts verändert.");
        styleWorkflowButton(addPagesBtn, UI_BLUE, "Fügt die angegebene Zahl vollständig eingerichteter zweisprachiger Seiten hinzu und verkettet HE und EN weiter.");
        styleWorkflowButton(autoFlowBtn, UI_BLUE, "Repariert unterbrochene HE/EN-Verkettungen und ergänzt bei echtem Übersatz automatisch Seiten bis zur 600-Seiten-Sperre.");

        styleWorkflowButton(layoutBatchBtn, UI_GREEN, "EINZEL-LAYOUT: Den fertigen _EN_FERTIG-Batch wählen, dessen BIH-ID-Bereich analysiert oder angeglichen werden soll.");
        styleWorkflowButton(layoutAnalyzeBtn, UI_GREEN, "EINZEL-LAYOUT: Ermittelt betroffene Seiten und HE/EN-Abweichungen. Diese Analyse verändert keine Rahmen.");
        styleWorkflowButton(layoutApplyBtn, UI_GREEN, "EINZEL-LAYOUT: Gleicht nur die Rahmen des gewählten Batches automatisch an. Der englische Textfluss muss vorher aktuell sein.");
        styleWorkflowButton(layoutUpdateApplyBtn, UI_GREEN, "EINZEL-LAYOUT: Aktualisiert zuerst den gesamten englischen Textfluss und gleicht danach genau den gewählten Batch an.");

        styleWorkflowButton(layoutBulkLoadBtn, UI_MAGENTA, "BULK-LAYOUT: Das zugehörige Bulk_Set-Manifest laden. Queue und MERGED-Status aller enthaltenen Batches werden geprüft.");
        styleWorkflowButton(layoutBulkRunBtn, UI_MAGENTA, "BULK-LAYOUT: Aktualisiert Englisch GENAU EINMAL und verarbeitet danach alle Batches in aufsteigender BIH-ID-Reihenfolge. Entsteht nach einem Layoutschritt HE/EN-Übersatz, werden zuerst automatisch vollständige zweisprachige Seiten ergänzt. Abbruch nur, wenn der Übersatz nicht lösbar ist oder die 600-Seiten-Grenze erreicht wird.");

        styleWorkflowButton(layoutUndoBtn, UI_ORANGE, "SICHERHEIT: Stellt den Zustand vor dem letzten automatischen Einzelbatch-Layout aus dessen gespeichertem Snapshot wieder her.");
        styleWorkflowButton(layoutRestoreBtn, UI_ORANGE, "SICHERHEIT: Einen beliebigen früher gespeicherten BIH-Layout-Snapshot auswählen und exakt wiederherstellen.");
        styleWorkflowButton(layoutResetBtn, UI_ORANGE, "REPARATUR: Setzt die betroffenen Batch-Seiten auf die Produktions-Standardtrennung 103,24/106,24 mm zurück. Geschützte Seiten bleiben unverändert.");

        // Hover help for important fields / modes.
        bilingualEdit.helpTip = "Band-Master. Alle Exporte und Rückführungen beziehen sich auf diese Datei.";
        quotaSegments.helpTip = "Maximale Segmentanzahl PRO erzeugtem Translation_Batch. Kein Segment wird geteilt.";
        quotaChars.helpTip = "Maximale hebräische Zeichen PRO Translation_Batch. Die Segmentgrenze hat Vorrang; ein Segment wird nicht geteilt.";
        bulkCountEdit.helpTip = "Wie viele getrennte Batch-TXT-Dateien der Bulk-Export in diesem Lauf höchstens erzeugen soll.";
        bulkMergeInfo.helpTip = "Zeigt die Zahl der aktuell für den gemeinsamen Bulk-Merge ausgewählten _EN_FERTIG-Dateien.";
        idSourceEdit.helpTip = "Band-Master für den aktiven InDesign-Band. Bandnummer muss zum geöffneten Dokument passen.";
        addPagesEdit.helpTip = "Anzahl vollständig eingerichteter HE/EN-Seiten, die manuell an den aktiven Band angefügt werden sollen.";
        layoutBatchEdit.helpTip = "EINZEL: fertiger Batch, dessen BIH-IDs für Analyse und Rahmenabgleich verwendet werden.";
        layoutBulkEdit.helpTip = "BULK: geladenes Bulk_Set-Manifest. Der Bulk-Lauf verarbeitet nur zugehörige, bereits MERGED gesetzte Batches.";
        layoutFastCheck.helpTip = "Aktiviert den schnellen, bewährten v1.0.13-Solver. Ausschalten nur zur Kontrolle/Fallback auf den langsameren Präzisionsmodus.";
        layoutBulkProgress.helpTip = "Live-Fortschritt des aktuellen Bulk-Layoutlaufs.";

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
                    var first = new File(state.outputFolder.fsName + "/Ben_Ish_Chai_Band_01_BILINGUAL.txt");
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
                var ok = confirm(bulkLayoutConfirmText(bulkLayoutGroup, layoutLocksEdit.text, layoutFastCheck.value));
                if (!ok) { idStatus.text = "Bulk-Layoutlauf abgebrochen. Es wurde nichts verändert."; layoutBulkProgress.text = "Abgebrochen"; return; }
                idStatus.text = runBulkLayoutGroup(app.activeDocument, src, bulkLayoutGroup, layoutLocksEdit.text, idStatus, layoutBulkProgress, layoutFastCheck.value);
            } catch (e) {
                layoutBulkProgress.text = "Fehler";
                alert("Bulk-Layoutlauf fehlgeschlagen:\n\n" + errorText(e), APP_NAME);
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
                    "Aktuelle ID-Abweichung: "+preview.score+"\n\n"+
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
                var f=File.openDialog("BIH-Layout-Snapshot wählen", "TSV:*.tsv");
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
                if(!confirm("Die Batch-Seiten "+formatPageList(preview.pages)+" auf die Produktions-Standardtrennung 103,24 / 106,24 mm zurücksetzen?\n\n"+
                    "Geschützte Seiten bleiben unverändert. Vorher werden INDD-Sicherung und Snapshot angelegt.\n\n"+
                    "Diese Funktion ist vor allem dafür gedacht, falsche Rahmenänderungen aus v1.0.9–v1.0.11 sauber zu neutralisieren.")){
                    idStatus.text="Standard-Rücksetzung abgebrochen.";return;
                }
                idStatus.text=resetBatchPagesToStandard(app.activeDocument,src,batch,layoutLocksEdit.text,idStatus);
            } catch (e) { alert("Standard-Rücksetzung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };

        w.onClose = function () { try { $.global.__BIH_BILINGUAL_BOOK_MANAGER_V117__ = null; } catch (_) {} };
        w.center();
        w.show();
    }

    function helpText() {
        return "BEN ISH CHAI · FESTER ARBEITSABLAUF\r\r" +
            "FARBLOGIK DER OBERFLÄCHE\r" +
            "BLAU = Projekt, Band und InDesign-Grundfunktionen.\r" +
            "GRÜN = kompletter Einzelbatch-Ablauf von Export über Merge bis Layout.\r" +
            "MAGENTA = kompletter Bulk-Ablauf von Export über Bulk-Merge bis Bulk-Layout.\r" +
            "ORANGE = Sicherheit, Rückgängig und Reparatur.\r" +
            "Wenn der Mauszeiger über einem Button oder wichtigen Feld steht, erscheint eine kurze Funktionsbeschreibung.\r\r" +
            "1. Im ersten Reiter die vollständige hebräische TXT und einen Projektordner wählen.\r" +
            "2. Analysieren. Das Skript nummeriert Absätze stabil, plant so viele Bände wie nötig und hält 600 Seiten als absolute Grenze ein.\r" +
            "3. Banddateien erzeugen. Jede Banddatei enthält <segment>-Blöcke mit unverändertem <he>-Text und zunächst leerem <en>-Feld.\r" +
            "4. Im zweiten Reiter Einzelbatches oder mehrere getrennte Translation-Batches als Bulk-Gruppe exportieren. Der Bulk-Export liest den Master nur einmal, führt einen internen Cursor und reserviert exportierte IDs in einer BatchQueue.tsv, damit sie bis zur Rückführung nicht doppelt exportiert werden. Zu jeder Bulk-Gruppe entsteht zusätzlich ein Bulk_Set-Manifest.\r" +
            "5. Im übersetzten Batch ausschließlich leere <en_title>- und <en>-Felder füllen. IDs, <he_title>, <he> und Tags unverändert lassen.\r" +
            "6. Rückführung: Ein Einzelbatch kann wie bisher separat zusammengeführt werden. Für mehrere _EN_FERTIG-Dateien steht der gemeinsame Bulk-Merge zur Verfügung. Dabei werden zuerst ausnahmslos alle ausgewählten Dateien geprüft; bei irgendeinem Fehler bleibt der Master unverändert. Erst nach vollständig erfolgreicher Vorprüfung wird genau eine Master-Sicherung erzeugt, alle geprüften EN-Texte werden im Speicher nach BIH-ID eingesetzt und der Band-Master wird genau einmal geschrieben. Danach werden die zugehörigen Queue-Einträge gemeinsam auf MERGED gesetzt.\r" +
            "7. Im dritten Reiter einen neuen InDesign-Band erstellen oder die hebräische beziehungsweise englische Hälfte eines offenen Bandes aktualisieren.\r" +
            "   Vor einer hebräischen Aktualisierung legt das Skript automatisch eine INDD-Sicherungskopie an; vorhandene Seiten und Rahmen bleiben erhalten.\r" +
            "8. Nach einem zurückgeführten Einzelbatch kann im Bereich Batch-Layout derselbe _EN_FERTIG-Batch gewählt werden. 'Batch analysieren' verändert nichts; 'Automatisch angleichen' arbeitet ab v1.0.12 an den Seiten-Grenzen mit einem deterministischen Solver. Primär wird dieselbe BIH-ID am unteren HE-/EN-Rahmenrand angestrebt, sekundär der normalisierte Fortschritt über die tatsächlich gesetzten Zeilen des Segments. Gleich gute Lösungen werden möglichst nahe an der Produktions-Standardtrennung 103,24/106,24 mm gehalten. Geschützte Seiten bleiben unverändert.\r" +
            "9. Für eine bereits gemeinsam zurückgeführte Bulk-Gruppe im InDesign-Reiter das zugehörige Bulk_Set-Manifest laden. Der Bulk-Lauf prüft Manifest und Queue, aktualisiert den vollständigen englischen Textfluss genau EINMAL und verarbeitet danach alle zugehörigen _EN_FERTIG-Batches strikt in aufsteigender BIH-ID-Reihenfolge. Vor jedem Batch werden dessen Seiten nach dem aktuellen Textfluss neu lokalisiert und analysiert. Während des Laufs wird der Fortschritt angezeigt. Entsteht durch eine Layoutänderung HE- oder EN-Übersatz, ergänzt der Bulk-Modus zunächst automatisch vollständige zweisprachige Seiten mit verketteten HE-/EN-Rahmen und komponiert neu. Erst wenn der Übersatz damit nicht lösbar ist oder die harte 600-Seiten-Grenze erreicht wird, wird die gerade getestete Batch-Geometrie zurückgesetzt und der Bulk-Lauf gestoppt. Nach erfolgreich behobenem Übersatz wird der nächste Batch auf dem aktuellen Seitenstand neu lokalisiert. Für den gesamten Bulk-Lauf entsteht eine gemeinsame INDD-Sicherung, pro Batch weiterhin ein Layout-Snapshot sowie abschließend ein dauerhaftes Bulk-Layout-Laufprotokoll.\r\r" +
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
        return "BIH-" + s;
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
            f = new File(folder.fsName + "/Ben_Ish_Chai_Band_" + pad2(plan[i].number) + "_BILINGUAL.txt");
            if (f.exists) throw new Error("Abbruch ohne Überschreiben: Diese Banddatei existiert bereits:\n" + f.fsName + "\nBitte einen neuen Projektordner wählen.");
        }
        for (i = 0; i < plan.length; i++) {
            v = plan[i];
            text = serializeVolume(v);
            f = new File(folder.fsName + "/Ben_Ish_Chai_Band_" + pad2(v.number) + "_BILINGUAL.txt");
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
        out.push("<book project=\"Ben Ish Chai Halakha\" volume=\"" + pad2(v.number) + "\" max_pages=\"" + MAX_PAGES + "\">");
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

        var events = [], sections = [], segments = [], secRe = /<section>\s*<he_title>([\s\S]*?)<\/he_title>\s*<en_title>([\s\S]*?)<\/en_title>\s*<\/section>/ig;
        var segRe = /<segment\b[^>]*\bid=["']([^"']+)["'][^>]*\bn=["']([0-9]+)["'][^>]*>\s*<he>([\s\S]*?)<\/he>\s*<en>([\s\S]*?)<\/en>\s*<\/segment>/ig;
        var sm, gm;
        while ((sm = secRe.exec(raw)) !== null) {
            events.push({index:sm.index, type:"section", he:restoreCdata(xmlUnescape(sm[1])), en:restoreCdata(xmlUnescape(sm[2]))});
        }
        while ((gm = segRe.exec(raw)) !== null) {
            events.push({index:gm.index, type:"segment", id:gm[1], number:parseInt(gm[2],10), he:restoreCdata(gm[3]), en:restoreCdata(gm[4])});
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
        return {volume:volume,events:events,sections:sections,segments:segments,raw:raw};
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
        out.push("<translation_batch project=\"Ben Ish Chai Halakha\" volume=\""+pad2(p.volume||1)+"\">");
        out.push("<!-- Nur leere <en_title>- und <en>-Felder füllen. IDs, n, <he_title>, <he> und alle Tags unverändert lassen. -->");
        out.push("<!-- VERBINDLICHE UEBERSETZUNGSANWEISUNG: Ben_Ish_Chai_VERBINDLICHE_Uebersetzungsanweisung_EN.txt · Fassung 1.2 -->");
        out.push("<!-- Englische Parashah-Ueberschrift: uebliche englische Transliteration in <en_title>; keine Uebersetzung und keine Format-Tags. InDesign setzt 15 pt Bold. -->");
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
            out.push("");out.push("<segment id=\""+s.id+"\" n=\""+s.number+"\">");out.push("<he>"+protectCdata(s.he)+"</he>");out.push("<en></en>");out.push("</segment>");
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
        out.push("BIH_BATCH_QUEUE\t1");out.push("master\t"+tsv(masterFile.fsName));out.push("volume\t"+pad2(p.volume||1));out.push("updated\t"+timestamp());out.push("cursor_id\t"+tsv(q.cursorId||""));out.push("last_manifest\t"+tsv(q.lastManifest||""));out.push("");
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
        out.push("BIH_BULK_MANIFEST\t1");out.push("bulk_id\t"+bulkId);out.push("master\t"+tsv(masterFile.fsName));out.push("volume\t"+pad2(p.volume||1));out.push("created\t"+timestamp());out.push("requested_batches\t"+requested);out.push("created_batches\t"+rows.length);out.push("max_segments\t"+maxSegments);out.push("max_he_chars\t"+maxChars);out.push("cursor_start_id\t"+cursorStart);out.push("cursor_end_id\t"+cursorEnd);out.push("queue_file\t"+tsv(batchQueueFile(masterFile).fsName));out.push("");
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
        out.push("");out.push("Beim Klick auf 'Alle gemeinsam zusammenführen' wird zuerst jede Datei vollständig gegen den unveränderten Master geprüft. Vorher wird nichts geschrieben.");
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
                if(seenIds[s.id])throw new Error(file.displayName+": BIH-ID "+s.id+" kommt bereits in einer anderen ausgewählten Datei vor (Überlappung/Doppelwahl).");
                if(masterIndex[s.id]<=prevIdx)throw new Error(file.displayName+": Segmentreihenfolge ist nicht aufsteigend bei "+s.id+".");
                prevIdx=masterIndex[s.id];seenIds[s.id]=file.displayName;
                if(target.number!==s.number)throw new Error(file.displayName+": Attribut n wurde verändert bei "+s.id+". Master n="+target.number+", Batch n="+s.number+".");
                if(batch.sections.length&&normalizeForCompare(target.sectionHe)!==normalizeForCompare(s.sectionHe))throw new Error(file.displayName+": Hebräische Abschnittsüberschrift wurde verändert oder verschoben bei "+s.id+".");
                if(normalizeForCompare(target.he)!==normalizeForCompare(s.he))throw new Error(file.displayName+": Hebräischer Text wurde verändert bei "+s.id+".");
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
            newTitles:titleNew,identicalTitles:titleIdentical,firstId:infos[0].firstId,lastId:infos[infos.length-1].lastId,bulkIds:bulkIds};
    }

    function bulkMergeConfirmText(pf){
        var out=[];out.push("BULK-MERGE · VORPRÜFUNG ERFOLGREICH");out.push("");
        out.push("Dateien: "+pf.fileCount);out.push("BIH-Bereich: "+pf.firstId+" bis "+pf.lastId);out.push("Segmente insgesamt: "+pf.totalSegments);
        out.push("Neu einzusetzen: "+pf.newSegments+" · bereits identisch im Master: "+pf.identicalSegments);
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
        if(pf.newSegments===0&&pf.newTitles===0){
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
                s=pf.infos[i].batch.segments[j];target=pf.masterMap[s.id];if(!trim(stripTags(target.en)))target.en=s.en;
            }
        }

        try{writeUTF8(masterFile,reserializeParsedBook(master));}catch(we){throw new Error("Die Master-Sicherung wurde erstellt, aber der gemeinsame Master-Schreibvorgang ist fehlgeschlagen. Sicherung: "+backup.fsName+"\n\n"+errorText(we));}
        var queueNote="";
        try{queueResult=markQueueMergedBulk(masterFile,master,pf.infos);queueNote="Queue aktualisiert: "+queueResult.updated+" bestehende Einträge, "+queueResult.added+" neue/Legacy-Einträge.\r\n"+queueResult.summary;}
        catch(qe){queueNote="WARNUNG: Der Master wurde erfolgreich geschrieben, aber der Queue-Status konnte nicht aktualisiert werden: "+errorText(qe);}

        var out=[];out.push("BULK-MERGE ERFOLGREICH");out.push("Dateien vollständig vorgeprüft: "+pf.fileCount);out.push("BIH-Bereich: "+pf.firstId+" bis "+pf.lastId);
        out.push("Segmente geprüft: "+pf.totalSegments);out.push("Neu zusammengeführt: "+pf.newSegments+" · bereits identisch: "+pf.identicalSegments);
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
        for(i=0;i<batch.segments.length;i++){
            s=batch.segments[i];
            if(!map[s.id])throw new Error("Batch-ID ist in der Banddatei nicht vorhanden: "+s.id);
            if(batch.sections.length && normalizeForCompare(map[s.id].sectionHe)!==normalizeForCompare(s.sectionHe))throw new Error("Die hebräische Abschnittsüberschrift wurde im Batch verändert oder verschoben: "+s.id);
            if(normalizeForCompare(map[s.id].he)!==normalizeForCompare(s.he))throw new Error("Der hebräische Text wurde im Batch verändert: "+s.id);
            if(!trim(stripTags(s.en))){unchanged++;continue;}
            map[s.id].en=s.en;filled++;
        }
        if(!filled && !titleFilled)throw new Error("Der Batch enthält keine gefüllten <en_title>- oder <en>-Felder.");
        var backup=new File(masterFile.parent.fsName+"/"+masterFile.displayName.replace(/\.txt$/i,"")+"_backup_"+timestamp()+".txt");
        writeUTF8(backup,masterRaw);
        writeUTF8(masterFile,reserializeParsedBook(master));
        var queueNote="Queue-Status: MERGED für "+batch.segments[0].id+" bis "+batch.segments[batch.segments.length-1].id+".";
        try{markQueueMerged(masterFile,master,batch,batchFile);}catch(qe){queueNote="WARNUNG: Master wurde erfolgreich zusammengeführt, Queue-Status konnte aber nicht aktualisiert werden: "+errorText(qe);}
        return "Zusammengeführt: "+filled+" englische Segmente.\r\nEnglische Überschriften: "+titleFilled+".\r\nLeer geblieben: "+unchanged+".\r\n"+queueNote+"\r\nSicherung: "+backup.fsName;
    }

    function wrapBatchAsBook(raw){
        raw=normalizeNewlines(raw);
        var m=/<translation_batch\b[^>]*\bvolume=["']([0-9]+)["'][^>]*>/i.exec(raw),v=m?m[1]:"1";
        return raw.replace(/<translation_batch\b[^>]*>/i,"<book volume=\""+v+"\">").replace(/<\/translation_batch>/i,"</book>");
    }

    function reserializeParsedBook(p){
        var out=[];out.push("<book project=\"Ben Ish Chai Halakha\" volume=\""+pad2(p.volume||1)+"\" max_pages=\""+MAX_PAGES+"\">");
        var secKey=null,i,s,key;
        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];key=s.sectionHe+"\u0001"+s.sectionEn;
            if(key!==secKey){out.push("");out.push("<section>");out.push("<he_title>"+xmlEscape(s.sectionHe)+"</he_title>");out.push("<en_title>"+xmlEscape(s.sectionEn)+"</en_title>");out.push("</section>");secKey=key;}
            out.push("");out.push("<segment id=\""+s.id+"\" n=\""+s.number+"\">");out.push("<he>"+protectCdata(s.he)+"</he>");out.push("<en>"+protectCdata(s.en)+"</en>");out.push("</segment>");
        }
        out.push("");out.push("</book>");return out.join("\r\n");
    }

    // ---------------- InDesign document building ----------------

    function buildVolumeDocument(sourceFile,statusField){
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

            var saveFile=uniqueFile(new File(sourceFile.parent.fsName+"/Ben_Ish_Chai_Band_"+pad2(p.volume||1)+".indd"));
            doc.save(saveFile);
            return "Band "+pad2(p.volume||1)+" erstellt und gespeichert.\r\nSeiten: "+doc.pages.length+" / "+MAX_PAGES+"\r\nSegmente: "+p.segments.length+" · Englisch vorhanden: "+texts.translated+" · offen: "+texts.untranslated+"\r\nDatei: "+saveFile.fsName;
        }catch(e){
            if(doc&&doc.isValid){try{doc.insertLabel("BIH_BUILD_ERROR",errorText(e));}catch(_){}}
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
        doc.pages[0].label="BIH_BODY_PAGE";
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
        page.label="BIH_BODY_PAGE";
        setPageMargins(page);
        // On right-hand pages all horizontal coordinates are mirrored.
        // This moves the complete frame group 3.53 mm to the right while
        // preserving identical inner and outer margins across the spread.
        var he=page.textFrames.add();he.geometricBounds=pageBounds(HE_BOUNDS_MM,pageNo);he.label=FRAME_HE_LABEL;
        var en=page.textFrames.add();en.geometricBounds=pageBounds(EN_BOUNDS_MM,pageNo);en.label=FRAME_EN_LABEL;
        setFrameInsets(he,0);setFrameInsets(en,0);
        try{he.textFramePreferences.verticalJustification=VerticalJustification.TOP_ALIGN;en.textFramePreferences.verticalJustification=VerticalJustification.TOP_ALIGN;}catch(_){ }

        var ruleBounds=pageBounds([RULE_Y_MM,15.9,RULE_Y_MM,128.57],pageNo);
        var line=page.graphicLines.add();line.paths[0].entirePath=[[ruleBounds[1],ruleBounds[0]],[ruleBounds[3],ruleBounds[2]]];line.strokeWeight=0.5;line.strokeColor=blackSwatch(page.parent.parent);
        var num=page.textFrames.add();
        num.geometricBounds=pageBounds([PAGE_NO_TOP_MM,15.9,11.5,28.0],pageNo);
        num.label="BIH_PAGE_NUMBER";
        try{num.insertionPoints[0].contents=SpecialCharacters.AUTO_PAGE_NUMBER;}catch(_){num.contents=String(pageNo);}
        num.texts[0].pointSize=8;num.texts[0].appliedFont=safeFont(EN_FONT,EN_FONT_STYLE);
        num.texts[0].justification=(pageNo%2===0)?Justification.LEFT_ALIGN:Justification.RIGHT_ALIGN;
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
        if(!chains.heFirst||!chains.enFirst)throw new Error("Keine BIH-HE/EN-Textrahmen gefunden.");

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
        if(!chains.heFirst||!chains.enFirst)throw new Error("Keine BIH-HE/EN-Textrahmen gefunden.");

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
        formatStory(doc,chains.enFirst.parentStory,false);recompose(doc);
        chains=ensureNoOverflow(doc,chains,statusField);trimEmptyTailPages(doc,chains,2);
        doc.insertLabel(DOC_SOURCE_LABEL,sourceFile.fsName);doc.save();
        return "Englisch aktualisiert.\r\nSeiten: "+doc.pages.length+" / "+MAX_PAGES+"\r\nÜbersetzt: "+texts.translated+" · offen: "+texts.untranslated+"\r\nSegment-IDs: "+p.segments.length;
    }

    // ---------------- Bulk InDesign layout group ----------------

    function readBulkManifest(file){
        if(!file||!file.exists)throw new Error("Bulk-Manifest nicht gefunden: "+(file?file.fsName:"?"));
        var raw=normalizeNewlines(readUTF8(file)),lines=raw.split("\n"),meta={},rows=[],inRows=false,i,parts;
        if(!lines.length||lines[0].split("\t")[0]!=="BIH_BULK_MANIFEST")throw new Error("Die gewählte TSV ist kein BIH_BULK_MANIFEST.");
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
            if(!batch.segments.length)throw new Error(file.displayName+": keine BIH-Segmente enthalten.");
            if(batch.segments[0].id!==row.firstId||batch.segments[batch.segments.length-1].id!==row.lastId)
                throw new Error(file.displayName+": BIH-Bereich stimmt nicht mit dem Bulk-Manifest überein (Manifest "+row.firstId+"–"+row.lastId+").");
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
        out.push("Batches: "+g.items.length);out.push("BIH-Bereich: "+g.firstId+" bis "+g.lastId);out.push("Queue: "+g.queueFile.fsName);out.push("");
        for(var i=0;i<g.items.length;i++)out.push(pad2(i+1)+" · "+g.items[i].firstId+" bis "+g.items[i].lastId+" · "+g.items[i].file.displayName);
        out.push("");out.push("Alle zugehörigen Queue-Einträge stehen auf MERGED und die _EN_FERTIG-Dateien wurden gefunden. Der Bulk-Lauf aktualisiert Englisch genau einmal und lokalisiert danach jeden Batch neu.");
        return out.join("\r\n");
    }

    function bulkLayoutConfirmText(g,locksText,fastMode){
        var out=[];out.push("BULK-LAYOUT STARTEN?");out.push("");out.push("Bulk-ID: "+g.bulkId);out.push("Batches: "+g.items.length);
        out.push("BIH-Bereich: "+g.firstId+" bis "+g.lastId);out.push("Modus: "+(fastMode?"Schnellmodus":"Präzisionsmodus"));
        out.push("Geschützte Seiten: "+(trim(locksText)||"keine"));out.push("");
        out.push("Ablauf:");out.push("1. Eine gemeinsame INDD-Sicherung für den gesamten Lauf.");out.push("2. Englischen Textfluss genau EINMAL aus dem aktuellen Master aktualisieren.");
        out.push("3. Jeden Batch in aufsteigender BIH-ID-Reihenfolge neu lokalisieren, analysieren und angleichen.");
        out.push("4. Bei HE- oder EN-Übersatz: automatisch vollständige zweisprachige Seiten ergänzen, neu komponieren und erneut prüfen.");
        out.push("   Abbruch nur, wenn der Übersatz nicht lösbar ist oder die 600-Seiten-Grenze erreicht wird.");
        out.push("5. Abschlussprüfung und dauerhaftes Laufprotokoll.");out.push("");out.push("Fortfahren?");return out.join("\n");
    }

    function assertNoLayoutOverflow(doc,context){
        var chains=collectChains(doc);if(!chains.heFirst||!chains.enFirst)throw new Error("HE/EN-Textrahmenketten wurden nicht gefunden"+(context?" ("+context+")":"")+".");
        var ho=storyOverflows(chains.heFirst),eo=storyOverflows(chains.enFirst);
        if(ho||eo)throw new Error("SICHERHEITSABBRUCH WEGEN ÜBERSATZ"+(context?" · "+context:"")+". Hebräisch: "+(ho?"JA":"nein")+" · Englisch: "+(eo?"JA":"nein")+".");
    }

    function createBulkLayoutProtocolFile(doc,g){
        var original;try{original=doc.fullName;}catch(_){original=null;}if(!original||!original.exists)throw new Error("Der aktive InDesign-Band muss vor dem Bulk-Lauf gespeichert sein.");
        var folder=new Folder(original.parent.fsName+"/BIH_Layout_Snapshots");if(!folder.exists&&!folder.create())throw new Error("Protokollordner konnte nicht erstellt werden: "+folder.fsName);
        return uniqueFile(new File(folder.fsName+"/Bulk_Layout_Run_"+safeFileToken(g.bulkId)+"_"+timestamp()+".txt"));
    }

    function writeBulkLayoutProtocol(file,lines){writeUTF8(file,lines.join("\r\n"));}

    function runBulkLayoutGroup(doc,sourceFile,g,locksText,statusField,progressField,fastMode){
        var started=new Date().getTime(),total=g.items.length,i,item,preview,ranges,anchorBefore,result,completed=0;
        var totalLayoutAddedPages=0,enUpdateAddedPages=0,startPageCount=doc.pages.length;
        // Physical page span actually touched by this Bulk group.  It is built from
        // every freshly re-localized batch analysis, because earlier layout changes
        // and appended pages can move later BIH ranges to different pages.
        var bulkPageMin=0,bulkPageMax=0;
        // A single safety copy is intentionally created BEFORE the one-time EN update.
        var backup=createInDesignBackup(doc,"BULK_layout_"+safeFileToken(g.firstId)+"_"+safeFileToken(g.lastId));
        var protocol=createBulkLayoutProtocolFile(doc,g),log=[];
        log.push("BEN ISH CHAI · BULK-LAYOUT LAUFPROTOKOLL");log.push("Status: RUNNING");log.push("Bulk-ID: "+g.bulkId);log.push("Manifest: "+g.manifestFile.fsName);
        log.push("Band-Master: "+sourceFile.fsName);log.push("INDD-Sicherung: "+backup.fsName);log.push("Batches: "+total);log.push("BIH-Bereich: "+g.firstId+" bis "+g.lastId);
        log.push("Modus: "+(fastMode?"Schnellmodus":"Präzisionsmodus"));log.push("Geschützte Seiten: "+(trim(locksText)||"keine"));log.push("Seiten bei Start: "+startPageCount);
        log.push("Übersatz-Regel: zuerst automatisch vollständige zweisprachige Seiten ergänzen; Abbruch nur bei nicht lösbarem Übersatz / 600-Seiten-Grenze.");
        log.push("Start: "+timestamp());log.push("");
        writeBulkLayoutProtocol(protocol,log);
        try{
            setStatus(progressField,"EN wird 1× aktualisiert …");
            setStatus(statusField,"BULK-LAYOUT · Englisch wird für "+total+" Batches genau einmal aktualisiert …");
            var pagesBeforeEn=doc.pages.length;
            var updateResult=updateEnglishInActiveDocument(sourceFile,statusField);
            enUpdateAddedPages=Math.max(0,doc.pages.length-pagesBeforeEn);
            assertNoLayoutOverflow(doc,"nach einmaliger EN-Aktualisierung");
            log.push("EN-AKTUALISIERUNG · EINMALIG");log.push(updateResult);log.push("Zusätzliche zweisprachige Seiten durch EN-Aktualisierung: "+enUpdateAddedPages);log.push("");writeBulkLayoutProtocol(protocol,log);

            for(i=0;i<total;i++){
                item=g.items[i];
                var pct=Math.round(((i+1)/total)*100);
                setStatus(progressField,(i+1)+" / "+total+" · "+pct+" %");
                setStatus(statusField,"BULK-LAYOUT "+(i+1)+" / "+total+" · ANALYSE · "+item.firstId+" bis "+item.lastId);
                // Any overset here would mean the previous repair step did not finish cleanly.
                assertNoLayoutOverflow(doc,"vor Batch "+(i+1)+" / "+total);
                // Fresh analysis is mandatory here: earlier batches and newly appended pages may
                // have moved later text to different physical pages.
                preview=getBatchLayoutAnalysis(doc,sourceFile,item.file,locksText);
                if(preview.pages&&preview.pages.length){
                    var localMin=preview.pages[0],localMax=preview.pages[preview.pages.length-1];
                    if(!bulkPageMin||localMin<bulkPageMin)bulkPageMin=localMin;
                    if(localMax>bulkPageMax)bulkPageMax=localMax;
                }
                ranges=buildBatchStoryRanges(doc,preview);
                anchorBefore=pageAnchorSummary(doc,preview,ranges.he,ranges.en);
                log.push("BATCH "+pad2(i+1)+" / "+pad2(total)+" · "+item.firstId+" bis "+item.lastId);
                log.push("Datei: "+item.file.fsName);log.push("Analyse-Seiten: "+formatPageList(preview.pages));
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
            doc.save();
            var validation=validateActiveVolume(doc),elapsed=(new Date().getTime()-started)/1000;
            log[1]="Status: SUCCESS";log.push("ABSCHLUSSPRÜFUNG");log.push(validation);log.push("");log.push("Erfolgreich verarbeitet: "+completed+" / "+total);
            var bulkPageSpan=(bulkPageMin&&bulkPageMax)?("Seite "+bulkPageMin+" bis "+bulkPageMax):"nicht bestimmbar";
            var newPageSpan=(doc.pages.length>startPageCount)?("Seite "+(startPageCount+1)+" bis "+doc.pages.length):"keine";
            log.push("EN-Aktualisierungen: 1");log.push("Zusätzliche Seiten durch EN-Aktualisierung: "+enUpdateAddedPages);
            log.push("Zusätzliche Seiten durch Bulk-Layout-Übersatzbehebung: "+totalLayoutAddedPages);
            log.push("Bulk-Layout bearbeiteter Seitenbereich: "+bulkPageSpan);
            log.push("Neu angelegte Seiten in diesem Bulk-Lauf: "+newPageSpan);
            log.push("Seiten bei Start: "+startPageCount+" · Seiten am Ende: "+doc.pages.length+" / "+MAX_PAGES);
            log.push("Gesamtlaufzeit: "+formatLayoutNumber(elapsed)+" s");log.push("Ende: "+timestamp());writeBulkLayoutProtocol(protocol,log);
            return "BULK-LAYOUT ERFOLGREICH\r\n"+
                "Bulk-ID: "+g.bulkId+"\r\nBatches: "+completed+" / "+total+"\r\nBIH-Bereich: "+g.firstId+" bis "+g.lastId+"\r\n"+
                "Bearbeiteter Layout-Seitenbereich: "+bulkPageSpan+"\r\n"+
                "Englischer Textfluss aktualisiert: genau 1× (gesamter EN-Textfluss)\r\n"+
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
            log.push("Hinweis: Übersatz allein führt nicht mehr zum Abbruch. Vor diesem Abbruch wurde automatische zweisprachige Seitenerweiterung versucht. Bereits erfolgreich abgeschlossene Batch-Layouts bleiben erhalten. Die gemeinsame INDD-Sicherung stellt bei Bedarf den Zustand VOR dem gesamten Bulk-Lauf bereit.");
            try{writeBulkLayoutProtocol(protocol,log);}catch(_log){}
            setStatus(progressField,"ABBRUCH nach "+completed+" / "+total);
            return "BULK-LAYOUT SICHERHEITSABBRUCH\r\n"+
                "Bulk-ID: "+g.bulkId+"\r\nErfolgreich abgeschlossen: "+completed+" / "+total+" Batch(es)\r\n"+
                "Grund: "+errorText(e)+"\r\n\r\nAutomatische zweisprachige Seitenerweiterung wurde vor einem Übersatz-Abbruch versucht.\r\n"+
                "Spätere Batches wurden NICHT ausgeführt.\r\nAktueller Seitenstand: "+doc.pages.length+" / "+MAX_PAGES+"\r\n"+
                "Gemeinsame INDD-Sicherung vor dem Bulk-Lauf: "+backup.fsName+"\r\nLaufprotokoll: "+protocol.fsName;
        }
    }

    // ---------------- Controlled per-batch layout balancing ----------------

    function analyzeBatchLayout(doc,sourceFile,batchFile,locksText){
        recompose(doc);
        var a=getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText);
        var ranges=buildBatchStoryRanges(doc,a);
        var anchor=pageAnchorSummary(doc,a,ranges.he,ranges.en);
        return "BATCH-LAYOUT ANALYSE\r\n"+
            "IDs: "+a.firstId+" bis "+a.lastId+" · "+a.ids.length+" Segmente\r\n"+
            "Betroffene Seiten: "+formatPageList(a.pages)+"\r\n"+
            "Geschützte Seiten: "+(a.lockedText||"keine")+"\r\n"+
            "ID-Seitenabweichung: "+a.score+" · größte Seitenabweichung: "+a.maxLag+"\r\n"+
            "Grenzfehler: "+formatLayoutNumber(anchor.score)+" · größte normalisierte Abweichung: "+formatLayoutNumber(anchor.max)+" Segmente\r\n"+
            "Grenzen mit unterschiedlicher BIH-ID: "+anchor.idMismatch+" · gleiche BIH-ID: "+anchor.sameId+"\r\n"+
            "Seiten mit HE voraus: "+anchor.heAhead+" · EN voraus: "+anchor.enAhead+" · ausreichend passend: "+anchor.aligned+"\r\n"+
            "Verglichene ID-Paare: "+a.compared+" / "+a.ids.length+"\r\n\r\n"+
            "v1.0.12 setzt vor der Analyse den Textfluss neu und vergleicht nicht mehr rohe Zeichenprozente. " +
            "An jeder Seitengrenze wird zuerst geprüft, welche stabile BIH-ID HE und EN erreicht haben. " +
            "Nur innerhalb derselben ID wird der Fortschritt anhand der tatsächlich gesetzten Zeilen normalisiert. " +
            "Dadurch können unterschiedliche Übersetzungslängen die Rahmen nicht mehr in eine falsche Richtung ziehen.";
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
        var pages=affectedPagesForIds(ids,heMap,enMap,doc.pages.length);
        var locks=parsePageRanges(locksText,doc.pages.length);
        var lockedText=formatPageList(objectKeysAsNumbers(locks));
        return {parsed:p,batch:b,ids:ids,firstId:ids[0],lastId:ids[ids.length-1],heMap:heMap,enMap:enMap,
            score:metric.score,maxLag:metric.maxLag,fineScore:metric.fineScore,maxFineLag:metric.maxFineLag,
            compared:metric.compared,pages:pages,locks:locks,lockedText:lockedText,
            batchStartIndex:masterIndex[ids[0]],batchEndIndex:masterIndex[ids[ids.length-1]]+1};
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
        if(ei!==expected.length)throw new Error((isEnglish?"Englischer":"Hebräischer")+" Textfluss konnte nur "+ei+" von "+expected.length+" Segmenten den BIH-IDs zuordnen.");
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
        var current=frameBottomMm(pair.he);
        var minSplit=HE_BOUNDS_MM[0]+LAYOUT_MIN_HE_HEIGHT_MM;
        var maxSplit=EN_BOUNDS_MM[2]-LAYOUT_GAP_MM-LAYOUT_MIN_EN_HEIGHT_MM;
        if(current<minSplit)current=minSplit;if(current>maxSplit)current=maxSplit;

        // The document is already composed after the preceding page.  Reading
        // the current anchor therefore costs no additional recomposition.
        var base=evaluatePageAnchor(pair,a,heRanges,enRanges);base.split=current;
        if(!base.valid)return {changed:false,page:pageNo,reason:"kein Anker"};
        if(base.idGap===0&&Math.abs(base.delta)<=LAYOUT_ANCHOR_OK){
            if(perf)perf.skipped++;
            return {changed:false,page:pageNo,before:base.error,after:base.error,oldSplit:current,newSplit:current,
                deltaBefore:base.delta,deltaAfter:base.delta,idGapBefore:base.idGap,idGapAfter:base.idGap,fastSkipped:true};
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
            return {changed:false,page:pageNo,before:base.error,after:base.error,oldSplit:current,newSplit:current,
                deltaBefore:base.delta,deltaAfter:base.delta,idGapBefore:base.idGap,idGapAfter:base.idGap};
        }
        if(Math.abs(applied-best.split)>0.01){setDividerOnFrames(pair.he,pair.en,best.split);recomposeBilingualStories(pair);if(perf)perf.probes++;}
        return {changed:true,page:pageNo,before:base.error,after:best.error,oldSplit:current,newSplit:best.split,
            deltaBefore:base.delta,deltaAfter:best.delta,idGapBefore:base.idGap,idGapAfter:best.idGap};
    }

    function optimizeOnePageDividerPrecise(doc,pageNo,a,heRanges,enRanges){
        var pair=findBilingualFramesOnPage(doc.pages[pageNo-1]);
        if(!pair.he||!pair.en)return {changed:false,page:pageNo,reason:"Rahmen fehlen"};
        var current=frameBottomMm(pair.he);
        var minSplit=HE_BOUNDS_MM[0]+LAYOUT_MIN_HE_HEIGHT_MM;
        var maxSplit=EN_BOUNDS_MM[2]-LAYOUT_GAP_MM-LAYOUT_MIN_EN_HEIGHT_MM;
        if(current<minSplit)current=minSplit;if(current>maxSplit)current=maxSplit;

        var base=evaluateDividerCandidate(doc,pair,current,a,heRanges,enRanges);
        if(!base.valid)return {changed:false,page:pageNo,reason:"kein Anker"};
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
            return {changed:false,page:pageNo,before:base.error,after:base.error,oldSplit:current,newSplit:current,
                delta:base.delta,idGapBefore:base.idGap,idGapAfter:base.idGap};
        }
        setDividerOnFrames(pair.he,pair.en,best.split);recompose(doc);
        return {changed:true,page:pageNo,before:base.error,after:best.error,oldSplit:current,newSplit:best.split,
            deltaBefore:base.delta,deltaAfter:best.delta,idGapBefore:base.idGap,idGapAfter:best.idGap};
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
        // confirmation.  This avoids a second complete story/page mapping pass.
        var a=preparedAnalysis||getBatchLayoutAnalysis(doc,sourceFile,batchFile,locksText);
        if(!a.compared)throw new Error("Für diesen Batch konnten keine HE/EN-ID-Paare verglichen werden.");
        var ranges=options.preparedRanges||buildBatchStoryRanges(doc,a);
        var anchorBefore=pageAnchorSummary(doc,a,ranges.he,ranges.en);

        if(a.score===0&&anchorBefore.max<=LAYOUT_ANCHOR_OK){
            if(options.outcome){options.outcome.addedPages=0;options.outcome.changedPages=0;options.outcome.pageCountAfter=doc.pages.length;options.outcome.alreadyAligned=true;}
            return "Batch "+a.firstId+" bis "+a.lastId+" ist bereits ausreichend ausgerichtet. Keine Rahmenänderung erforderlich.\r\n"+
                "ID-Seitenabweichung: 0 · größte normalisierte Grenzabweichung: "+formatLayoutNumber(anchorBefore.max)+" Segmente.";
        }

        var originalPageCount=doc.pages.length;
        var original=captureLayoutGeometry(doc,a.pages);
        var backup=null,backupPath="";
        if(options.skipInddBackup){backupPath=options.backupPath||"";}
        else{backup=createInDesignBackup(doc,"layout_"+safeFileToken(a.firstId)+"_"+safeFileToken(a.lastId));backupPath=backup.fsName;}
        var snap=writeLayoutSnapshot(doc,batchFile,a,original);
        doc.insertLabel(DOC_LAYOUT_SNAPSHOT_LABEL,snap.fsName);
        doc.insertLabel(DOC_LAYOUT_BATCH_LABEL,a.firstId+".."+a.lastId);
        doc.insertLabel(DOC_LAYOUT_LOCKS_LABEL,locksText||"");

        var changes=[],i,pn,res,addedPages=0;
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

            // One full-document recompose is deliberately retained here as the
            // final integrity checkpoint.  Candidate probes in Fast Mode only
            // recompose the two affected stories.
            recompose(doc);
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

            if(changes.length&&anchorAfter.score>anchorBefore.score+LAYOUT_ANCHOR_EPSILON){
                restoreFailedBatchLayout(doc,original,originalPageCount);
                throw new Error("Sicherheitsabbruch: Die Summe der Seitenanker wäre schlechter geworden. Der ursprüngliche Rahmen- und Seitenzustand wurde wiederhergestellt.");
            }

            if(!options.skipSave)doc.save();
            appendLayoutAudit(doc,fastMode?"APPLY_FAST":"APPLY_PRECISE",a.firstId,a.lastId,
                a.score+" / Anker "+formatLayoutNumber(anchorBefore.score),
                finalA.score+" / Anker "+formatLayoutNumber(anchorAfter.score),
                a.pages,a.lockedText,backupPath,snap.fsName);

            var detail=[],d;
            for(i=0;i<changes.length;i++){
                d=changes[i];
                detail.push("Seite "+d.page+": Trennlinie "+formatLayoutNumber(d.oldSplit)+" → "+formatLayoutNumber(d.newSplit)+" mm · BIH-ID-Abstand "+d.idGapBefore+" → "+d.idGapAfter+" · norm. Fortschritt "+formatLayoutNumber(Math.abs(d.deltaBefore))+" → "+formatLayoutNumber(Math.abs(d.deltaAfter)));
            }
            var elapsed=(new Date().getTime()-started)/1000;
            if(options.outcome){
                options.outcome.addedPages=addedPages;
                options.outcome.changedPages=changes.length;
                options.outcome.pageCountBefore=originalPageCount;
                options.outcome.pageCountAfter=doc.pages.length;
                options.outcome.firstId=a.firstId;
                options.outcome.lastId=a.lastId;
                options.outcome.alreadyAligned=false;
            }
            return "BATCH-LAYOUT ANGEGLICHEN\r\n"+
                "Modus: "+(fastMode?"Schnellmodus v1.0.13":"Präzisionsmodus v1.0.12")+"\r\n"+
                "Laufzeit: "+formatLayoutNumber(elapsed)+" s"+(fastMode?" · Divider-Proben: "+perf.probes+" · Cache-Treffer: "+perf.cacheHits+" · bereits passende Seiten übersprungen: "+perf.skipped:"")+"\r\n"+
                "IDs: "+a.firstId+" bis "+a.lastId+"\r\n"+
                "Betroffene Seiten: "+formatPageList(a.pages)+"\r\n"+
                "Geschützte Seiten: "+(a.lockedText||"keine")+"\r\n"+
                "ID-Seitenabweichung vorher: "+a.score+" · nachher: "+finalA.score+"\r\n"+
                "Grenzfehler vorher: "+formatLayoutNumber(anchorBefore.score)+" · nachher: "+formatLayoutNumber(anchorAfter.score)+"\r\n"+
                "Grenzen mit unterschiedlicher BIH-ID vorher: "+anchorBefore.idMismatch+" · nachher: "+anchorAfter.idMismatch+"\r\n"+
                "Größte normalisierte Abweichung vorher: "+formatLayoutNumber(anchorBefore.max)+" · nachher: "+formatLayoutNumber(anchorAfter.max)+" Segmente\r\n"+
                "Tatsächlich geänderte Seiten: "+changes.length+"\r\n"+
                "Zusätzlich benötigte Seiten wegen Übersatz: "+addedPages+"\r\n"+
                "INDD-Sicherung: "+(backupPath||"keine separate Sicherung")+"\r\n"+
                "Layout-Snapshot: "+snap.fsName+"\r\n\r\n"+
                (detail.length?detail.join("\r\n")+"\r\n\r\n":"")+
                (changes.length?"Die Trennhöhen wurden tatsächlich verändert und jede geänderte Seite ist oben protokolliert. ":"Es wurde auf keiner Seite eine messbare Verbesserung gefunden; die Rahmen blieben unverändert. ")+
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
        var original=captureLayoutGeometry(doc,a.pages);
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
                "Standard: HE unten 103,24 mm · EN oben 106,24 mm\r\n"+
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
        var folder=new Folder(original.parent.fsName+"/BIH_Layout_Snapshots");if(!folder.exists&&!folder.create())throw new Error("Snapshot-Ordner konnte nicht erstellt werden: "+folder.fsName);
        var f=uniqueFile(new File(folder.fsName+"/Layout_Batch_"+safeFileToken(a.firstId)+"_bis_"+safeFileToken(a.lastId)+"_"+timestamp()+".tsv"));
        var lines=["BIH_LAYOUT_SNAPSHOT\t2","batch\t"+tsv(batchFile.fsName),"ids\t"+a.firstId+"\t"+a.lastId,"pages\t"+formatPageList(a.pages),"page_count\t"+doc.pages.length,"locks\t"+(a.lockedText||"")];
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
        var folder=new Folder(original.parent.fsName+"/BIH_Layout_Snapshots");if(!folder.exists&&!folder.create())return;
        var f=new File(folder.fsName+"/BIH_Layout_Audit.tsv"),isNew=!f.exists;
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

    function composeDisplayTexts(p){
        var he=[],en=[],lastHe=null,lastEn=null,translated=0,untranslated=0,i,s;
        for(i=0;i<p.segments.length;i++){
            s=p.segments[i];
            if(s.sectionHe!==lastHe){he.push("<section>"+s.sectionHe+"</section>");lastHe=s.sectionHe;}
            he.push("<b>["+s.number+"]</b> "+s.he);
            if(trim(stripTags(s.en))){
                if(!trim(s.sectionEn))throw new Error("Englische Abschnittsüberschrift fehlt für: "+s.sectionHe+". Der englische Textfluss wird nicht mit einem hebräischen Ersatztitel aufgebaut.");
                if(/[\u0590-\u05FF]/.test(s.sectionEn))throw new Error("Das englische Titelfeld enthält hebräische Zeichen für: "+s.sectionHe+".");
                if(s.sectionEn!==lastEn){en.push("<section>"+s.sectionEn+"</section>");lastEn=s.sectionEn;}
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
        try{hh.basedOn=he;hh.appliedFont=safeFont(HE_FONT,HE_FONT_STYLE);hh.pointSize=17;hh.leading=20;hh.justification=Justification.CENTER_ALIGN;hh.spaceBefore=10;hh.spaceAfter=7;hh.keepWithNext=2;}catch(_){ }
        try{eh.basedOn=en;eh.appliedFont=safeFont(EN_FONT,"Bold");eh.pointSize=15;eh.leading=18;eh.justification=Justification.CENTER_ALIGN;eh.spaceBefore=10;eh.spaceAfter=7;eh.keepWithNext=2;}catch(_){ }
        var b=ensureChar(doc,CHAR_BOLD),it=ensureChar(doc,CHAR_ITALIC),hi=ensureChar(doc,CHAR_HE_IN_EN),sm=ensureChar(doc,CHAR_SMALL),su=ensureChar(doc,CHAR_SUP);
        try{b.fontStyle="Bold";}catch(_){ }
        try{it.fontStyle="Italic";}catch(_){ }
        try{hi.appliedFont=safeFont(HE_FONT,HE_FONT_STYLE);hi.fontStyle=HE_FONT_STYLE;hi.pointSize=9;}catch(_){ }
        try{sm.pointSize=8;}catch(_){ }
        try{su.position=Position.SUPERSCRIPT;}catch(_){ }
        return {he:he,en:en,heHead:hh,enHead:eh,bold:b,italic:it,heInEn:hi,small:sm,sup:su};
    }

    function formatStory(doc,story,isHebrew){
        var st=ensureStyles(doc),base=isHebrew?st.he:st.en;
        try{story.paragraphs.everyItem().appliedParagraphStyle=base;}catch(_){ }
        grepApplyParagraphAndStrip(story,"<section>([\\s\\S]*?)</section>",isHebrew?st.heHead:st.enHead,"$1");
        grepApplyAndStrip(story,"<b>([\\s\\S]*?)</b>",st.bold,"$1");
        grepApplyAndStrip(story,"<i>([\\s\\S]*?)</i>",st.italic,"$1");
        grepApplyAndStrip(story,"<small>([\\s\\S]*?)</small>",st.small,"$1");
        grepApplyAndStrip(story,"<sup>([\\s\\S]*?)</sup>",st.sup,"$1");
        grepReplace(story,"<br\\s*/?>","\\r");
        if(!isHebrew)grepApply(story,"[\\x{0590}-\\x{05FF}]+",st.heInEn);
        resetGrep();
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

    function validateActiveVolume(doc){
        var chains=collectChains(doc),out=[],heCheck=inspectFrameSequence(chains.heFrames),enCheck=inspectFrameSequence(chains.enFrames);
        out.push("Dokument: "+doc.name);out.push("Band: "+(doc.extractLabel(DOC_VOLUME_LABEL)||"nicht gekennzeichnet"));
        out.push("Seiten: "+doc.pages.length+" / "+MAX_PAGES+(doc.pages.length>MAX_PAGES?" · FEHLER":" · OK"));
        out.push("Hebräisch-Rahmen: "+chains.heFrames.length+" · Englisch-Rahmen: "+chains.enFrames.length);
        out.push("HE-Verkettung: "+(heCheck.breaks.length?"UNTERBROCHEN bei "+heCheck.breaks.join(", "):"OK"));
        out.push("EN-Verkettung: "+(enCheck.breaks.length?"UNTERBROCHEN bei "+enCheck.breaks.join(", "):"OK"));
        out.push("Hebräisch-Übersatz: "+(chains.heFirst&&storyOverflows(chains.heFirst)?"JA":"nein"));
        out.push("Englisch-Übersatz: "+(chains.enFirst&&storyOverflows(chains.enFirst)?"JA":"nein"));
        out.push("Quelle: "+(doc.extractLabel(DOC_SOURCE_LABEL)||"nicht gespeichert"));
        if(chains.heFrames.length!==chains.enFrames.length)out.push("WARNUNG: Die Zahl der HE- und EN-Rahmen stimmt nicht überein.");
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
    function safeFont(family,style){var f=app.fonts.itemByName(family+"\t"+style);if(f&&f.isValid)return f;f=app.fonts.itemByName(family);if(f&&f.isValid)return f;return app.fonts[0];}
    function blackSwatch(doc){var s=doc.swatches.itemByName("Black");if(s&&s.isValid)return s;s=doc.swatches.itemByName("$ID/Black");if(s&&s.isValid)return s;return doc.swatches[doc.swatches.length-1];}
    function requireProductionFonts(){
        var h=app.fonts.itemByName(HE_FONT+"\t"+HE_FONT_STYLE),e=app.fonts.itemByName(EN_FONT+"\t"+EN_FONT_STYLE);
        if(!h||!h.isValid)throw new Error("Erforderliche Schrift fehlt: "+HE_FONT+" "+HE_FONT_STYLE+".");
        if(!e||!e.isValid)throw new Error("Erforderliche Schrift fehlt: "+EN_FONT+" "+EN_FONT_STYLE+".");
    }
    function setFrameInsets(tf,v){try{tf.textFramePreferences.insetSpacing=[v,v,v,v];}catch(_){}}
    function setPageMargins(page){
        try{
            var m=page.marginPreferences;
            m.top=mm(MARGIN_MM);m.bottom=mm(MARGIN_MM);m.left=mm(MARGIN_MM);m.right=mm(MARGIN_MM);
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
    function pageBounds(a,pageNo){
        if(pageNo%2===1)return [mm(a[0]),mm(PAGE_W_MM-a[3]),mm(a[2]),mm(PAGE_W_MM-a[1])];
        return mmBounds(a);
    }
    function setStatus(field,text){try{field.text=text;field.window.update();}catch(_){}}
    function positiveInt(v,fallback){var n=parseInt(v,10);return isNaN(n)||n<1?fallback:n;}
    function pad2(n){n=String(n);return n.length<2?"0"+n:n;}
    function trim(s){return String(s||"").replace(/^\s+|\s+$/g,"");}
    function normalizeNewlines(s){return String(s||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");}
    function stripBom(s){return s.charCodeAt(0)===0xFEFF?s.substring(1):s;}
    function stripTags(s){return String(s||"").replace(/<[^>]+>/g,"");}
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
